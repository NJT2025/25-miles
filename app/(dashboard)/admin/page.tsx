import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db/prisma"
import { AdminSupplierPanel } from "@/components/admin/AdminSupplierPanel"

export default async function AdminPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/sign-in")

  const profile = await prisma.user.findUnique({ where: { id: user.id } })
  if (profile?.role !== "ADMIN") redirect("/projects")

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.supplier.count(),
  ])

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-stone-800">Admin — Supplier Database</h1>
        <p className="text-stone-500 mt-1">{total} suppliers in database</p>
      </div>

      <AdminSupplierPanel initialSuppliers={suppliers} totalCount={total} />
    </div>
  )
}
