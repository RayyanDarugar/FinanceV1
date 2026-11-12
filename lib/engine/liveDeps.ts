import "server-only";
import { serverRepo } from "@/lib/data/server";
import { extractEvents } from "./extract";
import { fetchPageText } from "./fetchPage";
import { geocode } from "./geocode";
import { runOrgsStage } from "./orgs";
import type { RunDeps } from "./run";
import { scoreEvents } from "./score";
import { tavilySearch } from "./search";

/** Production wiring for advanceRun. Email sending is plugged in by the caller (lib/email/weekly). */
export function liveRunDeps(sendWeekly: RunDeps["sendWeekly"]): RunDeps {
  const repo = serverRepo();
  return {
    repo,
    timeBudgetMs: 40_000,
    newId: () => crypto.randomUUID(),
    search: (q, usage) => tavilySearch(q, usage),
    fetchPage: (url, usage) => fetchPageText(url, usage),
    extract: (page, kind, now, usage) => extractEvents(page, kind, now, usage),
    geocode: (address, town, home, usage) => geocode(address, town, home, usage, { repo }),
    score: (events, p, feedback, usage) => scoreEvents(events, p, feedback, usage),
    orgs: (p, run, now, usage) => runOrgsStage(repo, p, run, now, usage),
    sendWeekly,
  };
}
