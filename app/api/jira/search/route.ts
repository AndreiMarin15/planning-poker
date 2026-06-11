import { NextResponse } from 'next/server'
import { getValidJiraSession } from '@/lib/jira-session'

type JiraIssueRaw = Record<string, unknown>

function mapIssue(issue: JiraIssueRaw, cloudUrl: string) {
  const fields = issue.fields as Record<string, unknown>
  return {
    key: issue.key as string,
    summary: (fields.summary as string) ?? '',
    status: (fields.status as { name: string } | null)?.name ?? null,
    priority: (fields.priority as { name: string } | null)?.name ?? null,
    storyPoints: (fields.customfield_10016 ?? fields.customfield_10028) as number | null,
    url: `${cloudUrl}/browse/${issue.key}`,
  }
}

export async function GET(req: Request) {
  const auth = await getValidJiraSession()
  if (!auth) return NextResponse.json({ error: 'not_connected' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ issues: [] })

  const upper = q.toUpperCase()
  const base = `https://api.atlassian.com/ex/jira/${auth.session.cloud_id}/rest/api/3/search/jql`
  const fields = 'summary,status,priority,customfield_10016,customfield_10028'

  async function runJql(jql: string, max = 10): Promise<JiraIssueRaw[]> {
    const url = `${base}?jql=${encodeURIComponent(jql)}&fields=${fields}&maxResults=${max}`
    const res = await fetch(url, { headers: auth!.headers })
    if (!res.ok) return []
    const data = await res.json()
    return data.issues ?? []
  }

  // Run key lookup and summary search in parallel
  const isKeyPattern = /^[A-Z][A-Z0-9_]+-\d+$/i.test(q)
  const [keyIssues, summaryIssues] = await Promise.all([
    isKeyPattern ? runJql(`key = "${upper}"`) : Promise.resolve([]),
    runJql(`summary ~ "${q.replace(/"/g, '')}*" ORDER BY updated DESC`),
  ])

  // Merge, dedup by key (key match first)
  const seen = new Set<string>()
  const merged = [...keyIssues, ...summaryIssues].filter((i) => {
    const k = i.key as string
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  return NextResponse.json({ issues: merged.slice(0, 15).map((i) => mapIssue(i, auth.session.cloud_url)) })
}
