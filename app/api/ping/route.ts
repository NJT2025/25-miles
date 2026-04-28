import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  if (!process.env.KEEP_ALIVE_SECRET || token !== process.env.KEEP_ALIVE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await prisma.$queryRaw`SELECT 1`

  return NextResponse.json({ ok: true, ts: new Date().toISOString() })
}
