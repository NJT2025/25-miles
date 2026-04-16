import { NextResponse } from "next/server"
import { geocodePostcode } from "@/lib/search/geocoder"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const postcode = searchParams.get("postcode")
  if (!postcode) return NextResponse.json({ error: "postcode required" }, { status: 400 })

  const result = await geocodePostcode(postcode)
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(result)
}
