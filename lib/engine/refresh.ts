import type { RunStore } from "@/lib/db/runs";
import { localDate } from "@/lib/domain/dates";

/**
 * "Search again now": a mid-week run stored as a weekly run under a per-day key, so it can happen at most once a day.
 * It finds and scores events like the Monday run but sends no email and suggests no organizations.
 */
const SUFFIX = "-refresh";

export function refreshKey(now: Date, tz: string): string {
  return `${localDate(now, tz)}${SUFFIX}`;
}

export const isRefreshKey = (key: string) => key.endsWith(SUFFIX);

/** Today's (or, just after midnight, yesterday's) unfinished refresh run, if any. */
export async function pendingRefreshKey(repo: Pick<RunStore, "getRun">, profileId: string, now: Date, tz: string): Promise<string | null> {
  for (const at of [now, new Date(now.getTime() - 86_400_000)]) {
    const key = refreshKey(at, tz);
    const run = await repo.getRun(profileId, "weekly", key);
    if (run && run.stage !== "done") return key;
  }
  return null;
}
