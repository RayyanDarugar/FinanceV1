function parts(iso: string, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(iso));
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  const minute = get("minute");
  const time = `${get("hour")}${minute === "00" ? "" : ":" + minute}`;
  return { day: `${get("weekday")} ${get("month")} ${get("day")}`, time, ampm: get("dayPeriod").toLowerCase() };
}

/** "Thu Dec 10 · 6:30 pm" or "Thu Dec 10 · 6:30–8:30 pm" */
export function formatEventWhen(startsAt: string, endsAt: string | null, tz: string): string {
  const s = parts(startsAt, tz);
  if (!endsAt) return `${s.day} · ${s.time} ${s.ampm}`;
  const e = parts(endsAt, tz);
  if (e.day !== s.day) return `${s.day} · ${s.time} ${s.ampm}`;
  return s.ampm === e.ampm
    ? `${s.day} · ${s.time}–${e.time} ${e.ampm}`
    : `${s.day} · ${s.time} ${s.ampm}–${e.time} ${e.ampm}`;
}

/** "Dec 3" from YYYY-MM-DD */
export function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(
    new Date(date + "T00:00:00Z"),
  );
}

/** "Dec 3" for an instant, in a time zone */
export function formatShortInstant(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric" }).format(new Date(iso));
}

export function formatCost(costUsd: number | null): string {
  if (costUsd === null) return "Cost: check event page";
  if (costUsd === 0) return "Free";
  return `$${costUsd.toLocaleString("en-US")}`;
}
