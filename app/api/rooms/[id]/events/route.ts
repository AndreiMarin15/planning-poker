// SSE replaced by client polling — this endpoint is no longer used
export async function GET() {
  return new Response('Gone', { status: 410 })
}
