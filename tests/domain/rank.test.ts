import { computeScore, isEligible, rankEvents } from "@/lib/domain/rank";
import { makeEvent, makeProfile, NOW } from "../helpers/make";

const p = makeProfile();

test("asked speaking outranks better-audience attend-only event", () => {
  const speak = makeEvent({ speaking: "asked", subScores: { audienceFit: 6, wealth: 6 } });
  const attend = makeEvent({ speaking: null, subScores: { audienceFit: 9, wealth: 9 } });
  expect(computeScore(speak, p)).toBeGreaterThan(computeScore(attend, p));
});

test("could_offer gets a smaller boost than asked", () => {
  const base = { subScores: { audienceFit: 3, wealth: 3 } };
  const asked = computeScore(makeEvent({ ...base, speaking: "asked" }), p);
  const offer = computeScore(makeEvent({ ...base, speaking: "could_offer" }), p);
  const none = computeScore(makeEvent({ ...base, speaking: null }), p);
  expect(asked - none).toBeCloseTo(25, 0);
  expect(offer - none).toBeCloseTo(10, 0);
});

test("score is clamped to 0..100", () => {
  const e = makeEvent({ speaking: "asked", subScores: { audienceFit: 10, wealth: 10 }, distanceMiles: 0, costUsd: 0 });
  expect(computeScore(e, p)).toBe(100);
});

test("hidden, past, >56 days, over-ceiling and excluded events are dropped", () => {
  expect(isEligible(makeEvent({ mark: "hidden" }), p, NOW)).toBe(false);
  expect(isEligible(makeEvent({ startsAt: "2026-11-17T18:00:00-08:00" }), p, NOW)).toBe(false);
  expect(isEligible(makeEvent({ startsAt: "2027-01-20T18:00:00-08:00" }), p, NOW)).toBe(false);
  expect(isEligible(makeEvent({ costUsd: 2500 }), p, NOW)).toBe(false);
  expect(isEligible(makeEvent({ title: "CAIS Alternative Investment Summit" }), p, NOW)).toBe(false);
  expect(isEligible(makeEvent({ distanceMiles: 45 }), p, NOW)).toBe(false);
  expect(isEligible(makeEvent(), p, NOW)).toBe(true);
});

test("event with unknown cost is eligible", () => {
  expect(isEligible(makeEvent({ costUsd: null }), p, NOW)).toBe(true);
});

test("null distance kept only if townText is in areaTowns", () => {
  expect(isEligible(makeEvent({ distanceMiles: null, townText: "encinitas" }), p, NOW)).toBe(true);
  expect(isEligible(makeEvent({ distanceMiles: null, townText: "Los Angeles" }), p, NOW)).toBe(false);
  expect(isEligible(makeEvent({ distanceMiles: null, townText: null }), p, NOW)).toBe(false);
});

test("rankEvents sorts by computed score and caps at max", () => {
  const events = Array.from({ length: 14 }, (_, i) => makeEvent({ subScores: { audienceFit: i % 10, wealth: 5 } }));
  const ranked = rankEvents(events, p, NOW);
  expect(ranked).toHaveLength(10);
  for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
});

test("low-confidence events only fill up to min 5, at the bottom", () => {
  const good = [1, 2, 3].map(() => makeEvent({ confidence: 0.9, subScores: { audienceFit: 3, wealth: 3 } }));
  const shaky = [1, 2, 3, 4].map(() => makeEvent({ confidence: 0.3, subScores: { audienceFit: 10, wealth: 10 } }));
  const ranked = rankEvents([...good, ...shaky], p, NOW);
  expect(ranked).toHaveLength(5);
  expect(ranked.slice(0, 3).every((e) => e.confidence === 0.9)).toBe(true);
  expect(ranked.slice(3).every((e) => e.confidence === 0.3)).toBe(true);
});

test("speaking boost is dropped once the pre-approval deadline has passed", () => {
  const sub = { subScores: { audienceFit: 3, wealth: 3 } };
  const late = makeEvent({ ...sub, speaking: "asked", needsPreapproval: true, startsAt: "2026-11-23T18:00:00-08:00" });
  const none = makeEvent({ ...sub, speaking: null, startsAt: "2026-11-23T18:00:00-08:00" });
  const [a, b] = [rankEvents([late], p, NOW)[0], rankEvents([none], p, NOW)[0]];
  expect(a.score).toBe(b.score);
});

test("unscored events (subScores null) are not ranked", () => {
  expect(rankEvents([makeEvent({ subScores: null })], p, NOW)).toHaveLength(0);
});
