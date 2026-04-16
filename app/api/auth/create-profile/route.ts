import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1),
  organisation: z.string().optional(),
})

export async function POST(req: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  // Domain restriction check
  const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN
  if (allowedDomain && !user.email?.endsWith(`@${allowedDomain}`)) {
    // Delete the Supabase auth user so they can't sign in
    const { createClient: createAdminClient } = await import("@supabase/supabase-js")
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await admin.auth.admin.deleteUser(user.id)
    return NextResponse.json(
      { error: `Registration is restricted to @${allowedDomain} addresses` },
      { status: 403 }
    )
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  // Upsert so duplicate calls are safe
  await prisma.user.upsert({
    where: { id: user.id },
    update: {},
    create: {
      id: user.id,
      email: user.email!,
      name: parsed.data.name,
      organisation: parsed.data.organisation ?? null,
    },
  })

  return NextResponse.json({ success: true }, { status: 201 })
}
