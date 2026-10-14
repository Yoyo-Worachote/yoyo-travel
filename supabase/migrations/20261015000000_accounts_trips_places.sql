-- Yoyo Travel — accounts (username), richer trips & budget, richer place data.
-- Additive and non-destructive: only new columns (nullable or with defaults),
-- new tables, new functions and widened CHECK constraints. Safe to apply on a
-- database that already has data from 20261014000000_init.sql.

-- ─────────────────────────────── Accounts ───────────────────────────────

-- Username: 3–20 chars, lowercase letters, digits, underscore; unique.
-- Nullable so Google sign-ins can pick one later on the profile page.
alter table public.profiles add column if not exists username text;
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');
create unique index if not exists profiles_username_key on public.profiles (username);

-- New users: take username/display name from sign-up metadata when valid.
-- A duplicate username raises unique_violation, which makes sign-up fail
-- atomically (no half-created account).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted text := lower(nullif(trim(new.raw_user_meta_data->>'username'), ''));
begin
  if wanted is not null and wanted !~ '^[a-z0-9_]{3,20}$' then
    wanted := null;
  end if;
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    wanted,
    left(coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name',
                  new.raw_user_meta_data->>'name', wanted), 120),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Public availability check (reveals only whether a username is taken).
create or replace function public.username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(candidate) ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where username = lower(candidate));
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- Username → sign-in email. Callable ONLY with the service role (server-side),
-- never by anon/authenticated, so emails cannot be enumerated from the browser.
create or replace function public.auth_email_for_username(candidate text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.email from public.profiles p join auth.users u on u.id = p.id
  where p.username = lower(candidate) limit 1;
$$;
revoke all on function public.auth_email_for_username(text) from public, anon, authenticated;
grant execute on function public.auth_email_for_username(text) to service_role;

-- Self-service account deletion. Deletes the caller's auth user; all private
-- rows cascade (profiles, visits, wishlist, trips, items, expenses).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ─────────────────────────────── Trips & budget ───────────────────────────────

alter table public.user_trips add column if not exists description text;
alter table public.user_trips add column if not exists traveler_count smallint not null default 1;
alter table public.user_trips add column if not exists currency text not null default 'THB';
alter table public.user_trips add column if not exists status text not null default 'planning';
alter table public.user_trips add column if not exists travel_styles text[] not null default '{}';
alter table public.user_trips add column if not exists transport_mode text;
alter table public.user_trips drop constraint if exists user_trips_extra_checks;
alter table public.user_trips add constraint user_trips_extra_checks check (
  char_length(coalesce(description, '')) <= 2000
  and traveler_count between 1 and 50
  and currency ~ '^[A-Z]{3}$'
  and status in ('planning', 'booked', 'completed', 'archived')
  and cardinality(travel_styles) <= 10
  and (transport_mode is null or transport_mode in ('car', 'bus', 'train', 'plane', 'motorbike', 'boat', 'mixed'))
);

alter table public.user_trip_items add column if not exists start_time time;
alter table public.user_trip_items add column if not exists end_time time;
alter table public.user_trip_items add column if not exists cost_category text;
alter table public.user_trip_items add column if not exists actual_cost numeric(12,2);
alter table public.user_trip_items drop constraint if exists user_trip_items_extra_checks;
alter table public.user_trip_items add constraint user_trip_items_extra_checks check (
  (cost_category is null or cost_category in ('accommodation', 'food', 'activity', 'transport', 'other'))
  and (actual_cost is null or actual_cost >= 0)
  and (start_time is null or end_time is null or end_time >= start_time)
);

-- Costs not tied to a place (transport, misc). Estimated and actual kept apart.
create table if not exists public.user_trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.user_trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day smallint check (day is null or day between 1 and 30),
  category text not null check (category in ('accommodation', 'food', 'activity', 'transport', 'other')),
  label text not null check (char_length(label) between 1 and 120),
  amount numeric(12,2) not null check (amount >= 0),
  cost_type text not null default 'estimated' check (cost_type in ('estimated', 'actual')),
  created_at timestamptz not null default now()
);
create index if not exists user_trip_expenses_trip_idx on public.user_trip_expenses(trip_id);
alter table public.user_trip_expenses enable row level security;
drop policy if exists "trip expenses owner" on public.user_trip_expenses;
create policy "trip expenses owner" on public.user_trip_expenses for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.trip_owned_by(trip_id, auth.uid()));
revoke all on public.user_trip_expenses from anon;

-- ─────────────────────────────── Place data ───────────────────────────────

alter table public.places drop constraint if exists places_kind_check;
alter table public.places add constraint places_kind_check
  check (kind in ('attraction', 'restaurant', 'cafe', 'accommodation', 'activity', 'transport'));
alter table public.places add column if not exists address text;
alter table public.places add column if not exists phone text;
alter table public.places add column if not exists amenities text[] not null default '{}';
alter table public.places add column if not exists booking_url text;
alter table public.places drop constraint if exists places_booking_url_check;
alter table public.places add constraint places_booking_url_check check (booking_url is null or booking_url ~ '^https://');

-- Price provenance: data copied from an open provider (e.g. an OSM `charge`
-- tag) is neither "official" nor "confirmed by a booking provider".
alter table public.price_observations drop constraint if exists price_observations_provenance_check;
alter table public.price_observations add constraint price_observations_provenance_check
  check (provenance in ('confirmed_provider', 'official_published', 'provider_data', 'estimate'));

-- Ratings only from a licensed provider, with source and fetch time.
create table if not exists public.place_ratings (
  place_id text not null references public.places(id) on delete cascade,
  provider text not null,
  rating numeric(3,2) not null check (rating >= 0 and rating <= 5),
  review_count integer check (review_count is null or review_count >= 0),
  source_url text,
  fetched_at timestamptz not null default now(),
  primary key (place_id, provider)
);
alter table public.place_ratings enable row level security;
drop policy if exists "ratings read" on public.place_ratings;
create policy "ratings read" on public.place_ratings for select using (true);
drop policy if exists "ratings admin" on public.place_ratings;
create policy "ratings admin" on public.place_ratings for all using (public.is_admin()) with check (public.is_admin());
