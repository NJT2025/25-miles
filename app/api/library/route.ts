import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db/prisma"
import { geocodePostcode } from "@/lib/search/geocoder"

// GET /api/library?skip=0&take=50&q=text
export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const skip = Math.max(0, Number(searchParams.get("skip") ?? "0"))
  const take = Math.min(100, Math.max(1, Number(searchParams.get("take") ?? "50")))
  const q = searchParams.get("q")?.trim() ?? ""

  const where = {
    isPracticeSaved: true,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { postcode: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({ where, skip, take, orderBy: { name: "asc" } }),
    prisma.supplier.count({ where }),
  ])

  return NextResponse.json({ suppliers, total })
}

// POST /api/library — create a new supplier with isPracticeSaved: true
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const body = await req.json()
  const {
    name, description, address, postcode, phone, email, website,
    categories, accreditations, isNationalKnown,
  } = body

  if (!name?.trim() || !categories?.length) {
    return NextResponse.json({ error: "Name and categories are required" }, { status: 400 })
  }

  // Geocode postcode if provided
  let lat: number | null = null
  let lng: number | null = null
  if (postcode?.trim()) {
    try {
      const geo = await geocodePostcode(postcode.trim().toUpperCase())
      if (geo) { lat = geo.lat; lng = geo.lng }
    } catch { /* continue without coords */ }
  }

  const supplier = await prisma.supplier.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      address: address?.trim() || null,
      postcode: postcode?.trim().toUpperCase() || null,
      lat,
      lng,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      website: website?.trim() || null,
      categories: categories ?? [],
      accreditations: accreditations ?? [],
      isManualEntry: true,
      isNationalKnown: !!isNationalKnown,
      isPracticeSaved: true,
    },
  })

  return NextResponse.json(supplier, { status: 201 })
}
