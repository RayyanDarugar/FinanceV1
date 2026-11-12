import type { Nudge } from "@/lib/domain/nudges";
import type { EventItem, EventMark, HideReason, Organization, OrgStatus, Outcome, Profile } from "@/lib/types";

export interface SettingsChange {
  field: string;
  from: string;
  to: string;
  text: string;
}

export interface SettingsProposal {
  id: string;
  changes: SettingsChange[];
  unsupported: string | null;
}

export type OrgWithNudges = Organization & { nudges: Nudge[] };

/** Every screen reads and writes through this. Fake (prototype) and live (Supabase) implement it. */
export interface AppData {
  getProfile(): Promise<Profile>;
  listEvents(): Promise<EventItem[]>; // already ranked for display
  listGoing(): Promise<EventItem[]>;
  getEvent(id: string): Promise<EventItem | null>;
  setMark(id: string, mark: EventMark, reason?: HideReason | null): Promise<void>;
  recordOutcome(id: string, outcome: Outcome, note?: string): Promise<void>;
  listOrgs(): Promise<{ following: OrgWithNudges[]; suggested: Organization[] }>;
  getOrg(id: string): Promise<{ org: Organization; events: EventItem[] } | null>;
  setOrgStatus(id: string, status: OrgStatus): Promise<void>;
  markContacted(id: string): Promise<void>;
  proposeSettingsChange(text: string): Promise<SettingsProposal>;
  confirmSettingsChange(proposalId: string): Promise<void>;
}

export const UNSUPPORTED_CHANGE = "I can't change that from here. Text Rayyan.";
