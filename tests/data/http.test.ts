import { createHttpData } from "@/lib/data/httpData";
import { dispatch, RPC_METHODS } from "@/lib/data/rpc";
import { createServiceData } from "@/lib/data/service";
import { createMemoryRepo } from "@/lib/db/memoryRepo";
import { makeFixtures } from "@/lib/fixtures";
import { NOW } from "../helpers/make";
import { runAppDataContract } from "./contract";

async function service() {
  const repo = createMemoryRepo();
  const { profile, events, orgs } = makeFixtures(NOW);
  await repo.putProfile(profile, "hash");
  await repo.upsertOrgs(profile.id, orgs);
  await repo.upsertEvents(profile.id, "run0", events.map((e) => ({ ...e, dedupeKey: e.id, raw: {} })));
  return createServiceData({ repo, profileId: profile.id, now: () => NOW });
}

/** fetch stand-in that runs the real dispatcher, including a JSON round-trip like the network would. */
function fakeFetch(svc: Awaited<ReturnType<typeof service>>): typeof fetch {
  return (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    const out = await dispatch(svc, body.method, body.args);
    return new Response(JSON.stringify(out.body), { status: out.status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

runAppDataContract("http client → rpc → service", async () => createHttpData(fakeFetch(await service())));

test("dispatch rejects methods outside AppData", async () => {
  const svc = await service();
  expect((await dispatch(svc, "constructor", [])).status).toBe(400);
  expect((await dispatch(svc, "__proto__", [])).status).toBe(400);
  expect((await dispatch(svc, "listEvents", "nope" as unknown as unknown[])).status).toBe(400);
});

test("RPC_METHODS covers every AppData method", () => {
  expect([...RPC_METHODS].sort()).toEqual(
    [
      "confirmSettingsChange", "getEvent", "getOrg", "getProfile", "listEvents", "listGoing", "listOrgs",
      "markContacted", "proposeSettingsChange", "recordOutcome", "setMark", "setOrgStatus",
    ].sort(),
  );
});

test("http client surfaces server errors", async () => {
  const failing = (async () => new Response(JSON.stringify({ error: "boom" }), { status: 500 })) as unknown as typeof fetch;
  await expect(createHttpData(failing).listEvents()).rejects.toThrow(/boom/);
});
