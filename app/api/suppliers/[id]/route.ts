import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const patchSchema = z.object({
  isVerified: z.boolean().optional(),
  isNationalKnown: z.boolean().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  categories: z.array(z.string()).optional(),
  accreditations: z.array(z.string()).optional(),
})

async function requireAdmin() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const profile = await prisma.user.findUnique({ where: { id: user.id } })
  if (!profile || profile.role !== "ADMIN") return null
  return user
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 })

  const supplier = await prisma.supplier.update({
    where: { id: params.id },
    data: parsed.data,
  })
  return NextResponse.json(supplier)
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.supplier.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
