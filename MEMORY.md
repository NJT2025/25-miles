# 25 Miles — Developer Memory

_Last updated: 2026-04-20 (session 19)_

Quick reference for Claude Code sessions. Full feature inventory is in STATUS.md.

---

## Project

Next.js 14 / PostgreSQL / Prisma v7 / Supabase Auth / shadcn/ui platform for architecture practices to source local building materials, craftspeople, and contractors within a specified radius of a project site.

- **Local:** http://localhost:3000 (run with `node_modules/.bin/next dev`)
- **Production:** https://25-miles.vercel.app (Vercel + Supabase)
- **GitHub:** https://github.com/NJT2025/25-miles (push to main = auto-deploy)
- **Database:** Supabase PostgreSQL — project ref `aiamulfuqekivgisdgeq`, eu-west-2
- **Auth:** Supabase Auth (`@supabase/ssr`) — domain restricted to `tonicarchitecture.co.uk`

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database | PostgreSQL 16 + Prisma v7 (driver adapter) |
| Auth | Supabase Auth (`@supabase/ssr`) — domain restricted via `ALLOWED_EMAIL_DOMAIN` |
| UI | Tailwind CSS + shadcn/ui |
| Map | react-map-gl v7 (maplibre adapter) + maplibre-gl **4.7.1** |
| Map tiles | CartoDB Positron (no API key needed) |
| Radius geometry | @turf/circle (miles → km conversion) |
| Geocoding | postcodes.io (free, primary) + Mapbox (fallback) |
| Live search | Tavily API |
| AI extraction | Claude API (`claude-sonnet-4-6`, temperature: 0) |

**Critical version constraint:** `maplibre-gl` must stay at `^4.x`. react-map-gl@7 peer dep is `<5.0.0`. Do NOT upgrade to v5.

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/category-definitions.ts` | 50-category taxonomy, 5 groups, colours, Tavily query fragments |
| `lib/search/geocoder.ts` | postcodes.io + Mapbox fallback; Haversine distance; `getPostcodeInfo` for region/county lookup |
| `lib/search/tavily.ts` | Tavily API client — supports `includeRawContent` and `includeDomains` options |
| `lib/search/ai-extractor.ts` | Claude API — extracts ExtractedSupplier[]; temperature: 0 |
| `lib/search/pipeline.ts` | **DB-first** → session cache → Tavily → Claude → geocode → DB upsert → SearchResult |
| `lib/supabase/server.ts` | Supabase server client (Server Components, API routes, middleware) |
| `lib/supabase/client.ts` | Supabase browser client (Client Components) |
| `lib/db/prisma.ts` | Prisma singleton with PrismaPg driver adapter |
| `app/api/projects/[id]/search/route.ts` | POST — Zod validation, creates session, runs pipeline, returns results |
| `app/api/projects/[id]/results/route.ts` | GET + PATCH (isSaved → auto-promotes supplier to library; isDismissed) |
| `app/api/library/route.ts` | GET (paginated + text search) / POST (create practice supplier, geocodes postcode) |
| `app/api/library/[id]/route.ts` | DELETE — sets `isPracticeSaved=false` (soft remove from library) |
| `components/project/ProjectSearchPage.tsx` | Main client component — all search state, map, filters, results, dismiss |
| `components/project/DeleteProjectButton.tsx` | Inline delete confirm/cancel on project list cards |
| `components/map/ProjectMap.tsx` | MapLibre map + Turf rings + **GeoJSON cluster layers** (click cluster = zoom in) |
| `components/search/CategoryPanel.tsx` | Grouped checkbox filter panel |
| `components/search/ResultsList.tsx` | Within / beyond / national sections + dismiss + **20-result pagination** |
| `components/search/SearchResultCard.tsx` | Card with save, dismiss, heritage badges, **quality signal badges** (In Library / Verified / AI/Web/Manual) |
| `components/search/SupplierDetailPanel.tsx` | Full supplier detail in right panel |
| `components/library/LibraryPanel.tsx` | Practice library — search (debounced 300ms), add supplier dialog, remove, load more |
| `app/(dashboard)/library/page.tsx` | Server page — fetches first 50 practice-saved suppliers |
| `app/(print)/projects/[id]/print/page.tsx` | Server page — ownership check, fetches session (non-dismissed results only) |
| `components/print/PrintReportPage.tsx` | Canvas capture via onLoad, auto-print A4 layout |
| `components/admin/AdminSupplierPanel.tsx` | Admin: manual entry, verify, delete, filter, load more |
| `prisma/schema.prisma` | User, Project, Supplier, SearchSession, SearchResult models |
| `prisma.config.ts` | Prisma v7 config — loads .env.local, sets datasource URL |

---

## Data Models (summary)

| Model | Key fields |
|-------|-----------|
| `User` | id (Supabase UUID), email, name, organisation, role (USER\|ADMIN) |
| `Project` | id, userId, name, postcode, lat, lng, radius (default 25.0) |
| `Supplier` | id, name, description, address, postcode, lat, lng, phone, email, website, categories String[], accreditations String[], isVerified, isManualEntry, isNationalKnown, **isPracticeSaved**, sourceUrl, heritageRiskLevel, heritageCraftType |
| `SearchSession` | id, projectId, categories String[], radius |
| `SearchResult` | id, sessionId, supplierId, distanceMiles, isWithinRadius, isSaved, isDismissed, rank |

**distanceMiles note:** Infinity is stored in DB for suppliers with no geocoded location. The results API routes sanitise this to `99999` before sending JSON. All UI code checks `>= 99999` (not `=== Infinity`).

**isPracticeSaved note:** Set to `true` when a user bookmarks a search result (auto-promote in PATCH handler). Suppliers with `isPracticeSaved=true` are injected at the start of every new search. Removing from /library sets it back to `false`; un-bookmarking a result does NOT remove it.

---

## Search Pipeline Flow

```
1. DB-FIRST  — inject practice-saved suppliers (hasSome category overlap) into session
               → runs on EVERY search, including cache hits
