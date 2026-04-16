# 25 Miles — Project Status

_Last updated: 2026-04-16 (session 17 — deploy + search improvements)_

---

## Current Status: Live on Vercel

- **Production:** https://25-miles.vercel.app
- **GitHub:** https://github.com/NJT2025/25-miles (push to `main` = auto-deploy)
- **Database:** Supabase PostgreSQL, project ref `aiamulfuqekivgisdgeq`, eu-west-2

TypeScript: **0 errors**. All features functional. Tavily + Anthropic keys set in Vercel env vars.

**Dev server:** `node_modules/.bin/next dev` (port 3000)

---

## What Has Been Built

### Foundation
- **Next.js 14** (App Router, TypeScript, Tailwind CSS)
- **PostgreSQL 16** — Supabase cloud database, migrated via Prisma
- **Prisma v7** — driver adapter pattern (`@prisma/adapter-pg`)
- **Supabase Auth** (`@supabase/ssr`) — email/password, domain-restricted, replaced NextAuth
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
| `middleware.ts` | Supabase session refresh + protects `/projects` and `/admin` routes |

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
| `lib/search/tavily.ts` | Tavily API client — returns up to **15** results |
| `lib/search/ai-extractor.ts` | Claude `claude-sonnet-4-6` — extracts structured `ExtractedSupplier[]`; `temperature: 0` for deterministic output |
| `lib/search/pipeline.ts` | Session-level cache → Tavily → Claude → geocode → DB upsert → SearchResult |
| `app/api/projects/[id]/search/route.ts` | POST — validates body (Zod), creates SearchSession, runs pipeline, returns results + sessionId |

**Pipeline flow:**
1. **Session-level cache** — find a recent session (≤90 days) for this project with **exactly** the same categories (same set + same length) and **exactly** the same radius. If found and has ≥3 results: clone SearchResults and return immediately. Any change to categories or radius triggers a fresh search.
2. Resolve postcode → place name via `getPostcodeInfo` (postcodes.io `admin_county ?? region`)
3. **Two Tavily searches run in parallel** (deduplicated by URL before Claude sees them):
   - General: `{category queries} {county/region} UK` (15 results, full page content)
   - Directory: same query restricted to Yell, Checkatrade, Trustatrader, FMB, Bark etc. (10 results, full page content)
4. Claude extraction → up to **25** `ExtractedSupplier[]` from combined pages; falls back to Claude knowledge-base if Tavily returns nothing
5. Geocode each supplier via postcodes.io (postcode) then Mapbox (address)
6. Calculate Haversine distance from project site
7. Find-or-create supplier in DB (deduplicated on name + postcode)
8. Upsert SearchResult linked to session
9. Return sorted by distance

**Result limits:** No cap on results. Tavily: 15 general + 10 directory = up to 25 unique pages. Claude extractor cap: 25 suppliers, max_tokens: 8192.

---

### Project Management

| File | Purpose |
|------|---------|
| `app/api/projects/route.ts` | POST create (geocodes postcode), GET list |
| `app/api/projects/[id]/route.ts` | GET / PATCH (edit + auto-geocode on postcode change) / DELETE |
| `app/api/projects/[id]/sessions/route.ts` | GET session summaries list |
| `app/(dashboard)/projects/page.tsx` | Projects list — cards with search count, last-updated, and inline Delete button |
| `app/(dashboard)/projects/new/page.tsx` | Create project form |
| `components/project/DeleteProjectButton.tsx` | Client component — inline confirm/cancel delete from project list |

---

### Project Search Page

| File | Purpose |
|------|---------|
| `app/(dashboard)/projects/[id]/page.tsx` | Server component — parallel-fetches project + latest session + allSessions |
| `components/project/ProjectSearchPage.tsx` | Main client component — all state, edit modal, delete, session switcher, saved tab, CSV export, dismiss |
| `components/map/ProjectMap.tsx` | react-map-gl/maplibre + Turf concentric radius rings (every 5mi), numbered colour-coded markers |
| `components/search/CategoryPanel.tsx` | Grouped checkboxes with select-all/clear per group |
| `components/search/ResultsList.tsx` | Within-radius / beyond-radius / national sections + expand-radius button + dismiss passthrough |
| `components/search/SearchResultCard.tsx` | Card with distance, categories, contact links, heritage badges, save toggle, **dismiss (X) button**; **red border + red distance text** when outside radius |
| `components/search/SupplierDetailPanel.tsx` | Full detail view in right panel on card click |
| `app/api/projects/[id]/results/route.ts` | GET (?sessionId / ?saved=true) / PATCH (toggle `isSaved` or `isDismissed`, with project ownership check) |

