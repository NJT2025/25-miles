"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Confirm there is an active recovery session before showing the form
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true)
      } else {
        setError("link_expired")
      }
    })
  }, [])

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => router.push("/sign-in"), 2000)
      return () => clearTimeout(timer)
    }
  }, [success, router])

  if (!ready && !error) {
    return null
  }

  if (error === "link_expired") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Invalid link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            This reset link is invalid or has expired. Please request a new one.
          </div>
          <p className="text-sm text-stone-500 text-center">
            <Link href="/forgot-password" className="text-stone-900 font-medium hover:underline">
              Request a new link
            </Link>
          </p>
        </CardContent>
      </Card>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(true)
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Choose a new password</CardTitle>
        <CardDescription>Enter a new password for your account</CardDescription>
      </CardHeader>

      {success ? (
        <CardContent className="space-y-4">
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
            Password updated. Redirecting to sign in…
          </div>
          <p className="text-sm text-stone-500 text-center">
            <Link href="/sign-in" className="text-stone-900 font-medium hover:underline">
              Go to sign in
            </Link>
          </p>
        </CardContent>
      ) : (
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && error !== "link_expired" && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error.includes("expired") || error.includes("invalid") ? (
                  <>
                    This link has expired or is invalid.{" "}
                    <Link href="/forgot-password" className="underline">
                      Request a new one.
                    </Link>
                  </>
                ) : (
                  error
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating…" : "Update password"}
            </Button>
            <p className="text-sm text-stone-500 text-center">
              <Link href="/sign-in" className="text-stone-900 font-medium hover:underline">
                Back to sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      )}
    </Card>
  )
}
