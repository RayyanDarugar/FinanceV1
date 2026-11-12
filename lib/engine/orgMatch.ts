import { nameKey } from "@/lib/db/repo";
import type { Organization } from "@/lib/types";

const GENERIC = /\b(the|club|inc|of|organization|association|society|chapter|foundation)\b/g;
const core = (s: string) => nameKey(s).replace(/[^a-z0-9 ]/g, " ").replace(GENERIC, " ").replace(/\s+/g, " ").trim();

/** Links an event host to a known org: "Del Mar Rotary Club" → "Del Mar Rotary". Followed orgs win ties. */
export function matchOrgId(host: string, orgs: Organization[]): string | null {
  const h = core(host);
  if (!h) return null;
  const hits = orgs.filter((o) => {
    const c = core(o.name);
    // The host may name the org with extra words ("… Club"); a shorter host must still be 2+ words ("Rotary" alone is too vague).
    return c.length >= 4 && (h === c || h.includes(c) || (h.split(" ").length >= 2 && c.includes(h)));
  });
  hits.sort((a, b) => Number(b.status === "following") - Number(a.status === "following") || core(b.name).length - core(a.name).length);
  return hits[0]?.id ?? null;
}
