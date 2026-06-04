import { NextResponse } from 'next/server'
import { store } from '@/lib/store'

export async function POST(request: Request) {
  const { roomName, creatorName, initialTopics, creatorAvatarStyle, cardTemplate } = await request.json()
  if (!roomName?.trim() || !creatorName?.trim()) {
    return NextResponse.json({ error: 'Room name and your name are required' }, { status: 400 })
  }
  const { room, participantId } = store.createRoom(
    roomName.trim(),
    creatorName.trim(),
    Array.isArray(initialTopics) ? initialTopics : [],
    creatorAvatarStyle?.trim(),
    cardTemplate === 'tshirt' ? 'tshirt' : 'fibonacci',
  )
  return NextResponse.json({ room, participantId })
}
