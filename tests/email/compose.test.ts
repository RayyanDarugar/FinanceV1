import { composeWeeklyEmail } from "@/lib/email/compose";
import { makeEvent, makeOrg, makeProfile, NOW } from "../helpers/make";

const profile = makeProfile();
const links = {
  open: "https://app.test/r/TOKEN",
  outcome: (id: string, n: number) => `https://app.test/outcome/${id}-${n}`,
};

function input(o: Partial<Parameters<typeof composeWeeklyEmail>[0]> = {}) {
  const ranked = [1, 2, 3, 4, 5, 6].map((i) => makeEvent({ title: `Pick ${i}`, whyGo: `Reason ${i}` }));
  return { profile, ranked, orgsToReach: [], pending: [], links, now: NOW, ...o };
}

test("subject counts the ranked events", () => {
  expect(composeWeeklyEmail(input()).subject).toBe("Your 6 picks this week");
});

test("only the top 3 appear under Top 3", () => {
  const { html, text } = composeWeeklyEmail(input());
  for (const t of ["Pick 1", "Pick 2", "Pick 3"]) {
    expect(html).toContain(t);
    expect(text).toContain(t);
  }
  expect(html).not.toContain("Pick 4");
  expect(html).toContain("See all 6 →");
  expect(html).toContain("https://app.test/r/TOKEN");
});

test("pre-approval deadline appears inline, including when passed", () => {
  const ranked = [
    makeEvent({ title: "Soon", needsPreapproval: true, startsAt: "2026-11-23T18:00:00-08:00" }),
    makeEvent({ title: "Later", needsPreapproval: true, startsAt: "2026-12-10T18:30:00-08:00" }),
  ];
  const { html } = composeWeeklyEmail(input({ ranked }));
  expect(html).toContain("Deadline passed Nov 16");
  expect(html).toContain("submit by Dec 3");
});

test("reach-out section is absent when there are no nudges, present when there are", () => {
  expect(composeWeeklyEmail(input()).html).not.toContain("Good time to reach out");
  const org = { ...makeOrg({ name: "Del Mar Rotary" }), nudges: [{ kind: "not_contacted" as const, text: "You haven't contacted them yet." }] };
  const { html } = composeWeeklyEmail(input({ orgsToReach: [org] }));
  expect(html).toContain("Good time to reach out");
  expect(html).toContain("Del Mar Rotary");
  expect(html).toContain("You haven't contacted them yet.");
});

test("every outcome link appears for each pending event", () => {
  const pending = [makeEvent({ id: "past1", title: "Mixer" }), makeEvent({ id: "past2", title: "Lunch" })];
  const { html, text } = composeWeeklyEmail(input({ pending }));
  expect(html).toContain("How did it go?");
  for (const id of ["past1", "past2"]) for (const n of [0, 1, 2, 3]) expect(html).toContain(`/outcome/${id}-${n}`);
  expect(html).toContain("3+");
  expect(text).toContain("Mixer");
});

test("outcome section is absent with nothing pending", () => {
  expect(composeWeeklyEmail(input()).html).not.toContain("How did it go?");
});

test("event text is HTML-escaped", () => {
  const ranked = [makeEvent({ title: "<script>x</script> & Co" })];
  const { html } = composeWeeklyEmail(input({ ranked }));
  expect(html).not.toContain("<script>x");
  expect(html).toContain("&lt;script&gt;x&lt;/script&gt; &amp; Co");
});
