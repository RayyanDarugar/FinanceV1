# Event Finder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A passcode-protected, phone-first web app that finds and scores local events and organizations for one advisor each week, emails her a short list, and records what she does with it.

**Architecture:** One Next.js (App Router) app on Vercel Hobby. Every screen reads and writes through one `AppData` interface. Milestone 1 implements it with fake, in-browser data so Rayyan can click through a working prototype. Milestone 2 swaps in a Supabase-backed implementation. The weekly engine lives in `lib/engine/` with no UI imports. It runs as a saved, staged run that cron-jobs.org advances one small batch per call.

**Tech Stack:** Next.js 15 + TypeScript, Tailwind CSS, Vitest + Testing Library, Supabase (Postgres, `@supabase/supabase-js`), Anthropic SDK (`@anthropic-ai/sdk`, model `claude-sonnet-5-5`), Tavily search API (plain `fetch`), Nominatim geocoding, react-leaflet + OpenStreetMap tiles, nodemailer (Gmail SMTP) / Resend, zod.

**Spec:** `docs/superpowers/specs/2026-11-12-event-finder-design.md`. Read it before starting any task.

## Global Constraints

- Time zone for every date the user sees, every deadline and the Monday window: `America/Los_Angeles`.
- Events window: next **56 days** (8 weeks) from the run date.
- Events tab shows **5–10** events. Email shows the **top 3**.
- Cost ceiling default **$1,000**. Events over the ceiling are excluded before scoring. Unknown cost is allowed.
- Compliance rule default: label `"LPL pre-approval"`, `leadDays: 7`, applies to modes `speak`, `table`, `sponsor`. Submit-by date = event start date − leadDays.
- Speaking signals: `"asked"` → card label **"They're asking for speakers"** (🎤, +25 points). `"could_offer"` → **"You could offer to speak"** (💡, +10 points). Never claim organizers need a speaker unless `speaking === "asked"`.
- Hide reasons (exact copy): *Too far · Wrong crowd · Too expensive · Bad timing · Not my kind of event*.
- Event buttons (exact copy): **☆ Save for later · ✓ I'm going · ✕ Hide**. Organization buttons: **🌐 Their website · ✉ I contacted them**. Suggestions: **+ Follow · ✕ Not interested**.
- Outcome choices: **0 · 1 · 2 · 3+**, stored as `0 | 1 | 2 | 3`.
- Email recipients: to `roohi.darugar@lpl.com`, `roohigee@yahoo.com`; cc `rayyandarugar@gmail.com`. These live in the profile record, never in code.
- Neutral naming in code: `profile`, `audience`, `complianceRule`. No `advisor` or `lpl` in identifiers. "LPL" appears only in seeded profile data.
- No client data, no LPL systems, no automated outreach or registration.
- Monthly Tavily use under **1,000 credits**: at most **40 basic searches per weekly run**.
- Every engine endpoint is safe to call repeatedly and requires header `x-run-secret: $RUN_SECRET`.
- Each API route invocation must finish in under **50 s** (`export const maxDuration = 60`).
- Geocoding requests send `User-Agent: EventFinder/1.0` and wait at least 1 s between calls. Never put a personal email in requests.
- Visual polish is out of scope: clean, calm, large readable text (base 16px+), tap targets ≥ 44px.

## Review Focus

