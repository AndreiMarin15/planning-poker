import { NextResponse } from 'next/server'
import { store } from '@/lib/store'
import { getRest, channelName } from '@/lib/ably'
import type { EmojiThrow } from '@/lib/types'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!await store.getRoom(id)) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  const { fromId, fromName, toId, toName, emoji } = await request.json()
  const event: EmojiThrow = { id: crypto.randomUUID(), fromId, fromName, toId, toName, emoji }

  if (process.env.ABLY_API_KEY) {
    try {
      const channel = getRest().channels.get(channelName(id))
      await channel.publish('emoji', event)
    } catch {
      // fall back to Redis queue
      await store.pushEmoji(id, event)
    }
  } else {
    await store.pushEmoji(id, event)
  }

  return NextResponse.json({ ok: true })
}
