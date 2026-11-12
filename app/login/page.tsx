"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, { error: null });
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Event Finder</h1>
      <p className="mt-1 text-muted">Enter your passcode to see this week&apos;s picks.</p>
      <form action={action} className="mt-6 space-y-3">
        <label htmlFor="passcode" className="sr-only">
          Passcode
        </label>
        <input
          id="passcode"
          name="passcode"
          type="password"
          inputMode="text"
          autoComplete="current-password"
          autoFocus
          className="min-h-12 w-full rounded-xl border border-line bg-card px-4 text-lg outline-none focus:ring-2 focus:ring-accent/40"
          placeholder="Passcode"
        />
        {state.error && <p className="text-[15px] text-clay">{state.error}</p>}
        <button disabled={pending} className="min-h-12 w-full rounded-xl bg-accent text-lg font-medium text-white disabled:opacity-50">
          {pending ? "Checking…" : "Open"}
        </button>
      </form>
    </main>
  );
}
