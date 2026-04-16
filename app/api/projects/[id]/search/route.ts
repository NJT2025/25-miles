import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db/prisma"
import { runSearchPipeline } from "@/lib/search/pipeline"
import { geocodePostcode } from "@/lib/search/geocoder"
import { z } from "zod"
import type { CategoryCode } from "@/lib/category-definitions"

const searchSchema = z.object({
  categories: z.array(z.string()).min(1),
  radius: z.number().min(1).max(200),
  keywords: z.string().optional(),
})

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const body = await req.json()
  const parsed = searchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 })
  }
  const { categories, radius, keywords } = parsed.data as { categories: CategoryCode[]; radius: number; keywords?: string }

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId: user.id },
  })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Geocode postcode if project has no coordinates yet
  let projectLat = project.lat
  let projectLng = project.lng

  if (projectLat === null || projectLng === null) {
    const geo = await geocodePostcode(project.postcode)
    if (geo) {
      projectLat = geo.lat
      projectLng = geo.lng
      await prisma.project.update({
        where: { id: project.id },
        data: { lat: projectLat, lng: projectLng },
      })
    }
  }

  if (projectLat === null || projectLng === null) {
    return NextResponse.json({ error: "Could not geocode project postcode" }, { status: 422 })
  }

  // Create a new SearchSession for this search
  const searchSession = await prisma.searchSession.create({
    data: {
      projectId: project.id,
      categories: categories as string[],
      radius,
    },
  })

  // Run pipeline (handles caching internally)
  await runSearchPipeline({
    projectId: project.id,
    sessionId: searchSession.id,
    projectLat,
    projectLng,
    radius,
    categoryCodes: categories,
    postcode: project.postcode,
    keywords,
  })

  // Fetch the persisted results so we return full data including IDs + isDismissed
  const results = await prisma.searchResult.findMany({
    where: { sessionId: searchSession.id },
    include: { supplier: true },
    orderBy: { distanceMiles: "asc" },
  })

  return NextResponse.json({
    sessionId: searchSession.id,
    projectLat,
    projectLng,
    results: results.map((r) => ({
      id: r.id,
      isSaved: r.isSaved,
      isDismissed: r.isDismissed,
      distanceMiles: Number.isFinite(r.distanceMiles) ? r.distanceMiles : 99999,
      isWithinRadius: r.isWithinRadius,
      supplier: r.supplier,
    })),
  })
}
