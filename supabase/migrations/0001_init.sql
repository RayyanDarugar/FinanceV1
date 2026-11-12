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
