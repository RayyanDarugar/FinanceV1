import type { Repo, StoredEvent } from "@/lib/db/repo";
import { STAGES, type Run, type RunKind, type Stage } from "@/lib/db/runs";
import { haversineMiles, type LatLng } from "@/lib/domain/geo";
import { computeScore, isEligible, WINDOW_DAYS } from "@/lib/domain/rank";
import type { Profile, SourceKind } from "@/lib/types";
import { dedupeKey, findMatch, mergeCandidates, type Candidate } from "./dedupe";
import type { RawEvent } from "./extract";
import { summarizeFeedback } from "./feedback";
import { BudgetExceededError } from "./llm";
import { matchOrgId } from "./orgMatch";
import type { ScoreResult } from "./score";
import { buildQueries, MAX_SEARCHES_PER_RUN, type SearchResult } from "./search";
import type { Usage } from "./usage";
import { verifyEvent } from "./verify";

/** Everything the run touches, injected so tests can stand in for the network and the LLM. */
export interface RunDeps {
  repo: Repo;
  /** Keep doing batches until this much time has passed (0 = one batch per call). */
  timeBudgetMs: number;
  newId: () => string;
  search: (query: string, usage: Usage) => Promise<SearchResult[]>;
  fetchPage: (url: string, usage: Usage) => Promise<{ url: string; text: string } | null>;
  extract: (page: { url: string; text: string }, kind: SourceKind, now: Date, usage: Usage) => Promise<RawEvent[]>;
  geocode: (address: string | null, town: string | null, home: LatLng, usage: Usage) => Promise<LatLng | null>;
  score: (events: (StoredEvent & { speakingAsked: boolean })[], p: Profile, feedback: string, usage: Usage) => Promise<Map<string, ScoreResult>>;
  /** Cheap 0–10 fit per event (bulk model). */
  prescreen: (events: StoredEvent[], p: Profile, usage: Usage) => Promise<Map<string, number>>;
  /** Organization suggestions (Task 15). */
  orgs: (p: Profile, run: Run, now: Date, usage: Usage) => Promise<void>;
  sendWeekly: (p: Profile, now: Date) => Promise<void>;
}

const BATCH = { searches: 10, extract: 3, geocode: 10, score: 16, prescreen: 40 };
/** Pre-screen fit (0–10) an event needs before the expensive scorer writes its reasons. */
const PRESCREEN_MIN = 6;
const MAX_PAGES = 120;
const LOCK_MS = 55_000;
const DAY = 86_400_000;

/** ISO week (e.g. "2026-W47") of `now` in the profile's time zone. */
export function weekKey(now: Date, tz: string): string {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now)
    .split("-")
    .map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / DAY + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** The weekly run only works Monday 03:00–06:59 in the profile's time zone (unless forced). */
