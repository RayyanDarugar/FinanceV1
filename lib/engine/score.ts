import { z } from "zod";
import type { EventItem, Mode, Profile, SpeakingSignal } from "@/lib/types";
import { callJson as realCallJson } from "./llm";
import type { Usage } from "./usage";

export interface ScoreResult {
  audienceFit: number;
  wealth: number;
  speaking: SpeakingSignal;
  suggestedMode: Mode;
  nextStep: string;
  whyGo: string;
  whyFits: string;
  needsPreapproval: boolean;
}

const ScoreSchema = z.object({
  scores: z.array(
    z.object({
      id: z.string(),
      audienceFit: z.number(),
      wealth: z.number(),
      speaking: z.enum(["asked", "could_offer", "none"]),
      suggestedMode: z.enum(["attend", "speak", "table", "sponsor"]),
      nextStep: z.string(),
      whyGo: z.string(),
      whyFits: z.string(),
      needsPreapproval: z.boolean(),
    }),
  ),
});

const BATCH = 8;

function system(p: Profile): string {
  return `You help ${p.displayName}, an independent professional, decide which local events are worth their time for meeting future clients.

Their ideal client: ${p.idealClient}
Their priorities: ${p.priorities}
Compliance: their firm requires "${p.complianceRule.label}" (${p.complianceRule.leadDays} days ahead) for these ways of taking part: ${p.complianceRule.appliesTo.join(", ")}.

For each event, return:
- audienceFit 0–10: how much of the room matches the ideal client. 10 = nearly everyone fits. Industry peers and competitors score low.
- wealth 0–10: how affluent the attendees likely are, from concrete signals (venue, neighborhood, ticket price, host, membership).
- speaking: "asked" only if the event data says speakerAsked=true; "could_offer" if the host or format would plausibly welcome them pitching a talk; otherwise "none".
- suggestedMode: the best way for them to take part (speak > table > attend; sponsor only if cheap and clearly worth it).
- nextStep: one concrete action ("Email the program chair at … to offer a 20-minute talk on …").
- whyGo: at most 2 sentences, citing concrete facts from the event (audience, venue, price, organizer). Never generic phrases like "great networking opportunity".
- whyFits: 1–3 sentences naming which part of the ideal client this audience matches and the wealth signal you used. If the fit is weak, say so plainly.
- needsPreapproval: true if suggestedMode is one of: ${p.complianceRule.appliesTo.join(", ")}.
Use only what the event data says; do not invent facts. Return one entry per event id.`;
}

function eventLine(e: EventItem & { speakingAsked: boolean }): string {
  return JSON.stringify({
    id: e.id,
    title: e.title,
    host: e.host,
    when: e.startsAt,
    where: [e.venueName, e.address ?? e.townText].filter(Boolean).join(", "),
    distanceMiles: e.distanceMiles === null ? null : Math.round(e.distanceMiles),
    costUsd: e.costUsd,
    speakerAsked: e.speakingAsked,
    description: e.description.slice(0, 600),
  });
}

/** Scores up to 8 events per LLM call. Events the model skips are left out of the result (unscored this run). */
export async function scoreEvents(
  batch: (EventItem & { speakingAsked: boolean })[],
  p: Profile,
  feedback: string,
  usage: Usage,
  deps: { callJson?: typeof realCallJson } = {},
): Promise<Map<string, ScoreResult>> {
  const callJson = deps.callJson ?? realCallJson;
  const out = new Map<string, ScoreResult>();
  const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(n)));
  for (let i = 0; i < batch.length; i += BATCH) {
    const chunk = batch.slice(i, i + BATCH);
    const byId = new Map(chunk.map((e) => [e.id, e]));
    const user = `${feedback ? `What they have turned down so far (learn from it):\n${feedback}\n\n` : ""}Events:\n${chunk.map(eventLine).join("\n")}`;
    const res = await callJson({ system: system(p), user, schema: ScoreSchema, maxTokens: 8000, effort: "medium" }, usage);
    for (const s of res?.scores ?? []) {
      const e = byId.get(s.id);
      if (!e) continue;
      const speaking: SpeakingSignal =
        s.speaking === "asked" ? (e.speakingAsked ? "asked" : "could_offer") : s.speaking === "could_offer" ? "could_offer" : null;
      out.set(s.id, {
        audienceFit: clamp(s.audienceFit),
        wealth: clamp(s.wealth),
        speaking,
        suggestedMode: s.suggestedMode,
        nextStep: s.nextStep,
        whyGo: s.whyGo,
        whyFits: s.whyFits,
        needsPreapproval: s.needsPreapproval || p.complianceRule.appliesTo.includes(s.suggestedMode),
      });
    }
  }
  return out;
}
