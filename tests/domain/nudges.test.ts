import { orgNudges } from "@/lib/domain/nudges";
import { pendingOutcomes } from "@/lib/domain/outcomes";
import { makeEvent, makeOrg, NOW } from "../helpers/make";

const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

test("not_contacted nudge appears at 14 days after follow", () => {
  expect(orgNudges(makeOrg({ followedAt: daysAgo(13) }), [], NOW)).toEqual([]);
  const n = orgNudges(makeOrg({ followedAt: daysAgo(14) }), [], NOW);
  expect(n).toEqual([{ kind: "not_contacted", text: "You haven't contacted them yet." }]);
});

test("not_contacted pauses for 60 days after contact", () => {
  expect(orgNudges(makeOrg({ followedAt: daysAgo(90), lastContactedAt: daysAgo(59) }), [], NOW)).toEqual([]);
  const n = orgNudges(makeOrg({ followedAt: daysAgo(90), lastContactedAt: daysAgo(61) }), [], NOW);
  expect(n[0]).toEqual({ kind: "not_contacted", text: "It's been a while since you reached out." });
});

test("hosting nudge only for followed orgs with an upcoming event", () => {
  const org = makeOrg({ followedAt: daysAgo(1) });
  const ev = makeEvent({ orgId: org.id, title: "Winter Gala", startsAt: "2026-12-12T18:00:00-08:00" });
  expect(orgNudges(org, [ev], NOW)).toEqual([
    { kind: "hosting", eventId: ev.id, text: "Hosting Winter Gala Dec 12. Good time to reach out." },
  ]);
  expect(orgNudges({ ...org, status: "suggested" }, [ev], NOW)).toEqual([]);
  expect(orgNudges(org, [{ ...ev, startsAt: "2026-11-10T18:00:00-08:00" }], NOW)).toEqual([]);
});

test("pendingOutcomes: going + past (within 14 days) + no outcome only", () => {
  const past = "2026-11-15T18:00:00-08:00";
  const a = makeEvent({ mark: "going", startsAt: past });
  const b = makeEvent({ mark: "going", startsAt: past, outcome: 2 });
  const c = makeEvent({ mark: "saved", startsAt: past });
  const d = makeEvent({ mark: "going", startsAt: "2026-12-01T18:00:00-08:00" });
  const e = makeEvent({ mark: "going", startsAt: "2026-10-01T18:00:00-08:00" });
  expect(pendingOutcomes([a, b, c, d, e], NOW).map((x) => x.id)).toEqual([a.id]);
});
