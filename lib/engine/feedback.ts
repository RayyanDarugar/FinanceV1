import type { EventItem, HideReason, Organization } from "@/lib/types";

const LABEL: Record<HideReason, string> = {
  too_far: "too far",
  wrong_crowd: "wrong crowd",
  too_expensive: "too expensive",
  bad_timing: "bad timing",
  not_my_kind: "not my kind of event",
};

/** Plain-English summary of what she's turned down, fed into the scoring prompt. Empty when there's nothing yet. */
export function summarizeFeedback(hidden: EventItem[], notInterested: Organization[]): string {
  const lines: string[] = [];
  const byReason = new Map<string, EventItem[]>();
  for (const e of hidden) {
    const key = e.hideReason ? LABEL[e.hideReason] : "no reason given";
    byReason.set(key, [...(byReason.get(key) ?? []), e]);
  }
  for (const [reason, events] of [...byReason].sort((a, b) => b[1].length - a[1].length)) {
    const examples = events
      .slice(-4)
      .map((e) => `"${e.title}"${e.distanceMiles !== null ? ` (${Math.round(e.distanceMiles)} mi)` : ""}${e.costUsd ? ` ($${e.costUsd})` : ""}`)
      .join(", ");
    lines.push(`- Hid ${events.length}× for "${reason}": ${examples}`);
  }
  if (notInterested.length) lines.push(`- Not interested in groups: ${notInterested.slice(-8).map((o) => o.name).join(", ")}`);
  return lines.join("\n");
}
