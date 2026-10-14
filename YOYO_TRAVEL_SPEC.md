# YOYO TRAVEL — Product Specification

## 1. Product vision

Build **Yoyo Travel**, a polished, usable travel discovery web app and personal travel passport. Beta covers Thailand only, but the architecture must support adding countries later.

Tagline: **Explore More. Collect Memories.**

The app combines:
- Interactive Thailand map with clickable province boundaries
- Province and place discovery
- Random province, place, and trip generator
- Travel Passport dashboard tracking visited provinces and places
- Top 10 and seasonal recommendations with transparent sources
- Restaurants, menus, food photos, accommodations, activities, approximate prices
- Search and AI travel chat with web search and citations when configured
- Google sign-in and private per-user travel records
- Trip planning and wishlist

Do not claim to collect every item from every website or social network. Use permitted APIs/open data, official sources, and manual admin curation where useful. Never fabricate real-world places, ratings, prices, reviews, images, citations, or live search results.

## 2. Work rules

1. Inspect the current directory before changing anything. Do not delete unrelated work.
2. Build and run a real app; do not stop at a plan, README, or static mockup.
3. Make reasonable engineering decisions without asking about every small choice.
4. If credentials are unavailable, implement the integration boundary, `.env.example`, setup instructions, and a clear disabled state or demo fallback. Never expose secrets in client code.
5. Do not claim an integration works until it has been configured and tested.
6. Run type checks, lint, production build, and available tests; fix errors before reporting completion.
7. Keep the core experience functional without paid APIs wherever feasible.
8. Explain the final result in Thai, including what works, what needs credentials, how to run it, and actual test results.

## 3. Suggested stack

Prefer:
- Next.js + TypeScript
- Tailwind CSS and shadcn/ui or an equivalent maintainable component system
- Supabase PostgreSQL, Auth, and Storage
- Supabase Auth with Google OAuth
- Leaflet + OpenStreetMap for maps
- GeoJSON for real province boundaries
- Provider adapters for place data, web search, AI, image sources, and pricing
- Deployment compatibility with Vercel and Supabase

Choose a simpler or better-supported alternative if justified. Prioritize low cost, maintainability, security, and a usable beta. Document any paid-service dependencies.

## 4. Design and navigation

Design a premium, friendly, modern travel product. Use forest green, sage, warm white, charcoal, and restrained accent colors. Large destination photography, clean cards, readable Thai typography, sensible whitespace, consistent spacing and components. Responsive for desktop, tablet, and mobile. Include loading, empty, error, retry, and success states. Do not use emoji as a substitute for every icon.

Main pages:
- Home / Discover
- Explore Thailand
- Province detail
- Place detail
- Top 10 / Seasonal / Trending
- Randomizer
- My Travel Passport
- Wishlist
- Trip Planner
- AI Travel Chat
- Admin/data management, protected to authorized admins only

## 5. Home / Discover

Include:
- Hero section with Thailand travel imagery and search
- Search for provinces, places, food, hotels, and activities
- Random Province, Random Place, and Random Trip actions
- Interactive Thailand map
- Popular provinces and curated destinations
- Top 10 / seasonal sections
- Restaurants and local dishes
- Accommodations and activities
- Passport progress and wishlist entry points for signed-in users

Use sections and carousels where appropriate; do not overwhelm users with one huge list.

## 6. Thailand map

Implement an actual interactive map using real geographic province polygons from a permitted GeoJSON source. Thailand Beta should cover all 77 provinces including Bangkok.

Requirements:
- Clickable province polygons, not approximate CSS drawings or just floating markers
- Thai and English names
- Hover tooltip, click-through to province detail
- Visited / partly explored / not visited visual states based on the signed-in user's records
- Province search, region filters, legend, zoom, reset
- Mobile-friendly list fallback
- Attribution and license compliance for boundary data
- Graceful fallback if map data fails to load

## 7. Province detail

Every province should have its own shareable route, e.g. `/thailand/chiang-mai`.

Show when available:
- Cover image, Thai/English name, summary, highlights, best season
- Province map and key places
- Mark province visited, add to wishlist/trip, randomize within province
- Attractions: nature, beaches, mountains, waterfalls, parks, culture, temples, history, communities, shopping, markets
- Restaurants, cafes, local dishes, menu prices and food photos when verified
- Hotels, resorts, hostels, accommodation price ranges
- Activities and experiences
- Transport information and approximate trip costs
- Top attractions, nearby places, useful source links
- Visited and unvisited places for the current user
- AI chat preloaded with province context

