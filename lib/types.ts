export type Mode = "attend" | "speak" | "table" | "sponsor";
export type SpeakingSignal = "asked" | "could_offer" | null;
export type EventMark = "saved" | "going" | "hidden" | null;
export type HideReason = "too_far" | "wrong_crowd" | "too_expensive" | "bad_timing" | "not_my_kind";
export type SourceKind = "organizer" | "trusted_calendar" | "listing";
export type Outcome = 0 | 1 | 2 | 3;

export interface Contact {
  role?: string;
  name?: string;
  email?: string;
  phone?: string;
  url?: string;
}

export interface EventItem {
  id: string;
  title: string;
  host: string;
  orgId: string | null;
  startsAt: string; // ISO with offset
  endsAt: string | null;
  venueName: string | null;
  address: string | null;
  townText: string | null;
  lat: number | null;
  lng: number | null;
  distanceMiles: number | null;
  costUsd: number | null; // null = unknown
  sourceUrl: string;
  sourceKind: SourceKind;
  registerUrl: string | null;
  contact: Contact | null;
  description: string;
  speaking: SpeakingSignal;
  suggestedMode: Mode;
  nextStep: string;
  whyGo: string;
  whyFits: string;
  needsPreapproval: boolean;
  confidence: number; // 0..1
  subScores: { audienceFit: number; wealth: number } | null; // 0..10 from LLM
  score: number; // 0..100, computed
  checkedAt: string;
  mark: EventMark;
  hideReason: HideReason | null;
  outcome: Outcome | null;
  outcomeNote: string | null;
}

export type OrgStatus = "suggested" | "following" | "not_interested";

export interface Organization {
  id: string;
  name: string;
  website: string | null;
  townText: string | null;
  lat: number | null;
  lng: number | null;
  contact: Contact | null;
  whyHer: string;
  status: OrgStatus;
  followedAt: string | null;
  lastContactedAt: string | null;
  suggestedAt: string;
}

export interface ComplianceRule {
  label: string;
  leadDays: number;
  appliesTo: Mode[];
}

export interface Profile {
  id: string;
  displayName: string;
  home: { label: string; lat: number; lng: number };
  radiusMiles: number;
  areaTowns: string[];
  idealClient: string;
  priorities: string;
  weights: { audienceFit: number; wealth: number; distance: number; cost: number }; // sum = 1
  exclusions: string[];
  costCeilingUsd: number;
  complianceRule: ComplianceRule;
  trustedSources: { name: string; url: string }[];
  emailTo: string[];
  emailCc: string[];
  timezone: string;
}

export interface Deadline {
  submitBy: string; // YYYY-MM-DD
  daysLeft: number;
  passed: boolean;
}
