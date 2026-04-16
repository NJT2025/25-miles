"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { CATEGORIES, GROUPS, type CategoryCode, type GroupKey } from "@/lib/category-definitions"

interface CategoryPanelProps {
  selected: Set<CategoryCode>
  onToggle: (code: CategoryCode) => void
  onSelectAll: (group: GroupKey) => void
  onClearAll: (group: GroupKey) => void
}

export function CategoryPanel({
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
}: CategoryPanelProps) {
  const byGroup = Object.fromEntries(GROUPS.map((g) => [g.key, [] as typeof CATEGORIES])) as Record<GroupKey, typeof CATEGORIES>
  for (const cat of CATEGORIES) {
    byGroup[cat.group].push(cat)
  }

  return (
    <div className="space-y-4 text-sm">
      {GROUPS.map((group) => {
        const cats = byGroup[group.key]
        const selectedCount = cats.filter((c) => selected.has(c.code)).length
        const allSelected = selectedCount === cats.length

        return (
          <div key={group.key}>
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="font-semibold text-xs uppercase tracking-wide"
                style={{ color: group.colour }}
              >
                {group.label}
              </span>
              <button
                type="button"
                onClick={() => (allSelected ? onClearAll(group.key) : onSelectAll(group.key))}
                className="text-xs text-stone-400 hover:text-stone-600"
              >
                {allSelected ? "Clear" : "All"}
              </button>
            </div>

            <div className="space-y-1.5 pl-1">
              {cats.map((cat) => (
                <div key={cat.code} className="flex items-center gap-2">
                  <Checkbox
                    id={cat.code}
                    checked={selected.has(cat.code)}
                    onCheckedChange={() => onToggle(cat.code)}
                  />
                  <Label htmlFor={cat.code} className="text-stone-700 cursor-pointer font-normal">
                    {cat.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
