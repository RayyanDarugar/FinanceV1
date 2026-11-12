/** HMAC-SHA256 signed tokens (base64url JSON + "." + signature). Web Crypto, so it runs in middleware too. */

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function key(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signToken(
  payload: Record<string, unknown>,
  ttlSeconds: number,
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ ...payload, exp: Math.floor(now.getTime() / 1000) + ttlSeconds })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export async function verifyToken<T>(token: string, secret: string, now: Date = new Date()): Promise<(T & { exp: number }) | null> {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    // crypto.subtle.verify compares in constant time.
    const ok = await crypto.subtle.verify("HMAC", await key(secret), fromB64url(sig) as BufferSource, enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as T & { exp: number };
    if (typeof payload.exp !== "number" || payload.exp * 1000 < now.getTime()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function appSecret(): string {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 16) throw new Error("APP_SECRET must be set (16+ characters)");
  return s;
}

export const SESSION_TTL = 90 * 24 * 3600;
export const LOGIN_LINK_TTL = 30 * 24 * 3600;
export const OUTCOME_LINK_TTL = 21 * 24 * 3600;
