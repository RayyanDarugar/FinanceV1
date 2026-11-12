"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPasscode } from "@/lib/auth/passcode";
import { isLive, issueSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { appSecret } from "@/lib/auth/tokens";

const WRONG = "That passcode didn't work. Try again.";

export async function login(_prev: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const input = String(form.get("passcode") ?? "").trim();
  if (!input) return { error: WRONG };

  if (isLive()) {
    const { profileId, serverRepo } = await import("@/lib/data/server");
    const hash = await serverRepo().getPasscodeHash(profileId());
    if (!hash || !(await checkPasscode(input, hash))) return { error: WRONG };
    (await cookies()).set(SESSION_COOKIE, await issueSession(profileId(), appSecret()), sessionCookieOptions);
  } else {
    // Prototype: sample data only.
    if (input !== (process.env.DEMO_PASSCODE || "demo")) return { error: WRONG };
    (await cookies()).set(SESSION_COOKIE, "demo", sessionCookieOptions);
  }
  redirect("/events");
}
