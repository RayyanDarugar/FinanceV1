import type { SettingsProposal } from "@/lib/data/AppData";
import type { SettingsPatch } from "@/lib/settings/types";
import type { Organization, Profile } from "@/lib/types";
import { newUsage } from "@/lib/engine/usage";
import { assertUniqueKeys, keptOnRefind, nameKey, USER_ORG_FIELDS, type Repo, type StoredEvent } from "./repo";
import type { Run, RunPage } from "./runs";

/** In-memory Repo for tests and local scripts. Same semantics as supabaseRepo. */
export function createMemoryRepo(): Repo & { _events: Map<string, StoredEvent & { profileId: string }> } {
  const profiles = new Map<string, { profile: Profile; hash: string }>();
  const events = new Map<string, StoredEvent & { profileId: string }>();
  const orgs = new Map<string, Organization & { profileId: string }>();
  const proposals = new Map<string, { profileId: string; proposal: SettingsProposal; patches: SettingsPatch[]; applied: boolean }>();
  const geo = new Map<string, { lat: number; lng: number } | null>();
  const runs = new Map<string, Run>();
  const runPages = new Map<string, RunPage>(); // key runId|url
  const clone = <T>(v: T): T => structuredClone(v);
  const strip = <T extends { profileId: string }>(v: T) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { profileId, ...rest } = clone(v);
    return rest;
  };

  return {
    _events: events,
    async putProfile(p, hash) {
      profiles.set(p.id, { profile: clone(p), hash });
    },
    async getProfile(id) {
      const r = profiles.get(id);
      return r ? clone(r.profile) : null;
    },
    async getPasscodeHash(id) {
      return profiles.get(id)?.hash ?? null;
    },
    async updateProfile(id, patch) {
      const r = profiles.get(id);
      if (r) r.profile = { ...r.profile, ...clone(patch) };
    },

    async listEvents(profileId) {
      return [...events.values()].filter((e) => e.profileId === profileId).map(strip);
    },
    async getEvent(id) {
      const e = events.get(id);
      return e ? strip(e) : null;
    },
    async upsertEvents(profileId, _runId, list) {
      assertUniqueKeys(list); // Postgres rejects these too
      for (const incoming of list) {
        const existing = [...events.values()].find((e) => e.profileId === profileId && e.dedupeKey === incoming.dedupeKey);
        if (existing) {
          const copy = clone(incoming);
          const keep = keptOnRefind(existing, copy);
          events.set(existing.id, { ...copy, ...keep, id: existing.id, profileId });
        } else {
          events.set(incoming.id, { ...clone(incoming), profileId });
        }
      }
    },
    async updateEvent(id, patch) {
      const e = events.get(id);
      if (e) events.set(id, { ...e, ...clone(patch), id });
    },
    async setMark(id, mark, reason) {
      const e = events.get(id);
      if (e) Object.assign(e, { mark, hideReason: mark === "hidden" ? reason : null });
    },
    async recordOutcome(id, outcome, note) {
      const e = events.get(id);
      if (e) Object.assign(e, { outcome, outcomeNote: note });
    },

    async listOrgs(profileId) {
      return [...orgs.values()].filter((o) => o.profileId === profileId).map(strip);
    },
    async getOrg(id) {
      const o = orgs.get(id);
      return o ? strip(o) : null;
    },
    async upsertOrgs(profileId, list) {
      for (const incoming of list) {
        const existing = [...orgs.values()].find((o) => o.profileId === profileId && nameKey(o.name) === nameKey(incoming.name));
        if (existing) {
          const keep = Object.fromEntries(USER_ORG_FIELDS.map((k) => [k, existing[k]]));
          orgs.set(existing.id, { ...clone(incoming), ...keep, id: existing.id, name: existing.name, profileId });
        } else {
          orgs.set(incoming.id, { ...clone(incoming), profileId });
        }
      }
    },
    async setOrgStatus(id, status, now) {
      const o = orgs.get(id);
      if (!o) return;
      o.status = status;
      if (status === "following" && !o.followedAt) o.followedAt = now.toISOString();
    },
    async markContacted(id, now) {
      const o = orgs.get(id);
      if (o) o.lastContactedAt = now.toISOString();
    },

    async saveProposal(profileId, proposal, patches) {
      proposals.set(proposal.id, { profileId, proposal: clone(proposal), patches: clone(patches), applied: false });
    },
    async takeProposal(profileId, id) {
      const p = proposals.get(id);
      if (!p || p.profileId !== profileId || p.applied) return null;
      p.applied = true;
      return { proposal: clone(p.proposal), patches: clone(p.patches) };
    },

    async getRun(profileId, kind, weekKey) {
      const r = [...runs.values()].find((x) => x.profileId === profileId && x.kind === kind && x.weekKey === weekKey);
      return r ? clone(r) : null;
    },
    async getOrCreateRun(profileId, kind, weekKey, newId, first) {
      const existing = [...runs.values()].find((x) => x.profileId === profileId && x.kind === kind && x.weekKey === weekKey);
      if (existing) return clone(existing);
      const run: Run = {
        id: newId(), profileId, kind, weekKey, stage: first, cursor: { sources: 0, queries: 0 },
        lockedUntil: null, lockToken: null, emailedAt: null, usage: newUsage(), error: null,
      };
      runs.set(run.id, run);
      return clone(run);
    },
    async lockRun(id, until, now) {
      const r = runs.get(id);
      if (!r || (r.lockedUntil && Date.parse(r.lockedUntil) > now.getTime())) return null;
      r.lockedUntil = until.toISOString();
      r.lockToken = crypto.randomUUID();
      return clone(r);
    },
    async saveRun(id, patch, token) {
      const r = runs.get(id);
      if (r && r.lockToken === token) Object.assign(r, clone(patch), { lockedUntil: null, lockToken: null });
    },
    async checkpointRun(id, patch, token) {
      const r = runs.get(id);
      if (r && r.lockToken === token) Object.assign(r, clone(patch));
    },
    async claimEmail(id, now) {
      const r = runs.get(id);
      if (!r || r.emailedAt) return false;
      r.emailedAt = now.toISOString();
      return true;
    },
    async releaseEmail(id) {
      const r = runs.get(id);
      if (r) r.emailedAt = null;
    },
    async addRunPages(runId, pages) {
      for (const p of pages) {
        const key = `${runId}|${p.url}`;
        if (!runPages.has(key)) runPages.set(key, { runId, url: p.url, sourceKind: p.sourceKind, status: "pending" });
      }
    },
    async pendingRunPages(runId, limit) {
      return [...runPages.values()].filter((p) => p.runId === runId && p.status === "pending").slice(0, limit).map(clone);
    },
    async setRunPageStatus(runId, url, status) {
      const p = runPages.get(`${runId}|${url}`);
      if (p) p.status = status;
    },
    async listRunPages(runId) {
      return [...runPages.values()].filter((p) => p.runId === runId).map(clone);
    },

    async geocodeGet(q) {
      return geo.has(q) ? geo.get(q) : undefined;
    },
    async geocodePut(q, r) {
      geo.set(q, r);
    },
  };
}
