create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null default 'Mafia Room',
  is_visible boolean not null default true,
  password_hash text null,
  status text not null default 'waiting'
    check (status in ('waiting', 'assigned', 'revealed', 'day', 'night', 'voting', 'ended')),
  day_number integer not null default 0,
  discussion_seconds integer not null default 300,
  discussion_started_at timestamptz null,
  created_at timestamptz default now()
);

alter table public.rooms add column if not exists name text not null default 'Mafia Room';
alter table public.rooms add column if not exists is_visible boolean not null default true;
alter table public.rooms add column if not exists password_hash text null;
alter table public.rooms enable row level security;

drop policy if exists "anon can update rooms" on public.rooms;
create policy "anon can update rooms"
on public.rooms
for update
to anon, authenticated
using (true)
with check (true);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  role text null,
  team text null,
  private_info text null,
  is_alive boolean not null default true,
  created_at timestamptz default now()
);

alter table public.players add column if not exists private_info text null;

create table if not exists public.game_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  type text not null,
  message text not null,
  created_at timestamptz default now()
);

create index if not exists rooms_code_idx on public.rooms(code);
create index if not exists rooms_is_visible_idx on public.rooms(is_visible);
create index if not exists players_room_id_idx on public.players(room_id);
create index if not exists players_created_at_idx on public.players(created_at);
create index if not exists game_events_room_id_idx on public.game_events(room_id);

alter table public.rooms replica identity full;
alter table public.players replica identity full;
alter table public.game_events replica identity full;

do '
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = ''supabase_realtime''
      and schemaname = ''public''
      and tablename = ''rooms''
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = ''supabase_realtime''
      and schemaname = ''public''
      and tablename = ''players''
  ) then
    alter publication supabase_realtime add table public.players;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = ''supabase_realtime''
      and schemaname = ''public''
      and tablename = ''game_events''
  ) then
    alter publication supabase_realtime add table public.game_events;
  end if;
end
';

drop function if exists public.create_room_with_options(text, text, boolean, text);
drop function if exists public.update_room_options(uuid, text, boolean, text, boolean);
drop function if exists public.get_host_room(uuid);
drop function if exists public.get_room_state(uuid);
drop function if exists public.get_room_entry(text);
drop function if exists public.list_visible_rooms();
drop function if exists public.verify_room_password(text, text);

