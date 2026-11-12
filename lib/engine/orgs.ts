import { z } from "zod";
import { nameKey, type Repo } from "@/lib/db/repo";
import type { Run } from "@/lib/db/runs";
import type { Organization, Profile } from "@/lib/types";
import { callJson as realCallJson } from "./llm";
import { tavilySearch, type SearchResult } from "./search";
import type { Usage } from "./usage";

const OrgSchema = z.object({
  orgs: z.array(
    z.object({
      name: z.string(),
      website: z.string().nullable(),
      townText: z.string().nullable(),
      contactRole: z.string().nullable(),
      contactEmail: z.string().nullable(),
      contactPhone: z.string().nullable(),
      whyHer: z.string(),
      hostsSpeakers: z.boolean(),
    }),
  ),
});

export interface OrgDeps {
  search: (q: string, usage: Usage) => Promise<SearchResult[]>;
  callJson: typeof realCallJson;
  newId: () => string;
}

const liveDeps = (): OrgDeps => ({ search: (q, u) => tavilySearch(q, u), callJson: realCallJson, newId: () => crypto.randomUUID() });

const MAX_ORG_SEARCHES = 10;

/** Searches for groups whose members fit the ideal client and asks the model to pick the best new ones. */
export async function findOrgCandidates(
  p: Profile,
  existing: Organization[],
  count: number,
  usage: Usage,
  now: Date,
  deps: OrgDeps = liveDeps(),
): Promise<Organization[]> {
  const { region, metro, audiences } = p.searchHints;
  const queries = [
    ...audiences.slice(0, 6).map((a) => `${a} group ${region}`),
    `women's club guest speakers ${region}`,
    `college career center community events ${metro}`,
    `retirement community lecture series ${region}`,
    `community center adult education ${p.areaTowns[0] ?? region}`,
  ].slice(0, MAX_ORG_SEARCHES);
  const results = (await Promise.all(queries.map((q) => deps.search(q, usage)))).flat();
  const seenUrl = new Set<string>();
  const snippets = results
    .filter((r) => !seenUrl.has(r.url) && seenUrl.add(r.url))
    .slice(0, 60)
    .map((r) => `- ${r.title} | ${r.url} | ${r.content.slice(0, 300)}`)
    .join("\n");
  const known = existing.map((o) => o.name);

  const system = `You find local organizations worth building a relationship with, for ${p.displayName}, an independent professional who wins clients by giving talks and through community networks.
Their ideal client: ${p.idealClient}
Their priorities: ${p.priorities}
Pick real, active, local groups (associations, clubs, chambers, women's groups, college centers, community/faith centers, retirement communities, foundations) whose members match the ideal client, preferring groups that host speakers or education events. Use only facts from the search results. Never invent contacts. Skip national umbrella pages, event-listing sites, news articles and businesses selling services.
whyHer: 1–2 concrete sentences on who the members are and why the group is worth knowing (do they host speakers?).`;
  const user = `Already known (do not suggest these): ${known.join("; ") || "none"}

Suggest up to ${count} new organizations from these search results:
${snippets}`;

  const out = await deps.callJson({ system, user, schema: OrgSchema, maxTokens: 6000, effort: "medium" }, usage);
  const knownKeys = new Set(known.map(nameKey));
  const fresh: Organization[] = [];
  for (const o of out?.orgs ?? []) {
    const key = nameKey(o.name);
    if (!key || knownKeys.has(key)) continue;
    knownKeys.add(key);
    const contact =
      o.contactRole || o.contactEmail || o.contactPhone
        ? { role: o.contactRole ?? undefined, email: o.contactEmail ?? undefined, phone: o.contactPhone ?? undefined }
        : null;
    fresh.push({
      id: deps.newId(), name: o.name.trim(), website: o.website, townText: o.townText, lat: null, lng: null, contact,
      whyHer: o.whyHer, status: "suggested", followedAt: null, lastContactedAt: null, suggestedAt: now.toISOString(),
    });
    if (fresh.length >= count) break;
  }
  return fresh;
}

const isoWeekNumber = (weekKey: string) => Number(weekKey.split("-W")[1]);

/** Weekly run "orgs" stage: 3–5 new suggestions on even ISO weeks; the one-time seed run adds ~15. */
export async function runOrgsStage(repo: Repo, p: Profile, run: Run, now: Date, usage: Usage, deps?: OrgDeps): Promise<void> {
  const seed = run.kind === "org_seed";
  if (!seed && isoWeekNumber(run.weekKey) % 2 === 1) return;
  const existing = await repo.listOrgs(p.id);
  const fresh = await findOrgCandidates(p, existing, seed ? 15 : 4, usage, now, deps);
  await repo.upsertOrgs(p.id, fresh);
}
