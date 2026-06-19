'use client'

import { useEffect, useRef, useCallback } from 'react'
import Ably from 'ably'
import { toast } from 'sonner'
import type { Room, EmojiThrow } from '@/lib/types'

function animateEmoji(data: EmojiThrow, pid: string | null) {
  if (data.toId === pid) toast(`Someone threw ${data.emoji} at you!`, { duration: 2500 })

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

  const spin = fromLeft ? 1 : -1
  const t = (p: number) => `translate(${fromX + (toX - fromX) * p}px, ${fromY + (toY - fromY) * p + arcY * Math.sin(Math.PI * p)}px) translate(-50%,-50%)`
  el.animate(
    [
      { transform: `${t(0)} scale(0.4) rotate(${spin * 0}deg)`,     opacity: 0, offset: 0    },
      { transform: `${t(0.05)} scale(1.1) rotate(${spin * 30}deg)`, opacity: 1, offset: 0.05 },
      { transform: `${t(0.35)} scale(1.3) rotate(${spin * 130}deg)`,opacity: 1, offset: 0.35 },
      { transform: `${t(0.65)} scale(1.2) rotate(${spin * 230}deg)`,opacity: 1, offset: 0.65 },
      { transform: `${t(0.88)} scale(1.5) rotate(${spin * 310}deg)`,opacity: 1, offset: 0.88 },
      { transform: `${t(1)}    scale(0)   rotate(${spin * 360}deg)`, opacity: 0, offset: 1    },
    ],
    { duration: 1100, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)', fill: 'forwards' }
  ).onfinish = () => el.remove()
}

export function useRoomConnection({
  roomId,
  onUpdate,
  onRoomGone,
}: {
  roomId: string
  onUpdate: (room: Room) => void
  onRoomGone: () => void
}) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const ablyRef = useRef<Ably.Realtime | null>(null)
  const emojiSinceRef = useRef(Date.now())
  const seenEmojiIds = useRef(new Set<string>())

  const startPolling = useCallback((pid: string | null) => {
    if (pollRef.current) clearInterval(pollRef.current)
    let consecutive404 = 0

    async function poll() {
      try {
        const res = await fetch(`/api/rooms/${roomId}?since=${emojiSinceRef.current}`)
        if (!res.ok) {
          if (++consecutive404 >= 3) onRoomGone()
          return
        }
        consecutive404 = 0
        const { room: data, emojis } = await res.json()
        onUpdate(data)
        if (Array.isArray(emojis)) {
          for (const ev of emojis) {
            if (seenEmojiIds.current.has(ev.id)) continue
            seenEmojiIds.current.add(ev.id)
            emojiSinceRef.current = Math.max(emojiSinceRef.current, ev.ts ?? 0)
            animateEmoji(ev, pid)
          }
        }
      } catch {
        // network error — keep polling
      }
    }

    poll()
    pollRef.current = setInterval(poll, 5000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, onUpdate, onRoomGone])

  const startAbly = useCallback((pid: string | null) => {
    if (ablyRef.current) return

    const client = new Ably.Realtime({
      authUrl: `/api/rooms/${roomId}/ably-token`,
      authMethod: 'GET',
    })
    ablyRef.current = client

    const channel = client.channels.get(`room:${roomId.toUpperCase()}`)

    channel.subscribe('update', (msg) => {
      onUpdate(msg.data as Room)
    })

    channel.subscribe('emoji', (msg) => {
      const ev = msg.data as EmojiThrow & { ts?: number }
      if (seenEmojiIds.current.has(ev.id)) return
      seenEmojiIds.current.add(ev.id)
      animateEmoji(ev, pid)
    })

    client.connection.on('failed', () => {
      pollRef.current && clearInterval(pollRef.current)
      startPolling(pid)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, onUpdate, startPolling])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      ablyRef.current?.close()
      ablyRef.current = null
    }
  }, [])

  return { startAbly, startPolling }
}
