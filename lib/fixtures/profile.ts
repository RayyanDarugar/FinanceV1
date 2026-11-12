import type { Profile } from "@/lib/types";

/** Spec §2 working assumption. In live mode this lives in the database, not here. */
export function makeProfileFixture(): Profile {
  return {
    id: "demo-profile",
    displayName: "Roohi",
    home: { label: "Carlsbad", lat: 33.1581, lng: -117.3506 },
    radiusMiles: 30,
    areaTowns: [
      "Carlsbad", "Encinitas", "Del Mar", "Solana Beach", "Rancho Santa Fe", "Oceanside", "Vista",
      "San Marcos", "Escondido", "Cardiff", "Leucadia", "Poway", "Rancho Bernardo", "Carmel Valley", "La Jolla",
    ],
    idealClient:
      "Women 50–75: professionals and doctors, pre-retirees and recent retirees, widows, and small business owners, with roughly $250k+ investable.",
    priorities:
      "Speaking opportunities first, then relationships with organizations whose members fit, then wealthy social events, then tabling.",
    weights: { audienceFit: 0.45, wealth: 0.25, distance: 0.15, cost: 0.15 },
    exclusions: ["CAIS", "LPL Focus", "advisor summit", "wealth management conference"],
    costCeilingUsd: 1000,
    complianceRule: { label: "LPL pre-approval", leadDays: 7, appliesTo: ["speak", "table", "sponsor"] },
    trustedSources: [],
    emailTo: ["roohi.darugar@lpl.com", "roohigee@yahoo.com"],
    emailCc: ["rayyandarugar@gmail.com"],
    timezone: "America/Los_Angeles",
  };
}
