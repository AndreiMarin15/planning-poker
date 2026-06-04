import { NextResponse } from 'next/server'
import { store } from '@/lib/store'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { title, jiraTicket, jiraLink, description } = await request.json()
  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })
  const room = store.addTopic(id, title.trim(), jiraTicket?.trim(), jiraLink?.trim(), description?.trim())
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  return NextResponse.json({ room })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { topicId } = await request.json()
  if (!topicId) return NextResponse.json({ error: 'topicId required' }, { status: 400 })
  const room = store.removeTopic(id, topicId)
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  return NextResponse.json({ room })
}
