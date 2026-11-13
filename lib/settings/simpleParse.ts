import type { Organization, Profile } from "@/lib/types";
import type { ParsedChange } from "./types";

export const SEARCH_NOW_TEXT = "Search for new events now (new picks in about 20 minutes)";

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

/** Fast, free path for the most common requests. Anything else goes to the LLM (live) or "Text Rayyan" (prototype). */
export function simpleParse(text: string, p: Profile, orgs: Organization[]): ParsedChange | null {
  const t = text.trim();
  if (/^(please\s+)?(search|look|check)\b.*\b(again|now|today)\b/i.test(t) || /^re-?search\b/i.test(t)) {
    return { changes: [{ field: "search_now", from: "", to: "now", text: SEARCH_NOW_TEXT }], apply: [{ kind: "search_now" }] };
  }
  const radius = t.match(/within\s+(\d+)\s*mi/i);
  if (radius) {
    const to = Number(radius[1]);
    if (to < 1 || to > 100) return null;
    return {
      changes: [{ field: "radiusMiles", from: String(p.radiusMiles), to: String(to), text: `Radius: ${p.radiusMiles} → ${to} miles` }],
      apply: [{ kind: "profile", patch: { radiusMiles: to } }],
    };
  }
  const cost = t.match(/(?:under|below|less than|max(?:imum)?)\s*\$?\s*([\d,]+)/i);
  if (cost) {
    const to = Number(cost[1].replace(/,/g, ""));
    if (!(to >= 0 && to <= 100_000)) return null;
    return {
      changes: [{ field: "costCeilingUsd", from: String(p.costCeilingUsd), to: String(to), text: `Cost limit: ${money(p.costCeilingUsd)} → ${money(to)}` }],
      apply: [{ kind: "profile", patch: { costCeilingUsd: to } }],
    };
  }
  const follow = t.match(/^(un)?follow\s+(?:the\s+)?(.+)$/i);
  if (follow) {
    const name = follow[2].trim().toLowerCase();
    const org = orgs.find((o) => o.name.toLowerCase().includes(name));
    if (!org) return null;
    const status = follow[1] ? "not_interested" : "following";
    return {
      changes: [{ field: "follow_org", from: org.status, to: status, text: `${follow[1] ? "Stop following" : "Follow"}: ${org.name}` }],
      apply: [{ kind: "org_status", orgId: org.id, status }],
    };
  }
  return null;
}
