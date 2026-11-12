import type { Profile } from "@/lib/types";
import type { Usage } from "./usage";

export interface SearchResult {
  url: string;
  title: string;
  content: string;
}

export const MAX_SEARCHES_PER_RUN = 40;

/** Tavily basic search (1 credit). Returns [] on any failure. */
export async function tavilySearch(
  query: string,
  usage: Usage,
  opts: { fetchImpl?: typeof fetch; apiKey?: string } = {},
): Promise<SearchResult[]> {
  const apiKey = opts.apiKey ?? process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  const fetchImpl = opts.fetchImpl ?? fetch;
  usage.searches++;
  try {
    const res = await fetchImpl("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query, search_depth: "basic", max_results: 8, country: "united states" }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { results?: { url: string; title?: string; content?: string }[] };
    return (body.results ?? []).map((r) => ({ url: r.url, title: r.title ?? "", content: r.content ?? "" }));
  } catch {
    return [];
  }
}

function monthNames(now: Date, tz: string): [string, string] {
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "long" }).format(d);
  const next = new Date(now.getTime() + 45 * 86_400_000); // months the 8-week window mostly covers
  return [fmt(new Date(now.getTime() + 14 * 86_400_000)), fmt(next)];
}

/** Weekly open-web queries, speaking opportunities first. Built only from the profile, so another client gets their own. */
export function buildQueries(p: Profile, now: Date): string[] {
  const [m1, m2] = monthNames(now, p.timezone);
  const towns = p.areaTowns.slice(0, 6);
  const { region, metro, audiences: groups, topics } = p.searchHints;
  const town = (i: number) => towns[i % Math.max(1, towns.length)] ?? region;
  const speaking = [
    ...topics.slice(0, 3).map((t) => `call for speakers ${t} ${region}`),
    `guest speaker wanted ${topics[0] ?? "workshop"} workshop ${region} ${m1}`,
    `library adult education speakers ${metro} County ${m2}`,
    `seeking speakers ${groups[0] ?? "community"} luncheon ${metro} ${m1}`,
    `college career center guest speaker ${topics[0] ?? ""} ${metro} ${m2}`,
    `retirement community lecture series speakers ${region}`,
    `Rotary club program speaker ${town(0)}`,
    `community education workshop speakers wanted ${region}`,
    `nonprofit workshop speakers needed ${metro} ${m1}`,
  ];
  const audiences = [
    ...groups.map((g, i) => `${g} event ${i % 2 ? metro : region} ${i % 2 ? m2 : m1}`),
    `chamber of commerce mixer ${towns.slice(0, 3).join(" ")} ${m1}`,
  ];
  const social = [
    `hospital foundation gala ${metro} ${m1} ${m2}`,
    `charity luncheon ${town(4)} ${m1}`,
    `community event ${town(2)} ${m1} ${m2}`,
    `philanthropy fundraiser ${region} ${m2}`,
    `arts benefit gala ${metro} ${m1}`,
    `women's philanthropy event ${metro} ${m2}`,
    `library foundation fundraiser ${town(1)}`,
  ];
  const perTown = towns.map((t) => `community events ${t} ${m1} ${m2}`);
  return [...new Set([...speaking, ...audiences, ...social, ...perTown])].slice(0, MAX_SEARCHES_PER_RUN);
}
