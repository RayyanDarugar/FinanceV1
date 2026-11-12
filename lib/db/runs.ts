import type { Usage } from "@/lib/engine/usage";
import type { SourceKind } from "@/lib/types";

export type RunKind = "weekly" | "org_seed";
export type Stage = "collect" | "extract" | "geocode" | "score" | "orgs" | "email" | "done";
export const STAGES: Stage[] = ["collect", "extract", "geocode", "score", "orgs", "email", "done"];

export interface Run {
  id: string;
  profileId: string;
  kind: RunKind;
  weekKey: string;
  stage: Stage;
  cursor: { sources: number; queries: number };
  lockedUntil: string | null;
  /** Set by lockRun; saves from a call whose lock was taken over are ignored. */
  lockToken: string | null;
  emailedAt: string | null;
  usage: Usage;
  error: string | null;
}

export interface RunPage {
  runId: string;
  url: string;
  sourceKind: SourceKind;
  status: "pending" | "extracted" | "failed";
}

/** Run bookkeeping. Part of Repo. */
export interface RunStore {
  getRun(profileId: string, kind: RunKind, weekKey: string): Promise<Run | null>;
  getOrCreateRun(profileId: string, kind: RunKind, weekKey: string, newId: () => string, first: Stage): Promise<Run>;
  /** Atomically takes the run's lock if free (or expired). Null when another call holds it. */
  lockRun(id: string, until: Date, now: Date): Promise<Run | null>;
  /** Saves progress and releases the lock — only if `lockToken` still holds it. */
  saveRun(id: string, patch: Partial<Pick<Run, "stage" | "cursor" | "usage" | "error">>, lockToken: string): Promise<void>;
  /** Saves progress and keeps the lock (after every step, so a killed function loses at most one step). */
  checkpointRun(id: string, patch: Partial<Pick<Run, "stage" | "cursor" | "usage" | "error">>, lockToken: string): Promise<void>;
  /** Atomically sets emailedAt if unset. True when this caller won. */
  claimEmail(id: string, now: Date): Promise<boolean>;
  releaseEmail(id: string): Promise<void>;
  addRunPages(runId: string, pages: { url: string; sourceKind: SourceKind }[]): Promise<void>;
  pendingRunPages(runId: string, limit: number): Promise<RunPage[]>;
  setRunPageStatus(runId: string, url: string, status: RunPage["status"]): Promise<void>;
  listRunPages(runId: string): Promise<RunPage[]>;
}
