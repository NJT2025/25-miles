# 25 Miles — Project Status

_Last updated: 2026-04-22 (session 23)_

---

## Current Status: Live on Vercel

- **Production:** https://25-miles.vercel.app
- **GitHub:** https://github.com/NJT2025/25-miles (push to `main` = auto-deploy)
- **Database:** Supabase PostgreSQL, project ref `aiamulfuqekivgisdgeq`, eu-west-2

TypeScript: **0 errors**. Build: clean. All features functional. Tavily + Anthropic keys set in Vercel env vars.

**Dev server:** `node_modules/.bin/next dev` (port 3000)

---

## What Has Been Built

### Foundation
- **Next.js 14** (App Router, TypeScript, Tailwind CSS)
- **PostgreSQL 16** — Supabase cloud database, migrated via Prisma
- **Prisma v7** — driver adapter pattern (`@prisma/adapter-pg`)
- **Supabase Auth** (`@supabase/ssr`) — email/password, domain-restricted
- **shadcn/ui** — button, card, input, label, select, badge, dialog, textarea, separator, toast/toaster, checkbox, tooltip
- Earthy brand palette — background `#f7f5f0`, brand dark `#333331`, category group colours

---

### Authentication & Users

| File | Purpose |
|------|---------|
| `lib/supabase/server.ts` | Supabase server client (Server Components, API routes, middleware) |
| `lib/supabase/client.ts` | Supabase browser client (Client Components) |
| `lib/db/prisma.ts` | Prisma singleton with `PrismaPg` driver adapter |
| `app/(auth)/sign-in/page.tsx` | Sign-in page (Supabase Auth) |
| `app/(auth)/register/page.tsx` | Registration — domain-restricted via `ALLOWED_EMAIL_DOMAIN` |
| `app/api/auth/create-profile/route.ts` | Creates Prisma User row after Supabase signUp |
| `middleware.ts` | Supabase session refresh + protects `/projects`, `/admin`, `/library` routes |

---

### Category Taxonomy

`lib/category-definitions.ts` — 50 categories across 5 groups, with labels, group colours, and Tavily search query fragments.

**Groups:**
- Manufacturers (green `#4a7c59`)
- Suppliers (amber `#c8831a`)
- Craftspeople (terracotta `#b85c38`)
- Contractors & Specialists (slate blue `#4a6fa5`)
- Heritage Crafts (purple `#6b46c1`)

---

### AI Search Pipeline

| File | Purpose |
|------|---------|
| `lib/search/geocoder.ts` | postcodes.io (free) + Mapbox Geocoding API fallback; Haversine distance in miles |
| `lib/search/tavily.ts` | Tavily API client — returns up to 15 results per call |
| `lib/search/ai-extractor.ts` | Claude `claude-sonnet-4-6` — extracts structured `ExtractedSupplier[]` from Tavily pages; `temperature: 0` |
| `lib/search/url-validator.ts` | HTTP HEAD check (3s timeout, parallel); nulls invented/dead website URLs before DB save |
| `lib/search/pipeline.ts` | DB-first → session cache → Tavily → Claude extract → URL validate → geocode → DB upsert |
| `app/api/projects/[id]/search/route.ts` | POST — validates body (Zod), creates SearchSession, runs pipeline, returns results + sessionId |

**Pipeline flow:**
1. **DB-first** — query all `isPracticeSaved` suppliers with overlapping categories; upsert into new session immediately. Runs on every search — including cache hits — so newly-added library suppliers always appear.
2. **Session-level cache** — find a recent session (≤90 days) for this project with **exactly** the same categories (set + length) and **exactly** the same radius, ≥3 results. If found: clone those SearchResults (skip supplier IDs already added by DB-first), return. Any change to categories or radius triggers a fresh search. Keywords always bypass cache.
3. Resolve postcode → place name via `getPostcodeInfo` (postcodes.io `admin_county ?? region`)
4. **Two Tavily searches per group, in parallel** (deduplicated by URL):
   - General: `{category queries} {county/region} UK` (15 results, full page content)
   - Directory: same query restricted to Yell, Checkatrade, Trustatrader, FMB, Bark, IHBC, etc. (10 results)
