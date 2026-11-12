import { NextResponse } from "next/server";
import { issueSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { appSecret, verifyToken } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";

/** Email "See all" link: a valid login token signs her in and opens the list; anything else asks for the passcode. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = new URL(req.url);
  if (!process.env.APP_SECRET) return NextResponse.redirect(new URL("/login", base));
  const t = await verifyToken<{ pid: string; purpose: string }>(token, appSecret());
  if (!t || t.purpose !== "login") return NextResponse.redirect(new URL("/login?expired=1", base));
  const res = NextResponse.redirect(new URL("/events", base));
  res.cookies.set(SESSION_COOKIE, await issueSession(t.pid, appSecret()), sessionCookieOptions);
  return res;
}
