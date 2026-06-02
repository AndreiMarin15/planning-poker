import { NextResponse } from 'next/server'
import { store } from '@/lib/store'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { participantId } = await request.json()
  if (!participantId) return NextResponse.json({ error: 'participantId required' }, { status: 400 })
  const room = store.removeParticipant(id, participantId)
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  return NextResponse.json({ room })
}
