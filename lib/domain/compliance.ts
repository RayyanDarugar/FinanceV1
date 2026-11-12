import type { Deadline, EventItem, Profile } from "@/lib/types";
import { addDays, daysBetween, localDate } from "./dates";
import { formatShortDate } from "./format";

/** Submit-by date = event's local start date minus leadDays, compared in the profile's time zone. */
export function complianceDeadline(startsAt: string, leadDays: number, now: Date, tz: string): Deadline {
  const submitBy = addDays(localDate(new Date(startsAt), tz), -leadDays);
  const diff = daysBetween(localDate(now, tz), submitBy);
  return { submitBy, daysLeft: Math.max(0, diff), passed: diff < 0 };
}

/** "Needs LPL pre-approval · submit by Dec 3 (15 days left)" — null when no pre-approval is needed. */
export function complianceText(event: EventItem, profile: Profile, now: Date): string | null {
  if (!event.needsPreapproval) return null;
  const rule = profile.complianceRule;
  const d = complianceDeadline(event.startsAt, rule.leadDays, now, profile.timezone);
  const date = formatShortDate(d.submitBy);
  if (d.passed) return `Needs ${rule.label} · Deadline passed ${date}`;
  const left = d.daysLeft === 0 ? "due today" : d.daysLeft === 1 ? "1 day left" : `${d.daysLeft} days left`;
  return `Needs ${rule.label} · submit by ${date} (${left})`;
}
