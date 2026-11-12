import { NextResponse } from "next/server";
import { serverRepo } from "@/lib/data/server";
import { applyOutcome } from "@/lib/email/outcome";

export const dynamic = "force-dynamic";

/** "Yes, record it" on the outcome confirm page. The signed token is the authorization. */
export async function POST(req: Request) {
  const form = await req.formData();
  const token = String(form.get("token") ?? "");
  const note = String(form.get("note") ?? "");
  const secret = process.env.APP_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 500 });
  const result = await applyOutcome(serverRepo(), token, note, secret);
  if (!result.ok) return new NextResponse(result.message, { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  return NextResponse.redirect(new URL(`/outcome/${encodeURIComponent(token)}?saved=1`, req.url), 303);
}
