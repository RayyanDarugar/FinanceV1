import { createMemoryRepo } from "@/lib/db/memoryRepo";
import type { RawEvent } from "@/lib/engine/extract";
import { advanceRun, weekKey, type RunDeps } from "@/lib/engine/run";
import { MAX_SEARCHES_PER_RUN } from "@/lib/engine/search";
import { newUsage } from "@/lib/engine/usage";
import { makeProfile, NOW } from "../helpers/make";

const TZ = "America/Los_Angeles";

function raw(title: string, o: Partial<RawEvent> = {}): RawEvent {
  return {
    title, host: "Carlsbad Chamber", startsAt: "2026-12-10T18:30:00-08:00", endsAt: null, yearStated: true,
    venueName: "Hall", address: "1 Main St, Carlsbad", townText: "Carlsbad", costUsd: 0, registerUrl: null,
    contactRole: null, contactName: null, contactEmail: null, contactPhone: null, description: "d",
    speakingAsked: false, modes: ["attend"], ...o,
  };
}

async function setup(over: Partial<RunDeps> = {}) {
  const repo = createMemoryRepo();
  const profile = makeProfile({ trustedSources: [{ name: "Chamber", url: "https://chamber.org/events" }] });
  await repo.putProfile(profile, "h");
  const sent: string[] = [];
  let id = 0;
  const deps: RunDeps = {
    repo,
    timeBudgetMs: 0, // one batch per call, so tests can step through
    newId: () => `id${++id}`,
    search: vi.fn(async (q: string, usage) => {
      usage.searches++; // like the real Tavily client
      return [{ url: `https://listing.com/${encodeURIComponent(q).slice(0, 20)}`, title: q, content: "" }];
    }),
    fetchPage: vi.fn(async (url: string) => ({ url, text: `page ${url}` })),
    extract: vi.fn(async (page: { url: string }) => (page.url.includes("chamber.org") ? [raw("Money After 50 Panel", { speakingAsked: true })] : [])),
    geocode: vi.fn(async () => ({ lat: 33.1, lng: -117.3 })),
    score: vi.fn(async (events) => new Map(events.map((e) => [e.id, {
      audienceFit: 8, wealth: 7, speaking: e.speakingAsked ? "asked" as const : null, suggestedMode: "attend" as const,
      nextStep: "n", whyGo: "w", whyFits: "f", needsPreapproval: false,
    }]))),
    prescreen: vi.fn(async (events) => new Map(events.map((e) => [e.id, 8]))),
    orgs: vi.fn(async () => {}),
    sendWeekly: vi.fn(async () => {
      sent.push("email");
    }),
    ...over,
  };
  return { repo, profile, deps, sent };
}

async function runToDone(deps: RunDeps, profileId: string, max = 200) {
  for (let i = 0; i < max; i++) {
    const r = await advanceRun(deps, profileId, NOW);
    if (r.done) return r;
  }
  throw new Error("run never finished");
}

test("weekKey is the ISO week in Pacific time", () => {
  expect(weekKey(new Date("2026-11-16T11:00:00Z"), TZ)).toBe("2026-W47");
  // Sunday 11pm PT is still the previous ISO week even though it's Monday in UTC
  expect(weekKey(new Date("2026-11-16T07:30:00Z"), TZ)).toBe("2026-W46");
});

test("repeated calls walk the stages to done and store a scored, geocoded event", async () => {
  const { repo, profile, deps, sent } = await setup();
  const r = await runToDone(deps, profile.id);
  expect(r.stage).toBe("done");
  const events = await repo.listEvents(profile.id);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ title: "Money After 50 Panel", sourceKind: "trusted_calendar", confidence: 0.9, speaking: "asked" });
  expect(events[0].subScores).toEqual({ audienceFit: 8, wealth: 7 });
  expect(events[0].distanceMiles).not.toBeNull();
  expect(events[0].raw.speakingAsked).toBe(true);
  expect(sent).toEqual(["email"]);
});

test("two concurrent calls never both process a batch", async () => {
  const { profile, deps } = await setup();
  let inFlight = 0;
  let maxInFlight = 0;
  deps.fetchPage = vi.fn(async (url: string) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return { url, text: "t" };
  });
  for (let i = 0; i < 40; i++) await Promise.all([advanceRun(deps, profile.id, NOW), advanceRun(deps, profile.id, NOW)]);
  // fetches inside one batch run in parallel (<=3); two batches at once would exceed that
  expect(maxInFlight).toBeLessThanOrEqual(3);
});

