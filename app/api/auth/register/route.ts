import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  organisation: z.string().optional(),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  const { email, password, name, organisation } = parsed.data

  const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN
  if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
    return NextResponse.json(
      { error: `Registration is currently restricted to @${allowedDomain} addresses` },
      { status: 403 }
    )
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: { email, password: hashed, name, organisation: organisation ?? null },
  })

  return NextResponse.json({ success: true }, { status: 201 })
}
