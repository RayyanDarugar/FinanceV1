import { createMemoryRepo } from "@/lib/db/memoryRepo";
import { extractEvents, type RawEvent } from "@/lib/engine/extract";
import { geocode } from "@/lib/engine/geocode";
import { newUsage } from "@/lib/engine/usage";
import { verifyEvent } from "@/lib/engine/verify";
import { NOW } from "../helpers/make";

const TZ = "America/Los_Angeles";

function raw(o: Partial<RawEvent> = {}): RawEvent {
  return {
    title: "Holiday Gala",
    host: "Foundation",
    startsAt: "2026-12-12T18:00:00-08:00",
    endsAt: null,
    yearStated: true,
    venueName: "Hotel",
    address: "1 Main St, Carlsbad, CA",
    townText: "Carlsbad",
    costUsd: 150,
    registerUrl: null,
    contactRole: null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    description: "",
    speakingAsked: false,
    modes: ["attend"],
    ...o,
  };
}

describe("verifyEvent", () => {
  test("organizer or trusted calendar page → 0.9", () => {
    expect(verifyEvent(raw(), "organizer", NOW, TZ)).toEqual({ ok: true, confidence: 0.9 });
    expect(verifyEvent(raw(), "trusted_calendar", NOW, TZ)).toEqual({ ok: true, confidence: 0.9 });
  });

  test("listing site → 0.65", () => {
    expect(verifyEvent(raw(), "listing", NOW, TZ)).toEqual({ ok: true, confidence: 0.65 });
  });

  test("missing year costs 0.2; missing address and town costs 0.1", () => {
    const r = verifyEvent(raw({ yearStated: false, address: null, townText: null }), "organizer", NOW, TZ);
    expect(r.ok && r.confidence).toBeCloseTo(0.6, 5);
  });

  test("past event is rejected", () => {
    expect(verifyEvent(raw({ startsAt: "2026-11-10T18:00:00-08:00" }), "organizer", NOW, TZ)).toMatchObject({ ok: false });
  });

  test("event more than 56 days out is rejected", () => {
    expect(verifyEvent(raw({ startsAt: "2027-01-20T18:00:00-08:00" }), "organizer", NOW, TZ)).toMatchObject({ ok: false });
  });

  test("missing or unparseable date is rejected", () => {
    expect(verifyEvent(raw({ startsAt: null }), "organizer", NOW, TZ)).toMatchObject({ ok: false });
    expect(verifyEvent(raw({ startsAt: "sometime in December" }), "organizer", NOW, TZ)).toMatchObject({ ok: false });
  });
});

describe("extractEvents", () => {
  const page = { url: "https://found.org/gala", text: "Holiday Gala — Saturday, December 12, 2025, 6pm, Hotel Del" };

  test("a page from last year is extracted but rejected by verification", async () => {
    const callJson = vi.fn(async () => ({ events: [raw({ startsAt: "2025-12-12T18:00:00-08:00" })] }));
    const events = await extractEvents(page, "organizer", NOW, newUsage(), { callJson: callJson as never });
    expect(events).toHaveLength(1);
    expect(verifyEvent(events[0], "organizer", NOW, TZ)).toMatchObject({ ok: false });
  });

  test("a null LLM result becomes []", async () => {
    const events = await extractEvents(page, "organizer", NOW, newUsage(), { callJson: (async () => null) as never });
    expect(events).toEqual([]);
  });

  test("the prompt carries today's date and the page URL and text", async () => {
    const callJson = vi.fn(async () => ({ events: [] }));
    await extractEvents(page, "listing", NOW, newUsage(), { callJson: callJson as never });
    const opts = (callJson.mock.calls[0] as unknown as [{ system: string; user: string }])[0];
    expect(opts.user).toContain("2026-11-18");
    expect(opts.user).toContain("https://found.org/gala");
    expect(opts.user).toContain("December 12, 2025");
  });
});

describe("geocode", () => {
  const home = { lat: 33.1581, lng: -117.3506 };

  test("uses the cache before calling Nominatim, and caches misses", async () => {
    const repo = createMemoryRepo();
    const fetchImpl = vi.fn(async () => Response.json([{ lat: "33.10", lon: "-117.30" }]));
    const deps = { repo, fetchImpl: fetchImpl as unknown as typeof fetch, sleep: async () => {} };
    expect(await geocode("1 Main St, Carlsbad, CA", null, home, newUsage(), deps)).toEqual({ lat: 33.1, lng: -117.3 });
    expect(await geocode("1 Main St, Carlsbad, CA", null, home, newUsage(), deps)).toEqual({ lat: 33.1, lng: -117.3 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const none = vi.fn(async () => Response.json([]));
    expect(await geocode(null, "Nowhere", home, newUsage(), { ...deps, fetchImpl: none as unknown as typeof fetch })).toBeNull();
    expect(await geocode(null, "Nowhere", home, newUsage(), { ...deps, fetchImpl: none as unknown as typeof fetch })).toBeNull();
    expect(none).toHaveBeenCalledTimes(1);
  });

  test("falls back to the town when the address doesn't geocode", async () => {
    const repo = createMemoryRepo();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([{ lat: "33.04", lon: "-117.29" }]));
    expect(await geocode("Room 4B, Building C", "Encinitas", home, newUsage(), { repo, fetchImpl, sleep: async () => {} })).toEqual({
      lat: 33.04,
      lng: -117.29,
    });
  });

  test("returns null with neither address nor town", async () => {
    expect(await geocode(null, null, home, newUsage(), { repo: createMemoryRepo(), fetchImpl: vi.fn(), sleep: async () => {} })).toBeNull();
  });
});
