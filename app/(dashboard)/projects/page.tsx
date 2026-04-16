import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Plus, Search } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { DeleteProjectButton } from "@/components/project/DeleteProjectButton"

function timeAgo(date: Date) {
  return formatDistanceToNow(date, { addSuffix: true })
}

export default async function ProjectsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { searchSessions: true } },
    },
  })

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Projects</h1>
          <p className="text-stone-500 mt-1">Your local sourcing searches</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="w-4 h-4 mr-2" />
            New project
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <Search className="w-10 h-10 mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium mb-1">No projects yet</p>
          <p className="text-sm mb-6">Create a project to start sourcing local materials and makers.</p>
          <Button asChild>
            <Link href="/projects/new">Create your first project</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:border-stone-400 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-stone-800">
                    {project.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-stone-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {project.postcode}
                    </span>
                    <span>{project.radius} mile radius</span>
                    <span>{project._count.searchSessions} search{project._count.searchSessions !== 1 ? "es" : ""}</span>
                    <span className="ml-auto">{timeAgo(project.updatedAt)}</span>
                    <DeleteProjectButton projectId={project.id} />
                  </div>
                  {project.description && (
                    <p className="text-sm text-stone-500 mt-2 line-clamp-1">{project.description}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
