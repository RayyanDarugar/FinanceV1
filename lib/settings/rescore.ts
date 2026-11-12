import type { Repo } from "@/lib/db/repo";
import { computeScore, WINDOW_DAYS } from "@/lib/domain/rank";
import { BudgetExceededError } from "@/lib/engine/llm";
import { scoreEvents as realScore } from "@/lib/engine/score";
import { newUsage } from "@/lib/engine/usage";
import type { Profile } from "@/lib/types";

/** Only these change how an event scores; filters (radius, cost, exclusions) apply at read time for free. */
export function needsRescore(before: Profile, after: Profile): boolean {
  return (
    before.idealClient !== after.idealClient ||
    before.priorities !== after.priorities ||
    JSON.stringify(before.weights) !== JSON.stringify(after.weights)
  );
}

/** Re-scores stored upcoming events in batches of 8 until the time budget runs out. Returns how many were updated. */
export async function rescoreUpcoming(
  repo: Repo,
  profileId: string,
  now: Date,
  budgetMs: number,
  deps: { score?: typeof realScore } = {},
): Promise<number> {
  const score = deps.score ?? realScore;
  const p = await repo.getProfile(profileId);
  if (!p) return 0;
  const started = Date.now();
  const usage = newUsage();
  const todo = (await repo.listEvents(profileId)).filter((e) => {
    const t = Date.parse(e.startsAt);
    return e.mark !== "hidden" && t >= now.getTime() && t <= now.getTime() + WINDOW_DAYS * 86_400_000;
  });
  let updated = 0;
  for (let i = 0; i < todo.length && Date.now() - started < budgetMs; i += 8) {
    const batch = todo.slice(i, i + 8);
    let results;
    try {
      results = await score(batch.map((e) => ({ ...e, speakingAsked: Boolean(e.raw.speakingAsked) })), p, "", usage);
    } catch (e) {
      if (e instanceof BudgetExceededError) break;
      throw e;
    }
    for (const e of batch) {
      const s = results.get(e.id);
      if (!s) continue;
      const subScores = { audienceFit: s.audienceFit, wealth: s.wealth };
      await repo.updateEvent(e.id, {
        subScores, speaking: s.speaking, suggestedMode: s.suggestedMode, nextStep: s.nextStep, whyGo: s.whyGo, whyFits: s.whyFits,
        needsPreapproval: s.needsPreapproval,
        score: computeScore({ subScores, speaking: s.speaking, distanceMiles: e.distanceMiles, costUsd: e.costUsd }, p),
      });
      updated++;
    }
  }
  return updated;
}
