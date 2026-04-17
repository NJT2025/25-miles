import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db/prisma"

// DELETE /api/library/[id] — remove supplier from practice library (set isPracticeSaved=false)
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const supplier = await prisma.supplier.findUnique({ where: { id: params.id } })
  if (!supplier || !supplier.isPracticeSaved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.supplier.update({
    where: { id: params.id },
    data: { isPracticeSaved: false },
  })

  return NextResponse.json({ ok: true })
}
