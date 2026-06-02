'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Plus, X } from 'lucide-react'

interface DraftTopic {
  id: string
  jiraTicket: string
  title: string
}

export default function Home() {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)

  // Create state
  const [creatorName, setCreatorName] = useState('')
  const [roomName, setRoomName] = useState('')
  const [creating, setCreating] = useState(false)
  const [topics, setTopics] = useState<DraftTopic[]>([])
  const [newJira, setNewJira] = useState('')
  const [newTitle, setNewTitle] = useState('')

  // Join state
  const [joinCode, setJoinCode] = useState('')
  const [joinName, setJoinName] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  function addTopic() {
    if (!newTitle.trim()) return
    setTopics((prev) => [
      ...prev,
      { id: crypto.randomUUID(), jiraTicket: newJira.trim(), title: newTitle.trim() },
    ])
    setNewJira('')
    setNewTitle('')
  }

  function removeTopic(id: string) {
    setTopics((prev) => prev.filter((t) => t.id !== id))
  }

  async function handleCreate() {
    if (!creatorName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: roomName.trim() || `${creatorName.trim()}'s Room`,
          creatorName: creatorName.trim(),
          initialTopics: topics.map((t) => ({ title: t.title, jiraTicket: t.jiraTicket || undefined })),
        }),
      })
      const { room, participantId } = await res.json()
      localStorage.setItem(`pp_${room.id}_pid`, participantId)
      router.push(`/room/${room.id}`)
    } finally {
      setCreating(false)
    }
  }

  async function handleJoin() {
    if (!joinCode.trim() || !joinName.trim()) return
    setJoining(true)
    setJoinError('')
    try {
      const code = joinCode.trim().toUpperCase()
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: joinName.trim() }),
      })
      if (!res.ok) {
        setJoinError('Room not found. Check the code and try again.')
        return
      }
      const { participantId } = await res.json()
      localStorage.setItem(`pp_${code}_pid`, participantId)
      router.push(`/room/${code}`)
    } finally {
      setJoining(false)
    }
  }

  function handleCreateClose(open: boolean) {
    if (!open) {
      setShowCreate(false)
      setTopics([])
      setNewJira('')
      setNewTitle('')
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-6">
      <div className="mb-10 text-center space-y-4">
        <div className="text-4xl text-violet-400 font-black">◈</div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Planning Poker</h1>
          <p className="text-zinc-600 text-sm">Estimate together. Real-time, no account needed.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-[17rem]">
        <Button
          onClick={() => setShowCreate(true)}
          className="flex-1 bg-violet-600 hover:bg-violet-500 text-white h-10 text-sm font-semibold"
        >
          Create Room
        </Button>
        <Button
          onClick={() => setShowJoin(true)}
          variant="outline"
          className="flex-1 border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 h-10 text-sm"
        >
          Join Room
        </Button>
      </div>

      {/* ── Create dialog ──────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={handleCreateClose}>
        <DialogContent
          className="border text-zinc-100 sm:max-w-lg max-h-[90vh] overflow-y-auto"
          style={{ backgroundColor: '#172035', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <DialogHeader>
            <DialogTitle className="text-zinc-100 text-base">Create a Room</DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm">
              Start a new estimation session.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-1">
            {/* Name + Room */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                  Your name
                </Label>
                <Input
                  placeholder="e.g. Alice"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  className="h-9 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                  Room name <span className="text-zinc-700 normal-case font-normal tracking-normal">(opt.)</span>
                </Label>
                <Input
                  placeholder="e.g. Sprint 42"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="h-9 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }}
                />
              </div>
            </div>

            <Separator style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

            {/* Backlog */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                  Backlog
                </Label>
                <span className="text-[10px] text-zinc-700">optional — topics to vote on</span>
              </div>

              {/* Existing topics */}
              {topics.length > 0 && (
                <div className="space-y-1.5">
                  {topics.map((t, i) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <span className="text-zinc-600 text-[11px] font-mono w-4 shrink-0">{i + 1}</span>
                      {t.jiraTicket && (
                        <span className="text-blue-400 font-mono text-[11px] font-bold shrink-0">{t.jiraTicket}</span>
                      )}
                      <span className="text-zinc-300 flex-1 truncate">{t.title}</span>
                      <button
                        onClick={() => removeTopic(t.id)}
                        className="text-zinc-700 hover:text-zinc-400 transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new topic row */}
              <div className="flex gap-2">
                <Input
                  placeholder="JIRA-123"
                  value={newJira}
                  onChange={(e) => setNewJira(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && newTitle && addTopic()}
                  className="w-28 h-8 text-xs font-mono uppercase text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }}
                />
                <Input
                  placeholder="Story or task description"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTopic()}
                  className="flex-1 h-8 text-xs text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }}
                />
                <Button
                  onClick={addTopic}
                  disabled={!newTitle.trim()}
                  size="sm"
                  className="h-8 w-8 p-0 bg-violet-600/20 hover:bg-violet-600/40 text-violet-400 border border-violet-600/30 shrink-0"
                  variant="ghost"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <Separator style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

            <Button
              onClick={handleCreate}
              disabled={!creatorName.trim() || creating}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white h-10 text-sm font-semibold"
            >
              {creating ? 'Creating…' : `Create Room${topics.length > 0 ? ` · ${topics.length} topic${topics.length > 1 ? 's' : ''}` : ''}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Join dialog ─────────────────────────────────────────── */}
      <Dialog open={showJoin} onOpenChange={setShowJoin}>
        <DialogContent
          className="border text-zinc-100 sm:max-w-sm"
          style={{ backgroundColor: '#172035', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <DialogHeader>
            <DialogTitle className="text-zinc-100 text-base">Join a Room</DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm">
              Enter the room code shared with you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Room code</Label>
              <Input
                placeholder="AB3X7Y"
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }}
                className="h-10 text-sm font-mono tracking-[0.25em] uppercase text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Your name</Label>
              <Input
                placeholder="e.g. Bob"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                className="h-10 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }}
              />
            </div>
            {joinError && <p className="text-red-400 text-xs">{joinError}</p>}
            <Button
              onClick={handleJoin}
              disabled={!joinCode.trim() || !joinName.trim() || joining}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white h-10 text-sm font-semibold"
            >
              {joining ? 'Joining…' : 'Join Room'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <p className="mt-14 text-zinc-800 text-xs">Rooms reset on server restart.</p>
    </div>
  )
}