2. CACHE     — find session ≤90 days old, exact categories + exact radius, ≥3 results
               → if hit: merge cached results (skip already-added practice IDs), return
3. TAVILY    — two parallel searches per group: general + directory-targeted (deduped by URL)
4. CLAUDE    — extract up to 25 suppliers (temperature: 0); knowledge fallback if 0 Tavily results
5. GEOCODE   — postcodes.io → Mapbox fallback per supplier
6. UPSERT    — find-or-create Supplier (name+postcode), skip practiceSupplierIds
7. SORT      — return results sorted by distanceMiles
```

**Cache is exact match:** `hasEvery` (all categories present) + code-level length check (no extras) + `radius: { equals }`. Any change → fresh search. Keywords always bypass cache.

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/create-profile` | POST | Create Prisma User row after Supabase signUp (domain check + upsert) |
| `/api/projects` | GET/POST | List / create project |
| `/api/projects/[id]` | GET/PATCH/DELETE | Project CRUD |
| `/api/projects/[id]/search` | POST | Run AI search pipeline (Zod validated: categories[], radius 1–200) |
| `/api/projects/[id]/results` | GET/PATCH | Get results / toggle `isSaved` (auto-promotes to library) or `isDismissed` |
| `/api/projects/[id]/sessions` | GET | Session summaries list |
| `/api/suppliers` | GET/POST | List / admin create |
| `/api/suppliers/[id]` | PATCH/DELETE | Admin: verify or delete |
| `/api/library` | GET/POST | Practice library — list (q, skip, take) / create with isPracticeSaved:true |
| `/api/library/[id]` | DELETE | Remove from library (sets isPracticeSaved=false) |

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."   # needed for domain-restricted user deletion in create-profile
DATABASE_URL="postgresql://postgres.[ref]:[pw]@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[pw]@aws-1-eu-west-2.pooler.supabase.com:5432/postgres"
# Note: DIRECT_URL uses the SESSION MODE pooler (port 5432 on pooler host) — direct port 5432 is blocked on many networks

ALLOWED_EMAIL_DOMAIN="tonicarchitecture.co.uk"
TAVILY_API_KEY="..."
ANTHROPIC_API_KEY="..."
MAPBOX_TOKEN=""              # optional
NEXT_PUBLIC_MAPBOX_TOKEN=""  # optional
```

---

## Dev Setup

```bash
node_modules/.bin/next dev     # port 3000
```

If node_modules is corrupted (missing files), the safe fix is:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
npx prisma generate
```

---

## Known Gotchas

- **maplibre-gl version lock:** Must stay at `^4.x`. react-map-gl@7 peer dep `<5.0.0`. Had 5.20.2 installed at one point — map rendered tiles but markers and layers silently failed.
- **Map import:** `react-map-gl/maplibre` (not `react-map-gl`). The `maplibre` subdirectory must be present in `node_modules/react-map-gl/` — it can go missing after a partial npm install.
- **Turf import:** `import turfCircle from "@turf/circle"` (default export)
- **Map clustering:** Uses GeoJSON `<Source cluster>` + Layer components. `onClick` handlers go on the `<Map>` component (not `<Layer>`) using `interactiveLayerIds`. `GeoJSONSource.getClusterExpansionZoom` is Promise-based in maplibre-gl 4.x.
- **MapLibre expression types:** Complex DSL expressions (match, case, step) are typed `as any` to avoid verbose union inference errors. This is intentional.
- **prisma migrate / generate:** requires `DATABASE_URL` in env; `prisma.config.ts` loads `.env.local` via dotenv
- **Print report:** map canvas capture uses `onLoad` prop on `<Map>`, NOT `useEffect` (ref is null at mount)
- **Dismiss is persisted:** `isDismissed` field on `SearchResult`. Client uses optimistic update (fire-and-forget PATCH). Dismissed items excluded from print report via server-side filter.
- **isPracticeSaved auto-promote:** PATCH isSaved=true → also sets supplier.isPracticeSaved=true. Un-saving does NOT reverse this — requires explicit removal from /library.
- **DB-first must run before cache return:** Practice suppliers are injected before the cache short-circuit so new library additions appear even on cached searches.
- **Claude fallback:** if Tavily returns 0 results, pipeline calls `claudeGenerateSuppliers`. Both use `temperature: 0`.
- **`npm run dev` may behave oddly** — use `node_modules/.bin/next dev` directly
- **TypeScript check:** use `node_modules/.bin/tsc --noEmit` (not `npx tsc` — that installs a wrong package)
