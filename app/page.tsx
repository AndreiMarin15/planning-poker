'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export default function Home() {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)

  const [creatorName, setCreatorName] = useState('')
  const [roomName, setRoomName] = useState('')
  const [creating, setCreating] = useState(false)

  const [joinCode, setJoinCode] = useState('')
  const [joinName, setJoinName] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-6">
      <div className="mb-10 text-center space-y-4">
        <div className="text-4xl text-violet-400 font-black">◈</div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Planning Poker</h1>
          <p className="text-zinc-600 text-sm">
            Estimate together. Real-time, no account needed.
          </p>
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

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-zinc-900 border-zinc-800/60 text-zinc-100 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 text-base">Create a Room</DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm">
              Start a new estimation session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Your name</Label>
              <Input
                placeholder="e.g. Alice"
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                className="bg-zinc-800/60 border-zinc-700/60 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500 h-10 text-sm"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                Room name <span className="text-zinc-700 normal-case font-normal tracking-normal">(optional)</span>
              </Label>
              <Input
                placeholder="e.g. Sprint 42"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="bg-zinc-800/60 border-zinc-700/60 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500 h-10 text-sm"
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={!creatorName.trim() || creating}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white h-10 text-sm font-semibold"
            >
              {creating ? 'Creating…' : 'Create Room'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join dialog */}
      <Dialog open={showJoin} onOpenChange={setShowJoin}>
        <DialogContent className="bg-zinc-900 border-zinc-800/60 text-zinc-100 sm:max-w-sm">
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
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase())
                  setJoinError('')
                }}
                className="bg-zinc-800/60 border-zinc-700/60 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500 font-mono tracking-[0.25em] uppercase h-10 text-sm"
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
                className="bg-zinc-800/60 border-zinc-700/60 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500 h-10 text-sm"
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

      <p className="mt-14 text-zinc-800 text-xs">
        Rooms reset on server restart.
      </p>
    </div>
  )
}
