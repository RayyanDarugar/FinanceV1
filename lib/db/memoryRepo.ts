import type { SettingsProposal } from "@/lib/data/AppData";
import type { SettingsPatch } from "@/lib/settings/types";
import type { Organization, Profile } from "@/lib/types";
import { nameKey, USER_EVENT_FIELDS, USER_ORG_FIELDS, type Repo, type StoredEvent } from "./repo";

/** In-memory Repo for tests and local scripts. Same semantics as supabaseRepo. */
export function createMemoryRepo(): Repo & { _events: Map<string, StoredEvent & { profileId: string }> } {
  const profiles = new Map<string, { profile: Profile; hash: string }>();
  const events = new Map<string, StoredEvent & { profileId: string }>();
  const orgs = new Map<string, Organization & { profileId: string }>();
  const proposals = new Map<string, { profileId: string; proposal: SettingsProposal; patches: SettingsPatch[]; applied: boolean }>();
  const geo = new Map<string, { lat: number; lng: number } | null>();
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
      for (const incoming of list) {
        const existing = [...events.values()].find((e) => e.profileId === profileId && e.dedupeKey === incoming.dedupeKey);
        if (existing) {
          const keep = Object.fromEntries(USER_EVENT_FIELDS.map((k) => [k, existing[k]]));
          events.set(existing.id, { ...clone(incoming), ...keep, id: existing.id, profileId });
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

    async geocodeGet(q) {
      return geo.has(q) ? geo.get(q) : undefined;
    },
    async geocodePut(q, r) {
      geo.set(q, r);
    },
  };
}