5. Claude extraction → up to **25** `ExtractedSupplier[]` from Tavily pages. If 0 extracted: return practice suppliers only — **no AI knowledge fallback** (removed; was the primary source of hallucinated companies).
6. **URL validation** — parallel HEAD requests (3s timeout) for all extracted website URLs. Domains that fail to resolve (ENOTFOUND, timeout, ECONNREFUSED) are nulled before saving. 4xx/5xx left intact.
7. Geocode each supplier via postcodes.io → Mapbox fallback
8. Calculate Haversine distance from project site
9. Find-or-create supplier in DB (deduplicated on name + postcode); skip practiceSupplierIds
10. Upsert SearchResult; return sorted by distance

**Result limits:** No cap. Tavily: 15 general + 10 directory = up to 25 unique pages per group. Claude extractor cap: 25 suppliers, max_tokens: 8192.

---

### Practice Library

| File | Purpose |
|------|---------|
| `app/(dashboard)/library/page.tsx` | Server page — auth check, fetches first 50 `isPracticeSaved` suppliers + total |
| `components/library/LibraryPanel.tsx` | Client — debounced search (300ms), Add supplier dialog (full form + geocode), remove button, Load more |
| `app/api/library/route.ts` | GET (paginated, text search on name/postcode) / POST (create supplier with `isPracticeSaved:true`, geocodes postcode) |
| `app/api/library/[id]/route.ts` | DELETE — sets `isPracticeSaved=false` (soft remove, supplier record kept) |

**How it works:**
- When a user bookmarks a search result, the PATCH handler also sets `supplier.isPracticeSaved = true` (auto-promote).
- Un-saving a result does NOT remove from library — removal is explicit via the /library page.
- The Library page is accessible to all authenticated users (nav link in header).
- The Add Supplier dialog geocodes the postcode so manually-added suppliers have lat/lng for distance calculations.

---

### Project Management

| File | Purpose |
|------|---------|
| `app/api/projects/route.ts` | POST create (geocodes postcode), GET list |
| `app/api/projects/[id]/route.ts` | GET / PATCH (edit + auto-geocode on postcode change) / DELETE |
| `app/api/projects/[id]/sessions/route.ts` | GET session summaries list |
| `app/(dashboard)/projects/page.tsx` | Projects list — cards with search count, last-updated, inline Delete |
| `app/(dashboard)/projects/new/page.tsx` | Create project form |
| `components/project/DeleteProjectButton.tsx` | Client component — inline confirm/cancel delete from project list |

---

### Project Search Page

| File | Purpose |
|------|---------|
| `app/(dashboard)/projects/[id]/page.tsx` | Server component — parallel-fetches project + latest session + allSessions |
| `components/project/ProjectSearchPage.tsx` | Main client component — all state, edit modal, delete, session switcher, saved tab, CSV export, dismiss |
| `components/map/ProjectMap.tsx` | react-map-gl/maplibre + Turf radius rings + GeoJSON cluster layers |
| `components/search/CategoryPanel.tsx` | Grouped checkboxes with select-all/clear per group |
| `components/search/ResultsList.tsx` | Within-radius / beyond-radius / national sections + expand-radius + dismiss + pagination |
| `components/search/SearchResultCard.tsx` | Card with distance, categories, contact links, heritage badges, quality badges, save toggle, dismiss (X) |
| `components/search/SupplierDetailPanel.tsx` | Full detail view in right panel on card click |
| `app/api/projects/[id]/results/route.ts` | GET (?sessionId / ?saved=true) / PATCH (toggle `isSaved` → auto-promotes to library; `isDismissed`) |

**UI layout:**
- Top bar: project name + Pencil edit, postcode, radius input (1–200mi), Search button
- Left panel (224px): CategoryPanel + keyword refinement input + "Clear search" button
- Centre: MapLibre map (CartoDB Positron tiles, no key needed)
- Right panel (320px): Results/Saved toggle + session dropdown + accreditations filter + Printer/Download icon

