"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { CheckCircle, Plus, Trash2, Globe } from "lucide-react"
import { CATEGORIES, CATEGORY_MAP, type CategoryCode } from "@/lib/category-definitions"

interface SupplierRecord {
  id: string
  name: string
  description: string | null
  address: string | null
  postcode: string | null
  lat: number | null
  lng: number | null
  phone: string | null
  email: string | null
  website: string | null
  categories: string[]
  accreditations: string[]
  isVerified: boolean
  isManualEntry: boolean
  isNationalKnown: boolean
  sourceUrl: string | null
  createdAt: Date
  updatedAt: Date
}

interface AdminSupplierPanelProps {
  initialSuppliers: SupplierRecord[]
  totalCount: number
}

export function AdminSupplierPanel({ initialSuppliers, totalCount }: AdminSupplierPanelProps) {
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>(initialSuppliers)
  const [loadingMore, setLoadingMore] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: "",
    description: "",
    address: "",
    postcode: "",
    phone: "",
    email: "",
    website: "",
    categories: [] as CategoryCode[],
    accreditations: "",
    isNationalKnown: false,
  })
  const [filter, setFilter] = useState("")

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        accreditations: form.accreditations
          ? form.accreditations.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      }),
    })
    setSaving(false)
    if (res.ok) {
      const supplier = await res.json()
      setSuppliers((prev) => [supplier, ...prev])
      setAddOpen(false)
      setForm({
        name: "",
        description: "",
        address: "",
        postcode: "",
        phone: "",
        email: "",
        website: "",
        categories: [],
        accreditations: "",
        isNationalKnown: false,
      })
    }
  }

  async function handleVerify(id: string, current: boolean) {
    const res = await fetch(`/api/suppliers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVerified: !current }),
    })
    if (res.ok) {
      setSuppliers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isVerified: !current } : s))
      )
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this supplier?")) return
    const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" })
    if (res.ok) setSuppliers((prev) => prev.filter((s) => s.id !== id))
  }

  function toggleCategory(code: CategoryCode) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(code)
        ? f.categories.filter((c) => c !== code)
        : [...f.categories, code],
    }))
  }

  async function handleLoadMore() {
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/suppliers?skip=${suppliers.length}&take=50`)
      if (res.ok) {
        const data = await res.json()
        setSuppliers((prev) => [...prev, ...(data.suppliers ?? [])])
      }
    } finally {
      setLoadingMore(false)
    }
  }

  const filtered = suppliers.filter(
    (s) =>
      !filter ||
      s.name.toLowerCase().includes(filter.toLowerCase()) ||
      s.postcode?.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Input
          placeholder="Filter by name or postcode…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs"
        />
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add supplier manually</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Postcode</Label>
                  <Input
                    value={form.postcode}
                    onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Website</Label>
                  <Input
                    type="url"
                    value={form.website}
                    onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Accreditations (comma-separated)</Label>
                  <Input
                    value={form.accreditations}
                    onChange={(e) => setForm((f) => ({ ...f, accreditations: e.target.value }))}
                    placeholder="e.g. IHBC, CITB, Guild of Master Craftsmen"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Categories *</Label>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border rounded p-3">
                  {CATEGORIES.map((cat) => (
                    <div key={cat.code} className="flex items-center gap-2">
                      <Checkbox
                        id={`add-${cat.code}`}
                        checked={form.categories.includes(cat.code)}
                        onCheckedChange={() => toggleCategory(cat.code)}
                      />
                      <label htmlFor={`add-${cat.code}`} className="text-sm cursor-pointer">
                        {cat.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="national"
                  checked={form.isNationalKnown}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isNationalKnown: !!v }))}
                />
                <Label htmlFor="national">Nationally known (show beyond radius)</Label>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || form.categories.length === 0}>
                  {saving ? "Saving…" : "Add supplier"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {filtered.map((supplier) => (
          <Card key={supplier.id} className="shadow-none">
            <CardContent className="p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-stone-800">{supplier.name}</span>
                  {supplier.isVerified && (
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  )}
                  {supplier.isManualEntry && (
                    <Badge variant="secondary" className="text-xs">Manual</Badge>
                  )}
                  {supplier.postcode && (
                    <span className="text-xs text-stone-400">{supplier.postcode}</span>
                  )}
                </div>
                {supplier.description && (
                  <p className="text-sm text-stone-500 mt-1 line-clamp-1">{supplier.description}</p>
                )}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {supplier.categories.slice(0, 4).map((c) => (
                    <Badge key={c} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {CATEGORY_MAP[c as CategoryCode]?.label ?? (c as string)}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {supplier.website && (
                  <a
                    href={supplier.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-400 hover:text-stone-700"
                  >
                    <Globe className="w-4 h-4" />
                  </a>
                )}
                <Button
                  size="sm"
                  variant={supplier.isVerified ? "secondary" : "outline"}
                  className="text-xs h-7"
                  onClick={() => handleVerify(supplier.id, supplier.isVerified)}
                >
                  {supplier.isVerified ? "Verified" : "Verify"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-stone-400 hover:text-red-600 h-7 w-7 p-0"
                  onClick={() => handleDelete(supplier.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <p className="text-stone-400 text-sm py-8 text-center">No suppliers found</p>
        )}
      </div>

      {suppliers.length < totalCount && !filter && (
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : `Load more (${suppliers.length} of ${totalCount})`}
          </Button>
        </div>
      )}
    </div>
  )
}
