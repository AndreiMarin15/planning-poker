'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Room, Participant } from '@/lib/types'
import { CARD_VALUES } from '@/lib/types'
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
import { Copy, Check, Eye, RotateCcw, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

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

// Distribute N participants around the table
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
  // 7+ players: 3 top, side overflow, 3 bottom
  const top = ps.slice(0, 3)
  const bottom = ps.slice(n - 3)
  const mid = ps.slice(3, n - 3)
  const lc = Math.ceil(mid.length / 2)
  return { top, left: mid.slice(0, lc), right: mid.slice(lc), bottom }
}

// ── TableCard ─────────────────────────────────────────────────────────────────
// Small face-down/face-up card shown for each player around the table

const VOTED_STYLE: React.CSSProperties = {
  backgroundColor: '#2f6fd4',
  backgroundImage: [
    'repeating-linear-gradient(45deg,  rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 9px)',
    'repeating-linear-gradient(-45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 9px)',
  ].join(', '),
}

function TableCard({
  name,
  voted,
  revealed,
  value,
  isMe,
}: {
  name: string
  voted: boolean
  revealed: boolean
  value?: string
  isMe: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          'w-11 h-[3.75rem] rounded-xl border relative overflow-hidden transition-all duration-300',
          !voted && !revealed && 'border-zinc-600/30',
          voted && !revealed && 'border-blue-400/20',
          revealed && 'border-slate-500/30',
        )}
        style={
          revealed
            ? { backgroundColor: '#1a2e4a' }
            : voted
            ? VOTED_STYLE
            : { backgroundColor: 'rgba(82,82,91,0.45)' }
        }
      >
        {revealed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-bold text-xl tabular-nums leading-none">
              {value ?? '—'}
            </span>
          </div>
        )}
      </div>
      <span className={cn('text-[13px] font-semibold leading-none', isMe ? 'text-violet-300' : 'text-zinc-200')}>
        {name}
      </span>
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
  const [joining, setJoining] = useState(false)
  const [copied, setCopied] = useState(false)
  const [story, setStory] = useState('')
  const [storyFocused, setStoryFocused] = useState(false)
  const storyRef = useRef<HTMLInputElement>(null)
  const esRef = useRef<EventSource | null>(null)

  const myVote = room && participantId ? room.votes[participantId] : undefined

  const connectSSE = useCallback(
    (pid: string) => {
      if (esRef.current) esRef.current.close()
      const es = new EventSource(`/api/rooms/${roomId}/events`)
      es.onmessage = (e) => {
        const data: Room = JSON.parse(e.data)
        setRoom(data)
        setStory((prev) => (storyFocused ? prev : data.story))
      }
      es.onerror = () => {
        setTimeout(() => { if (esRef.current === es) connectSSE(pid) }, 2000)
      }
      esRef.current = es
    },
    [roomId, storyFocused],
  )

  useEffect(() => {
    const pid = localStorage.getItem(`pp_${roomId}_pid`)
    if (pid) {
      setParticipantId(pid)
      connectSSE(pid)
    } else {
      const es = new EventSource(`/api/rooms/${roomId}/events`)
      es.onmessage = (e) => {
        const r: Room = JSON.parse(e.data)
        setRoom(r)
        setStory(r.story)
      }
      es.onerror = () => setRoom(null)
      esRef.current = es
      setShowJoinDialog(true)
    }
    return () => esRef.current?.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  async function handleJoin() {
    if (!joinName.trim()) return
    setJoining(true)
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: joinName.trim() }),
      })
      if (!res.ok) { toast.error('Room not found'); router.push('/'); return }
      const { participantId: pid, room: r } = await res.json()
      localStorage.setItem(`pp_${roomId}_pid`, pid)
      setParticipantId(pid); setRoom(r); setStory(r.story)
      setShowJoinDialog(false); connectSSE(pid)
    } finally { setJoining(false) }
  }

  async function handleVote(value: string) {
    if (!participantId || room?.phase !== 'voting') return
    setRoom((prev) => prev ? { ...prev, votes: { ...prev.votes, [participantId]: value } } : prev)
    await fetch(`/api/rooms/${roomId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, value }),
    })
  }

  async function handleReveal() {
    await fetch(`/api/rooms/${roomId}/reveal`, { method: 'POST' })
  }

  async function handleReset() {
    await fetch(`/api/rooms/${roomId}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ story: '' }),
    })
    setStory('')
  }

  async function handleStoryBlur() {
    setStoryFocused(false)
    if (room && story !== room.story) {
      await fetch(`/api/rooms/${roomId}/story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story }),
      })
    }
  }

  function handleLeave() {
    localStorage.removeItem(`pp_${roomId}_pid`)
    if (participantId) {
      fetch(`/api/rooms/${roomId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
      }).catch(() => {})
    }
    router.push('/')
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!room && !showJoinDialog) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f1929' }}>
        <span className="text-zinc-600 text-sm">Connecting...</span>
      </div>
    )
  }

  const votedCount = room ? Object.keys(room.votes).length : 0
  const totalCount = room ? room.participants.length : 0
  const revealedVotes =
    room?.phase === 'revealed'
      ? room.participants.map((p) => room.votes[p.id]).filter(Boolean)
      : []
  const consensus = calcConsensus(revealedVotes)
  const seats = room ? distributeSeats(room.participants) : { top: [], left: [], right: [], bottom: [] }

  const renderSeat = (p: Participant) => (
    <TableCard
      key={p.id}
      name={p.name}
      voted={!!room?.votes[p.id]}
      revealed={room?.phase === 'revealed'}
      value={room?.votes[p.id]}
      isMe={p.id === participantId}
    />
  )

  return (
    <div className="min-h-screen flex flex-col text-white" style={{ backgroundColor: '#0f1929' }}>

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
              <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                Your name
              </Label>
              <Input
                placeholder="e.g. Alice"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                className="h-10 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }}
                autoFocus
              />
            </div>
            <Button
              onClick={handleJoin}
              disabled={!joinName.trim() || joining}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white h-10 text-sm font-semibold"
            >
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
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-violet-400 font-black text-base shrink-0">◈</span>
            <span className="font-semibold text-sm text-zinc-100 truncate">{room?.name}</span>
            <span className="hidden sm:block w-px h-3.5 shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <button
              onClick={handleCopyCode}
              className="hidden sm:flex items-center gap-1.5 text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span className="font-mono text-xs tracking-widest">{roomId}</span>
            </button>
          </div>
          <button
            onClick={handleLeave}
            className="flex items-center gap-1.5 text-zinc-600 hover:text-zinc-300 text-xs transition-colors"
          >
            Leave <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-between px-5 pt-6 pb-8 gap-6 max-w-4xl mx-auto w-full">

        {/* ── Poker table ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0">

          {/* Top players */}
          {seats.top.length > 0 && (
            <div className="flex items-end gap-7 justify-center pb-8">
              {seats.top.map(renderSeat)}
            </div>
          )}

          {/* Middle row: left | table | right */}
          <div className="flex items-center justify-center gap-8 w-full">

            {seats.left.length > 0 && (
              <div className="flex flex-col gap-7">
                {seats.left.map(renderSeat)}
              </div>
            )}

            {/* The table */}
            <div
              className="flex items-center justify-center rounded-[2.5rem] px-14 py-10 shrink-0"
              style={{
                minWidth: 250,
                minHeight: 135,
                backgroundColor: '#1a3050',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 50px rgba(8,15,30,0.7)',
              }}
            >
              {room?.phase === 'voting' ? (
                <div className="text-center space-y-1.5">
                  <p className="text-zinc-300 text-sm font-medium">Voting in progress</p>
                  {votedCount > 0 && (
                    <p className="text-zinc-600 text-xs tabular-nums">{votedCount} of {totalCount} voted</p>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-1">
                  {consensus ? (
                    <>
                      <p className="text-emerald-500/70 text-[11px] font-semibold uppercase tracking-widest">Consensus</p>
                      <p className="text-white font-black text-5xl tabular-nums">{consensus}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-zinc-500 text-[11px] font-semibold uppercase tracking-widest">Average</p>
                      <p className="text-white font-black text-5xl tabular-nums">{calcAverage(revealedVotes)}</p>
                      <p className="text-zinc-600 text-xs">No consensus</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {seats.right.length > 0 && (
              <div className="flex flex-col gap-7">
                {seats.right.map(renderSeat)}
              </div>
            )}
          </div>

          {/* Bottom players */}
          {seats.bottom.length > 0 && (
            <div className="flex items-start gap-7 justify-center pt-8">
              {seats.bottom.map(renderSeat)}
            </div>
          )}
        </div>

        {/* ── Story + cards ─────────────────────────────────────── */}
        <div className="w-full space-y-4 shrink-0">

          {/* Story + action button */}
          <div className="flex gap-2.5">
            <Input
              ref={storyRef}
              placeholder="What are you estimating?"
              value={story}
              onChange={(e) => setStory(e.target.value)}
              onFocus={() => setStoryFocused(true)}
              onBlur={handleStoryBlur}
              onKeyDown={(e) => e.key === 'Enter' && storyRef.current?.blur()}
              className="flex-1 h-10 text-sm text-zinc-200 placeholder:text-zinc-700 focus-visible:ring-violet-500/50"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' }}
            />
            {room?.phase === 'voting' ? (
              <Button
                onClick={handleReveal}
                disabled={votedCount === 0}
                className="h-10 px-5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold shrink-0 gap-2"
              >
                <Eye className="w-3.5 h-3.5" />
                Reveal
                {votedCount > 0 && (
                  <span className="font-mono text-violet-300 text-xs ml-0.5">{votedCount}/{totalCount}</span>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleReset}
                variant="ghost"
                className="h-10 px-5 text-zinc-400 hover:text-zinc-100 text-sm shrink-0 gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                New Round
              </Button>
            )}
          </div>

          {/* Voting cards */}
          {room?.phase === 'voting' && participantId && (
            <div className="flex flex-wrap justify-center gap-3">
              {CARD_VALUES.map((v) => (
                <PokerCard
                  key={v}
                  value={v}
                  selected={myVote === v}
                  onClick={() => handleVote(v)}
                />
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
                    <span className="text-[11px] text-zinc-600 font-mono tabular-nums">x{count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