create or replace function public.create_room_with_options(
  p_code text,
  p_name text,
  p_is_visible boolean,
  p_password text default null
)
returns table (
  id uuid,
  code text,
  name text,
  is_visible boolean,
  status text,
  day_number integer,
  discussion_seconds integer,
  discussion_started_at timestamptz,
  has_password boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as '
declare
  created_room public.rooms;
begin
  insert into public.rooms (code, name, is_visible, password_hash)
  values (
    upper(trim(p_code)),
    coalesce(nullif(trim(p_name), ''''), ''Mafia Room''),
    coalesce(p_is_visible, true),
    case
      when nullif(trim(coalesce(p_password, '''')), '''') is null then null
      else crypt(trim(p_password), gen_salt(''bf''))
    end
  )
  returning * into created_room;

  return query
  select
    created_room.id,
    created_room.code,
    created_room.name,
    created_room.is_visible,
    created_room.status,
    created_room.day_number,
    created_room.discussion_seconds,
    created_room.discussion_started_at,
    created_room.password_hash is not null,
    created_room.created_at;
end;
';

create or replace function public.update_room_options(
  p_room_id uuid,
  p_name text,
  p_is_visible boolean,
  p_password text default null,
  p_clear_password boolean default false
)
returns table (
  id uuid,
  code text,
  name text,
  is_visible boolean,
  status text,
  day_number integer,
  discussion_seconds integer,
  discussion_started_at timestamptz,
  has_password boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as '
declare
  updated_room public.rooms;
begin
  update public.rooms as room_row
  set
    name = coalesce(nullif(trim(p_name), ''''), room_row.name),
    is_visible = coalesce(p_is_visible, room_row.is_visible),
    password_hash = case
      when p_clear_password then null
      when nullif(trim(coalesce(p_password, '''')), '''') is not null then crypt(trim(p_password), gen_salt(''bf''))
      else room_row.password_hash
    end
  where room_row.id = p_room_id
  returning * into updated_room;

  return query
  select
    updated_room.id,
    updated_room.code,
    updated_room.name,
    updated_room.is_visible,
    updated_room.status,
    updated_room.day_number,
    updated_room.discussion_seconds,
    updated_room.discussion_started_at,
    updated_room.password_hash is not null,
    updated_room.created_at;
end;
';

create or replace function public.get_host_room(p_room_id uuid)
returns table (
  id uuid,
  code text,
  name text,
  is_visible boolean,
  status text,
  day_number integer,
  discussion_seconds integer,
  discussion_started_at timestamptz,
  has_password boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public, extensions
as '
  select
    rooms.id,
    rooms.code,
    rooms.name,
    rooms.is_visible,
    rooms.status,
    rooms.day_number,
    rooms.discussion_seconds,
    rooms.discussion_started_at,
    rooms.password_hash is not null as has_password,
    rooms.created_at
  from public.rooms
  where rooms.id = p_room_id
  limit 1;
';

create or replace function public.get_room_state(p_room_id uuid)
returns table (
  id uuid,
  code text,
  name text,
  is_visible boolean,
  status text,
  day_number integer,
  discussion_seconds integer,
  discussion_started_at timestamptz,
  has_password boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public, extensions
as '
  select
    rooms.id,
    rooms.code,
    rooms.name,
    rooms.is_visible,
    rooms.status,
    rooms.day_number,
    rooms.discussion_seconds,
    rooms.discussion_started_at,
    rooms.password_hash is not null as has_password,
    rooms.created_at
  from public.rooms
  where rooms.id = p_room_id
  limit 1;
';

create or replace function public.get_room_entry(p_code text)
returns table (
  id uuid,
  code text,
  name text,
  status text,
  has_password boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public, extensions
as '
  select
    rooms.id,
    rooms.code,
    rooms.name,
    rooms.status,
    rooms.password_hash is not null as has_password,
    rooms.created_at
  from public.rooms
  where rooms.code = upper(trim(p_code))
  limit 1;
';

create or replace function public.list_visible_rooms()
returns table (
  id uuid,
  code text,
  name text,
  status text,
  has_password boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public, extensions
as '
  select
    rooms.id,
    rooms.code,
    rooms.name,
    rooms.status,
    rooms.password_hash is not null as has_password,
    rooms.created_at
  from public.rooms
  where rooms.is_visible = true
    and rooms.status in (''waiting'', ''assigned'', ''revealed'', ''day'', ''night'')
  order by rooms.created_at desc
  limit 20;
';

create or replace function public.verify_room_password(p_code text, p_password text)
returns table (
  id uuid,
  code text,
  name text,
  status text,
  has_password boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public, extensions
as '
  select
    rooms.id,
    rooms.code,
    rooms.name,
    rooms.status,
    true as has_password,
    rooms.created_at
  from public.rooms
  where rooms.code = upper(trim(p_code))
    and crypt(trim(p_password)::text, rooms.password_hash::text) = rooms.password_hash::text
  limit 1;
';

grant execute on function public.create_room_with_options(text, text, boolean, text) to anon, authenticated;
grant execute on function public.update_room_options(uuid, text, boolean, text, boolean) to anon, authenticated;
grant execute on function public.get_host_room(uuid) to anon, authenticated;
grant execute on function public.get_room_state(uuid) to anon, authenticated;
grant execute on function public.get_room_entry(text) to anon, authenticated;
grant execute on function public.list_visible_rooms() to anon, authenticated;
grant execute on function public.verify_room_password(text, text) to anon, authenticated;

-- MVP note:
-- This schema intentionally keeps access simple for fast offline-game setup with the public anon key.
-- The app code keeps player pages scoped to the current player's own row and never fetches all roles there.
-- Before using this for untrusted public rooms, add authentication or room-scoped Row Level Security policies.



