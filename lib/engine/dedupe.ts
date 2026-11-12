import { localDate } from "@/lib/domain/dates";
import type { SourceKind } from "@/lib/types";
import type { RawEvent } from "./extract";

export type Candidate = RawEvent & { sourceUrl: string; sourceKind: SourceKind; confidence: number };

const STOP = new Set(["the", "a", "an", "and", "of", "in", "at", "for", "with", "to", "on", "by", "&", "annual", "event"]);

function tokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t));
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union ? inter / union : 0;
}

const day = (startsAt: string, tz: string) => localDate(new Date(startsAt), tz);
const venue = (v: string | null) => v?.toLowerCase().replace(/[^a-z0-9]/g, "") || null;

/** Pacific date + first 6 sorted title words. Stable across punctuation and word order. */
export function dedupeKey(title: string, startsAt: string, tz: string): string {
  return `${day(startsAt, tz)}|${[...new Set(tokens(title))].sort().slice(0, 6).join(" ")}`;
}

function sameEvent(
  a: { title: string; startsAt: string | null; venueName: string | null },
  b: { title: string; startsAt: string | null; venueName: string | null },
  tz: string,
): boolean {
  if (!a.startsAt || !b.startsAt || day(a.startsAt, tz) !== day(b.startsAt, tz)) return false;
  if (jaccard(tokens(a.title), tokens(b.title)) >= 0.6) return true;
  // Same venue only counts when the start times are close: libraries list many events per room per day.
  const va = venue(a.venueName);
  const close = Math.abs(Date.parse(a.startsAt) - Date.parse(b.startsAt)) <= 30 * 60_000;
  return va !== null && va === venue(b.venueName) && close;
}

/** Merges duplicates within a batch. The highest-confidence source wins; empty fields are filled from the others. */
export function mergeCandidates(items: Candidate[], tz: string): Candidate[] {
  const groups: Candidate[][] = [];
  for (const item of items) {
    const g = groups.find((grp) => grp.some((x) => sameEvent(x, item, tz)));
    if (g) g.push(item);
    else groups.push([item]);
  }
  return groups.map((grp) => {
    const sorted = [...grp].sort((a, b) => b.confidence - a.confidence);
    const merged: Candidate = { ...sorted[0] };
    for (const other of sorted.slice(1)) {
      for (const [k, v] of Object.entries(other) as [keyof Candidate, unknown][]) {
        const cur = merged[k];
        if ((cur === null || cur === "" || cur === undefined) && v !== null && v !== "") (merged as Record<string, unknown>)[k] = v;
      }
      merged.speakingAsked ||= other.speakingAsked;
      merged.modes = [...new Set([...merged.modes, ...other.modes])];
    }
    return merged;
  });
}

/** Across weeks: if a stored event is the same as this candidate, return its dedupe key so the row is updated, not duplicated. */
export function findMatch(
  c: Candidate,
  stored: { title: string; startsAt: string; venueName: string | null; dedupeKey: string }[],
  tz: string,
): string | null {
  return stored.find((s) => sameEvent(s, c, tz))?.dedupeKey ?? null;
}
