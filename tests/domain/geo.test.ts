import { haversineMiles } from "@/lib/domain/geo";
import { formatCost, formatEventWhen } from "@/lib/domain/format";

test("haversine Carlsbad→Del Mar ≈ 14 mi", () => {
  const d = haversineMiles({ lat: 33.1581, lng: -117.3506 }, { lat: 32.9595, lng: -117.2653 });
  expect(d).toBeGreaterThan(13);
  expect(d).toBeLessThan(16);
});

test("formatCost", () => {
  expect(formatCost(0)).toBe("Free");
  expect(formatCost(350)).toBe("$350");
  expect(formatCost(null)).toBe("Cost: check event page");
});

test("formatEventWhen renders PT weekday, date and time", () => {
  expect(formatEventWhen("2026-12-10T18:30:00-08:00", null, "America/Los_Angeles")).toBe("Thu Dec 10 · 6:30 pm");
  expect(formatEventWhen("2026-12-10T18:30:00-08:00", "2026-12-10T20:30:00-08:00", "America/Los_Angeles")).toBe("Thu Dec 10 · 6:30–8:30 pm");
});
