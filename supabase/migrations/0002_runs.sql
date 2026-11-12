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
