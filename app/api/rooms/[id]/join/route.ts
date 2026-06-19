import { NextResponse } from 'next/server'
import { store } from '@/lib/store'
import { publishRoom } from '@/lib/ably'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { name, avatarStyle, role, team } = await request.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  const validTeam = team === 'dev' || team === 'qa' ? team : undefined
  const result = await store.joinRoom(id, name.trim(), avatarStyle?.trim(), role === 'facilitator' ? 'facilitator' : 'voter', validTeam)
  if (!result) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  publishRoom(result.room)
  return NextResponse.json(result)
}
