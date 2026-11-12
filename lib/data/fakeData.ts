import { orgNudges } from "@/lib/domain/nudges";
import { rankEvents } from "@/lib/domain/rank";
import { makeFixtures } from "@/lib/fixtures";
import type { EventItem, Organization, Profile } from "@/lib/types";
import { UNSUPPORTED_CHANGE, type AppData, type SettingsProposal } from "./AppData";

const KEY = "ef-proto-v1";

interface State {
  profile: Profile;
  events: EventItem[];
  orgs: Organization[];
  proposals: Record<string, { proposal: SettingsProposal; apply: Patch[] }>;
}

type Patch =
  | { kind: "profile"; patch: Partial<Profile> }
  | { kind: "org_status"; orgId: string; status: Organization["status"] };

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

/** Clickable-prototype data: fixtures + browser storage. Understands a few canned settings requests. */
export function createFakeData(storage: Storage, now: () => Date): AppData {
  const load = (): State => {
    try {
      const raw = storage.getItem(KEY);
      if (raw) return JSON.parse(raw) as State;
    } catch {
      /* fall through to fresh fixtures */
    }
    return { ...makeFixtures(now()), proposals: {} };
  };
  let state = load();
  const save = () => {
    try {
      storage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: keep in memory */
    }
  };
  const findEvent = (id: string) => state.events.find((e) => e.id === id);
  const findOrg = (id: string) => state.orgs.find((o) => o.id === id);

  function parse(text: string): { changes: SettingsProposal["changes"]; apply: Patch[] } | null {
    const t = text.trim();
    const p = state.profile;
    const radius = t.match(/within\s+(\d+)\s*mi/i);
    if (radius) {
      const to = Number(radius[1]);
      if (to < 1 || to > 100) return null;
      return {
        changes: [{ field: "radiusMiles", from: String(p.radiusMiles), to: String(to), text: `Radius: ${p.radiusMiles} → ${to} miles` }],
        apply: [{ kind: "profile", patch: { radiusMiles: to } }],
      };
    }
    const cost = t.match(/(?:under|below|less than|max(?:imum)?)\s*\$?\s*([\d,]+)/i);
    if (cost) {
      const to = Number(cost[1].replace(/,/g, ""));
      return {
        changes: [{ field: "costCeilingUsd", from: String(p.costCeilingUsd), to: String(to), text: `Cost limit: ${money(p.costCeilingUsd)} → ${money(to)}` }],
        apply: [{ kind: "profile", patch: { costCeilingUsd: to } }],
      };
    }
    const follow = t.match(/^(un)?follow\s+(?:the\s+)?(.+)$/i);
    if (follow) {
      const name = follow[2].trim().toLowerCase();
      const org = state.orgs.find((o) => o.name.toLowerCase().includes(name));
      if (!org) return null;
      const status = follow[1] ? "not_interested" : "following";
      return {
        changes: [{ field: "follow_org", from: org.status, to: status, text: `${follow[1] ? "Stop following" : "Follow"}: ${org.name}` }],
        apply: [{ kind: "org_status", orgId: org.id, status }],
      };
    }
    return null;
  }

  return {
    async getProfile() {
      return state.profile;
    },
    async listEvents() {
      return rankEvents(state.events, state.profile, now());
    },
    async listGoing() {
      return state.events
        .filter((e) => e.mark === "going")
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    },
    async getEvent(id) {
      return findEvent(id) ?? null;
    },
    async setMark(id, mark, reason = null) {
      const e = findEvent(id);
      if (!e) return;
      e.mark = mark;
      e.hideReason = mark === "hidden" ? reason : null;
      save();
    },
    async recordOutcome(id, outcome, note) {
      const e = findEvent(id);
      if (!e) return;
      e.outcome = outcome;
      e.outcomeNote = note?.trim() || null;
      save();
    },
    async listOrgs() {
      const t = now();
      return {
        following: state.orgs
          .filter((o) => o.status === "following")
          .map((o) => ({ ...o, nudges: orgNudges(o, state.events, t, state.profile.timezone) })),
        suggested: state.orgs.filter((o) => o.status === "suggested"),
      };
    },
    async getOrg(id) {
      const org = findOrg(id);
      if (!org) return null;
      const events = state.events
        .filter((e) => e.orgId === id)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
      return { org, events };
    },
    async setOrgStatus(id, status) {
      const o = findOrg(id);
      if (!o) return;
      o.status = status;
      if (status === "following" && !o.followedAt) o.followedAt = now().toISOString();
      save();
    },
    async markContacted(id) {
      const o = findOrg(id);
      if (!o) return;
      o.lastContactedAt = now().toISOString();
      save();
    },
    async proposeSettingsChange(text) {
      const id = `prop-${now().getTime()}-${Math.random().toString(36).slice(2, 7)}`;
      const parsed = parse(text);
      const proposal: SettingsProposal = parsed
        ? { id, changes: parsed.changes, unsupported: null }
        : { id, changes: [], unsupported: UNSUPPORTED_CHANGE };
      state.proposals[id] = { proposal, apply: parsed?.apply ?? [] };
      save();
      return proposal;
    },
    async confirmSettingsChange(proposalId) {
      const entry = state.proposals[proposalId];
      if (!entry) return;
      for (const p of entry.apply) {
        if (p.kind === "profile") state.profile = { ...state.profile, ...p.patch };
        else {
          const o = findOrg(p.orgId);
          if (o) {
            o.status = p.status;
            if (p.status === "following" && !o.followedAt) o.followedAt = now().toISOString();
          }
        }
      }
      delete state.proposals[proposalId];
      save();
    },
  };
}

/** Clears prototype state (used by the "reset sample data" link). */
export function resetFakeData(storage: Storage) {
  storage.removeItem(KEY);
}
