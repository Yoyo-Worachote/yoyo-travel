# Data sources, licenses, costs

| Source | Used for | License / terms | Cost | Status |
|---|---|---|---|---|
| **Wikidata** (SPARQL) | Province names/IDs/ISO codes; attraction records (name TH/EN, description, coordinates, website, Wikipedia links, sitelink count) | CC0 1.0 | Free; public endpoint with query time limits — sync runs offline | Synced (`src/data/generated/*.json`) |
| **Wikimedia Commons** API | Photos for provinces/places with author + license per file | Per-file (CC BY, CC BY-SA, PD…). Files without a machine-readable license are skipped | Free | Synced; credit shown on every photo |
| **Wikipedia** REST summary | Province summaries (TH/EN) with link back | CC BY-SA 4.0 (attributed + linked) | Free | Synced |
| **geoBoundaries** gbOpen THA ADM1 | 77 province polygons | ODbL 1.0 (source: OpenStreetMap / Wambacher) | Free | `public/geo/thailand-provinces.geojson` |
| **OpenStreetMap** via Overpass | Restaurants, cafes, hotels/hostels/guest houses, viewpoints, zoos/theme parks — name, cuisine, opening_hours, website, stars, fee | ODbL 1.0, “© OpenStreetMap contributors” | Free; shared service — keep queries sequential and infrequent | Synced |
| **OSM tiles** | Map background | Tile usage policy; attribution shown | Free for light use | Default; replace for production traffic |
| **Thai Meteorological Department** | General 3-season climate guidance (region level) | Linked, paraphrased general facts | — | Static text, labelled as general guidance |
| **Gemini / OpenAI** | AI chat answers | Provider terms; verify data-use and free-tier limits | Free tier may exist (Gemini) / paid | Adapter ready, **not configured** |
| **Brave Search API** | Web results for chat with citations | Brave API terms | Free/paid plans — verify | Adapter ready, **not configured** |
| **Supabase** | Auth (Google), Postgres + RLS, Storage | Supabase terms | Free tier for beta | Schema + client ready, **not configured** |

## What we deliberately do **not** have

- **Prices, menus, food photos, review scores, popularity/visitor statistics, live hotel rates.**
  No permitted source is integrated yet. The UI says so ("no reliable price found") instead of
  estimating. `menu_items` and `price_observations` tables exist for sourced data with provenance.
- **Social media content** — platform APIs restrict access; not integrated.
- **Google Places / TAT / booking APIs** — would need budget, keys and terms review. Add them as
  new adapters (`scripts/sync/*` or a server adapter) that output the same `Place` shape with
  `source.provider`, `externalId`, `url`, `license`, `fetchedAt`.

## Coverage (generated data at time of sync)

- 77/77 provinces with TH/EN names and polygons.
- Attractions: Wikidata items located in Thailand with coordinates and ≥1 Wikipedia article or a
  Commons image (geographic features need ≥2 articles or an image), assigned to provinces by
  point-in-polygon, max 60 per province balanced by category, ranked by sitelinks.
- Food/stays/activities: named OSM POIs per province, the most completely tagged first
  (≈14 restaurants, 8 cafes, 14 accommodations, 8 activities per province).

This is a sample of well-documented places, **not** an exhaustive list.

Snapshot synced 2026-10-14 (check with `npm run verify:data`):

| | Count |
|---|---|
| Provinces | 77/77 (TH/EN names, polygon, Wikipedia summary TH+EN); 75 with a licensed cover photo (Loei, Nan: none on Wikidata) |
| Wikidata attractions | 2,383 — every province has some (13–60 each) |
| OSM venues | 2,775 — every province has restaurants, cafes and accommodation (8–44 each) |
| In the app / seed | 5,152 places (6 OSM POIs that point to an existing Wikidata item are merged away) |
| Licensed photos | 1,184 place photos |

Overpass returned HTTP 504 for Chaiyaphum and Chiang Rai on the first pass; they were re-synced with
retries, a fallback endpoint and partial-result detection (`remark` timeouts are treated as failures).
Duplicates (same name ≤ 300 m) are removed during sync; about 1% of OSM venues sit just across a
border of the simplified polygons and keep the province OSM assigned.

## Data labels shown to users

`Provider data` (Wikidata/OSM as fetched), `Editor's pick` / `Community` (manual admin entries),
`Estimated` (heuristics such as distance-based budget, companion suitability), `Verified`
(reserved — only when criteria are met; currently unused), `Demo` (unused; no demo place data exists).

## Rankings basis

- "Top attractions" = number of Wikipedia language editions (Wikidata sitelinks) — a proxy for
  international documentation, **not** reviews or visitor numbers. Shown with as-of date.
- "Top provinces" = number of attractions in our dataset (data coverage).
- "Trending" is not shown: we have no recent usage data.
