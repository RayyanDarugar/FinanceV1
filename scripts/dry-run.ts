/**
 * Runs the real weekly pipeline end to end in memory (no database writes, no email):
 * real calendar fetches, real Claude extraction + scoring, real geocoding; Tavily search only if TAVILY_API_KEY is set.
 *   LLM_BUDGET_USD=1.5 npx tsx --env-file=.env.local scripts/dry-run.ts [--out file.json]
 */
import { writeFileSync } from "node:fs";
import { createServiceData } from "../lib/data/service";
import { createMemoryRepo } from "../lib/db/memoryRepo";
import { composeWeeklyEmail } from "../lib/email/compose";
import { pendingOutcomes } from "../lib/domain/outcomes";
import { formatCost, formatEventWhen } from "../lib/domain/format";
import { complianceText } from "../lib/domain/compliance";
import { extractEvents } from "../lib/engine/extract";
import { fetchPageText } from "../lib/engine/fetchPage";
import { geocode } from "../lib/engine/geocode";
import { runOrgsStage } from "../lib/engine/orgs";
import { advanceRun, type RunDeps } from "../lib/engine/run";
import { prescreenEvents, scoreEvents } from "../lib/engine/score";
import { tavilySearch } from "../lib/engine/search";
import { TRUSTED_SOURCES } from "../lib/engine/trustedSources";
import { extractModel, llmBudgetUsd, llmModel } from "../lib/engine/usage";
import { makeProfileFixture } from "../lib/fixtures/profile";

async function main() {
  const outFile = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : null;
  const repo = createMemoryRepo();
  const profile = { ...makeProfileFixture(), trustedSources: TRUSTED_SOURCES };
  await repo.putProfile(profile, "x");
  const now = new Date();
  const log = (...a: unknown[]) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
  const t0 = Date.now();
  const deps: RunDeps = {
    repo,
    timeBudgetMs: 10 * 60_000,
    newId: () => crypto.randomUUID(),
    search: (q, u) => tavilySearch(q, u),
    fetchPage: (url, u) => fetchPageText(url, u),
    extract: async (page, kind, at, u) => {
      const r = await extractEvents(page, kind, at, u);
      log(`extract ${r.length} from ${page.url.slice(0, 70)} ($${u.costUsd.toFixed(3)})`);
      return r;
    },
    geocode: (a, t, home, u) => geocode(a, t, home, u, { repo }),
    score: async (events, p, fb, u) => {
      const r = await scoreEvents(events, p, fb, u);
      log(`scored ${r.size}/${events.length} ($${u.costUsd.toFixed(3)})`);
      return r;
    },
    prescreen: async (events, p, u) => {
      const r = await prescreenEvents(events, p, u);
      log(`prescreened ${r.size}/${events.length}, ${[...r.values()].filter((f) => f >= 6).length} pass ($${u.costUsd.toFixed(3)})`);
      return r;
    },
    orgs: (p, run, at, u) => (process.env.TAVILY_API_KEY ? runOrgsStage(repo, p, run, at, u) : Promise.resolve()),
    sendWeekly: async () => {},
  };
  log(`models: score=${llmModel()} extract=${extractModel()} budget=$${llmBudgetUsd()} tavily=${process.env.TAVILY_API_KEY ? "on" : "off"}`);
  let r;
  do {
    r = await advanceRun(deps, profile.id, now);
    log(`stage → ${r.stage}`);
  } while (!r.done);

  const run = (await repo.getRun(profile.id, "weekly", (await import("../lib/engine/run")).weekKey(now, profile.timezone)))!;
  const all = await repo.listEvents(profile.id);
  const data = createServiceData({ repo, profileId: profile.id, now: () => now });
  const ranked = await data.listEvents();
  const pages = await repo.listRunPages(run.id);
  console.log("\n==== RESULT ====");
  console.log(`pages: ${pages.length} (${pages.filter((p) => p.status === "extracted").length} read, ${pages.filter((p) => p.status === "failed").length} failed)`);
  console.log(`events stored: ${all.length}; scored: ${all.filter((e) => e.subScores).length}; ranked for display: ${ranked.length}`);
  console.log(`unique dedupe keys: ${new Set(all.map((e) => e.dedupeKey)).size}`);
  console.log(`cost: $${run.usage.costUsd.toFixed(3)} · tokens in ${run.usage.inputTokens} out ${run.usage.outputTokens} · fetches ${run.usage.fetches} · searches ${run.usage.searches}`);
  if (run.error) console.log(`note: ${run.error}`);
  console.log("\nTop picks:");
  for (const e of ranked) {
    console.log(`\n• [${e.score}] ${e.title} — ${e.host}`);
    console.log(`  ${formatEventWhen(e.startsAt, e.endsAt, profile.timezone)} · ${e.townText ?? "?"} · ${e.distanceMiles ?? "?"} mi · ${formatCost(e.costUsd)} · ${e.sourceKind} ${e.confidence}`);
    console.log(`  speaking: ${e.speaking ?? "-"} · mode: ${e.suggestedMode} ${complianceText(e, profile, now) ? "· " + complianceText(e, profile, now) : ""}`);
    console.log(`  why go: ${e.whyGo}`);
    console.log(`  fits: ${e.whyFits}`);
    console.log(`  ${e.sourceUrl}`);
  }
  const email = composeWeeklyEmail({
    profile, ranked, orgsToReach: [], pending: pendingOutcomes(await data.listGoing(), now),
    links: { open: "https://finance-v1.vercel.app/events", outcome: () => "#" }, now,
  });
  if (outFile) writeFileSync(outFile, JSON.stringify({ ranked, all: all.map((e) => ({ title: e.title, startsAt: e.startsAt, host: e.host, score: e.score, confidence: e.confidence, subScores: e.subScores, sourceUrl: e.sourceUrl })), usage: run.usage, emailHtml: email.html }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
