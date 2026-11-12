"use client";

import Link from "next/link";
import { useState } from "react";
import type { OrgWithNudges } from "@/lib/data/AppData";
import type { Nudge } from "@/lib/domain/nudges";
import type { Organization, OrgStatus } from "@/lib/types";

function NudgeStrip({ nudge }: { nudge: Nudge }) {
  const style = nudge.kind === "hosting" ? "bg-blue-soft text-blue" : "bg-clay-soft text-clay";
  return (
    <div className={`mt-3 flex gap-2 rounded-lg px-3 py-2 text-[15px] ${style}`}>
      <span aria-hidden>{nudge.kind === "hosting" ? "📣" : "🕰"}</span>
      <span>{nudge.text}</span>
    </div>
  );
}

const btn = "min-h-11 flex-1 rounded-xl border px-2 text-[15px] font-medium";

export function OrgCard({
  org,
  onContacted,
  href,
}: {
  org: OrgWithNudges;
  onContacted: (id: string) => void;
  href: string;
}) {
  const [contacted, setContacted] = useState(false);
  const nudges = contacted ? org.nudges.filter((n) => n.kind !== "not_contacted") : org.nudges;
  return (
    <article className="rounded-2xl bg-card p-4 shadow-sm">
      <h3 className="text-lg font-semibold leading-snug">
        <Link href={href} className="hover:underline">
          {org.name}
        </Link>
      </h3>
      {org.contact?.role && <p className="text-[15px] text-muted">Contact: {org.contact.role}</p>}
      <p className="mt-2.5 text-[15px] leading-relaxed">
        <span className="font-semibold">Why her: </span>
        {org.whyHer}
      </p>
      {nudges.map((n) => (
        <NudgeStrip key={n.kind} nudge={n} />
      ))}
      {contacted && <p className="mt-2 text-[14px] text-accent">✓ Noted. We&apos;ll remind you again in a couple of months.</p>}
      <Link href={href} className="mt-3 inline-block text-[15px] font-semibold text-accent">
        See contact info &amp; events →
      </Link>
      <div className="mt-3 flex gap-2">
        {org.website ? (
          <a href={org.website} target="_blank" rel="noreferrer" className={`${btn} flex items-center justify-center border-line bg-card`}>
            🌐 Their website
          </a>
        ) : null}
        <button
          onClick={() => {
            setContacted(true);
            onContacted(org.id);
          }}
          className={`${btn} border-accent bg-accent text-white`}
        >
          ✉ I contacted them
        </button>
      </div>
    </article>
  );
}

export function SuggestionCard({
  org,
  onStatus,
  href,
}: {
  org: Organization;
  onStatus: (id: string, status: OrgStatus) => void;
  href: string;
}) {
  return (
    <article className="rounded-2xl bg-card p-4 shadow-sm">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-blue">Suggested for you</p>
      <h3 className="mt-1 text-lg font-semibold leading-snug">
        <Link href={href} className="hover:underline">
          {org.name}
        </Link>
      </h3>
      <p className="mt-1.5 text-[15px] leading-relaxed">{org.whyHer}</p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => onStatus(org.id, "following")} className={`${btn} border-accent bg-accent text-white`}>
          + Follow
        </button>
        <button onClick={() => onStatus(org.id, "not_interested")} className={`${btn} border-line bg-card text-muted`}>
          ✕ Not interested
        </button>
      </div>
    </article>
  );
}

export { NudgeStrip };
