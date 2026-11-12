"use client";

import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { formatCost, formatEventWhen } from "@/lib/domain/format";
import type { EventItem, Profile } from "@/lib/types";

export default function MapView({ events, profile }: { events: EventItem[]; profile: Profile }) {
  const pinned = events.filter((e) => e.lat !== null && e.lng !== null);
  return (
    <div className="space-y-2">
      <div className="h-[65vh] min-h-[360px] overflow-hidden rounded-2xl shadow-sm">
        <MapContainer center={[profile.home.lat, profile.home.lng]} zoom={10} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <CircleMarker
            center={[profile.home.lat, profile.home.lng]}
            radius={8}
            pathOptions={{ color: "#294a73", fillColor: "#294a73", fillOpacity: 0.9 }}
          >
            <Popup>Home base: {profile.home.label}</Popup>
          </CircleMarker>
          {pinned.map((e) => (
            <CircleMarker
              key={e.id}
              center={[e.lat!, e.lng!]}
              radius={e.speaking === "asked" ? 13 : 10}
              pathOptions={{
                color: "#2f5d34",
                fillColor: e.speaking ? "#2f5d34" : "#8fb394",
                fillOpacity: 0.85,
                weight: 2,
              }}
            >
              <Popup>
                <div style={{ fontSize: 14, lineHeight: 1.4 }}>
                  <strong>{e.title}</strong>
                  <br />
                  {formatEventWhen(e.startsAt, e.endsAt, profile.timezone)}
                  <br />
                  {e.host} · {formatCost(e.costUsd)}
                  <br />
                  <Link href={`/events/${e.id}`}>See details →</Link>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <p className="px-1 text-[13px] text-muted">
        Dark green = speaking chance (bigger if they&apos;re asking) · light green = attend · blue = home base.
        {pinned.length < events.length && ` ${events.length - pinned.length} event(s) have no exact location and aren't pinned.`}
      </p>
    </div>
  );
}
