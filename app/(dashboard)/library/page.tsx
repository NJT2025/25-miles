import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db/prisma"
import { LibraryPanel } from "@/components/library/LibraryPanel"

export default async function LibraryPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/sign-in")

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where: { isPracticeSaved: true },
      orderBy: { name: "asc" },
      take: 50,
    }),
    prisma.supplier.count({ where: { isPracticeSaved: true } }),
  ])

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-stone-800">Practice Library</h1>
        <p className="text-stone-500 mt-1">
          {total} saved supplier{total !== 1 ? "s" : ""} — bookmarked results are added here automatically and injected into future searches.
        </p>
      </div>
      <LibraryPanel initialSuppliers={suppliers} total={total} />
    </div>
  )
}
