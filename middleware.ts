import { NextResponse, type NextRequest } from "next/server";
import { isProtectedPath } from "@/lib/auth/paths";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth/session";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (!isProtectedPath(path)) return NextResponse.next();
  if (await isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (path.startsWith("/api/")) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
