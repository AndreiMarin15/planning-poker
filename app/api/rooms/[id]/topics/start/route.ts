import { NextResponse } from 'next/server'
import { store } from '@/lib/store'
import { publishRoom } from '@/lib/ably'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { topicId } = await request.json()
  if (!topicId) return NextResponse.json({ error: 'topicId required' }, { status: 400 })
  const room = await store.startTopic(id, topicId)
  if (!room) return NextResponse.json({ error: 'Room or topic not found' }, { status: 404 })
  publishRoom(room)
  return NextResponse.json({ room })
}
