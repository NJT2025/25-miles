import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

export async function GET() {
  await prisma.$queryRaw`SELECT 1`
  return NextResponse.json({ ok: true, ts: new Date().toISOString() })
}
