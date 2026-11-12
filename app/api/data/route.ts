import { NextResponse } from "next/server";
import { dispatch } from "@/lib/data/rpc";
import { serverData } from "@/lib/data/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Single RPC endpoint for the app's screens. Protected by middleware (session cookie). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { method?: unknown; args?: unknown } | null;
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const out = await dispatch(serverData(), body.method, body.args);
  return NextResponse.json(out.body, { status: out.status });
}
