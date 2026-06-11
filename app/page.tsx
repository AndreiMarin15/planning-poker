'use client'

import { useRef, useState } from 'react'
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
import { Plus, X, Link2, ExternalLink, Upload } from 'lucide-react'
import { extractJiraTicket, isJiraUrl } from '@/lib/jira'
import { AvatarPicker, DEFAULT_AVATAR } from '@/components/avatar'
import { cn } from '@/lib/utils'
import type { CardTemplate } from '@/lib/types'
import { CARD_TEMPLATES } from '@/lib/types'
import { useTheme, THEMES, type ThemeId } from '@/lib/theme'
import { parseImportFile, type DraftTopic } from '@/lib/import'

function setSession(roomId: string, pid: string) {
  const exp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `pp_${roomId}_pid=${encodeURIComponent(pid)}; expires=${exp}; path=/; SameSite=Strict`
  localStorage.setItem(`pp_${roomId}_pid`, pid)
}

export default function Home() {
  const router = useRouter()
  const { theme, themeId, setTheme } = useTheme()
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)

  // Create state
  const [creatorName, setCreatorName] = useState('')
  const [creatorAvatar, setCreatorAvatar] = useState(DEFAULT_AVATAR)
  const [roomName, setRoomName] = useState('')
  const [creating, setCreating] = useState(false)
  const [topics, setTopics] = useState<DraftTopic[]>([])
  const [newJira, setNewJira] = useState('')
  const [newLink, setNewLink] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [cardTemplate, setCardTemplate] = useState<CardTemplate>('fibonacci')
  const importRef = useRef<HTMLInputElement>(null)

  // Join state
  const [joinCode, setJoinCode] = useState('')
  const [joinName, setJoinName] = useState('')
  const [joinAvatar, setJoinAvatar] = useState(DEFAULT_AVATAR)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  function handleLinkChange(value: string) {
    setNewLink(value)
    if (isJiraUrl(value)) {
      const ticket = extractJiraTicket(value)
      if (ticket && !newJira) setNewJira(ticket)
    }
  }

  function addTopic() {
    if (!newTitle.trim()) return
    setTopics((prev) => [
      ...prev,
      { id: crypto.randomUUID(), jiraTicket: newJira.trim(), jiraLink: newLink.trim(), title: newTitle.trim(), description: '' },
    ])
    setNewJira(''); setNewLink(''); setNewTitle('')
  }

  function removeTopic(id: string) {
    setTopics((prev) => prev.filter((t) => t.id !== id))
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const imported = await parseImportFile(file)
      if (imported.length === 0) return
      setTopics((prev) => [...prev, ...imported])
    } catch {
      // silently ignore parse errors
    }
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
          creatorAvatarStyle: creatorAvatar,
          cardTemplate,
          initialTopics: topics.map((t) => ({
            title: t.title,
            description: t.description || undefined,
            jiraTicket: t.jiraTicket || undefined,
            jiraLink: t.jiraLink || undefined,
          })),
        }),
      })
      const { room, participantId } = await res.json()
      setSession(room.id, participantId)
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
        body: JSON.stringify({ name: joinName.trim(), avatarStyle: joinAvatar }),
      })
      if (!res.ok) { setJoinError('Room not found. Check the code and try again.'); return }
      const { participantId } = await res.json()
      setSession(code, participantId)
      router.push(`/room/${code}`)
    } finally {
      setJoining(false)
    }
  }

  function handleCreateClose(open: boolean) {
    if (!open) {
      setShowCreate(false)
      setTopics([]); setNewJira(''); setNewLink(''); setNewTitle('')
    }
  }

  const inputStyle = { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }
  const inputCls = 'text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500'

  return (
    <div
      className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-6"
      data-pp-root
      style={{ '--accent': theme.accent, '--accent-hover': theme.hover, '--accent-muted': theme.muted, '--accent-ring': theme.ring } as React.CSSProperties}
    >
      <style>{`
        [data-pp-root] [class*="ring-violet"]:focus-visible,
        [data-pp-root] [class*="ring-violet"]:focus { --tw-ring-color: var(--accent-ring) !important; }
      `}</style>

      <div className="mb-10 text-center space-y-4">
        <div className="text-4xl font-black" style={{ color: 'var(--accent)' }}>◈</div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Planning Poker</h1>
          <p className="text-zinc-600 text-sm">Estimate together. Real-time, no account needed.</p>
        </div>
      </div>

      {/* Theme picker */}
      <div className="flex items-center gap-2 mb-6">
        {THEMES.map((t) => (
          <button
            key={t.id}
            title={t.label}
            onClick={() => setTheme(t.id as ThemeId)}
            className="w-4 h-4 rounded-full transition-transform hover:scale-125"
            style={{
              backgroundColor: t.accent,
              outline: themeId === t.id ? `2px solid ${t.accent}` : '2px solid transparent',
              outlineOffset: 2,
            }}
          />
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-[17rem]">
        <Button onClick={() => setShowCreate(true)} className="flex-1 text-white h-10 text-sm font-semibold" style={{ backgroundColor: 'var(--accent)' }}>
          Create Room
        </Button>
        <Button onClick={() => setShowJoin(true)} variant="outline" className="flex-1 border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 h-10 text-sm">
          Join to this Room bitches
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
            <DialogDescription className="text-zinc-500 text-sm">Start a new estimation session.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-1">
            {/* Name + avatar */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Your name</Label>
                  <Input placeholder="e.g. Alice" value={creatorName} onChange={(e) => setCreatorName(e.target.value)}
                    className={`h-9 text-sm ${inputCls}`} style={inputStyle} autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                    Room name <span className="text-zinc-700 normal-case font-normal tracking-normal">(opt.)</span>
                  </Label>
                  <Input placeholder="e.g. Sprint 42" value={roomName} onChange={(e) => setRoomName(e.target.value)}
                    className={`h-9 text-sm ${inputCls}`} style={inputStyle} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                  Avatar <span className="text-zinc-700 normal-case font-normal tracking-normal">(opt.)</span>
                </Label>
                <AvatarPicker name={creatorName} value={creatorAvatar} onChange={setCreatorAvatar} />
              </div>
            </div>

            <Separator style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

            {/* Card template */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Card template</Label>
              <div className="flex gap-2">
                {(Object.entries(CARD_TEMPLATES) as [CardTemplate, string[]][]).map(([key, vals]) => (
                  <button
                    key={key}
                    onClick={() => setCardTemplate(key)}
                    className={cn(
                      'flex-1 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border text-left transition-all',
                      cardTemplate === key ? 'border-zinc-700/50' : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600/60',
                    )}
                    style={cardTemplate === key
                      ? { borderLeftColor: 'var(--accent)', borderLeftWidth: 3, backgroundColor: 'rgba(255,255,255,0.05)' }
                      : {}}
                  >
                    <span className="text-xs font-semibold capitalize"
                      style={{ color: cardTemplate === key ? '#ffffff' : '#d4d4d8' }}>
                      {key === 'fibonacci' ? 'Fibonacci' : 'T-Shirt'}
                    </span>
                    <span className="text-[10px] font-mono"
                      style={{ color: cardTemplate === key ? '#a1a1aa' : '#71717a' }}>
                      {vals.slice(0, 5).join(' · ')}…
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Separator style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

            {/* Backlog */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Backlog</Label>
                <div className="flex items-center gap-3">
                  <input ref={importRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportFile} />
                  <button
                    onClick={() => importRef.current?.click()}
                    className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <Upload className="w-3 h-3" />
                    Import CSV / Excel
                  </button>
                </div>
              </div>

              {topics.length > 0 && (
                <div className="space-y-1.5">
                  {topics.map((t, i) => (
                    <div key={t.id} className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-sm"
                      style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="text-zinc-600 text-[11px] font-mono w-4 shrink-0 pt-0.5">{i + 1}</span>
                      {t.jiraTicket && (
                        t.jiraLink
                          ? <a href={t.jiraLink} target="_blank" rel="noopener noreferrer"
                              className="text-blue-400 font-mono text-[11px] font-bold shrink-0 hover:underline flex items-center gap-0.5 pt-0.5">
                              {t.jiraTicket}<ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </a>
                          : <span className="text-blue-400 font-mono text-[11px] font-bold shrink-0 pt-0.5">{t.jiraTicket}</span>
                      )}
                      <span className="text-zinc-300 flex-1 break-words leading-snug min-w-0">{t.title}</span>
                      <button onClick={() => removeTopic(t.id)} className="text-zinc-700 hover:text-zinc-400 transition-colors shrink-0 pt-0.5">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <Input placeholder="JIRA-123" value={newJira}
                    onChange={(e) => setNewJira(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && newTitle && addTopic()}
                    className={`w-28 h-8 text-xs font-mono uppercase ${inputCls}`} style={inputStyle} />
                  <Input placeholder="Story or task description" value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTopic()}
                    className={`flex-1 h-8 text-xs ${inputCls}`} style={inputStyle} />
                  <Button onClick={addTopic} disabled={!newTitle.trim()} size="sm" variant="ghost"
                    className="h-8 w-8 p-0 border shrink-0"
                    style={{ color: 'var(--accent)', borderColor: 'var(--accent)', backgroundColor: 'var(--accent-muted)' }}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Link2 className="w-3.5 h-3.5 text-zinc-700 shrink-0 ml-0.5" />
                  <Input placeholder="Jira URL (optional) — auto-fills ticket number" value={newLink}
                    onChange={(e) => handleLinkChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTopic()}
                    className={`flex-1 h-8 text-xs ${inputCls}`} style={inputStyle} />
                </div>
              </div>
            </div>

            <Separator style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

            <Button onClick={handleCreate} disabled={!creatorName.trim() || creating}
              className="w-full text-white h-10 text-sm font-semibold"
              style={{ backgroundColor: 'var(--accent)' }}>
              {creating ? 'Creating…' : `Create Room${topics.length > 0 ? ` · ${topics.length} topic${topics.length > 1 ? 's' : ''}` : ''}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Join dialog ─────────────────────────────────────────── */}
      <Dialog open={showJoin} onOpenChange={setShowJoin}>
        <DialogContent className="border text-zinc-100 sm:max-w-sm"
          style={{ backgroundColor: '#172035', borderColor: 'rgba(255,255,255,0.08)' }}>
          <DialogHeader>
            <DialogTitle className="text-zinc-100 text-base">Join a Room</DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm">Enter the room code shared with you.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Room code</Label>
              <Input placeholder="AB3X7Y" value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }}
                className={`h-10 text-sm font-mono tracking-[0.25em] uppercase ${inputCls}`}
                style={inputStyle} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Your name</Label>
              <Input placeholder="e.g. Bob" value={joinName} onChange={(e) => setJoinName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                className={`h-10 text-sm ${inputCls}`} style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                Avatar <span className="text-zinc-700 normal-case font-normal tracking-normal">(opt.)</span>
              </Label>
              <AvatarPicker name={joinName} value={joinAvatar} onChange={setJoinAvatar} />
            </div>
            {joinError && <p className="text-red-400 text-xs">{joinError}</p>}
            <Button onClick={handleJoin} disabled={!joinCode.trim() || !joinName.trim() || joining}
              className="w-full text-white h-10 text-sm font-semibold"
              style={{ backgroundColor: 'var(--accent)' }}>
              {joining ? 'Joining…' : 'Join Room'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <p className="mt-14 text-zinc-800 text-xs">Rooms reset on server restart.</p>
    </div>
  )
}