1. **Time zones and deadlines.** An event at 6:30 pm PT on Dec 10 must show "submit by Dec 3" in PT, even when the server runs in UTC. A deadline that has passed must say so ("Deadline passed Dec 3"), not show negative days. *Test in Task 2.*
2. **Events with missing pieces** (no cost, no end time, address that won't geocode). The card still renders: "Cost: check event page", no distance line. Ranking keeps the event only if its text location names a town in the area list. *Tests in Tasks 3 and 11.*
3. **Repeated or overlapping cron calls.** Two `/api/run/advance` calls at once, or calls after the run is done, must not double-process a batch, create duplicate events or send a second email. *Test in Task 14.*
4. **Email link scanners.** LPL's scanner opens every link. A GET on an outcome link must never record an answer, and an expired login token must show a friendly "enter your passcode" page, not an error. *Tests in Tasks 7 and 16.*
5. **Stale and past events from search.** Pages from last year, events already past, or a year that has to be guessed must be dropped or marked low confidence, never ranked as current. Malformed LLM output for one page skips that page, and the run continues. *Tests in Tasks 11 and 12.*

---

## File Structure

```
app/
  layout.tsx                      root html, fonts, DataProvider
  login/page.tsx                  passcode screen
  (app)/layout.tsx                header, tabs, ChangeBox; guarded by middleware
  (app)/events/page.tsx           ranked list (+ desktop split view)
  (app)/events/[id]/page.tsx      event details (mobile)
  (app)/orgs/page.tsx             following + suggestions
  (app)/orgs/[id]/page.tsx        organization details
  (app)/map/page.tsx              map of listed events
  (app)/going/page.tsx            going list + outcome asks
  r/[token]/route.ts              email login link → cookie → /events
  outcome/[token]/page.tsx        confirm page for one-tap outcome
  preview/email/page.tsx          renders weekly email from current data (Rayyan only)
  api/...                         see Tasks 8, 14, 16, 17
components/                       EventCard, EventDetail, HideReasons, SpeakingTag, ComplianceStrip,
                                  OrgCard, OrgDetail, Tabs, ChangeBox, OutcomeAsk, MapView
lib/types.ts                      all domain types (Task 2)
lib/domain/                       pure logic: compliance, rank, nudges, outcomes, geo, format
lib/fixtures/                     makeFixtures(now) for prototype + tests
lib/data/                         AppData interface, fakeData, httpData, DataProvider
lib/auth/                         passcode, signed tokens
lib/db/                           supabase client, repo
lib/engine/                       NO UI imports: llm, search, fetchPage, sources, extract, verify,
                                  geocode, dedupe, score, feedback, orgs, run, usage
lib/email/                        compose, send
lib/settings/                     allowed fields, propose, apply
middleware.ts
supabase/migrations/0001_init.sql, supabase/seed.sql
tests/                            mirrors lib/ (tests/domain, tests/engine, ...)
```

---

# Milestone 1: Clickable prototype (fake data)

Goal: Rayyan can open a Vercel preview URL on his phone and computer, enter a passcode and use every screen as if it were real. Clicks persist in the browser. No database, no LLM, no search.

### Task 1: Project scaffold

**Files:**
- Create: Next.js app at repo root, `vitest.config.ts`, `tests/setup.ts`, `.gitignore`, `.env.example`, `README.md`

- [ ] **Step 1:** `git init -b main`, then `npx create-next-app@15 . --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*"` (keep the existing `docs/` and `.superpowers/`).
- [ ] **Step 2:** Add `.superpowers/` and `.env*.local` to `.gitignore`.
- [ ] **Step 3:** Install dev deps `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event` and add `"test": "vitest run"` to package.json. Set `test.environment = "jsdom"` and `TZ=UTC` in `vitest.config.ts` (so time zone bugs show up in tests).
- [ ] **Step 4:** Write `.env.example` listing: `NEXT_PUBLIC_DATA_MODE=fake|live`, `DEMO_PASSCODE`, `APP_SECRET`, `RUN_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `EMAIL_PROVIDER=gmail|resend`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL`.
- [ ] **Step 5:** Run `npm run build && npm test`. Expected: build succeeds, and vitest reports "No test files found" without crashing (add `passWithNoTests: true`).
- [ ] **Step 6:** Commit `chore: scaffold next app`.

### Task 2: Domain types and pure helpers

**Files:**
- Create: `lib/types.ts`, `lib/domain/compliance.ts`, `lib/domain/geo.ts`, `lib/domain/format.ts`
- Test: `tests/domain/compliance.test.ts`, `tests/domain/geo.test.ts`

**Interfaces — Produces (`lib/types.ts`, used everywhere):**
```ts
export type Mode = "attend" | "speak" | "table" | "sponsor";
export type SpeakingSignal = "asked" | "could_offer" | null;
export type EventMark = "saved" | "going" | "hidden" | null;
export type HideReason = "too_far" | "wrong_crowd" | "too_expensive" | "bad_timing" | "not_my_kind";
export type SourceKind = "organizer" | "trusted_calendar" | "listing";
export type Outcome = 0 | 1 | 2 | 3;

export interface Contact { role?: string; name?: string; email?: string; phone?: string; url?: string }

export interface EventItem {
  id: string; title: string; host: string; orgId: string | null;
  startsAt: string; endsAt: string | null;          // ISO with offset
  venueName: string | null; address: string | null; townText: string | null;
  lat: number | null; lng: number | null; distanceMiles: number | null;
  costUsd: number | null;                            // null = unknown
  sourceUrl: string; sourceKind: SourceKind; registerUrl: string | null; contact: Contact | null;
  description: string;
  speaking: SpeakingSignal; suggestedMode: Mode; nextStep: string;
  whyGo: string; whyFits: string; needsPreapproval: boolean;
  confidence: number;                                // 0..1
  subScores: { audienceFit: number; wealth: number } | null;  // 0..10 from LLM
  score: number;                                     // 0..100, computed
  checkedAt: string;
  mark: EventMark; hideReason: HideReason | null; outcome: Outcome | null; outcomeNote: string | null;
}

export type OrgStatus = "suggested" | "following" | "not_interested";
export interface Organization {
  id: string; name: string; website: string | null; townText: string | null;
  lat: number | null; lng: number | null; contact: Contact | null; whyHer: string;
  status: OrgStatus; followedAt: string | null; lastContactedAt: string | null; suggestedAt: string;
}

export interface ComplianceRule { label: string; leadDays: number; appliesTo: Mode[] }
export interface Profile {
  id: string; displayName: string;
  home: { label: string; lat: number; lng: number }; radiusMiles: number; areaTowns: string[];
  idealClient: string; priorities: string;
  weights: { audienceFit: number; wealth: number; distance: number; cost: number }; // sum = 1
  exclusions: string[]; costCeilingUsd: number; complianceRule: ComplianceRule;
  trustedSources: { name: string; url: string }[];
  emailTo: string[]; emailCc: string[]; timezone: string;
}
export interface Deadline { submitBy: string /* YYYY-MM-DD */; daysLeft: number; passed: boolean }
```

- [ ] **Step 1: Write failing tests**
```ts
// tests/domain/compliance.test.ts
test("submit-by is start date minus lead days, in PT", () => {
  const d = complianceDeadline("2026-12-10T18:30:00-08:00", 7, new Date("2026-11-18T17:00:00Z"), "America/Los_Angeles");
  expect(d).toEqual({ submitBy: "2026-12-03", daysLeft: 15, passed: false });
});
test("late-evening PT event does not shift a day when server is UTC", () => {
  const d = complianceDeadline("2026-12-10T23:00:00-08:00", 7, new Date("2026-11-18T17:00:00Z"), "America/Los_Angeles");
  expect(d.submitBy).toBe("2026-12-03");
});
test("passed deadline", () => {
  const d = complianceDeadline("2026-12-05T18:00:00-08:00", 7, new Date("2026-12-01T17:00:00Z"), "America/Los_Angeles");
  expect(d).toEqual({ submitBy: "2026-11-28", daysLeft: 0, passed: true });
});
test("deadline today is not passed", () => {
  const d = complianceDeadline("2026-12-10T18:30:00-08:00", 7, new Date("2026-12-03T20:00:00Z"), "America/Los_Angeles");
  expect(d).toEqual({ submitBy: "2026-12-03", daysLeft: 0, passed: false });
});
// tests/domain/geo.test.ts
test("haversine Carlsbad→Del Mar ≈ 14–16 mi", () => {
  expect(haversineMiles({ lat: 33.1581, lng: -117.3506 }, { lat: 32.9595, lng: -117.2653 })).toBeGreaterThan(13);
});
```
- [ ] **Step 2:** `npm test`. Expected: FAIL (functions not defined).
- [ ] **Step 3:** Implement `complianceDeadline(startsAt: string, leadDays: number, now: Date, tz: string): Deadline` (compare calendar dates in `tz` via `Intl.DateTimeFormat`, no date library), `haversineMiles(a: {lat,lng}, b: {lat,lng}): number`, and in `format.ts`: `formatEventWhen(startsAt, endsAt, tz): string` ("Thu Dec 10 · 6:30 pm"), `formatCost(costUsd: number|null): string` ("Free" / "$350" / "Cost: check event page").
- [ ] **Step 4:** `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: domain types and deadline/geo helpers`.

### Task 3: Ranking, nudges, outcomes (pure)

**Files:**
- Create: `lib/domain/rank.ts`, `lib/domain/nudges.ts`, `lib/domain/outcomes.ts`
- Test: `tests/domain/rank.test.ts`, `tests/domain/nudges.test.ts`, `tests/domain/outcomes.test.ts`

**Interfaces — Produces:**
- `computeScore(e: Pick<EventItem,"subScores"|"speaking"|"distanceMiles"|"costUsd">, p: Profile): number`. Base = 100 × (w.audienceFit·aF/10 + w.wealth·wl/10 + w.distance·(1 − min(d,radius)/radius) + w.cost·costFactor), where costFactor = 1 if free or unknown, else 1 − cost/ceiling. Add +25 for `"asked"` or +10 for `"could_offer"`, then clamp to 0..100. Unknown distance counts as radius/2.
- `isEligible(e: EventItem, p: Profile, now: Date): boolean`. False if hidden, if the event starts before now or more than 56 days out, if cost > ceiling, if distance > radius, if distance is null and townText isn't in `p.areaTowns` (case-insensitive), or if title/host matches any `p.exclusions` entry (case-insensitive substring).
- `rankEvents(events: EventItem[], p: Profile, now: Date, opts?: { max?: number; min?: number; minConfidence?: number }): EventItem[]`. Defaults: max 10, min 5, minConfidence 0.5. Filters eligible events and sorts by score desc. Events below minConfidence are added at the bottom only to reach `min`.
- `orgNudges(org: Organization, upcoming: EventItem[], now: Date): Nudge[]` where `type Nudge = { kind: "hosting"; eventId: string; text: string } | { kind: "not_contacted"; text: string }`.
  - `hosting` applies when the org is followed and has an eligible event within 56 days. Text: `Hosting ${title} ${Mon D}. Good time to reach out.`
  - `not_contacted` applies when the org is followed, at least 14 days have passed since followedAt, and lastContactedAt is null or more than 60 days old. Text: "You haven't contacted them yet." or "It's been a while since you reached out."
- `pendingOutcomes(events: EventItem[], now: Date): EventItem[]`. Events with mark `going`, start before now, start within the last 14 days and outcome null.

- [ ] **Step 1: Write failing tests**, including:
```ts
test("asked speaking outranks better-audience attend-only event", ...)          // asked aF6 vs none aF9
test("hidden, past, >56 days, over-ceiling, excluded-conference events are dropped", ...)
test("event with unknown cost is eligible and shows", ...)
test("null distance kept only if townText in areaTowns", ...)                   // Review Focus 2
test("low-confidence events only fill up to min 5", ...)
test("not_contacted nudge appears at 14 days, pauses 60 days after contact", ...)
test("hosting nudge only for followed orgs", ...)
test("pendingOutcomes: going + past + no outcome only", ...)
```
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the signatures above.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: ranking, nudges, outcome selection`.

### Task 4: Fixtures and the AppData interface (fake implementation)

**Files:**
- Create: `lib/fixtures/profile.ts`, `lib/fixtures/events.ts`, `lib/fixtures/orgs.ts`, `lib/data/AppData.ts`, `lib/data/fakeData.ts`, `lib/data/DataProvider.tsx`
- Test: `tests/data/fakeData.test.ts`

**Interfaces — Produces (`lib/data/AppData.ts`):**
```ts
export interface SettingsProposal { id: string; changes: { field: string; from: string; to: string; text: string }[]; unsupported: string | null }
export interface AppData {
  getProfile(): Promise<Profile>;
  listEvents(): Promise<EventItem[]>;                 // already ranked for display
  listGoing(): Promise<EventItem[]>;
  getEvent(id: string): Promise<EventItem | null>;
  setMark(id: string, mark: EventMark, reason?: HideReason | null): Promise<void>;
  recordOutcome(id: string, outcome: Outcome, note?: string): Promise<void>;
  listOrgs(): Promise<{ following: (Organization & { nudges: Nudge[] })[]; suggested: Organization[] }>;
  getOrg(id: string): Promise<{ org: Organization; events: EventItem[] } | null>;
  setOrgStatus(id: string, status: OrgStatus): Promise<void>;
  markContacted(id: string): Promise<void>;
  proposeSettingsChange(text: string): Promise<SettingsProposal>;
  confirmSettingsChange(proposalId: string): Promise<void>;
}
export function useAppData(): AppData   // from DataProvider; picks fake or http by NEXT_PUBLIC_DATA_MODE
```
- `makeFixtures(now: Date): { profile: Profile; events: EventItem[]; orgs: Organization[] }`. Dates are relative to `now` so the prototype never goes stale. It must include at least:
  - one `asked` speaking event with a deadline 15 days out
  - one `could_offer` event
  - a $350 gala
  - a listing-source event at confidence 0.55
  - an event whose deadline has passed
  - a free library talk
  - an event hosted by a followed org
  - a `going` event 3 days in the past with no outcome
  - a $2,500 sponsorship (to be filtered out)
  - one CAIS-style conference (to be excluded)

  It also includes 6 orgs: one followed with a hosted event, one followed 20 days ago and never contacted, one contacted 10 days ago, and 3 suggested. The profile is the spec §2 working assumption with the Global Constraints defaults. All content is invented but realistic for North County San Diego.
- `createFakeData(storage: Storage, now: () => Date): AppData`. It persists marks, outcomes, org status and profile edits in `storage` under key `ef-proto-v1`, and uses `rankEvents` and `orgNudges` from Task 3. Fake `proposeSettingsChange` understands:
  - "within N miles" → radiusMiles
  - "follow <name>" / "unfollow <name>" → matching org status
  - "under $N" → costCeilingUsd

  Anything else returns `unsupported: "I can't change that from here. Text Rayyan."`

- [ ] **Step 1: Write failing tests:** hiding an event removes it from `listEvents` and stores the reason; `recordOutcome` removes it from pending; "only show things within 20 miles" proposes `radiusMiles 30 → 20`, and confirming changes `listEvents`; the sponsorship and the conference never appear; state survives a new `createFakeData` on the same storage.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: fixtures and fake AppData`.

### Task 5: Screens: shell, login, Events, event details

**Files:**
- Create: `app/layout.tsx`, `app/login/page.tsx`, `app/(app)/layout.tsx`, `app/(app)/events/page.tsx`, `app/(app)/events/[id]/page.tsx`, `components/{Tabs,EventCard,EventDetail,HideReasons,SpeakingTag,ComplianceStrip,ChangeBox}.tsx`
- Test: `tests/components/EventCard.test.tsx`

Layout and copy follow `.superpowers/brainstorm/*/content/screens-v2.html`. In prototype mode:
- Login accepts `DEMO_PASSCODE` (checked in a server action) and sets a cookie.
- Tabs are **Events · Organizations · Map · I'm going (n)**.
- On screens ≥ 1024px, the Events page shows the list on the left and `EventDetail` on the right (selected via `?id=`). Below 1024px, tapping a card goes to `/events/[id]`.
- `EventDetail` sections, in this order: When & where (with an "Open in Maps" link `https://maps.google.com/?q=<address>`), How to take part, Register / contact, About it, **Why this fits your clients**, Compliance, "✔ Checked against the event's page on <date>". For `sourceKind === "listing"`, add "(found on a listing site)".
- `ChangeBox`: input → proposal shown in plain words → **Confirm** / **Never mind**. Show `unsupported` text if it's set.

- [ ] **Step 1: Write failing component tests:**
  - An `asked` event shows "They're asking for speakers". A `could_offer` event shows "You could offer to speak" and never shows the word "asking".
  - The compliance strip reads "Needs LPL pre-approval · submit by Dec 3 (15 days left)", or "Deadline passed Nov 28" when passed. The label comes from `profile.complianceRule.label`.
  - Clicking ✕ Hide shows the 5 reasons, and clicking "Too far" calls `setMark(id, "hidden", "too_far")`. Skipping the reason calls `setMark(id, "hidden", null)`.
  - Unknown cost renders "Cost: check event page".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the components and pages.
- [ ] **Step 4:** Run. Expected: PASS. Then `npm run dev` and check at 390px and 1280px widths that the list, details and hide flow work.
- [ ] **Step 5:** Commit `feat: prototype shell, events and details`.

### Task 6: Screens: Organizations, I'm going, Map, email preview

**Files:**
- Create: `app/(app)/orgs/page.tsx`, `app/(app)/orgs/[id]/page.tsx`, `app/(app)/going/page.tsx`, `app/(app)/map/page.tsx`, `components/{OrgCard,OrgDetail,OutcomeAsk,MapView}.tsx`, `lib/email/compose.ts`, `app/preview/email/page.tsx`
- Test: `tests/email/compose.test.ts`, `tests/components/OrgCard.test.tsx`

**Interfaces — Produces:**
- `composeWeeklyEmail(input: { profile: Profile; ranked: EventItem[]; orgsToReach: (Organization & { nudges: Nudge[] })[]; pending: EventItem[]; links: { open: string; outcome: (eventId: string, n: Outcome) => string } ; now: Date }): { subject: string; html: string; text: string }`
  - Subject: `Your ${n} picks this week`.
  - Sections in order: Top 3 (with the deadline inline when `needsPreapproval`), "Good time to reach out" (omitted when empty), "How did it go?" (one line per pending event with links 0 · 1 · 2 · 3+; omitted when empty), the button "See all ${n} →".
  - Inline-styled HTML (email clients ignore `<style>`); the plain-text version carries the same content.
- Org cards show nudges as strips and the two buttons. "✉ I contacted them" calls `markContacted` and the not-contacted nudge disappears. Suggestions show **+ Follow · ✕ Not interested**.
- The I'm going tab lists upcoming going events (soonest first, with deadlines) plus `OutcomeAsk` (0 · 1 · 2 · 3+ and an optional note) for pending ones.
- The Map tab uses react-leaflet (loaded through `next/dynamic` with `ssr: false`) and OSM tiles. It shows a pin for each ranked event that has lat/lng plus a home marker. Popups link to the event.
- `/preview/email` renders `composeWeeklyEmail` from fake data inside an iframe (prototype only; in live mode it is protected like the rest of the app).

- [ ] **Step 1: Write failing tests:**
  - compose: the subject counts the ranked events; only 3 events appear under Top 3; a passed-deadline event says "Deadline passed"; the reach-out section is absent when no nudges; every outcome link appears for each pending event; the text version contains each event title.
  - OrgCard: tapping contacted removes the not-contacted strip.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run tests (expected: PASS), then click through every tab at 390px and 1280px.
- [ ] **Step 5:** Commit `feat: prototype orgs, going, map, email preview`.

### Task 7: Prototype review gate (STOP)

- [ ] **Step 1:** Deploy a Vercel preview with `NEXT_PUBLIC_DATA_MODE=fake` and `DEMO_PASSCODE` set. Use `vercel` CLI or connect the repo, whichever Rayyan prefers. Ask him first.
- [ ] **Step 2:** Send Rayyan the URL and passcode with a short checklist to try on his phone and computer:
  - log in
  - hide an event with a reason
  - save an event, then mark one as going
  - open an event's details
  - follow a suggested org and mark one contacted
  - answer "how did it go"
  - open the map
  - type "only show things within 20 miles" in the change box
  - open `/preview/email`
- [ ] **Step 3:** **Stop and wait for his feedback.** Turn it into edits to Tasks 5–6 (new commits) and repeat until he signs off. Milestone 2 doesn't start without his sign-off.

---

# Milestone 2: Real data and access

### Task 8: Supabase schema, repository, live AppData

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `supabase/seed.sql`, `lib/db/supabase.ts`, `lib/db/repo.ts`, `lib/data/httpData.ts`, `app/api/events/[id]/mark/route.ts`, `app/api/events/[id]/outcome/route.ts`, `app/api/events/route.ts`, `app/api/going/route.ts`, `app/api/orgs/route.ts`, `app/api/orgs/[id]/route.ts`, `app/api/profile/route.ts`
- Test: `tests/db/repo.test.ts` (runs against a local Supabase via `supabase start`; skipped when `SUPABASE_URL` is unset)

Tables, all with `profile_id uuid not null`:
- `profiles` holds the `Profile` fields as columns or jsonb, plus `passcode_hash text`.
- `events` holds the `EventItem` fields plus `dedupe_key text`, `first_seen_run uuid`, `last_seen_run uuid`, `raw jsonb`. Unique on `(profile_id, dedupe_key)`.
- `organizations` holds the `Organization` fields. Unique on `(profile_id, lower(name))`.
- `runs`: `id`, `kind ('weekly'|'org_seed'|'rescore')`, `week_key text` (e.g. `2026-W47`), `stage text`, `cursor jsonb`, `locked_until timestamptz`, `emailed_at timestamptz`, `usage jsonb`, `error text`. Unique on `(profile_id, kind, week_key)`.
- `run_pages`: `run_id`, `url`, `source_kind`, `text`, `status ('pending'|'extracted'|'failed')`. Unique on `(run_id, url)`.
- `geocode_cache(query text primary key, lat, lng)`.
- `settings_changes(id, proposal jsonb, status ('proposed'|'applied'|'cancelled'), created_at, applied_at)`.

Marks, outcomes and contact dates live on the event and org rows. A re-found event keeps its mark.

`supabase/seed.sql` inserts one profile with the spec §2 values and the Global Constraints defaults, the §5 trusted-source list (Task 10 fills in the URLs), the email recipients and a passcode hash Rayyan provides at seed time.

**Interfaces — Produces (`lib/db/repo.ts`, server only):**
`getProfile(id)`, `updateProfile(id, patch: Partial<Profile>)`, `listUpcomingEvents(profileId, now)`, `getEvent(id)`, `setMark(id, mark, reason)`, `recordOutcome(id, outcome, note)`, `upsertEvents(profileId, runId, events: EventItem[] & {dedupeKey}[])`, `listOrgs(profileId)`, `upsertOrgs(...)`, `setOrgStatus`, `markContacted`, `geocodeCacheGet/Put`, run helpers in Task 14.

`httpData.ts` implements `AppData` by calling the API routes. The API routes call `repo` and the Task 3 helpers, so ranking is computed at read time and settings changes affect results immediately.

- [ ] **Step 1: Write failing repo tests:** upserting the same `dedupe_key` twice yields one row and keeps an existing `mark`; `setMark("hidden")` excludes it from `listUpcomingEvents` + `rankEvents`; `markContacted` sets `lastContactedAt`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Write the migration, the repo, the API routes and httpData.
- [ ] **Step 4:** Run. Expected: PASS. Then set `NEXT_PUBLIC_DATA_MODE=live`, seed fixture events into local Supabase with a script `scripts/seed-fixtures.ts`, and confirm every screen works the same as in fake mode.
- [ ] **Step 5:** Commit `feat: supabase schema and live data`.

### Task 9: Passcode, session cookie, email login tokens

**Files:**
- Create: `lib/auth/tokens.ts`, `lib/auth/passcode.ts`, `middleware.ts`, `app/r/[token]/route.ts`; modify `app/login/page.tsx`
- Test: `tests/auth/tokens.test.ts`

**Interfaces — Produces:**
- `signToken(payload: Record<string, unknown>, ttlSeconds: number, secret: string): string` and `verifyToken<T>(token: string, secret: string, now?: Date): T | null`. HMAC-SHA256 over base64url JSON with an `exp` field, compared in constant time.
- Session cookie `ef_session` = `signToken({ pid }, 90*24*3600)`, httpOnly, secure, sameSite=lax.
- Email login link `/r/<signToken({ pid, purpose:"login" }, 30*24*3600)>`. A valid token sets the cookie and redirects to `/events`. An invalid or expired token redirects to `/login?expired=1`, which shows "This link has expired. Enter your passcode to continue."
- `checkPasscode(input: string, hash: string): Promise<boolean>` using `bcryptjs`.
- Middleware protects `(app)` routes, `/api/*` (except `/api/run/*`, which uses `x-run-secret`) and `/preview/*`. `/outcome/*` checks its own token.

- [ ] **Step 1: Write failing tests:** a round-trip works; a tampered token returns null; an expired token returns null; a token signed with another secret returns null.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run (PASS), then manually: a wrong passcode shows "That passcode didn't work", the right one logs in, and an expired link shows the friendly page.
- [ ] **Step 5:** Commit `feat: passcode auth and email login links`.

---

# Milestone 3: The weekly engine (`lib/engine/`, no UI imports)

Before Task 10, the implementer loads the `claude-api` skill for current Anthropic SDK usage (structured outputs / tool use, prompt caching).

### Task 10: LLM wrapper, search, page fetching, sources

**Files:**
- Create: `lib/engine/llm.ts`, `lib/engine/search.ts`, `lib/engine/fetchPage.ts`, `lib/engine/sources.ts`, `lib/engine/usage.ts`; update `supabase/seed.sql` with trusted source URLs
- Test: `tests/engine/search.test.ts`, `tests/engine/fetchPage.test.ts`, `tests/engine/llm.test.ts`

**Interfaces — Produces:**
- `callJson<T>(opts: { system: string; user: string; schema: z.ZodType<T>; maxTokens?: number }, usage: Usage): Promise<T | null>`. It uses model `claude-sonnet-5-5` with a tool-forced JSON output and validates against the zod schema. On failure it retries once, then returns **null** without throwing. It adds the tokens it used to `usage`.
- `type Usage = { inputTokens: number; outputTokens: number; searches: number; fetches: number }` and `estimateCostUsd(u: Usage): number`.
- `tavilySearch(query: string, usage: Usage): Promise<{ url: string; title: string; content: string }[]>`. Basic depth, max 8 results, US. Increments `usage.searches`.
- `buildQueries(p: Profile, now: Date): string[]`. At most 40 queries, built from the priorities, the areaTowns and the next two months' names. Speaking queries come first ("call for speakers financial literacy Carlsbad", "women's group monthly speaker Encinitas", ...).
- `fetchPageText(url: string, usage: Usage): Promise<{ url: string; text: string } | null>`. 10 s timeout. It strips scripts, nav and footer with `cheerio` and truncates to 20k chars. Non-HTML or non-200 responses return null.
- Trusted sources: Rayyan's seed list from spec §5. The implementer looks up and fills in real calendar URLs (one line per source in `seed.sql`) and drops any it can't find a calendar page for. List the dropped ones in the task summary.

- [ ] **Step 1: Write failing tests** (with mocked `fetch`): `buildQueries` returns ≤ 40 queries and the first 10 contain "speaker" or "speak"; `tavilySearch` maps the response and counts the search; `fetchPageText` returns null on 404 and strips `<script>`; `callJson` returns null after two invalid responses and does not throw.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: engine llm/search/fetch primitives`.

### Task 11: Extract and verify events

**Files:**
- Create: `lib/engine/extract.ts`, `lib/engine/verify.ts`, `lib/engine/geocode.ts`
- Test: `tests/engine/verify.test.ts`, `tests/engine/extract.test.ts`, `tests/engine/fixtures/*.html`

**Interfaces — Produces:**
- `type RawEvent` (zod schema): title, host, startsAt (ISO or null), endsAt, yearStated: boolean, venueName, address, townText, costUsd, registerUrl, contact, description, speakingAsked: boolean (true only if the page explicitly asks for speakers/presenters/panelists), modes: Mode[].
- `extractEvents(page: {url,text}, sourceKind: SourceKind, now: Date, usage): Promise<RawEvent[]>`. One `callJson` per page. The system prompt states today's date and tells the model to return [] for pages without specific dated events. A null LLM result becomes `[]`.
- `verifyEvent(raw: RawEvent, sourceKind: SourceKind, now: Date, tz: string): { ok: true; confidence: number } | { ok: false; reason: string }`:
  - Reject if startsAt is null, before now, or more than 56 days out.
  - Base confidence: organizer 0.9, trusted_calendar 0.9, listing 0.65.
  - −0.2 if `yearStated` is false. −0.1 if there's no address and no townText.
- `geocode(address: string | null, townText: string | null, usage): Promise<{lat,lng} | null>`. Uses the cache table first, then Nominatim (`countrycodes=us`, viewbox around San Diego County, 1 s spacing).

- [ ] **Step 1: Write failing tests:** past event → rejected; event 60 days out → rejected; listing source → 0.65; missing year → minus 0.2; a fixture page from last year ("Dec 12, 2025") run through the mocked extract and verify gets rejected; a null LLM result → `[]` (Review Focus 5).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: event extraction and verification`.

### Task 12: Dedupe

**Files:** Create `lib/engine/dedupe.ts`. Test `tests/engine/dedupe.test.ts`.

**Interfaces — Produces:**
- `dedupeKey(title: string, startsAt: string, tz: string): string`. Local date (YYYY-MM-DD in tz) + `|` + the sorted, lower-cased, stopword-free title tokens (first 6).
- `mergeCandidates(items: (RawEvent & { sourceUrl; sourceKind; confidence })[], tz): typeof items`. Two items are the same event if they share the local date and their title-token Jaccard similarity is ≥ 0.6, or if they share the local date and the same normalized venue. A merge keeps the highest-confidence source's URL and fills empty fields from the others.

- [ ] **Step 1: Write failing tests:**
  - "Money After 50 Panel – Women in Business" and "Women in Business: Money After 50" on the same day → 1 event.
  - The same title on different days → 2 events.
  - A listing plus an organizer page merge → the organizer's URL is kept and confidence becomes 0.9.
  - `dedupeKey` is stable for a 11:30 pm PT start (Review Focus 1).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: event dedupe`.

### Task 13: Scoring and learning from her

**Files:** Create `lib/engine/score.ts`, `lib/engine/feedback.ts`. Test `tests/engine/score.test.ts`, `tests/engine/feedback.test.ts`.

**Interfaces — Produces:**
- `summarizeFeedback(hidden: EventItem[], notInterested: Organization[]): string`. Counts per hide reason with short examples, e.g. "Hidden for 'too far' 3× (all over 20 mi)". Empty string when there's no data.
- `scoreEvents(batch: (EventItem & { speakingAsked: boolean })[], p: Profile, feedback: string, usage): Promise<Map<string, ScoreResult>>`, with up to 8 events per LLM call. `ScoreResult = { audienceFit: 0..10; wealth: 0..10; speaking: SpeakingSignal; suggestedMode: Mode; nextStep: string; whyGo: string; whyFits: string; needsPreapproval: boolean }`.
  - `speaking: "asked"` is allowed only when the extracted `speakingAsked` is true (persisted in `events.raw.speakingAsked` by Task 14's extract stage). Code enforces this and downgrades it to `could_offer` otherwise.
  - `needsPreapproval` is forced true when `suggestedMode` is in `p.complianceRule.appliesTo`.
  - The prompt includes `p.idealClient`, `p.priorities`, `feedback` and the rules: `whyGo` is ≤ 2 sentences and cites concrete audience, venue, price or organizer facts from the page; `whyFits` names which part of the ideal client the audience matches and the wealth signal; no generic phrases like "great networking opportunity".
  - The final `score` comes from `computeScore` (Task 3), not from the LLM.
- Events missing from the LLM response keep `subScores: null` and are left unranked this run, not dropped.

- [ ] **Step 1: Write failing tests** (mocked `callJson`): an LLM "asked" without `speakingAsked` → `could_offer`; mode `speak` → `needsPreapproval` true; a missing event in the response → `subScores` null; `summarizeFeedback` counts reasons.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: event scoring with feedback`.

### Task 14: Staged run and the advance endpoint

**Files:** Create `lib/engine/run.ts`, `app/api/run/advance/route.ts`. Test `tests/engine/run.test.ts`.

**Interfaces — Produces:**
- `advanceRun(deps: RunDeps, profileId: string, now: Date): Promise<{ runId: string; stage: Stage; done: boolean }>`, where `RunDeps` bundles repo + engine functions (injected so they can be mocked in tests).
- `type Stage = "collect" | "extract" | "geocode" | "score" | "orgs" | "email" | "done"`.
- Behavior:
  1. `weekKey` = ISO week in tz. Upsert a `weekly` run for (profile, weekKey). If it's `done`, return immediately.
  2. **Lock:** `update runs set locked_until = now()+55s where id = $1 and (locked_until is null or locked_until < now()) returning *`. If no row comes back, return without doing work (another call is running).
  3. Do **one batch** of the current stage, save the cursor and usage, then advance the stage when the stage has no work left.

  | Stage | One batch |
  |---|---|
  | collect | 10 trusted-source fetches or 10 searches → `run_pages` (search results add each result URL as a page with `sourceKind = "listing"` unless the domain matches a trusted source or the org website → `organizer`) |
  | extract | 3 pending pages → extract → verify → merge into `events` by `dedupeKey` (keep marks) |
  | geocode | 10 events lacking lat/lng → geocode → distanceMiles |
  | score | 16 unscored events (2 LLM calls) |
  | orgs | runs only on even ISO weeks or when kind = `org_seed` (see Task 15) |
  | email | if `emailed_at` is null: set `emailed_at = now()` **first** (conditional update), then send. If sending throws, set it back to null and save `error`. |

  4. Release the lock.
- `POST /api/run/advance?kind=weekly|org_seed` requires `x-run-secret`. It returns JSON `{runId, stage, done}`. It's a no-op outside the Monday 03:00–07:00 PT window for `weekly`, unless `?force=1`.

- [ ] **Step 1: Write failing tests** (in-memory fake repo):
  - Repeated calls walk collect → … → done.
  - Two concurrent calls → only one processes the batch (Review Focus 3).
  - Calls after done → no new work and the email is sent exactly once.
  - Email failure → `emailed_at` resets and the next call retries.
  - A page whose extraction returns null → status `failed`, and the run continues.
  - The search count per run is ≤ 40.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: staged weekly run`.

### Task 15: Organizations: starting set, biweekly suggestions

**Files:** Create `lib/engine/orgs.ts`. Test `tests/engine/orgs.test.ts`.

**Interfaces — Produces:**
- `findOrgCandidates(p: Profile, existing: Organization[], count: number, usage): Promise<Organization[]>`. Uses ≤ 10 Tavily searches (women's groups, college career centers, community and faith centers, Rotary, retirement communities, hospital foundations, in areaTowns), then one `callJson` that returns name, website, townText, a public contact if shown, and `whyHer` (concrete: who the members are and whether the group hosts speakers). Skips names already in `existing` (any status, case-insensitive), including `not_interested` ones.
- The `org_seed` run kind calls it with count 15 and inserts the results as `suggested`. Rayyan reviews them in the app and follows the good ones (or tells his mom to).
- In the weekly run's `orgs` stage (even ISO weeks only), it's called with count 4 and the results are inserted as `suggested`.
- Linking: during `extract`, an event whose host matches a followed or suggested org name (case-insensitive, normalized) gets `orgId` set. Hosting nudges come from `orgNudges` (Task 3).

- [ ] **Step 1: Write failing tests:** not-interested and existing orgs are never re-suggested; the orgs stage is skipped on odd weeks; an event host "Del Mar Rotary Club" links to the org "Del Mar Rotary".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: organization suggestions`.

---

# Milestone 4: Delivery and settings

### Task 16: Sending email and outcome confirm page

**Files:** Create `lib/email/send.ts`, `app/outcome/[token]/page.tsx`, `app/api/outcome/route.ts`; wire the `email` stage to `composeWeeklyEmail`. Test `tests/email/send.test.ts`, `tests/outcome.test.ts`.

**Interfaces — Produces:**
- `sendEmail(msg: { to: string[]; cc: string[]; subject: string; html: string; text: string }): Promise<void>`. Picks the provider from `EMAIL_PROVIDER`:
  - `gmail`: nodemailer, `smtp.gmail.com:465`, `GMAIL_USER` / `GMAIL_APP_PASSWORD`, from `GMAIL_USER`.
  - `resend`: the Resend SDK, from `EMAIL_FROM`.
- Outcome links: `/outcome/<signToken({ pid, eventId, n, purpose:"outcome" }, 21 days)>`.
  - **GET** renders "Record 2 good conversations for Money After 50 panel?" with a **Yes, record it** button and an optional note box. It never writes anything.
  - **POST** (`/api/outcome`) verifies the token and records the answer.
- The weekly "open" link is a login token (Task 9).

- [ ] **Step 1: Write failing tests:** a GET on the outcome page does not call `recordOutcome` (Review Focus 4); a POST with a valid token records it; a POST with an expired token → 400 with a friendly message; `sendEmail` passes to and cc through to the provider mock.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run (PASS). Then send one real test email to `rayyandarugar@gmail.com` only, using `scripts/send-test-email.ts`.
- [ ] **Step 5:** Commit `feat: email sending and outcome confirmation`.

### Task 17: "Tell it what to change" (live)

**Files:** Create `lib/settings/allowed.ts`, `lib/settings/propose.ts`, `lib/settings/apply.ts`, `app/api/settings/propose/route.ts`, `app/api/settings/confirm/route.ts`. Test `tests/settings/*.test.ts`.

**Interfaces — Produces:**
- `ALLOWED_FIELDS`: `home`, `radiusMiles`, `areaTowns`, `idealClient`, `priorities`, `weights`, `exclusions`, `costCeilingUsd`, `complianceRule.leadDays`, `trustedSources` (add only), plus actions `follow_org` / `unfollow_org` by name. Each has a zod validator (e.g. radius 1–100, weights sum to 1 ± 0.01).
- `proposeChange(text: string, p: Profile, orgs: Organization[], usage): Promise<SettingsProposal>`. One `callJson`. Any field outside `ALLOWED_FIELDS`, or a validation failure, returns `unsupported: "I can't change that from here. Text Rayyan."`. For `home`, geocode the place name. `follow_org` matches an existing org by name or creates `{ name, status: "following", whyHer: "Added by you" }`.
- `applyChange(proposalId)` updates the profile and orgs, marks the proposal applied and emails Rayyan (`emailCc`) "Settings changed: Radius 30 → 20 miles". If `idealClient`, `priorities` or `weights` changed, it re-scores stored upcoming events using `after()` from `next/server` (batches of 8, stopping before 50 s; unfinished events keep their old scores until Monday).
- Filters apply immediately because ranking runs at read time (Task 8).
- Swap `ChangeBox` to the live implementation through `httpData` (no UI change).

- [ ] **Step 1: Write failing tests:** "make the passcode 1234" → unsupported; "only within 20 miles" → radius change; radius 500 → unsupported; confirming an ideal-client change triggers a rescore; confirming twice applies once.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: live settings change box`.

### Task 18: Deploy, schedule, first real run, acceptance

- [ ] **Step 1:** With Rayyan, create the Supabase project, run the migration and seed (he supplies the passcode), set the Vercel env vars, and deploy production with `NEXT_PUBLIC_DATA_MODE=live`.
- [ ] **Step 2:** Rayyan creates these cron-jobs.org jobs. Write the exact settings in `README.md`.
  - `POST <APP_BASE_URL>/api/run/advance?kind=weekly`, header `x-run-secret`, every 5 minutes, Mondays 03:00–07:00 America/Los_Angeles.
  - One-time manual trigger: `kind=org_seed` called repeatedly (or `curl` in a loop) until done.
- [ ] **Step 3:** Trigger a forced weekly run (`?force=1`) with email recipients temporarily set to Rayyan only. Record the usage and cost from `runs.usage`.
- [ ] **Step 4: Acceptance check (spec §1):**
  - ≥ 15 verified upcoming events in the area and 0 duplicates. Query distinct `dedupe_key` vs. count, and eyeball near-duplicates.
  - Rayyan hand-checks 10 events. Scores and reasons hold up, and speaking events rank near the top.
  - The phone login → list → mark flow works on the production URL.
  - Deadline-flagged events show the strip.
  - Changing the radius in the change box changes the list.

  Report each item as pass or fail with evidence. If there are fewer than 15 events, tune `buildQueries` and the trusted sources before going live.
- [ ] **Step 5:** Restore the real recipients. Rayyan confirms the first Monday email reached both of her inboxes (LPL filtering).
- [ ] **Step 6:** Commit `docs: deployment and scheduling notes`.

---

## Explicitly not in this plan
Outreach drafting, calendar sync, multi-tenant signup and admin, visual polish, the prospecting tool. Also deferred: the optional stats page (Rayyan reads metrics in Supabase), org pins on the map, and app-suggested settings changes from hide patterns (spec §5). The feedback summary still steers scoring. Leave a TODO slot for a "Draft outreach" button in `OrgDetail` only.
