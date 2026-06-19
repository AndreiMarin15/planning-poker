'use client'

import React from 'react'
import type { Room, Participant } from '@/lib/types'
import { CARD_VALUES } from '@/lib/types'
import { PokerCard } from '@/components/poker-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TableCard, type CardSize } from '@/components/room/table-card'
import { TimerPanel } from '@/components/room/timer-panel'
import {
  Eye, RotateCcw, ExternalLink, Link2, Search, Timer, X,
} from 'lucide-react'
import type { JiraSprintIssue } from '@/lib/use-jira'

function calcAverage(votes: string[]): string {
  const nums = votes.map(Number).filter((n) => !isNaN(n))
  if (nums.length === 0) return '—'
  return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)
}

function calcConsensus(votes: string[]): string | null {
  if (votes.length === 0) return null
  return new Set(votes).size === 1 ? votes[0] : null
}

function distributeSeats(ps: Participant[]) {
  const n = ps.length
  if (n <= 1) return { top: [] as Participant[], left: [], right: [], bottom: ps }
  if (n <= 4) {
    const half = Math.ceil(n / 2)
    return { top: ps.slice(0, half), left: [], right: [], bottom: ps.slice(half) }
  }
  if (n <= 6) {
    return { top: ps.slice(0, 3), left: [], right: [], bottom: ps.slice(3) }
  }
  const maxPerSide = n >= 18 ? 4 : n >= 12 ? 3 : 2
  const sideCount = Math.min(n - 6, maxPerSide * 2)
  const tbCount = n - sideCount
  const topCount = Math.ceil(tbCount / 2)
  const top = ps.slice(0, topCount)
  const mid = ps.slice(topCount, topCount + sideCount)
  const bottom = ps.slice(topCount + sideCount)
  const lc = Math.floor(sideCount / 2)
  return { top, left: mid.slice(0, lc), right: mid.slice(lc), bottom }
}

export interface PokerTableProps {
  room: Room
  participantId: string | null
  isMobile: boolean
  lastEmoji: string | null
  onThrowOrPicker: (target: Participant, emoji: string) => void

  myVote: string | undefined
  isFacilitator: boolean
  canManage: boolean

  countdown: number | null
  timerRunning: boolean
  timerDone: boolean
  showTimerPanel: boolean
  timerMinutes: number
  timerSeconds: number
  autoReset: boolean
  onTimerMinutesChange: (v: number) => void
  onTimerSecondsChange: (v: number) => void
  onAutoResetToggle: () => void
  onTimerAction: (action: 'start' | 'stop') => void
  onCloseTimerPanel: () => void
  onToggleTimerPanel: () => void
  formatCountdown: (s: number) => string

  story: string
  setStory: (v: string) => void
  jiraTicket: string
  setJiraTicket: (v: string) => void
  jiraLink: string
  jiraFetching: boolean
  jiraIssueData: { key: string; summary: string; description: string } | null
  storyDescription: string
  setStoryDescription: (v: string) => void
  storyRef: React.RefObject<HTMLInputElement | null>
  storyFocusedRef: React.RefObject<boolean>
  onStoryBlur: () => void
  onLinkChange: (v: string) => void

  showStoryDetails: boolean
  onToggleStoryDetails: () => void

  jiraConnected: boolean
  jiraSearch: string
  setJiraSearch: (v: string) => void
  jiraSearchOpen: boolean
  setJiraSearchOpen: (fn: (v: boolean) => boolean) => void
  jiraSearchLoading: boolean
  jiraSearchResults: JiraSprintIssue[]

  onReveal: () => void
  onReset: () => void
  onVote: (v: string) => void
}

