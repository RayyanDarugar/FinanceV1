import "server-only";
import { createSupabaseRepo } from "@/lib/db/supabaseRepo";
import type { Repo } from "@/lib/db/repo";
import type { AppData } from "./AppData";
import { createServiceData, type ServiceDeps } from "./service";

let repo: Repo | null = null;

export function serverRepo(): Repo {
  repo ??= createSupabaseRepo();
  return repo;
}

export function profileId(): string {
  const id = process.env.PROFILE_ID;
  if (!id) throw new Error("PROFILE_ID must be set");
  return id;
}

/** The live AppData for the single configured profile. Extra hooks (LLM proposer, rescore) are added in Task 17. */
export function serverData(extra: Partial<ServiceDeps> = {}): AppData {
  return createServiceData({ repo: serverRepo(), profileId: profileId(), now: () => new Date(), ...extra });
}