**UI layout:**
- Top bar: project name + Pencil edit, postcode, radius input (capped 1–200mi), Search button
- Left panel (224px): CategoryPanel + "New search" button
- Centre: MapLibre map (CartoDB Positron tiles, no key needed)
- Right panel (320px): Results/Saved toggle + session dropdown + Printer/Download icon → results or detail

**Key behaviours:**
- Radius re-filters results client-side without API call; "Expand radius" doubles it (capped 200mi)
- **Dismiss (X)** — persisted server-side (`isDismissed` on `SearchResult`). Dismissed results are hidden from the current view, survive page reload, and are excluded from print reports. Resets on new search (new session = all `isDismissed: false`).
- Session dropdown updates immediately after search (local state)
- Saved tab fetches across all sessions; CSV export downloads saved results
- Pencil icon → edit modal (name / postcode / radius); postcode change re-geocodes
- Delete project in edit modal → redirect to /projects; also available from project list cards
- Toast on search complete, save/unsave toggle
- National known suppliers shown in third section, excluded from withinCount
- Printer icon opens print report in new tab when session is active

---

### Map

- **Map library:** `react-map-gl@7` (maplibre adapter) + `maplibre-gl@4.7.1`
  - **Important:** `maplibre-gl` must stay at `^4.x` — react-map-gl@7 has a peer dep `<5.0.0`
- **Tiles:** CartoDB Positron — no API key required
- **Radius:** Concentric rings every 5 miles; outer ring solid, inner rings dashed; stacked translucent fills create tonal gradient
- **Markers:** Numbered dots, colour-coded by primary category group; click opens SupplierDetailPanel

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
- Dismissed results are excluded from print output

---

### Admin Panel

| File | Purpose |
|------|---------|
| `app/(dashboard)/admin/page.tsx` | Server page — ADMIN role; loads first 50 suppliers + total count |
| `components/admin/AdminSupplierPanel.tsx` | Filter, add supplier, verify, delete, "Load more" pagination |
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
- `Supplier.heritageRiskLevel: String?` — CRITICALLY_ENDANGERED | ENDANGERED | CULTURALLY_DISTINCTIVE | RESURGENT
- `SearchResult.distanceMiles: Float` — `Infinity` stored as `99999` in API responses (JSON-safe)
- `SearchResult.isSaved: Boolean`
- `SearchResult.isDismissed: Boolean @default(false)` — persisted server-side
- `SearchSession.radius: Float`

---

## Environment Variables

```
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
ALLOWED_EMAIL_DOMAIN=tonicarchitecture.co.uk

TAVILY_API_KEY=
ANTHROPIC_API_KEY=
MAPBOX_TOKEN=          # server-side geocoding (optional — postcodes.io used as primary)
NEXT_PUBLIC_MAPBOX_TOKEN=  # client-side map (not needed — CartoDB tiles used)
```

---

## Known Limitations

| Issue | Notes |
|---|---|
| Session dropdown limited to 20 most-recent sessions | `take: 20` in server page + sessions API |
| Saved tab `isWithinRadius` uses stored value | Shows flag from search time. Cosmetic only. |
| No deployment | Local only — Vercel + Supabase when ready |

---

## Not Yet Built / Next Steps

### Immediate
- [x] **Persist dismiss** — `isDismissed Boolean @default(false)` on `SearchResult`; PATCH endpoint extended; client initialises dismissed Set from loaded results and persists on dismiss; print report filters dismissed results
- [x] **Accreditations filter** — implemented (session 16)
- [x] **Search refinement** — keyword input appended to Tavily query (session 16)
- [x] **Deploy** — live at https://25-miles.vercel.app (Vercel + Supabase)

### Phase 2
- [ ] **Search refinement** — keyword input appended to Tavily query (e.g. "listed building", "conservation area")
- [ ] **Supplier quality signals** — badge for AI-generated vs Tavily-sourced vs manually verified results
- [ ] **Map clustering** — group dense markers at low zoom
- [ ] **Results pagination** — "Load more" for very large result sets

