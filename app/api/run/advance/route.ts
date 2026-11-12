import { NextResponse } from "next/server";
import { profileId, serverRepo } from "@/lib/data/server";
import type { RunKind } from "@/lib/db/runs";
import { sendWeeklyEmail } from "@/lib/email/weekly";
import { liveRunDeps } from "@/lib/engine/liveDeps";
import { advanceRun, inRunWindow } from "@/lib/engine/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Called by cron-jobs.org every few minutes during the Monday window. Each call does ~40s of work and saves progress.
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
  if (kind === "weekly" && !force && !inRunWindow(now, profile.timezone)) {
    return NextResponse.json({ skipped: "outside the Monday run window" });
  }
  const deps = liveRunDeps((p, at) => sendWeeklyEmail(repo, p, at));
  const result = await advanceRun(deps, pid, now, kind);
  return NextResponse.json(result);
}

export const POST = handle;
// cron-jobs.org can send GET; the secret header is still required.
export const GET = handle;
