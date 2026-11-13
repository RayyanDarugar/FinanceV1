import { createServiceData } from "@/lib/data/service";
import { refreshKey } from "@/lib/engine/refresh";
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

test("a proposer message is shown instead of the generic refusal", async () => {
  const { repo, profileId } = await seeded();
  const svc = createServiceData({ repo, profileId, now: () => NOW, proposer: async () => ({ message: "Escondido is already in your towns." }) });
  const proposal = await svc.proposeSettingsChange("add Escondido to my towns");
  expect(proposal).toMatchObject({ changes: [], unsupported: "Escondido is already in your towns." });
});

test("search now: confirming queues today's refresh run, and only once a day", async () => {
  const { repo, profileId } = await seeded();
  const svc = createServiceData({ repo, profileId, now: () => NOW });
  const first = await svc.proposeSettingsChange("search again now");
  expect(first.unsupported).toBeNull();
  await svc.confirmSettingsChange(first.id);
  const tz = (await repo.getProfile(profileId))!.timezone;
  expect((await repo.getRun(profileId, "weekly", refreshKey(NOW, tz)))?.stage).toBe("collect");
  const again = await svc.proposeSettingsChange("search again now");
  expect(again.changes).toEqual([]);
  expect(again.unsupported).toMatch(/already/i);
});
