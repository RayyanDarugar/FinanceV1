import type { Deadline } from "@/lib/types";
import { addDays, daysBetween, localDate } from "./dates";

/** Submit-by date = event's local start date minus leadDays, compared in the profile's time zone. */
export function complianceDeadline(startsAt: string, leadDays: number, now: Date, tz: string): Deadline {
  const submitBy = addDays(localDate(new Date(startsAt), tz), -leadDays);
  const diff = daysBetween(localDate(now, tz), submitBy);
  return { submitBy, daysLeft: Math.max(0, diff), passed: diff < 0 };
}
