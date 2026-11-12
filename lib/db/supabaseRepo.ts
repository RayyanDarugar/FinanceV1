import type { SupabaseClient } from "@supabase/supabase-js";
import type { Organization, Profile } from "@/lib/types";
import { nameKey, USER_EVENT_FIELDS, USER_ORG_FIELDS, type Repo, type StoredEvent } from "./repo";
import { supabase } from "./supabase";

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

type EventRow = { id: string; dedupe_key: string; data: StoredEvent; raw: Record<string, unknown> };
const fromEventRow = (r: EventRow): StoredEvent => ({ ...r.data, id: r.id, dedupeKey: r.dedupe_key, raw: r.raw ?? {} });

/** Live Repo on Supabase Postgres (schema: supabase/migrations). */
export function createSupabaseRepo(db: SupabaseClient = supabase()): Repo {
  async function eventRow(id: string) {
    const r = check(await db.from("events").select("id, dedupe_key, data, raw").eq("id", id).maybeSingle(), "get event");
    return r as EventRow | null;
  }
  async function patchEventData(id: string, patch: Record<string, unknown>) {
    const row = await eventRow(id);
    if (!row) return;
    check(await db.from("events").update({ data: { ...row.data, ...patch }, updated_at: new Date().toISOString() }).eq("id", id), "update event");
  }
  async function orgRow(id: string) {
    return check(await db.from("organizations").select("id, data").eq("id", id).maybeSingle(), "get org") as
      | { id: string; data: Organization }
      | null;
  }
  async function patchOrgData(id: string, patch: Partial<Organization>) {
    const row = await orgRow(id);
    if (!row) return;
    check(await db.from("organizations").update({ data: { ...row.data, ...patch }, updated_at: new Date().toISOString() }).eq("id", id), "update org");
  }

  return {
    async putProfile(p, hash) {
      check(await db.from("profiles").upsert({ id: p.id, data: p, passcode_hash: hash }), "put profile");
    },
    async getProfile(id) {
      const r = check(await db.from("profiles").select("data").eq("id", id).maybeSingle(), "get profile");
      return (r?.data as Profile) ?? null;
    },
    async getPasscodeHash(id) {
      const r = check(await db.from("profiles").select("passcode_hash").eq("id", id).maybeSingle(), "get hash");
      return (r?.passcode_hash as string) ?? null;
    },
    async updateProfile(id, patch) {
      const current = await this.getProfile(id);
      if (!current) return;
      check(await db.from("profiles").update({ data: { ...current, ...patch }, updated_at: new Date().toISOString() }).eq("id", id), "update profile");
    },

    async listEvents(profileId) {
      const rows = check(await db.from("events").select("id, dedupe_key, data, raw").eq("profile_id", profileId), "list events");
      return (rows as EventRow[]).map(fromEventRow);
    },
    async getEvent(id) {
      const r = await eventRow(id);
      return r ? fromEventRow(r) : null;
    },
    async upsertEvents(profileId, runId, list) {
      if (!list.length) return;
      const keys = list.map((e) => e.dedupeKey);
      const existing = check(
        await db.from("events").select("id, dedupe_key, data").eq("profile_id", profileId).in("dedupe_key", keys),
        "find existing events",
      ) as { id: string; dedupe_key: string; data: StoredEvent }[];
      const byKey = new Map(existing.map((r) => [r.dedupe_key, r]));
      const rows = list.map((incoming) => {
        const prev = byKey.get(incoming.dedupeKey);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { dedupeKey, raw, ...data } = incoming;
        const keep = prev ? Object.fromEntries(USER_EVENT_FIELDS.map((k) => [k, prev.data[k]])) : {};
        const id = prev?.id ?? incoming.id;
        return {
          id,
          profile_id: profileId,
          dedupe_key: dedupeKey,
          starts_at: incoming.startsAt,
          data: { ...data, ...keep, id },
          raw,
          last_seen_run: runId,
          ...(prev ? {} : { first_seen_run: runId }),
          updated_at: new Date().toISOString(),
        };
      });
      check(await db.from("events").upsert(rows, { onConflict: "id" }), "upsert events");
    },
    async updateEvent(id, patch) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { dedupeKey, raw, ...data } = patch;
      await patchEventData(id, data);
      if (raw) check(await db.from("events").update({ raw }).eq("id", id), "update raw");
    },
    async setMark(id, mark, reason) {
      await patchEventData(id, { mark, hideReason: mark === "hidden" ? reason : null });
    },
    async recordOutcome(id, outcome, note) {
      await patchEventData(id, { outcome, outcomeNote: note });
    },

    async listOrgs(profileId) {
      const rows = check(await db.from("organizations").select("id, data").eq("profile_id", profileId), "list orgs");
      return (rows as { id: string; data: Organization }[]).map((r) => ({ ...r.data, id: r.id }));
    },
    async getOrg(id) {
      const r = await orgRow(id);
      return r ? { ...r.data, id: r.id } : null;
    },
    async upsertOrgs(profileId, list) {
      if (!list.length) return;
      const keys = list.map((o) => nameKey(o.name));
      const existing = check(
        await db.from("organizations").select("id, name_key, data").eq("profile_id", profileId).in("name_key", keys),
        "find existing orgs",
      ) as { id: string; name_key: string; data: Organization }[];
      const byKey = new Map(existing.map((r) => [r.name_key, r]));
      const rows = list.map((incoming) => {
        const key = nameKey(incoming.name);
        const prev = byKey.get(key);
        const keep = prev ? Object.fromEntries(USER_ORG_FIELDS.map((k) => [k, prev.data[k]])) : {};
        const id = prev?.id ?? incoming.id;
        return {
          id,
          profile_id: profileId,
          name_key: key,
          data: { ...incoming, ...keep, id, name: prev?.data.name ?? incoming.name },
          updated_at: new Date().toISOString(),
        };
      });
      check(await db.from("organizations").upsert(rows, { onConflict: "id" }), "upsert orgs");
    },
    async setOrgStatus(id, status, now) {
      const r = await orgRow(id);
      if (!r) return;
      await patchOrgData(id, { status, followedAt: status === "following" && !r.data.followedAt ? now.toISOString() : r.data.followedAt });
    },
    async markContacted(id, now) {
      await patchOrgData(id, { lastContactedAt: now.toISOString() });
    },

    async saveProposal(profileId, proposal, patches) {
      check(await db.from("settings_changes").insert({ id: proposal.id, profile_id: profileId, proposal, patches }), "save proposal");
    },
    async takeProposal(profileId, id) {
      const rows = check(
        await db
          .from("settings_changes")
          .update({ status: "applied", applied_at: new Date().toISOString() })
          .eq("id", id)
          .eq("profile_id", profileId)
          .eq("status", "proposed")
          .select("proposal, patches"),
        "take proposal",
      ) as { proposal: never; patches: never }[];
      return rows[0] ? { proposal: rows[0].proposal, patches: rows[0].patches } : null;
    },

    async geocodeGet(q) {
      const r = check(await db.from("geocode_cache").select("lat, lng, found").eq("query", q).maybeSingle(), "geocode get");
      if (!r) return undefined;
      return r.found ? { lat: r.lat as number, lng: r.lng as number } : null;
    },
    async geocodePut(q, result) {
      check(
        await db.from("geocode_cache").upsert({ query: q, lat: result?.lat ?? null, lng: result?.lng ?? null, found: result !== null }),
        "geocode put",
      );
    },
  };
}
