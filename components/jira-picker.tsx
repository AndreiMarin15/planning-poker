'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, Plus, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { JiraSprintIssue } from '@/lib/use-jira'

interface Props {
  onAdd: (issues: JiraSprintIssue[]) => Promise<void>
  onClose: () => void
}

const PRIORITY_COLOR: Record<string, string> = {
  Highest: '#e5534b', High: '#f97316', Medium: '#f59e0b',
  Low: '#3b82f6', Lowest: '#6b7280',
}

export function JiraPicker({ onAdd, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [issues, setIssues] = useState<JiraSprintIssue[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [adding, setAdding] = useState(false)
  const [done, setDone] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadIssues('')
    inputRef.current?.focus()
  }, [])

  async function loadIssues(q: string) {
    setLoading(true)
    try {
      const url = q.trim()
        ? `/api/jira/search?q=${encodeURIComponent(q)}`
        : '/api/jira/sprint'
      const res = await fetch(url)
      const data = await res.json()
      setIssues(data.issues ?? [])
    } finally {
      setLoading(false)
      setInitialLoad(false)
    }
  }

  function handleSearch(q: string) {
    setQuery(q)
    setInitialLoad(false)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setLoading(true)
      loadIssues(q)
    }, 500)
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === issues.length) setSelected(new Set())
    else setSelected(new Set(issues.map((i) => i.key)))
  }

  async function handleAdd() {
    if (adding || done) return
    const picked = issues.filter((i) => selected.has(i.key))
    setAdding(true)
    try {
      await onAdd(picked)
      setDone(true)
      setTimeout(onClose, 700)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--surface2)', border: '1px solid var(--border)', maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search issues or leave empty for active sprint…"
            className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none"
          />
          {loading && <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin shrink-0" />}
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors ml-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Select all row */}
        {!initialLoad && issues.length > 0 && (
          <div
            className="flex items-center gap-3 px-4 py-2 shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <input
              type="checkbox"
              checked={selected.size === issues.length && issues.length > 0}
              onChange={toggleAll}
              className="accent-[var(--accent)] w-3.5 h-3.5 shrink-0 cursor-pointer"
            />
            <span className="text-[11px] text-zinc-500">
              {selected.size > 0 ? `${selected.size} of ${issues.length} selected` : `${issues.length} issues`}
            </span>
          </div>
        )}

        {/* Issue list */}
        <div className="flex-1 overflow-y-auto">
          {initialLoad && (
            <div className="flex items-center justify-center gap-2 py-10 text-zinc-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading sprint issues…</span>
            </div>
          )}
          {!initialLoad && !loading && issues.length === 0 && (
            <p className="text-sm text-zinc-600 px-4 py-6 text-center">No issues found</p>
          )}
          {!initialLoad && issues.map((issue) => (
            <label
              key={issue.key}
              className={cn(
                'flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-white/5',
                selected.has(issue.key) && 'bg-white/[0.04]'
              )}
            >
              <input
                type="checkbox"
                checked={selected.has(issue.key)}
                onChange={() => toggle(issue.key)}
                className="accent-[var(--accent)] w-3.5 h-3.5 shrink-0 mt-0.5 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-semibold shrink-0" style={{ color: 'var(--accent)' }}>
                    {issue.key}
                  </span>
                  {issue.status && (
                    <span className="text-[10px] text-zinc-600 shrink-0">{issue.status}</span>
                  )}
                  {issue.priority && (
                    <span
                      className="text-[10px] shrink-0"
                      style={{ color: PRIORITY_COLOR[issue.priority] ?? '#6b7280' }}
                    >
                      {issue.priority}
                    </span>
                  )}
                  {issue.storyPoints != null && (
                    <span className="text-[10px] text-zinc-600 shrink-0">{issue.storyPoints} pts</span>
                  )}
                </div>
                <p className="text-sm text-zinc-300 leading-snug mt-0.5 truncate">{issue.summary}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs text-zinc-600">
            {selected.size === 0 ? 'Select issues to add to queue' : `${selected.size} issue${selected.size > 1 ? 's' : ''} selected`}
          </span>
          <Button
            onClick={handleAdd}
            disabled={selected.size === 0 || adding || done}
            className="h-8 px-3 text-xs text-white font-semibold gap-1.5 min-w-[110px] justify-center"
            style={{ backgroundColor: done ? '#16a34a' : 'var(--accent)' }}
          >
            {done ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Added!
              </>
            ) : adding ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Adding…
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                Add {selected.size > 0 ? selected.size : ''} to queue
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
