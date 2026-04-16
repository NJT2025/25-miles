"use client"

import { Globe } from "lucide-react"
import { SearchResultCard } from "./SearchResultCard"
import type { SearchResultRow } from "@/components/project/ProjectSearchPage"

interface ResultsListProps {
  results: SearchResultRow[]
  selectedId: string | null
  onSelectSupplier: (id: string | null) => void
  onToggleSave: (resultId: string, current: boolean) => void
  onDismiss?: (resultId: string) => void
  onExpandRadius?: () => void
}

export function ResultsList({
  results,
  selectedId,
  onSelectSupplier,
  onToggleSave,
  onDismiss,
  onExpandRadius,
}: ResultsListProps) {
  const national = results.filter((r) => r.supplier.isNationalKnown)
  const nonNational = results.filter((r) => !r.supplier.isNationalKnown)
  const within = nonNational.filter((r) => r.isWithinRadius)
  const beyond = nonNational.filter((r) => !r.isWithinRadius)

  if (results.length === 0) {
    return (
      <p className="text-sm text-stone-400 text-center py-6">
        No results yet. Select categories and click Search.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {within.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
            Within radius ({within.length})
          </p>
          <div className="space-y-2">
            {within.map((result, i) => (
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
            {beyond.map((result, i) => (
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
