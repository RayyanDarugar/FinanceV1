import { isProtectedPath } from "@/lib/auth/paths";
import { checkPasscode, hashPasscode } from "@/lib/auth/passcode";
import { signToken, verifyToken } from "@/lib/auth/tokens";

const SECRET = "test-secret-123";
const NOW = new Date("2026-11-18T17:00:00Z");

test("round trip returns the payload", async () => {
  const t = await signToken({ pid: "p1", purpose: "login" }, 3600, SECRET, NOW);
  expect(await verifyToken<{ pid: string; purpose: string }>(t, SECRET, NOW)).toMatchObject({ pid: "p1", purpose: "login" });
});

test("tampered payload returns null", async () => {
  const t = await signToken({ pid: "p1" }, 3600, SECRET, NOW);
  const [body, sig] = t.split(".");
  const evil = Buffer.from(JSON.stringify({ pid: "p2", exp: 9999999999 })).toString("base64url");
  expect(await verifyToken(`${evil}.${sig}`, SECRET, NOW)).toBeNull();
  expect(await verifyToken(`${body}.${sig.slice(0, -2)}xx`, SECRET, NOW)).toBeNull();
});

test("expired token returns null", async () => {
  const t = await signToken({ pid: "p1" }, 60, SECRET, NOW);
  expect(await verifyToken(t, SECRET, new Date(NOW.getTime() + 61_000))).toBeNull();
});

test("token signed with another secret returns null", async () => {
  const t = await signToken({ pid: "p1" }, 3600, "other-secret", NOW);
  expect(await verifyToken(t, SECRET, NOW)).toBeNull();
});

test("garbage returns null", async () => {
  expect(await verifyToken("not-a-token", SECRET, NOW)).toBeNull();
  expect(await verifyToken("", SECRET, NOW)).toBeNull();
});

test("passcode hashing and checking", async () => {
  const h = await hashPasscode("sunrise-42");
  expect(await checkPasscode("sunrise-42", h)).toBe(true);
  expect(await checkPasscode(" sunrise-42 ", h)).toBe(true);
  expect(await checkPasscode("sunrise-43", h)).toBe(false);
});

test("protected paths", () => {
  for (const p of ["/events", "/events/abc", "/orgs", "/map", "/going", "/preview/email", "/api/data", "/"]) {
    expect(isProtectedPath(p)).toBe(true);
  }
  for (const p of ["/login", "/r/abc", "/outcome/abc", "/api/outcome", "/api/run/advance", "/_next/static/x.js", "/favicon.ico"]) {
    expect(isProtectedPath(p)).toBe(false);
  }
});
