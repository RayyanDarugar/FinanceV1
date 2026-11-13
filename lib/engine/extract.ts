import { z } from "zod";
import { localDate } from "@/lib/domain/dates";
import type { SourceKind } from "@/lib/types";
import { callJson as realCallJson } from "./llm";
import { extractModel, type Usage } from "./usage";

export const RawEventSchema = z.object({
  title: z.string(),
  host: z.string(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  yearStated: z.boolean(),
  venueName: z.string().nullable(),
  address: z.string().nullable(),
  townText: z.string().nullable(),
  costUsd: z.number().nullable(),
  registerUrl: z.string().nullable(),
  eventUrl: z.string().nullable(),
  contactRole: z.string().nullable(),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  description: z.string(),
  speakingAsked: z.boolean(),
  modes: z.array(z.enum(["attend", "speak", "table", "sponsor"])),
});
export type RawEvent = z.infer<typeof RawEventSchema>;

const ExtractSchema = z.object({ events: z.array(RawEventSchema) });

const SYSTEM = `You read one web page and list the specific, dated, in-person events it announces.

Rules:
- Only events with a specific date (and ideally a time). Skip recurring-schedule boilerplate with no date, past-event recaps, job postings, classes that are really multi-week courses, and webinars with no physical location.
- startsAt/endsAt: ISO 8601 with the US Pacific offset (-08:00 in winter, -07:00 in summer), e.g. "2026-12-10T18:30:00-08:00". If no time is given, use 09:00. If no date can be determined, set startsAt to null.
- yearStated: true only if the year is written on the page for that event. If you inferred the year, false.
- costUsd: lowest individual ticket price in US dollars; 0 if free; null if not stated. Ignore sponsorship packages when an individual ticket exists.
- speakingAsked: true ONLY if the page explicitly invites speakers, presenters, panelists or workshop leaders for this event. Never infer it.
- modes: the ways a guest could take part that the page actually mentions (attend, speak, table/booth, sponsor). Always include "attend" if the public can come.
- Links on the page are written as "label (link: URL)". eventUrl: the link to this specific event's own page (its title link, or a "details"/"more info" link next to it). registerUrl: its registration or ticket link. Copy URLs exactly as written; use null if the event has no link of its own. Never use the page's own URL or a general home/calendar link.
- host: the organization running the event. townText: the city it's in.
- description: one or two plain sentences about the event and who attends, from the page only.
- Copy facts from the page. Do not invent addresses, prices, contacts or audiences. Use null when unknown.
- If the page has no qualifying events, return {"events": []}.`;

export interface ExtractDeps {
  callJson?: typeof realCallJson;
}

/** One LLM call per page. A failed or empty call returns []. */
export async function extractEvents(
  page: { url: string; text: string },
  sourceKind: SourceKind,
  now: Date,
  usage: Usage,
  deps: ExtractDeps = {},
): Promise<RawEvent[]> {
  const callJson = deps.callJson ?? realCallJson;
  const today = localDate(now, "America/Los_Angeles");
  const user = `Today is ${today}. Only list events from today through the next 8 weeks.
Source type: ${sourceKind === "listing" ? "an event listing site (events posted by others)" : "the organizer's own page or calendar"}.
Page URL: ${page.url}

<page>
${page.text}
</page>`;
  const out = await callJson({ system: SYSTEM, user, schema: ExtractSchema, maxTokens: 8000, effort: "low", model: extractModel() }, usage);
  // A link the page doesn't contain was made up; drop it.
  const onPage = (u: string | null) => (u && page.text.includes(u) ? u : null);
  return (out?.events ?? []).map((e) => ({ ...e, eventUrl: onPage(e.eventUrl), registerUrl: onPage(e.registerUrl) }));
}
