import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/sign-in")

  return <>{children}</>
}
