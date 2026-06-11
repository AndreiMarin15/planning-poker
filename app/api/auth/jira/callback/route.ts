import { NextResponse } from 'next/server'
import { jiraStore } from '@/lib/jira-store'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?jira_error=${error ?? 'no_code'}`)
  }

  let returnTo = '/'
  try {
    if (state) returnTo = JSON.parse(Buffer.from(state, 'base64url').toString()).returnTo ?? '/'
  } catch { /* ignore malformed state */ }

  // Exchange code for tokens
  const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: process.env.JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/jira/callback`,
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    console.error('[jira callback] token exchange failed:', err)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?jira_error=token_exchange_failed`)
  }

  const tokens = await tokenRes.json()

  // Fetch accessible Jira cloud sites
  const sitesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
  })
  const sites = sitesRes.ok ? await sitesRes.json() : []
  const cloudId = sites[0]?.id ?? null
  const cloudName = sites[0]?.name ?? null
  const cloudUrl = sites[0]?.url ?? null

  const sessionId = crypto.randomUUID()
  jiraStore.set(sessionId, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
    cloud_id: cloudId,
    cloud_name: cloudName,
    cloud_url: cloudUrl,
  })

  const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}${returnTo}?jira_connected=1`)
  response.cookies.set('jira_sid', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 60,
    path: '/',
  })

  return response
}