Filters: category, free/paid, family, couple, solo, day trip/overnight, budget level, and other filters supported by real data. Show a clear empty state rather than inventing content.

## 8. Place detail

Create shareable place pages with:
- Name, category, province, coordinates/map
- Relevant photos and attribution
- Description, opening hours, admission fee, price range, suggested duration and season when sourced
- Directions, official website, map navigation link
- Source/provider, last checked date
- Mark visited, wishlist, add to trip, share
- Nearby places and context-aware AI questions

Clearly distinguish confirmed provider prices, official published prices, and estimates. If no reliable price is found, say so.

## 9. Randomizer

Build working randomization, not decorative buttons.

Random Province filters:
- Region
- Budget
- Trip duration
- Solo/couple/family/friends
- Interests (nature, beach, mountain, culture, cafes, food, shopping, activities)
- Exclude visited or prioritize unvisited
- Wishlist preferences if useful

Random Place: choose from actual records matching selected province and filters, and explain why it fits.

Random Trip: propose a 1–3 day outline with actual places, food stops, and activities that match preferences. Order geographically where reliable distance data exists. Respect opening hours when known and warn users to re-check details before travel. Never claim to have made a booking.

## 10. My Travel Passport

Personal dashboard must be backed by persistent data:
- Count of visited provinces, visited places, unvisited provinces, and progress percentage
- Thailand map colored by province status
- Travel timeline, latest visited places, places to visit, planned trips
- Category breakdowns and useful summaries
- Province states: Not Visited, Visited, Want to Visit
- Place visit record: date, private note, personal rating/tags, optional personal photos
- Wishlist grouped by province; move items to visited or trip plan without duplicates

Keep province-level visited state separate from place-level visits. A visited province does not mean every place in it has been visited. Define progress clearly; province progress can be visited provinces / 77.

Privacy defaults to private. Do not expose travel history, personal photos, or notes without explicit user choice and authorization.

## 11. Top 10 and trending

Create:
- Top 10 provinces
- Top 10 attractions in Thailand
- Top 10 restaurants, cafes, accommodations, activities
- Free attractions, family-friendly, couples, seasonal picks
- Top 10 per province
- Time filters such as this week, this month, season, all time where data supports it

Each ranking must state its basis and source/date. Use labels such as “Editor’s Picks” if editorially selected. Only call a list “Trending Now” when recent data supports that claim. Never fabricate review counts, ratings, rankings, or popularity statistics.

## 12. Data aggregation and providers

Build normalized provider adapters so sources can be added/removed independently. Evaluate, where terms permit:
- OpenStreetMap / Overpass
- Wikidata / Wikipedia
- Thai government open data and Tourism Authority of Thailand resources where usable
- Google Places API if justified by budget and terms
- Foursquare or other licensed places providers
- Official attraction, restaurant, hotel, and activity websites
- Licensed booking/affiliate APIs
- Web search providers such as Brave Search API or an equivalent
- Social platform APIs only where authorized

Requirements:
- Store provider, external ID, source URL, fetched date, updated date, and attribution/license metadata as needed
- Normalize records and deduplicate by external ID, coordinates, and name
- Cache results, rate-limit requests, and avoid expensive API calls on every page view
- Support scheduled sync where appropriate and manual admin additions
- Respect API terms, robots/access rules, copyrights, and rate limits
- Do not scrape prohibited sources or bypass login/paywalls
- Do not claim all social posts are available; platform APIs often restrict access
- If a provider lacks credentials, disable that adapter without breaking other app features

Seed all 77 provinces with verified names and region mappings. Place-level coverage should grow from legitimate sources; never pretend that a small seed dataset is exhaustive.

## 13. Photos, food, accommodations, prices

Use images from providers and sources whose licenses/terms permit display, e.g. Wikimedia Commons, Unsplash, or licensed provider photos. Follow attribution requirements. Use lazy loading, optimized sizes, and a tasteful placeholder.

Only associate a food image with the correct restaurant/menu when supported by source data. Do not use random photos as if they depict a named place.

Restaurant data where available:
- Name, cuisine/category, average spend per person, price range
- Menu names/prices and relevant dish photos
- Opening hours, location, sources, last checked date

