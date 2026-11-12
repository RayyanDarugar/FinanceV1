import Link from "next/link";
import { serverRepo } from "@/lib/data/server";
import { readOutcomeToken } from "@/lib/email/outcome";

export const dynamic = "force-dynamic";

const LABEL = ["no", "1", "2", "3 or more"];

/** Confirm page for a one-tap answer from the email. Viewing it never records anything (link scanners open every link). */
export default async function OutcomePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { token } = await params;
  const { saved } = await searchParams;
  const secret = process.env.APP_SECRET;
  const info = secret ? await readOutcomeToken(serverRepo(), token, secret) : ({ ok: false, message: "Not available." } as const);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">How did it go?</h1>
      {!info.ok ? (
        <p className="mt-3 rounded-lg bg-amber-soft px-3 py-2 text-amber">{info.message}</p>
      ) : saved ? (
        <>
          <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-accent">
            ✓ Saved: {LABEL[info.n]} good conversation{info.n === 1 ? "" : "s"} at {info.title}. Thank you!
          </p>
          <Link href="/events" className="mt-4 text-center font-medium text-accent underline">
            Open this week&apos;s picks
          </Link>
        </>
      ) : (
        <form action="/api/outcome" method="post" className="mt-4 space-y-3">
          <p className="text-[17px]">
            Record <strong>{LABEL[info.n]}</strong> good conversation{info.n === 1 ? "" : "s"} at <strong>{info.title}</strong>?
          </p>
          <input type="hidden" name="token" value={token} />
          <label htmlFor="note" className="block text-[14px] text-muted">
            Anything to remember? (optional)
          </label>
          <input id="note" name="note" className="min-h-11 w-full rounded-lg border border-line bg-card px-3 text-[16px]" placeholder="e.g. Met Dr. Patel, wants to talk in January" />
          <button className="min-h-12 w-full rounded-xl bg-accent text-lg font-medium text-white">Yes, record it</button>
          {info.already !== null && <p className="text-[13px] text-muted">You answered before; this will replace it.</p>}
        </form>
      )}
    </main>
  );
}
