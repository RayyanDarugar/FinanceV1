import { createServiceData } from "@/lib/data/service";
import { createMemoryRepo } from "@/lib/db/memoryRepo";
import { makeFixtures } from "@/lib/fixtures";
import { NOW } from "../helpers/make";
import { runAppDataContract } from "./contract";

async function seeded() {
  const repo = createMemoryRepo();
  const { profile, events, orgs } = makeFixtures(NOW);
  await repo.putProfile(profile, "hash");
  await repo.upsertOrgs(profile.id, orgs);
  await repo.upsertEvents(profile.id, "run0", events.map((e) => ({ ...e, dedupeKey: e.id, raw: {} })));
  return { repo, profileId: profile.id };
}

runAppDataContract("live service over memory repo", async () => {
  const { repo, profileId } = await seeded();
  return createServiceData({ repo, profileId, now: () => NOW });
});
