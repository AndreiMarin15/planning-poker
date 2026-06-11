import { NextResponse } from 'next/server'
import { mintToken } from '@/lib/ably'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!process.env.ABLY_API_KEY) {
    return NextResponse.json({ error: 'Ably not configured' }, { status: 503 })
  }
  const token = await mintToken(id)
  return NextResponse.json(token)
}
