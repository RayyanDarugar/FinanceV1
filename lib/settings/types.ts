import type { SettingsChange } from "@/lib/data/AppData";
import type { Organization, Profile } from "@/lib/types";

export type SettingsPatch =
  | { kind: "profile"; patch: Partial<Profile> }
  | { kind: "org_status"; orgId: string; status: Organization["status"] }
  | { kind: "org_create"; org: Organization };

export interface ParsedChange {
  changes: SettingsChange[];
  apply: SettingsPatch[];
}

/** A request that needs no change (e.g. it is already set), with a short explanation for her. */
export interface ProposerMessage {
  message: string;
}

/** Turns her words into a proposed change, a message when nothing needs changing, or null when it can't. */
export type Proposer = (text: string, profile: Profile, orgs: Organization[]) => Promise<ParsedChange | ProposerMessage | null>;
