import { stripStored, type Repo } from "@/lib/db/repo";
import { orgNudges } from "@/lib/domain/nudges";
import { rankEvents } from "@/lib/domain/rank";
import { refreshKey } from "@/lib/engine/refresh";
import { simpleParse } from "@/lib/settings/simpleParse";
import type { Proposer, SettingsPatch } from "@/lib/settings/types";
import type { Profile } from "@/lib/types";
import { UNSUPPORTED_CHANGE, type AppData, type SettingsProposal } from "./AppData";

const ALREADY_SEARCHED = "I already looked for new events today. You can ask again tomorrow, and the regular search still runs Monday.";

export interface ServiceDeps {
  repo: Repo;
  profileId: string;
  now: () => Date;
  /** Defaults to the free regex parser; Task 17 passes one with an LLM fallback. */
  proposer?: Proposer;
  /** Called after a confirmed change (e.g. email Rayyan, re-score). */
  onSettingsApplied?: (proposal: SettingsProposal, before: Profile, after: Profile) => Promise<void> | void;
}

/** Server-side AppData backed by the database. Same behaviour as the prototype. */
export function createServiceData(deps: ServiceDeps): AppData {
  const { repo, profileId, now } = deps;
  const proposer: Proposer = deps.proposer ?? (async (t, p, o) => simpleParse(t, p, o));

  async function profile(): Promise<Profile> {
    const p = await repo.getProfile(profileId);
    if (!p) throw new Error(`Profile ${profileId} not found`);
    return p;
  }

  async function applyPatches(patches: SettingsPatch[]) {
    for (const p of patches) {
      if (p.kind === "profile") await repo.updateProfile(profileId, p.patch);
      else if (p.kind === "org_status") await repo.setOrgStatus(p.orgId, p.status, now());
      else if (p.kind === "org_create") await repo.upsertOrgs(profileId, [p.org]);
      else await repo.getOrCreateRun(profileId, "weekly", refreshKey(now(), (await profile()).timezone), () => crypto.randomUUID(), "collect");
    }
  }

  return {
    getProfile: profile,
    async listEvents() {
      const [p, events] = await Promise.all([profile(), repo.listEvents(profileId)]);
      return rankEvents(events.map(stripStored), p, now());
    },
    async listGoing() {
      return (await repo.listEvents(profileId))
        .filter((e) => e.mark === "going")
        .map(stripStored)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    },
    async getEvent(id) {
      const e = await repo.getEvent(id);
      return e ? stripStored(e) : null;
    },
    async setMark(id, mark, reason = null) {
      await repo.setMark(id, mark, mark === "hidden" ? reason : null);
    },
    async recordOutcome(id, outcome, note) {
      await repo.recordOutcome(id, outcome, note?.trim() || null);
    },
    async listOrgs() {
      const [p, orgs, events] = await Promise.all([profile(), repo.listOrgs(profileId), repo.listEvents(profileId)]);
      const t = now();
      return {
        following: orgs
          .filter((o) => o.status === "following")
          .map((o) => ({ ...o, nudges: orgNudges(o, events, t, p.timezone) })),
        suggested: orgs.filter((o) => o.status === "suggested"),
      };
    },
    async getOrg(id) {
      const org = await repo.getOrg(id);
      if (!org) return null;
      const events = (await repo.listEvents(profileId))
        .filter((e) => e.orgId === id)
        .map(stripStored)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
      return { org, events };
    },
    async setOrgStatus(id, status) {
      await repo.setOrgStatus(id, status, now());
    },
    async markContacted(id) {
      await repo.markContacted(id, now());
    },
    async proposeSettingsChange(text) {
      const [p, orgs] = await Promise.all([profile(), repo.listOrgs(profileId)]);
      const id = crypto.randomUUID();
      const parsed = text.trim() ? await proposer(text, p, orgs) : null;
      let change = parsed && "changes" in parsed ? parsed : null;
      // One extra search a day: drop the search if today's already happened.
      if (change?.apply.some((a) => a.kind === "search_now") && (await repo.getRun(profileId, "weekly", refreshKey(now(), p.timezone)))) {
        const apply = change.apply.filter((a) => a.kind !== "search_now");
        const changes = change.changes.filter((c) => c.field !== "search_now");
        change = changes.length ? { changes, apply } : null;
        if (!change) {
          const proposal: SettingsProposal = { id, changes: [], unsupported: ALREADY_SEARCHED };
          await repo.saveProposal(profileId, proposal, []);
          return proposal;
        }
      }
      const proposal: SettingsProposal = change
        ? { id, changes: change.changes, unsupported: null }
        : { id, changes: [], unsupported: parsed && "message" in parsed ? parsed.message : UNSUPPORTED_CHANGE };
      await repo.saveProposal(profileId, proposal, change?.apply ?? []);
      return proposal;
    },
    async confirmSettingsChange(proposalId) {
      const taken = await repo.takeProposal(profileId, proposalId);
      if (!taken) return;
      const before = await profile();
      await applyPatches(taken.patches);
      if (deps.onSettingsApplied) await deps.onSettingsApplied(taken.proposal, before, await profile());
    },
  };
}
