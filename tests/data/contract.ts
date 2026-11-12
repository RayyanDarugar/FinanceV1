import type { AppData } from "@/lib/data/AppData";
import { pendingOutcomes } from "@/lib/domain/outcomes";
import { NOW } from "../helpers/make";

/** Behaviour every AppData implementation (fake prototype, live service) must share. */
export function runAppDataContract(name: string, make: () => Promise<AppData> | AppData) {
  describe(`AppData contract: ${name}`, () => {
    test("hiding an event removes it from listEvents and stores the reason", async () => {
      const data = await make();
      const [first] = await data.listEvents();
      await data.setMark(first.id, "hidden", "too_far");
      expect((await data.listEvents()).some((e) => e.id === first.id)).toBe(false);
      expect((await data.getEvent(first.id))?.hideReason).toBe("too_far");
    });

    test("recordOutcome removes the event from pending", async () => {
      const data = await make();
      const pending = pendingOutcomes(await data.listGoing(), NOW);
      expect(pending.length).toBeGreaterThan(0);
      await data.recordOutcome(pending[0].id, 2, "met two doctors");
      expect(pendingOutcomes(await data.listGoing(), NOW).some((e) => e.id === pending[0].id)).toBe(false);
      expect((await data.getEvent(pending[0].id))?.outcomeNote).toBe("met two doctors");
    });

    test("radius change is proposed in plain words and changes the list once confirmed", async () => {
      const data = await make();
      const before = await data.listEvents();
      expect(before.some((e) => (e.distanceMiles ?? 0) > 20)).toBe(true);
      const proposal = await data.proposeSettingsChange("only show things within 20 miles");
      expect(proposal.unsupported).toBeNull();
      expect(proposal.changes).toEqual([{ field: "radiusMiles", from: "30", to: "20", text: "Radius: 30 → 20 miles" }]);
      await data.confirmSettingsChange(proposal.id);
      expect((await data.listEvents()).every((e) => (e.distanceMiles ?? 0) <= 20)).toBe(true);
      expect((await data.getProfile()).radiusMiles).toBe(20);
    });

    test("confirming the same proposal twice applies it once", async () => {
      const data = await make();
      const proposal = await data.proposeSettingsChange("only show things within 20 miles");
      await data.confirmSettingsChange(proposal.id);
      await data.confirmSettingsChange(proposal.id);
      expect((await data.getProfile()).radiusMiles).toBe(20);
    });

    test("unsupported requests say to text Rayyan", async () => {
      const data = await make();
      const proposal = await data.proposeSettingsChange("change my passcode to 1234");
      expect(proposal.changes).toEqual([]);
      expect(proposal.unsupported).toBe("I can't change that from here. Text Rayyan.");
    });

    test("follow by name moves a suggested org to following", async () => {
      const data = await make();
      const { suggested } = await data.listOrgs();
      const proposal = await data.proposeSettingsChange(`follow ${suggested[0].name}`);
      await data.confirmSettingsChange(proposal.id);
      const after = await data.listOrgs();
      expect(after.following.some((o) => o.id === suggested[0].id)).toBe(true);
    });

    test("the sponsorship over the ceiling and the advisor conference never appear", async () => {
      const data = await make();
      const titles = (await data.listEvents()).map((e) => e.title).join(" | ");
      expect(titles).not.toMatch(/Sponsor/i);
      expect(titles).not.toMatch(/CAIS/);
    });

    test("events tab shows between 5 and 10 events, including both speaking kinds", async () => {
      const data = await make();
      const list = await data.listEvents();
      expect(list.length).toBeGreaterThanOrEqual(5);
      expect(list.length).toBeLessThanOrEqual(10);
      expect(list.some((e) => e.speaking === "asked")).toBe(true);
      expect(list.some((e) => e.speaking === "could_offer")).toBe(true);
    });

    test("followed org hosting an event gets a hosting nudge; contacting clears not_contacted", async () => {
      const data = await make();
      const { following } = await data.listOrgs();
      expect(following.some((o) => o.nudges.some((n) => n.kind === "hosting"))).toBe(true);
      const stale = following.find((o) => o.nudges.some((n) => n.kind === "not_contacted"))!;
      await data.markContacted(stale.id);
      const again = (await data.listOrgs()).following.find((o) => o.id === stale.id)!;
      expect(again.nudges.some((n) => n.kind === "not_contacted")).toBe(false);
    });

    test("getOrg returns the org with its events; unknown ids return null", async () => {
      const data = await make();
      const found = await data.getOrg("org-mcc");
      expect(found?.org.name).toMatch(/Muslim Community Center/);
      expect(found?.events.some((e) => e.id === "ev-mcc-gala")).toBe(true);
      expect(await data.getOrg("nope")).toBeNull();
      expect(await data.getEvent("nope")).toBeNull();
    });

    test("following an org sets followedAt", async () => {
      const data = await make();
      const { suggested } = await data.listOrgs();
      await data.setOrgStatus(suggested[0].id, "following");
      const org = (await data.getOrg(suggested[0].id))!.org;
      expect(org.status).toBe("following");
      expect(org.followedAt).not.toBeNull();
    });
  });
}
