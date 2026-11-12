import { addDays, localDate } from "@/lib/domain/dates";

const TZ = "America/Los_Angeles";

/** ISO instant for a wall-clock time in Pacific time, `days` calendar days from `now`. */
export function ptAt(now: Date, days: number, hour: number, minute = 0): string {
  const date = addDays(localDate(now, TZ), days);
  for (const offset of [-8, -7]) {
    const sign = offset < 0 ? "-" : "+";
    const iso = `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${sign}0${Math.abs(offset)}:00`;
    const h = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(new Date(iso)),
    );
    if (h === hour) return iso;
  }
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-08:00`;
}

export function daysAgoIso(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}
