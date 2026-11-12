import type { SettingsProposal } from "@/lib/data/AppData";
import type { SettingsPatch } from "@/lib/settings/types";
import type { RunStore } from "./runs";
import type { EventItem, EventMark, HideReason, Organization, OrgStatus, Outcome, Profile } from "@/lib/types";

/** An event as stored: the display fields plus the dedupe key and the raw extraction. */
export type StoredEvent = EventItem & { dedupeKey: string; raw: Record<string, unknown> };

/** Fields a re-found event never overwrites (they're hers). */
export const USER_EVENT_FIELDS = ["mark", "hideReason", "outcome", "outcomeNote"] as const;
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
