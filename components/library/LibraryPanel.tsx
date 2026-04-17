"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { BookOpen, Globe, Mail, Phone, MapPin, Trash2, Search, Plus } from "lucide-react"
import { CATEGORY_MAP, CATEGORIES, getGroupColour, type CategoryCode } from "@/lib/category-definitions"

interface SupplierRecord {
  id: string
  name: string
  description: string | null
  address: string | null
  postcode: string | null
  phone: string | null
  email: string | null
  website: string | null
  categories: string[]
  accreditations: string[]
  isVerified: boolean
  isNationalKnown: boolean
}

interface LibraryPanelProps {
  initialSuppliers: SupplierRecord[]
  total: number
}

export function LibraryPanel({ initialSuppliers, total: initialTotal }: LibraryPanelProps) {
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>(initialSuppliers)
  const [total, setTotal] = useState(initialTotal)
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
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

  function toggleCategory(code: CategoryCode) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(code)
        ? f.categories.filter((c) => c !== code)
        : [...f.categories, code],
    }))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          accreditations: form.accreditations
            ? form.accreditations.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
        }),
      })
      if (res.ok) {
        const supplier = await res.json()
        setSuppliers((prev) => [supplier, ...prev])
        setTotal((t) => t + 1)
        setAddOpen(false)
        setForm({
          name: "", description: "", address: "", postcode: "",
          phone: "", email: "", website: "", categories: [],
          accreditations: "", isNationalKnown: false,
        })
      }
    } finally {
      setSaving(false)
    }
  }

  const fetchSuppliers = useCallback(async (q: string, skip = 0, append = false) => {
    const params = new URLSearchParams({ skip: String(skip), take: "50" })
    if (q.trim()) params.set("q", q.trim())
    const res = await fetch(`/api/library?${params}`)
    if (!res.ok) return
    const data = await res.json()
    setTotal(data.total)
    setSuppliers((prev) => append ? [...prev, ...data.suppliers] : data.suppliers)
  }, [])

  // Debounce: wait 300ms after the user stops typing before fetching
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  const handleSearch = (q: string) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      await fetchSuppliers(q)
      setSearching(false)
    }, 300)
  }

  const handleLoadMore = async () => {
    setLoadingMore(true)
    await fetchSuppliers(query, suppliers.length, true)
    setLoadingMore(false)
  }

  const handleRemove = async (id: string) => {
    setRemoving(id)
    try {
      const res = await fetch(`/api/library/${id}`, { method: "DELETE" })
      if (res.ok) {
        setSuppliers((prev) => prev.filter((s) => s.id !== id))
        setTotal((t) => t - 1)
      }
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            className="pl-9"
            placeholder="Search by name or postcode…"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add supplier to library</DialogTitle>
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
                  <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Postcode</Label>
                  <Input value={form.postcode} onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Website</Label>
                  <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
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
                        id={`lib-${cat.code}`}
                        checked={form.categories.includes(cat.code)}
                        onCheckedChange={() => toggleCategory(cat.code)}
                      />
                      <label htmlFor={`lib-${cat.code}`} className="text-sm cursor-pointer">
                        {cat.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="lib-national"
                  checked={form.isNationalKnown}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isNationalKnown: !!v }))}
                />
                <Label htmlFor="lib-national">Nationally known (show beyond radius)</Label>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving || form.categories.length === 0 || !form.name.trim()}>
                  {saving ? "Saving…" : "Add to library"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Results */}
      {suppliers.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <BookOpen className="w-10 h-10 mx-auto mb-4 opacity-40" />
          {searching ? (
            <p className="text-sm">Searching…</p>
          ) : query ? (
            <p className="text-sm">No suppliers match &ldquo;{query}&rdquo;</p>
          ) : (
            <>
              <p className="text-lg font-medium mb-1">Library is empty</p>
              <p className="text-sm">Save suppliers from your search results to build your practice library.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {suppliers.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-stone-200 rounded-lg p-4 flex gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-medium text-stone-800 truncate">{s.name}</h3>
                  {s.isVerified && (
                    <Badge variant="secondary" className="shrink-0 text-xs">Verified</Badge>
                  )}
                </div>

                {/* Categories */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {s.categories.slice(0, 4).map((c) => {
                    const def = CATEGORY_MAP[c as keyof typeof CATEGORY_MAP]
                    const colour = def ? getGroupColour(def.group) : "#78716c"
                    return (
                      <span
                        key={c}
                        className="text-[11px] px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `${colour}22`,
                          color: colour,
                        }}
                      >
                        {def?.label ?? c}
                      </span>
                    )
                  })}
                  {s.categories.length > 4 && (
                    <span className="text-[11px] text-stone-400">+{s.categories.length - 4} more</span>
                  )}
                </div>

                {/* Contact row */}
                <div className="flex flex-wrap gap-3 text-xs text-stone-500">
                  {(s.address || s.postcode) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {[s.address, s.postcode].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {s.phone && (
                    <a href={`tel:${s.phone}`} className="flex items-center gap-1 hover:text-stone-800">
                      <Phone className="w-3 h-3" />{s.phone}
                    </a>
                  )}
                  {s.email && (
                    <a href={`mailto:${s.email}`} className="flex items-center gap-1 hover:text-stone-800">
                      <Mail className="w-3 h-3" />{s.email}
                    </a>
                  )}
                  {s.website && (
                    <a
                      href={s.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-stone-800"
                    >
                      <Globe className="w-3 h-3" />
                      {s.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  )}
                </div>

                {s.description && (
                  <p className="text-xs text-stone-400 mt-2 line-clamp-2">{s.description}</p>
                )}
              </div>

              {/* Remove button */}
              <div className="shrink-0 pt-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-stone-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                  disabled={removing === s.id}
                  onClick={() => handleRemove(s.id)}
                  title="Remove from library"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {suppliers.length < total && (
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : `Load more (${total - suppliers.length} remaining)`}
          </Button>
        </div>
      )}
    </div>
  )
}
