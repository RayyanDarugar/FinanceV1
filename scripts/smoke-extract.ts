/**
 * One real extraction call on a tiny sample page, to check the live API accepts the schema.
 *   npx tsx --env-file=.env.local scripts/smoke-extract.ts
 * Costs a few cents.
 */
import { extractEvents } from "../lib/engine/extract";
import { estimateCostUsd, llmModel, newUsage } from "../lib/engine/usage";
import { verifyEvent } from "../lib/engine/verify";

const now = new Date();
const d = new Date(now.getTime() + 20 * 86_400_000);
const dateText = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });

const page = {
  url: "https://example.org/carlsbad-chamber/events",
  text: `Carlsbad Chamber of Commerce — Upcoming Events
Women in Business Luncheon: Money Moves After 50
${dateText}, 11:30am–1:00pm, Hilton Garden Inn, 6450 Carlsbad Blvd, Carlsbad, CA
Members $45, guests $55. We're looking for a financial professional to join our panel — contact events@example.org.
Monthly Mixer — every third Thursday (see calendar).
Past events: Holiday Gala 2024 recap.`,
};

async function main() {
  const usage = newUsage();
  const events = await extractEvents(page, "trusted_calendar", now, usage);
  console.log(JSON.stringify(events, null, 2));
  for (const e of events) console.log(e.title, "→", verifyEvent(e, "trusted_calendar", now, "America/Los_Angeles"));
  console.log(`model ${llmModel()} · tokens in ${usage.inputTokens} out ${usage.outputTokens} · ~$${estimateCostUsd(usage).toFixed(4)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
