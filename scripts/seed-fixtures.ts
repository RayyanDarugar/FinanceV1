/**
 * Loads the prototype's sample events and orgs into Supabase, to check live mode end to end before the first real run.
 *   npx tsx --env-file=.env.local scripts/seed-fixtures.ts
 * Remove them afterwards with: delete from events where raw->>'fixture' = 'true'; (and the same for organizations' ids 'org-*').
 */
import { createSupabaseRepo } from "../lib/db/supabaseRepo";
import { makeEventFixtures } from "../lib/fixtures/events";
import { makeOrgFixtures } from "../lib/fixtures/orgs";

async function main() {
  const id = process.env.PROFILE_ID;
  if (!id) throw new Error("PROFILE_ID must be set");
  const repo = createSupabaseRepo();
  const now = new Date();
  await repo.upsertOrgs(id, makeOrgFixtures(now));
  await repo.upsertEvents(id, "fixtures", makeEventFixtures(now).map((e) => ({ ...e, dedupeKey: `fixture:${e.id}`, raw: { fixture: true } })));
  console.log("Sample events and orgs loaded.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
