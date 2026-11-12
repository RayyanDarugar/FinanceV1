import { z } from "zod";
import type { SettingsChange } from "@/lib/data/AppData";
import { nameKey } from "@/lib/db/repo";
import type { LatLng } from "@/lib/domain/geo";
import { callJson as realCallJson } from "@/lib/engine/llm";
import { newUsage, type Usage } from "@/lib/engine/usage";
import type { Organization, Profile } from "@/lib/types";
import { simpleParse } from "./simpleParse";
import type { ParsedChange, Proposer, SettingsPatch } from "./types";

/** What she may change herself. Everything else (recipients, passcode, schedule) is Rayyan-only. */
const FIELDS = [
  "radiusMiles", "costCeilingUsd", "idealClient", "priorities", "areaTowns", "addExclusion", "removeExclusion",
  "weights", "leadDays", "addTrustedSource", "home", "followOrg", "unfollowOrg",
] as const;
type Field = (typeof FIELDS)[number];

const LlmSchema = z.object({
  changes: z.array(z.object({ field: z.enum(FIELDS), value: z.string() })),
  unsupported: z.string().nullable(),
});

const VALIDATORS: Record<Field, z.ZodType> = {
  radiusMiles: z.number().int().min(1).max(100),
  costCeilingUsd: z.number().min(0).max(100_000),
  idealClient: z.string().min(10).max(1000),
  priorities: z.string().min(5).max(1000),
  areaTowns: z.array(z.string().min(2)).min(1).max(40),
  addExclusion: z.string().min(2).max(100),
  removeExclusion: z.string().min(2).max(100),
  weights: z
    .object({ audienceFit: z.number().min(0), wealth: z.number().min(0), distance: z.number().min(0), cost: z.number().min(0) })
    .refine((w) => Math.abs(w.audienceFit + w.wealth + w.distance + w.cost - 1) <= 0.01, "weights must sum to 1"),
  leadDays: z.number().int().min(0).max(60),
  addTrustedSource: z.object({ name: z.string().min(2), url: z.string().url() }),
  home: z.string().min(2).max(100),
  followOrg: z.string().min(2).max(150),
  unfollowOrg: z.string().min(2).max(150),
};

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const short = (s: string) => (s.length > 80 ? `${s.slice(0, 77)}…` : s);

const SYSTEM = `You turn a short request from a non-technical user into changes to their event-finder settings.
Allowed fields and the JSON "value" each takes (value is always a JSON-encoded string):
- radiusMiles: number 1–100
- costCeilingUsd: number (max ticket price to show)
- idealClient: string — the full new description of the clients they want to meet (rewrite the current one with the change applied)
- priorities: string — the full new priorities text
- areaTowns: array of town names (the full new list)
- addExclusion / removeExclusion: string — a kind of event to never show / stop excluding
- weights: object {audienceFit, wealth, distance, cost} summing to 1
- leadDays: integer — days of compliance pre-approval needed
- addTrustedSource: {name, url} — an events calendar page to check weekly
- home: string — the town/place their search is centered on
- followOrg / unfollowOrg: string — an organization's name
If the request asks for anything else (passcode, email recipients, schedule, deleting data, anything unclear), return no changes and put a few words in "unsupported". Never guess.`;

export interface ProposerDeps {
  callJson?: typeof realCallJson;
  geocode: (place: string) => Promise<LatLng | null>;
  newId: () => string;
  usage?: Usage;
}

