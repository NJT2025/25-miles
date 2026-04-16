"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

export default function NewProjectPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: "",
    description: "",
    address: "",
    postcode: "",
    radius: "25",
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        radius: parseFloat(form.radius) || 25,
      }),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Failed to create project")
      return
    }

    const project = await res.json()
    router.push(`/projects/${project.id}`)
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold text-stone-800 mb-6">New project</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Project name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Barn Conversion, Dorset"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of the project…"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address (optional)</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Street address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode *</Label>
                <Input
                  id="postcode"
                  value={form.postcode}
                  onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value.toUpperCase() }))}
                  placeholder="e.g. DT11 0AY"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="radius">Radius (miles)</Label>
                <Input
                  id="radius"
                  type="number"
                  min="1"
                  max="100"
                  value={form.radius}
                  onChange={(e) => setForm((f) => ({ ...f, radius: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating…" : "Create project"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/projects")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
