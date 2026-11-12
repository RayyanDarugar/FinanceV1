import type { SpeakingSignal } from "@/lib/types";

export function SpeakingTag({ speaking }: { speaking: SpeakingSignal }) {
  if (speaking === "asked")
    return <span className="rounded-full bg-accent-soft px-2.5 py-1 text-sm font-medium text-accent">🎤 They&apos;re asking for speakers</span>;
  if (speaking === "could_offer")
    return <span className="rounded-full bg-blue-soft px-2.5 py-1 text-sm text-blue">💡 You could offer to speak</span>;
  return null;
}

export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-chip px-2.5 py-1 text-sm text-muted">{children}</span>;
}
