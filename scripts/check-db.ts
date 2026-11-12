/**
 * Lists which tables exist in Supabase.
 *   npx tsx --env-file=.env.local scripts/check-db.ts
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  for (const t of ["profiles", "events", "organizations", "settings_changes", "geocode_cache", "runs", "run_pages"]) {
    const r = await db.from(t).select("*").limit(1);
    console.log(t, r.error ? `MISSING (${r.error.message.slice(0, 80)})` : `ok (${r.data?.length ?? 0}+ rows)`);
  }
}

main();
