import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  address: z.string().optional(),
  postcode: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  categories: z.array(z.string()),
  accreditations: z.array(z.string()).default([]),
  isNationalKnown: z.boolean().default(false),
})

// GET /api/suppliers — paginated list (admin)
export async function GET(req: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const skip = parseInt(searchParams.get("skip") ?? "0", 10)
  const take = Math.min(parseInt(searchParams.get("take") ?? "50", 10), 100)

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { createdAt: "desc" }, skip, take }),
    prisma.supplier.count(),
  ])
  return NextResponse.json({ suppliers, total })
}

// POST /api/suppliers — admin manual entry
export async function POST(req: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const profile = await prisma.user.findUnique({ where: { id: user.id } })
  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  const supplier = await prisma.supplier.create({
    data: {
      ...parsed.data,
      isManualEntry: true,
      isVerified: true,
    },
  })

  return NextResponse.json(supplier, { status: 201 })
}
