import { DAY_MS } from "@/lib/domain/dates";
import { WINDOW_DAYS } from "@/lib/domain/rank";
import type { SourceKind } from "@/lib/types";
import type { RawEvent } from "./extract";

const BASE: Record<SourceKind, number> = { organizer: 0.9, trusted_calendar: 0.9, listing: 0.65 };

export type Verdict = { ok: true; confidence: number } | { ok: false; reason: string };

/** Is this extracted event real and current enough to rank? Never spends a search or fetch. */
export function verifyEvent(raw: RawEvent, sourceKind: SourceKind, now: Date, _tz: string): Verdict {
  if (!raw.startsAt) return { ok: false, reason: "no date" };
  const start = Date.parse(raw.startsAt);
  if (Number.isNaN(start)) return { ok: false, reason: "unreadable date" };
  if (start < now.getTime()) return { ok: false, reason: "already happened" };
  if (start > now.getTime() + WINDOW_DAYS * DAY_MS) return { ok: false, reason: "more than 8 weeks out" };
  if (!raw.title.trim()) return { ok: false, reason: "no title" };
  let confidence = BASE[sourceKind];
  if (!raw.yearStated) confidence -= 0.2;
  if (!raw.address && !raw.townText) confidence -= 0.1;
  return { ok: true, confidence: Math.round(confidence * 100) / 100 };
}
