"use client";

import { OrgCard, SuggestionCard } from "@/components/OrgCard";
import { useAppData, useLoad, useRefresh } from "@/lib/data/DataProvider";

export default function OrgsPage() {
  const data = useAppData();
  const refresh = useRefresh();
  const orgs = useLoad((d) => d.listOrgs());
  if (!orgs) return <p className="px-1 text-muted">Loading…</p>;
  const { following, suggested } = orgs;
  // Groups with something to act on first.
  const sorted = [...following].sort((a, b) => b.nudges.length - a.nudges.length);
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="px-1">
        <h2 className="text-xl font-semibold">Groups to know</h2>
        <p className="text-[14px] text-muted">
          Following {following.length}
          {suggested.length ? ` · ${suggested.length} new suggestion${suggested.length > 1 ? "s" : ""}` : ""}
        </p>
      </div>
      {sorted.map((o) => (
        <OrgCard
          key={o.id}
          org={o}
          href={`/orgs/${o.id}`}
          onContacted={async (id) => {
            await data.markContacted(id);
          }}
        />
      ))}
      {following.length === 0 && (
        <p className="rounded-2xl bg-card p-4 text-muted">You&apos;re not following any groups yet. Follow a suggestion below.</p>
      )}
      {suggested.length > 0 && <h3 className="px-1 pt-4 text-lg font-semibold">New suggestions</h3>}
      {suggested.map((o) => (
        <SuggestionCard
          key={o.id}
          org={o}
          href={`/orgs/${o.id}`}
          onStatus={async (id, status) => {
            await data.setOrgStatus(id, status);
            refresh();
          }}
        />
      ))}
    </div>
  );
}
