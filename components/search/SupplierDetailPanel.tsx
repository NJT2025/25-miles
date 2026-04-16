"use client"

import { Bookmark, BookmarkCheck, ExternalLink, Phone, Mail, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CATEGORY_MAP, getGroupColour, type CategoryCode } from "@/lib/category-definitions"
import type { SearchResultRow } from "@/components/project/ProjectSearchPage"

const RISK_STYLES: Record<string, { label: string; color: string }> = {
  CRITICALLY_ENDANGERED: { label: "⚠ Critically Endangered", color: "#b91c1c" },
  ENDANGERED: { label: "Endangered", color: "#b45309" },
  CULTURALLY_DISTINCTIVE: { label: "Culturally Distinctive", color: "#7c3aed" },
  RESURGENT: { label: "Resurgent", color: "#0f766e" },
}

interface SupplierDetailPanelProps {
  result: SearchResultRow
  onClose: () => void
  onToggleSave: () => void
}

export function SupplierDetailPanel({ result, onClose, onToggleSave }: SupplierDetailPanelProps) {
  const { supplier, distanceMiles, isSaved, isWithinRadius } = result

  const primaryCategory = supplier.categories[0] ? (supplier.categories[0] as CategoryCode) : null
  const group = primaryCategory ? CATEGORY_MAP[primaryCategory]?.group : null
  const colour = group ? getGroupColour(group) : "#888"
  const risk = supplier.heritageRiskLevel ? RISK_STYLES[supplier.heritageRiskLevel] : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 flex-shrink-0">
        <button
          onClick={onClose}
          className="text-xs text-stone-500 hover:text-stone-800 font-medium"
        >
          ← Back
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-stone-400 hover:text-stone-700"
          onClick={onToggleSave}
        >
          {isSaved ? (
            <BookmarkCheck className="w-4 h-4 text-green-700" />
          ) : (
            <Bookmark className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Name + distance */}
        <div>
          <h2 className="font-semibold text-stone-800 text-base leading-snug">{supplier.name}</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            {distanceMiles >= 99999
              ? "Location not available"
              : isWithinRadius
              ? `${distanceMiles.toFixed(1)} miles away`
              : `${distanceMiles.toFixed(1)} mi — outside radius`}
          </p>
        </div>

        {/* Heritage risk */}
        {risk && (
          <div
            className="rounded px-2.5 py-1.5 text-xs font-medium"
            style={{
              color: risk.color,
              backgroundColor: risk.color + "10",
              border: `1px solid ${risk.color}40`,
            }}
          >
            {risk.label}
            {supplier.heritageCraftType && (
              <span className="ml-1 opacity-70">· {supplier.heritageCraftType}</span>
            )}
          </div>
        )}

        {/* Description */}
        {supplier.description && (
          <p className="text-sm text-stone-600 leading-relaxed">{supplier.description}</p>
        )}

        {/* Contact details */}
        <div className="space-y-2.5">
          {supplier.address && (
            <div className="flex items-start gap-2 text-sm text-stone-600">
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-stone-400" />
              <span>
                {supplier.address}
                {supplier.postcode ? `, ${supplier.postcode}` : ""}
              </span>
            </div>
          )}
          {supplier.phone && (
            <a
              href={`tel:${supplier.phone}`}
              className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900"
            >
              <Phone className="w-4 h-4 flex-shrink-0 text-stone-400" />
              {supplier.phone}
            </a>
          )}
          {supplier.email && (
            <a
              href={`mailto:${supplier.email}`}
              className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900"
            >
              <Mail className="w-4 h-4 flex-shrink-0 text-stone-400" />
              {supplier.email}
            </a>
          )}
          {supplier.website && (
            <a
              href={/^https?:\/\//i.test(supplier.website) ? supplier.website : `https://${supplier.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
            >
              <ExternalLink className="w-4 h-4 flex-shrink-0" />
              {supplier.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          )}
        </div>

        {/* Categories */}
        {supplier.categories.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1.5">
              Categories
            </p>
            <div className="flex flex-wrap gap-1">
              {supplier.categories.map((c) => (
                <Badge
                  key={c}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0"
                  style={{
                    color: colour,
                    borderColor: colour + "40",
                    backgroundColor: colour + "10",
                  }}
                >
                  {CATEGORY_MAP[c as CategoryCode]?.label ?? c}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Accreditations */}
        {supplier.accreditations?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1.5">
              Accreditations
            </p>
            <div className="flex flex-wrap gap-1">
              {supplier.accreditations.map((a: string) => (
                <Badge key={a} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {a}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {supplier.isVerified && (
          <p className="text-xs text-green-700 font-medium">✓ Verified supplier</p>
        )}
      </div>
    </div>
  )
}
