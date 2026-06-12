import { NextResponse } from 'next/server'
import { store } from '@/lib/store'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const room = await store.getRoom(id)
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  const since = Number(new URL(_req.url).searchParams.get('since') ?? 0)
  const emojis = await store.popEmojis(id, since)
  return NextResponse.json({ room, emojis })
}
