"use client"

import { useState, useEffect } from "react"
import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SearchResultCard } from "./SearchResultCard"
import type { SearchResultRow } from "@/components/project/ProjectSearchPage"

const PAGE_SIZE = 20

interface ResultsListProps {
  results: SearchResultRow[]
  selectedId: string | null
  onSelectSupplier: (id: string | null) => void
  onToggleSave: (resultId: string, current: boolean) => void
  onDismiss?: (resultId: string) => void
  onExpandRadius?: () => void
  hasSearched?: boolean
}

export function ResultsList({
  results,
  selectedId,
  onSelectSupplier,
  onToggleSave,
  onDismiss,
  onExpandRadius,
  hasSearched = false,
}: ResultsListProps) {
  const national = results.filter((r) => r.supplier.isNationalKnown)
  const nonNational = results.filter((r) => !r.supplier.isNationalKnown)
  const within = nonNational.filter((r) => r.isWithinRadius)
  const beyond = nonNational.filter((r) => !r.isWithinRadius)

  const [withinVisible, setWithinVisible] = useState(PAGE_SIZE)
  const [beyondVisible, setBeyondVisible] = useState(PAGE_SIZE)

  // Reset pagination when results change
  useEffect(() => {
    setWithinVisible(PAGE_SIZE)
    setBeyondVisible(PAGE_SIZE)
  }, [results])

  if (results.length === 0) {
    if (hasSearched) {
      return (
        <div className="text-center py-8 space-y-2">
          <p className="text-sm text-stone-500 font-medium">No results found</p>
          <p className="text-xs text-stone-400">
            No verified suppliers were found for this area. Try a broader radius or different categories.
          </p>
        </div>
      )
    }
    return (
      <p className="text-sm text-stone-400 text-center py-6">
        Select categories and click Search.
      </p>
    )
  }

  const withinSlice = within.slice(0, withinVisible)
  const beyondSlice = beyond.slice(0, beyondVisible)

  return (
    <div className="space-y-4">
      {within.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
            Within radius ({within.length})
          </p>
          <div className="space-y-2">
            {withinSlice.map((result, i) => (
              <SearchResultCard
                key={result.id}
                result={result}
                index={i}
                isSelected={result.supplier.id === selectedId}
                onSelect={() => onSelectSupplier(result.supplier.id)}
                onToggleSave={() => onToggleSave(result.id, result.isSaved)}
                onDismiss={() => onDismiss?.(result.id)}
              />
            ))}
          </div>
          {within.length > withinVisible && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-xs text-stone-500"
              onClick={() => setWithinVisible((c) => c + PAGE_SIZE)}
            >
              Show {Math.min(within.length - withinVisible, PAGE_SIZE)} more ({within.length - withinVisible} remaining)
            </Button>
          )}
        </div>
      )}

      {within.length === 0 && beyond.length > 0 && onExpandRadius && (
        <button
          onClick={onExpandRadius}
          className="w-full text-xs text-stone-500 hover:text-stone-700 underline py-1"
        >
          Expand radius to include {beyond.length} nearby result{beyond.length !== 1 ? "s" : ""}
        </button>
      )}

      {beyond.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2 flex items-center gap-2">
            <span className="flex-1 border-t border-stone-200" />
            Also found (beyond radius)
            <span className="flex-1 border-t border-stone-200" />
          </p>
          <div className="space-y-2">
            {beyondSlice.map((result, i) => (
              <SearchResultCard
                key={result.id}
                result={result}
                index={within.length + i}
                isSelected={result.supplier.id === selectedId}
                onSelect={() => onSelectSupplier(result.supplier.id)}
                onToggleSave={() => onToggleSave(result.id, result.isSaved)}
                onDismiss={() => onDismiss?.(result.id)}
              />
            ))}
          </div>
          {beyond.length > beyondVisible && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-xs text-stone-500"
              onClick={() => setBeyondVisible((c) => c + PAGE_SIZE)}
            >
              Show {Math.min(beyond.length - beyondVisible, PAGE_SIZE)} more ({beyond.length - beyondVisible} remaining)
            </Button>
          )}
        </div>
      )}

      {national.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2 flex items-center gap-2">
            <span className="flex-1 border-t border-stone-200" />
            <Globe className="w-3 h-3 flex-shrink-0" />
            National suppliers
            <span className="flex-1 border-t border-stone-200" />
          </p>
          <div className="space-y-2">
            {national.map((result, i) => (
              <SearchResultCard
                key={result.id}
                result={result}
                index={within.length + beyond.length + i}
                isSelected={result.supplier.id === selectedId}
                onSelect={() => onSelectSupplier(result.supplier.id)}
                onToggleSave={() => onToggleSave(result.id, result.isSaved)}
                onDismiss={() => onDismiss?.(result.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
