import { orgNudges } from "@/lib/domain/nudges";
import { rankEvents } from "@/lib/domain/rank";
import { makeFixtures } from "@/lib/fixtures";
import { simpleParse } from "@/lib/settings/simpleParse";
import type { SettingsPatch } from "@/lib/settings/types";
import type { EventItem, Organization, Profile } from "@/lib/types";
import { UNSUPPORTED_CHANGE, type AppData, type SettingsProposal } from "./AppData";

const KEY = "ef-proto-v1";

interface State {
  profile: Profile;
  events: EventItem[];
  orgs: Organization[];
  proposals: Record<string, { proposal: SettingsProposal; apply: Patch[] }>;
}

type Patch = SettingsPatch;

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
  const state = load();
  const save = () => {
    try {
      storage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: keep in memory */
    }
  };
  const findEvent = (id: string) => state.events.find((e) => e.id === id);
  const findOrg = (id: string) => state.orgs.find((o) => o.id === id);

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
      const parsed = simpleParse(text, state.profile, state.orgs);
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
        else if (p.kind === "org_create") state.orgs.push(p.org);
        else if (p.kind === "search_now") continue; // prototype: nothing to search
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
