import { NextResponse } from 'next/server'
import { getValidJiraSession } from '@/lib/jira-session'

export async function GET(req: Request) {
  const auth = await getValidJiraSession()
  if (!auth) return NextResponse.json({ error: 'not_connected' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ issues: [] })

  // Search by text or exact key match
  const jql = q.match(/^[A-Z][A-Z0-9_]+-\d+$/i)
    ? `key = "${q.toUpperCase()}"`
    : `text ~ "${q}" ORDER BY updated DESC`

  const res = await fetch(
    `https://api.atlassian.com/ex/jira/${auth.session.cloud_id}/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=summary,status,priority,customfield_10016,customfield_10028&maxResults=10`,
    { headers: auth.headers }
  )

  if (!res.ok) return NextResponse.json({ issues: [] })

  const data = await res.json()
  const issues = (data.issues ?? []).map((issue: Record<string, unknown>) => {
    const fields = issue.fields as Record<string, unknown>
    return {
      key: issue.key,
      summary: (fields.summary as string) ?? '',
      status: (fields.status as { name: string } | null)?.name ?? null,
      priority: (fields.priority as { name: string } | null)?.name ?? null,
      storyPoints: (fields.customfield_10016 ?? fields.customfield_10028) as number | null,
      url: `${auth.session.cloud_url}/browse/${issue.key}`,
    }
  })

  return NextResponse.json({ issues })
}
