/**
 * Creates or updates the single profile row.
 *   npx tsx --env-file=.env.local scripts/seed-profile.ts <passcode>
 * Uses PROFILE_ID and the spec §2 working assumption (lib/fixtures/profile.ts), plus the trusted sources list.
 * Re-running keeps nothing from the old row except what you pass; edit settings afterwards through the change box.
 */
import bcrypt from "bcryptjs";
import { createSupabaseRepo } from "../lib/db/supabaseRepo";
import { makeProfileFixture } from "../lib/fixtures/profile";
import { TRUSTED_SOURCES } from "../lib/engine/trustedSources";

async function main() {
  const passcode = process.argv[2];
  const id = process.env.PROFILE_ID;
  if (!passcode || !id) throw new Error("usage: PROFILE_ID=... seed-profile.ts <passcode>");
  const repo = createSupabaseRepo();
  const existing = await repo.getProfile(id);
  const profile = { ...makeProfileFixture(), ...(existing ?? {}), id, trustedSources: existing?.trustedSources?.length ? existing.trustedSources : TRUSTED_SOURCES };
  await repo.putProfile(profile, await bcrypt.hash(passcode, 10));
  console.log(`Profile ${id} saved (${existing ? "updated" : "created"}), ${profile.trustedSources.length} trusted sources.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
