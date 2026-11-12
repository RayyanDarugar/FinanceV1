"use client";

import dynamic from "next/dynamic";
import { useLoad } from "@/lib/data/DataProvider";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <p className="px-1 text-muted">Loading map…</p>,
});

export default function MapPage() {
  const loaded = useLoad(async (d) => ({ profile: await d.getProfile(), events: await d.listEvents() }));
  if (!loaded) return <p className="px-1 text-muted">Loading…</p>;
  return (
    <div>
      <div className="mb-3 px-1">
        <h2 className="text-xl font-semibold">This week&apos;s picks on a map</h2>
        <p className="text-[14px] text-muted">Same list as the Events tab. Tap a pin for details.</p>
      </div>
      <MapView events={loaded.events} profile={loaded.profile} />
    </div>
  );
}
