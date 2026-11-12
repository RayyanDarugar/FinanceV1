import type { EventItem, Organization, Profile } from "@/lib/types";

export const NOW = new Date("2026-11-18T17:00:00Z"); // Wed Nov 18, 9am PT

export function makeProfile(o: Partial<Profile> = {}): Profile {
  return {
    id: "p1",
    displayName: "Test",
    home: { label: "Carlsbad", lat: 33.1581, lng: -117.3506 },
    radiusMiles: 30,
    areaTowns: ["Carlsbad", "Encinitas", "Del Mar", "Solana Beach", "Rancho Santa Fe", "Oceanside", "San Marcos"],
    searchHints: { region: "North County San Diego", metro: "San Diego", audiences: ["women in business", "physicians", "retirees"], topics: ["financial literacy", "retirement planning"] },
    idealClient: "Women 50-75",
    priorities: "speaking first",
    weights: { audienceFit: 0.45, wealth: 0.25, distance: 0.15, cost: 0.15 },
    exclusions: ["CAIS", "LPL Focus"],
    costCeilingUsd: 1000,
    complianceRule: { label: "LPL pre-approval", leadDays: 7, appliesTo: ["speak", "table", "sponsor"] },
    trustedSources: [],
    emailTo: ["a@example.com"],
    emailCc: ["c@example.com"],
    timezone: "America/Los_Angeles",
    ...o,
  };
}

let n = 0;
export function makeEvent(o: Partial<EventItem> = {}): EventItem {
  n++;
  return {
    id: `e${n}`,
    title: `Event ${n}`,
    host: `Host ${n}`,
    orgId: null,
    startsAt: "2026-12-10T18:30:00-08:00",
    endsAt: null,
    venueName: null,
    address: null,
    townText: "Carlsbad",
    lat: null,
    lng: null,
    distanceMiles: 5,
    costUsd: 0,
    sourceUrl: "https://example.com",
    sourceKind: "organizer",
    registerUrl: null,
    contact: null,
    description: "",
    speaking: null,
    suggestedMode: "attend",
    nextStep: "",
    whyGo: "",
    whyFits: "",
    needsPreapproval: false,
    confidence: 0.9,
    subScores: { audienceFit: 7, wealth: 7 },
    score: 50,
    checkedAt: NOW.toISOString(),
    mark: null,
    hideReason: null,
    outcome: null,
    outcomeNote: null,
    ...o,
  };
}

export function makeOrg(o: Partial<Organization> = {}): Organization {
  n++;
  return {
    id: `o${n}`,
    name: `Org ${n}`,
    website: null,
    townText: "Carlsbad",
    lat: null,
    lng: null,
    contact: null,
    whyHer: "",
    status: "following",
    followedAt: "2026-10-01T00:00:00Z",
    lastContactedAt: null,
    suggestedAt: "2026-10-01T00:00:00Z",
    ...o,
  };
}
