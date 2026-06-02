import { NextResponse } from 'next/server'
import { store } from '@/lib/store'
import type { EmojiThrow } from '@/lib/types'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!store.getRoom(id)) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  const { fromId, fromName, toId, toName, emoji } = await request.json()
  const event: EmojiThrow = { id: crypto.randomUUID(), fromId, fromName, toId, toName, emoji }
  store.throwEmoji(id, event)
  return NextResponse.json({ ok: true })
}
