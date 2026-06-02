export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { store } from '@/lib/store'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const room = store.getRoom(id)
  if (!room) return new Response('Room not found', { status: 404 })

  const encoder = new TextEncoder()
  let unsubRoom: (() => void) | null = null
  let unsubEmoji: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch {}
      }
      const sendEmoji = (data: unknown) => {
        try { controller.enqueue(encoder.encode(`event: emoji\ndata: ${JSON.stringify(data)}\n\n`)) } catch {}
      }
      send(room)
      unsubRoom = store.subscribe(id, send)
      unsubEmoji = store.subscribeEmoji(id, sendEmoji)
    },
    cancel() {
      unsubRoom?.(); unsubEmoji?.()
    },
  })

  request.signal.addEventListener('abort', () => { unsubRoom?.(); unsubEmoji?.() })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
