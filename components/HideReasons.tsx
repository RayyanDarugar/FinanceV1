import type { HideReason } from "@/lib/types";

export const HIDE_REASONS: { value: HideReason; label: string }[] = [
  { value: "too_far", label: "Too far" },
  { value: "wrong_crowd", label: "Wrong crowd" },
  { value: "too_expensive", label: "Too expensive" },
  { value: "bad_timing", label: "Bad timing" },
  { value: "not_my_kind", label: "Not my kind of event" },
];

export function HideReasons({ onPick, onCancel }: { onPick: (r: HideReason | null) => void; onCancel: () => void }) {
  return (
    <div className="mt-3 rounded-xl border border-line bg-paper p-3">
      <p className="text-[15px] font-medium">
        Why isn&apos;t this for you? <span className="font-normal text-muted">(optional)</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {HIDE_REASONS.map((r) => (
          <button
            key={r.value}
            onClick={() => onPick(r.value)}
            className="min-h-11 rounded-full border border-line bg-card px-3.5 text-[15px] active:bg-chip"
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-[15px]">
        <button onClick={() => onPick(null)} className="min-h-11 font-medium text-accent">
          Skip, just hide it
        </button>
        <button onClick={onCancel} className="min-h-11 text-muted">
          Keep it
        </button>
      </div>
    </div>
  );
}
