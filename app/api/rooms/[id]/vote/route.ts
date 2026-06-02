import { NextResponse } from 'next/server'
import { store } from '@/lib/store'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { participantId, value } = await request.json()
  if (!participantId || value === undefined) {
    return NextResponse.json({ error: 'participantId and value are required' }, { status: 400 })
  }
  const room = store.castVote(id, participantId, value)
  if (!room) return NextResponse.json({ error: 'Room not found or voting closed' }, { status: 404 })
  return NextResponse.json({ room })
}
