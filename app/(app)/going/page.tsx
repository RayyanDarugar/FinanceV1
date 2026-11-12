"use client";

import { EventCard } from "@/components/EventCard";
import { OutcomeAsk } from "@/components/OutcomeAsk";
import { useAppData, useLoad, useRefresh } from "@/lib/data/DataProvider";
import { pendingOutcomes } from "@/lib/domain/outcomes";

export default function GoingPage() {
  const data = useAppData();
  const refresh = useRefresh();
  const loaded = useLoad(async (d) => ({ profile: await d.getProfile(), going: await d.listGoing() }));
  if (!loaded) return <p className="px-1 text-muted">Loading…</p>;
  const now = new Date();
  const pending = pendingOutcomes(loaded.going, now);
  const upcoming = loaded.going.filter((e) => Date.parse(e.startsAt) >= now.getTime());

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      {pending.length > 0 && (
        <>
          <h2 className="px-1 text-xl font-semibold">How did it go?</h2>
          {pending.map((e) => (
            <OutcomeAsk
              key={e.id}
              event={e}
              onAnswer={async (n, note) => {
                await data.recordOutcome(e.id, n, note);
                refresh();
              }}
            />
          ))}
        </>
      )}
      <h2 className="px-1 pt-2 text-xl font-semibold">Coming up</h2>
      {upcoming.length === 0 && (
        <p className="rounded-2xl bg-card p-4 text-muted">
          Nothing yet. Tap &quot;✓ I&apos;m going&quot; on an event and it&apos;ll show up here with its deadlines.
        </p>
      )}
      {upcoming.map((e) => (
        <EventCard
          key={e.id}
          event={e}
          profile={loaded.profile}
          now={now}
          href={`/events/${e.id}`}
          onMark={async (id, mark, reason) => {
            await data.setMark(id, mark, reason);
            refresh();
          }}
        />
      ))}
    </div>
  );
}
