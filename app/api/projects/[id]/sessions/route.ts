import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db/prisma"

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId: user.id },
  })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const sessions = await prisma.searchSession.findMany({
    where: { projectId: project.id },
    include: { _count: { select: { results: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  return NextResponse.json(
    sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      categories: s.categories,
      radius: s.radius,
      resultCount: s._count.results,
    }))
  )
}
