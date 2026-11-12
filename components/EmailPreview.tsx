"use client";

import Link from "next/link";
import { useLoad } from "@/lib/data/DataProvider";
import { pendingOutcomes } from "@/lib/domain/outcomes";
import { composeWeeklyEmail } from "@/lib/email/compose";

/** Renders the Monday email from the current data, exactly as it would be sent. */
export function EmailPreview() {
  const email = useLoad(async (d) => {
    const now = new Date();
    const [profile, ranked, orgs, going] = await Promise.all([d.getProfile(), d.listEvents(), d.listOrgs(), d.listGoing()]);
    const orgsToReach = orgs.following.filter((o) => o.nudges.length > 0);
    const origin = window.location.origin;
    const msg = composeWeeklyEmail({
      profile,
      ranked,
      orgsToReach,
      pending: pendingOutcomes(going, now),
      links: { open: `${origin}/events`, outcome: () => `${origin}/going` },
      now,
    });
    return { ...msg, to: profile.emailTo, cc: profile.emailCc };
  });
  if (!email) return <p className="p-6 text-muted">Loading…</p>;
  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <Link href="/events" className="inline-block min-h-11 py-2 text-[15px] font-medium text-accent">
        ← Back to the app
      </Link>
      <div className="rounded-2xl bg-card p-4 text-[14px] shadow-sm">
        <p>
          <span className="text-muted">Subject:</span> <strong>{email.subject}</strong>
        </p>
        <p>
          <span className="text-muted">To:</span> {email.to.join(", ")}
        </p>
        <p>
          <span className="text-muted">Cc:</span> {email.cc.join(", ")}
        </p>
        <p className="mt-1 text-[13px] text-muted">
          Preview from the current sample data. In the prototype, the email&apos;s buttons open the app instead of recording answers.
        </p>
      </div>
      <iframe title="Monday email" srcDoc={email.html} className="h-[80vh] w-full rounded-2xl border border-line bg-white" />
    </main>
  );
}
