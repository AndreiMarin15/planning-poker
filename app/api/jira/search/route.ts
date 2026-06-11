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

  async function runJql(jql: string, max = 15): Promise<JiraIssueRaw[]> {
    const url = `${base}?jql=${encodeURIComponent(jql)}&fields=${fields}&maxResults=${max}`
    try {
      const res = await fetch(url, { headers: auth!.headers })
      if (!res.ok) return []
      const data = await res.json()
      return data.issues ?? []
    } catch {
      return []
    }
  }

  // Pattern detection
  const exactKey = /^[A-Z][A-Z0-9_]+-\d+$/i.test(q)              // SPWALLET-353
  const projectPrefix = /^[A-Z][A-Z0-9_]+-\d*$/i.test(q) && !exactKey // SPWALLET- or SPWALLET-35
  const projectOnly = /^[A-Z][A-Z0-9_]+$/i.test(q)                // SPWALLET

  const safeQ = q.replace(/"/g, '')
  const projectKey = upper.split('-')[0]

  let queries: Promise<JiraIssueRaw[]>[]

  if (exactKey) {
    // Try key lookup + summary search in parallel
    queries = [
      runJql(`key = "${upper}"`),
      runJql(`summary ~ "${safeQ}*" ORDER BY updated DESC`),
    ]
  } else if (projectPrefix || projectOnly) {
    // Show issues from that project, newest first
    queries = [
      runJql(`project = "${projectKey}" ORDER BY issuekey DESC`, 20),
      runJql(`summary ~ "${safeQ}*" ORDER BY updated DESC`),
    ]
  } else {
    // Free-text summary search
    queries = [
      runJql(`summary ~ "${safeQ}*" ORDER BY updated DESC`),
    ]
  }

  const results = await Promise.all(queries)
  const seen = new Set<string>()
  const merged = results.flat().filter((i) => {
    const k = i.key as string
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  return NextResponse.json({ issues: merged.slice(0, 15).map((i) => mapIssue(i, auth!.session.cloud_url)) })
}
