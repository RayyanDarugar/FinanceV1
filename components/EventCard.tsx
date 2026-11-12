"use client";

import Link from "next/link";
import { formatCost, formatEventWhen } from "@/lib/domain/format";
import type { EventItem, Profile } from "@/lib/types";
import { ComplianceStrip } from "./ComplianceStrip";
import { EventActions, type OnMark } from "./EventActions";
import { Chip, SpeakingTag } from "./SpeakingTag";

export function EventCard({
  event,
  profile,
  now,
  onMark,
  href,
  selected = false,
}: {
  event: EventItem;
  profile: Profile;
  now: Date;
  onMark: OnMark;
  href: string;
  selected?: boolean;
}) {
  const distance = event.distanceMiles !== null ? ` · ${Math.round(event.distanceMiles)} mi` : "";
  return (
    <article className={`rounded-2xl bg-card p-4 shadow-sm ${selected ? "lg:ring-2 lg:ring-accent" : ""}`}>
      <p className="text-[13px] font-semibold uppercase tracking-wide text-gold">
        {formatEventWhen(event.startsAt, event.endsAt, profile.timezone)}
      </p>
      <h3 className="mt-1 text-lg font-semibold leading-snug">
        <Link href={href} className="hover:underline">
          {event.title}
        </Link>
      </h3>
      <p className="text-[15px] text-muted">
        {event.host}
        {distance}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <SpeakingTag speaking={event.speaking} />
        <Chip>{formatCost(event.costUsd)}</Chip>
        {event.mark === "going" && <Chip>✓ Going</Chip>}
      </div>
      <p className="mt-3 text-[15px] leading-relaxed">
        <span className="font-semibold">Why go: </span>
        {event.whyGo}
      </p>
      <ComplianceStrip event={event} profile={profile} now={now} />
      <Link href={href} className="mt-3 inline-block min-h-6 text-[15px] font-semibold text-accent">
        See full details →
      </Link>
      <EventActions event={event} onMark={onMark} />
    </article>
  );
}