Accommodation data where available:
- Name, type, location, relevant photos and facilities
- Approximate price per night and source/last checked date
- Official or authorized booking link

Prices depend on date, occupancy, room/menu choices, and availability. If no live pricing API exists, do not claim a displayed price is current or guaranteed. Label estimates and provide source/date. Do not invent menus or prices.

## 14. AI Travel Chat with web search

Add a floating chat available from every page. It should answer in Thai and support:
- Destination recommendations
- Itinerary suggestions and budgets
- Restaurant/menu and accommodation comparisons
- Seasonal travel suggestions
- Transport and nearby places
- Questions about the current province/place
- Follow-up questions

Use a provider adapter for the model and a separate search adapter. Evaluate a provider with a free tier (e.g. Gemini, subject to current terms) and optional OpenAI/other providers if the owner supplies credentials. Do not assume any provider is permanently free.

Answer flow:
1. Understand the question and page context.
2. Query internal place data first when relevant.
3. Search the web when needed and configured.
4. Give the model only relevant retrieved material.
5. Display source cards/links for web-derived claims.
6. Distinguish verified facts from estimates and suggestions.
7. State uncertainty or missing data.
8. Never invent URLs, search results, prices, reviews, or citations.
9. Never claim a live search happened unless it actually happened.

Include loading/searching states, suggested prompts, clear-chat, input limits, rate limits, API error handling, and no secret keys in browser code. Without credentials, explain setup and leave ordinary discovery usable.

## 15. Google login and authorization

Use Google OAuth through Supabase Auth. Support login, logout, sessions, protected routes, profile name/avatar where consented, and persistent personal travel records. If OAuth is not configured, offer a clearly labeled demo/preview mode; do not pretend Google login is working.

Use Row Level Security or equivalent authorization for every user-owned record. A user must only read/write their own profile, visited places, visited provinces, notes, wishlist, trips, and chat history. Never trust a client-supplied user ID alone for authorization. Never expose a Supabase service-role key in frontend code. Admin actions must be server-authorized.

## 16. Trip planner

Allow users to:
- Create and name a trip, set dates and province
- Add places, restaurants, lodging, and activities
- Arrange stops by day
- Add notes and budget
- Show known costs separately from estimates
- View route/stops on a map
- Save and edit plans
- Share/export later if feasible

Do not implement actual booking or imply a reservation was made. Use official/authorized outbound links where possible.

## 17. Admin and data quality

Protected admin tools should support:
- Review/add/edit/hide places and categories
- Duplicate detection
- Photo/source attribution review
- Source URL and data freshness
- Sync logs and errors
- Manual sync where supported
- Draft/review/published status
- Curated editorial rankings

Label data appropriately: Verified (only when criteria are met), Provider Data, Estimated, Community, Editor’s Pick, or Demo. Store conflicting provider observations separately where needed. Never label AI-generated guesses as verified.

## 18. Database design

Design a documented schema and relationships. Expected entities include:
- countries, regions, provinces
- places, place_categories, place_images, place_sources
- restaurants, menus, accommodations, activities
- price_observations, rankings
- profiles
- user_province_progress, user_place_visits, user_wishlist
- user_trips, user_trip_items
- user_reviews/personal ratings
- chat_sessions, chat_messages (only if chat history is enabled)
- data_sync_logs

Choose sensible normalization rather than blindly creating unnecessary tables. Include UUIDs or suitable primary keys, foreign keys, unique constraints, indexes, timestamps, migrations, seed scripts, RLS policies, and schema/ER documentation. Keep public place data separate from private user records.

## 19. Search

Support Thai/English name search, provinces, categories, food/menu, accommodations, activities, budget, visited/unvisited, and wishlist. Use debouncing and pagination/infinite scroll as appropriate. Location-based search must ask permission and offer manual province selection.

## 20. Security, accessibility, and performance

- Validate inputs client- and server-side
- Protect against SQL injection and XSS
- Keep secrets in environment variables
- Rate-limit expensive APIs and AI usage
- Set appropriate security headers
- Handle errors without exposing secrets
- Use caching, pagination, image optimization, lazy loading
- Support keyboard navigation and accessible labels
- Make layouts responsive
- Keep personal data minimal and private by default
- Include a basic privacy notice for third-party providers