### Phase 3 — Public Launch
- [ ] Remove `ALLOWED_EMAIL_DOMAIN` restriction
- [ ] Supplier self-registration with admin approval
- [ ] Supplier profile pages (`/suppliers/[id]`)
- [ ] Search analytics dashboard
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
22. **Print report fix** — map canvas capture via `onLoad` prop instead of `useEffect` (mapRef was null at mount)
23. **Cache fix** — changed from per-supplier `hasSome` count to session-level `hasEvery` + `radius: {gte}` cache
24. **Cache fix** — excluded current sessionId from cache query (was finding itself, cache always hit)
25. **Claude determinism** — `temperature: 0` on both `extractSuppliers` and `claudeGenerateSuppliers`
26. **Radius in Claude prompt** — Claude knowledge-base fallback now receives radius and spreads results across full area
27. **geocodePostcode** — PATCH /api/projects/[id] now uses postcodes.io (free) instead of Mapbox geocodeAddress
28. **distanceMiles Infinity** — API routes now return `99999` instead of `null` (JSON.stringify(Infinity) = null); all UI checks updated to `>= 99999`
29. **Project ownership check** — PATCH /api/projects/[id]/results now verifies user owns project before toggling isSaved
30. **Radius cap** — radius input capped to max 200 miles
31. **No result limit** — Tavily 8→15, Claude generator 6–8→10–15 targets, max_tokens increased
32. **Dismiss feature** — X button on each SearchResultCard removes it from view client-side; resets on new search
33. **Delete from project list** — DeleteProjectButton on project cards (no need to enter edit modal)

### Session 13 — 2026-03-26 (re-search fix + out-of-radius styling)
34. **Cache exact-match fix** — changed session cache from `hasEvery`/`gte` (superset/range match) to exact match: same category set (length check) + exact radius. Any change to categories or radius now triggers a fresh Tavily+Claude search. Root cause: broad initial searches cached for all subsequent narrower searches, making the UI appear stuck.
35. **Out-of-radius red styling** — SearchResultCard now shows a red border and red distance text (`"42.3 mi — outside radius"`) for any supplier outside the search radius, making beyond-radius results clearly distinct from within-radius ones.

### Session 14 — 2026-04-10 (persist dismiss + search route)
36. **Persist dismiss** — added `isDismissed Boolean @default(false)` to `SearchResult` schema (migration `20260410144429_add_isdismissed`). PATCH `/api/projects/[id]/results` now accepts `{ resultId, isDismissed }` alongside `isSaved`. GET responses include `isDismissed`. Client initialises dismissed Set from loaded session results and calls PATCH fire-and-forget on dismiss; `handleSessionChange` also repopulates dismissed Set from fetched results.
37. **Search route restored** — `app/api/projects/[id]/search/route.ts` was missing (empty directory). Recreated: auth → Zod validation → geocode project → create SearchSession → run pipeline → fetch persisted results → return `{ sessionId, projectLat, projectLng, results }` including `isDismissed`.

### Session 17 — 2026-04-16 (deploy + search improvements)
43. **Deployed to Vercel** — GitHub repo `NJT2025/25-miles`, Supabase project `aiamulfuqekivgisdgeq` (eu-west-2). Prisma migrations run via Session mode pooler (port 5432 on pooler host — direct port 5432 blocked on office network). All 8 env vars set in Vercel dashboard.
44. **Dual Tavily searches** — pipeline now runs two searches in parallel: general query + directory-targeted query (Yell, Checkatrade, Trustatrader, FMB, Bark, etc.). Results deduplicated by URL before Claude extraction.
45. **Full page content** — `include_raw_content: true` on both Tavily searches; Claude sees up to 3,000 chars of full page text per result (vs short snippet previously). Directory pages now expose their full listings.
46. **Extraction cap raised** — Claude now extracts up to 25 suppliers (was 15); `max_tokens` doubled to 8,192.
47. **Location-based query** — Tavily queries now use `adminCounty ?? region` (e.g. "London", "Gloucestershire") instead of `"within X miles of [postcode]"`. The old phrasing never matched business websites or directories; place names do.
48. **`getPostcodeInfo`** — new function in `geocoder.ts` fetches `admin_district`, `admin_county`, `region` from postcodes.io for query building.

### Session 15 — 2026-04-10 (bug track and fix)
38. **Print page restored** — `app/(print)/projects/[id]/print/page.tsx` was missing (layout existed, no page). Recreated with ownership check, null-coord guard, and `isDismissed: false` filter so dismissed results don't appear in print reports.
39. **Search API validation** — POST body now validated with Zod: `categories` must be non-empty array, `radius` must be 1–200. Previously `!radius` check didn't catch negative/overlarge values.
40. **Unsafe session assertions** — Replaced `session!.user.id` with explicit `if (!session?.user?.id) notFound()` guards in `projects/page.tsx` and `projects/[id]/page.tsx`.
41. **Stale pipeline comment** — Updated comment at top of cache block in `pipeline.ts` to correctly describe exact-match semantics instead of the old "AT LEAST" superset description.
42. **Corrupted node_modules** — Multiple packages (next, react-map-gl, prisma, valibot) had missing files after partial reinstalls. Resolved with `npm cache clean --force && rm -rf node_modules package-lock.json && npm install` then `prisma generate`. TypeScript confirmed at 0 errors post-fix.
