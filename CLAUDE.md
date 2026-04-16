# CLAUDE.md — 25 Miles

Instructions for Claude Code when working on this project.

---

## What This Project Is

25 Miles is a Next.js 14 web application for architecture practices. It lets users create projects (defined by a UK postcode and search radius), then run AI-powered searches to find local building material suppliers, craftspeople, and contractors within that radius.

Full technical documentation is in **MEMORY.md** (quick reference) and **STATUS.md** (full feature inventory and session log).

---

## Critical Rules

1. **Never upgrade `maplibre-gl` above `^4.x`.** react-map-gl@7 has a peer dep `<5.0.0`. If you upgrade to v5, markers and layers silently break.

2. **Always check TypeScript after edits:** `node_modules/.bin/tsc --noEmit` must pass with 0 errors. Do NOT use `npx tsc` — it installs the wrong package.

3. **distanceMiles is never `Infinity` in the UI.** The API sanitises it to `99999`. All UI comparisons must use `>= 99999`, not `=== Infinity`.

4. **`temperature: 0` on all Claude API calls** in the search pipeline. Non-deterministic output breaks the session-level cache and produces inconsistent results.

5. **Use `geocodePostcode` (postcodes.io, free) as the primary geocoder**, not `geocodeAddress` (Mapbox). The Mapbox token may be empty.

6. **Map uses CartoDB Positron tiles** — no Mapbox token needed for map display.

7. **Import react-map-gl from `react-map-gl/maplibre`**, not `react-map-gl`. Import Turf as `import turfCircle from "@turf/circle"` (default export).

8. **If node_modules looks corrupt** (missing files, MODULE_NOT_FOUND errors), run the full clean: `npm cache clean --force && rm -rf node_modules package-lock.json && npm install && npx prisma generate`.

---

## Dev Server

```bash
node_modules/.bin/next dev
# Runs on http://localhost:3000
```

Do not use `npm run dev` — it may behave oddly. Use the direct binary.

---

## Architecture Overview

```
app/
  (dashboard)/         # authenticated UI — projects, admin
  (print)/             # print-only layout — no nav bar
    projects/[id]/print/page.tsx   # server page — fetches session, filters dismissed
  api/
    projects/[id]/
      search/          # POST — Zod validated, runs full AI pipeline
      results/         # GET + PATCH — results, isSaved, isDismissed
      sessions/        # GET — session history

lib/
  auth.ts + auth.config.ts   # NextAuth v5 (split for Edge)
  db/prisma.ts               # Prisma singleton with PrismaPg adapter
  search/
    pipeline.ts              # Main orchestration
    tavily.ts                # Web search
    ai-extractor.ts          # Claude extraction + knowledge fallback
    geocoder.ts              # postcodes.io + Mapbox

components/
  project/
    ProjectSearchPage.tsx    # Main client component (all state)
    DeleteProjectButton.tsx  # Inline delete on project list
  map/
    ProjectMap.tsx           # MapLibre map with concentric rings
  search/
    CategoryPanel.tsx
    ResultsList.tsx
    SearchResultCard.tsx     # Has dismiss (X) button + red styling when outside radius
    SupplierDetailPanel.tsx
  print/
    PrintReportPage.tsx
  admin/
    AdminSupplierPanel.tsx
```

---

## Search Pipeline (summary)

1. Check for a cached session: **exact** category match (hasEvery + length check) + **exact** radius + created within 90 days (excludes current sessionId). Any change = fresh search.
2. Tavily search (15 results max)
3. Claude extraction (`temperature: 0`) → up to 15 suppliers; falls back to Claude knowledge-base if Tavily returns nothing
4. Geocode via postcodes.io → Mapbox fallback
5. Haversine distance from project lat/lng
6. Upsert to DB; return sorted by distance

---

## Key Decisions Made

| Decision | Reason |
|----------|--------|
| Session-level cache (not per-supplier) | Per-supplier `hasSome` caused cache hits for unrelated category overlaps; counting per-category never reached threshold because Claude spreads results across all categories |
| Cache uses exact match (categories + radius) | `hasEvery`/`gte` was too broad — broad initial searches were returned for all subsequent narrower searches, making UI appear stuck. Exact match means any change triggers fresh search. |
| `temperature: 0` | Deterministic extraction = stable caching |
| postcodes.io primary geocoder | Mapbox token often absent; postcodes.io is free and reliable for UK postcodes |
| CartoDB Positron tiles | No API key required; clean minimal style suits the app |
| maplibre-gl 4.x lock | react-map-gl@7 peer dep — confirmed breaking at v5 |
| Dismiss persisted server-side | `isDismissed` field on `SearchResult`; optimistic client update (fire-and-forget PATCH); print report filters `isDismissed: false` at query time |
| No result limit | User preference — all found results should be visible |

---

## Next Steps (priority order)

1. **Accreditations filter** — filter UI in results panel for IHBC, CITB, Guild of Master Craftsmen, etc.
2. **Search refinement** — keyword input appended to Tavily query (e.g. "listed building", "conservation area")
3. **Deploy** — Vercel (Next.js) + Supabase (PostgreSQL); add real Tavily key; set `ALLOWED_EMAIL_DOMAIN`
4. **Supplier quality signals** — badge or indicator for AI-generated vs Tavily-sourced vs manually verified
5. **Map clustering** — group dense markers at low zoom
