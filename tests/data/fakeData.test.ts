import { createFakeData } from "@/lib/data/fakeData";
import { pendingOutcomes } from "@/lib/domain/outcomes";
import { NOW } from "../helpers/make";

const now = () => NOW;

beforeEach(() => localStorage.clear());

test("hiding an event removes it from listEvents and stores the reason", async () => {
  const data = createFakeData(localStorage, now);
  const [first] = await data.listEvents();
  await data.setMark(first.id, "hidden", "too_far");
  expect((await data.listEvents()).some((e) => e.id === first.id)).toBe(false);
  expect((await data.getEvent(first.id))?.hideReason).toBe("too_far");
});

test("recordOutcome removes the event from pending", async () => {
  const data = createFakeData(localStorage, now);
  const pending = pendingOutcomes(await data.listGoing(), NOW);
  expect(pending.length).toBeGreaterThan(0);
  await data.recordOutcome(pending[0].id, 2);
  expect(pendingOutcomes(await data.listGoing(), NOW).some((e) => e.id === pending[0].id)).toBe(false);
});

test("radius change is proposed in plain words and changes the list once confirmed", async () => {
  const data = createFakeData(localStorage, now);
  const before = await data.listEvents();
  expect(before.some((e) => (e.distanceMiles ?? 0) > 20)).toBe(true);
  const proposal = await data.proposeSettingsChange("only show things within 20 miles");
  expect(proposal.unsupported).toBeNull();
  expect(proposal.changes).toEqual([{ field: "radiusMiles", from: "30", to: "20", text: "Radius: 30 → 20 miles" }]);
  await data.confirmSettingsChange(proposal.id);
  expect((await data.listEvents()).every((e) => (e.distanceMiles ?? 0) <= 20)).toBe(true);
});

test("unsupported requests say to text Rayyan", async () => {
  const data = createFakeData(localStorage, now);
  const proposal = await data.proposeSettingsChange("change my passcode to 1234");
  expect(proposal.changes).toEqual([]);
  expect(proposal.unsupported).toBe("I can't change that from here. Text Rayyan.");
});

test("follow by name moves a suggested org to following", async () => {
  const data = createFakeData(localStorage, now);
  const { suggested } = await data.listOrgs();
  const proposal = await data.proposeSettingsChange(`follow ${suggested[0].name}`);
  await data.confirmSettingsChange(proposal.id);
  const after = await data.listOrgs();
  expect(after.following.some((o) => o.id === suggested[0].id)).toBe(true);
});

test("the sponsorship over the ceiling and the advisor conference never appear", async () => {
  const data = createFakeData(localStorage, now);
  const titles = (await data.listEvents()).map((e) => e.title).join(" | ");
  expect(titles).not.toMatch(/Sponsor/i);
  expect(titles).not.toMatch(/CAIS/);
});

test("events tab shows between 5 and 10 events, including both speaking kinds", async () => {
  const data = createFakeData(localStorage, now);
  const list = await data.listEvents();
  expect(list.length).toBeGreaterThanOrEqual(5);
  expect(list.length).toBeLessThanOrEqual(10);
  expect(list.some((e) => e.speaking === "asked")).toBe(true);
  expect(list.some((e) => e.speaking === "could_offer")).toBe(true);
});

test("followed org hosting an event gets a hosting nudge; contacting clears not_contacted", async () => {
  const data = createFakeData(localStorage, now);
  const { following } = await data.listOrgs();
  expect(following.some((o) => o.nudges.some((n) => n.kind === "hosting"))).toBe(true);
  const stale = following.find((o) => o.nudges.some((n) => n.kind === "not_contacted"))!;
  await data.markContacted(stale.id);
  const again = (await data.listOrgs()).following.find((o) => o.id === stale.id)!;
  expect(again.nudges.some((n) => n.kind === "not_contacted")).toBe(false);
});

test("state survives a new createFakeData on the same storage", async () => {
  const a = createFakeData(localStorage, now);
  const [first] = await a.listEvents();
  await a.setMark(first.id, "saved");
  const b = createFakeData(localStorage, now);
  expect((await b.getEvent(first.id))?.mark).toBe("saved");
});
