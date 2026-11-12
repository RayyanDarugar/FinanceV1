import { createMemoryRepo } from "@/lib/db/memoryRepo";
import type { Repo } from "@/lib/db/repo";
import { makeEvent, makeOrg, makeProfile, NOW } from "../helpers/make";

/** Repo contract. Runs on the memory repo always, and on Supabase when SUPABASE_URL is set. */
function repoContract(name: string, make: () => Promise<Repo>) {
  describe(`Repo contract: ${name}`, () => {
    test("upserting the same dedupe_key twice yields one row and keeps the mark", async () => {
      const repo = await make();
      const p = makeProfile();
      await repo.putProfile(p, "hash");
      const e = makeEvent({ title: "Gala" });
      await repo.upsertEvents(p.id, "r1", [{ ...e, dedupeKey: "k1", raw: {} }]);
      const [stored] = await repo.listEvents(p.id);
      await repo.setMark(stored.id, "going", null);
      await repo.upsertEvents(p.id, "r2", [{ ...makeEvent({ title: "Gala (updated)" }), dedupeKey: "k1", raw: {} }]);
      const all = await repo.listEvents(p.id);
      expect(all).toHaveLength(1);
      expect(all[0].mark).toBe("going");
      expect(all[0].title).toBe("Gala (updated)");
      expect(all[0].id).toBe(stored.id);
    });

    test("hidden events keep their reason through a re-find", async () => {
      const repo = await make();
      const p = makeProfile();
      await repo.putProfile(p, "hash");
      await repo.upsertEvents(p.id, "r1", [{ ...makeEvent(), dedupeKey: "k", raw: {} }]);
      const [e] = await repo.listEvents(p.id);
      await repo.setMark(e.id, "hidden", "too_far");
      await repo.upsertEvents(p.id, "r2", [{ ...makeEvent(), dedupeKey: "k", raw: {} }]);
      const [again] = await repo.listEvents(p.id);
      expect(again.mark).toBe("hidden");
      expect(again.hideReason).toBe("too_far");
    });

    test("markContacted sets lastContactedAt; orgs are unique by name", async () => {
      const repo = await make();
      const p = makeProfile();
      await repo.putProfile(p, "hash");
      await repo.upsertOrgs(p.id, [makeOrg({ name: "Del Mar Rotary" })]);
      await repo.upsertOrgs(p.id, [makeOrg({ name: "del mar rotary", whyHer: "updated" })]);
      const orgs = await repo.listOrgs(p.id);
      expect(orgs).toHaveLength(1);
      await repo.markContacted(orgs[0].id, NOW);
      expect((await repo.getOrg(orgs[0].id))?.lastContactedAt).toBe(NOW.toISOString());
    });

    test("profile round-trips with passcode hash; updateProfile patches", async () => {
      const repo = await make();
      const p = makeProfile();
      await repo.putProfile(p, "h1");
      await repo.updateProfile(p.id, { radiusMiles: 12 });
      expect((await repo.getProfile(p.id))?.radiusMiles).toBe(12);
      expect(await repo.getPasscodeHash(p.id)).toBe("h1");
    });

    test("settings proposals are stored and applied once", async () => {
      const repo = await make();
      const p = makeProfile();
      await repo.putProfile(p, "h");
      await repo.saveProposal(p.id, { id: "pr1", changes: [], unsupported: null }, [{ kind: "profile", patch: { radiusMiles: 5 } }]);
      expect(await repo.takeProposal(p.id, "pr1")).not.toBeNull();
      expect(await repo.takeProposal(p.id, "pr1")).toBeNull();
    });
  });
}

repoContract("memory", async () => createMemoryRepo());

if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  repoContract("supabase", async () => {
    const { createSupabaseRepo } = await import("@/lib/db/supabaseRepo");
    return createSupabaseRepo();
  });
}