**Key behaviours:**
- Results paginate at 20 per section (within / beyond); "Show N more" button loads next 20; resets on new results
- Radius re-filters results client-side without API call; "Expand radius" doubles it (capped 200mi)
- **Dismiss (X)** — persisted server-side (`isDismissed` on `SearchResult`), optimistic client update, excluded from print
- Session dropdown updates immediately after search (local state, no router.refresh)
- Saved tab fetches across all sessions; CSV export downloads saved results
- Pencil icon → edit modal (name / postcode / radius); postcode change re-geocodes
- Delete project in edit modal or from project list cards
- Toast on search complete, save/unsave toggle
- National known suppliers in third section, excluded from withinCount

---

### Map

| File | Purpose |
|------|---------|
| `components/map/ProjectMap.tsx` | Full map with rings, clustering, popup, legend |

- **Library:** react-map-gl@7 (maplibre adapter) + maplibre-gl@4.7.1 — **must stay at `^4.x`**
- **Tiles:** CartoDB Positron — no API key required
- **Radius rings:** Concentric circles every 5 miles; outer solid, inner dashed; stacked translucent fills
- **Clustering:** GeoJSON `<Source cluster clusterRadius={40} clusterMaxZoom={13}>` with three layers:
  - `clusters` — dark circle with count label; click zooms to expand (`getClusterExpansionZoom` Promise API)
  - `unclustered-point` — coloured by category group; selected point enlarges + inverts colours
  - `unclustered-label` — number label on each point
- Click on cluster → `map.easeTo` zoom in. Click on point → opens SupplierDetailPanel. Click on background → deselects.
- Cursor changes to pointer over interactive layers (`interactiveLayerIds` + `onMouseEnter`/`onMouseLeave` on `<Map>`)

---

### Quality Signal Badges

On each `SearchResultCard`, below the category badge:
- **Purple "In Library"** — `supplier.isPracticeSaved === true`
- **Green "Verified"** — `supplier.isVerified === true`
- **Grey source pill** — always shown: `"Manual"` (isManualEntry), `"Web"` (has sourceUrl), `"AI"` (knowledge fallback)

---

### Print Report

| File | Purpose |
|------|---------|
| `app/(print)/layout.tsx` | Auth-only layout (no nav) |
| `app/(print)/projects/[id]/print/page.tsx` | Server page — ownership check, null-coord guard, fetches session + non-dismissed results |
| `components/print/PrintReportPage.tsx` | Client — captures map canvas via `onLoad` callback, auto-prints A4 layout |

- Renders hidden 700×350 map with `preserveDrawingBuffer: true`
- Waits for map `idle` event, captures canvas, fires `window.print()` after 200ms
- Table: Within radius / Beyond radius / National suppliers sections
- Dismissed results excluded from print output

---

### Admin Panel

| File | Purpose |
|------|---------|
| `app/(dashboard)/admin/page.tsx` | Server page — ADMIN role only; loads first 50 suppliers + total count |
| `components/admin/AdminSupplierPanel.tsx` | Filter, add supplier manually, verify, delete, "Load more" pagination |
| `app/api/suppliers/route.ts` | GET (paginated) / POST create (ADMIN only) |
| `app/api/suppliers/[id]/route.ts` | PATCH verify/update / DELETE (ADMIN only) |

---

## Database Schema

```
User          → Project (1:many)
Project       → SearchSession (1:many)
SearchSession → SearchResult (1:many)
SearchResult  → Supplier (many:1)
```

