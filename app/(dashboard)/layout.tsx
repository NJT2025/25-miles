import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db/prisma"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/toaster"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/sign-in")

  const profile = await prisma.user.findUnique({ where: { id: user.id } })

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f5f0]">
      {/* Header */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b border-stone-200 bg-white/80 backdrop-blur"
      >
        <Link href="/projects" className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: "#333331" }}
          >
            25
          </div>
          <span className="font-semibold text-stone-700 tracking-tight">Miles</span>
        </Link>

        <nav className="flex items-center gap-4">
          <Link href="/projects" className="text-sm text-stone-600 hover:text-stone-900">
            Projects
          </Link>
          <Link href="/library" className="text-sm text-stone-600 hover:text-stone-900">
            Library
          </Link>
          {profile?.role === "ADMIN" && (
            <Link href="/admin" className="text-sm text-stone-600 hover:text-stone-900">
              Admin
            </Link>
          )}
          <span className="text-sm text-stone-400">{user.email}</span>
          <form
            action={async () => {
              "use server"
              const { createClient: makeClient } = await import("@/lib/supabase/server")
              const sb = makeClient()
              await sb.auth.signOut()
              redirect("/sign-in")
            }}
          >
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </nav>
      </header>

      <main className="flex-1">{children}</main>
      <Toaster />
    </div>
  )
}
