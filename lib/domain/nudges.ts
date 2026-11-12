import type { EventItem, Organization } from "@/lib/types";
import { DAY_MS } from "./dates";
import { formatShortInstant } from "./format";
import { WINDOW_DAYS } from "./rank";

export type Nudge = { kind: "hosting"; eventId: string; text: string } | { kind: "not_contacted"; text: string };

const FOLLOW_GRACE_DAYS = 14;
const CONTACT_PAUSE_DAYS = 60;

export function orgNudges(
  org: Organization,
  upcoming: EventItem[],
  now: Date,
  tz = "America/Los_Angeles",
): Nudge[] {
  if (org.status !== "following") return [];
  const out: Nudge[] = [];
  const t = now.getTime();
  const hosted = upcoming
    .filter((e) => e.orgId === org.id && e.mark !== "hidden")
    .filter((e) => {
      const s = Date.parse(e.startsAt);
      return s >= t && s <= t + WINDOW_DAYS * DAY_MS;
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  if (hosted[0]) {
    const e = hosted[0];
    out.push({
      kind: "hosting",
      eventId: e.id,
      text: `Hosting ${e.title} ${formatShortInstant(e.startsAt, tz)}. Good time to reach out.`,
    });
  }
  const followedLongEnough = org.followedAt !== null && t - Date.parse(org.followedAt) >= FOLLOW_GRACE_DAYS * DAY_MS;
  if (followedLongEnough) {
    if (org.lastContactedAt === null) {
      out.push({ kind: "not_contacted", text: "You haven't contacted them yet." });
    } else if (t - Date.parse(org.lastContactedAt) > CONTACT_PAUSE_DAYS * DAY_MS) {
      out.push({ kind: "not_contacted", text: "It's been a while since you reached out." });
    }
  }
  return out;
}
