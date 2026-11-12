import { complianceText } from "@/lib/domain/compliance";
import type { EventItem, Profile } from "@/lib/types";

export { complianceText };

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
