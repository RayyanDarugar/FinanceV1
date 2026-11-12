import { verifyToken } from "@/lib/auth/tokens";
import type { Repo } from "@/lib/db/repo";
import type { Outcome } from "@/lib/types";

type OutcomeToken = { pid: string; eventId: string; n: Outcome; purpose: string };

export type OutcomeInfo =
  | { ok: true; eventId: string; n: Outcome; title: string; already: Outcome | null }
  | { ok: false; message: string };

const EXPIRED = "This link has expired. Open the app and answer on the “I'm going” tab instead.";

/** For the confirm page (GET). Never writes — email scanners open every link. */
export async function readOutcomeToken(repo: Pick<Repo, "getEvent">, token: string, secret: string): Promise<OutcomeInfo> {
  const t = await verifyToken<OutcomeToken>(token, secret);
  if (!t || t.purpose !== "outcome" || ![0, 1, 2, 3].includes(t.n)) return { ok: false, message: EXPIRED };
  const e = await repo.getEvent(t.eventId);
  if (!e) return { ok: false, message: "We couldn't find that event anymore." };
  return { ok: true, eventId: e.id, n: t.n, title: e.title, already: e.outcome };
}

/** For the confirm button (POST). */
export async function applyOutcome(repo: Pick<Repo, "getEvent" | "recordOutcome">, token: string, note: string, secret: string): Promise<OutcomeInfo> {
  const info = await readOutcomeToken(repo, token, secret);
  if (!info.ok) return info;
  await repo.recordOutcome(info.eventId, info.n, note.trim().slice(0, 500) || null);
  return info;
}
