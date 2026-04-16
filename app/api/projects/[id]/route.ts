import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"
import { geocodePostcode } from "@/lib/search/geocoder"
import { revalidatePath } from "next/cache"

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  postcode: z.string().optional(),
  radius: z.number().positive().optional(),
})

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

  return NextResponse.json(project)
}

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
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 })

  // Verify ownership
  const current = await prisma.project.findFirst({
    where: { id: params.id, userId: user.id },
    select: { postcode: true },
  })
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updateData: Record<string, unknown> = { ...parsed.data }

  // Geocode if postcode changed
  if (parsed.data.postcode && current.postcode !== parsed.data.postcode) {
    const geo = await geocodePostcode(parsed.data.postcode)
    if (geo) {
      updateData.lat = geo.lat
      updateData.lng = geo.lng
    }
  }

  const project = await prisma.project.update({
    where: { id: params.id },
    data: updateData,
  })

  revalidatePath("/projects")
  return NextResponse.json(project)
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  await prisma.project.deleteMany({ where: { id: params.id, userId: user.id } })
  revalidatePath("/projects")
  return NextResponse.json({ success: true })
}
