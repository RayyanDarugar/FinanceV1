import { NextResponse } from "next/server";
import { profileId, serverRepo } from "@/lib/data/server";
import type { RunKind } from "@/lib/db/runs";
import { sendWeeklyEmail } from "@/lib/email/weekly";
import { liveRunDeps } from "@/lib/engine/liveDeps";
import { pendingRefreshKey } from "@/lib/engine/refresh";
import { advanceRun, inRunWindow, windowEnding } from "@/lib/engine/run";

export const dynamic = "force-dynamic";
// Vercel Hobby with Fluid compute allows up to 300s. The run checkpoints after every step regardless.
export const maxDuration = 300;

/**
 * Called by cron-jobs.org every 5 minutes. Monday 03:00–06:59 it advances the weekly run; other times only a pending
 * "search again now" refresh (else it returns {skipped}). Each call works up to ~2 min, saving after every step.
 *   POST /api/run/advance?kind=weekly|org_seed[&force=1]   header: x-run-secret
 */
async function handle(req: Request) {
  const secret = process.env.RUN_SECRET;
  if (!secret || req.headers.get("x-run-secret") !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const kind = (url.searchParams.get("kind") ?? "weekly") as RunKind;
  if (kind !== "weekly" && kind !== "org_seed") return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  const force = url.searchParams.get("force") === "1";
  const repo = serverRepo();
  const pid = profileId();
  const profile = await repo.getProfile(pid);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 500 });
  const now = new Date();
  const deps = liveRunDeps((p, at) => sendWeeklyEmail(repo, p, at));
  if (kind === "weekly" && !force && !inRunWindow(now, profile.timezone)) {
    // Outside Monday's window the only work is a "search again now" she asked for.
    const key = await pendingRefreshKey(repo, pid, now, profile.timezone);
    if (!key) return NextResponse.json({ skipped: "outside the Monday run window" });
    return NextResponse.json({ refresh: true, ...(await advanceRun(deps, pid, now, "weekly", { key })) });
  }
  const result = await advanceRun(deps, pid, now, kind, { finishNow: kind === "weekly" && !force && windowEnding(now, profile.timezone) });
  return NextResponse.json(result);
}

export const POST = handle;
// cron-jobs.org can send GET; the secret header is still required.
export const GET = handle;
