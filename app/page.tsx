'use client'

import { useRef, useState, useEffect } from 'react'
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
import { Plus, X, Link2, ExternalLink, Upload, Unlink, HelpCircle } from 'lucide-react'
import Lottie from 'lottie-react'
import { extractJiraTicket, isJiraUrl } from '@/lib/jira'
import { AvatarPicker, DEFAULT_AVATAR } from '@/components/avatar'
import { cn } from '@/lib/utils'
import type { CardTemplate } from '@/lib/types'
import { CARD_TEMPLATES } from '@/lib/types'
import { useTheme, THEMES, type ThemeId } from '@/lib/theme'
import { parseImportFile, type DraftTopic } from '@/lib/import'
import { useJira, type JiraSprintIssue } from '@/lib/use-jira'
import { JiraPicker } from '@/components/jira-picker'

function setSession(roomId: string, pid: string) {
  const exp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `pp_${roomId}_pid=${encodeURIComponent(pid)}; expires=${exp}; path=/; SameSite=Strict`
  localStorage.setItem(`pp_${roomId}_pid`, pid)
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  const bigint = parseInt(normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized, 16)
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  }
}

function rgbToHsl(r: number, g: number, b: number) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) {
    return { h: 0, s: 0, l }
  }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) {
    h = (g - b) / d + (g < b ? 6 : 0)
  } else if (max === g) {
    h = (b - r) / d + 2
  } else {
    h = (r - g) / d + 4
  }
  return { h: (h * 60) % 360, s, l }
}

function shouldRecolorColor(color: number[]) {
  const [r, g, b] = color
  const { h, s, l } = rgbToHsl(r, g, b)
  return s > 0.4 && l > 0.2 && l < 0.95 && h >= 15 && h <= 65
}

function recolorLottie(animation: any, accentHex: string) {
  const { r, g, b } = hexToRgb(accentHex)
  const target = [r / 255, g / 255, b / 255]

  function walk(node: any) {
    if (!node || typeof node !== 'object') return
    for (const key of Object.keys(node)) {
      const value = node[key]
      if (key === 'c' && value && typeof value === 'object' && Array.isArray(value.k) && value.k.length >= 3) {
        const color = value.k.slice(0, 3)
        if (shouldRecolorColor(color)) {
          value.k = target
        }
      } else {
        walk(value)
      }
    }
  }

  const clone = JSON.parse(JSON.stringify(animation))
  walk(clone)
  return clone
}

