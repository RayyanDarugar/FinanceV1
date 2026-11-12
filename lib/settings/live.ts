import "server-only";
import { after } from "next/server";
import type { ServiceDeps } from "@/lib/data/service";
import type { Repo } from "@/lib/db/repo";
import { sendEmail } from "@/lib/email/send";
import { geocode } from "@/lib/engine/geocode";
import { newUsage } from "@/lib/engine/usage";
import { makeLlmProposer } from "./propose";
import { needsRescore, rescoreUpcoming } from "./rescore";

/** Live hooks for the change box: LLM fallback, email Rayyan a copy, re-score in the background when needed. */
export function liveSettingsDeps(repo: Repo, profileId: string): Pick<ServiceDeps, "proposer" | "onSettingsApplied"> {
  return {
    proposer: async (text, p, orgs) =>
      makeLlmProposer({
        geocode: (place) => geocode(null, place, p.home, newUsage(), { repo }),
        newId: () => crypto.randomUUID(),
      })(text, p, orgs),
    onSettingsApplied: async (proposal, before, afterProfile) => {
      const lines = proposal.changes.map((c) => `- ${c.text}`).join("\n");
      after(async () => {
        try {
          await sendEmail({
            to: afterProfile.emailCc,
            cc: [],
            subject: `Settings changed: ${proposal.changes.map((c) => c.text).join("; ").slice(0, 120)}`,
            text: `${afterProfile.displayName} changed Event Finder settings:\n${lines}`,
            html: `<p>${afterProfile.displayName} changed Event Finder settings:</p><ul>${proposal.changes.map((c) => `<li>${c.text.replace(/</g, "&lt;")}</li>`).join("")}</ul>`,
          });
        } catch (e) {
          console.warn("settings email failed", e);
        }
        if (needsRescore(before, afterProfile)) await rescoreUpcoming(repo, profileId, new Date(), 45_000);
      });
    },
  };
}
