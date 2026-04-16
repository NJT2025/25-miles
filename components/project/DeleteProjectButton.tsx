"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDeleting(true)
    await fetch(`/api/projects/${projectId}`, { method: "DELETE" })
    router.refresh()
  }

  if (confirming) {
    return (
      <div
        className="flex items-center gap-1.5"
        onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
      >
        <span className="text-xs text-red-600">Delete?</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Yes"}
        </button>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(false) }}
          className="text-xs text-stone-400 hover:text-stone-600"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(true) }}
      className="text-stone-300 hover:text-red-500 transition-colors p-0.5"
      title="Delete project"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  )
}
