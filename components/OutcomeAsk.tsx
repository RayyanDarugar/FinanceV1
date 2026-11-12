"use client";

import { useState } from "react";
import type { EventItem, Outcome } from "@/lib/types";

const CHOICES: { n: Outcome; label: string }[] = [
  { n: 0, label: "0" },
  { n: 1, label: "1" },
  { n: 2, label: "2" },
  { n: 3, label: "3+" },
];

export function OutcomeAsk({ event, onAnswer }: { event: EventItem; onAnswer: (n: Outcome, note: string) => void }) {
  const [picked, setPicked] = useState<Outcome | null>(null);
  const [note, setNote] = useState("");
  return (
    <article className="rounded-2xl border border-accent/30 bg-accent-soft p-4">
      <p className="text-[15px]">
        You went to <span className="font-semibold">{event.title}</span>. Any good conversations?
      </p>
      <div className="mt-3 flex gap-2">
        {CHOICES.map((c) => (
          <button
            key={c.n}
            onClick={() => setPicked(c.n)}
            aria-pressed={picked === c.n}
            className={`min-h-11 flex-1 rounded-xl border text-lg font-semibold ${
              picked === c.n ? "border-accent bg-accent text-white" : "border-line bg-card text-accent"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className="mt-3 space-y-2">
          <label htmlFor={`note-${event.id}`} className="block text-[14px] text-muted">
            Anything to remember? (optional)
          </label>
          <input
            id={`note-${event.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Met Dr. Patel, wants to talk in January"
            className="min-h-11 w-full rounded-lg border border-line bg-card px-3 text-[16px]"
          />
          <button onClick={() => onAnswer(picked, note)} className="min-h-11 w-full rounded-xl bg-accent font-medium text-white">
            Save
          </button>
        </div>
      )}
    </article>
  );
}
