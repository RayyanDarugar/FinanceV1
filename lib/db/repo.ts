import type { SettingsProposal } from "@/lib/data/AppData";
import type { SettingsPatch } from "@/lib/settings/types";
import type { RunStore } from "./runs";
import type { EventItem, EventMark, HideReason, Organization, OrgStatus, Outcome, Profile } from "@/lib/types";

/** An event as stored: the display fields plus the dedupe key and the raw extraction. */
export type StoredEvent = EventItem & { dedupeKey: string; raw: Record<string, unknown> };

/** Fields a re-found event never overwrites (they're hers). */
export const USER_EVENT_FIELDS = ["mark", "hideReason", "outcome", "outcomeNote"] as const;
/** Fields worked out by geocoding/scoring. Kept on a re-find unless the event's content changed. */
export const DERIVED_EVENT_FIELDS = [
  "lat", "lng", "distanceMiles", "subScores", "score", "speaking", "suggestedMode", "nextStep", "whyGo", "whyFits", "needsPreapproval",
] as const;

const contentOf = (e: Pick<StoredEvent, "title" | "startsAt" | "description" | "venueName" | "address">) =>
  JSON.stringify([e.title, e.startsAt, e.description, e.venueName, e.address]);

/** What a re-found event keeps from the stored row: always her fields; derived fields only if content is unchanged. */
export function keptOnRefind(prev: StoredEvent, incoming: StoredEvent): Partial<StoredEvent> {
  const keep: Record<string, unknown> = Object.fromEntries(USER_EVENT_FIELDS.map((k) => [k, prev[k]]));
  if (contentOf(prev) === contentOf(incoming)) {
    for (const k of DERIVED_EVENT_FIELDS) keep[k] = prev[k];
    for (const k of ["prescreen"]) if (k in prev.raw) incoming.raw = { ...incoming.raw, [k]: prev.raw[k] };
  }
  return keep as Partial<StoredEvent>;
}

export function assertUniqueKeys(list: { dedupeKey: string }[]) {
  const seen = new Set<string>();
  for (const e of list) {
    if (seen.has(e.dedupeKey)) throw new Error(`duplicate dedupe key in one batch: ${e.dedupeKey}`);
    seen.add(e.dedupeKey);
  }
}

/** Fields a re-suggested org never overwrites. */
export const USER_ORG_FIELDS = ["status", "followedAt", "lastContactedAt"] as const;

/** Server-only storage. Implemented by memoryRepo (tests) and supabaseRepo (live). */
export interface Repo extends RunStore {
  putProfile(p: Profile, passcodeHash: string): Promise<void>;
  getProfile(id: string): Promise<Profile | null>;
  getPasscodeHash(id: string): Promise<string | null>;
  updateProfile(id: string, patch: Partial<Profile>): Promise<void>;

  listEvents(profileId: string): Promise<StoredEvent[]>;
  getEvent(id: string): Promise<StoredEvent | null>;
  /** Inserts new events; for an existing (profileId, dedupeKey) keeps its id and her fields, updates the rest. */
  upsertEvents(profileId: string, runId: string, events: StoredEvent[]): Promise<void>;
  updateEvent(id: string, patch: Partial<StoredEvent>): Promise<void>;
  setMark(id: string, mark: EventMark, reason: HideReason | null): Promise<void>;
  recordOutcome(id: string, outcome: Outcome, note: string | null): Promise<void>;

  listOrgs(profileId: string): Promise<Organization[]>;
  getOrg(id: string): Promise<Organization | null>;
  /** Unique by case-insensitive name; an existing org keeps its id, status and contact dates. */
  upsertOrgs(profileId: string, orgs: Organization[]): Promise<void>;
  setOrgStatus(id: string, status: OrgStatus, now: Date): Promise<void>;
  markContacted(id: string, now: Date): Promise<void>;

  saveProposal(profileId: string, proposal: SettingsProposal, patches: SettingsPatch[]): Promise<void>;
  /** Atomically marks a proposal applied and returns it; null if unknown or already applied. */
  takeProposal(profileId: string, id: string): Promise<{ proposal: SettingsProposal; patches: SettingsPatch[] } | null>;

  geocodeGet(query: string): Promise<{ lat: number; lng: number } | null | undefined>; // undefined = not cached
  geocodePut(query: string, result: { lat: number; lng: number } | null): Promise<void>;
}

export const nameKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export function stripStored(e: StoredEvent): EventItem {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { dedupeKey, raw, ...item } = e;
  return item;
}
