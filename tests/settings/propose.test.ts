import { createMemoryRepo } from "@/lib/db/memoryRepo";
import { makeLlmProposer } from "@/lib/settings/propose";
import { needsRescore, rescoreUpcoming } from "@/lib/settings/rescore";
import { makeEvent, makeOrg, makeProfile, NOW } from "../helpers/make";

const p = makeProfile();
const orgs = [makeOrg({ id: "dm", name: "Del Mar Rotary", status: "suggested" })];

function proposer(llmOut: unknown) {
  const callJson = vi.fn(async () => llmOut);
  const geocode = vi.fn(async () => ({ lat: 33.04, lng: -117.29 }));
  return { propose: makeLlmProposer({ callJson: callJson as never, geocode, newId: () => "new-org" }), callJson, geocode };
}

test("common requests use the free parser and never call the LLM", async () => {
  const { propose, callJson } = proposer(null);
  const out = await propose("only show things within 20 miles", p, orgs);
  expect(out?.changes[0]).toMatchObject({ field: "radiusMiles", to: "20" });
  expect(callJson).not.toHaveBeenCalled();
});

test("passcode and other non-allowed fields are unsupported", async () => {
  const { propose } = proposer({ changes: [], unsupported: "passcode" });
  expect(await propose("make the passcode 1234", p, orgs)).toBeNull();
});

test("out-of-range values are rejected", async () => {
  const { propose } = proposer({ changes: [{ field: "radiusMiles", value: "500" }], unsupported: null });
  expect(await propose("everything within five hundred miles please", p, orgs)).toBeNull();
});

test("ideal client text changes are proposed with before/after", async () => {
  const { propose } = proposer({ changes: [{ field: "idealClient", value: JSON.stringify("Women 55-80, retirees and widows") }], unsupported: null });
  const out = await propose("focus more on retirees and widows over 55", p, orgs);
  expect(out?.changes[0]).toMatchObject({ field: "idealClient", from: p.idealClient, to: "Women 55-80, retirees and widows" });
  expect(out?.apply).toEqual([{ kind: "profile", patch: { idealClient: "Women 55-80, retirees and widows" } }]);
});

test("exclusions are added to, not replaced", async () => {
  const { propose } = proposer({ changes: [{ field: "addExclusion", value: JSON.stringify("golf tournaments") }], unsupported: null });
  const out = await propose("no more golf tournaments", p, orgs);
  expect(out?.apply).toEqual([{ kind: "profile", patch: { exclusions: [...p.exclusions, "golf tournaments"] } }]);
  expect(out?.changes[0].text).toBe("Never show: golf tournaments");
});

test("weights must sum to 1", async () => {
  const bad = proposer({ changes: [{ field: "weights", value: JSON.stringify({ audienceFit: 0.9, wealth: 0.9, distance: 0, cost: 0 }) }], unsupported: null });
  expect(await bad.propose("care way more about audience", p, orgs)).toBeNull();
});

test("home base is geocoded from a place name", async () => {
  const { propose, geocode } = proposer({ changes: [{ field: "home", value: JSON.stringify("Encinitas") }], unsupported: null });
  const out = await propose("I moved to Encinitas", p, orgs);
  expect(geocode).toHaveBeenCalled();
  expect(out?.apply).toEqual([{ kind: "profile", patch: { home: { label: "Encinitas", lat: 33.04, lng: -117.29 } } }]);
});

test("follow by name for a group we don't know creates it as followed", async () => {
  const { propose } = proposer({ changes: [{ field: "followOrg", value: JSON.stringify("Encinitas Garden Club") }], unsupported: null });
  const out = await propose("please track the encinitas garden club", p, orgs);
  expect(out?.apply[0]).toMatchObject({ kind: "org_create", org: { id: "new-org", name: "Encinitas Garden Club", status: "following", whyHer: "Added by you" } });
});

test("rescore is needed only when the ideal client, priorities or weights changed", () => {
  expect(needsRescore(p, { ...p, radiusMiles: 10 })).toBe(false);
  expect(needsRescore(p, { ...p, idealClient: "x" })).toBe(true);
  expect(needsRescore(p, { ...p, priorities: "x" })).toBe(true);
  expect(needsRescore(p, { ...p, weights: { audienceFit: 0.25, wealth: 0.25, distance: 0.25, cost: 0.25 } })).toBe(true);
});

test("rescoreUpcoming re-scores stored upcoming events and stops at the time budget", async () => {
  const repo = createMemoryRepo();
  await repo.putProfile(p, "h");
  await repo.upsertEvents(p.id, "r", [
    { ...makeEvent({ id: "u1", startsAt: "2026-12-01T18:00:00-08:00" }), dedupeKey: "u1", raw: {} },
    { ...makeEvent({ id: "past", startsAt: "2026-11-01T18:00:00-08:00" }), dedupeKey: "past", raw: {} },
  ]);
  const score = vi.fn(async (events: { id: string }[]) => new Map(events.map((e) => [e.id, {
    audienceFit: 2, wealth: 2, speaking: null, suggestedMode: "attend" as const, nextStep: "n", whyGo: "new why", whyFits: "f", needsPreapproval: false,
  }])));
  const n = await rescoreUpcoming(repo, p.id, NOW, 10_000, { score: score as never });
  expect(n).toBe(1);
  expect(await repo.getEvent("u1")).toMatchObject({ whyGo: "new why", subScores: { audienceFit: 2, wealth: 2 } });
  expect((await repo.getEvent("past"))?.whyGo).not.toBe("new why");
});
