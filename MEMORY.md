# 25 Miles — Developer Memory

_Last updated: 2026-04-16 (session 17)_

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
| `lib/search/pipeline.ts` | Session cache → Tavily → Claude → geocode → DB upsert → SearchResult |
| `lib/supabase/server.ts` | Supabase server client (Server Components, API routes, middleware) |
| `lib/supabase/client.ts` | Supabase browser client (Client Components) |
| `lib/db/prisma.ts` | Prisma singleton with PrismaPg driver adapter |
| `app/api/projects/[id]/search/route.ts` | POST — Zod validation, creates session, runs pipeline, returns results |
| `app/api/projects/[id]/results/route.ts` | GET + PATCH (isSaved and isDismissed, ownership checked) |
| `components/project/ProjectSearchPage.tsx` | Main client component — all search state, map, filters, results, dismiss |
| `components/project/DeleteProjectButton.tsx` | Inline delete confirm/cancel on project list cards |
| `components/map/ProjectMap.tsx` | MapLibre map + Turf concentric rings (every 5mi), numbered markers |
| `components/search/CategoryPanel.tsx` | Grouped checkbox filter panel |
| `components/search/ResultsList.tsx` | Within / beyond / national sections + dismiss passthrough |
| `components/search/SearchResultCard.tsx` | Card with save toggle + dismiss (X) button; red border + red text when outside radius |
| `components/search/SupplierDetailPanel.tsx` | Full supplier detail in right panel |
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
| `Supplier` | id, name, description, address, postcode, lat, lng, phone, email, website, categories String[], accreditations String[], isVerified, isManualEntry, isNationalKnown, sourceUrl, heritageRiskLevel, heritageCraftType |
| `SearchSession` | id, projectId, categories String[], radius |
| `SearchResult` | id, sessionId, supplierId, distanceMiles, isWithinRadius, isSaved, **isDismissed**, rank |

**distanceMiles note:** Infinity is stored in DB for suppliers with no geocoded location. The results API routes sanitise this to `99999` before sending JSON (JSON.stringify(Infinity) = null). All UI code checks `>= 99999` (not `=== Infinity`).

**isDismissed note:** Persisted server-side. Client initialises dismissed Set from results on load and on session switch. PATCH fires optimistically (fire-and-forget). Print report queries with `where: { isDismissed: false }`.

---

## Search Cache Strategy

Session-level cache in pipeline.ts — **exact match only**:
```typescript
// 1. Query with hasEvery + exact radius
const candidate = prisma.searchSession.findFirst({
  where: {
    projectId,
    id: { not: sessionId },           // exclude current session
    categories: { hasEvery: categoryCodes },
    radius: { equals: radius },        // exact radius (not gte)
    createdAt: { gte: ninetyDaysAgo },
  }
})
// 2. Code-level length check for exact category match
const cachedSession = candidate?.categories.length === categoryCodes.length ? candidate : null
// Reuse if cachedSession.results.length >= 3
```

**Why exact match:** The previous `hasEvery`/`gte` approach returned old broad-search results for any narrower search, making the UI appear stuck. Now any change to categories or radius triggers a fresh Tavily+Claude search.

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/create-profile` | POST | Create Prisma User row after Supabase signUp (domain check + upsert) |
| `/api/projects` | GET/POST | List / create project |
| `/api/projects/[id]` | GET/PATCH/DELETE | Project CRUD |
| `/api/projects/[id]/search` | POST | Run AI search pipeline (Zod validated: categories[], radius 1–200) |
| `/api/projects/[id]/results` | GET/PATCH | Get results / toggle `isSaved` or `isDismissed` (ownership checked) |
| `/api/projects/[id]/sessions` | GET | Session summaries list |
| `/api/suppliers` | GET/POST | List / admin create |
| `/api/suppliers/[id]` | PATCH/DELETE | Admin: verify or delete |

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
- **Map import:** `react-map-gl/maplibre` (not `react-map-gl`). The `maplibre` subdirectory must be present in `node_modules/react-map-gl/` — it can go missing after a partial npm install (reinstall the package to fix).
- **Turf import:** `import turfCircle from "@turf/circle"` (default export)
- **prisma migrate / generate:** requires `DATABASE_URL` in env; `prisma.config.ts` loads `.env.local` via dotenv
- **Print report:** map canvas capture uses `onLoad` prop on `<Map>`, NOT `useEffect` (ref is null at mount)
- **Dismiss is persisted:** `isDismissed` field on `SearchResult`. Client uses optimistic update (fire-and-forget PATCH). Dismissed items excluded from print report via server-side filter `where: { isDismissed: false }`.
- **Claude fallback:** if Tavily returns 0 results, pipeline calls `claudeGenerateSuppliers` with knowledge-base. Both use `temperature: 0`.
- **`npm run dev` may behave oddly** — use `node_modules/.bin/next dev` directly
- **TypeScript check:** use `node_modules/.bin/tsc --noEmit` (not `npx tsc` — that installs a wrong package)
