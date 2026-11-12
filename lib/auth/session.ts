import { SESSION_TTL, signToken, verifyToken } from "./tokens";

export const SESSION_COOKIE = "ef_session";

export const isLive = () => process.env.NEXT_PUBLIC_DATA_MODE === "live";

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: SESSION_TTL,
  path: "/",
};

export async function issueSession(profileId: string, secret: string): Promise<string> {
  return signToken({ pid: profileId, purpose: "session" }, SESSION_TTL, secret);
}

/** Live: a valid signed session. Prototype: any session cookie (sample data only). Fails closed without APP_SECRET. */
export async function isValidSession(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  if (!isLive()) return true;
  const secret = process.env.APP_SECRET;
  if (!secret) return false;
  const t = await verifyToken<{ purpose?: string }>(value, secret);
  return t?.purpose === "session";
}
