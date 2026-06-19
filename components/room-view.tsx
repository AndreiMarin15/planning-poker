'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Room, ParticipantTeam } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Copy, Check, LogOut,
  Link2, LayoutList, History, Table2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { extractJiraTicket, isJiraUrl } from '@/lib/jira'
import { parseImportFile } from '@/lib/import'
import { AvatarPicker, DEFAULT_AVATAR, type AvatarStyleId } from '@/components/avatar'
import { SidebarHistoryPanel } from '@/components/room/history-panel'
import { SidebarQueuePanel } from '@/components/room/queue-panel'
import { JoinDialog } from '@/components/room/join-dialog'
import { useRoomStore } from '@/lib/room-store'
import { useRoomConnection } from '@/hooks/use-room-connection'
import { useEmojiThrow } from '@/hooks/use-emoji-throw'
import { useTheme, THEMES, type ThemeId } from '@/lib/theme'
import { useJira } from '@/lib/use-jira'
import { JiraPicker } from '@/components/jira-picker'
import { PokerTable } from '@/components/room/poker-table'

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
  const [joinTeam, setJoinTeam] = useState<ParticipantTeam | undefined>(undefined)
  const [joining, setJoining] = useState(false)

  // Sidebar drag-resize
  const [sidebarWidth, setSidebarWidth] = useState(288)
  const sidebarDragRef = useRef(false)

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ── Timer UI state ────────────────────────────────────────────────────────────
  const [showTimerPanel, setShowTimerPanel] = useState(false)
  const [timerMinutes, setTimerMinutes] = useState(2)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [autoReset, setAutoReset] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  useEffect(() => {
    const t = room?.timer
    if (!t?.startedAt) { setCountdown(null); return }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - t.startedAt!) / 1000)
      const remaining = t.duration - elapsed
      setCountdown(remaining > 0 ? remaining : 0)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [room?.timer])

  const handleTimerAction = async (action: 'start' | 'stop') => {
    if (!room) return
    const duration = timerMinutes * 60 + timerSeconds
    await fetch(`/api/rooms/${room.id}/timer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, duration: action === 'start' ? duration : undefined, autoReset }),
    })
  }

  const timerRunning = !!room?.timer?.startedAt && countdown !== null && countdown > 0
  const timerDone   = countdown === 0

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

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

  // Sync myVote with server state: set on reconnect, clear when round resets.
  // While voteInflightRef is set the user has a pending local selection —
  // ignore server updates until the server catches up to that exact value.
  useEffect(() => {
    if (!participantId || !room) return
    const serverVote = room.votes[participantId]
    if (room.phase === 'voting') {
      if (voteInflightRef.current !== null) {
        if (serverVote === voteInflightRef.current) voteInflightRef.current = null
        // else: server is behind — keep the optimistic value, don't sync
      } else {
        if (serverVote) setMyVote(serverVote)
        else setMyVote(undefined)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.phase, participantId, room?.votes[participantId ?? '']])

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

  // ── Emoji throw ───────────────────────────────────────────────────────────────

  const { lastEmoji, handleThrowOrPicker, EmojiPickerPortal } = useEmojiThrow(
    async (target, emoji) => {
      if (!participantId) return
      await fetch(`/api/rooms/${roomId}/emoji`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromId: participantId, fromName: '', toId: target.id, toName: target.name, emoji }),
      })
    }
  )

  // Sidebar drag resize
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!sidebarDragRef.current) return
      const w = window.innerWidth - e.clientX
      setSidebarWidth(Math.max(220, Math.min(640, w)))
    }
    function onUp() { sidebarDragRef.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])


  // Story details toggle (jira url + description collapsed by default)
  const [showStoryDetails, setShowStoryDetails] = useState(false)

  // Add-topic form
  const [showAddTopic, setShowAddTopic] = useState(false)
  const [newTopicJira, setNewTopicJira] = useState('')
  const [newTopicLink, setNewTopicLink] = useState('')
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [newTopicDescription, setNewTopicDescription] = useState('')

  const storyRef = useRef<HTMLInputElement>(null)
  const sidebarImportRef = useRef<HTMLInputElement>(null)
  // Tracks the last vote the user clicked. Cleared once the server confirms it.
  // Prevents stale API responses from reverting optimistic UI during rapid clicking.
  const voteInflightRef = useRef<string | null>(null)

  const [myVote, setMyVote] = useState<string | undefined>(undefined)
  const isModerator = room && participantId ? room.moderatorId === participantId : false
  const myParticipant = room && participantId ? room.participants.find((p) => p.id === participantId) : null
  const isFacilitator = myParticipant?.role === 'facilitator'
  const canManage = isModerator || isFacilitator

  // ── Room update handler (shared by Ably and polling) ─────────────────────────

  const applyRoomUpdate = useCallback((data: Room) => {
    setRoom(data)
    setRoomGone(false)
    if (!storyFocusedRef.current) {
      setStory(data.story)
      setJiraTicket(data.jiraTicket ?? '')
      setJiraLink(data.jiraLink ?? '')
      setStoryDescription(data.storyDescription ?? '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setRoom])

  // ── Real-time connection (Ably + polling fallback) ────────────────────────────

  const { startAbly, startPolling } = useRoomConnection({
    roomId,
    onUpdate: applyRoomUpdate,
    onRoomGone: () => setRoomGone(true),
  })

  useEffect(() => {
    const pid = getSession(roomId)
    async function init() {
      const res = await fetch(`/api/rooms/${roomId}`).catch(() => null)
      if (!res?.ok) { setRoomGone(true); return }
      const { room: data } = await res.json()
      applyRoomUpdate(data)
      if (pid) setParticipantId(pid)
      else setShowJoinDialog(true)
      startAbly(pid)
      startPolling(pid)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleJoin() {
    if (!joinName.trim()) return
    setJoining(true)
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: joinName.trim(), avatarStyle: joinAvatar, role: joinRole, team: joinTeam }),
      })
      if (!res.ok) { toast.error('Room not found'); router.push('/'); return }
      const { participantId: pid, room: r } = await res.json()
      setSession(roomId, pid)
      setParticipantId(pid); setRoom(r)
      setStory(r.story); setJiraTicket(r.jiraTicket ?? '')
      setJiraLink(r.jiraLink ?? ''); setStoryDescription(r.storyDescription ?? '')
      setShowJoinDialog(false); startPolling(pid)
    } finally { setJoining(false) }
  }

  async function handleVote(value: string) {
    if (!participantId || room?.phase !== 'voting' || isFacilitator) return
    voteInflightRef.current = value
    setMyVote(value)
    fetch(`/api/rooms/${roomId}/vote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, value }),
    })
  }

  async function handleReveal() {
    const res = await fetch(`/api/rooms/${roomId}/reveal`, { method: 'POST' })
    const { room: revealed } = await res.json().catch(() => ({ room: null }))
    if (!revealed) return
    setRoom(revealed)
    if (!jira.status?.connected || !jiraTicket) return
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
    setRoom(r)
    setStory(r.story ?? ''); setJiraTicket(r.jiraTicket ?? '')
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
    setRoom(r)
    setStory(r.story); setJiraTicket(r.jiraTicket ?? '')
    setJiraLink(r.jiraLink ?? ''); setStoryDescription(r.storyDescription ?? '')
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

  // ── Shared queue/history panel props ──────────────────────────────────────────

  const queueProps = {
    room, isModerator: canManage,
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

  const pokerTableProps = {
    room: room!,
    participantId,
    isMobile,
    lastEmoji,
    onThrowOrPicker: handleThrowOrPicker,
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
    onTimerMinutesChange: setTimerMinutes,
    onTimerSecondsChange: setTimerSeconds,
    onAutoResetToggle: () => setAutoReset((v) => !v),
    onTimerAction: handleTimerAction,
    onCloseTimerPanel: () => setShowTimerPanel(false),
    onToggleTimerPanel: () => setShowTimerPanel((v) => !v),
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
    onStoryBlur: handleStoryBlur,
    onLinkChange: handleLinkChange,
    showStoryDetails,
    onToggleStoryDetails: () => setShowStoryDetails((v) => !v),
    jiraConnected: !!jira.status?.connected,
    jiraSearch,
    setJiraSearch,
    jiraSearchOpen,
    setJiraSearchOpen,
    jiraSearchLoading,
    jiraSearchResults,
    onReveal: handleReveal,
    onReset: handleReset,
    onVote: handleVote,
  }

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
      {EmojiPickerPortal}

      {/* Join dialog */}
      <JoinDialog
        open={showJoinDialog}
        roomName={room?.name}
        joinName={joinName} setJoinName={setJoinName}
        joinAvatar={joinAvatar} setJoinAvatar={setJoinAvatar}
        joinRole={joinRole} setJoinRole={setJoinRole}
        joinTeam={joinTeam} setJoinTeam={setJoinTeam}
        joining={joining}
        onJoin={handleJoin}
      />

      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-md shrink-0"
        style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/logo.svg" alt="Story Points" className="w-5 h-5 shrink-0" style={{ filter: 'brightness(0) invert(1)', opacity: 0.85 }} />
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
              <PokerTable {...pokerTableProps} />
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
          <nav className="shrink-0 flex pb-safe" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
            {([
              { id: 'table' as const, label: 'Table', Icon: Table2, badge: undefined },
              { id: 'queue' as const, label: 'Queue', Icon: LayoutList, badge: room?.topics.length },
              { id: 'history' as const, label: 'History', Icon: History, badge: room?.history.length },
            ]).map(({ id, label, Icon, badge }) => (
              <button
                key={id}
                onClick={() => setMobileTab(id)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-semibold transition-colors',
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
          <PokerTable {...pokerTableProps} />
        </main>

        {/* Sidebar drag handle */}
        <div
          className="hidden lg:block w-1 shrink-0 cursor-col-resize relative group"
          style={{ backgroundColor: 'var(--border)' }}
          onMouseDown={(e) => { sidebarDragRef.current = true; e.preventDefault() }}
        >
          <div className="absolute inset-0 group-hover:bg-violet-500/40 transition-colors" />
        </div>

        <aside
          className="hidden lg:flex flex-col shrink-0 overflow-hidden"
          style={{ width: sidebarWidth, backgroundColor: 'var(--surface)' }}
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