Key fields:
- `Supplier.categories: String[]` — array of CategoryCode values
- `Supplier.isPracticeSaved: Boolean @default(false)` — in practice library; injected into every search
- `Supplier.isManualEntry: Boolean @default(false)` — added via Admin or Library form
- `Supplier.isVerified: Boolean @default(false)` — admin-verified
- `Supplier.heritageRiskLevel: String?` — CRITICALLY_ENDANGERED | ENDANGERED | CULTURALLY_DISTINCTIVE | RESURGENT
- `SearchResult.distanceMiles: Float` — `Infinity` stored as `99999` in API responses (JSON-safe)
- `SearchResult.isSaved: Boolean` — bookmarked; triggers auto-promote to library on PATCH
- `SearchResult.isDismissed: Boolean @default(false)` — hidden from view + print report

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_..."   # new Supabase key format (was eyJ...)
SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."            # new Supabase key format (was eyJ...)
DATABASE_URL="postgresql://postgres.[ref]:[pw]@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[pw]@db.[ref].supabase.co:5432/postgres"

ALLOWED_EMAIL_DOMAIN="tonicarchitecture.co.uk"
TAVILY_API_KEY="..."
ANTHROPIC_API_KEY="..."
MAPBOX_TOKEN=""              # optional — postcodes.io is primary geocoder
NEXT_PUBLIC_MAPBOX_TOKEN=""  # optional — CartoDB tiles used for map display
```

---

## Known Limitations

| Issue | Notes |
|---|---|
| Session dropdown limited to 20 most-recent sessions | `take: 20` in server page + sessions API |
| Saved tab `isWithinRadius` uses stored value | Shows flag from search time. Cosmetic only. |
| Library search only filters name + postcode | Category text not searchable from library panel |
| Map cluster click requires two taps on mobile | MapLibre cluster expand is a zoom, not a modal |

---

## Phase 3 — Next Steps

- [ ] Remove `ALLOWED_EMAIL_DOMAIN` restriction for public launch
- [ ] Supplier self-registration with admin approval queue
- [ ] Supplier profile pages (`/suppliers/[id]`)
- [ ] Search analytics dashboard (most-searched categories, top suppliers)
- [ ] Password reset flow

---

## Session Change Log

### Session 1 — 2026-03-16
Initial full build: foundation, auth, pipeline, UI, admin, DB schema.

### Session 2 — 2026-03-18 (sprint 1)
1. Result caching (per-supplier, 90-day window)
2. Expand radius button
3. Project edit modal (Pencil icon → Dialog → PATCH)
4. Toast notifications
5. Search history (session dropdown)
6. Heritage craft data + 18 additional categories

### Session 3 — 2026-03-18 (sprint 2 + bug check)
7. Session dropdown local state update (no router.refresh)
8. Saved results tab (cross-session)
9. CSV export
10. Supplier detail panel (SupplierDetailPanel.tsx)
11. Delete project (edit dialog + API)
12. Admin pagination (Load more)
13. Bug fix: removed lat/lng from PATCH project schema (injection vulnerability)
14. Bug fix: SupplierDetailPanel "Infinity mi" → "Location not available"

### Session 4 — 2026-03-18 (env config)
15. Replaced expired Anthropic API key
16. Fixed NEXTAUTH_URL port mismatch

### Session 5 — 2026-03-18 (print report + national suppliers)
17. Print/export report — (print) route group, PrintReportPage with canvas capture + auto-print
18. National known suppliers — third section in ResultsList, excluded from withinCount

### Sessions 6–12 — 2026-03-26 (bug fixes + UX improvements)
19. **Map fix** — downgraded `maplibre-gl` 5.20.2 → 4.7.1 (react-map-gl@7 peer dep `<5.0.0`)
20. **Switched to CartoDB Positron tiles** — no Mapbox API key needed for map display
21. **Concentric radius rings** — every 5 miles, stacked translucent fills, dashed inner / solid outer
22. **Print report fix** — map canvas capture via `onLoad` prop instead of `useEffect`
23. **Cache fix** — changed from per-supplier `hasSome` count to session-level `hasEvery` + `radius: {gte}` cache
24. **Cache fix** — excluded current sessionId from cache query
25. **Claude determinism** — `temperature: 0` on both extraction functions
26. **Radius in Claude prompt** — knowledge-base fallback now receives radius
27. **geocodePostcode** — PATCH /api/projects/[id] now uses postcodes.io instead of Mapbox
28. **distanceMiles Infinity** — API routes return `99999`; UI checks `>= 99999`
29. **Project ownership check** — PATCH /api/projects/[id]/results verifies user owns project
30. **Radius cap** — radius input capped to max 200 miles
31. **No result limit** — Tavily 8→15, Claude generator targets increased
32. **Dismiss feature** — X button hides results client-side; resets on new search
33. **Delete from project list** — DeleteProjectButton on project cards

### Session 13 — 2026-03-26 (cache exact-match + out-of-radius styling)
34. **Cache exact-match fix** — changed to exact category set (length check) + exact radius. Any change triggers fresh search.
35. **Out-of-radius red styling** — red border + red distance text for beyond-radius results

### Session 14 — 2026-04-10 (persist dismiss)
36. **Persist dismiss** — `isDismissed Boolean @default(false)` on `SearchResult` (migration). PATCH accepts `{ isDismissed }`. Client initialises dismissed Set from session results.
37. **Search route restored** — `app/api/projects/[id]/search/route.ts` recreated (was missing).

### Session 15 — 2026-04-10 (bug fixes)
38. **Print page restored** — `app/(print)/projects/[id]/print/page.tsx` recreated with `isDismissed: false` filter.
39. **Search API validation** — Zod schema: categories non-empty, radius 1–200.
40. **Unsafe session assertions** — Replaced `session!.user.id` with explicit null guards.
41. **Stale pipeline comment** — Updated cache block comment to reflect exact-match semantics.
42. **Corrupted node_modules** — Full clean reinstall (`npm cache clean --force && rm -rf node_modules package-lock.json && npm install`).

### Session 16 — 2026-04-10 (accreditations filter + keyword search)
43. **Accreditations filter** — pill filter chips in results panel; filters results to suppliers with matching accreditations.
44. **Keyword refinement** — text input in left panel appended to Tavily query; always runs fresh (bypasses cache).

### Session 17 — 2026-04-16 (deploy + search improvements)
45. **Deployed to Vercel** — GitHub `NJT2025/25-miles`, Supabase `aiamulfuqekivgisdgeq` (eu-west-2). All env vars set.
46. **Dual Tavily searches** — parallel general + directory-targeted queries per category group; deduped by URL.
47. **Full page content** — `include_raw_content: true` on both Tavily searches.
48. **Extraction cap raised** — Claude extracts up to 25 suppliers; max_tokens doubled to 8,192.
49. **Location-based query** — Tavily queries use `adminCounty ?? region` (place names, not postcode phrases).
50. **`getPostcodeInfo`** — new function fetching `admin_district`, `admin_county`, `region` from postcodes.io.

### Session 23 — 2026-04-22 (Supabase security hardening)
74. **RLS enabled on all tables** — Row-Level Security enabled on `User`, `Project`, `Supplier`, `SearchSession`, `SearchResult`, and `_prisma_migrations`. User-scoped policies added (auth.uid() checks). Resolves Supabase critical security alert `rls_disabled_in_public`. Prisma/server connections unaffected (postgres superuser bypasses RLS). Migration: `20260422000000_enable_rls`. Applied directly via pg client (DIRECT_URL port 5432 was blocked on local network).
75. **DIRECT_URL corrected** — Updated `.env.local` to use `db.[ref].supabase.co:5432` (direct host) instead of the session-mode pooler.

### Session 22 — 2026-04-21 (default radius)
73. **Default search radius changed to 12.5 miles** — updated in new project form state, API Zod schema default, and `prisma/schema.prisma` column default (was 25.0). Deployed.

### Session 21 — 2026-04-21 (security: key rotation)
70. **Vercel security incident** — Vercel flagged `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and `TAVILY_API_KEY` as "Need To Rotate".
71. **Keys rotated** — All three rotated at source (Supabase dashboard + Tavily dashboard), updated in Vercel env vars and `.env.local`. Vercel redeployed.
72. **Supabase key format migration** — Supabase has migrated from JWT (`eyJ...`) to new prefixed format: `NEXT_PUBLIC_SUPABASE_ANON_KEY` is now `sb_publishable_...`; `SUPABASE_SERVICE_ROLE_KEY` is now `sb_secret_...`. Both legacy and new formats available under "Legacy anon, service_role API keys" tab.