## 21. Beta delivery priorities

### Core Beta — complete first
1. Home/discover
2. Real Thailand province map and 77 province records
3. Province pages and place search
4. Random province/place
5. Place photos/data from configured permitted sources
6. Travel Passport and visited tracking
7. Wishlist
8. Transparent Top 10 / editor picks
9. Database, migrations, RLS
10. Google OAuth integration
11. AI chat/search integration with sources when credentials are configured
12. Responsive design
13. Run/deploy/setup documentation
14. Automated tests for core logic

### Extended Beta — only after Core Beta is stable
- Full trip planner
- More data providers and scheduled sync
- Trending analytics
- Expanded admin dashboard
- Public passport/sharing
- Affiliate links
- Additional countries
- Social features

Do not sacrifice a functional core to build every extension at once.

## 22. Tests and definition of done

Test:
- Home loads
- Province map selection and province search work
- Province/place detail routes work
- Randomizer respects filters and uses real records
- Visited state and wishlist persist
- Passport metrics update correctly
- User data is isolated by authorization/RLS
- Admin routes are protected
- Chat handles provider errors and only cites real sources
- Source links and image attribution render correctly
- TypeScript, lint, production build, and available tests pass
- Check major responsive layouts and browser errors

Do not report untested integrations as passed. If credentials are missing, document precisely what could not be tested.

## 23. Final deliverables

Provide:
- Working source code
- Frontend/backend
- Database schema and migrations
- Seed data for 77 Thai provinces
- `.env.example` without real secrets
- Google OAuth, Supabase, AI, and search provider setup guides
- Local run and deployment instructions
- Actual provider list, costs/limits to verify, and known limitations
- Completed vs credential-blocked features
- Actual build/test results

The app is done when it runs locally, the core UI and interactions work, map selection is real, user visit tracking persists, private data is isolated, provider integrations are honest about their configuration, no fake real-world data is presented as fact, and the production build passes.

## 24. Start now

Inspect the working directory and environment, then implement the app continuously through the definition of done. Do not return only a plan. Make sensible choices, keep costs low, and report the final result in Thai with exact commands to run the app and a truthful list of what is working versus awaiting credentials.

## 25. Internationalization (Thai / English)

Yoyo Travel must support Thai and English throughout the entire application.

### Language defaults
- Thai (`th`) is the default language for new visitors.
- English (`en`) is fully supported as an alternative.
- Display a visible TH / EN language switcher in the main navigation and mobile menu.
- Remember the user's selected language across visits.
- If a user has already selected a language, do not automatically override their preference.

### Translation coverage
Translate all user-facing interface elements, including:
- Navigation, page titles, buttons, forms, filters, and menus
- Home and discovery pages
- Province and place pages
- Randomizer and trip planner
- Travel Passport and dashboard
- Top 10 and recommendation sections
- AI Travel Chat interface
- Authentication, settings, validation messages, empty states, loading states, and errors
- Admin interface where practical

Do not mix Thai and English randomly within the same interface, except for proper nouns, brand names, and terms that are intentionally kept in English.

### Implementation
- Use a maintainable internationalization solution appropriate for Next.js.
- Store translations in structured Thai and English locale files rather than hardcoding interface text throughout components.
- Use Thai as the fallback locale.
- Ensure language switching updates the interface without deleting or resetting user data.
- Use locale-aware date, number, currency, and price formatting.
- Structure routes and metadata so the application can support Thai and English SEO where practical.

### Travel data
- Store Thai and English names separately when available, such as `name_th` and `name_en`, or use an equivalent structured localization model.
- Preserve original names when a translation is unavailable.
- Do not invent translations of official place names.
- Search should support both Thai and English names.
- Province and place records must remain the same underlying records regardless of selected language.

### AI Travel Chat
- Reply in Thai when the user asks in Thai.
- Reply in English when the user asks in English.
- Respect the selected interface language where appropriate.
- Preserve official place names and provide translated names when available.
- Keep source links, citations, and factual accuracy consistent across languages.

### Acceptance criteria
- A first-time visitor sees the Thai interface by default.
- Users can switch between Thai and English from desktop and mobile.
- All core pages and workflows work in both languages.
- Language switching preserves login state, visited places, wishlist, and trip plans.
- Missing translations fall back gracefully without breaking the layout.
- Automated tests cover language switching and important translated routes.