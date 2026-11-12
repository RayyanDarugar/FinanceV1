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

/** Turns her words into a proposed change, or null when it can't. */
export type Proposer = (text: string, profile: Profile, orgs: Organization[]) => Promise<ParsedChange | null>;
