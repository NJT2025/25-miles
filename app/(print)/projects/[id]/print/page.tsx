import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db/prisma"
import { notFound } from "next/navigation"
import { PrintReportPage } from "@/components/print/PrintReportPage"

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { sessionId?: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId: user.id },
  })
  if (!project || project.lat === null || project.lng === null) notFound()

  const searchSession = await prisma.searchSession.findFirst({
    where: {
      id: searchParams.sessionId ?? undefined,
      projectId: project.id,
    },
    include: {
      results: {
        where: { isDismissed: false },
        include: { supplier: true },
        orderBy: { distanceMiles: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })
  if (!searchSession) notFound()

  return (
    <PrintReportPage
      project={{
        id: project.id,
        name: project.name,
        postcode: project.postcode,
        lat: project.lat,
        lng: project.lng,
        radius: project.radius,
      }}
      session={{
        id: searchSession.id,
        createdAt: searchSession.createdAt.toISOString(),
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
      }}
    />
  )
}
