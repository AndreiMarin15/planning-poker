import { redirect } from 'next/navigation'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const returnTo = searchParams.get('returnTo') ?? '/'

  const clientId = process.env.JIRA_CLIENT_ID
  if (!clientId) return new Response('JIRA_CLIENT_ID not configured', { status: 500 })

  const state = Buffer.from(JSON.stringify({ returnTo, nonce: crypto.randomUUID() })).toString('base64url')

  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: clientId,
    scope: 'read:jira-work write:jira-work offline_access',
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/jira/callback`,
    state,
    response_type: 'code',
    prompt: 'consent',
  })

  redirect(`https://auth.atlassian.com/authorize?${params}`)
}
