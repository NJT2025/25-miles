import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { prisma } from "@/lib/db/prisma"
import { z } from "zod"

const schema = z.object({
  email: z.string().email(),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  const profile = await prisma.user.findUnique({ where: { id: user.id } })
  if (profile?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 })
  }

  const { email } = parsed.data
  const origin = new URL(req.url).origin
  const redirectTo = `${origin}/auth/callback?next=/reset-password`

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  })

  if (error || !data.properties?.action_link) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to generate link" },
      { status: 400 }
    )
  }

  return NextResponse.json({ url: data.properties.action_link })
}
