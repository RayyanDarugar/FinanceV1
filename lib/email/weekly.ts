import { LOGIN_LINK_TTL, OUTCOME_LINK_TTL, signToken } from "@/lib/auth/tokens";
import { createServiceData } from "@/lib/data/service";
import type { Repo } from "@/lib/db/repo";
import { pendingOutcomes } from "@/lib/domain/outcomes";
import type { Outcome, Profile } from "@/lib/types";
import { composeWeeklyEmail } from "./compose";
import { sendEmail, type EmailMessage } from "./send";

/** The Monday email from the live data, with signed login and outcome links. */
export async function buildWeeklyEmail(repo: Repo, profile: Profile, now: Date, baseUrl: string, secret: string): Promise<EmailMessage> {
  const data = createServiceData({ repo, profileId: profile.id, now: () => now });
  const [ranked, orgs, going] = await Promise.all([data.listEvents(), data.listOrgs(), data.listGoing()]);
  const pending = pendingOutcomes(going, now);
  const open = `${baseUrl}/r/${await signToken({ pid: profile.id, purpose: "login" }, LOGIN_LINK_TTL, secret, now)}`;
  const outcomeLinks = new Map<string, string>();
  for (const e of pending)
    for (const n of [0, 1, 2, 3] as Outcome[])
      outcomeLinks.set(`${e.id}|${n}`, `${baseUrl}/outcome/${await signToken({ pid: profile.id, eventId: e.id, n, purpose: "outcome" }, OUTCOME_LINK_TTL, secret, now)}`);
  const msg = composeWeeklyEmail({
    profile,
    ranked,
    orgsToReach: orgs.following.filter((o) => o.nudges.length > 0),
    pending,
    links: { open, outcome: (id, n) => outcomeLinks.get(`${id}|${n}`)! },
    now,
  });
  return { ...msg, to: profile.emailTo, cc: profile.emailCc };
}

export async function sendWeeklyEmail(repo: Repo, profile: Profile, now: Date): Promise<void> {
  const base = process.env.APP_BASE_URL;
  const secret = process.env.APP_SECRET;
  if (!base || !secret) throw new Error("APP_BASE_URL and APP_SECRET must be set to send the weekly email");
  await sendEmail(await buildWeeklyEmail(repo, profile, now, base.replace(/\/$/, ""), secret));
}
