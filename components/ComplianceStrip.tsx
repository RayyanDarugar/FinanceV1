import { complianceDeadline } from "@/lib/domain/compliance";
import { formatShortDate } from "@/lib/domain/format";
import type { EventItem, Profile } from "@/lib/types";

export function complianceText(event: EventItem, profile: Profile, now: Date): string | null {
  if (!event.needsPreapproval) return null;
  const rule = profile.complianceRule;
  const d = complianceDeadline(event.startsAt, rule.leadDays, now, profile.timezone);
  const date = formatShortDate(d.submitBy);
  if (d.passed) return `Needs ${rule.label} · Deadline passed ${date}`;
  const left = d.daysLeft === 0 ? "due today" : d.daysLeft === 1 ? "1 day left" : `${d.daysLeft} days left`;
  return `Needs ${rule.label} · submit by ${date} (${left})`;
}

export function ComplianceStrip({ event, profile, now }: { event: EventItem; profile: Profile; now: Date }) {
  const text = complianceText(event, profile, now);
  if (!text) return null;
  return (
    <div className="mt-3 flex gap-2 rounded-lg bg-amber-soft px-3 py-2 text-[15px] text-amber">
      <span aria-hidden>⏱</span>
      <span>{text}</span>
    </div>
  );
}
