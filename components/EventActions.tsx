"use client";

import { useState } from "react";
import type { EventItem, EventMark, HideReason } from "@/lib/types";
import { HideReasons } from "./HideReasons";

export type OnMark = (id: string, mark: EventMark, reason: HideReason | null) => void;

const btn = "min-h-11 flex-1 rounded-xl border px-2 text-[15px] font-medium transition-colors";

export function EventActions({ event, onMark }: { event: EventItem; onMark: OnMark }) {
  const [hiding, setHiding] = useState(false);
  const saved = event.mark === "saved";
  const going = event.mark === "going";
  return (
    <div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onMark(event.id, saved ? null : "saved", null)}
          className={`${btn} ${saved ? "border-accent/30 bg-accent-soft text-accent" : "border-line bg-card text-ink"}`}
          aria-pressed={saved}
        >
          {saved ? "★ Saved" : "☆ Save for later"}
        </button>
        <button
          onClick={() => onMark(event.id, going ? null : "going", null)}
          className={`${btn} ${going ? "border-accent bg-accent text-white" : "border-accent/40 bg-card text-accent"}`}
          aria-pressed={going}
        >
          ✓ I&apos;m going
        </button>
        <button onClick={() => setHiding(true)} className={`${btn} max-w-24 border-line bg-card text-muted`}>
          ✕ Hide
        </button>
      </div>
      {hiding && (
        <HideReasons
          onPick={(r) => {
            setHiding(false);
            onMark(event.id, "hidden", r);
          }}
          onCancel={() => setHiding(false)}
        />
      )}
    </div>
  );
}
