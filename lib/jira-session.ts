import { cookies } from 'next/headers'
import { jiraStore } from './jira-store'

export interface JiraSession {
  access_token: string
  refresh_token: string
  expires_at: number
  cloud_id: string
  cloud_name: string
  cloud_url: string
}

async function getSessionId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('jira_sid')?.value ?? null
}

export async function getJiraSession(): Promise<JiraSession | null> {
  const sid = await getSessionId()
  if (!sid) return null
  return jiraStore.get(sid)
}

export async function getValidJiraSession(): Promise<{ session: JiraSession; headers: Record<string, string> } | null> {
  const sid = await getSessionId()
  if (!sid) return null
  let session = jiraStore.get(sid)
  if (!session) return null

  if (session.expires_at - Date.now() < 5 * 60 * 1000) {
    const refreshed = await refreshJiraToken(session)
    if (!refreshed) return null
    jiraStore.set(sid, refreshed)
    session = refreshed
  }

  return {
    session,
    headers: { Authorization: `Bearer ${session.access_token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
  }
}

async function refreshJiraToken(session: JiraSession): Promise<JiraSession | null> {
  const res = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: process.env.JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      refresh_token: session.refresh_token,
    }),
  })
  if (!res.ok) return null
  const tokens = await res.json()
  return {
    ...session,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? session.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  }
}
