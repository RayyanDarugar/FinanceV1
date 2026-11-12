"use client";

import Link from "next/link";
import { formatCost, formatEventWhen, formatShortInstant } from "@/lib/domain/format";
import type { EventItem, Mode, Profile } from "@/lib/types";
import { complianceText } from "./ComplianceStrip";
import { EventActions, type OnMark } from "./EventActions";
import { Chip, SpeakingTag } from "./SpeakingTag";

const MODE_LABEL: Record<Mode, string> = {
  speak: "🎤 Speak",
  table: "🪧 Host a table",
  sponsor: "🤝 Sponsor",
  attend: "👋 Attend",
};

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card px-4 py-3.5 shadow-sm">
      <h4 className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-muted">{label}</h4>
      <div className="text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

export function EventDetail({
  event,
  profile,
  now,
  onMark,
  backHref,
}: {
  event: EventItem;
  profile: Profile;
  now: Date;
  onMark: OnMark;
  backHref?: string;
}) {
  const where = [event.venueName, event.address].filter(Boolean).join(", ") || event.townText || "Location on event page";
  const mapsQuery = event.address ?? [event.venueName, event.townText].filter(Boolean).join(" ");
  const compliance = complianceText(event, profile, now);
  return (
    <div className="space-y-3">
      {backHref && (
        <Link href={backHref} className="inline-block min-h-11 py-2 text-[15px] font-medium text-accent lg:hidden">
          ← Back to picks
        </Link>
      )}
      <header>
        <p className="text-[13px] font-semibold uppercase tracking-wide text-gold">
          {formatEventWhen(event.startsAt, event.endsAt, profile.timezone)}
        </p>
        <h2 className="mt-1 text-2xl font-semibold leading-tight">{event.title}</h2>
        <p className="text-[15px] text-muted">{event.host}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <SpeakingTag speaking={event.speaking} />
          <Chip>{formatCost(event.costUsd)}</Chip>
        </div>
        <p className="mt-3 text-[16px] leading-relaxed">
          <span className="font-semibold">Why go: </span>
          {event.whyGo}
        </p>
      </header>

      <Section label="When & where">
        <p>{formatEventWhen(event.startsAt, event.endsAt, profile.timezone)}</p>
        <p>
          {where}
          {event.distanceMiles !== null && <span className="text-muted"> · {Math.round(event.distanceMiles)} mi from you</span>}
        </p>
        {mapsQuery && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(mapsQuery)}`}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent underline"
          >
            Open in Maps
          </a>
        )}
      </Section>

      <Section label="How to take part">
        <p className="font-medium">{MODE_LABEL[event.suggestedMode]}</p>
        {event.nextStep && <p>{event.nextStep}</p>}
      </Section>

      <Section label="Why this fits your clients">
        <p>{event.whyFits}</p>
      </Section>

      <Section label="Register / contact">
        <a href={event.registerUrl ?? event.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-accent underline">
          Event page
        </a>
        {event.contact && (
          <p className="mt-1">
            {[event.contact.role, event.contact.name].filter(Boolean).join(": ")}
            {event.contact.email && (
              <>
                {" · "}
                <a href={`mailto:${event.contact.email}`} className="text-accent underline">
                  {event.contact.email}
                </a>
              </>
            )}
            {event.contact.phone && (
              <>
                {" · "}
                <a href={`tel:${event.contact.phone}`} className="text-accent underline">
                  {event.contact.phone}
                </a>
              </>
            )}
          </p>
        )}
      </Section>

      {event.description && (
        <Section label="About it">
          <p>{event.description}</p>
        </Section>
      )}

      <Section label="Compliance">
        {compliance ? (
          <p className="text-amber">⏱ {compliance}</p>
        ) : (
          <p className="text-muted">No pre-approval needed to attend.</p>
        )}
      </Section>

      <p className="px-1 text-[13px] text-muted">
        ✔ Checked against the event&apos;s page on {formatShortInstant(event.checkedAt, profile.timezone)}
        {event.sourceKind === "listing" && " (found on a listing site)"}
      </p>

      <EventActions event={event} onMark={onMark} />
    </div>
  );
}
