-- Yoyo Travel — initial schema
-- Public catalog (countries → regions → provinces → places + details) is kept
-- separate from private per-user records (profiles, user_*). Every user-owned
-- table has Row Level Security restricting access to auth.uid().
-- See docs/DATABASE.md for the ER diagram and design notes.

-- gen_random_uuid() is built into PostgreSQL 13+ (no extension needed).

-- ─────────────────────────────── Public catalog ───────────────────────────────

create table public.countries (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name_th text not null,
  name_en text not null
);

create table public.regions (
  id text primary key,
  country_code text not null references public.countries(code),
  name_th text not null,
  name_en text not null
);

create table public.provinces (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  iso_code text not null unique,
  country_code text not null references public.countries(code),
  region_id text not null references public.regions(id),
  name_th text not null,
  name_en text not null,
  wikidata_id text,
  centroid_lat double precision,
  centroid_lng double precision,
  created_at timestamptz not null default now()
);
create index provinces_region_idx on public.provinces(region_id);

create table public.place_categories (
  id text primary key check (id ~ '^[a-z_]+$'),
  name_th text not null,
  name_en text not null
);

-- One row per real-world place. Restaurants, cafes, accommodation and
-- activities are places with a different `kind`; kind-specific details live in
-- menu_items and price_observations instead of near-duplicate tables.
create table public.places (
  id text primary key check (id ~ '^(wd|osm|manual)-[A-Za-z0-9-]+$'),
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  province_slug text not null references public.provinces(slug),
  kind text not null check (kind in ('attraction','restaurant','cafe','accommodation','activity')),
  category text not null references public.place_categories(id),
  name_th text,
  name_en text,
  description_th text,
  description_en text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  website text check (website is null or website ~ '^https?://'),
  opening_hours text,
  fee text check (fee in ('free','paid')),
  status text not null default 'published' check (status in ('draft','review','published','hidden')),
  data_label text not null default 'provider'
    check (data_label in ('provider','editor','community','verified','estimated','demo')),
  provider text not null check (provider in ('wikidata','osm','manual')),
  external_id text not null,
  source_url text,
  license text,
  attribution text,
  fetched_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint places_name_present check (coalesce(name_th, name_en) is not null),
  constraint places_provider_external_unique unique (provider, external_id),
  constraint places_province_slug_unique unique (province_slug, slug)
);
create index places_province_idx on public.places(province_slug);
create index places_kind_category_idx on public.places(kind, category);
create index places_status_idx on public.places(status);
create index places_name_th_idx on public.places(lower(name_th));
create index places_name_en_idx on public.places(lower(name_en));

create table public.place_images (
  id uuid primary key default gen_random_uuid(),
  place_id text not null references public.places(id) on delete cascade,
  url text not null check (url ~ '^https://'),
  author text not null,
  license text not null,
  license_url text,
  source_url text not null,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  unique (place_id, url)
);

-- Raw observations from each provider, kept separately so conflicts are visible.
create table public.place_sources (
  id uuid primary key default gen_random_uuid(),
  place_id text not null references public.places(id) on delete cascade,
  provider text not null,
  external_id text,
  source_url text,
  observed jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  unique (place_id, provider, external_id)
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  place_id text not null references public.places(id) on delete cascade,
  name_th text,
  name_en text,
  price numeric(10,2) check (price is null or price >= 0),
  currency text not null default 'THB',
  photo_url text,
  photo_attribution text,
  source_url text not null,
  observed_at date not null,
  check (coalesce(name_th, name_en) is not null)
);
create index menu_items_place_idx on public.menu_items(place_id);

-- Prices are observations with an explicit provenance label, never "current".
create table public.price_observations (
  id uuid primary key default gen_random_uuid(),
  place_id text not null references public.places(id) on delete cascade,
  price_type text not null check (price_type in ('admission','room_night','avg_spend','menu','activity')),
  amount_min numeric(10,2) check (amount_min is null or amount_min >= 0),
  amount_max numeric(10,2) check (amount_max is null or amount_max >= amount_min),
  currency text not null default 'THB',
  provenance text not null check (provenance in ('confirmed_provider','official_published','estimate')),
  source_url text,
  observed_at date not null,
  note text
);
create index price_observations_place_idx on public.price_observations(place_id);

create table public.rankings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_th text not null,
  title_en text not null,
  basis_th text not null,
  basis_en text not null,
  label text not null check (label in ('editor_pick','data_based')),
  province_slug text references public.provinces(slug),
  as_of date not null,
  status text not null default 'draft' check (status in ('draft','published')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.ranking_items (
  ranking_id uuid not null references public.rankings(id) on delete cascade,
  rank smallint not null check (rank between 1 and 100),
  place_id text references public.places(id) on delete cascade,
  province_slug text references public.provinces(slug),
  note text,
  primary key (ranking_id, rank),
  check ((place_id is null) <> (province_slug is null))
);

create table public.data_sync_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  scope text,
  status text not null check (status in ('running','success','partial','error')),
  records integer,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- ─────────────────────────────── Users ───────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 120),
  avatar_url text,
  locale text not null default 'th' check (locale in ('th','en')),
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_province_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  province_slug text not null references public.provinces(slug),
  status text not null check (status in ('visited','want')),
  updated_at timestamptz not null default now(),
  primary key (user_id, province_slug)
);

-- Place-level visits are independent of province status.
create table public.user_place_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null references public.places(id) on delete cascade,
  visited_on date not null default current_date,
  note text check (char_length(note) <= 2000),
  rating smallint check (rating between 1 and 5),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 10),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, place_id)
);
create index user_place_visits_user_idx on public.user_place_visits(user_id, visited_on desc);

