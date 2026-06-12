import { NextResponse } from 'next/server'
import { store } from '@/lib/store'

export async function POST(request: Request) {
  const { roomName, creatorName, initialTopics, creatorAvatarStyle, cardTemplate, creatorRole } = await request.json()
  if (!roomName?.trim() || !creatorName?.trim()) {
    return NextResponse.json({ error: 'Room name and your name are required' }, { status: 400 })
  }
  const { room, participantId } = await store.createRoom(
    roomName.trim(),
    creatorName.trim(),
    Array.isArray(initialTopics) ? initialTopics : [],
    creatorAvatarStyle?.trim(),
    cardTemplate === 'tshirt' ? 'tshirt' : 'fibonacci',
    creatorRole === 'facilitator' ? 'facilitator' : 'voter',
  )
  return NextResponse.json({ room, participantId })
}
