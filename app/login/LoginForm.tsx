"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, { error: null });
  return (
    <form action={action} className="mt-6 space-y-3">
      <label htmlFor="passcode" className="sr-only">
        Passcode
      </label>
      <input
        id="passcode"
        name="passcode"
        type="password"
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
  );
}
