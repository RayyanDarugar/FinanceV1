import { createMemoryRepo } from "@/lib/db/memoryRepo";
import type { Run } from "@/lib/db/runs";
import { matchOrgId } from "@/lib/engine/orgMatch";
import { findOrgCandidates, runOrgsStage } from "@/lib/engine/orgs";
import { newUsage } from "@/lib/engine/usage";
import { makeOrg, makeProfile, NOW } from "../helpers/make";

const p = makeProfile();

function deps(names: string[]) {
  return {
    search: vi.fn(async () => [{ url: "https://x.org", title: "x", content: "y" }]),
    callJson: vi.fn(async () => ({
      orgs: names.map((name) => ({
        name, website: `https://${name.replace(/\W/g, "").toLowerCase()}.org`, townText: "Carlsbad",
        contactRole: "Program chair", contactEmail: null, contactPhone: null,
        whyHer: `Members fit: ${name}`, hostsSpeakers: true,
      })),
    })),
    newId: (() => {
      let i = 0;
      return () => `new${++i}`;
    })(),
  };
}

const run = (o: Partial<Run> = {}): Run => ({
  id: "r1", profileId: p.id, kind: "weekly", weekKey: "2026-W46", stage: "orgs", cursor: { sources: 0, queries: 0 },
  lockedUntil: null, emailedAt: null, usage: newUsage(), error: null, ...o,
});

test("existing and not-interested orgs are never re-suggested", async () => {
  const existing = [makeOrg({ name: "Del Mar Rotary", status: "following" }), makeOrg({ name: "Young Pros Club", status: "not_interested" })];
  const d = deps(["del mar rotary", "Young Pros Club", "Carlsbad Women's Business Network"]);
  const out = await findOrgCandidates(p, existing, 4, newUsage(), NOW, d as never);
  expect(out.map((o) => o.name)).toEqual(["Carlsbad Women's Business Network"]);
  expect(out[0]).toMatchObject({ status: "suggested", followedAt: null, lastContactedAt: null });
  expect(d.search.mock.calls.length).toBeLessThanOrEqual(10);
});

test("returns at most `count` suggestions", async () => {
  const out = await findOrgCandidates(p, [], 2, newUsage(), NOW, deps(["A Club", "B Society", "C Network"]) as never);
  expect(out).toHaveLength(2);
});

test("the weekly orgs stage runs on even ISO weeks and skips odd ones", async () => {
  const repo = createMemoryRepo();
  await repo.putProfile(p, "h");
  const d = deps(["Encinitas Garden Club"]);
  await runOrgsStage(repo, p, run({ weekKey: "2026-W47" }), NOW, newUsage(), d as never);
  expect(await repo.listOrgs(p.id)).toHaveLength(0);
  await runOrgsStage(repo, p, run({ weekKey: "2026-W46" }), NOW, newUsage(), d as never);
  expect((await repo.listOrgs(p.id)).map((o) => o.name)).toEqual(["Encinitas Garden Club"]);
});

test("the one-time seed run asks for 15", async () => {
  const repo = createMemoryRepo();
  await repo.putProfile(p, "h");
  const d = deps(Array.from({ length: 20 }, (_, i) => `Group ${i}`));
  await runOrgsStage(repo, p, run({ kind: "org_seed", weekKey: "2026-W47" }), NOW, newUsage(), d as never);
  expect(await repo.listOrgs(p.id)).toHaveLength(15);
});

test("event hosts link to orgs by name", () => {
  const orgs = [makeOrg({ id: "dm", name: "Del Mar Rotary" }), makeOrg({ id: "cc", name: "Carlsbad Chamber of Commerce" })];
  expect(matchOrgId("Del Mar Rotary Club", orgs)).toBe("dm");
  expect(matchOrgId("The Carlsbad Chamber", orgs)).toBe("cc");
  expect(matchOrgId("Carlsbad Chamber of Commerce", orgs)).toBe("cc");
  expect(matchOrgId("Rotary", orgs)).toBe(null);
  expect(matchOrgId("Encinitas Library", orgs)).toBe(null);
});
