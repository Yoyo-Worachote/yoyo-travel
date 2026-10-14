# Setup guide

The app runs with **no credentials at all** (demo mode). Each section below enables one
integration. Nothing here has been configured or tested against live services by the
developer of this repository unless stated in the README's status table.

## 1. Local development

Requirements: Node.js 20.11+ (22 LTS recommended), npm.

```bash
npm install
cp .env.example .env.local   # optional
npm run dev                  # http://localhost:3000
```

Production build: `npm run build && npm start`. All checks: `npm run check`.
Browser tests (Playwright, desktop + mobile): `npx playwright install chromium` once, then
`npm run build && npm run test:e2e` (starts `npm start` itself, or set `E2E_BASE_URL`).

Behind a corporate proxy, Node's `fetch` (used by the sync scripts) needs
`NODE_USE_ENV_PROXY=1` (Node ≥ 22.21) together with `HTTPS_PROXY`.

## 2. Supabase (database, auth, storage)

1. Create a project at <https://supabase.com> (free tier is enough for beta; check current limits).
2. Apply the schema — either:
   - **CLI:** `npx supabase link --project-ref <ref>` then `npx supabase db push`, or
   - **Dashboard:** SQL editor → run each file in `supabase/migrations/` in filename order.
3. Load the catalog seed (77 provinces + places): regenerate with `npm run db:seed-sql`, then
   `psql "<connection string>" -f supabase/seed.sql` (Project Settings → Database → connection string).
   The seed is large; the dashboard SQL editor may reject it — use `psql` or the CLI.
4. Project Settings → API: copy **Project URL** and **anon public key** into
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   Never put the `service_role` key in this app.
5. Authentication → URL Configuration:
   - Site URL: your production URL (e.g. `https://yoyo-travel.vercel.app`)
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://<your-domain>/auth/callback`
6. Make yourself admin after first sign-in (SQL editor):
   `update public.profiles set role = 'admin' where id = '<your auth user id>';`

User records written before the seed is loaded will fail (foreign keys to `places`),
so load the seed before inviting users. After re-running the sync scripts, regenerate
and re-apply the seed (it upserts).

### Username + password accounts

- Supabase → Authentication → Providers → **Email**: enabled, “Confirm email” ON (recommended).
- Users register with **username + email + password**. Usernames are unique (DB constraint +
  server check); passwords are handled only by Supabase Auth (hashed), never by this app.
- **Sign in with username** needs `SUPABASE_SERVICE_ROLE_KEY` (server-only env var, never
  `NEXT_PUBLIC_`). It is used for one RPC, `auth_email_for_username`, that only the service role
  may execute. Without it users sign in with their email; everything else works.
- Email templates (Authentication → Email Templates) can stay default; confirmation and
  password-reset links come back to `/auth/callback`, so add these Redirect URLs:
  `http://localhost:3000/auth/callback`, `https://<your-domain>/auth/callback`.
- Password reset: `/forgot-password` → email link → `/account/reset-password`.
- Self-service account deletion is on `/account` (RPC `delete_my_account`, cascades all user data).

### Guest mode and importing guest data

Without signing in, everything (trips, wishlist, passport) works and is stored in the browser's
localStorage (`yoyo-travel:demo-state:v1`). After a user signs in, the app offers to import those
records into the account; the import skips anything the account already has, so it never creates
duplicates and can be retried safely.

## 3. Google sign-in (via Supabase Auth)

1. Google Cloud Console → APIs & Services → **OAuth consent screen**: app name, support email,
   scopes `openid`, `email`, `profile` only.
2. Credentials → **Create OAuth client ID** → Web application.
   Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
   (shown in Supabase → Authentication → Providers → Google).
3. Supabase → Authentication → Providers → **Google**: enable, paste client ID and secret.
4. Restart the app. The header shows "Sign in"; `/login` offers "Sign in with Google".

## 4. AI chat

Server-side only; keys are never sent to the browser.

- **Gemini** (Google AI Studio): create a key at <https://aistudio.google.com>, set
  `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`, default `gemini-2.5-flash`). Free-tier
  availability, quotas and data-use terms change — verify before launch.
- **OpenAI** (or compatible): set `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4o-mini`),
  optional `OPENAI_BASE_URL`. Paid per token.
- With both set, Gemini is used unless `AI_PROVIDER=openai`.
- Rate limit: `CHAT_RATE_LIMIT_PER_MIN` (default 8 per IP per server instance, in memory).
  For strict limits across serverless instances, back it with a shared store (e.g. Redis).

## 5a. Live place data (optional, paid)

- **Google Places API (New)**: set `GOOGLE_PLACES_API_KEY` (server-only). Place pages then show
  rating, review count and price range from Google with attribution, fetched on demand and not
  cached (Google terms). Restrict the key to the Places API and set a budget alert in Google Cloud.
- Without the key the page says no rating data is available — nothing is estimated.

## 5. Web search for chat

- **Brave Search API** (<https://brave.com/search/api/>): set `BRAVE_SEARCH_API_KEY`.
  Check the current plan, monthly quota and terms for displaying results.
- Without it, chat answers only from the internal catalog and says it did not search the web.

## 6. Map tiles

Default tiles come from `tile.openstreetmap.org`, which is acceptable for light use under the
[OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/). For real traffic
use a tile provider and set `NEXT_PUBLIC_MAP_TILE_URL` (+ `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION`).
The CSP automatically allows the configured tile host.

## 7. Deploy to Vercel

1. Push the repo to GitHub and import it in Vercel (framework: Next.js).
2. Add the environment variables from `.env.example` that you use (Production + Preview).
3. Set `NEXT_PUBLIC_SITE_URL` to the deployment URL and add `<url>/auth/callback` to Supabase redirect URLs.
4. Deploy. Catalog JSON files are bundled via `outputFileTracingIncludes` in `next.config.ts`.
5. Verify with `BASE_URL=https://<your-deployment> npm run test:smoke`.

## 8. Refreshing data

```bash
npm run sync:provinces   # Wikidata + Wikipedia summaries + Commons images + geoBoundaries polygons
npm run sync:places      # Wikidata attractions + Commons images (≈ 15 min, polite pacing)
npm run sync:osm         # OSM venues via Overpass; saves after every province (hours when Overpass is busy)
npm run sync:osm -- nan  # re-sync selected provinces only (others keep their data)
npm run verify:data      # coverage, duplicates, province links, required fields
npm run db:seed-sql      # regenerate supabase/seed.sql
```

Scripts call public APIs sequentially with pauses and retries; set `SYNC_CONTACT` to an email
or URL so operators can reach you. Review `git diff src/data/generated` before committing.
