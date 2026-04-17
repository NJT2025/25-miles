// Full search pipeline: Tavily → Claude → Geocode → DB upsert → SearchResult
import { prisma } from "@/lib/db/prisma"
import { tavilySearch } from "./tavily"
import { extractSuppliers, claudeGenerateSuppliers, type ExtractedSupplier } from "./ai-extractor"
import type { TavilyResult } from "./tavily"
import { geocodeAddress, geocodePostcode, getPostcodeInfo, haversineDistanceMiles } from "./geocoder"
import { CATEGORY_MAP, type CategoryCode } from "@/lib/category-definitions"

export interface PipelineResult {
  supplierId: string
  name: string
  description?: string | null
  address?: string | null
  lat?: number | null
  lng?: number | null
  phone?: string | null
  email?: string | null
  website?: string | null
  categories: string[]
  accreditations: string[]
  isVerified: boolean
  distanceMiles: number
  isWithinRadius: boolean
  sourceUrl?: string | null
  heritageRiskLevel?: string | null
  heritageCraftType?: string | null
}

/**
 * Run the full search pipeline for a single category against a project location.
 * Returns an array of PipelineResult objects, and upserts into DB.
 */
export async function runSearchPipeline({
  projectId,
  sessionId,
  projectLat,
  projectLng,
  radius,
  categoryCodes,
  postcode,
  keywords,
}: {
  projectId: string
  sessionId: string
  projectLat: number
  projectLng: number
  radius: number
  categoryCodes: CategoryCode[]
  postcode: string
  keywords?: string
}): Promise<PipelineResult[]> {
  const results: PipelineResult[] = []

  // ── STEP 1: DB-FIRST — Always inject practice-saved suppliers first ──
  // This runs on EVERY search (cache hit or fresh) so newly-added library suppliers
  // always appear even when the session cache would otherwise be reused.
  const practiceHits = await prisma.supplier.findMany({
    where: {
      isPracticeSaved: true,
      categories: { hasSome: categoryCodes as string[] },
    },
  })
  const practiceSupplierIds = new Set<string>()
  for (const supplier of practiceHits) {
    const distanceMiles =
      supplier.lat !== null && supplier.lng !== null
        ? haversineDistanceMiles(projectLat, projectLng, supplier.lat, supplier.lng)
        : Infinity
    const isWithinRadius = distanceMiles <= radius
    await prisma.searchResult.upsert({
      where: { sessionId_supplierId: { sessionId, supplierId: supplier.id } },
      update: { distanceMiles, isWithinRadius },
      create: {
        sessionId,
        supplierId: supplier.id,
        distanceMiles,
        isWithinRadius,
        rank: results.length,
      },
    })
    results.push({
      supplierId: supplier.id,
      name: supplier.name,
      description: supplier.description,
      address: supplier.address,
      lat: supplier.lat,
      lng: supplier.lng,
      phone: supplier.phone,
      email: supplier.email,
      website: supplier.website,
      categories: supplier.categories,
      accreditations: supplier.accreditations,
      isVerified: supplier.isVerified,
      distanceMiles,
      isWithinRadius,
      sourceUrl: supplier.sourceUrl,
      heritageRiskLevel: supplier.heritageRiskLevel,
      heritageCraftType: supplier.heritageCraftType,
    })
    practiceSupplierIds.add(supplier.id)
  }
  if (practiceHits.length > 0) {
    console.log(`[pipeline] DB-first: ${practiceHits.length} practice supplier(s) injected`)
  }

  // ── STEP 2: Session-level cache — find a recent session (≤90 days) for this project ──
  //    with EXACTLY the same category set and EXACTLY the same radius.
  //    Any change in categories or radius triggers a fresh Tavily+Claude search.
  //    Keywords bypass the cache entirely — keyword searches always run fresh.
  //    (hasEvery + length check = exact set match)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const cachedSessionCandidate = keywords?.trim()
    ? null
    : await prisma.searchSession.findFirst({
        where: {
          projectId,
          id: { not: sessionId },
          categories: { hasEvery: categoryCodes as string[] },
          radius: { equals: radius },
          createdAt: { gte: ninetyDaysAgo },
        },
        orderBy: { createdAt: "desc" },
        include: {
          results: {
            include: { supplier: true },
            orderBy: { distanceMiles: "asc" },
          },
        },
      })

  // Only use the cache if the category set is exactly the same (not a superset)
  const cachedSession =
    cachedSessionCandidate?.categories.length === categoryCodes.length
      ? cachedSessionCandidate
      : null

  if (cachedSession && cachedSession.results.length >= 3) {
    console.log(`[pipeline] Reusing ${cachedSession.results.length} results from session ${cachedSession.id}`)
    for (const r of cachedSession.results) {
      const { supplier } = r
      // Skip suppliers already added by the DB-first step to avoid duplicates
      if (practiceSupplierIds.has(supplier.id)) continue
      const distanceMiles =
        supplier.lat !== null && supplier.lng !== null
          ? haversineDistanceMiles(projectLat, projectLng, supplier.lat, supplier.lng)
          : Infinity
      const isWithinRadius = distanceMiles <= radius
      await prisma.searchResult.upsert({
        where: { sessionId_supplierId: { sessionId, supplierId: supplier.id } },
        update: { distanceMiles, isWithinRadius },
        create: {
          sessionId,
          supplierId: supplier.id,
          distanceMiles,
          isWithinRadius,
          rank: results.length,
        },
      })
      results.push({
        supplierId: supplier.id,
        name: supplier.name,
        description: supplier.description,
        address: supplier.address,
        lat: supplier.lat,
        lng: supplier.lng,
        phone: supplier.phone,
        email: supplier.email,
        website: supplier.website,
        categories: supplier.categories,
        accreditations: supplier.accreditations,
        isVerified: supplier.isVerified,
        distanceMiles,
        isWithinRadius,
        sourceUrl: supplier.sourceUrl,
        heritageRiskLevel: supplier.heritageRiskLevel,
        heritageCraftType: supplier.heritageCraftType,
      })
    }
    return results.sort((a, b) => a.distanceMiles - b.distanceMiles)
  }

  const keywordSuffix = keywords?.trim() ? ` ${keywords.trim()}` : ""

  // Resolve postcode to a broad, human-readable location term for better search relevance.
  // Include both county and region so suppliers just across a county border are captured
  // (e.g. "Gloucestershire, South West" rather than just "Gloucestershire").
  const postcodeInfo = await getPostcodeInfo(postcode)
  const locationParts = [postcodeInfo?.adminCounty, postcodeInfo?.region]
    .filter((v): v is string => Boolean(v))
    .filter((v, i, arr) => arr.indexOf(v) === i) // deduplicate if county === region
  const locationTerms = locationParts.length > 0 ? locationParts.join(", ") : postcode

  // UK trade directories for targeted directory search — general trades + heritage/conservation specialists
  const UK_TRADE_DIRECTORIES = [
    "yell.com", "checkatrade.com", "trustatrader.com",
    "fmb.org.uk", "thomsonlocal.com", "bark.com",
    "mybuilder.com", "ratedpeople.com",
    // Heritage & conservation specialists
    "buildingconservation.com", "spab.org.uk", "ihbc.org.uk",
    "guildofmastercraftsmen.com",
  ]

  // 3. Group selected categories by their group type and run one Tavily search per group.
  //    This avoids the single massive OR query diluting results across all categories.
  //    Each group gets its own 15-result general search + 10-result directory search.
  let searchResults: TavilyResult[] = []
  try {
    const byGroup: Record<string, CategoryCode[]> = {}
    for (const code of categoryCodes) {
      const group = CATEGORY_MAP[code]?.group ?? "other"
      if (!byGroup[group]) byGroup[group] = []
      byGroup[group].push(code)
    }
    const groupEntries = Object.values(byGroup)

    const groupSearchPromises: Promise<TavilyResult[]>[] = []
    for (const codes of groupEntries) {
      const fragments = codes.map((c) => CATEGORY_MAP[c]?.searchQuery ?? c)
      const groupQuery = `${fragments.join(" OR ")} ${locationTerms} UK${keywordSuffix}`
      groupSearchPromises.push(
        tavilySearch(groupQuery, 15, { includeRawContent: true }).catch(() => []),
        tavilySearch(groupQuery, 10, { includeRawContent: true, includeDomains: UK_TRADE_DIRECTORIES }).catch(() => []),
      )
    }

    const allBatches = await Promise.all(groupSearchPromises)
    const combinedMap: Record<string, TavilyResult> = {}
    for (const batch of allBatches) {
      for (const r of batch) combinedMap[r.url] = r
    }
    searchResults = Object.values(combinedMap)
    console.log(`[pipeline] Tavily returned ${searchResults.length} unique pages across ${groupEntries.length} group(s)`)
  } catch (err) {
    console.error("Tavily search failed:", err)
  }

  // 4. Claude extraction (or fallback if Tavily returned nothing)
  let extracted: ExtractedSupplier[] = []
  if (searchResults.length > 0) {
    try {
      extracted = await extractSuppliers(searchResults, categoryCodes, `${postcode}, UK`)
    } catch (err) {
      console.error("AI extraction failed:", err)
    }
  }

  if (extracted.length === 0) {
    console.log("[pipeline] No Tavily results — using Claude knowledge fallback")
    try {
      extracted = await claudeGenerateSuppliers(categoryCodes, `${postcode}, UK`, radius)
    } catch (err) {
      console.error("Claude fallback failed:", err)
      // Return practice suppliers already collected rather than empty array
      return results.sort((a, b) => a.distanceMiles - b.distanceMiles)
    }
  } else if (extracted.length < 5) {
    // Tavily returned something but extraction was thin — supplement with Claude knowledge
    console.log(`[pipeline] Only ${extracted.length} result(s) from Tavily extraction — supplementing with Claude knowledge`)
    try {
      const supplement = await claudeGenerateSuppliers(categoryCodes, `${postcode}, UK`, radius)
      const existingNames = new Set(extracted.map((e) => e.name.toLowerCase()))
      for (const s of supplement) {
        if (!existingNames.has(s.name.toLowerCase())) {
          extracted.push(s)
        }
      }
      console.log(`[pipeline] After supplement: ${extracted.length} total results`)
    } catch (err) {
      console.error("Claude fallback supplement failed:", err)
    }
  }

  // 5. Process each extracted supplier
  for (const item of extracted) {
    // Geocode address if we have one but no coordinates
    let lat: number | null = null
    let lng: number | null = null

    if (item.postcode) {
      try {
        const geo = await geocodePostcode(item.postcode)
        if (geo) { lat = geo.lat; lng = geo.lng }
      } catch { /* continue */ }
    }
    if (lat === null && item.address) {
      try {
        const geo = await geocodeAddress(item.address)
        if (geo) { lat = geo.lat; lng = geo.lng }
      } catch { /* continue */ }
    }

    // Calculate distance
    const distanceMiles =
      lat !== null && lng !== null
        ? haversineDistanceMiles(projectLat, projectLng, lat, lng)
        : Infinity
    const isWithinRadius = distanceMiles <= radius

    // 6. Find or create supplier (deduplicate on name + postcode)
    const existing = await prisma.supplier.findFirst({
      where: {
        name: item.name,
        ...(item.postcode ? { postcode: item.postcode } : {}),
      },
    })

    // Skip suppliers already injected from the practice library
    if (existing && practiceSupplierIds.has(existing.id)) continue

    let supplier
    if (existing) {
      // Update heritage fields if newly extracted and not yet set
      if (item.heritageRiskLevel && !existing.heritageRiskLevel) {
        supplier = await prisma.supplier.update({
          where: { id: existing.id },
          data: {
            heritageRiskLevel: item.heritageRiskLevel,
            heritageCraftType: item.heritageCraftType ?? null,
          },
        })
      } else {
        supplier = existing
      }
    } else {
      supplier = await prisma.supplier.create({
        data: {
          name: item.name,
          description: item.description || null,
          address: item.address || null,
          postcode: item.postcode || null,
          lat,
          lng,
          phone: item.phone || null,
          email: item.email || null,
          website: item.website || null,
          categories: item.categories,
          accreditations: item.accreditations ?? [],
          sourceUrl: item.sourceUrl || null,
          heritageRiskLevel: item.heritageRiskLevel ?? null,
          heritageCraftType: item.heritageCraftType ?? null,
        },
      })
    }

    // 7. Create SearchResult
    await prisma.searchResult.upsert({
      where: { sessionId_supplierId: { sessionId, supplierId: supplier.id } },
      update: { distanceMiles, isWithinRadius },
      create: {
        sessionId,
        supplierId: supplier.id,
        distanceMiles,
        isWithinRadius,
        rank: results.length,
      },
    })

    results.push({
      supplierId: supplier.id,
      name: supplier.name,
      description: supplier.description,
      address: supplier.address,
      lat: supplier.lat,
      lng: supplier.lng,
      phone: supplier.phone,
      email: supplier.email,
      website: supplier.website,
      categories: supplier.categories,
      accreditations: supplier.accreditations,
      isVerified: supplier.isVerified,
      distanceMiles,
      isWithinRadius,
      sourceUrl: supplier.sourceUrl,
      heritageRiskLevel: supplier.heritageRiskLevel,
      heritageCraftType: supplier.heritageCraftType,
    })
  }

  return results.sort((a, b) => a.distanceMiles - b.distanceMiles)
}
