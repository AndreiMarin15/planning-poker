import { NextResponse } from 'next/server'
import { store } from '@/lib/store'
import { publishRoom } from '@/lib/ably'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { name, avatarStyle, role } = await request.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  const result = await store.joinRoom(id, name.trim(), avatarStyle?.trim(), role === 'facilitator' ? 'facilitator' : 'voter')
  if (!result) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  publishRoom(result.room)
  return NextResponse.json(result)
}
