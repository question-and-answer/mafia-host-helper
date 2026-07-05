create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  status text not null default 'waiting'
    check (status in ('waiting', 'assigned', 'revealed', 'day', 'night', 'voting', 'ended')),
  day_number integer not null default 0,
  discussion_seconds integer not null default 300,
  discussion_started_at timestamptz null,
  created_at timestamptz default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  role text null,
  team text null,
  is_alive boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists public.game_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  type text not null,
  message text not null,
  created_at timestamptz default now()
);

create index if not exists rooms_code_idx on public.rooms(code);
create index if not exists players_room_id_idx on public.players(room_id);
create index if not exists players_created_at_idx on public.players(created_at);
create index if not exists game_events_room_id_idx on public.game_events(room_id);

alter table public.rooms replica identity full;
alter table public.players replica identity full;
alter table public.game_events replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'players'
  ) then
    alter publication supabase_realtime add table public.players;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_events'
  ) then
    alter publication supabase_realtime add table public.game_events;
  end if;
end $$;

-- MVP note:
-- This schema intentionally keeps access simple for fast offline-game setup with the public anon key.
-- The app code keeps player pages scoped to the current player's own row and never fetches all roles there.
-- Before using this for untrusted public rooms, add authentication or room-scoped Row Level Security policies.
