-- Event Finder: full schema. Paste into Supabase → SQL Editor → Run. Safe to re-run.

-- Event Finder schema. Single-tenant for now; every row carries profile_id so a second client is a new row.
-- Display fields live in `data jsonb` (the app's EventItem / Organization / Profile shapes); keys used for
-- lookups and uniqueness are real columns.

create table if not exists profiles (
  id            text primary key,
  data          jsonb not null,
  passcode_hash text not null,
  updated_at    timestamptz not null default now()
);

create table if not exists events (
  id             text primary key,
  profile_id     text not null references profiles(id) on delete cascade,
  dedupe_key     text not null,
  starts_at      timestamptz not null,
  data           jsonb not null,
  raw            jsonb not null default '{}'::jsonb,
  first_seen_run text,
  last_seen_run  text,
  updated_at     timestamptz not null default now(),
  unique (profile_id, dedupe_key)
);
create index if not exists events_profile_starts on events (profile_id, starts_at);

create table if not exists organizations (
  id         text primary key,
  profile_id text not null references profiles(id) on delete cascade,
  name_key   text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  unique (profile_id, name_key)
);

create table if not exists settings_changes (
  id         text primary key,
  profile_id text not null references profiles(id) on delete cascade,
  proposal   jsonb not null,
  patches    jsonb not null,
  status     text not null default 'proposed' check (status in ('proposed', 'applied', 'cancelled')),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create table if not exists geocode_cache (
  query      text primary key,
  lat        double precision,
  lng        double precision,
  found      boolean not null,
  created_at timestamptz not null default now()
);

-- The app talks to Postgres only with the service-role key from server code. Lock everything else out.
alter table profiles enable row level security;
alter table events enable row level security;
alter table organizations enable row level security;
alter table settings_changes enable row level security;
alter table geocode_cache enable row level security;

-- Weekly run bookkeeping: one row per (profile, kind, ISO week); pages found during a run.

create table if not exists runs (
  id           text primary key,
  profile_id   text not null references profiles(id) on delete cascade,
  kind         text not null check (kind in ('weekly', 'org_seed')),
  week_key     text not null,
  stage        text not null,
  cursor       jsonb not null default '{"sources":0,"queries":0}'::jsonb,
  locked_until timestamptz,
  lock_token   text,
  emailed_at   timestamptz,
  usage        jsonb not null default '{}'::jsonb,
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (profile_id, kind, week_key)
);

create table if not exists run_pages (
  run_id      text not null references runs(id) on delete cascade,
  url         text not null,
  source_kind text not null,
  status      text not null default 'pending' check (status in ('pending', 'extracted', 'failed')),
  created_at  timestamptz not null default now(),
  primary key (run_id, url)
);
create index if not exists run_pages_pending on run_pages (run_id, status);

alter table runs enable row level security;
alter table run_pages enable row level security;