async function toChange(field: Field, value: unknown, p: Profile, orgs: Organization[], deps: ProposerDeps): Promise<ParsedChange | null> {
  const ok = VALIDATORS[field].safeParse(value);
  if (!ok.success) return null;
  const v = ok.data as never;
  const one = (c: SettingsChange, apply: SettingsPatch): ParsedChange => ({ changes: [c], apply: [apply] });
  switch (field) {
    case "radiusMiles":
      return one({ field, from: String(p.radiusMiles), to: String(v), text: `Radius: ${p.radiusMiles} → ${v} miles` }, { kind: "profile", patch: { radiusMiles: v } });
    case "costCeilingUsd":
      return one({ field, from: String(p.costCeilingUsd), to: String(v), text: `Cost limit: ${money(p.costCeilingUsd)} → ${money(v)}` }, { kind: "profile", patch: { costCeilingUsd: v } });
    case "idealClient":
      return one({ field, from: p.idealClient, to: v, text: `Ideal client: “${short(v)}”` }, { kind: "profile", patch: { idealClient: v } });
    case "priorities":
      return one({ field, from: p.priorities, to: v, text: `Priorities: “${short(v)}”` }, { kind: "profile", patch: { priorities: v } });
    case "areaTowns":
      return one({ field, from: p.areaTowns.join(", "), to: (v as string[]).join(", "), text: `Towns: ${(v as string[]).join(", ")}` }, { kind: "profile", patch: { areaTowns: v } });
    case "addExclusion":
      return one({ field: "exclusions", from: p.exclusions.join(", "), to: v, text: `Never show: ${v}` }, { kind: "profile", patch: { exclusions: [...p.exclusions, v] } });
    case "removeExclusion": {
      const rest = p.exclusions.filter((x) => nameKey(x) !== nameKey(v));
      if (rest.length === p.exclusions.length) return null;
      return one({ field: "exclusions", from: p.exclusions.join(", "), to: rest.join(", "), text: `Stop hiding: ${v}` }, { kind: "profile", patch: { exclusions: rest } });
    }
    case "weights": {
      const w = v as Profile["weights"];
      const pct = (n: number) => `${Math.round(n * 100)}%`;
      return one(
        { field, from: JSON.stringify(p.weights), to: JSON.stringify(w), text: `Weighting: audience ${pct(w.audienceFit)}, wealth ${pct(w.wealth)}, distance ${pct(w.distance)}, cost ${pct(w.cost)}` },
        { kind: "profile", patch: { weights: w } },
      );
    }
    case "leadDays":
      return one(
        { field, from: String(p.complianceRule.leadDays), to: String(v), text: `${p.complianceRule.label} lead time: ${p.complianceRule.leadDays} → ${v} days` },
        { kind: "profile", patch: { complianceRule: { ...p.complianceRule, leadDays: v } } },
      );
    case "addTrustedSource": {
      const s = v as { name: string; url: string };
      return one({ field: "trustedSources", from: "", to: s.url, text: `Also check weekly: ${s.name}` }, { kind: "profile", patch: { trustedSources: [...p.trustedSources, s] } });
    }
    case "home": {
      const hit = await deps.geocode(v);
      if (!hit) return null;
      return one({ field, from: p.home.label, to: v, text: `Home base: ${p.home.label} → ${v}` }, { kind: "profile", patch: { home: { label: v, ...hit } } });
    }
    case "followOrg":
    case "unfollowOrg": {
      const follow = field === "followOrg";
      const found = orgs.find((o) => nameKey(o.name).includes(nameKey(v)) || nameKey(v).includes(nameKey(o.name)));
      if (found) {
        const status = follow ? "following" : "not_interested";
        return one({ field: "follow_org", from: found.status, to: status, text: `${follow ? "Follow" : "Stop following"}: ${found.name}` }, { kind: "org_status", orgId: found.id, status });
      }
      if (!follow) return null;
      const org: Organization = {
        id: deps.newId(), name: v, website: null, townText: null, lat: null, lng: null, contact: null, whyHer: "Added by you",
        status: "following", followedAt: new Date().toISOString(), lastContactedAt: null, suggestedAt: new Date().toISOString(),
      };
      return one({ field: "follow_org", from: "", to: "following", text: `Follow: ${v} (new)` }, { kind: "org_create", org });
    }
  }
}

/** Free parser first; otherwise one LLM call restricted to the allowed fields, each value validated. */
export function makeLlmProposer(deps: ProposerDeps): Proposer {
  const callJson = deps.callJson ?? realCallJson;
  return async (text, p, orgs) => {
    const quick = simpleParse(text, p, orgs);
    if (quick) return quick;
    const current = { radiusMiles: p.radiusMiles, costCeilingUsd: p.costCeilingUsd, idealClient: p.idealClient, priorities: p.priorities, areaTowns: p.areaTowns, exclusions: p.exclusions, weights: p.weights, leadDays: p.complianceRule.leadDays, home: p.home.label };
    const out = await callJson(
      { system: SYSTEM, user: `Current settings: ${JSON.stringify(current)}\nKnown organizations: ${orgs.map((o) => o.name).join("; ")}\n\nRequest: ${text}`, schema: LlmSchema, maxTokens: 2000, effort: "low" },
      deps.usage ?? newUsage(),
    );
    if (!out || out.unsupported || !out.changes.length) return null;
    const merged: ParsedChange = { changes: [], apply: [] };
    for (const c of out.changes) {
      let value: unknown;
      try {
        value = JSON.parse(c.value);
      } catch {
        value = c.value;
      }
      const one = await toChange(c.field, value, p, orgs, deps);
      if (!one) return null; // all or nothing: never apply half of what she asked
      merged.changes.push(...one.changes);
      merged.apply.push(...one.apply);
    }
    return merged;
  };
}
