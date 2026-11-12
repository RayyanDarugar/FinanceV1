"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE } from "@/lib/auth/session";

/** Prototype login: compares against DEMO_PASSCODE. Replaced by the hashed passcode in Task 9. */
export async function login(_prev: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const input = String(form.get("passcode") ?? "").trim();
  const expected = process.env.DEMO_PASSCODE || "demo";
  if (input !== expected) return { error: "That passcode didn't work. Try again." };
  (await cookies()).set(SESSION_COOKIE, "demo", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 90 * 24 * 3600,
    path: "/",
  });
  redirect("/events");
}