export function inRunWindow(now: Date, tz: string): boolean {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(now);
  const weekday = parts.find((x) => x.type === "weekday")?.value;
  const hour = Number(parts.find((x) => x.type === "hour")?.value);
  return weekday === "Mon" && hour >= 3 && hour < 7;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

function classify(url: string, p: Profile, orgSites: string[]): SourceKind {
  const h = hostOf(url);
  if (p.trustedSources.some((s) => hostOf(s.url) === h)) return "trusted_calendar";
  if (orgSites.includes(h)) return "organizer";
  return "listing";
}

function toStored(c: Candidate, key: string, orgId: string | null, now: Date, newId: () => string, runId: string): StoredEvent {
  const contact =
    c.contactRole || c.contactName || c.contactEmail || c.contactPhone
      ? { role: c.contactRole ?? undefined, name: c.contactName ?? undefined, email: c.contactEmail ?? undefined, phone: c.contactPhone ?? undefined }
      : null;
  return {
    id: newId(), title: c.title, host: c.host, orgId, startsAt: c.startsAt!, endsAt: c.endsAt,
    venueName: c.venueName, address: c.address, townText: c.townText, lat: null, lng: null, distanceMiles: null,
    costUsd: c.costUsd, sourceUrl: c.sourceUrl, sourceKind: c.sourceKind, registerUrl: c.registerUrl, contact,
    description: c.description, speaking: null, suggestedMode: "attend", nextStep: "", whyGo: "", whyFits: "",
    needsPreapproval: false, confidence: c.confidence, subScores: null, score: 0, checkedAt: now.toISOString(),
    mark: null, hideReason: null, outcome: null, outcomeNote: null,
    dedupeKey: key, raw: { ...c, runId },
  };
}

type StepResult = { moreWork: boolean };

async function step(stage: Stage, run: Run, p: Profile, deps: RunDeps, now: Date): Promise<StepResult> {
  const { repo } = deps;
  const usage = run.usage;
  const upcoming = (e: StoredEvent) => {
    const t = Date.parse(e.startsAt);
    return t >= now.getTime() && t <= now.getTime() + WINDOW_DAYS * DAY && e.mark !== "hidden";
  };

  switch (stage) {
    case "collect": {
      if (run.kind !== "weekly") return { moreWork: false };
      if (run.cursor.sources < p.trustedSources.length) {
        await repo.addRunPages(run.id, p.trustedSources.map((s) => ({ url: s.url, sourceKind: "trusted_calendar" as const })));
        run.cursor.sources = p.trustedSources.length;
        return { moreWork: true };
      }
      const queries = buildQueries(p, now);
      const remaining = Math.min(queries.length, MAX_SEARCHES_PER_RUN) - run.cursor.queries;
      if (remaining <= 0 || usage.searches >= MAX_SEARCHES_PER_RUN) return { moreWork: false };
      const batch = queries.slice(run.cursor.queries, run.cursor.queries + Math.min(BATCH.searches, remaining, MAX_SEARCHES_PER_RUN - usage.searches));
      const results = (await Promise.all(batch.map((q) => deps.search(q, usage)))).flat();
      run.cursor.queries += batch.length;
      const existing = await repo.listRunPages(run.id);
      const room = MAX_PAGES - existing.length;
      const orgSites = (await repo.listOrgs(p.id)).map((o) => (o.website ? hostOf(o.website) : "")).filter(Boolean);
      const seen = new Set(existing.map((x) => x.url));
      const pages = results
        .filter((r) => !seen.has(r.url) && seen.add(r.url))
        .slice(0, Math.max(0, room))
        .map((r) => ({ url: r.url, sourceKind: classify(r.url, p, orgSites) }));
      await repo.addRunPages(run.id, pages);
      return { moreWork: run.cursor.queries < Math.min(queries.length, MAX_SEARCHES_PER_RUN) && room > 0 };
    }

    case "extract": {
      const pages = await repo.pendingRunPages(run.id, BATCH.extract);
      if (!pages.length) return { moreWork: false };
      const results = await Promise.allSettled(
        pages.map(async (pg) => {
          const fetched = await deps.fetchPage(pg.url, usage);
          if (!fetched) throw new Error("fetch failed");
          const raws = await deps.extract(fetched, pg.sourceKind, now, usage);
          return raws.flatMap((r): Candidate[] => {
            const v = verifyEvent(r, pg.sourceKind, now, p.timezone);
            return v.ok ? [{ ...r, sourceUrl: fetched.url, sourceKind: pg.sourceKind, confidence: v.confidence }] : [];
          });
        }),
      );
      const budgetHit = results.some((r) => r.status === "rejected" && r.reason instanceof BudgetExceededError);
      for (let i = 0; i < pages.length; i++) {
        const r = results[i];
        if (r.status === "rejected" && r.reason instanceof BudgetExceededError) continue; // stays pending
        await repo.setRunPageStatus(run.id, pages[i].url, r.status === "fulfilled" ? "extracted" : "failed");
      }
      const candidates = mergeCandidates(results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])), p.timezone);
      if (candidates.length) {
        const [stored, orgs] = await Promise.all([repo.listEvents(p.id), repo.listOrgs(p.id)]);
        const rows = candidates.map((c) => {
          const key = findMatch(c, stored, p.timezone) ?? dedupeKey(c.title, c.startsAt!, p.timezone);
          return toStored(c, key, matchOrgId(c.host, orgs), now, deps.newId, run.id);
        });
        await repo.upsertEvents(p.id, run.id, rows);
      }
      if (budgetHit) throw new BudgetExceededError("budget reached during extraction");
      return { moreWork: true };
    }

    case "geocode": {
      const todo = (await repo.listEvents(p.id))
        .filter((e) => upcoming(e) && e.lat === null && e.raw.geocodeTried !== run.id)
        .slice(0, BATCH.geocode);
      if (!todo.length) return { moreWork: false };
      for (const e of todo) {
        const hit = await deps.geocode(e.address, e.townText, p.home, usage);
        await repo.updateEvent(e.id, {
          ...(hit ? { lat: hit.lat, lng: hit.lng, distanceMiles: Math.round(haversineMiles(p.home, hit) * 10) / 10 } : {}),
          raw: { ...e.raw, geocodeTried: run.id },
        });
      }
      return { moreWork: true };
    }

    case "score": {
      const all = await repo.listEvents(p.id);
      const candidates = all.filter((e) => upcoming(e) && e.subScores === null && e.raw.scoreTried !== run.id);
      if (!candidates.length) return { moreWork: false };

      // 1. Ineligible (too far, too pricey, excluded) never cost an LLM call.
      const ineligible = candidates.filter((e) => !isEligible(e, p, now));
      for (const e of ineligible) await repo.updateEvent(e.id, { raw: { ...e.raw, scoreTried: run.id } });
      const eligible = candidates.filter((e) => isEligible(e, p, now));

      // 2. Cheap pre-screen; low fits stay unscored (never shown).
      const needPre = eligible.filter((e) => typeof e.raw.prescreen !== "number").slice(0, BATCH.prescreen);
      if (needPre.length) {
        const fits = await deps.prescreen(needPre, p, usage);
        for (const e of needPre) {
          const fit = fits.get(e.id) ?? PRESCREEN_MIN; // unrated: give it the benefit of the doubt
          await repo.updateEvent(e.id, { raw: { ...e.raw, prescreen: fit, ...(fit < PRESCREEN_MIN ? { scoreTried: run.id } : {}) } });
        }
        return { moreWork: true };
      }

      // 3. Full scoring (reasons, mode, compliance) for the promising ones, best first.
      const todo = eligible
        .filter((e) => (e.raw.prescreen as number) >= PRESCREEN_MIN)
        .sort((a, b) => (b.raw.prescreen as number) - (a.raw.prescreen as number))
        .slice(0, BATCH.score);
      if (!todo.length) return { moreWork: ineligible.length > 0 };
      const orgs = await repo.listOrgs(p.id);
      const feedback = summarizeFeedback(
        all.filter((e) => e.mark === "hidden"),
        orgs.filter((o) => o.status === "not_interested"),
      );
      const results = await deps.score(todo.map((e) => ({ ...e, speakingAsked: Boolean(e.raw.speakingAsked) })), p, feedback, usage);
      for (const e of todo) {
        const s = results.get(e.id);
        const raw = { ...e.raw, scoreTried: run.id };
        if (!s) {
          await repo.updateEvent(e.id, { raw });
          continue;
        }
        const subScores = { audienceFit: s.audienceFit, wealth: s.wealth };
        await repo.updateEvent(e.id, {
          subScores, speaking: s.speaking, suggestedMode: s.suggestedMode, nextStep: s.nextStep, whyGo: s.whyGo,
          whyFits: s.whyFits, needsPreapproval: s.needsPreapproval,
          score: computeScore({ subScores, speaking: s.speaking, distanceMiles: e.distanceMiles, costUsd: e.costUsd }, p),
          raw,
        });
      }
      return { moreWork: true };
    }

    case "orgs": {
      await deps.orgs(p, run, now, usage);
      return { moreWork: false };
    }

    case "email": {
      if (run.kind !== "weekly") return { moreWork: false };
      if (!(await repo.claimEmail(run.id, now))) return { moreWork: false };
      try {
        await deps.sendWeekly(p, now);
        return { moreWork: false };
      } catch (e) {
        await repo.releaseEmail(run.id);
        run.error = `email: ${e instanceof Error ? e.message : String(e)}`;
        return { moreWork: true }; // retry next call
      }
    }

    case "done":
      return { moreWork: false };
  }
}

