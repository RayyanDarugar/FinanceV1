import { NextResponse } from "next/server";
import { dataApiEnabled } from "@/lib/auth/session";
import { dispatch } from "@/lib/data/rpc";
import { profileId, serverData, serverRepo } from "@/lib/data/server";
import { liveSettingsDeps } from "@/lib/settings/live";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Single RPC endpoint for the app's screens. Protected by middleware (session cookie). */
export async function POST(req: Request) {
  if (!dataApiEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { method?: unknown; args?: unknown } | null;
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const out = await dispatch(serverData(liveSettingsDeps(serverRepo(), profileId())), body.method, body.args);
  return NextResponse.json(out.body, { status: out.status });
}
