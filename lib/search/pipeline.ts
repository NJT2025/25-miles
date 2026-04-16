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

  // 0. Session-level cache — find a recent session (≤90 days) for this project
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
    const cachedResults: PipelineResult[] = []
    for (const r of cachedSession.results) {
      const { supplier } = r
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
          rank: cachedResults.length,
        },
      })
      cachedResults.push({
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
    return cachedResults.sort((a, b) => a.distanceMiles - b.distanceMiles)
  }

  // Build a combined search query for the given categories
  const queryFragments = categoryCodes.map((c) => CATEGORY_MAP[c]?.searchQuery ?? c)
  const keywordSuffix = keywords?.trim() ? ` ${keywords.trim()}` : ""

  // Resolve postcode to a broad, human-readable location term for better search relevance
  // Use county for rural areas (e.g. "Gloucestershire"), region for urban (e.g. "London")
  // Avoid adminDistrict (e.g. "Westminster") — too granular for a radius search
  const postcodeInfo = await getPostcodeInfo(postcode)
  const locationTerms = postcodeInfo?.adminCounty ?? postcodeInfo?.region ?? postcode

  const query = `${queryFragments.join(" OR ")} ${locationTerms} UK${keywordSuffix}`

  // UK trade directories for targeted directory search
  const UK_TRADE_DIRECTORIES = [
    "yell.com", "checkatrade.com", "trustatrader.com",
    "fmb.org.uk", "thomsonlocal.com", "bark.com",
    "mybuilder.com", "ratedpeople.com",
  ]

  // 1. Run general search + directory-targeted search in parallel, both with full page content
  let searchResults: TavilyResult[] = []
  try {
    const directoryQuery = `${queryFragments.join(" OR ")} ${locationTerms} UK${keywordSuffix}`
    const [generalResults, directoryResults] = await Promise.allSettled([
      tavilySearch(query, 15, { includeRawContent: true }),
      tavilySearch(directoryQuery, 10, { includeRawContent: true, includeDomains: UK_TRADE_DIRECTORIES }),
    ])

    const combined = new Map<string, TavilyResult>()
    if (generalResults.status === "fulfilled") {
      for (const r of generalResults.value) combined.set(r.url, r)
    }
    if (directoryResults.status === "fulfilled") {
      for (const r of directoryResults.value) combined.set(r.url, r)
    }
    searchResults = Array.from(combined.values())
    console.log(`[pipeline] Tavily returned ${searchResults.length} unique pages`)
  } catch (err) {
    console.error("Tavily search failed:", err)
  }

  // 2. Claude extraction (or fallback if Tavily returned nothing)
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
      return []
    }
  }

  // 3. Process each extracted supplier
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

    // 4. Find or create supplier (deduplicate on name + postcode)
    const existing = await prisma.supplier.findFirst({
      where: {
        name: item.name,
        ...(item.postcode ? { postcode: item.postcode } : {}),
      },
    })

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

    // 5. Create SearchResult
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
