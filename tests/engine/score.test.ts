import { summarizeFeedback } from "@/lib/engine/feedback";
import { scoreEvents } from "@/lib/engine/score";
import { newUsage } from "@/lib/engine/usage";
import { makeEvent, makeOrg, makeProfile } from "../helpers/make";

const p = makeProfile();

function llmReturning(scores: Record<string, unknown>[]) {
  return vi.fn(async () => ({ scores }));
}

const good = (id: string, o: Record<string, unknown> = {}) => ({
  id, audienceFit: 8, wealth: 7, speaking: "none", suggestedMode: "attend", nextStep: "Register.",
  whyGo: "Women owners 50+.", whyFits: "Matches women business owners.", needsPreapproval: false, ...o,
});

test("an LLM 'asked' without the page asking is downgraded to could_offer", async () => {
  const e = { ...makeEvent({ id: "a" }), speakingAsked: false };
  const out = await scoreEvents([e], p, "", newUsage(), { callJson: llmReturning([good("a", { speaking: "asked", suggestedMode: "speak" })]) as never });
  expect(out.get("a")?.speaking).toBe("could_offer");
});

test("'asked' stands when the page asked", async () => {
  const e = { ...makeEvent({ id: "a" }), speakingAsked: true };
  const out = await scoreEvents([e], p, "", newUsage(), { callJson: llmReturning([good("a", { speaking: "asked", suggestedMode: "speak" })]) as never });
  expect(out.get("a")?.speaking).toBe("asked");
});

test("speak/table/sponsor modes force needsPreapproval", async () => {
  const e = { ...makeEvent({ id: "a" }), speakingAsked: false };
  const out = await scoreEvents([e], p, "", newUsage(), { callJson: llmReturning([good("a", { suggestedMode: "speak", needsPreapproval: false })]) as never });
  expect(out.get("a")?.needsPreapproval).toBe(true);
});

test("an event missing from the response is absent from the map (left unscored)", async () => {
  const events = [{ ...makeEvent({ id: "a" }), speakingAsked: false }, { ...makeEvent({ id: "b" }), speakingAsked: false }];
  const out = await scoreEvents(events, p, "", newUsage(), { callJson: llmReturning([good("a")]) as never });
  expect(out.has("a")).toBe(true);
  expect(out.has("b")).toBe(false);
});

test("sub-scores are clamped to 0..10 and a null LLM result scores nothing", async () => {
  const e = { ...makeEvent({ id: "a" }), speakingAsked: false };
  const out = await scoreEvents([e], p, "", newUsage(), { callJson: llmReturning([good("a", { audienceFit: 14, wealth: -2 })]) as never });
  expect(out.get("a")).toMatchObject({ audienceFit: 10, wealth: 0 });
  const none = await scoreEvents([e], p, "", newUsage(), { callJson: (async () => null) as never });
  expect(none.size).toBe(0);
});

test("batches of at most 8 events per LLM call", async () => {
  const events = Array.from({ length: 17 }, (_, i) => ({ ...makeEvent({ id: `e${i}` }), speakingAsked: false }));
  const callJson = vi.fn(async () => ({ scores: [] }));
  await scoreEvents(events, p, "", newUsage(), { callJson: callJson as never });
  expect(callJson).toHaveBeenCalledTimes(3);
});

test("the prompt includes her ideal client, priorities and feedback", async () => {
  const callJson = vi.fn(async () => ({ scores: [] }));
  await scoreEvents([{ ...makeEvent(), speakingAsked: false }], p, "Hidden for 'too far' 3×", newUsage(), { callJson: callJson as never });
  const { system, user } = (callJson.mock.calls[0] as unknown as [{ system: string; user: string }])[0];
  expect(system + user).toContain(p.idealClient);
  expect(system + user).toContain(p.priorities);
  expect(user).toContain("Hidden for 'too far' 3×");
});

test("summarizeFeedback counts hide reasons with examples and lists not-interested orgs", () => {
  const hidden = [
    makeEvent({ mark: "hidden", hideReason: "too_far", title: "A", distanceMiles: 25 }),
    makeEvent({ mark: "hidden", hideReason: "too_far", title: "B", distanceMiles: 28 }),
    makeEvent({ mark: "hidden", hideReason: "wrong_crowd", title: "Tech Meetup" }),
    makeEvent({ mark: "hidden", hideReason: null, title: "C" }),
  ];
  const s = summarizeFeedback(hidden, [makeOrg({ name: "Young Professionals Club", status: "not_interested" })]);
  expect(s).toContain("too far");
  expect(s).toMatch(/2×/);
  expect(s).toContain("Tech Meetup");
  expect(s).toContain("Young Professionals Club");
  expect(summarizeFeedback([], [])).toBe("");
});
