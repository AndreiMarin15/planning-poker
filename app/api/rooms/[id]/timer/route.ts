import { NextResponse } from 'next/server'
import { store } from '@/lib/store'
import { publishRoom } from '@/lib/ably'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { action, duration, autoReset } = await request.json()
  if (!['start', 'stop'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  const durationSec = Math.max(1, Math.min(3600, Number(duration) || 120))
  const room = await store.setTimer(id, durationSec, action, !!autoReset)
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  publishRoom(room)
  return NextResponse.json({ room })
}
