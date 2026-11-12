import type { Repo } from "@/lib/db/repo";
import type { LatLng } from "@/lib/domain/geo";
import type { Usage } from "./usage";

export interface GeocodeDeps {
  repo: Pick<Repo, "geocodeGet" | "geocodePut">;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

let lastCall = 0;

async function nominatim(query: string, home: LatLng, deps: GeocodeDeps): Promise<LatLng | null> {
  const cached = await deps.repo.geocodeGet(query);
  if (cached !== undefined) return cached;
  // Nominatim usage policy: max 1 request/second, identify the app.
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await (deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))))(wait);
  lastCall = Date.now();
  const box = [home.lng - 1, home.lat + 1, home.lng + 1, home.lat - 1].join(",");
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&viewbox=${box}&q=${encodeURIComponent(query)}`;
  let result: LatLng | null = null;
  try {
    const res = await (deps.fetchImpl ?? fetch)(url, {
      headers: { "user-agent": "EventFinder/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null; // don't cache server errors
    const rows = (await res.json()) as { lat: string; lon: string }[];
    if (rows[0]) result = { lat: Number(rows[0].lat), lng: Number(rows[0].lon) };
  } catch {
    return null;
  }
  await deps.repo.geocodePut(query, result);
  return result;
}

/** Address first, then "<town>, CA". Cached in the database, including misses. */
export async function geocode(
  address: string | null,
  townText: string | null,
  home: LatLng,
  _usage: Usage,
  deps: GeocodeDeps,
): Promise<LatLng | null> {
  const queries = [address?.trim(), townText?.trim() ? `${townText.trim()}, CA` : null].filter(Boolean) as string[];
  for (const q of queries) {
    const hit = await nominatim(q, home, deps);
    if (hit) return hit;
  }
  return null;
}
