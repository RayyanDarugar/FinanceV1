import { dedupeKey, findMatch, mergeCandidates, type Candidate } from "@/lib/engine/dedupe";
import type { RawEvent } from "@/lib/engine/extract";

const TZ = "America/Los_Angeles";

function cand(o: Partial<Candidate> = {}): Candidate {
  const base: RawEvent = {
    title: "Event", host: "Host", startsAt: "2026-12-10T18:30:00-08:00", endsAt: null, yearStated: true,
    venueName: null, address: null, townText: "Carlsbad", costUsd: null, registerUrl: null, contactRole: null,
    contactName: null, contactEmail: null, contactPhone: null, description: "", speakingAsked: false, modes: ["attend"],
  };
  return { ...base, sourceUrl: "https://a.org", sourceKind: "listing", confidence: 0.65, ...o };
}

test("same event with reworded titles on the same day merges into one", () => {
  const out = mergeCandidates(
    [cand({ title: "Money After 50 Panel – Women in Business" }), cand({ title: "Women in Business: Money After 50" })],
    TZ,
  );
  expect(out).toHaveLength(1);
});

test("same title on different days stays two events", () => {
  const out = mergeCandidates(
    [cand({ title: "Monthly Mixer" }), cand({ title: "Monthly Mixer", startsAt: "2026-12-17T18:30:00-08:00" })],
    TZ,
  );
  expect(out).toHaveLength(2);
});

test("different titles at the same venue on the same day merge", () => {
  const out = mergeCandidates(
    [cand({ title: "Holiday Gala", venueName: "The Inn at Rancho Santa Fe" }), cand({ title: "Annual Winter Benefit", venueName: "the inn at rancho santa fe" })],
    TZ,
  );
  expect(out).toHaveLength(1);
});

test("listing + organizer page: organizer URL kept, confidence raised, gaps filled", () => {
  const out = mergeCandidates(
    [
      cand({ title: "Holiday Gala", sourceUrl: "https://listing.com/x", sourceKind: "listing", confidence: 0.65, costUsd: 150 }),
      cand({ title: "Holiday Gala", sourceUrl: "https://found.org/gala", sourceKind: "organizer", confidence: 0.9, costUsd: null, speakingAsked: true }),
    ],
    TZ,
  );
  expect(out).toHaveLength(1);
  expect(out[0]).toMatchObject({ sourceUrl: "https://found.org/gala", sourceKind: "organizer", confidence: 0.9, costUsd: 150, speakingAsked: true });
});

test("dedupeKey uses the Pacific date, so an 11:30 pm event keys to its own day", () => {
  const k = dedupeKey("Late Night Gala", "2026-12-10T23:30:00-08:00", TZ);
  expect(k.startsWith("2026-12-10|")).toBe(true);
  expect(dedupeKey("Gala, Late Night!", "2026-12-10T23:30:00-08:00", TZ)).toBe(k);
});

test("findMatch reuses a stored event's key across weeks despite a reworded title", () => {
  const stored = [{ title: "Women in Business: Money After 50", startsAt: "2026-12-10T18:30:00-08:00", venueName: null, dedupeKey: "k-old" }];
  expect(findMatch(cand({ title: "Money After 50 Panel - Women in Business" }), stored, TZ)).toBe("k-old");
  expect(findMatch(cand({ title: "Something Else Entirely" }), stored, TZ)).toBeNull();
});

test("I2: different events at the same venue at different times stay separate", () => {
  const out = mergeCandidates(
    [
      cand({ title: "Toddler Storytime", venueName: "Encinitas Library", startsAt: "2026-12-10T10:00:00-08:00" }),
      cand({ title: "Medicare Basics", venueName: "Encinitas Library", startsAt: "2026-12-10T14:00:00-08:00" }),
    ],
    TZ,
  );
  expect(out).toHaveLength(2);
});
