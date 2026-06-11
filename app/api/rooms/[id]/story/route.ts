import { NextResponse } from 'next/server'
import { store } from '@/lib/store'
import { publishRoom } from '@/lib/ably'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { story, jiraTicket, jiraLink, description } = await request.json()
  const room = await store.updateStory(id, story ?? '', jiraTicket ?? '', jiraLink ?? '', description ?? '')
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  publishRoom(room)
  return NextResponse.json({ room })
}
