import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db/prisma"

// GET /api/projects/[id]/results?sessionId=xxx
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get("sessionId")
  const savedOnly = searchParams.get("saved") === "true"

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId: user.id },
  })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Saved-only query: all saved results across every session for this project
  if (savedOnly) {
    const saved = await prisma.searchResult.findMany({
      where: { session: { projectId: project.id }, isSaved: true },
      include: { supplier: true },
      orderBy: { distanceMiles: "asc" },
    })
    return NextResponse.json({
      results: saved.map((r) => ({
        id: r.id,
        isSaved: r.isSaved,
        isDismissed: r.isDismissed,
        distanceMiles: Number.isFinite(r.distanceMiles) ? r.distanceMiles : 99999,
        isWithinRadius: r.isWithinRadius,
        supplier: r.supplier,
      })),
    })
  }

  const searchSession = await prisma.searchSession.findFirst({
    where: { id: sessionId ?? undefined, projectId: project.id },
    include: {
      results: {
        include: { supplier: true },
        orderBy: { distanceMiles: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  if (!searchSession) return NextResponse.json({ results: [] })

  return NextResponse.json({
    sessionId: searchSession.id,
    categories: searchSession.categories,
    radius: searchSession.radius,
    results: searchSession.results.map((r) => ({
      id: r.id,
      isSaved: r.isSaved,
      isDismissed: r.isDismissed,
      distanceMiles: Number.isFinite(r.distanceMiles) ? r.distanceMiles : 99999,
      isWithinRadius: r.isWithinRadius,
      supplier: r.supplier,
    })),
  })
}

// PATCH /api/projects/[id]/results — toggle isSaved on a result
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const body = await req.json()
  const { resultId, isSaved, isDismissed } = body

  // Verify the user owns the project before touching any results
  const project = await prisma.project.findFirst({
    where: { id: params.id, userId: user.id },
  })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const result = await prisma.searchResult.findUnique({
    where: { id: resultId },
    include: { session: true },
  })
  if (!result || result.session.projectId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const updated = await prisma.searchResult.update({
    where: { id: resultId },
    data: {
      ...(isSaved !== undefined && { isSaved }),
      ...(isDismissed !== undefined && { isDismissed }),
    },
  })

  // Auto-promote: when a result is bookmarked, add its supplier to the practice library.
  // Un-saving does NOT remove from library — removal requires explicit action on /library.
  if (isSaved === true) {
    await prisma.supplier.update({
      where: { id: result.supplierId },
      data: { isPracticeSaved: true },
    })
  }

  return NextResponse.json(updated)
}
