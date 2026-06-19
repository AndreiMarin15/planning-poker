import { NextResponse } from 'next/server'
import { store } from '@/lib/store'

export async function POST(request: Request) {
  const { roomName, creatorName, initialTopics, creatorAvatarStyle, cardTemplate, creatorRole, creatorTeam } = await request.json()
  if (!roomName?.trim() || !creatorName?.trim()) {
    return NextResponse.json({ error: 'Room name and your name are required' }, { status: 400 })
  }
  const validCreatorTeam = creatorTeam === 'dev' || creatorTeam === 'qa' ? creatorTeam : undefined
  const { room, participantId } = await store.createRoom(
    roomName.trim(),
    creatorName.trim(),
    Array.isArray(initialTopics) ? initialTopics : [],
    creatorAvatarStyle?.trim(),
    cardTemplate === 'tshirt' ? 'tshirt' : 'fibonacci',
    creatorRole === 'facilitator' ? 'facilitator' : 'voter',
    validCreatorTeam,
  )
  return NextResponse.json({ room, participantId })
}
