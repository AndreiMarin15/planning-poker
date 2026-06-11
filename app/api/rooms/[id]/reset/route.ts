import { NextResponse } from 'next/server'
import { store } from '@/lib/store'
import { publishRoom } from '@/lib/ably'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await request.json().catch(() => ({}))
  const room = await store.resetRound(id)
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  publishRoom(room)
  return NextResponse.json({ room })
}
