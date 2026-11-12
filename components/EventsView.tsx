"use client";

import { useRouter } from "next/navigation";
import { useAppData, useLoad, useRefresh } from "@/lib/data/DataProvider";
import { EventCard } from "./EventCard";
import { EventDetail } from "./EventDetail";
import type { OnMark } from "./EventActions";

/**
 * Phone: list only (/events) or details only (/events/[id]).
 * Computer (lg+): list on the left, selected (or first) event's details on the right.
 */
export function EventsView({ selectedId }: { selectedId?: string }) {
  const data = useAppData();
  const refresh = useRefresh();
  const router = useRouter();
  const loaded = useLoad(async (d) => ({ profile: await d.getProfile(), events: await d.listEvents() }));
  const selectedFromStore = useLoad(async (d) => (selectedId ? d.getEvent(selectedId) : null), [selectedId]);

  if (!loaded) return <p className="px-1 text-muted">Loading…</p>;
  const { profile, events } = loaded;
  const now = new Date();
  const selected = selectedFromStore ?? events.find((e) => e.id === selectedId) ?? (selectedId ? null : events[0]);

  const onMark: OnMark = async (id, mark, reason) => {
    await data.setMark(id, mark, reason);
    refresh();
    if (mark === "hidden" && id === selectedId) router.push("/events");
  };

  return (
    <div className="lg:grid lg:grid-cols-[400px_1fr] lg:gap-6">
      <section className={selectedId ? "hidden lg:block" : ""}>
        <div className="mb-3 px-1">
          <h2 className="text-xl font-semibold">This week&apos;s picks</h2>
          <p className="text-[14px] text-muted">{events.length} events, best first</p>
        </div>
        <div className="space-y-3 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1">
          {events.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              profile={profile}
              now={now}
              onMark={onMark}
              href={`/events/${e.id}`}
              selected={selected?.id === e.id}
            />
          ))}
          {events.length === 0 && (
            <p className="rounded-2xl bg-card p-4 text-muted">Nothing left this week. New picks arrive Monday.</p>
          )}
        </div>
      </section>
      <section className={selectedId ? "" : "hidden lg:block"}>
        {selected ? (
          <EventDetail event={selected} profile={profile} now={now} onMark={onMark} backHref="/events" />
        ) : (
          selectedId && <p className="text-muted">That event isn&apos;t available anymore.</p>
        )}
      </section>
    </div>
  );
}