test("calls after done do no work and the email goes out exactly once", async () => {
  const { profile, deps, sent } = await setup();
  await runToDone(deps, profile.id);
  const calls = (deps.extract as ReturnType<typeof vi.fn>).mock.calls.length;
  for (let i = 0; i < 5; i++) expect((await advanceRun(deps, profile.id, NOW)).done).toBe(true);
  expect((deps.extract as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
  expect(sent).toEqual(["email"]);
});

test("an email failure is recorded and retried on the next call", async () => {
  let fail = true;
  const { profile, deps, repo } = await setup({
    sendWeekly: vi.fn(async () => {
      if (fail) {
        fail = false;
        throw new Error("smtp down");
      }
    }),
  });
  await runToDone(deps, profile.id);
  expect(deps.sendWeekly).toHaveBeenCalledTimes(2);
  const run = await repo.getRun(profile.id, "weekly", weekKey(NOW, TZ));
  expect(run?.emailedAt).not.toBeNull();
});

test("a page whose extraction fails is marked failed and the run continues", async () => {
  const { profile, deps, repo } = await setup({
    extract: vi.fn(async (page: { url: string }) => {
      if (page.url.includes("chamber.org")) throw new Error("bad page");
      return [];
    }),
  });
  const r = await runToDone(deps, profile.id);
  expect(r.done).toBe(true);
  const run = (await repo.getRun(profile.id, "weekly", weekKey(NOW, TZ)))!;
  const pages = await repo.listRunPages(run.id);
  expect(pages.find((p) => p.url.includes("chamber.org"))?.status).toBe("failed");
});

test("never more than 40 searches in a run", async () => {
  const { profile, deps } = await setup();
  await runToDone(deps, profile.id);
  expect((deps.search as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(MAX_SEARCHES_PER_RUN);
});

test("a re-found event keeps her mark and isn't duplicated across weeks", async () => {
  const { profile, deps, repo } = await setup();
  await runToDone(deps, profile.id);
  const [e] = await repo.listEvents(profile.id);
  await repo.setMark(e.id, "going", null);
  const nextWeek = new Date(NOW.getTime() + 7 * 86_400_000);
  for (let i = 0; i < 200; i++) if ((await advanceRun(deps, profile.id, nextWeek)).done) break;
  const all = await repo.listEvents(profile.id);
  expect(all).toHaveLength(1);
  expect(all[0].mark).toBe("going");
});

test("budget exhaustion stops LLM stages but still sends the email with what exists", async () => {
  const { BudgetExceededError } = await import("@/lib/engine/llm");
  const { profile, deps, sent } = await setup({
    score: vi.fn(async () => {
      throw new BudgetExceededError("cap");
    }),
  });
  const r = await runToDone(deps, profile.id);
  expect(r.done).toBe(true);
  expect(sent).toEqual(["email"]);
});

test("usage accumulates on the run record", async () => {
  const { profile, deps, repo } = await setup({
    extract: vi.fn(async (_p, _k, _n, usage) => {
      usage.costUsd += 0.01;
      return [];
    }),
  });
  await runToDone(deps, profile.id);
  const run = (await repo.getRun(profile.id, "weekly", weekKey(NOW, TZ)))!;
  expect(run.usage.costUsd).toBeGreaterThan(0);
  expect(run.usage.searches).toBeGreaterThan(0);
  void newUsage;
});

test("run window is Monday 03:00–06:59 Pacific", async () => {
  const { inRunWindow } = await import("@/lib/engine/run");
  expect(inRunWindow(new Date("2026-11-16T11:00:00Z"), TZ)).toBe(true); // Mon 3:00 PST
  expect(inRunWindow(new Date("2026-11-16T14:59:00Z"), TZ)).toBe(true); // Mon 6:59
  expect(inRunWindow(new Date("2026-11-16T15:00:00Z"), TZ)).toBe(false); // Mon 7:00
  expect(inRunWindow(new Date("2026-11-16T10:59:00Z"), TZ)).toBe(false); // Mon 2:59
  expect(inRunWindow(new Date("2026-11-17T11:00:00Z"), TZ)).toBe(false); // Tue
});

test("pre-screen: low-fit events never reach full scoring, ineligible ones skip both", async () => {
  const { profile, deps, repo } = await setup({
    extract: vi.fn(async (page: { url: string }) =>
      page.url.includes("chamber.org")
        ? [
            raw("Women in Business Lunch"),
            raw("Kids Storytime", { venueName: "Library", startsAt: "2026-12-11T10:00:00-08:00" }),
            raw("Far Away Gala", { townText: "Los Angeles", address: "LA", startsAt: "2026-12-12T18:00:00-08:00", venueName: "LA Hall" }),
          ]
        : [],
    ),
    geocode: vi.fn(async (_a, town: string | null) => (town === "Los Angeles" ? { lat: 34.05, lng: -118.24 } : { lat: 33.1, lng: -117.3 })),
    prescreen: vi.fn(async (events) => new Map(events.map((e) => [e.id, e.title.includes("Kids") ? 2 : 8]))),
  });
  await runToDone(deps, profile.id);
  const scoredTitles = (deps.score as ReturnType<typeof vi.fn>).mock.calls.flatMap((c) => (c[0] as { title: string }[]).map((e) => e.title));
  expect(scoredTitles).toEqual(["Women in Business Lunch"]);
  const prescreened = (deps.prescreen as ReturnType<typeof vi.fn>).mock.calls.flatMap((c) => (c[0] as { title: string }[]).map((e) => e.title));
  expect(prescreened).not.toContain("Far Away Gala");
  const kids = (await repo.listEvents(profile.id)).find((e) => e.title === "Kids Storytime")!;
  expect(kids.subScores).toBeNull();
  expect(kids.raw.prescreen).toBe(2);
});
