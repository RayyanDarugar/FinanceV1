import type { EventItem, Organization, Profile } from "@/lib/types";
import { makeEventFixtures } from "./events";
import { makeOrgFixtures } from "./orgs";
import { makeProfileFixture } from "./profile";

export function makeFixtures(now: Date): { profile: Profile; events: EventItem[]; orgs: Organization[] } {
  return { profile: makeProfileFixture(), events: makeEventFixtures(now), orgs: makeOrgFixtures(now) };
}
