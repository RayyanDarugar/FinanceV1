"use client";

import { useState } from "react";
import type { SettingsProposal } from "@/lib/data/AppData";
import { useAppData, useRefresh } from "@/lib/data/DataProvider";

export function ChangeBox() {
  const data = useAppData();
  const refresh = useRefresh();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<SettingsProposal | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setDone(null);
    setProposal(await data.proposeSettingsChange(text));
    setBusy(false);
  }

  async function confirm() {
    if (!proposal) return;
    setBusy(true);
    await data.confirmSettingsChange(proposal.id);
    setDone(`Done: ${proposal.changes.map((c) => c.text).join(", ")}`);
    setProposal(null);
    setText("");
    setBusy(false);
    refresh();
  }

  return (
    <div className="rounded-2xl border border-dashed border-line bg-card p-3">
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="change-box" className="sr-only">
          Tell it what to change
        </label>
        <input
          id="change-box"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="✏️ Tell it what to change…"
          className="min-h-11 flex-1 rounded-lg bg-paper px-3 text-[16px] outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button disabled={busy || !text.trim()} className="min-h-11 rounded-lg bg-accent px-4 font-medium text-white disabled:opacity-40">
          Go
        </button>
      </form>
      {!proposal && !done && (
        <p className="mt-1.5 px-1 text-[13px] text-muted">e.g. &quot;only show things within 20 miles&quot; or &quot;follow the Del Mar Rotary&quot;</p>
      )}
      {done && <p className="mt-2 px-1 text-[15px] text-accent">✓ {done}</p>}
      {proposal && proposal.unsupported && (
        <div className="mt-2 rounded-lg bg-clay-soft p-3 text-[15px] text-clay">
          <p>{proposal.unsupported}</p>
          <button onClick={() => setProposal(null)} className="mt-1 min-h-11 font-medium">
            OK
          </button>
        </div>
      )}
      {proposal && !proposal.unsupported && (
        <div className="mt-2 rounded-lg bg-accent-soft p-3 text-[15px]">
          <p className="font-medium">I&apos;ll make this change:</p>
          <ul className="mt-1 list-disc pl-5">
            {proposal.changes.map((c) => (
              <li key={c.field + c.to}>{c.text}</li>
            ))}
          </ul>
          <div className="mt-2 flex gap-3">
            <button onClick={confirm} disabled={busy} className="min-h-11 rounded-lg bg-accent px-4 font-medium text-white">
              Confirm
            </button>
            <button onClick={() => setProposal(null)} className="min-h-11 px-2 text-muted">
              Never mind
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
