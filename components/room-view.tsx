'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import type { Room, Participant, HistoryEntry, EmojiThrow, Topic } from '@/lib/types'
import { CARD_VALUES, THROW_EMOJIS } from '@/lib/types'
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react'
import { PokerCard } from './poker-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Copy, Check, Eye, RotateCcw, LogOut, ChevronDown, Plus, X,
  Play, Link2, ExternalLink, Download, LayoutList, History, Table2, Upload, Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { extractJiraTicket, isJiraUrl } from '@/lib/jira'
import { parseImportFile } from '@/lib/import'
import { AvatarImg, AvatarPicker, DEFAULT_AVATAR, type AvatarStyleId } from '@/components/avatar'
import { useRoomStore } from '@/lib/room-store'
import { useTheme, THEMES, type ThemeId } from '@/lib/theme'
import { useJira } from '@/lib/use-jira'
import { JiraPicker } from '@/components/jira-picker'

// ── Cookie session helpers ────────────────────────────────────────────────────

function getSession(roomId: string): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp(`(?:^|; )pp_${roomId}_pid=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : localStorage.getItem(`pp_${roomId}_pid`)
}

function setSession(roomId: string, pid: string) {
  const exp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `pp_${roomId}_pid=${encodeURIComponent(pid)}; expires=${exp}; path=/; SameSite=Strict`
  localStorage.setItem(`pp_${roomId}_pid`, pid)
}

function clearSession(roomId: string) {
  document.cookie = `pp_${roomId}_pid=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict`
  localStorage.removeItem(`pp_${roomId}_pid`)
}

// ── helpers ───────────────────────────────────────────────────────────────────

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
  const top = ps.slice(0, 3)
  const bottom = ps.slice(n - 3)
  const mid = ps.slice(3, n - 3)
  const lc = Math.ceil(mid.length / 2)
  return { top, left: mid.slice(0, lc), right: mid.slice(lc), bottom }
}

// ── TableCard ─────────────────────────────────────────────────────────────────

const VOTED_STYLE: React.CSSProperties = {
  backgroundColor: '#2f6fd4',
  backgroundImage: [
    'repeating-linear-gradient(45deg,  rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 9px)',
    'repeating-linear-gradient(-45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 9px)',
  ].join(', '),
}

function TableCard({
  pid, name, avatarStyle, voted, revealed, value, isMe, isFacilitator, canThrow, lastEmoji, onThrow,
}: {
  pid: string; name: string; avatarStyle?: string; voted: boolean; revealed: boolean
  value?: string; isMe: boolean; isFacilitator?: boolean; canThrow: boolean; lastEmoji: string | null
  onThrow?: (emoji: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      data-pid={pid}
      className="flex flex-col items-center gap-2"
      onMouseEnter={() => { if (canThrow) setHovered(true) }}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="flex items-center gap-px px-2 py-1.5 rounded-full z-30 transition-opacity duration-150"
        style={{
          backgroundColor: 'var(--surface2)',
          border: '1px solid rgba(255,255,255,0.11)',
          opacity: hovered && canThrow ? 1 : 0,
          pointerEvents: hovered && canThrow ? 'auto' : 'none',
          visibility: canThrow ? 'visible' : 'hidden',
        }}
      >
        {THROW_EMOJIS.slice(0, 8).map((e) => (
          <button key={e} onClick={() => onThrow?.(e)}
            className="text-[1rem] leading-none px-0.5 hover:scale-125 active:scale-90 transition-transform cursor-pointer">
            {e}
          </button>
        ))}
        {lastEmoji && !THROW_EMOJIS.slice(0, 8).includes(lastEmoji) && (
          <>
            <span className="w-px h-3.5 bg-white/10 mx-1" />
            <button onClick={() => onThrow?.(lastEmoji)}
              className="text-[1rem] leading-none px-0.5 hover:scale-125 active:scale-90 transition-transform cursor-pointer">
              {lastEmoji}
            </button>
          </>
        )}
        <span className="w-px h-3.5 bg-white/10 mx-1" />
        <button onClick={() => onThrow?.('__picker__')}
          className="text-zinc-500 hover:text-zinc-200 text-[11px] font-semibold px-1 transition-colors">
          ···
        </button>
      </div>
      {isFacilitator ? (
        <div className="w-11 h-[3.75rem] rounded-xl border border-zinc-700/30 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(82,82,91,0.15)' }}>
          <span className="text-lg leading-none">👀</span>
        </div>
      ) : (
        <div
          className={cn(
            'w-11 h-[3.75rem] rounded-xl border relative overflow-hidden transition-all duration-300',
            !voted && !revealed && 'border-zinc-600/30',
            voted && !revealed && 'border-blue-400/20',
            revealed && 'border-slate-500/30',
          )}
          style={revealed ? { backgroundColor: 'var(--surface2)' } : voted ? VOTED_STYLE : { backgroundColor: 'rgba(82,82,91,0.45)' }}
        >
          {revealed && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white font-bold text-xl tabular-nums leading-none">{value ?? '—'}</span>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col items-center gap-1">
        <AvatarImg name={name} style={avatarStyle} size={28} isMe={isMe} />
        <span className="text-[12px] font-semibold leading-none" style={isMe ? { color: 'var(--accent)' } : { color: '#d4d4d8' }}>
          {name}
        </span>
      </div>
    </div>
  )
}

// ── JiraText — renders basic Jira wiki markup ────────────────────────────────

function renderInline(text: string): React.ReactNode {
  // *bold*, image refs already stripped upstream
  const parts = text.split(/(\*[^*\n]+\*)/)
  return parts.map((p, i) =>
    p.startsWith('*') && p.endsWith('*')
      ? <strong key={i} className="text-zinc-300 font-semibold">{p.slice(1, -1)}</strong>
      : p
  )
}

function JiraText({ text }: { text: string }) {
  // Strip Jira image attachments: !filename.ext|...! or !filename.ext!
  const cleaned = text.replace(/![^!\n]+!/g, '').replace(/\n{3,}/g, '\n\n').trim()
  if (!cleaned) return null

  const lines = cleaned.split('\n')
  const nodes: React.ReactNode[] = []
  let olItems: React.ReactNode[] = []
  let ulItems: React.ReactNode[] = []

  const flushOl = () => {
    if (olItems.length) {
      nodes.push(
        <ol key={`ol-${nodes.length}`} className="list-decimal list-outside ml-4 space-y-0.5">
          {olItems}
        </ol>
      )
      olItems = []
    }
  }
  const flushUl = () => {
    if (ulItems.length) {
      nodes.push(
        <ul key={`ul-${nodes.length}`} className="list-disc list-outside ml-4 space-y-0.5">
          {ulItems}
        </ul>
      )
      ulItems = []
    }
  }

  lines.forEach((raw, i) => {
    const line = raw.trimEnd()
    // Jira ordered list: # item or ## item
    if (/^#+\s/.test(line)) {
      flushUl()
      olItems.push(<li key={i} className="text-[11px] text-zinc-400 leading-relaxed">{renderInline(line.replace(/^#+\s/, ''))}</li>)
    // Jira unordered list: - item or * item (but not **bold**)
    } else if (/^-\s/.test(line) || /^\*\s/.test(line)) {
      flushOl()
      ulItems.push(<li key={i} className="text-[11px] text-zinc-400 leading-relaxed">{renderInline(line.replace(/^[-*]\s/, ''))}</li>)
    // Jira heading: h1. h2. etc.
    } else if (/^h[1-6]\.\s/.test(line)) {
      flushOl(); flushUl()
      nodes.push(<p key={i} className="text-xs font-semibold text-zinc-300 mt-1">{renderInline(line.replace(/^h[1-6]\.\s/, ''))}</p>)
    // Empty line
    } else if (!line.trim()) {
      flushOl(); flushUl()
    // Normal paragraph
    } else {
      flushOl(); flushUl()
      nodes.push(<p key={i} className="text-[11px] text-zinc-400 leading-relaxed">{renderInline(line)}</p>)
    }
  })
  flushOl(); flushUl()

  return <div className="space-y-1">{nodes}</div>
}

// ── JiraBadge ─────────────────────────────────────────────────────────────────

function JiraBadge({ ticket, link }: { ticket: string; link?: string }) {
  const cls = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold font-mono text-blue-300 bg-blue-500/15 border border-blue-500/20 shrink-0'
  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer"
        className={cn(cls, 'hover:bg-blue-500/25 hover:text-blue-200 transition-colors')}>
        {ticket}
        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
      </a>
    )
  }
  return <span className={cls}>{ticket}</span>
}

// ── HistoryEntryRow ───────────────────────────────────────────────────────────

function HistoryEntryRow({ entry }: { entry: HistoryEntry }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }} className="last:border-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        {entry.jiraTicket && <JiraBadge ticket={entry.jiraTicket} link={entry.jiraLink} />}
        <span className="text-sm text-zinc-400 flex-1 truncate min-w-0">{entry.story || 'Untitled'}</span>
        <div className="flex items-center gap-2 shrink-0">
          {entry.consensus ? (
            <span className="text-emerald-400 text-sm font-bold tabular-nums">{entry.consensus}</span>
          ) : (
            <span className="text-zinc-500 text-xs tabular-nums">avg {entry.average}</span>
          )}
          <ChevronDown className={cn('w-3 h-3 text-zinc-700 transition-transform', expanded && 'rotate-180')} />
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-2.5">
          {entry.description && <JiraText text={entry.description} />}
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(entry.votes).map(([pid, vote]) => (
              <span key={pid} className="text-[11px] text-zinc-500 px-2 py-1 rounded-md"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                {entry.participantNames[pid] ?? 'Unknown'}
                <span className="text-zinc-200 font-semibold ml-1.5 tabular-nums">{vote}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── RoomView ──────────────────────────────────────────────────────────────────

export function RoomView({ roomId }: { roomId: string }) {
  const router = useRouter()

  // ── Theme (per-user, localStorage) ──
  const { theme, themeId, setTheme } = useTheme()

  // ── Jira OAuth ──
  const jira = useJira(`/room/${roomId}`)

  // ── Zustand ──
  const room = useRoomStore((s) => s.room)
  const participantId = useRoomStore((s) => s.participantId)
  const sidebarTab = useRoomStore((s) => s.sidebarTab)
  const mobileTab = useRoomStore((s) => s.mobileTab)
  const { setRoom, setParticipantId, setSidebarTab, setMobileTab } = useRoomStore()

  // ── Local state ──
  const [showJoinDialog, setShowJoinDialog] = useState(false)
  const [joinName, setJoinName] = useState('')
  const [joinAvatar, setJoinAvatar] = useState<AvatarStyleId>(DEFAULT_AVATAR)
  const [joinRole, setJoinRole] = useState<'voter' | 'facilitator'>('voter')
  const [joining, setJoining] = useState(false)
  const [copied, setCopied] = useState(false)
  const [roomGone, setRoomGone] = useState(false)

  // Story inputs mirror room, editable by moderator
  const [story, setStory] = useState('')
  const [jiraTicket, setJiraTicket] = useState('')
  const [jiraLink, setJiraLink] = useState('')
  const [storyDescription, setStoryDescription] = useState('')
  const storyFocusedRef = useRef(false)

  // Jira auto-fetch + search state
  const [jiraFetching, setJiraFetching] = useState(false)
  const [jiraIssueData, setJiraIssueData] = useState<{ key: string; summary: string; description: string } | null>(null)
  const jiraFetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showJiraPicker, setShowJiraPicker] = useState(false)
  const [jiraSearch, setJiraSearch] = useState('')
  const [jiraSearchResults, setJiraSearchResults] = useState<import('@/lib/use-jira').JiraSprintIssue[]>([])
  const [jiraSearchOpen, setJiraSearchOpen] = useState(false)
  const [jiraSearchLoading, setJiraSearchLoading] = useState(false)
  const jiraSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Jira search debounce
  useEffect(() => {
    if (jiraSearchTimer.current) clearTimeout(jiraSearchTimer.current)
    if (!jira.status?.connected || !jiraSearch.trim()) { setJiraSearchResults([]); return }
    jiraSearchTimer.current = setTimeout(async () => {
      setJiraSearchLoading(true)
      const results = await jira.searchIssues(jiraSearch)
      setJiraSearchResults(results)
      setJiraSearchLoading(false)
    }, 400)
    return () => { if (jiraSearchTimer.current) clearTimeout(jiraSearchTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jiraSearch, jira.status?.connected])

  // Auto-fetch Jira issue when ticket key changes (debounced 600ms)
  useEffect(() => {
    if (jiraFetchTimer.current) clearTimeout(jiraFetchTimer.current)
    setJiraIssueData(null)
    if (!jira.status?.connected || !jiraTicket.match(/^[A-Z][A-Z0-9_]+-\d+$/)) return
    jiraFetchTimer.current = setTimeout(async () => {
      setJiraFetching(true)
      const issue = await jira.fetchIssue(jiraTicket)
      setJiraFetching(false)
      if (!issue) return
      setJiraIssueData({ key: issue.key, summary: issue.summary, description: issue.description })
      // Auto-fill story title if empty
      if (!story.trim() && issue.summary) setStory(issue.summary)
      if (!storyDescription.trim() && issue.description) setStoryDescription(issue.description)
    }, 600)
    return () => { if (jiraFetchTimer.current) clearTimeout(jiraFetchTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jiraTicket, jira.status?.connected])

  // Emoji throws are handled imperatively via WAAPI — no React state needed
  const [fullPickerTarget, setFullPickerTarget] = useState<Participant | null>(null)
  const [lastEmoji, setLastEmoji] = useState<string | null>(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem('pp_last_emoji') : null
  )

  // Story details toggle (jira url + description collapsed by default)
  const [showStoryDetails, setShowStoryDetails] = useState(false)

  // Add-topic form
  const [showAddTopic, setShowAddTopic] = useState(false)
  const [newTopicJira, setNewTopicJira] = useState('')
  const [newTopicLink, setNewTopicLink] = useState('')
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [newTopicDescription, setNewTopicDescription] = useState('')

  const storyRef = useRef<HTMLInputElement>(null)
  const esRef = useRef<EventSource | null>(null)
  const sidebarImportRef = useRef<HTMLInputElement>(null)

  const myVote = room && participantId ? room.votes[participantId] : undefined
  const isModerator = room && participantId ? room.moderatorId === participantId : false
  const myParticipant = room && participantId ? room.participants.find((p) => p.id === participantId) : null
  const isFacilitator = myParticipant?.role === 'facilitator'

  // ── SSE ──────────────────────────────────────────────────────────────────────

  const connectSSE = useCallback((pid: string) => {
    if (esRef.current) esRef.current.close()
    const es = new EventSource(`/api/rooms/${roomId}/events`)

    es.onmessage = (e) => {
      const data: Room = JSON.parse(e.data)
      setRoom(data)
      setRoomGone(false)
      if (!storyFocusedRef.current) {
        setStory(data.story)
        setJiraTicket(data.jiraTicket ?? '')
        setJiraLink(data.jiraLink ?? '')
        setStoryDescription(data.storyDescription ?? '')
      }
    }

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        esRef.current = null
        setTimeout(() => {
          fetch(`/api/rooms/${roomId}`)
            .then((r) => { if (r.ok) connectSSE(pid); else setRoomGone(true) })
            .catch(() => setTimeout(() => connectSSE(pid), 3000))
        }, 1000)
      }
    }

    es.addEventListener('emoji', (e) => {
      const data: EmojiThrow = JSON.parse((e as MessageEvent).data)
      if (data.toId === pid) toast(`Someone threw ${data.emoji} at you!`, { duration: 2500 })

      // querySelectorAll because tablePaneContent renders in both mobile and desktop DOM;
      // pick the visible instance (non-zero bounding rect)
      const visibleEl = (selector: string) => {
        const els = document.querySelectorAll<HTMLElement>(selector)
        for (const el of els) {
          const r = el.getBoundingClientRect()
          if (r.width > 0 && r.height > 0) return { el, r }
        }
        return null
      }

      const toMatch = visibleEl(`[data-pid="${data.toId}"]`)
      if (!toMatch) return
      const toX = toMatch.r.left + toMatch.r.width / 2
      const toY = toMatch.r.top + toMatch.r.height / 2

      const fromLeft = Math.random() < 0.5
      const fromX = fromLeft ? -40 : window.innerWidth + 40
      const fromY = window.innerHeight / 2

      const arcY = -Math.min(Math.abs(toX - fromX) * 0.15 + 40, 120)


      const el = document.createElement('div')
      el.textContent = data.emoji
      el.style.cssText = `
        position: fixed;
        left: 0; top: 0;
        font-size: 1.3rem;
        line-height: 1;
        pointer-events: none;
        user-select: none;
        z-index: 9999;
        will-change: transform, opacity;
      `
      document.body.appendChild(el)

      // spin direction matches throw direction for natural feel
      const spin = fromLeft ? 1 : -1
      const t = (p: number) => `translate(${fromX + (toX - fromX) * p}px, ${fromY + (toY - fromY) * p + arcY * Math.sin(Math.PI * p)}px) translate(-50%,-50%)`
      el.animate(
        [
          { transform: `${t(0)} scale(0.4) rotate(${spin * 0}deg)`,   opacity: 0,   offset: 0    },
          { transform: `${t(0.05)} scale(1.1) rotate(${spin * 30}deg)`, opacity: 1,   offset: 0.05 },
          { transform: `${t(0.35)} scale(1.3) rotate(${spin * 130}deg)`, opacity: 1,  offset: 0.35 },
          { transform: `${t(0.65)} scale(1.2) rotate(${spin * 230}deg)`, opacity: 1,  offset: 0.65 },
          { transform: `${t(0.88)} scale(1.5) rotate(${spin * 310}deg)`, opacity: 1,  offset: 0.88 },
          { transform: `${t(1)}    scale(0)   rotate(${spin * 360}deg)`, opacity: 0,   offset: 1    },
        ],
        { duration: 1100, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)', fill: 'forwards' }
      ).onfinish = () => el.remove()
    })

    esRef.current = es
  }, [roomId, setRoom])

  useEffect(() => {
    if (room || roomGone || showJoinDialog) return
    const t = setTimeout(() => setRoomGone(true), 12000)
    return () => clearTimeout(t)
  }, [room, roomGone, showJoinDialog])

  useEffect(() => {
    const pid = getSession(roomId)
    async function init() {
      const check = await fetch(`/api/rooms/${roomId}`).catch(() => null)
      if (!check?.ok) { setRoomGone(true); return }
      if (pid) {
        setParticipantId(pid)
        connectSSE(pid)
      } else {
        const es = new EventSource(`/api/rooms/${roomId}/events`)
        es.onmessage = (e) => {
          const r: Room = JSON.parse(e.data)
          setRoom(r); setStory(r.story); setJiraTicket(r.jiraTicket ?? '')
          setJiraLink(r.jiraLink ?? ''); setStoryDescription(r.storyDescription ?? '')
        }
        es.onerror = () => { if (es.readyState === EventSource.CLOSED) setRoomGone(true) }
        esRef.current = es
        setShowJoinDialog(true)
      }
    }
    init()
    return () => esRef.current?.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleJoin() {
    if (!joinName.trim()) return
    setJoining(true)
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: joinName.trim(), avatarStyle: joinAvatar, role: joinRole }),
      })
      if (!res.ok) { toast.error('Room not found'); router.push('/'); return }
      const { participantId: pid, room: r } = await res.json()
      setSession(roomId, pid)
      setParticipantId(pid); setRoom(r)
      setStory(r.story); setJiraTicket(r.jiraTicket ?? '')
      setJiraLink(r.jiraLink ?? ''); setStoryDescription(r.storyDescription ?? '')
      setShowJoinDialog(false); connectSSE(pid)
    } finally { setJoining(false) }
  }

  async function handleVote(value: string) {
    if (!participantId || room?.phase !== 'voting' || isFacilitator) return
    setRoom({ ...room!, votes: { ...room!.votes, [participantId]: value } })
    await fetch(`/api/rooms/${roomId}/vote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, value }),
    })
  }

  async function handleReveal() {
    const res = await fetch(`/api/rooms/${roomId}/reveal`, { method: 'POST' })
    if (!jira.status?.connected || !jiraTicket) return
    const { room: revealed } = await res.json().catch(() => ({ room: null }))
    if (!revealed) return
    const votes = Object.values(revealed.votes as Record<string, string>).filter(Boolean)
    const nums = votes.map(Number).filter((n) => !isNaN(n))
    if (nums.length === 0) return
    const allSame = nums.every((n) => n === nums[0])
    if (allSame) {
      const ok = await jira.writeEstimate(jiraTicket, nums[0])
      if (ok) toast(`Story points (${nums[0]}) written to ${jiraTicket}`, { duration: 3000 })
    }
  }

  async function handleReset() {
    const res = await fetch(`/api/rooms/${roomId}/reset`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    const { room: r } = await res.json()
    setStory(r.story); setJiraTicket(r.jiraTicket ?? '')
    setJiraLink(r.jiraLink ?? ''); setStoryDescription(r.storyDescription ?? '')
  }

  async function handleStoryBlur() {
    storyFocusedRef.current = false
    if (!room) return
    if (
      story !== room.story ||
      jiraTicket !== (room.jiraTicket ?? '') ||
      jiraLink !== (room.jiraLink ?? '') ||
      storyDescription !== (room.storyDescription ?? '')
    ) {
      await fetch(`/api/rooms/${roomId}/story`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story, jiraTicket, jiraLink, description: storyDescription }),
      })
    }
  }

  function handleLinkChange(value: string) {
    setJiraLink(value)
    if (isJiraUrl(value)) {
      const ticket = extractJiraTicket(value)
      if (ticket && !jiraTicket) setJiraTicket(ticket)
    }
  }

  async function handleStartTopic(topicId: string) {
    const res = await fetch(`/api/rooms/${roomId}/topics/start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId }),
    })
    const { room: r } = await res.json()
    setStory(r.story); setJiraTicket(r.jiraTicket ?? '')
    setJiraLink(r.jiraLink ?? ''); setStoryDescription(r.storyDescription ?? '')
    // Switch to table view on mobile after starting a topic
    setMobileTab('table')
  }

  async function handleRemoveTopic(topicId: string) {
    await fetch(`/api/rooms/${roomId}/topics`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId }),
    })
  }

  function handleTopicLinkChange(value: string) {
    setNewTopicLink(value)
    if (isJiraUrl(value)) {
      const ticket = extractJiraTicket(value)
      if (ticket && !newTopicJira) setNewTopicJira(ticket)
    }
  }

  async function handleAddTopic() {
    if (!newTopicTitle.trim()) return
    await fetch(`/api/rooms/${roomId}/topics`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTopicTitle.trim(), jiraTicket: newTopicJira.trim(),
        jiraLink: newTopicLink.trim(), description: newTopicDescription.trim(),
      }),
    })
    setNewTopicJira(''); setNewTopicLink(''); setNewTopicTitle('')
    setNewTopicDescription(''); setShowAddTopic(false)
  }

  async function handleSidebarImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const imported = await parseImportFile(file)
      if (imported.length === 0) return
      for (const t of imported) {
        await fetch(`/api/rooms/${roomId}/topics`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: t.title, jiraTicket: t.jiraTicket, jiraLink: t.jiraLink, description: t.description }),
        })
      }
    } catch {
      // silently ignore parse errors
    }
  }

  function handleLeave() {
    clearSession(roomId)
    if (participantId) {
      fetch(`/api/rooms/${roomId}/leave`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
      }).catch(() => {})
    }
    router.push('/')
  }

  async function handleExportHistory() {
    if (!room || room.history.length === 0) return
    const { utils, writeFile } = await import('xlsx')
    const allNames = Array.from(
      new Set(room.history.flatMap((e) => Object.values(e.participantNames)))
    ).sort()
    const rows = room.history.map((e) => {
      const nameToVote = Object.fromEntries(
        Object.entries(e.votes).map(([pid, v]) => [e.participantNames[pid] ?? pid, v])
      )
      return {
        'Ticket': e.jiraTicket ?? '',
        'Summary': e.story,
        'Description': e.description ?? '',
        'Consensus': e.consensus ?? '',
        'Average': e.consensus ? '' : e.average,
        ...Object.fromEntries(allNames.map((n) => [n, nameToVote[n] ?? ''])),
      }
    })
    const ws = utils.json_to_sheet(rows)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Results')
    writeFile(wb, `${room.name.replace(/[^a-z0-9]/gi, '_')}_results.xlsx`)
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleThrow(target: Participant, emoji: string) {
    if (!participantId) return
    setLastEmoji(emoji)
    localStorage.setItem('pp_last_emoji', emoji)
    await fetch(`/api/rooms/${roomId}/emoji`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromId: participantId, fromName: '', toId: target.id, toName: target.name, emoji }),
    })
  }

  function handleThrowOrPicker(target: Participant, emoji: string) {
    if (emoji === '__picker__') setFullPickerTarget(target)
    else handleThrow(target, emoji)
  }

  // ── Early returns ─────────────────────────────────────────────────────────────

  if (roomGone) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-6 text-center px-6" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="space-y-2">
          <p className="text-zinc-200 font-semibold">Room not found</p>
          <p className="text-zinc-600 text-sm max-w-xs">This room no longer exists, or the server was restarted.</p>
        </div>
        <Button onClick={() => router.push('/')} className="text-white h-9 px-5 text-sm" style={{ backgroundColor: 'var(--accent)' }}>
          Back to Home
        </Button>
      </div>
    )
  }

  if (!room && !showJoinDialog) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-3" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="w-5 h-5 rounded-full border-2 border-zinc-700 border-t-violet-500 animate-spin" />
        <span className="text-zinc-600 text-sm">Connecting...</span>
      </div>
    )
  }

  const votedCount = room ? Object.keys(room.votes).length : 0
  const totalCount = room ? room.participants.length : 0
  const revealedVotes = room?.phase === 'revealed'
    ? room.participants.map((p) => room.votes[p.id]).filter(Boolean)
    : []
  const consensus = calcConsensus(revealedVotes)
  const seats = room ? distributeSeats(room.participants) : { top: [], left: [], right: [], bottom: [] }

  const renderSeat = (p: Participant) => (
    <TableCard
      key={p.id} pid={p.id} name={p.name} avatarStyle={p.avatarStyle}
      voted={!!room?.votes[p.id]} revealed={room?.phase === 'revealed'}
      value={room?.votes[p.id]} isMe={p.id === participantId}
      isFacilitator={p.role === 'facilitator'}
      canThrow={!!participantId && p.id !== participantId}
      lastEmoji={lastEmoji}
      onThrow={(emoji) => handleThrowOrPicker(p, emoji)}
    />
  )

  // ── Shared queue/history panel props ──────────────────────────────────────────

  const queueProps = {
    room, isModerator,
    showAddTopic, setShowAddTopic,
    newTopicJira, setNewTopicJira,
    newTopicTitle, setNewTopicTitle,
    newTopicLink,
    newTopicDescription, setNewTopicDescription,
    handleAddTopic, handleTopicLinkChange, handleStartTopic, handleRemoveTopic,
    onImportClick: () => sidebarImportRef.current?.click(),
    onJiraPickerOpen: jira.status?.connected ? () => setShowJiraPicker(true) : undefined,
  }

  async function handleJiraPickerAdd(issues: import('@/lib/use-jira').JiraSprintIssue[]) {
    for (const issue of issues) {
      await fetch(`/api/rooms/${roomId}/topics`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: issue.summary, jiraTicket: issue.key, jiraLink: issue.url, description: '' }),
      })
    }
    toast(`Added ${issues.length} issue${issues.length > 1 ? 's' : ''} to queue`, { duration: 2500 })
  }

  // ── Table pane (shared between mobile and desktop main) ───────────────────────
  // Two-zone layout: flex-1 table area (centered) + shrink-0 controls bar

  const tablePaneContent = (
    <>
      {/* Zone 1 — table, fills all available height */}
      <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center px-4">
        {seats.top.length > 0 && (
          <div className="flex items-end gap-4 sm:gap-7 justify-center pb-4 sm:pb-8">{seats.top.map(renderSeat)}</div>
        )}
        <div className="flex items-center justify-center gap-4 sm:gap-8 w-full">
          {seats.left.length > 0 && <div className="flex flex-col gap-4 sm:gap-7">{seats.left.map(renderSeat)}</div>}
          <div
            className="relative flex items-center justify-center shrink-0"
            style={{
              minWidth: 'min(260px, 55vw)', minHeight: 110,
              borderRadius: '999px',
              padding: '24px 64px',
              background: 'var(--surface)',
              border: '6px solid #3b1f0a',
              boxShadow: '0 0 0 1px #1a0d05, 0 0 0 3px #5c3214, 0 12px 40px rgba(0,0,0,0.6)',
            }}
          >
            {/* Table content */}
            <div className="relative z-10 flex items-center justify-center">
              {room?.phase === 'voting' ? (
                <div className="text-center space-y-1.5">
                  <p className="text-zinc-300 text-sm font-medium">Voting in progress</p>
                  {votedCount > 0 && <p className="text-zinc-400/60 text-xs tabular-nums">{votedCount} of {totalCount} voted</p>}
                </div>
              ) : (
                <div className="text-center space-y-1">
                  {consensus ? (
                    <><p className="text-emerald-400/80 text-[11px] font-semibold uppercase tracking-widest">Consensus</p>
                      <p className="text-white font-black text-5xl tabular-nums">{consensus}</p></>
                  ) : (
                    <><p className="text-zinc-400/60 text-[11px] font-semibold uppercase tracking-widest">Average</p>
                      <p className="text-white font-black text-5xl tabular-nums">{calcAverage(revealedVotes)}</p>
                      <p className="text-zinc-500 text-xs">No consensus</p></>
                  )}
                </div>
              )}
            </div>
          </div>
          {seats.right.length > 0 && <div className="flex flex-col gap-4 sm:gap-7">{seats.right.map(renderSeat)}</div>}
        </div>
        {seats.bottom.length > 0 && (
          <div className="flex items-start gap-4 sm:gap-7 justify-center pt-4 sm:pt-8">{seats.bottom.map(renderSeat)}</div>
        )}
      </div>

      {/* Zone 2 — controls, pinned at bottom */}
      <div className="shrink-0 w-full" style={{ borderTop: '1px solid var(--border)' }}>

        {/* Story row */}
        <div className="flex gap-2 px-3 pt-3 pb-2">
          <div className="relative">
            <Input
              placeholder="JIRA-123"
              value={jiraTicket}
              onChange={(e) => setJiraTicket(e.target.value.toUpperCase())}
              onFocus={() => { storyFocusedRef.current = true }}
              onBlur={handleStoryBlur}
              onKeyDown={(e) => e.key === 'Enter' && storyRef.current?.focus()}
              className="w-24 sm:w-[7.5rem] h-10 text-xs font-mono uppercase tracking-wider text-blue-300 placeholder:text-zinc-700 focus-visible:ring-violet-500/50"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: jiraIssueData ? 'var(--accent)' : 'rgba(255,255,255,0.08)' }}
            />
            {jiraFetching && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
            )}
            {jiraIssueData && !jiraFetching && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </div>
          {/* Jira search button */}
          {jira.status?.connected && (
            <div className="relative">
              <button
                onClick={() => { setJiraSearchOpen((v) => !v); setJiraSearch('') }}
                className="h-10 w-10 flex items-center justify-center rounded-md border transition-colors shrink-0"
                style={jiraSearchOpen
                  ? { color: 'var(--accent)', borderColor: 'var(--accent)', backgroundColor: 'var(--accent-muted)' }
                  : { color: '#52525b', borderColor: 'rgba(63,63,70,0.5)' }}
                title="Search Jira issues"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              {jiraSearchOpen && (
                <div
                  className="absolute top-12 left-0 z-50 rounded-lg shadow-xl overflow-hidden"
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
                    {jiraSearchLoading && (
                      <p className="text-xs text-zinc-600 px-3 py-2">Searching…</p>
                    )}
                    {!jiraSearchLoading && jiraSearch && jiraSearchResults.length === 0 && (
                      <p className="text-xs text-zinc-600 px-3 py-2">No results</p>
                    )}
                    {!jiraSearchLoading && !jiraSearch && (
                      <p className="text-xs text-zinc-600 px-3 py-2">Type to search your Jira issues</p>
                    )}
                    {jiraSearchResults.map((issue) => (
                      <button
                        key={issue.key}
                        className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors"
                        onMouseDown={() => {
                          setJiraTicket(issue.key)
                          if (!story.trim()) setStory(issue.summary)
                          setJiraSearchOpen(false)
                          setJiraSearch('')
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono shrink-0" style={{ color: 'var(--accent)' }}>{issue.key}</span>
                          {issue.status && <span className="text-[10px] text-zinc-600 shrink-0">{issue.status}</span>}
                        </div>
                        <p className="text-xs text-zinc-300 truncate mt-0.5">{issue.summary}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <Input
            ref={storyRef}
            placeholder="What are you estimating?"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            onFocus={() => { storyFocusedRef.current = true }}
            onBlur={handleStoryBlur}
            onKeyDown={(e) => e.key === 'Enter' && storyRef.current?.blur()}
            className="flex-1 h-10 text-sm text-zinc-200 placeholder:text-zinc-700 focus-visible:ring-violet-500/50"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' }}
          />
          {/* Toggle details */}
          <button
            onClick={() => setShowStoryDetails((v) => !v)}
            title="Jira URL & description"
            className="h-10 w-10 flex items-center justify-center rounded-md border transition-colors shrink-0"
            style={showStoryDetails
              ? { color: 'var(--accent)', borderColor: 'var(--accent)', backgroundColor: 'var(--accent-muted)' }
              : { color: '#52525b', borderColor: 'rgba(63,63,70,0.5)' }}
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
          {/* Reveal / reset */}
          {room?.phase === 'voting' ? (
            <Button onClick={handleReveal} disabled={votedCount === 0}
              className="h-10 px-4 text-white text-sm font-semibold shrink-0 gap-2"
              style={{ backgroundColor: 'var(--accent)' }}>
              <Eye className="w-3.5 h-3.5" />
              Reveal
              {votedCount > 0 && <span className="font-mono text-xs ml-0.5 opacity-75">{votedCount}/{totalCount}</span>}
            </Button>
          ) : (
            <Button onClick={handleReset} variant="ghost"
              className="h-10 px-4 text-zinc-400 hover:text-zinc-100 text-sm shrink-0 gap-2">
              <RotateCcw className="w-3.5 h-3.5" />
              {room?.topics && room.topics.length > 0 ? 'Next' : 'New Round'}
            </Button>
          )}
        </div>

        {/* Collapsible: Jira URL + description */}
        {showStoryDetails && (
          <div className="px-3 pb-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Jira URL — auto-fills ticket number on paste"
                value={jiraLink}
                onChange={(e) => handleLinkChange(e.target.value)}
                onFocus={() => { storyFocusedRef.current = true }}
                onBlur={handleStoryBlur}
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
            {(storyDescription || isModerator) && (
              <textarea
                placeholder="Description (optional)"
                value={storyDescription}
                onChange={(e) => setStoryDescription(e.target.value)}
                onFocus={() => { storyFocusedRef.current = true }}
                onBlur={handleStoryBlur}
                readOnly={!isModerator}
                rows={2}
                className="w-full resize-none text-xs text-zinc-400 placeholder:text-zinc-700 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500/50 leading-relaxed overflow-y-auto"
                style={{ maxHeight: '4.5rem', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              />
            )}
          </div>
        )}

        {/* Voting cards */}
        {room?.phase === 'voting' && participantId && !isFacilitator && (
          <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5 px-3 pb-3">
            {CARD_VALUES.map((v) => (
              <PokerCard key={v} value={v} selected={myVote === v} onClick={() => handleVote(v)} />
            ))}
          </div>
        )}

        {/* Revealed distribution */}
        {room?.phase === 'revealed' && revealedVotes.length > 0 && (
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

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      data-pp-root
      data-light={theme.light ? 'true' : undefined}
      className="h-dvh flex flex-col text-white overflow-hidden"
      style={{
        backgroundColor: 'var(--bg)',
        color: theme.light ? '#0f172a' : undefined,
        '--bg': theme.bg,
        '--surface': theme.surface,
        '--surface2': theme.surface2,
        '--border': theme.border,
        '--accent': theme.accent,
        '--accent-hover': theme.hover,
        '--accent-muted': theme.muted,
        '--accent-ring': theme.ring,
      } as React.CSSProperties}
    >

      {/* Dynamic accent color overrides for focus rings + light theme text overrides */}
      <style>{`
        [data-pp-root] *:focus-visible { outline-color: var(--accent) !important; }
        [data-pp-root] .focus-visible\\:ring-violet-500:focus-visible,
        [data-pp-root] .focus\\:ring-violet-500:focus,
        [data-pp-root] [class*="ring-violet"]:focus-visible,
        [data-pp-root] [class*="ring-violet"]:focus { --tw-ring-color: var(--accent-ring) !important; }
        ${theme.light ? `
        [data-pp-root][data-light] .text-white        { color: #1c1510 !important; }
        [data-pp-root][data-light] .text-zinc-100     { color: #2a221a !important; }
        [data-pp-root][data-light] .text-zinc-300     { color: #3d3128 !important; }
        [data-pp-root][data-light] .text-zinc-400     { color: #5a4e44 !important; }
        [data-pp-root][data-light] .text-zinc-500     { color: #7a6e64 !important; }
        [data-pp-root][data-light] .text-zinc-600     { color: #9c9188 !important; }
        [data-pp-root][data-light] .text-zinc-700     { color: #b8afa8 !important; }
        [data-pp-root][data-light] .border-zinc-700\\/50 { border-color: rgba(0,0,0,0.1) !important; }
        [data-pp-root][data-light] .border-zinc-800   { border-color: rgba(0,0,0,0.08) !important; }
        [data-pp-root][data-light] .bg-zinc-900       { background-color: #d8d0c6 !important; }
        [data-pp-root][data-light] .bg-zinc-800       { background-color: #cfc8be !important; }
        [data-pp-root][data-light] .hover\\:bg-zinc-800:hover { background-color: #cfc8be !important; }
        [data-pp-root][data-light] .hover\\:text-zinc-300:hover { color: #3d3128 !important; }
        [data-pp-root][data-light] .hover\\:text-zinc-400:hover { color: #5a4e44 !important; }
        [data-pp-root][data-light] .placeholder\\:text-zinc-700::placeholder { color: #a89e95 !important; }
        [data-pp-root][data-light] input, [data-pp-root][data-light] textarea { color: #1c1510 !important; }
        ` : ''}
      `}</style>

      {/* Hidden file input for sidebar bulk import */}
      <input
        ref={sidebarImportRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={handleSidebarImport}
      />


      {/* Jira issue picker */}
      {showJiraPicker && (
        <JiraPicker
          onAdd={handleJiraPickerAdd}
          onClose={() => setShowJiraPicker(false)}
        />
      )}

      {/* Full emoji picker overlay */}
      {fullPickerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={() => setFullPickerTarget(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <EmojiPicker theme={Theme.DARK} height={380} width={320}
              onEmojiClick={(data: EmojiClickData) => {
                handleThrow(fullPickerTarget, data.emoji)
                setFullPickerTarget(null)
              }} />
          </div>
        </div>
      )}

      {/* Join dialog */}
      <Dialog open={showJoinDialog} onOpenChange={() => {}}>
        <DialogContent className="border text-zinc-100 sm:max-w-sm"
          style={{ backgroundColor: 'var(--surface2)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle className="text-zinc-100 text-base">
              {room ? `Join "${room.name}"` : 'Join Room'}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm">
              Enter your name to join the session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Your name</Label>
              <Input placeholder="e.g. Alice" value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                className="h-10 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }}
                autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                Avatar <span className="text-zinc-700 normal-case font-normal tracking-normal">(opt.)</span>
              </Label>
              <AvatarPicker name={joinName} value={joinAvatar} onChange={setJoinAvatar} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Role</Label>
              <div className="flex gap-2">
                {(['voter', 'facilitator'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setJoinRole(r)}
                    className={cn(
                      'flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-semibold transition-colors',
                      joinRole === r
                        ? 'border-white/70 bg-white/10 text-white'
                        : 'border-zinc-700/50 bg-white/[0.03] text-zinc-500 hover:border-zinc-600 hover:text-zinc-300',
                    )}
                  >
                    <span className="text-base">{r === 'voter' ? '🗳️' : '👀'}</span>
                    <span className="capitalize">{r}</span>
                    <span className="text-[10px] font-normal text-zinc-600 normal-case">
                      {r === 'voter' ? 'Votes on stories' : 'Observes, no vote'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleJoin} disabled={!joinName.trim() || joining}
              className="w-full text-white h-10 text-sm font-semibold"
              style={{ backgroundColor: 'var(--accent)' }}>
              {joining ? 'Joining...' : 'Join Session'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-md shrink-0"
        style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-black text-base shrink-0" style={{ color: 'var(--accent)' }}>◈</span>
            <span className="font-semibold text-sm text-zinc-100 truncate">{room?.name}</span>
            <span className="hidden sm:block w-px h-3.5 shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <button onClick={handleCopyCode} className="hidden sm:flex items-center gap-1.5 text-zinc-600 hover:text-zinc-300 transition-colors">
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span className="font-mono text-xs tracking-widest">{roomId}</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            {/* Theme picker */}
            <div className="flex items-center gap-1.5">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  title={t.label}
                  onClick={() => setTheme(t.id as ThemeId)}
                  className="w-3.5 h-3.5 rounded-full transition-transform hover:scale-125 shrink-0"
                  style={{
                    backgroundColor: t.id === 'white' ? '#f8f9fa' : t.id === 'dark' ? '#333' : t.accent,
                    border: t.id === 'white' ? '1.5px solid rgba(255,255,255,0.25)' : t.id === 'dark' ? '1.5px solid rgba(255,255,255,0.15)' : 'none',
                    outline: themeId === t.id ? `2px solid ${t.accent}` : '2px solid transparent',
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
            <span className="w-px h-4 shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            {jira.status?.connected ? (
              <button
                onClick={jira.disconnect}
                title={`Connected to ${jira.status.cloud_name}`}
                className="flex items-center gap-1 text-xs font-medium transition-colors"
                style={{ color: 'var(--accent)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                Jira
              </button>
            ) : (
              <button
                onClick={jira.connect}
                className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
              >
                <Link2 className="w-3 h-3" /> Jira
              </button>
            )}
            <span className="w-px h-4 shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <button onClick={handleLeave} className="flex items-center gap-1.5 text-zinc-600 hover:text-zinc-300 text-xs transition-colors py-2 px-1 -mr-1">
              Leave <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── MOBILE: full-screen tab panes + bottom nav (< lg) ── */}
        <div className="lg:hidden flex-1 flex flex-col overflow-hidden">
          {/* Table tab — non-scrollable, fits viewport */}
          {mobileTab === 'table' && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {tablePaneContent}
            </div>
          )}
          {/* Queue / History tabs — scrollable */}
          {mobileTab !== 'table' && (
            <div className="flex-1 overflow-y-auto">
              {mobileTab === 'queue' && <SidebarQueuePanel {...queueProps} />}
              {mobileTab === 'history' && <SidebarHistoryPanel handleExportHistory={handleExportHistory} />}
            </div>
          )}
          {/* Bottom nav */}
          <nav className="shrink-0 flex" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
            {([
              { id: 'table' as const, label: 'Table', Icon: Table2, badge: undefined },
              { id: 'queue' as const, label: 'Queue', Icon: LayoutList, badge: room?.topics.length },
              { id: 'history' as const, label: 'History', Icon: History, badge: room?.history.length },
            ]).map(({ id, label, Icon, badge }) => (
              <button
                key={id}
                onClick={() => setMobileTab(id)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors',
                  mobileTab === id ? '' : 'text-zinc-600 hover:text-zinc-400',
                )}
                style={mobileTab === id ? { color: 'var(--accent)' } : {}}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {(badge ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-2 text-[9px] font-mono text-zinc-300 bg-zinc-700 px-1 rounded-full leading-tight">
                      {badge}
                    </span>
                  )}
                </div>
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── DESKTOP: main + sidebar (lg+) ── */}
        <main className="hidden lg:flex flex-1 flex-col overflow-hidden min-w-0 min-h-0">
          {tablePaneContent}
        </main>

        <aside
          className="hidden lg:flex w-72 xl:w-80 flex-col shrink-0 overflow-hidden"
          style={{ borderLeft: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}
        >
          {/* Tab strip */}
          <div className="flex shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            {(['queue', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 h-11 text-xs font-semibold transition-colors capitalize border-b-2',
                  sidebarTab === tab ? 'text-zinc-100' : 'text-zinc-600 hover:text-zinc-400 border-transparent',
                )}
                style={sidebarTab === tab ? { borderColor: 'var(--accent)' } : {}}
              >
                {tab}
                {tab === 'queue' && (room?.topics.length ?? 0) > 0 && (
                  <span className="text-[10px] font-mono text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded-full">{room!.topics.length}</span>
                )}
                {tab === 'history' && (room?.history.length ?? 0) > 0 && (
                  <span className="text-[10px] font-mono text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded-full">{room!.history.length}</span>
                )}
              </button>
            ))}
          </div>
          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {sidebarTab === 'queue' && <SidebarQueuePanel {...queueProps} />}
            {sidebarTab === 'history' && <SidebarHistoryPanel handleExportHistory={handleExportHistory} />}
          </div>
        </aside>

      </div>
    </div>
  )
}

// ── TopicRow ──────────────────────────────────────────────────────────────────

function TopicRow({ topic: t, isModerator, onStart, onRemove }: {
  topic: Topic
  isModerator: boolean
  onStart: (id: string) => void
  onRemove: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }} className="last:border-0">
      {/* Header row — mirrors HistoryEntryRow */}
      <button
        onClick={() => t.description && setExpanded((v) => !v)}
        className={cn(
          'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors',
          !t.description && 'cursor-default',
        )}
      >
        {t.jiraTicket && <span className="mt-0.5 shrink-0"><JiraBadge ticket={t.jiraTicket} link={t.jiraLink} /></span>}
        <span className="text-sm text-zinc-400 flex-1 min-w-0 break-words leading-snug">{t.title}</span>
        <div className="flex items-center gap-2.5 shrink-0 self-start pt-0.5">
          {isModerator && (
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
          {t.description && (
            <ChevronDown className={cn('w-3 h-3 text-zinc-700 transition-transform', expanded && 'rotate-180')} />
          )}
        </div>
      </button>
      {/* Expanded description — same layout as HistoryEntryRow */}
      {expanded && t.description && (
        <div className="px-4 pb-3">
          <JiraText text={t.description} />
        </div>
      )}
    </div>
  )
}

// ── SidebarQueuePanel ─────────────────────────────────────────────────────────

function SidebarQueuePanel({
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
          onStart={handleStartTopic} onRemove={handleRemoveTopic}
        />
      ))}
    </div>
  )
}

// ── SidebarHistoryPanel ───────────────────────────────────────────────────────

function SidebarHistoryPanel({ handleExportHistory }: { handleExportHistory: () => void }) {
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