### Session 20 — 2026-04-20 (anti-hallucination)
66. **Removed `claudeGenerateSuppliers`** — the knowledge-base fallback was fabricating company names, addresses, phone numbers and websites with no real-world grounding. Removed from `ai-extractor.ts` entirely.
67. **Removed zero-results and <5-results supplement** — pipeline now returns only practice library suppliers when Tavily/extraction yields nothing. No invented data is shown.
68. **Website URL validation** — new `lib/search/url-validator.ts` performs parallel HTTP HEAD requests (3s timeout) for all extracted URLs. Domains that fail to resolve are nulled before DB save; 4xx/5xx responses are left intact.
69. **Improved empty state** — `ResultsList` now distinguishes "never searched" from "searched but nothing found", showing a helpful message with suggestions when a search returns 0 results. `ProjectSearchPage` tracks `hasSearched` state.

### Session 19 — 2026-04-20 (search query refinement + deploy fixes)
62. **Search query refinement** — updated Tavily `searchQuery` fragments for 12 categories: added `woodfibre` to MFR natural insulation; expanded SUP natural insulation; expanded SUP glazing with slim/vacuum double glazing terms; expanded CRAFT joiner with `joinery carpentry cabinetmaker cabinetry`; added `plastering` to lime plasterers; added `heritage` to blacksmiths; added `listed building` to 5 heritage craft queries; added `historic` to heritage woodwork.
63. **Deploy fix** — removed orphaned NextAuth route files (`app/api/auth/[...nextauth]/route.ts`, `app/api/auth/register/route.ts`) that referenced non-existent `lib/auth.ts` and uninstalled `bcryptjs`. App uses Supabase Auth throughout — these were never needed.
64. **API key rotation** — Anthropic API key was exposed in conversation; rotated at console.anthropic.com; updated in `.env.local` and Vercel env vars.
65. **Tavily API key added** — `TAVILY_API_KEY` was empty; live key added to `.env.local` and Vercel env vars. Searches now use real web results rather than Claude knowledge fallback only.

