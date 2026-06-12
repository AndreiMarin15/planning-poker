import { NextResponse } from 'next/server'
import { getValidJiraSession } from '@/lib/jira-session'

export async function GET(req: Request) {
  const auth = await getValidJiraSession()
  if (!auth) return NextResponse.json({ error: 'not_connected' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectKey = searchParams.get('project')

  // Search for issues in active sprint
  const jql = projectKey
    ? `project = "${projectKey}" AND sprint in openSprints() ORDER BY rank ASC`
    : `sprint in openSprints() ORDER BY rank ASC`

  const res = await fetch(
    `https://api.atlassian.com/ex/jira/${auth.session.cloud_id}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=summary,customfield_10016,customfield_10028,status,priority&maxResults=50`,
    { headers: auth.headers }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return NextResponse.json({ error: 'jira_error', detail: err }, { status: res.status })
  }

  const data = await res.json()
  const issues = (data.issues ?? []).map((issue: Record<string, unknown>) => {
    const fields = issue.fields as Record<string, unknown>
    return {
      key: issue.key,
      summary: (fields.summary as string) ?? '',
      storyPoints: (fields.customfield_10016 ?? fields.customfield_10028) as number | null,
      status: (fields.status as { name: string } | null)?.name ?? null,
      priority: (fields.priority as { name: string } | null)?.name ?? null,
      url: `${auth.session.cloud_url}/browse/${issue.key}`,
    }
  })

  return NextResponse.json({ issues, total: data.total })
}
