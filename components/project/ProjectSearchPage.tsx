"use client"

import { useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CategoryPanel } from "@/components/search/CategoryPanel"
import { ResultsList } from "@/components/search/ResultsList"
import { SupplierDetailPanel } from "@/components/search/SupplierDetailPanel"
import { Search, RefreshCw, ChevronLeft, Pencil, Download, Printer } from "lucide-react"
import Link from "next/link"
import type { CategoryCode, GroupKey } from "@/lib/category-definitions"
import { CATEGORIES, CATEGORY_MAP } from "@/lib/category-definitions"
import { useToast } from "@/hooks/use-toast"

// Dynamic import — react-map-gl is client-side only
const ProjectMap = dynamic(
  () => import("@/components/map/ProjectMap").then((m) => m.ProjectMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-stone-100 animate-pulse rounded" /> }
)

export interface SupplierRow {
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
  isNationalKnown: boolean
  sourceUrl: string | null
  heritageRiskLevel: string | null
  heritageCraftType: string | null
}

export interface SearchResultRow {
  id: string
  isSaved: boolean
  isDismissed: boolean
  distanceMiles: number
  isWithinRadius: boolean
  supplier: SupplierRow
}

export interface SearchSessionData {
  id: string
  categories: string[]
  radius: number
  results: SearchResultRow[]
}

export interface SessionSummary {
  id: string
  createdAt: string
  categories: string[]
  radius: number
  resultCount: number
}

interface ProjectData {
  id: string
  name: string
  postcode: string
  lat: number | null
  lng: number | null
  radius: number
}

interface ProjectSearchPageProps {
  project: ProjectData
  initialSession: SearchSessionData | null
  allSessions: SessionSummary[]
}

function exportCSV(results: SearchResultRow[], projectName: string) {
  const header = ["Name", "Postcode", "Address", "Phone", "Email", "Website", "Categories", "Distance (miles)"]
  const rows = results.map((r) => [
    r.supplier.name,
    r.supplier.postcode ?? "",
    r.supplier.address ?? "",
    r.supplier.phone ?? "",
    r.supplier.email ?? "",
    r.supplier.website ?? "",
    r.supplier.categories.map((c) => CATEGORY_MAP[c as CategoryCode]?.label ?? c).join("; "),
    r.distanceMiles >= 99999 ? "" : r.distanceMiles.toFixed(1),
  ])
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${projectName.replace(/\s+/g, "-").toLowerCase()}-saved.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function ProjectSearchPage({ project, initialSession, allSessions }: ProjectSearchPageProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [selectedCategories, setSelectedCategories] = useState<Set<CategoryCode>>(
    new Set((initialSession?.categories ?? []) as CategoryCode[])
  )
  const [radius, setRadius] = useState(project.radius)
  const [keywords, setKeywords] = useState("")
  const [results, setResults] = useState<SearchResultRow[]>(initialSession?.results ?? [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accreditationFilter, setAccreditationFilter] = useState<Set<string>>(new Set())

  // Local sessions list — updated client-side after each new search so the
  // dropdown refreshes immediately without a full router.refresh()
  const [sessions, setSessions] = useState<SessionSummary[]>(allSessions)
  const [currentSessionId, setCurrentSessionId] = useState(initialSession?.id ?? "")

  // Dismissed results — persisted server-side; local Set mirrors DB for instant UI
  const [dismissed, setDismissed] = useState<Set<string>>(
    new Set((initialSession?.results ?? []).filter((r) => r.isDismissed).map((r) => r.id))
  )

  // Saved tab
  const [showSaved, setShowSaved] = useState(false)
  const [savedResults, setSavedResults] = useState<SearchResultRow[]>([])
  const [loadingSaved, setLoadingSaved] = useState(false)

  // Edit modal
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState(project.name)
  const [editPostcode, setEditPostcode] = useState(project.postcode)
  const [editRadius, setEditRadius] = useState(project.radius)
  const [editSaving, setEditSaving] = useState(false)
  const [deleteConfirming, setDeleteConfirming] = useState(false)

  // lat/lng may be null on first load (geocoded on first search); update locally once known
  const [projectLat, setProjectLat] = useState(project.lat ?? 51.5)
  const [projectLng, setProjectLng] = useState(project.lng ?? -0.12)

  // ── Category toggles ──────────────────────────────────────
  const toggleCategory = useCallback((code: CategoryCode) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }, [])

  const selectAll = useCallback((group: GroupKey) => {
    const codes = CATEGORIES.filter((c) => c.group === group).map((c) => c.code)
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      codes.forEach((c) => next.add(c))
      return next
    })
  }, [])

  const clearAll = useCallback((group: GroupKey) => {
    const codes = new Set(CATEGORIES.filter((c) => c.group === group).map((c) => c.code))
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      codes.forEach((c) => next.delete(c))
      return next
    })
  }, [])

  // ── Search ─────────────────────────────────────────────────
  async function handleSearch() {
    if (selectedCategories.size === 0) {
      setError("Select at least one category to search.")
      return
    }
    setError(null)
    setSearching(true)
    setResults([])
    setSelectedId(null)
    setShowSaved(false)
    setDismissed(new Set())
    setAccreditationFilter(new Set())

    try {
      const res = await fetch(`/api/projects/${project.id}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: Array.from(selectedCategories), radius, keywords: keywords.trim() || undefined }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Search failed")
        setCurrentSessionId("")
        return
      }

      const data = await res.json()
      setResults(data.results ?? [])

      // Update project coordinates if they were geocoded during this search
      if (data.projectLat && data.projectLng) {
        setProjectLat(data.projectLat)
        setProjectLng(data.projectLng)
      }

      if (data.sessionId) {
        setCurrentSessionId(data.sessionId)
        const newSession: SessionSummary = {
          id: data.sessionId,
          createdAt: new Date().toISOString(),
          categories: Array.from(selectedCategories),
          radius,
          resultCount: (data.results ?? []).length,
        }
        setSessions((prev) => [newSession, ...prev])
      }

      toast({
        title: "Search complete",
        description: `Found ${(data.results ?? []).length} suppliers`,
      })
    } catch {
      setError("Search failed. Please try again.")
    } finally {
      setSearching(false)
    }
  }

  function handleNewSearch() {
    setSelectedCategories(new Set())
    setResults([])
    setSelectedId(null)
    setError(null)
    setCurrentSessionId("")
    setShowSaved(false)
    setDismissed(new Set())
    setKeywords("")
    setAccreditationFilter(new Set())
  }

  // ── Toggle save ─────────────────────────────────────────────
  async function handleToggleSave(resultId: string, current: boolean) {
    const supplierName =
      [...results, ...savedResults].find((r) => r.id === resultId)?.supplier.name ?? ""

    const res = await fetch(`/api/projects/${project.id}/results`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultId, isSaved: !current }),
    })

    if (res.ok) {
      const toggle = (list: SearchResultRow[]) =>
        list.map((r) => (r.id === resultId ? { ...r, isSaved: !current } : r))
      setResults(toggle)
      setSavedResults(toggle)
      toast({ title: current ? "Removed from saved" : "Saved", description: supplierName })
    }
  }

  // ── Saved tab ───────────────────────────────────────────────
  async function handleShowSaved() {
    setShowSaved(true)
    setSelectedId(null)
    setLoadingSaved(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/results?saved=true`)
      if (res.ok) {
        const data = await res.json()
        setSavedResults(data.results ?? [])
      }
    } finally {
      setLoadingSaved(false)
    }
  }

  // ── Session switcher ────────────────────────────────────────
  async function handleSessionChange(sessionId: string) {
    setCurrentSessionId(sessionId)
    setShowSaved(false)
    setSelectedId(null)
    setAccreditationFilter(new Set())

    if (!sessionId) {
      setResults([])
      setSelectedCategories(new Set())
      return
    }

    try {
      const res = await fetch(`/api/projects/${project.id}/results?sessionId=${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        const fetched: SearchResultRow[] = data.results ?? []
        setResults(fetched)
        setDismissed(new Set(fetched.filter((r) => r.isDismissed).map((r) => r.id)))
        setSelectedCategories(new Set((data.categories ?? []) as CategoryCode[]))
        if (data.radius) setRadius(data.radius)
      }
    } catch {
      // silently fail
    }
  }

  // ── Edit project ────────────────────────────────────────────
  async function handleEditSave() {
    setEditSaving(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, postcode: editPostcode, radius: editRadius }),
      })
      if (res.ok) {
        setRadius(editRadius)
        setEditOpen(false)
        setDeleteConfirming(false)
        router.refresh()
      }
    } finally {
      setEditSaving(false)
    }
  }

  // ── Delete project ──────────────────────────────────────────
  async function handleDeleteProject() {
    setEditSaving(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" })
      if (res.ok) router.push("/projects")
    } finally {
      setEditSaving(false)
    }
  }

  // ── Dismiss ─────────────────────────────────────────────────
  function handleDismiss(resultId: string) {
    setDismissed((prev) => new Set(prev).add(resultId))
    if (selectedId !== null) {
      const result = results.find((r) => r.id === resultId)
      if (result?.supplier.id === selectedId) setSelectedId(null)
    }
    // Persist server-side (fire and forget — UI already updated optimistically)
    fetch(`/api/projects/${project.id}/results`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultId, isDismissed: true }),
    })
  }

  // ── Computed values ─────────────────────────────────────────
  const postDismissResults = results
    .filter((r) => !dismissed.has(r.id))
    .map((r) => ({
      ...r,
      isWithinRadius: r.distanceMiles <= radius,
    }))

  const availableAccreditations = Array.from(
    new Set(postDismissResults.flatMap((r) => r.supplier.accreditations ?? []))
  ).sort()

  const filteredResults =
    accreditationFilter.size === 0
      ? postDismissResults
      : postDismissResults.filter((r) =>
          r.supplier.accreditations?.some((a) => accreditationFilter.has(a))
        )

  const withinCount = filteredResults.filter((r) => r.isWithinRadius && !r.supplier.isNationalKnown).length
  const visibleResults = showSaved ? savedResults : filteredResults
  const selectedResult =
    selectedId !== null
      ? visibleResults.find((r) => r.supplier.id === selectedId) ?? null
      : null

  function sessionLabel(s: SessionSummary) {
    const d = new Date(s.createdAt)
    const dd = String(d.getDate()).padStart(2, "0")
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const yy = String(d.getFullYear()).slice(2)
    return `${dd}/${mm}/${yy} — ${s.resultCount} results (${s.radius}mi)`
  }

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-5 py-3 bg-white border-b border-stone-200 flex-shrink-0">
        <Link href="/projects" className="text-stone-400 hover:text-stone-700">
          <ChevronLeft className="w-5 h-5" />
        </Link>

        <h1 className="font-semibold text-stone-800 text-base truncate">{project.name}</h1>
        <span className="text-stone-400 text-sm">{project.postcode}</span>
        <button
          onClick={() => {
            setEditName(project.name)
            setEditPostcode(project.postcode)
            setEditRadius(radius)
            setDeleteConfirming(false)
            setEditOpen(true)
          }}
          className="text-stone-400 hover:text-stone-700"
          aria-label="Edit project"
        >
          <Pencil className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-stone-500">Radius:</span>
          <Input
            type="number"
            min={1}
            max={200}
            value={radius}
            onChange={(e) => setRadius(Math.min(200, Math.max(1, Number(e.target.value))))}
            className="w-20 h-8 text-sm"
          />
          <span className="text-sm text-stone-500">miles</span>

          <Button
            size="sm"
            onClick={handleSearch}
            disabled={searching || selectedCategories.size === 0}
          >
            {searching ? (
              <>
                <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                Searching…
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-1.5" />
                Search
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error bar */}
      {error && (
        <div className="px-5 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: filter panel */}
        <aside className="w-56 flex-shrink-0 border-r border-stone-200 bg-white overflow-y-auto flex flex-col">
          <div className="flex-1 p-4 overflow-y-auto">
            <CategoryPanel
              selected={selectedCategories}
              onToggle={toggleCategory}
              onSelectAll={selectAll}
              onClearAll={clearAll}
            />
          </div>
          <div className="p-4 border-t border-stone-100 space-y-1">
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">
              Refine keywords
            </p>
            <Input
              placeholder="e.g. listed building"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && selectedCategories.size > 0 && !searching) handleSearch()
              }}
              className="h-8 text-xs"
            />
          </div>
          <div className="p-4 border-t border-stone-100">
            <Button variant="ghost" size="sm" className="text-xs w-full" onClick={handleNewSearch}>
              New search
            </Button>
          </div>
        </aside>

        {/* Centre: map */}
        <div className="flex-1 relative">
          <ProjectMap
            lat={projectLat}
            lng={projectLng}
            radius={radius}
            results={visibleResults}
            selectedId={selectedId}
            onSelectSupplier={setSelectedId}
          />
        </div>

        {/* Right: results sidebar */}
        <aside className="w-80 flex-shrink-0 border-l border-stone-200 bg-white flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-stone-100 flex-shrink-0 space-y-2">
            {/* Results / Saved toggle */}
            <div className="flex items-center gap-3">
              <button
                className={`text-xs font-semibold uppercase tracking-wide transition-colors ${
                  !showSaved ? "text-stone-800" : "text-stone-400 hover:text-stone-600"
                }`}
                onClick={() => {
                  setShowSaved(false)
                  setSelectedId(null)
                }}
              >
                {searching ? "Searching…" : `${withinCount} within ${radius}mi`}
              </button>
              <span className="text-stone-300 text-xs">|</span>
              <button
                className={`text-xs font-semibold uppercase tracking-wide transition-colors ${
                  showSaved ? "text-stone-800" : "text-stone-400 hover:text-stone-600"
                }`}
                onClick={handleShowSaved}
              >
                Saved{savedResults.length > 0 ? ` (${savedResults.length})` : ""}
              </button>
              {showSaved && savedResults.length > 0 && (
                <button
                  onClick={() => exportCSV(savedResults, project.name)}
                  className="ml-auto text-stone-400 hover:text-stone-700"
                  title="Export saved as CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              )}
              {!showSaved && currentSessionId && (
                <a
                  href={`/projects/${project.id}/print?sessionId=${currentSessionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-stone-400 hover:text-stone-700"
                  title="Print report"
                >
                  <Printer className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {/* Session dropdown — only in results view */}
            {!showSaved && sessions.length > 0 && (
              <select
                value={currentSessionId}
                onChange={(e) => handleSessionChange(e.target.value)}
                className="w-full text-xs text-stone-500 bg-transparent border border-stone-200 rounded px-2 py-1 outline-none cursor-pointer"
              >
                <option value="">New search</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {sessionLabel(s)}
                  </option>
                ))}
              </select>
            )}

            {/* Accreditations filter pills */}
            {!showSaved && availableAccreditations.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {availableAccreditations.map((a) => (
                  <button
                    key={a}
                    onClick={() =>
                      setAccreditationFilter((prev) => {
                        const next = new Set(prev)
                        if (next.has(a)) next.delete(a)
                        else next.add(a)
                        return next
                      })
                    }
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                      accreditationFilter.has(a)
                        ? "bg-stone-800 text-white border-stone-800"
                        : "bg-white text-stone-500 border-stone-300 hover:border-stone-500"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Body — switches between detail / saved list / results list */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {selectedResult ? (
              <SupplierDetailPanel
                result={selectedResult}
                onClose={() => setSelectedId(null)}
                onToggleSave={() => handleToggleSave(selectedResult.id, selectedResult.isSaved)}
              />
            ) : showSaved ? (
              <div className="flex-1 overflow-y-auto p-3">
                {loadingSaved ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 bg-stone-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <ResultsList
                    results={savedResults}
                    selectedId={selectedId}
                    onSelectSupplier={setSelectedId}
                    onToggleSave={handleToggleSave}
                  />
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3">
                {searching ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 bg-stone-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <ResultsList
                    results={filteredResults}
                    selectedId={selectedId}
                    onSelectSupplier={setSelectedId}
                    onToggleSave={handleToggleSave}
                    onDismiss={handleDismiss}
                    onExpandRadius={() => setRadius((r) => Math.min(r * 2, 200))}
                  />
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Edit project dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setDeleteConfirming(false)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-postcode">Postcode</Label>
              <Input
                id="edit-postcode"
                value={editPostcode}
                onChange={(e) => setEditPostcode(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-radius">Default radius (miles)</Label>
              <Input
                id="edit-radius"
                type="number"
                min={1}
                max={200}
                value={editRadius}
                onChange={(e) => setEditRadius(Math.max(1, Number(e.target.value)))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditSave} disabled={editSaving || !editName.trim()}>
                {editSaving && !deleteConfirming ? "Saving…" : "Save"}
              </Button>
            </div>

            {/* Delete zone */}
            <div className="pt-3 border-t border-stone-100">
              {deleteConfirming ? (
                <div className="rounded bg-red-50 border border-red-200 p-3 space-y-2">
                  <p className="text-sm text-red-700">
                    Delete this project? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirming(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteProject}
                      disabled={editSaving}
                    >
                      {editSaving ? "Deleting…" : "Yes, delete"}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-xs text-red-500 hover:text-red-700 underline"
                  onClick={() => setDeleteConfirming(true)}
                >
                  Delete project
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
