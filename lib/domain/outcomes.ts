import type { EventItem } from "@/lib/types";
import { DAY_MS } from "./dates";

const OUTCOME_WINDOW_DAYS = 14;

/** "Going" events that already happened (within 14 days) and have no "how did it go" answer yet. */
export function pendingOutcomes(events: EventItem[], now: Date): EventItem[] {
  const t = now.getTime();
  return events.filter((e) => {
    const s = Date.parse(e.startsAt);
    return e.mark === "going" && e.outcome === null && s < t && s >= t - OUTCOME_WINDOW_DAYS * DAY_MS;
  });
}
