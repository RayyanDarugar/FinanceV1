import type { EventItem, Profile } from "@/lib/types";
import { complianceDeadline } from "./compliance";
import { DAY_MS } from "./dates";

export const WINDOW_DAYS = 56;
const SPEAKING_BOOST = { asked: 25, could_offer: 10 } as const;

export function computeScore(
  e: Pick<EventItem, "subScores" | "speaking" | "distanceMiles" | "costUsd">,
  p: Profile,
): number {
  const w = p.weights;
  const aF = e.subScores?.audienceFit ?? 0;
  const wl = e.subScores?.wealth ?? 0;
  const d = e.distanceMiles ?? p.radiusMiles / 2;
  const distanceFactor = 1 - Math.min(d, p.radiusMiles) / p.radiusMiles;
  const costFactor = e.costUsd === null || e.costUsd === 0 ? 1 : Math.max(0, 1 - e.costUsd / p.costCeilingUsd);
  const base = 100 * (w.audienceFit * (aF / 10) + w.wealth * (wl / 10) + w.distance * distanceFactor + w.cost * costFactor);
  const boost = e.speaking ? SPEAKING_BOOST[e.speaking] : 0;
  return Math.round(Math.min(100, Math.max(0, base + boost)));
}

export function isEligible(e: EventItem, p: Profile, now: Date): boolean {
  if (e.mark === "hidden") return false;
  const start = Date.parse(e.startsAt);
  if (start < now.getTime() || start > now.getTime() + WINDOW_DAYS * DAY_MS) return false;
  if (e.costUsd !== null && e.costUsd > p.costCeilingUsd) return false;
  if (e.distanceMiles !== null) {
    if (e.distanceMiles > p.radiusMiles) return false;
  } else {
    const town = e.townText?.trim().toLowerCase();
    if (!town || !p.areaTowns.some((t) => t.toLowerCase() === town)) return false;
  }
  const hay = `${e.title} ${e.host}`.toLowerCase();
  if (p.exclusions.some((x) => x.trim() && hay.includes(x.trim().toLowerCase()))) return false;
  return true;
}

export function rankEvents(
  events: EventItem[],
  p: Profile,
  now: Date,
  opts: { max?: number; min?: number; minConfidence?: number; perHost?: number } = {},
): EventItem[] {
  const { max = 10, min = 5, minConfidence = 0.5, perHost = 2 } = opts;
  const perHostCount = new Map<string, number>();
  const sorted = events
    .filter((e) => e.subScores !== null && isEligible(e, p, now))
    .map((e) => {
      // Too late to get approval to speak: score it as an attend-only event.
      const late =
        e.needsPreapproval && complianceDeadline(e.startsAt, p.complianceRule.leadDays, now, p.timezone).passed;
      return { ...e, score: computeScore(late ? { ...e, speaking: null } : e, p) };
    })
    .sort((a, b) => b.score - a.score);
  // Variety: at most `perHost` picks per organizer (events she saved or is going to are always kept).
  const scored = sorted.filter((e) => {
    if (e.mark === "saved" || e.mark === "going") return true;
    const key = e.host.trim().toLowerCase();
    const n = perHostCount.get(key) ?? 0;
    perHostCount.set(key, n + 1);
    return n < perHost;
  });
  const confident = scored.filter((e) => e.confidence >= minConfidence).slice(0, max);
  if (confident.length >= min) return confident;
  const fill = scored.filter((e) => e.confidence < minConfidence).slice(0, min - confident.length);
  return [...confident, ...fill];
}
