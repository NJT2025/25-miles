import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db/prisma"
import { notFound } from "next/navigation"
import { ProjectSearchPage } from "@/components/project/ProjectSearchPage"

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const [project, allSessionsRaw] = await Promise.all([
    prisma.project.findFirst({
      where: { id: params.id, userId: user.id },
      include: {
        searchSessions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            results: {
              include: { supplier: true },
              orderBy: { distanceMiles: "asc" },
            },
          },
        },
      },
    }),
    prisma.searchSession.findMany({
      where: { project: { id: params.id, userId: user.id } },
      include: { _count: { select: { results: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ])

  if (!project) notFound()

  const latestSession = project.searchSessions[0] ?? null

  return (
    <ProjectSearchPage
      project={{
        id: project.id,
        name: project.name,
        postcode: project.postcode,
        lat: project.lat,
        lng: project.lng,
        radius: project.radius,
      }}
      initialSession={
        latestSession
          ? {
              id: latestSession.id,
              categories: latestSession.categories,
              radius: latestSession.radius,
              results: latestSession.results.map((r) => ({
                id: r.id,
                isSaved: r.isSaved,
                isDismissed: r.isDismissed,
                distanceMiles: r.distanceMiles,
                isWithinRadius: r.isWithinRadius,
                supplier: r.supplier,
              })),
            }
          : null
      }
      allSessions={allSessionsRaw.map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        categories: s.categories,
        radius: s.radius,
        resultCount: s._count.results,
      }))}
    />
  )
}