const firstStage = (kind: RunKind): Stage => (kind === "weekly" ? "collect" : "orgs");

/**
 * Advances this week's run by one or more small batches and saves progress. Safe to call repeatedly and concurrently:
 * a lock keeps two calls from working at once, and the email is claimed atomically so it's sent once.
 */
export async function advanceRun(
  deps: RunDeps,
  profileId: string,
  now: Date,
  kind: RunKind = "weekly",
): Promise<{ runId: string; stage: Stage; done: boolean; costUsd: number }> {
  const p = await deps.repo.getProfile(profileId);
  if (!p) throw new Error(`Profile ${profileId} not found`);
  const created = await deps.repo.getOrCreateRun(profileId, kind, weekKey(now, p.timezone), deps.newId, firstStage(kind));
  if (created.stage === "done") return { runId: created.id, stage: "done", done: true, costUsd: created.usage.costUsd };
  const run = await deps.repo.lockRun(created.id, new Date(now.getTime() + LOCK_MS), now);
  if (!run) return { runId: created.id, stage: created.stage, done: false, costUsd: created.usage.costUsd };

  const started = Date.now();
  let stage = run.stage;
  try {
    do {
      let res: StepResult;
      try {
        res = await step(stage, run, p, deps, now);
      } catch (e) {
        if (!(e instanceof BudgetExceededError)) throw e;
        run.error = "LLM budget reached; skipped remaining extraction/scoring";
        res = { moreWork: false };
        // Skip the rest of the LLM-heavy stages, keep geocoding/email.
        if (stage === "extract" || stage === "score" || stage === "orgs") {
          stage = STAGES[STAGES.indexOf(stage) + 1];
          continue;
        }
      }
      if (stage === "email" && res.moreWork) break; // email failed; retry on the next call
      if (!res.moreWork) stage = STAGES[STAGES.indexOf(stage) + 1];
    } while (stage !== "done" && Date.now() - started < deps.timeBudgetMs);
  } finally {
    await deps.repo.saveRun(run.id, { stage, cursor: run.cursor, usage: run.usage, error: run.error });
  }
  return { runId: run.id, stage, done: stage === "done", costUsd: run.usage.costUsd };
}