### Session 18 — 2026-04-17 (Phase 2: practice library, clustering, pagination, quality badges)
51. **Schema** — `isPracticeSaved Boolean @default(false)` added to `Supplier` (migration `20260417111922_add_ispracticesaved`).
52. **Auto-promote on bookmark** — PATCH isSaved=true also sets `supplier.isPracticeSaved=true`. Un-saving does not reverse.
53. **DB-first pipeline** — practice-saved suppliers injected at start of every search (before cache check). Cache-hit path deduplicates against practice supplier IDs.
54. **Bug fix** — DB-first now runs before cache return (previously unreachable on cache hits).
55. **Bug fix** — Claude fallback failure returns practice suppliers already collected, not empty array.
56. **Library API** — `GET /api/library` (paginated, text search), `POST /api/library` (create + geocode), `DELETE /api/library/[id]` (soft remove).
57. **Library page** — `/library` server page + `LibraryPanel` client component (debounced search, add dialog, remove, load more). Nav link added to header for all users.
58. **Quality signal badges** — `SearchResultCard` now shows purple "In Library", green "Verified", grey "AI"/"Web"/"Manual" pills. `SupplierRow` extended with `isPracticeSaved` + `isManualEntry`.
59. **Map clustering** — replaced individual `<Marker>` components with GeoJSON `<Source cluster>` + `clusters`, `cluster-count`, `unclustered-point`, `unclustered-label` layers. Click cluster = zoom in; click point = select.
60. **Results pagination** — `ResultsList` shows 20 at a time in within/beyond sections; "Show N more" appends next 20; resets on new results.
61. **Bug fix** — LibraryPanel search debounced 300ms (previously fired on every keystroke).
