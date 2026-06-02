import { NextResponse } from 'next/server'
import { store } from '@/lib/store'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const room = store.getRoom(id)
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  return NextResponse.json({ room })
}
