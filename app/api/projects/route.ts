import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db/prisma"
import { geocodePostcode } from "@/lib/search/geocoder"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  address: z.string().optional(),
  postcode: z.string().min(1),
  radius: z.number().positive().default(12.5),
})

export async function POST(req: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  const { name, description, address, postcode, radius } = parsed.data

  // Geocode postcode
  let lat: number | null = null
  let lng: number | null = null
  try {
    const geo = await geocodePostcode(postcode)
    if (geo) {
      lat = geo.lat
      lng = geo.lng
    }
  } catch {
    // proceed without coordinates
  }

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name,
      description: description ?? null,
      address: address ?? null,
      postcode,
      lat,
      lng,
      radius,
    },
  })

  revalidatePath("/projects")
  return NextResponse.json(project, { status: 201 })
}

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  })

  return NextResponse.json(projects)
}