export default function Home() {
  const router = useRouter()
  const { theme, themeId, setTheme } = useTheme()
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [showFaq, setShowFaq] = useState(false)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

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
  const [creatorRole, setCreatorRole] = useState<'voter' | 'facilitator'>('voter')
  const [showJiraPicker, setShowJiraPicker] = useState(false)
  const [jiraBaseUrl, setJiraBaseUrl] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  const jira = useJira('/')

  // Re-open create dialog after Jira OAuth redirect
  useEffect(() => {
    if (sessionStorage.getItem('pp_reopen_create') === '1') {
      sessionStorage.removeItem('pp_reopen_create')
      setShowCreate(true)
    }
  }, [])

  // Join state
  const [joinCode, setJoinCode] = useState('')
  const [joinName, setJoinName] = useState('')
  const [joinAvatar, setJoinAvatar] = useState(DEFAULT_AVATAR)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [mascotStage, setMascotStage] = useState<'initial' | 'walking'>('initial')
  const [mascotAnimation, setMascotAnimation] = useState<Record<string, any> | null>(null)
  const [mascotInitialData, setMascotInitialData] = useState<Record<string, any> | null>(null)
  const [mascotWalkingData, setMascotWalkingData] = useState<Record<string, any> | null>(null)
  const [platformSuggestion, setPlatformSuggestion] = useState('')
  const [suggestionOpen, setSuggestionOpen] = useState(false)

  useEffect(() => {
    let active = true

    Promise.all([
      fetch('/8d30521c-584a-40ba-b474-fc782887184a.json').then((res) => (res.ok ? res.json() : null)),
      fetch('/623c0a7b-addf-4999-8f10-079d22da4b76.json').then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([initialData, walkingData]) => {
        if (!active) return
        if (initialData) setMascotInitialData(initialData)
        if (walkingData) setMascotWalkingData(walkingData)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const data = mascotStage === 'walking' ? mascotWalkingData : mascotInitialData
    if (!data) return
    setMascotAnimation(recolorLottie(data, theme.accent))
  }, [theme.accent, mascotStage, mascotInitialData, mascotWalkingData])

  useEffect(() => {
    const timeout = mascotStage === 'walking' ? 16000 : 5000
    const timer = window.setTimeout(() => {
      setMascotStage((prev) => (prev === 'walking' ? 'initial' : 'walking'))
    }, timeout)

    return () => window.clearTimeout(timer)
  }, [mascotStage])

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

  function resolveJiraLink(ticket: string, existingLink?: string): string | undefined {
    if (existingLink) return existingLink
    const base = jiraBaseUrl.trim().replace(/\/+$/, '')
    if (!base || !ticket) return undefined
    const host = base.replace(/^https?:\/\//, '')
    return `https://${host}/browse/${ticket}`
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
          creatorRole,
          initialTopics: topics.map((t) => ({
            title: t.title,
            description: t.description || undefined,
            jiraTicket: t.jiraTicket || undefined,
            jiraLink: t.jiraTicket ? resolveJiraLink(t.jiraTicket, t.jiraLink || undefined) : undefined,
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
      setShowJiraPicker(false)
      setTopics([]); setNewJira(''); setNewLink(''); setNewTitle('')
    }
  }

  function handleJiraConnect() {
    sessionStorage.setItem('pp_reopen_create', '1')
    jira.connect()
  }

  function handleSendSuggestion() {
    const suggestion = platformSuggestion.trim()
    if (!suggestion) return

    const subject = encodeURIComponent('Planning Poker platform suggestion')
    const body = encodeURIComponent(`Suggestion:\n${suggestion}\n\nSent from the Planning Poker FAQ.`)
    window.location.href = `mailto:acapucion123@.com?subject=${subject}&body=${body}`
  }

  async function handleJiraPickerAdd(issues: JiraSprintIssue[]) {
    setTopics((prev) => [
      ...prev,
      ...issues.map((i) => ({
        id: crypto.randomUUID(),
        jiraTicket: i.key,
        jiraLink: i.url,
        title: i.summary,
        description: '',
      })),
    ])
    setShowJiraPicker(false)
  }

  const inputStyle = { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }
  const inputCls = 'text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-violet-500'
  const faqItems = [
    {
      question: 'How do I start a new session?',
      answer: 'Click Create Room, choose a name, and invite others with the generated room code.',
    },
    {
      question: 'Can I join without an account?',
      answer: 'Yes — just enter the room code and your display name to join.',
    },
    {
      question: 'What if I want to use Jira tickets?',
      answer: 'Add ticket IDs or URLs in the backlog when creating a room, or connect Jira to import issues.',
    },
    {
      question: 'Will the room stay online?',
      answer: 'Rooms are temporary and may reset when the server restarts, so save any important details before leaving.',
    },
  ]

  return (
    <div
      className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-6"
      data-pp-root
      style={{ '--accent': theme.accent, '--accent-hover': theme.hover, '--accent-muted': theme.muted, '--accent-ring': theme.ring } as React.CSSProperties}
    >
      <style>{`
        [data-pp-root] [class*="ring-violet"]:focus-visible,
        [data-pp-root] [class*="ring-violet"]:focus { --tw-ring-color: var(--accent-ring) !important; }

        .faq-float {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 3rem;
          min-height: 3rem;
          padding: 0 1rem;
          border-radius: 9999px;
          border: 1px solid rgba(255,255,255,0.14);
          background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
          backdrop-filter: blur(18px);
          transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
        }

        .faq-float:hover {
          transform: translateY(-2px) scale(1.03);
          border-color: rgba(129, 94, 255, 0.85);
          background: linear-gradient(180deg, rgba(124, 58, 237, 0.22), rgba(255,255,255,0.06));
        }

        .faq-float:hover svg {
          transform: translateX(1px) scale(1.05);
        }

        .faq-float svg {
          transition: transform 180ms ease;
        }

        .faq-item {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.02);
          border-radius: 1rem;
          padding: 0.9rem 1rem;
          transition: background 180ms ease, border-color 180ms ease;
        }

        .faq-item[open] {
          background: rgba(255,255,255,0.05);
          border-color: rgba(129,94,255,0.22);
        }

        .faq-item summary {
          list-style: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          color: #f8fafc;
        }

        .faq-item summary::-webkit-details-marker {
          display: none;
        }

        .faq-item summary:hover {
          color: #e5e7eb;
        }

        .faq-item p {
          margin: 0.75rem 0 0;
          color: #cbd5e1;
          line-height: 1.7;
        }

        .faq-answer {
          overflow: hidden;
          max-height: 0;
          opacity: 0;
          transform: translateY(-4px);
          transition: max-height 260ms ease, opacity 220ms ease, transform 260ms ease;
          will-change: max-height, opacity, transform;
        }

        .faq-item[open] .faq-answer {
          max-height: 10rem;
          opacity: 1;
          transform: translateY(0);
        }

        .faq-answer > p {
          margin-top: 0.75rem;
        }

        .faq-item .faq-chevron {
          transition: transform 180ms ease;
        }

        .faq-item[open] .faq-chevron {
          transform: rotate(180deg);
        }

        @keyframes mascot-enter {
          0% { opacity: 0; transform: translateX(-16px) translateY(12px); }
          100% { opacity: 1; transform: translateX(0) translateY(0); }
        }

        @keyframes mascot-walk {
          0% { opacity: 1; transform: translateX(0); }
          90% { opacity: 1; transform: translateX(calc(100vw - 9rem)); }
          100% { opacity: 0; transform: translateX(calc(100vw - 6rem)); }
        }
      `}</style>

      <div className="fixed right-4 bottom-4 z-30">
        <Button
          onClick={() => setShowFaq(true)}
          variant="outline"
          size="sm"
          className="faq-float text-zinc-100 border-transparent bg-transparent px-4 py-3 gap-2"
        >
          <HelpCircle className="w-4 h-4" />
          <span className="text-sm font-semibold">FAQ</span>
        </Button>
      </div>

      <div className="mb-10 text-center space-y-4">
        <div className="flex justify-center">
          <img src="/logo.svg" alt="Story Points" className="w-14 h-14" style={{ filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Story Points</h1>
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

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Your role</Label>
                <div className="flex gap-2">
                  {(['voter', 'facilitator'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setCreatorRole(r)}
                      className={cn(
                        'flex-1 flex flex-col gap-0.5 px-3 py-2 rounded-xl border text-left transition-all',
                        creatorRole === r ? 'border-zinc-700/50' : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600/60',
                      )}
                      style={creatorRole === r
                        ? { borderLeftColor: 'var(--accent)', borderLeftWidth: 3, backgroundColor: 'rgba(255,255,255,0.05)' }
                        : {}}
                    >
                      <span className="text-xs font-semibold capitalize" style={{ color: creatorRole === r ? '#ffffff' : '#d4d4d8' }}>
                        {r === 'voter' ? 'Voter' : 'Facilitator'}
                      </span>
                      <span className="text-[10px]" style={{ color: creatorRole === r ? '#a1a1aa' : '#71717a' }}>
                        {r === 'voter' ? 'Participates in voting' : 'Manages session, no vote'}
                      </span>
                    </button>
                  ))}
                </div>
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
                  {jira.status?.connected ? (
                    <>
                      <button
                        onClick={() => setShowJiraPicker(true)}
                        className="flex items-center gap-1 text-[10px] transition-colors"
                        style={{ color: 'var(--accent)' }}
                      >
                        <Link2 className="w-3 h-3" />
                        Browse Jira
                      </button>
                      <button
                        onClick={() => jira.disconnect()}
                        className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                        title="Disconnect Jira"
                      >
                        <Unlink className="w-3 h-3" />
                      </button>
                    </>
                  ) : jira.status !== null ? (
                    <button
                      onClick={handleJiraConnect}
                      className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      <Link2 className="w-3 h-3" />
                      Connect Jira
                    </button>
                  ) : null}
                  <button
                    onClick={() => importRef.current?.click()}
                    className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <Upload className="w-3 h-3" />
                    Import CSV / Excel
                  </button>
                </div>
              </div>

              {topics.some((t) => t.jiraTicket && !t.jiraLink) && (
                <div className="flex items-center gap-2">
                  <Link2 className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
                  <Input
                    placeholder="yourorg.atlassian.net — auto-links ticket keys"
                    value={jiraBaseUrl}
                    onChange={(e) => setJiraBaseUrl(e.target.value)}
                    className={`flex-1 h-8 text-xs ${inputCls}`}
                    style={inputStyle}
                  />
                </div>
              )}

              {topics.length > 0 && (
                <div className="space-y-1.5">
                  {topics.map((t, i) => {
                    const resolvedLink = t.jiraTicket ? resolveJiraLink(t.jiraTicket, t.jiraLink || undefined) : undefined
                    return (
                    <div key={t.id} className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-sm"
                      style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="text-zinc-600 text-[11px] font-mono w-4 shrink-0 pt-0.5">{i + 1}</span>
                      {t.jiraTicket && (
                        resolvedLink
                          ? <a href={resolvedLink} target="_blank" rel="noopener noreferrer"
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
                  )})}
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

      {showJiraPicker && (
        <JiraPicker onAdd={handleJiraPickerAdd} onClose={() => setShowJiraPicker(false)} />
      )}

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

      <Dialog open={showFaq} onOpenChange={setShowFaq}>
        <DialogContent className="border text-zinc-100 sm:max-w-lg"
          style={{ backgroundColor: '#172035', borderColor: 'rgba(255,255,255,0.08)' }}>
          <DialogHeader>
            <DialogTitle className="text-zinc-100 text-base">Frequently Asked Questions</DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm">Helpful tips for creating and joining sessions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm pt-1">
            {faqItems.map((item, index) => {
              const isOpen = openFaqIndex === index

              return (
                <div key={item.question} className="faq-item">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-3 text-left"
                  >
                    <span className="font-semibold">{item.question}</span>
                    <span className="faq-chevron text-zinc-400">▾</span>
                  </button>
                  <div className="faq-answer" style={{ maxHeight: isOpen ? '10rem' : 0, opacity: isOpen ? 1 : 0, transform: isOpen ? 'translateY(0)' : 'translateY(-4px)' }}>
                    <p>{item.answer}</p>
                  </div>
                </div>
              )
            })}
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <button
                type="button"
                onClick={() => setSuggestionOpen((prev) => !prev)}
                aria-expanded={suggestionOpen}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">Any suggestions?</h3>
                  <p className="text-xs text-zinc-500">Open this if you want to send an idea by email.</p>
                </div>
                <span className={`text-zinc-400 transition-transform ${suggestionOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {suggestionOpen && (
                <div className="mt-3 space-y-3">
                  <textarea
                    value={platformSuggestion}
                    onChange={(e) => setPlatformSuggestion(e.target.value)}
                    placeholder="Add a feature idea, improvement, or workflow suggestion..."
                    rows={4}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-[color:var(--accent-ring)] focus:ring-2 focus:ring-[color:var(--accent-ring)]/30"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleSendSuggestion}
                      disabled={!platformSuggestion.trim()}
                      className="text-white h-9 text-sm font-semibold"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      Send suggestion
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div
        className="pointer-events-none fixed left-4 bottom-4 z-20"
      >
        <div
          className="pointer-events-auto w-28 h-28 rounded-3xl bg-zinc-950/95 backdrop-blur-sm p-2"
          style={{
            animation: mascotStage === 'walking'
              ? 'mascot-enter 0.8s ease-out forwards, mascot-walk 16s linear 0.8s infinite'
              : 'mascot-enter 0.8s ease-out forwards',
            opacity: 0,
          }}
        >
          {mascotAnimation ? (
            <Lottie animationData={mascotAnimation} loop autoplay style={{ width: '100%', height: '100%' }} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
