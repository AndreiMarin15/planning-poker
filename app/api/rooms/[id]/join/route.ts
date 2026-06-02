import { NextResponse } from 'next/server'
import { store } from '@/lib/store'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { name, avatarStyle } = await request.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  const result = store.joinRoom(id, name.trim(), avatarStyle?.trim())
  if (!result) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  return NextResponse.json(result)
}
