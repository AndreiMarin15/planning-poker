'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import type { Room, Participant, HistoryEntry, EmojiThrow } from '@/lib/types'
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
import { Copy, Check, Eye, RotateCcw, LogOut, ChevronDown, Plus, X, Play, Link2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { extractJiraTicket, isJiraUrl } from '@/lib/jira'
import { AvatarImg, AvatarPicker, DEFAULT_AVATAR, type AvatarStyleId } from '@/components/avatar'

// ── Cookie session helpers ────────────────────────────────────────────────────
// Keyed per room so multiple rooms work in the same browser.

function getSession(roomId: string): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp(`(?:^|; )pp_${roomId}_pid=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : localStorage.getItem(`pp_${roomId}_pid`)
}

function setSession(roomId: string, pid: string) {
  const exp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `pp_${roomId}_pid=${encodeURIComponent(pid)}; expires=${exp}; path=/; SameSite=Strict`
  localStorage.setItem(`pp_${roomId}_pid`, pid) // keep in sync for legacy
}

function clearSession(roomId: string) {
  document.cookie = `pp_${roomId}_pid=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict`
  localStorage.removeItem(`pp_${roomId}_pid`)
}

// ── helpers ──────────────────────────────────────────────────────────────────

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
  pid, name, avatarStyle, voted, revealed, value, isMe, canThrow, lastEmoji, onThrow,
}: {
  pid: string; name: string; avatarStyle?: string; voted: boolean; revealed: boolean
  value?: string; isMe: boolean; canThrow: boolean; lastEmoji: string | null; onThrow?: (emoji: string) => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      data-pid={pid}
      className="flex flex-col items-center gap-2"
      onMouseEnter={() => { if (canThrow) setHovered(true) }}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Quick emoji bar — in normal flow so the parent's hit area covers it */}
      <div
        className="flex items-center gap-px px-2 py-1.5 rounded-full z-30 transition-opacity duration-150"
        style={{
          backgroundColor: 'rgba(10,18,35,0.96)',
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

      <div
        className={cn(
          'w-11 h-[3.75rem] rounded-xl border relative overflow-hidden transition-all duration-300',
          !voted && !revealed && 'border-zinc-600/30',
          voted && !revealed && 'border-blue-400/20',
          revealed && 'border-slate-500/30',
        )}
        style={revealed ? { backgroundColor: '#1a2e4a' } : voted ? VOTED_STYLE : { backgroundColor: 'rgba(82,82,91,0.45)' }}
      >
        {revealed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-bold text-xl tabular-nums leading-none">{value ?? '—'}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-1">
        <AvatarImg name={name} style={avatarStyle} size={28} isMe={isMe} />
        <span className={cn('text-[12px] font-semibold leading-none', isMe ? 'text-violet-300' : 'text-zinc-300')}>
          {name}
        </span>
      </div>
    </div>
  )
}

// ── JiraBadge ─────────────────────────────────────────────────────────────────

function JiraBadge({ ticket, link }: { ticket: string; link?: string }) {
  const cls = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold font-mono text-blue-300 bg-blue-500/15 border border-blue-500/20 shrink-0'
  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" className={cn(cls, 'hover:bg-blue-500/25 hover:text-blue-200 transition-colors')}>
        {ticket}
        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
      </a>
    )
  }
  return <span className={cls}>{ticket}</span>
}

// ── CollapsiblePanel ──────────────────────────────────────────────────────────

function CollapsiblePanel({
  title, count, defaultOpen = false, children, action,
}: {
  title: string; count?: number; defaultOpen?: boolean; children: React.ReactNode; action?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center justify-between px-5 py-3.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">{title}</span>
          {count != null && count > 0 && (
            <span className="text-[10px] font-mono text-zinc-700 bg-zinc-800 px-1.5 py-0.5 rounded-full">{count}</span>
          )}
          <ChevronDown className={cn('w-3.5 h-3.5 text-zinc-700 transition-transform ml-auto', open && 'rotate-180')} />
        </button>
        {action && <div className="ml-3 shrink-0">{action}</div>}
      </div>
      {open && <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>{children}</div>}
    </div>
  )
}

// ── HistoryEntryRow ───────────────────────────────────────────────────────────

function HistoryEntryRow({ entry }: { entry: HistoryEntry }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }} className="last:border-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.02] transition-colors"
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
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          {Object.entries(entry.votes).map(([pid, vote]) => (
            <span
              key={pid}
              className="text-[11px] text-zinc-500 px-2 py-1 rounded-md"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
            >
              {entry.participantNames[pid] ?? 'Unknown'}
              <span className="text-zinc-200 font-semibold ml-1.5 tabular-nums">{vote}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── RoomView ──────────────────────────────────────────────────────────────────

export function RoomView({ roomId }: { roomId: string }) {
  const router = useRouter()
  const [room, setRoom] = useState<Room | null>(null)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [showJoinDialog, setShowJoinDialog] = useState(false)
  const [joinName, setJoinName] = useState('')
  const [joinAvatar, setJoinAvatar] = useState<AvatarStyleId>(DEFAULT_AVATAR)
  const [joining, setJoining] = useState(false)
  const [copied, setCopied] = useState(false)

  // Story / Jira ticket / link local state (mirrors room, editable)
  const [story, setStory] = useState('')
  const [jiraTicket, setJiraTicket] = useState('')
  const [jiraLink, setJiraLink] = useState('')
  const [roomGone, setRoomGone] = useState(false)

  // Use a ref for focus tracking so connectSSE doesn't need it as a dep
  const storyFocusedRef = useRef(false)

  // Emoji throwing
  interface ActiveThrow { id: string; emoji: string; startX: number; startY: number; dx: number; dy: number }
  const [activeThrows, setActiveThrows] = useState<ActiveThrow[]>([])
  const [fullPickerTarget, setFullPickerTarget] = useState<Participant | null>(null)
  const [lastEmoji, setLastEmoji] = useState<string | null>(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem('pp_last_emoji') : null
  )

  // Add-topic form
  const [showAddTopic, setShowAddTopic] = useState(false)
  const [newTopicJira, setNewTopicJira] = useState('')
  const [newTopicLink, setNewTopicLink] = useState('')
  const [newTopicTitle, setNewTopicTitle] = useState('')

  const storyRef = useRef<HTMLInputElement>(null)
  const esRef = useRef<EventSource | null>(null)

  const myVote = room && participantId ? room.votes[participantId] : undefined
  const isModerator = room && participantId ? room.moderatorId === participantId : false

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
      }
    }

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        // HTTP-level failure (404, wrong content-type) — room is likely gone.
        // Verify once before giving up, then reconnect or surface the error.
        esRef.current = null
        setTimeout(() => {
          fetch(`/api/rooms/${roomId}`)
            .then((r) => { if (r.ok) connectSSE(pid); else setRoomGone(true) })
            .catch(() => setTimeout(() => connectSSE(pid), 3000))
        }, 1000)
      }
      // readyState === CONNECTING: browser is already retrying — do nothing
    }

    es.addEventListener('emoji', (e) => {
      const data: EmojiThrow = JSON.parse((e as MessageEvent).data)
      if (data.toId === pid) toast(`Someone threw ${data.emoji} at you!`, { duration: 2500 })
      const toEl = document.querySelector<HTMLElement>(`[data-pid="${data.toId}"]`)
      if (!toEl) return
      const tr = toEl.getBoundingClientRect()
      const fromSide = Math.random() < 0.5 ? 'left' : 'right'
      const startX = fromSide === 'left'
        ? Math.random() * 80
        : window.innerWidth - Math.random() * 80
      const startY = tr.top + tr.height / 2 + (Math.random() - 0.5) * window.innerHeight * 0.4
      const targetX = tr.left + tr.width / 2
      const targetY = tr.top + tr.height / 2
      const t: ActiveThrow = {
        id: data.id, emoji: data.emoji, startX, startY,
        dx: targetX - startX,
        dy: targetY - startY,
      }
      setActiveThrows((prev) => [...prev, t])
      setTimeout(() => setActiveThrows((prev) => prev.filter((x) => x.id !== t.id)), 1400)
    })

    esRef.current = es
  }, [roomId]) // stable — no storyFocused dep

  // Timeout: if still connecting after 12 s, declare the room gone
  useEffect(() => {
    if (room || roomGone || showJoinDialog) return
    const t = setTimeout(() => setRoomGone(true), 12000)
    return () => clearTimeout(t)
  }, [room, roomGone, showJoinDialog])

  useEffect(() => {
    const pid = getSession(roomId)

    async function init() {
      // Check the room exists before opening the SSE stream
      const check = await fetch(`/api/rooms/${roomId}`).catch(() => null)
      if (!check?.ok) { setRoomGone(true); return }

      if (pid) {
        setParticipantId(pid)
        connectSSE(pid)
      } else {
        // Observer connection while the join dialog is shown
        const es = new EventSource(`/api/rooms/${roomId}/events`)
        es.onmessage = (e) => {
          const r: Room = JSON.parse(e.data)
          setRoom(r); setStory(r.story); setJiraTicket(r.jiraTicket ?? ''); setJiraLink(r.jiraLink ?? '')
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

  async function handleJoin() {
    if (!joinName.trim()) return
    setJoining(true)
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: joinName.trim(), avatarStyle: joinAvatar }),
      })
      if (!res.ok) { toast.error('Room not found'); router.push('/'); return }
      const { participantId: pid, room: r } = await res.json()
      setSession(roomId, pid)
      setParticipantId(pid); setRoom(r); setStory(r.story); setJiraTicket(r.jiraTicket ?? ''); setJiraLink(r.jiraLink ?? '')
      setShowJoinDialog(false); connectSSE(pid)
    } finally { setJoining(false) }
  }

  async function handleVote(value: string) {
    if (!participantId || room?.phase !== 'voting') return
    setRoom((prev) => prev ? { ...prev, votes: { ...prev.votes, [participantId]: value } } : prev)
    await fetch(`/api/rooms/${roomId}/vote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, value }),
    })
  }

  async function handleReveal() {
    await fetch(`/api/rooms/${roomId}/reveal`, { method: 'POST' })
  }

  async function handleReset() {
    // Let the store auto-advance to next topic if one exists
    const res = await fetch(`/api/rooms/${roomId}/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const { room: r } = await res.json()
    setStory(r.story)
    setJiraTicket(r.jiraTicket ?? '')
    setJiraLink(r.jiraLink ?? '')
  }

  async function handleStoryBlur() {
    storyFocusedRef.current = false
    if (!room) return
    if (story !== room.story || jiraTicket !== (room.jiraTicket ?? '') || jiraLink !== (room.jiraLink ?? '')) {
      await fetch(`/api/rooms/${roomId}/story`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story, jiraTicket, jiraLink }),
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
    setStory(r.story); setJiraTicket(r.jiraTicket ?? ''); setJiraLink(r.jiraLink ?? '')
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
      body: JSON.stringify({ title: newTopicTitle.trim(), jiraTicket: newTopicJira.trim(), jiraLink: newTopicLink.trim() }),
    })
    setNewTopicJira(''); setNewTopicLink(''); setNewTopicTitle(''); setShowAddTopic(false)
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
    if (emoji === '__picker__') { setFullPickerTarget(target) }
    else { handleThrow(target, emoji) }
  }

  if (roomGone) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-6" style={{ backgroundColor: '#0f1929' }}>
        <div className="space-y-2">
          <p className="text-zinc-200 font-semibold">Room not found</p>
          <p className="text-zinc-600 text-sm max-w-xs">
            This room no longer exists, or the server was restarted.
          </p>
        </div>
        <Button onClick={() => router.push('/')} className="bg-violet-600 hover:bg-violet-500 text-white h-9 px-5 text-sm">
          Back to Home
        </Button>
      </div>
    )
  }

  if (!room && !showJoinDialog) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ backgroundColor: '#0f1929' }}>
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
      canThrow={!!participantId && p.id !== participantId}
      lastEmoji={lastEmoji}
      onThrow={(emoji) => handleThrowOrPicker(p, emoji)}
    />
  )

  return (
    <div className="min-h-screen flex flex-col text-white" style={{ backgroundColor: '#0f1929' }}>

      {/* ── Flying emoji overlay ─────────────────────────────────── */}
      <AnimatePresence>
        {activeThrows.map((t) => {
          const arc = -Math.min(Math.abs(t.dy) * 0.4 + 60, 160)
          return (
            <motion.div
              key={t.id}
              initial={{ x: t.startX, y: t.startY, scale: 0.6, opacity: 0, rotate: 0 }}
              animate={{
                x: [t.startX, t.startX + t.dx * 0.75, t.startX + t.dx, t.startX + t.dx],
                y: [t.startY, t.startY + t.dy * 0.75 + arc, t.startY + t.dy, t.startY + t.dy],
                scale: [0.6, 1.4, 2, 0],
                opacity: [0, 1, 1, 0],
                rotate: [0, 20, 5, 0],
              }}
              transition={{ duration: 1.3, ease: [0.25, 0.46, 0.45, 0.94], times: [0, 0.55, 0.82, 1] }}
              style={{
                position: 'fixed',
                left: 0,
                top: 0,
                translateX: '-50%',
                translateY: '-50%',
                fontSize: '2rem',
                zIndex: 9999,
                pointerEvents: 'none',
                userSelect: 'none',
                lineHeight: 1,
              }}
            >
              {t.emoji}
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* ── Full emoji picker overlay ─────────────────────────────── */}
      {fullPickerTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={() => setFullPickerTarget(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <EmojiPicker
              theme={Theme.DARK}
              height={380}
              width={320}
              onEmojiClick={(data: EmojiClickData) => {
                handleThrow(fullPickerTarget, data.emoji)
                setFullPickerTarget(null)
              }}
            />
          </div>
        </div>
      )}

      {/* ── Join dialog ──────────────────────────────────────────── */}
      <Dialog open={showJoinDialog} onOpenChange={() => {}}>
        <DialogContent
          className="border text-zinc-100 sm:max-w-sm"
          style={{ backgroundColor: '#172035', borderColor: 'rgba(255,255,255,0.08)' }}
        >
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
              <Input
                placeholder="e.g. Alice" value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                className="h-10 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                Avatar <span className="text-zinc-700 normal-case font-normal tracking-normal">(opt.)</span>
              </Label>
              <AvatarPicker name={joinName} value={joinAvatar} onChange={setJoinAvatar} />
            </div>
            <Button onClick={handleJoin} disabled={!joinName.trim() || joining}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white h-10 text-sm font-semibold">
              {joining ? 'Joining...' : 'Join Session'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Header ───────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-10 backdrop-blur-md"
        style={{ backgroundColor: 'rgba(12,21,37,0.85)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-violet-400 font-black text-base shrink-0">◈</span>
            <span className="font-semibold text-sm text-zinc-100 truncate">{room?.name}</span>
            <span className="hidden sm:block w-px h-3.5 shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <button onClick={handleCopyCode} className="hidden sm:flex items-center gap-1.5 text-zinc-600 hover:text-zinc-300 transition-colors">
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span className="font-mono text-xs tracking-widest">{roomId}</span>
            </button>
          </div>
          <button onClick={handleLeave} className="flex items-center gap-1.5 text-zinc-600 hover:text-zinc-300 text-xs transition-colors">
            Leave <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-between px-5 pt-6 pb-8 gap-6 max-w-4xl mx-auto w-full">

        {/* ── Poker table ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0">
          {seats.top.length > 0 && (
            <div className="flex items-end gap-7 justify-center pb-8">{seats.top.map(renderSeat)}</div>
          )}
          <div className="flex items-center justify-center gap-8 w-full">
            {seats.left.length > 0 && <div className="flex flex-col gap-7">{seats.left.map(renderSeat)}</div>}

            {/* Table */}
            <div className="flex items-center justify-center rounded-[2.5rem] px-14 py-10 shrink-0"
              style={{ minWidth: 250, minHeight: 135, backgroundColor: '#1a3050', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 50px rgba(8,15,30,0.7)' }}>
              {room?.phase === 'voting' ? (
                <div className="text-center space-y-1.5">
                  <p className="text-zinc-300 text-sm font-medium">Voting in progress</p>
                  {votedCount > 0 && <p className="text-zinc-600 text-xs tabular-nums">{votedCount} of {totalCount} voted</p>}
                </div>
              ) : (
                <div className="text-center space-y-1">
                  {consensus ? (
                    <><p className="text-emerald-500/70 text-[11px] font-semibold uppercase tracking-widest">Consensus</p>
                      <p className="text-white font-black text-5xl tabular-nums">{consensus}</p></>
                  ) : (
                    <><p className="text-zinc-500 text-[11px] font-semibold uppercase tracking-widest">Average</p>
                      <p className="text-white font-black text-5xl tabular-nums">{calcAverage(revealedVotes)}</p>
                      <p className="text-zinc-600 text-xs">No consensus</p></>
                  )}
                </div>
              )}
            </div>

            {seats.right.length > 0 && <div className="flex flex-col gap-7">{seats.right.map(renderSeat)}</div>}
          </div>
          {seats.bottom.length > 0 && (
            <div className="flex items-start gap-7 justify-center pt-8">{seats.bottom.map(renderSeat)}</div>
          )}
        </div>

        {/* ── Bottom: story + cards + queue + history ───────────── */}
        <div className="w-full space-y-4 shrink-0">

          {/* Story row */}
          <div className="space-y-1.5">
            <div className="flex gap-2">
              {/* Jira ticket # */}
              <Input
                placeholder="JIRA-123"
                value={jiraTicket}
                onChange={(e) => setJiraTicket(e.target.value.toUpperCase())}
                onFocus={() => { storyFocusedRef.current = true }}
                onBlur={handleStoryBlur}
                onKeyDown={(e) => e.key === 'Enter' && storyRef.current?.focus()}
                className="w-[7.5rem] h-10 text-xs font-mono uppercase tracking-wider text-blue-300 placeholder:text-zinc-700 focus-visible:ring-violet-500/50"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' }}
              />
              {/* Story title */}
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
              {/* Action */}
              {room?.phase === 'voting' ? (
                <Button onClick={handleReveal} disabled={votedCount === 0}
                  className="h-10 px-5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold shrink-0 gap-2">
                  <Eye className="w-3.5 h-3.5" />
                  Reveal
                  {votedCount > 0 && <span className="font-mono text-violet-300 text-xs ml-0.5">{votedCount}/{totalCount}</span>}
                </Button>
              ) : (
                <Button onClick={handleReset} variant="ghost"
                  className="h-10 px-5 text-zinc-400 hover:text-zinc-100 text-sm shrink-0 gap-2">
                  <RotateCcw className="w-3.5 h-3.5" />
                  {room?.topics && room.topics.length > 0 ? 'Next' : 'New Round'}
                </Button>
              )}
            </div>
            {/* Jira link — paste URL to auto-fill ticket number */}
            <div className="flex items-center gap-2">
              <Link2 className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
              <Input
                placeholder="Jira URL (optional) — auto-fills ticket number on paste"
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
          </div>

          {/* Voting cards */}
          {room?.phase === 'voting' && participantId && (
            <div className="flex flex-wrap justify-center gap-3">
              {CARD_VALUES.map((v) => (
                <PokerCard key={v} value={v} selected={myVote === v} onClick={() => handleVote(v)} />
              ))}
            </div>
          )}

          {/* Revealed distribution */}
          {room?.phase === 'revealed' && revealedVotes.length > 0 && (
            <div className="flex flex-wrap justify-center gap-4">
              {CARD_VALUES.filter((v) => revealedVotes.includes(v)).map((v) => {
                const count = revealedVotes.filter((rv) => rv === v).length
                return (
                  <div key={v} className="flex flex-col items-center gap-1.5">
                    <PokerCard value={v} revealed />
                    <span className="text-[11px] text-zinc-600 font-mono tabular-nums">×{count}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Queue ────────────────────────────────────────────── */}
          {(isModerator || (room?.topics && room.topics.length > 0)) && (
            <CollapsiblePanel
              title="Queue"
              count={room?.topics.length}
              defaultOpen={(room?.topics.length ?? 0) > 0}
              action={
                isModerator ? (
                  <button
                    onClick={() => setShowAddTopic((v) => !v)}
                    className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                ) : undefined
              }
            >
              {/* Add topic inline form */}
              {showAddTopic && isModerator && (
                <div
                  className="space-y-1.5 px-5 py-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div className="flex gap-2">
                    <Input
                      placeholder="JIRA-123"
                      value={newTopicJira}
                      onChange={(e) => setNewTopicJira(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && newTopicTitle && handleAddTopic()}
                      className="w-24 h-8 text-xs font-mono uppercase text-blue-300 placeholder:text-zinc-600 focus-visible:ring-violet-500"
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
                      className="h-8 px-3 bg-violet-600/20 hover:bg-violet-600/40 text-violet-400 border border-violet-600/30 text-xs">
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
                </div>
              )}

              {/* Topic list */}
              {room?.topics.length === 0 && !showAddTopic && (
                <div className="px-5 py-3 text-[12px] text-zinc-700">No topics queued.</div>
              )}
              {room?.topics.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  {t.jiraTicket && <JiraBadge ticket={t.jiraTicket} link={t.jiraLink} />}
                  <span className="text-sm text-zinc-300 flex-1 truncate min-w-0">{t.title}</span>
                  {isModerator && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleStartTopic(t.id)}
                        className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 font-semibold transition-colors"
                      >
                        <Play className="w-3 h-3" />
                        Vote
                      </button>
                      <button onClick={() => handleRemoveTopic(t.id)} className="text-zinc-700 hover:text-zinc-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </CollapsiblePanel>
          )}

          {/* ── History ──────────────────────────────────────────── */}
          {room && room.history.length > 0 && (
            <CollapsiblePanel title="History" count={room.history.length}>
              <div>
                {[...room.history].reverse().map((entry) => (
                  <HistoryEntryRow key={entry.id} entry={entry} />
                ))}
              </div>
            </CollapsiblePanel>
          )}
        </div>
      </main>
    </div>
  )
}
