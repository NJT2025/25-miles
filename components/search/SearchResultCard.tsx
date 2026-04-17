"use client"

import { Bookmark, BookmarkCheck, ExternalLink, Phone, Mail, MapPin, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  CATEGORY_MAP,
  getGroupColour,
  GROUPS,
  type CategoryCode,
} from "@/lib/category-definitions"
import type { SearchResultRow } from "@/components/project/ProjectSearchPage"

interface SearchResultCardProps {
  result: SearchResultRow
  index: number
  isSelected: boolean
  onSelect: () => void
  onToggleSave: () => void
  onDismiss: () => void
}

export function SearchResultCard({
  result,
  index,
  isSelected,
  onSelect,
  onToggleSave,
  onDismiss,
}: SearchResultCardProps) {
  const { supplier, distanceMiles, isSaved, isWithinRadius } = result

  const primaryCategory = supplier.categories[0] ? (supplier.categories[0] as CategoryCode) : null
  const group = primaryCategory ? CATEGORY_MAP[primaryCategory]?.group : null
  const colour = group ? getGroupColour(group) : "#888"
  const groupLabel = group ? GROUPS.find((g) => g.key === group)?.label : null

  return (
    <div
      className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        isSelected
          ? "border-stone-400 bg-stone-50"
          : !isWithinRadius && !supplier.isNationalKnown
          ? "border-red-200 hover:border-red-300 bg-white"
          : "border-stone-200 hover:border-stone-300 bg-white"
      }`}
      onClick={onSelect}
    >
      {/* Number dot */}
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5"
        style={{ backgroundColor: colour }}
      >
        {index + 1}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-stone-800 text-sm leading-snug">{supplier.name}</p>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className={`text-xs font-medium whitespace-nowrap ${
              !isWithinRadius && !supplier.isNationalKnown && distanceMiles < 99999
                ? "text-red-500"
                : "text-stone-400"
            }`}>
              {distanceMiles >= 99999
                ? "—"
                : isWithinRadius
                ? `${distanceMiles.toFixed(1)} mi`
                : `${distanceMiles.toFixed(1)} mi — outside radius`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-stone-400 hover:text-stone-700"
              onClick={(e) => {
                e.stopPropagation()
                onToggleSave()
              }}
            >
              {isSaved ? (
                <BookmarkCheck className="w-4 h-4 text-green-700" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-stone-300 hover:text-stone-600"
              title="Dismiss"
              onClick={(e) => {
                e.stopPropagation()
                onDismiss()
              }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Category badge */}
        {groupLabel && (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 mt-1"
            style={{ color: colour, borderColor: colour + "40", backgroundColor: colour + "10" }}
          >
            {supplier.categories
              .slice(0, 2)
              .map((c) => CATEGORY_MAP[c as CategoryCode]?.label ?? c)
              .join(", ")}
          </Badge>
        )}

        {supplier.description && (
          <p className="text-xs text-stone-500 mt-1.5 line-clamp-2">{supplier.description}</p>
        )}

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {supplier.address && (
            <span className="flex items-center gap-1 text-xs text-stone-400">
              <MapPin className="w-3 h-3" />
              {supplier.postcode ?? supplier.address}
            </span>
          )}
          {supplier.phone && (
            <a
              href={`tel:${supplier.phone}`}
              className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700"
              onClick={(e) => e.stopPropagation()}
            >
              <Phone className="w-3 h-3" />
              {supplier.phone}
            </a>
          )}
          {supplier.website && (
            <a
              href={/^https?:\/\//i.test(supplier.website) ? supplier.website : `https://${supplier.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3" />
              Website
            </a>
          )}
          {supplier.email && (
            <a
              href={`mailto:${supplier.email}`}
              className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700"
              onClick={(e) => e.stopPropagation()}
            >
              <Mail className="w-3 h-3" />
              Email
            </a>
          )}
        </div>

        {/* Quality signal badges */}
        <div className="flex flex-wrap gap-1 mt-2">
          {supplier.isPracticeSaved && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
              style={{ color: "#7c3aed", borderColor: "#7c3aed40", backgroundColor: "#7c3aed10" }}
            >
              In Library
            </Badge>
          )}
          {supplier.isVerified && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
              style={{ color: "#15803d", borderColor: "#15803d40", backgroundColor: "#15803d10" }}
            >
              Verified
            </Badge>
          )}
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 text-stone-400 border-stone-200 bg-stone-50"
          >
            {supplier.isManualEntry ? "Manual" : supplier.sourceUrl ? "Web" : "AI"}
          </Badge>
        </div>

        {supplier.heritageRiskLevel && (
          <div className="flex flex-wrap gap-1 mt-2">
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
              style={
                supplier.heritageRiskLevel === 'CRITICALLY_ENDANGERED'
                  ? { color: '#b91c1c', borderColor: '#b91c1c40', backgroundColor: '#b91c1c10' }
                  : supplier.heritageRiskLevel === 'ENDANGERED'
                  ? { color: '#b45309', borderColor: '#b4530940', backgroundColor: '#b4530910' }
                  : supplier.heritageRiskLevel === 'CULTURALLY_DISTINCTIVE'
                  ? { color: '#7c3aed', borderColor: '#7c3aed40', backgroundColor: '#7c3aed10' }
                  : { color: '#0f766e', borderColor: '#0f766e40', backgroundColor: '#0f766e10' }
              }
            >
              {supplier.heritageRiskLevel === 'CRITICALLY_ENDANGERED'
                ? '⚠ Critically Endangered'
                : supplier.heritageRiskLevel === 'ENDANGERED'
                ? 'Endangered'
                : supplier.heritageRiskLevel === 'CULTURALLY_DISTINCTIVE'
                ? 'Culturally Distinctive'
                : 'Resurgent'}
            </Badge>
            {supplier.heritageCraftType && (
              <span className="text-[10px] text-stone-400 self-center">{supplier.heritageCraftType}</span>
            )}
          </div>
        )}

        {supplier.accreditations?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {supplier.accreditations.map((a: string) => (
              <Badge key={a} variant="secondary" className="text-[10px] px-1.5 py-0">
                {a}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
