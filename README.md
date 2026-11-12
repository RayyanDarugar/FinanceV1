# Event Finder

Weekly, scored list of local events and organizations for one professional's ideal-client profile.

- Design: `docs/superpowers/specs/2026-11-12-event-finder-design.md`
- Plan: `docs/superpowers/plans/2026-11-13-event-finder.md`

## Dev

```bash
cp .env.example .env.local   # NEXT_PUBLIC_DATA_MODE=fake + DEMO_PASSCODE for the clickable prototype
npm install
npm run dev
npm test
```

Useful scripts (all read `.env.local`):

| Command | What it does |
|---|---|
| `npx tsx --env-file=.env.local scripts/check-db.ts` | Lists which Supabase tables exist |
| `npx tsx --env-file=.env.local scripts/seed-profile.ts <passcode>` | Creates/updates the profile row (ideal client, trusted calendars, recipients) with a hashed passcode |
| `LLM_BUDGET_USD=1 npx tsx --env-file=.env.local scripts/dry-run.ts` | Runs the real weekly pipeline **in memory** (no DB, no email) and prints the picks + cost |
| `npx tsx --env-file=.env.local scripts/smoke-extract.ts` | One tiny real extraction call (~1¢) |

## Going live (one-time)

1. **Database.** Supabase → SQL Editor → paste `supabase/setup.sql` → Run. Check with `scripts/check-db.ts` (every table should say `ok`).
2. **Environment** (`.env.local` and Vercel → Project `finance-v1` → Settings → Environment Variables, Production):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_DATA_MODE` | `live` |
   | `PROFILE_ID` | any short id, e.g. `roohi` |
   | `APP_SECRET` | 32+ random characters (`openssl rand -hex 24`) |
   | `RUN_SECRET` | another random string (cron-jobs.org sends it) |
   | `APP_BASE_URL` | `https://finance-v1.vercel.app` |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | from Supabase → Project Settings → API |
   | `ANTHROPIC_API_KEY` | Anthropic console |
   | `TAVILY_API_KEY` | free account at tavily.com (1,000 searches/month) |
   | `EMAIL_PROVIDER` | `gmail` (until there's a domain, then `resend`) |
   | `GMAIL_USER`, `GMAIL_APP_PASSWORD` | rayyandarugar@gmail.com + a Google **App Password** (Google Account → Security → 2-Step Verification → App passwords) |
   | `RESEND_API_KEY`, `EMAIL_FROM` | later, once the domain exists |
   | `LLM_BUDGET_USD` | `2` (hard cap per weekly run) |

   Remove `DEMO_PASSCODE` from Production once live.
3. **Profile.** `npx tsx --env-file=.env.local scripts/seed-profile.ts "<her passcode>"`. Temporarily set `emailTo` to just your address for the first run if you want to check it before she gets one (edit the row in Supabase → Table editor → profiles → data).
4. **Deploy.** `vercel deploy --prod` (or push to `main` once the Git integration is connected).
5. **Organizations, once.** Call until it returns `"done": true` (each call ~40s):
   ```bash
   curl -X POST "https://finance-v1.vercel.app/api/run/advance?kind=org_seed" -H "x-run-secret: $RUN_SECRET"
   ```
   Then open the app → Organizations and follow the good suggestions.
6. **First run, now.** Same call with `kind=weekly&force=1`, repeated until `"done": true`. The response shows `costUsd`.
7. **Schedule (cron-jobs.org).** New job:
   - URL: `https://finance-v1.vercel.app/api/run/advance?kind=weekly`
   - Method: POST · Header: `x-run-secret: <RUN_SECRET>`
   - Schedule: every 5 minutes, **Mondays, 03:00–06:55**, time zone America/Los_Angeles
   - Calls outside that window return `{"skipped": ...}` and do nothing.
8. **Check the first Monday email** reached both of her inboxes (LPL filters external mail; she may need to allow the sender).

## Costs (measured 2026-11-12, calendars only)

One real weekly run over the 22 trusted calendars: 113 events found, ~$0.18 of Claude (Haiku reads pages and pre-screens; Opus writes the reasons for the ~15 promising events). With web search on, expect roughly 2–3× that. `LLM_BUDGET_USD` stops a run's LLM spend; the email still goes out with what's ready.