export function PokerTable({
  room,
  participantId,
  isMobile,
  lastEmoji,
  onThrowOrPicker,
  myVote,
  isFacilitator,
  canManage,
  countdown,
  timerRunning,
  timerDone,
  showTimerPanel,
  timerMinutes,
  timerSeconds,
  autoReset,
  onTimerMinutesChange,
  onTimerSecondsChange,
  onAutoResetToggle,
  onTimerAction,
  onCloseTimerPanel,
  onToggleTimerPanel,
  formatCountdown,
  story,
  setStory,
  jiraTicket,
  setJiraTicket,
  jiraLink,
  jiraFetching,
  jiraIssueData,
  storyDescription,
  setStoryDescription,
  storyRef,
  storyFocusedRef,
  onStoryBlur,
  onLinkChange,
  showStoryDetails,
  onToggleStoryDetails,
  jiraConnected,
  jiraSearch,
  setJiraSearch,
  jiraSearchOpen,
  setJiraSearchOpen,
  jiraSearchLoading,
  jiraSearchResults,
  onReveal,
  onReset,
  onVote,
}: PokerTableProps) {
  const votedCount = Object.keys(room.votes).length
  const totalCount = room.participants.length
  const revealedVotes = room.phase === 'revealed'
    ? room.participants.map((p) => room.votes[p.id]).filter(Boolean)
    : []
  const consensus = calcConsensus(revealedVotes)

  const devVotes = room.phase === 'revealed'
    ? room.participants.filter(p => p.team === 'dev').map(p => room.votes[p.id]).filter(Boolean)
    : []
  const qaVotes = room.phase === 'revealed'
    ? room.participants.filter(p => p.team === 'qa').map(p => room.votes[p.id]).filter(Boolean)
    : []
  const devAvg = devVotes.length > 0 ? calcAverage(devVotes) : null
  const qaAvg  = qaVotes.length  > 0 ? calcAverage(qaVotes)  : null
  const combinedAvg = devAvg && qaAvg
    ? (parseFloat(devAvg) + parseFloat(qaAvg)).toFixed(1)
    : null
  const hasTeamBreakdown = devAvg !== null || qaAvg !== null
  const seats = distributeSeats(room.participants)

  const n = room.participants.length
  const seatGap    = n >= 14 ? 5 : n >= 9 ? 6 : n >= 7 ? 7 : 8
  const seatGapMob = n >= 14 ? 3 : 4
  const tableGap    = n >= 9 ? 4 : n >= 7 ? 5 : 7
  const tableGapMob = 3
  const rowPad = n >= 12 ? 'pb-3 sm:pb-6' : 'pb-2 sm:pb-5'
  const rowPadB = n >= 12 ? 'pt-3 sm:pt-6' : 'pt-2 sm:pt-5'
  const ovalWidth    = n <= 4 ? '38%' : n <= 6 ? '50%' : n <= 8 ? '62%' : n <= 10 ? '72%' : n <= 14 ? '82%' : n <= 18 ? '90%' : '96%'
  const ovalMaxH     = n <= 4 ? '28vh' : n <= 6 ? '34vh' : n <= 8 ? '38vh' : n <= 10 ? '42vh' : n <= 14 ? '46vh' : '50vh'

  const participantCount = room.participants.length
  const cardSize: CardSize = participantCount >= 14 ? 'xs' : participantCount >= 10 ? 'compact' : 'normal'

  const renderSeat = (p: Participant) => (
    <TableCard
      key={p.id} pid={p.id} name={p.name} avatarStyle={p.avatarStyle}
      voted={!!room.votes[p.id]} revealed={room.phase === 'revealed'}
      value={room.votes[p.id]} isMe={p.id === participantId}
      isFacilitator={p.role === 'facilitator'}
      canThrow={!!participantId && p.id !== participantId}
      lastEmoji={lastEmoji}
      onThrow={(emoji) => onThrowOrPicker(p, emoji)}
      cardSize={cardSize}
    />
  )

  return (
    <>
      {/* Zone 1 — table area */}
      {isMobile ? (
        /* ── Portrait layout (mobile) ──────────────────────────────────────────
           Oval is vertical (1:2.4). seats.top/bottom become the long vertical
           sides; seats.left/right become the short top/bottom rows.          */
        <div className={`flex-1 min-h-0 w-full flex flex-col items-center px-8 py-3 gap-${tableGapMob}`}>

          {/* Short top row (was left column) */}
          {seats.left.length > 0 && (
            <div className={`shrink-0 flex flex-row items-end justify-around gap-${seatGapMob} pr-2`}>
              {seats.left.map(renderSeat)}
            </div>
          )}

          {/* Middle: long left col (was top) + portrait oval + long right col (was bottom)
              flex-1 min-h-0 so the oval fills remaining space without overflowing */}
          <div className={`flex-1 min-h-0 flex flex-row items-center gap-${tableGapMob} w-full px-2`}>
            {seats.top.length > 0 && (
              <div
                className={`shrink-0 flex flex-col justify-around gap-${seatGapMob} h-full`}
              >
                {seats.top.map(renderSeat)}
              </div>
            )}

            {/* Portrait oval — height driven by flex parent, width from aspect-ratio */}
            <div className="flex-1 h-full flex items-center justify-center">
              <div
                className="relative flex items-center justify-center"
                style={{
                  height: '100%',
                  aspectRatio: '1 / 2.4',
                  maxWidth: '100%',
                  borderRadius: '9999px',
                  background: 'var(--surface)',
                  border: '6px solid #3b1f0a',
                  boxShadow: '0 0 0 1px #1a0d05, 0 0 0 3px #5c3214, 0 12px 40px rgba(0,0,0,0.6)',
                }}
              >
                <div className="relative z-10 flex items-center justify-center p-2">
                  {room.phase === 'voting' ? (
                    <div className="text-center space-y-1">
                      <p className="text-zinc-300 text-xs font-medium">Voting</p>
                      {votedCount > 0 && <p className="text-zinc-400/60 text-[10px] tabular-nums">{votedCount}/{totalCount}</p>}
                    </div>
                  ) : (
                    <div className="text-center space-y-1.5">
                      {consensus ? (
                        <><p className="text-emerald-400/80 text-[9px] font-semibold uppercase tracking-widest">Consensus</p>
                          <p className="text-white font-black text-2xl tabular-nums">{consensus}</p></>
                      ) : (
                        <><p className="text-zinc-400/60 text-[9px] font-semibold uppercase tracking-widest">Average</p>
                          <p className="text-white font-black text-2xl tabular-nums">{calcAverage(revealedVotes)}</p>
                          <p className="text-zinc-500 text-[10px]">No consensus</p></>
                      )}
                      {hasTeamBreakdown && (
                        <div className="mt-2 flex flex-col items-center gap-1 border-t border-white/10 pt-2">
                          {devAvg && <p className="text-[10px] tabular-nums"><span className="text-violet-400 font-semibold">Dev</span> <span className="text-white">{devAvg}</span></p>}
                          {qaAvg  && <p className="text-[10px] tabular-nums"><span className="text-pink-400 font-semibold">QA</span> <span className="text-white">{qaAvg}</span></p>}
                          {combinedAvg && <p className="text-[10px] tabular-nums"><span className="text-zinc-400 font-semibold">Sum</span> <span className="text-white">{combinedAvg}</span></p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {seats.bottom.length > 0 && (
              <div
                className={`shrink-0 flex flex-col justify-around gap-${seatGapMob} h-full`}
              >
                {seats.bottom.map(renderSeat)}
              </div>
            )}
          </div>

          {/* Short bottom row (was right column) */}
          {seats.right.length > 0 && (
            <div className={`shrink-0 flex flex-row items-start justify-around gap-${seatGapMob} pl-2`}>
              {seats.right.map(renderSeat)}
            </div>
          )}
        </div>
      ) : (
        /* ── Landscape layout (desktop) ──────────────────────────────────────── */
        <div className={`flex-1 min-h-0 w-full flex items-center px-10 sm:px-20 py-6 sm:py-10 gap-${tableGap}`}>

        {/* Left column — short side, height capped to oval so corners follow the curvature */}
        {seats.left.length > 0 && (
          <div
            className={`shrink-0 flex flex-col justify-around gap-${seatGap}`}
            style={{ height: ovalMaxH }}
          >
            {seats.left.map(renderSeat)}
          </div>
        )}

        {/* Center column: top → oval → bottom, all share the same width */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {seats.top.length > 0 && (
            <div className={`shrink-0 flex items-end justify-around gap-${seatGap} ${rowPad}`}>
              {seats.top.map(renderSeat)}
            </div>
          )}

          {/* Oval */}
          <div className="flex items-center justify-center">
            <div
              className="relative flex items-center justify-center"
              style={{
                width: ovalWidth,
                aspectRatio: '2.4 / 1',
                maxHeight: `min(100%, ${ovalMaxH})`,
                minHeight: 90,
                borderRadius: '9999px',
                background: 'var(--surface)',
                border: '6px solid #3b1f0a',
                boxShadow: '0 0 0 1px #1a0d05, 0 0 0 3px #5c3214, 0 12px 40px rgba(0,0,0,0.6)',
              }}
            >
              <div className="relative z-10 flex items-center justify-center p-3">
                {room.phase === 'voting' ? (
                  <div className="text-center space-y-1">
                    <p className="text-zinc-300 text-xs sm:text-sm font-medium whitespace-nowrap">Voting in progress</p>
                    {votedCount > 0 && <p className="text-zinc-400/60 text-[10px] sm:text-xs tabular-nums">{votedCount}/{totalCount} voted</p>}
                  </div>
                ) : (
                  <div className="text-center space-y-0.5 sm:space-y-1">
                    {consensus ? (
                      <><p className="text-emerald-400/80 text-[9px] sm:text-[11px] font-semibold uppercase tracking-widest">Consensus</p>
                        <p className="text-white font-black text-2xl sm:text-5xl tabular-nums">{consensus}</p></>
                    ) : (
                      <><p className="text-zinc-400/60 text-[9px] sm:text-[11px] font-semibold uppercase tracking-widest">Average</p>
                        <p className="text-white font-black text-2xl sm:text-5xl tabular-nums">{calcAverage(revealedVotes)}</p>
                        <p className="text-zinc-500 text-[10px] sm:text-xs">No consensus</p></>
                    )}
                    {hasTeamBreakdown && (
                      <div className="mt-2 sm:mt-3 flex items-center justify-center gap-3 sm:gap-5 border-t border-white/10 pt-2 sm:pt-3">
                        {devAvg && (
                          <p className="text-[10px] sm:text-xs tabular-nums">
                            <span className="text-violet-400 font-semibold">Dev</span>{' '}
                            <span className="text-white font-bold">{devAvg}</span>
                          </p>
                        )}
                        {qaAvg && (
                          <p className="text-[10px] sm:text-xs tabular-nums">
                            <span className="text-pink-400 font-semibold">QA</span>{' '}
                            <span className="text-white font-bold">{qaAvg}</span>
                          </p>
                        )}
                        {combinedAvg && (
                          <p className="text-[10px] sm:text-xs tabular-nums">
                            <span className="text-zinc-400 font-semibold">Sum</span>{' '}
                            <span className="text-white font-bold">{combinedAvg}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {seats.bottom.length > 0 && (
            <div className={`shrink-0 flex items-start justify-around gap-${seatGap} ${rowPadB}`}>
              {seats.bottom.map(renderSeat)}
            </div>
          )}
        </div>

        {/* Right column — short side, height capped to oval so corners follow the curvature */}
        {seats.right.length > 0 && (
          <div
            className={`shrink-0 flex flex-col justify-around gap-${seatGap}`}
            style={{ height: ovalMaxH }}
          >
            {seats.right.map(renderSeat)}
          </div>
        )}
      </div>
      )} {/* end landscape ternary */}

      {/* Zone 2 — controls, pinned at bottom */}
      <div className="shrink-0 w-full relative" style={{ borderTop: '1px solid var(--border)' }}>

        {/* Timer floating panel — absolute above controls, does not affect table layout */}
        {canManage && showTimerPanel && (
          <TimerPanel
            timerMinutes={timerMinutes}
            timerSeconds={timerSeconds}
            timerRunning={timerRunning}
            autoReset={autoReset}
            onMinutesChange={onTimerMinutesChange}
            onSecondsChange={onTimerSecondsChange}
            onAutoResetToggle={onAutoResetToggle}
            onAction={onTimerAction}
            onClose={onCloseTimerPanel}
          />
        )}

        {/* Countdown strip — sits at top of controls bar, visible to all */}
        {(timerRunning || timerDone) && countdown !== null && (
          <div className={`w-full flex items-center justify-center gap-2 py-1 text-xs font-mono font-bold ${timerDone ? 'text-red-400 bg-red-950/40' : 'text-amber-400 bg-amber-950/30'}`}>
            <Timer className="w-3 h-3" />
            {timerDone ? "Time's up!" : formatCountdown(countdown)}
          </div>
        )}

        {/* Story row */}
        <div className="flex flex-col gap-3 px-4 pt-5 pb-3 sm:px-3 sm:pt-3 sm:pb-2 sm:gap-2.5">
          {/* Top sub-row: Jira ticket + story title (full width on mobile) */}
          <div className="flex gap-2">
            <div className="relative">
              <Input
                placeholder="JIRA-123"
                value={jiraTicket}
                onChange={(e) => setJiraTicket(e.target.value.toUpperCase())}
                onFocus={() => { storyFocusedRef.current = true }}
                onBlur={onStoryBlur}
                onKeyDown={(e) => e.key === 'Enter' && storyRef.current?.focus()}
                className="w-20 sm:w-[7.5rem] h-9 text-xs font-mono uppercase tracking-wider text-blue-300 placeholder:text-zinc-700 focus-visible:ring-violet-500/50"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: jiraIssueData ? 'var(--accent)' : 'rgba(255,255,255,0.08)' }}
              />
              {jiraFetching && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
              )}
              {jiraIssueData && !jiraFetching && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </div>
            <textarea
              ref={storyRef as unknown as React.RefObject<HTMLTextAreaElement>}
              placeholder="What are you estimating?"
              value={story}
              onChange={(e) => setStory(e.target.value)}
              onFocus={() => { storyFocusedRef.current = true }}
              onBlur={onStoryBlur}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() } }}
              rows={2}
              className="flex-1 resize-none text-sm text-zinc-200 placeholder:text-zinc-700 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500/50 leading-snug sm:hidden"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
            <Input
              ref={storyRef}
              placeholder="What are you estimating?"
              value={story}
              onChange={(e) => setStory(e.target.value)}
              onFocus={() => { storyFocusedRef.current = true }}
              onBlur={onStoryBlur}
              onKeyDown={(e) => e.key === 'Enter' && storyRef.current?.blur()}
              className="hidden sm:flex flex-1 h-9 text-sm text-zinc-200 placeholder:text-zinc-700 focus-visible:ring-violet-500/50"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' }}
            />
          </div>
          {/* Bottom sub-row: action buttons */}
          <div className="flex gap-2 items-center">
          {/* Jira search button */}
          {jiraConnected && (
            <div className="relative">
              <button
                onClick={() => { setJiraSearchOpen((v) => !v); setJiraSearch('') }}
                className="h-9 w-9 flex items-center justify-center rounded-md border transition-colors shrink-0"
                style={jiraSearchOpen
                  ? { color: 'var(--accent)', borderColor: 'var(--accent)', backgroundColor: 'var(--accent-muted)' }
                  : { color: '#52525b', borderColor: 'rgba(63,63,70,0.5)' }}
                title="Search Jira issues"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              {jiraSearchOpen && (
                <>
                  {/* Mobile: centered overlay */}
                  <div
                    className="sm:hidden fixed inset-0 z-50 flex items-center justify-center px-4"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                    onClick={() => { setJiraSearchOpen(() => false); setJiraSearch('') }}
                  >
                    <div
                      className="w-full max-w-sm rounded-xl shadow-2xl overflow-hidden"
                      style={{ backgroundColor: 'var(--surface2)', border: '1px solid var(--border)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2 px-3 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                        <Search className="w-4 h-4 text-zinc-500 shrink-0" />
                        <input
                          autoFocus
                          placeholder="Search issues…"
                          value={jiraSearch}
                          onChange={(e) => setJiraSearch(e.target.value)}
                          className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-500 outline-none"
                        />
                        <button onClick={() => { setJiraSearchOpen(() => false); setJiraSearch('') }} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="max-h-72 overflow-y-auto">
                        {jiraSearchLoading && <p className="text-xs text-zinc-600 px-4 py-3">Searching…</p>}
                        {!jiraSearchLoading && jiraSearch && jiraSearchResults.length === 0 && <p className="text-xs text-zinc-600 px-4 py-3">No results</p>}
                        {!jiraSearchLoading && !jiraSearch && <p className="text-xs text-zinc-600 px-4 py-3">Type to search your Jira issues</p>}
                        {jiraSearchResults.map((issue) => (
                          <button key={issue.key} className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-t border-white/[0.03]"
                            onMouseDown={() => { setJiraTicket(issue.key); if (!story.trim()) setStory(issue.summary); setJiraSearchOpen(() => false); setJiraSearch('') }}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono shrink-0" style={{ color: 'var(--accent)' }}>{issue.key}</span>
                              {issue.status && <span className="text-[10px] text-zinc-600 shrink-0">{issue.status}</span>}
                            </div>
                            <p className="text-xs text-zinc-300 truncate mt-0.5">{issue.summary}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Desktop: absolute dropdown */}
                  <div
                    className="hidden sm:block absolute top-12 left-0 z-50 rounded-lg shadow-xl overflow-hidden"
                    style={{ width: 320, backgroundColor: 'var(--surface2)', border: '1px solid var(--border)' }}
                  >
                    <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
                      <input
                        autoFocus
                        placeholder="Search issues…"
                        value={jiraSearch}
                        onChange={(e) => setJiraSearch(e.target.value)}
                        className="w-full bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none px-1"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {jiraSearchLoading && <p className="text-xs text-zinc-600 px-3 py-2">Searching…</p>}
                      {!jiraSearchLoading && jiraSearch && jiraSearchResults.length === 0 && <p className="text-xs text-zinc-600 px-3 py-2">No results</p>}
                      {!jiraSearchLoading && !jiraSearch && <p className="text-xs text-zinc-600 px-3 py-2">Type to search your Jira issues</p>}
                      {jiraSearchResults.map((issue) => (
                        <button key={issue.key} className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors"
                          onMouseDown={() => { setJiraTicket(issue.key); if (!story.trim()) setStory(issue.summary); setJiraSearchOpen(() => false); setJiraSearch('') }}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono shrink-0" style={{ color: 'var(--accent)' }}>{issue.key}</span>
                            {issue.status && <span className="text-[10px] text-zinc-600 shrink-0">{issue.status}</span>}
                          </div>
                          <p className="text-xs text-zinc-300 truncate mt-0.5">{issue.summary}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {/* Toggle details */}
          <button
            onClick={onToggleStoryDetails}
            title="Jira URL & description"
            className="h-9 w-9 flex items-center justify-center rounded-md border transition-colors shrink-0"
            style={showStoryDetails
              ? { color: 'var(--accent)', borderColor: 'var(--accent)', backgroundColor: 'var(--accent-muted)' }
              : { color: '#52525b', borderColor: 'rgba(63,63,70,0.5)' }}
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
          {/* Timer button — facilitator only */}
          {canManage && (
            <button
              onClick={onToggleTimerPanel}
              title="Timer"
              className="h-9 w-9 flex items-center justify-center rounded-md border transition-colors shrink-0 relative"
              style={showTimerPanel
                ? { color: 'var(--accent)', borderColor: 'var(--accent)', backgroundColor: 'var(--accent-muted)' }
                : timerRunning
                  ? { color: '#f59e0b', borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)' }
                  : { color: '#52525b', borderColor: 'rgba(63,63,70,0.5)' }}
            >
              <Timer className="w-3.5 h-3.5" />
              {timerRunning && countdown !== null && (
                <span className="absolute -top-2 -right-2 text-[9px] font-mono font-bold text-amber-400 bg-zinc-900 px-0.5 rounded leading-none">
                  {formatCountdown(countdown)}
                </span>
              )}
            </button>
          )}
          {/* Reveal / reset */}
          <div className="flex-1" />
          {room.phase === 'voting' ? (
            <Button onClick={onReveal} disabled={votedCount === 0}
              className="h-9 px-4 text-white text-sm font-semibold shrink-0 gap-2"
              style={{ backgroundColor: 'var(--accent)' }}>
              <Eye className="w-3.5 h-3.5" />
              Reveal
              {votedCount > 0 && <span className="font-mono text-xs ml-0.5 opacity-75">{votedCount}/{totalCount}</span>}
            </Button>
          ) : (
            <Button onClick={onReset} variant="ghost"
              className="h-9 px-4 text-zinc-400 hover:text-zinc-100 text-sm shrink-0 gap-2">
              <RotateCcw className="w-3.5 h-3.5" />
              {room.topics && room.topics.length > 0 ? 'Next' : 'New Round'}
            </Button>
          )}
          </div>
        </div>

        {/* Collapsible: Jira URL + description */}
        {showStoryDetails && (
          <div className="px-3 pb-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Jira URL — auto-fills ticket number on paste"
                value={jiraLink}
                onChange={(e) => onLinkChange(e.target.value)}
                onFocus={() => { storyFocusedRef.current = true }}
                onBlur={onStoryBlur}
                className="flex-1 h-8 text-xs text-zinc-400 placeholder:text-zinc-700 focus-visible:ring-violet-500/50"
                style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}
              />
              {jiraLink && (
                <a href={jiraLink} target="_blank" rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-400 transition-colors shrink-0">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            {(storyDescription || canManage) && (
              <textarea
                placeholder="Description (optional)"
                value={storyDescription}
                onChange={(e) => setStoryDescription(e.target.value)}
                onFocus={() => { storyFocusedRef.current = true }}
                onBlur={onStoryBlur}
                readOnly={!canManage}
                rows={2}
                className="w-full resize-none text-xs text-zinc-400 placeholder:text-zinc-700 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500/50 leading-relaxed overflow-y-auto"
                style={{ maxHeight: '4.5rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              />
            )}
          </div>
        )}

        {/* Voting cards */}
        {room.phase === 'voting' && participantId && !isFacilitator && (
          <div className="flex justify-center gap-0.5 sm:gap-2.5 px-2 pb-4 sm:px-3 sm:pb-3">
            {CARD_VALUES.map((v) => (
              <PokerCard key={v} value={v} selected={myVote === v} onClick={() => onVote(v)} />
            ))}
          </div>
        )}

        {/* Revealed distribution */}
        {room.phase === 'revealed' && revealedVotes.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 px-3 pb-3">
            {CARD_VALUES.filter((v) => revealedVotes.includes(v)).map((v) => {
              const count = revealedVotes.filter((rv) => rv === v).length
              return (
                <div key={v} className="flex flex-col items-center gap-1">
                  <PokerCard value={v} revealed />
                  <span className="text-[11px] text-zinc-600 font-mono tabular-nums">×{count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
