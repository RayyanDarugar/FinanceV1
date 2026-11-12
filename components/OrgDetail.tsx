"use client";

import Link from "next/link";
import { useAppData, useLoad, useRefresh } from "@/lib/data/DataProvider";
import { formatEventWhen, formatShortInstant } from "@/lib/domain/format";
import { orgNudges } from "@/lib/domain/nudges";
import { NudgeStrip } from "./OrgCard";

export function OrgDetail({ id }: { id: string }) {
  const data = useAppData();
  const refresh = useRefresh();
  const loaded = useLoad(async (d) => ({ found: await d.getOrg(id), profile: await d.getProfile() }), [id]);
  if (!loaded) return <p className="px-1 text-muted">Loading…</p>;
  if (!loaded.found) return <p className="px-1 text-muted">That group isn&apos;t available anymore.</p>;
  const { org, events } = loaded.found;
  const tz = loaded.profile.timezone;
  const now = new Date();
  const nudges = orgNudges(org, events, now, tz);
  const upcoming = events.filter((e) => Date.parse(e.startsAt) >= now.getTime());
  const past = events.filter((e) => Date.parse(e.startsAt) < now.getTime());
  const c = org.contact;

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Link href="/orgs" className="inline-block min-h-11 py-2 text-[15px] font-medium text-accent">
        ← Back to groups
      </Link>
      <header className="px-1">
        <h2 className="text-2xl font-semibold leading-tight">{org.name}</h2>
        {org.townText && <p className="text-[15px] text-muted">{org.townText}</p>}
      </header>
      {nudges.map((n) => (
        <NudgeStrip key={n.kind} nudge={n} />
      ))}
      <section className="rounded-2xl bg-card px-4 py-3.5 shadow-sm">
        <h4 className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-muted">Why her</h4>
        <p className="text-[15px] leading-relaxed">{org.whyHer}</p>
      </section>
      <section className="rounded-2xl bg-card px-4 py-3.5 shadow-sm text-[15px]">
        <h4 className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-muted">Contact</h4>
        {c ? (
          <div className="space-y-0.5">
            <p>{[c.role, c.name].filter(Boolean).join(": ") || "General contact"}</p>
            {c.email && (
              <a href={`mailto:${c.email}`} className="block text-accent underline">
                {c.email}
              </a>
            )}
            {c.phone && (
              <a href={`tel:${c.phone}`} className="block text-accent underline">
                {c.phone}
              </a>
            )}
          </div>
        ) : (
          <p className="text-muted">No public contact found. Try their website.</p>
        )}
        {org.website && (
          <a href={org.website} target="_blank" rel="noreferrer" className="mt-1 block text-accent underline">
            🌐 Their website
          </a>
        )}
        <p className="mt-2 text-muted">
          {org.lastContactedAt
            ? `You last reached out ${formatShortInstant(org.lastContactedAt, tz)}.`
            : "You haven't reached out yet."}
        </p>
      </section>
      <section className="rounded-2xl bg-card px-4 py-3.5 shadow-sm text-[15px]">
        <h4 className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-muted">Their events</h4>
        {upcoming.length === 0 && past.length === 0 && <p className="text-muted">Nothing found yet.</p>}
        {upcoming.map((e) => (
          <Link key={e.id} href={`/events/${e.id}`} className="block py-1 text-accent underline">
            {formatEventWhen(e.startsAt, e.endsAt, tz)}: {e.title}
          </Link>
        ))}
        {past.map((e) => (
          <p key={e.id} className="py-1 text-muted">
            Past · {e.title}
          </p>
        ))}
      </section>
      <div className="flex gap-2 pt-1">
        {org.status === "following" ? (
          <>
            <button
              onClick={async () => {
                await data.markContacted(org.id);
                refresh();
              }}
              className="min-h-11 flex-1 rounded-xl bg-accent font-medium text-white"
            >
              ✉ I contacted them
            </button>
            <button
              onClick={async () => {
                await data.setOrgStatus(org.id, "not_interested");
                refresh();
              }}
              className="min-h-11 rounded-xl border border-line bg-card px-4 text-muted"
            >
              Stop following
            </button>
          </>
        ) : (
          <button
            onClick={async () => {
              await data.setOrgStatus(org.id, "following");
              refresh();
            }}
            className="min-h-11 flex-1 rounded-xl bg-accent font-medium text-white"
          >
            + Follow
          </button>
        )}
      </div>
    </div>
  );
}
