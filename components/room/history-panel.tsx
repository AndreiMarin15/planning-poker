'use client'

import { useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'
import type { HistoryEntry } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useRoomStore } from '@/lib/room-store'
import { JiraBadge, JiraText, formatDuration } from '@/components/room/jira-components'

function HistoryEntryRow({ entry }: { entry: HistoryEntry }) {
  const [expanded, setExpanded] = useState(false)
  const hasTeamBreakdown = !!(entry.devAverage || entry.qaAverage)
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }} className="last:border-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        {entry.jiraTicket && <span className="mt-0.5 shrink-0"><JiraBadge ticket={entry.jiraTicket} link={entry.jiraLink} /></span>}
        <span className={cn('text-sm text-zinc-400 flex-1 min-w-0 leading-snug', expanded ? 'break-words' : 'line-clamp-2')}>{entry.story || 'Untitled'}</span>
        <div className="flex flex-col items-end gap-0.5 shrink-0 pt-0.5">
          {entry.consensus ? (
            <span className="text-emerald-400 text-sm font-bold tabular-nums">{entry.consensus}</span>
          ) : (
            <span className="text-zinc-500 text-xs tabular-nums">avg {entry.average}</span>
          )}
          <div className="flex items-center gap-1.5">
            {entry.duration !== undefined && (
              <span className="text-zinc-700 text-[10px] tabular-nums">{formatDuration(entry.duration)}</span>
            )}
            <ChevronDown className={cn('w-3 h-3 text-zinc-700 transition-transform', expanded && 'rotate-180')} />
          </div>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-2.5">
          {entry.description && <JiraText text={entry.description} />}
          {hasTeamBreakdown && (
            <div className="flex gap-3 flex-wrap">
              {entry.devAverage && (
                <span className="text-[11px] text-zinc-400 px-2 py-1 rounded-md" style={{ backgroundColor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  Dev avg <span className="text-blue-300 font-semibold ml-1 tabular-nums">{entry.devAverage}</span>
                </span>
              )}
              {entry.qaAverage && (
                <span className="text-[11px] text-zinc-400 px-2 py-1 rounded-md" style={{ backgroundColor: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)' }}>
                  QA avg <span className="text-purple-300 font-semibold ml-1 tabular-nums">{entry.qaAverage}</span>
                </span>
              )}
              {entry.devAverage && entry.qaAverage && (
                <span className="text-[11px] text-zinc-400 px-2 py-1 rounded-md" style={{ backgroundColor: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.2)' }}>
                  Combined <span className="text-emerald-300 font-semibold ml-1 tabular-nums">{(parseFloat(entry.devAverage) + parseFloat(entry.qaAverage)).toFixed(1)}</span>
                </span>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(entry.votes).map(([pid, vote]) => {
              const team = entry.participantTeams?.[pid]
              return (
                <span key={pid} className="text-[11px] text-zinc-500 px-2 py-1 rounded-md flex items-center gap-1"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  {team && <span className={cn('text-[9px] font-bold px-1 rounded uppercase tracking-wide', team === 'dev' ? 'text-blue-400' : 'text-purple-400')}>{team}</span>}
                  {entry.participantNames[pid] ?? 'Unknown'}
                  <span className="text-zinc-200 font-semibold ml-0.5 tabular-nums">{vote}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function SidebarHistoryPanel({ handleExportHistory }: { handleExportHistory: () => void }) {
  const room = useRoomStore((s) => s.room)
  const historyOpen = useRoomStore((s) => s.historyOpen)
  const toggleHistory = useRoomStore((s) => s.toggleHistory)

  if (!room || room.history.length === 0) {
    return <div className="px-4 py-4 text-[12px] text-zinc-700">No rounds completed yet.</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button
          onClick={toggleHistory}
          className="flex items-center gap-2 text-[11px] font-semibold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest transition-colors"
        >
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', historyOpen && 'rotate-180')} />
          {room.history.length} round{room.history.length > 1 ? 's' : ''}
        </button>
        <button
          onClick={handleExportHistory}
          className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Download className="w-3 h-3" />
          Export
        </button>
      </div>
      {historyOpen && (
        <div>
          {[...room.history].reverse().map((entry) => (
            <HistoryEntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}
