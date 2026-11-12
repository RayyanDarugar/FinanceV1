"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLoad } from "@/lib/data/DataProvider";

export function Tabs() {
  const path = usePathname();
  const goingCount = useLoad(async (d) => {
    const t = Date.now();
    return (await d.listGoing()).filter((e) => Date.parse(e.startsAt) >= t).length;
  });
  const tabs = [
    { href: "/events", label: "Events" },
    { href: "/orgs", label: "Organizations" },
    { href: "/map", label: "Map" },
    { href: "/going", label: `I'm going${goingCount ? ` (${goingCount})` : ""}` },
  ];
  return (
    <nav className="flex gap-1 rounded-xl bg-chip p-1" aria-label="Sections">
      {tabs.map((t) => {
        const active = path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-lg px-1 text-center text-[14px] sm:text-[15px] ${
              active ? "bg-card font-semibold text-ink shadow-sm" : "text-muted"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