create table public.user_wishlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table public.user_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  province_slug text references public.provinces(slug),
  start_date date,
  end_date date check (end_date is null or start_date is null or end_date >= start_date),
  budget numeric(12,2) check (budget is null or budget >= 0),
  notes text check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_trips_user_idx on public.user_trips(user_id);

create table public.user_trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.user_trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null references public.places(id) on delete cascade,
  day smallint not null default 1 check (day between 1 and 30),
  position smallint not null default 0 check (position >= 0),
  note text check (char_length(note) <= 1000),
  estimated_cost numeric(12,2) check (estimated_cost is null or estimated_cost >= 0),
  created_at timestamptz not null default now(),
  unique (trip_id, place_id)
);
create index user_trip_items_trip_idx on public.user_trip_items(trip_id, day, position);

-- ─────────────────────────────── Functions & triggers ───────────────────────────────

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger places_touch before update on public.places
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger user_place_visits_touch before update on public.user_place_visits
  for each row execute function public.touch_updated_at();
create trigger user_trips_touch before update on public.user_trips
  for each row execute function public.touch_updated_at();

-- Create a profile for each new auth user (name/avatar from the OAuth consent).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), 120),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- API users may not change their own role (only display fields). The project
-- owner grants admin from the SQL editor (runs as postgres, not an API role).
create or replace function public.protect_profile_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role
     and current_user in ('anon', 'authenticated')
     and not public.is_admin() then
    raise exception 'role can only be changed by an admin';
  end if;
  return new;
end;
$$;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- A trip item must belong to a trip owned by the same user.
create or replace function public.trip_owned_by(trip uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_trips where id = trip and user_id = uid);
$$;

-- ─────────────────────────────── Row Level Security ───────────────────────────────

alter table public.countries enable row level security;
alter table public.regions enable row level security;
alter table public.provinces enable row level security;
alter table public.place_categories enable row level security;
alter table public.places enable row level security;
alter table public.place_images enable row level security;
alter table public.place_sources enable row level security;
alter table public.menu_items enable row level security;
alter table public.price_observations enable row level security;
alter table public.rankings enable row level security;
alter table public.ranking_items enable row level security;
alter table public.data_sync_logs enable row level security;
alter table public.profiles enable row level security;
alter table public.user_province_progress enable row level security;
alter table public.user_place_visits enable row level security;
alter table public.user_wishlist enable row level security;
alter table public.user_trips enable row level security;
alter table public.user_trip_items enable row level security;

-- Public reference data: readable by everyone, writable by admins.
create policy "countries read" on public.countries for select using (true);
create policy "regions read" on public.regions for select using (true);
create policy "provinces read" on public.provinces for select using (true);
create policy "categories read" on public.place_categories for select using (true);
create policy "countries admin" on public.countries for all using (public.is_admin()) with check (public.is_admin());
create policy "regions admin" on public.regions for all using (public.is_admin()) with check (public.is_admin());
create policy "provinces admin" on public.provinces for all using (public.is_admin()) with check (public.is_admin());
create policy "categories admin" on public.place_categories for all using (public.is_admin()) with check (public.is_admin());

-- Places: only published rows are public; admins see and edit everything.
create policy "places read published" on public.places for select using (status = 'published' or public.is_admin());
create policy "places admin write" on public.places for all using (public.is_admin()) with check (public.is_admin());

create policy "images read approved" on public.place_images for select
  using (review_status = 'approved' or public.is_admin());
create policy "images admin" on public.place_images for all using (public.is_admin()) with check (public.is_admin());
create policy "sources admin read" on public.place_sources for select using (public.is_admin());
create policy "sources admin" on public.place_sources for all using (public.is_admin()) with check (public.is_admin());
create policy "menu read" on public.menu_items for select using (true);
create policy "menu admin" on public.menu_items for all using (public.is_admin()) with check (public.is_admin());
create policy "prices read" on public.price_observations for select using (true);
create policy "prices admin" on public.price_observations for all using (public.is_admin()) with check (public.is_admin());
create policy "rankings read published" on public.rankings for select using (status = 'published' or public.is_admin());
create policy "rankings admin" on public.rankings for all using (public.is_admin()) with check (public.is_admin());
create policy "ranking items read" on public.ranking_items for select using (
  exists (select 1 from public.rankings r where r.id = ranking_id and (r.status = 'published' or public.is_admin()))
);
create policy "ranking items admin" on public.ranking_items for all using (public.is_admin()) with check (public.is_admin());
create policy "sync logs admin" on public.data_sync_logs for all using (public.is_admin()) with check (public.is_admin());

-- Profiles: a user reads/updates only their own row; admins can read all.
create policy "profiles self read" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Private travel records: owner only.
create policy "province progress owner" on public.user_province_progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "visits owner" on public.user_place_visits for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "wishlist owner" on public.user_wishlist for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "trips owner" on public.user_trips for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "trip items owner" on public.user_trip_items for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.trip_owned_by(trip_id, auth.uid()));

-- Anonymous visitors never touch private tables at all.
revoke all on public.profiles, public.user_province_progress, public.user_place_visits,
  public.user_wishlist, public.user_trips, public.user_trip_items, public.data_sync_logs from anon;

-- IDs of provider records an admin has hidden/unpublished, so the app can
-- filter its committed catalog. Exposes only IDs, never row contents.
create or replace function public.unpublished_place_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select id from public.places where status <> 'published' and provider <> 'manual';
$$;
grant execute on function public.unpublished_place_ids() to anon, authenticated;
