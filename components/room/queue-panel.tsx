'use client'

import { useState } from 'react'
import { ChevronDown, Link2, Plus, Play, Upload, X } from 'lucide-react'
import type { Room, Topic } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { JiraBadge, JiraText } from '@/components/room/jira-components'

function TopicRow({ topic: t, isModerator, isCurrent, onStart, onRemove }: {
  topic: Topic
  isModerator: boolean
  isCurrent: boolean
  onStart: (id: string) => void
  onRemove: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        ...(isCurrent ? { borderLeft: '2px solid var(--accent)', backgroundColor: 'rgba(255,255,255,0.02)' } : {}),
      }}
      className="last:border-0"
    >
      <button
        onClick={() => t.description && setExpanded((v) => !v)}
        className={cn(
          'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors',
          !t.description && 'cursor-default',
        )}
      >
        {isCurrent && (
          <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
        )}
        {t.jiraTicket && <span className="mt-0.5 shrink-0"><JiraBadge ticket={t.jiraTicket} link={t.jiraLink} /></span>}
        <span className={cn('text-sm flex-1 min-w-0 break-words leading-snug', isCurrent ? 'text-zinc-200' : 'text-zinc-400')}>{t.title}</span>
        <div className="flex items-center gap-2.5 shrink-0 self-start pt-0.5">
          {isModerator && !isCurrent && (
            <>
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); onStart(t.id) }}
                className="flex items-center gap-1 text-[11px] font-semibold transition-colors opacity-90 hover:opacity-100"
                style={{ color: 'var(--accent)' }}
              >
                <Play className="w-3 h-3" />
                Vote
              </span>
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); onRemove(t.id) }}
                className="text-zinc-700 hover:text-zinc-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            </>
          )}
          {isModerator && isCurrent && (
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
              Voting
            </span>
          )}
          {t.description && (
            <ChevronDown className={cn('w-3 h-3 text-zinc-700 transition-transform', expanded && 'rotate-180')} />
          )}
        </div>
      </button>
      {expanded && t.description && (
        <div className="px-4 pb-3">
          <JiraText text={t.description} />
        </div>
      )}
    </div>
  )
}

export function SidebarQueuePanel({
  room, isModerator,
  showAddTopic, setShowAddTopic,
  newTopicJira, setNewTopicJira,
  newTopicTitle, setNewTopicTitle,
  newTopicLink,
  newTopicDescription, setNewTopicDescription,
  handleAddTopic, handleTopicLinkChange, handleStartTopic, handleRemoveTopic,
  onImportClick, onJiraPickerOpen,
}: {
  room: Room | null
  isModerator: boolean
  showAddTopic: boolean
  setShowAddTopic: (v: boolean | ((p: boolean) => boolean)) => void
  newTopicJira: string; setNewTopicJira: (v: string) => void
  newTopicTitle: string; setNewTopicTitle: (v: string) => void
  newTopicLink: string
  newTopicDescription: string; setNewTopicDescription: (v: string) => void
  handleAddTopic: () => void
  handleTopicLinkChange: (v: string) => void
  handleStartTopic: (id: string) => void
  handleRemoveTopic: (id: string) => void
  onImportClick: () => void
  onJiraPickerOpen?: () => void
}) {
  return (
    <div>
      {isModerator && (
        <div className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">
            {(room?.topics.length ?? 0) > 0
              ? `${room!.topics.length} topic${room!.topics.length > 1 ? 's' : ''}`
              : 'No topics queued'}
          </span>
          <div className="flex items-center gap-2.5">
            {onJiraPickerOpen && (
              <button
                onClick={onJiraPickerOpen}
                className="flex items-center gap-1 text-[11px] transition-colors"
                style={{ color: 'var(--accent)' }}
                title="Browse and add Jira issues"
              >
                <Link2 className="w-3 h-3" />
                Jira
              </button>
            )}
            <button
              onClick={onImportClick}
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Import from CSV / Excel"
            >
              <Upload className="w-3 h-3" />
              Import
            </button>
            <button
              onClick={() => setShowAddTopic((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>
        </div>
      )}

      {showAddTopic && isModerator && (
        <div className="space-y-1.5 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex gap-2">
            <Input
              placeholder="JIRA-123"
              value={newTopicJira}
              onChange={(e) => setNewTopicJira(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && newTopicTitle && handleAddTopic()}
              className="w-20 h-8 text-xs font-mono uppercase text-blue-300 placeholder:text-zinc-600 focus-visible:ring-violet-500"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' }}
              autoFocus
            />
            <Input
              placeholder="Story title"
              value={newTopicTitle}
              onChange={(e) => setNewTopicTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()}
              className="flex-1 h-8 text-xs text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' }}
            />
            <Button onClick={handleAddTopic} disabled={!newTopicTitle.trim()} size="sm"
              className="h-8 px-2 text-xs shrink-0 border"
              style={{ color: 'var(--accent)', borderColor: 'var(--accent)', backgroundColor: 'var(--accent-muted)' }}>
              Add
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Link2 className="w-3 h-3 text-zinc-700 shrink-0" />
            <Input
              placeholder="Jira URL (optional)"
              value={newTopicLink}
              onChange={(e) => handleTopicLinkChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()}
              className="flex-1 h-7 text-xs text-zinc-400 placeholder:text-zinc-700 focus-visible:ring-violet-500"
              style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}
            />
          </div>
          <textarea
            placeholder="Description (optional)"
            value={newTopicDescription}
            onChange={(e) => setNewTopicDescription(e.target.value)}
            rows={2}
            className="w-full resize-none text-xs text-zinc-400 placeholder:text-zinc-700 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500 leading-relaxed"
            style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          />
        </div>
      )}

      {room?.topics.length === 0 && !showAddTopic && !isModerator && (
        <div className="px-4 py-4 text-[12px] text-zinc-700">No topics queued.</div>
      )}
      {room?.topics.length === 0 && !showAddTopic && isModerator && (
        <div className="px-4 py-4 text-[12px] text-zinc-700">Queue is empty — add a topic above.</div>
      )}

      {room?.topics.map((t) => (
        <TopicRow
          key={t.id} topic={t} isModerator={isModerator}
          isCurrent={t.id === room.currentTopicId}
          onStart={handleStartTopic} onRemove={handleRemoveTopic}
        />
      ))}
    </div>
  )
}
