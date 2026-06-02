import { NextResponse } from 'next/server'
import { store } from '@/lib/store'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { story } = await request.json().catch(() => ({ story: '' }))
  const room = store.resetRound(id, story ?? '')
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  return NextResponse.json({ room })
}
