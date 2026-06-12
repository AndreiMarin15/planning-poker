import { NextResponse } from 'next/server'
import { getValidJiraSession } from '@/lib/jira-session'

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const auth = await getValidJiraSession()
  if (!auth) return NextResponse.json({ error: 'not_connected' }, { status: 401 })

  const res = await fetch(
    `https://api.atlassian.com/ex/jira/${auth.session.cloud_id}/rest/api/3/issue/${key}?fields=summary,description,story_points,customfield_10016,customfield_10028,status,assignee,priority`,
    { headers: auth.headers }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return NextResponse.json({ error: 'jira_error', detail: err }, { status: res.status })
  }

  const data = await res.json()
  const fields = data.fields

  // Extract plain text from Atlassian Document Format description
  function adfToText(node: Record<string, unknown> | null): string {
    if (!node) return ''
    if (node.type === 'text') return (node.text as string) ?? ''
    if (Array.isArray(node.content)) return (node.content as Record<string, unknown>[]).map(adfToText).join('')
    return ''
  }

  return NextResponse.json({
    key: data.key,
    summary: fields.summary ?? '',
    description: adfToText(fields.description),
    storyPoints: fields.customfield_10016 ?? fields.customfield_10028 ?? null,
    status: fields.status?.name ?? null,
    assignee: fields.assignee?.displayName ?? null,
    priority: fields.priority?.name ?? null,
    url: `${auth.session.cloud_url}/browse/${data.key}`,
  })
}

// Write story points back to Jira
export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const auth = await getValidJiraSession()
  if (!auth) return NextResponse.json({ error: 'not_connected' }, { status: 401 })

  const { points } = await req.json()

  // Try the two most common story points fields
  for (const field of ['customfield_10016', 'customfield_10028']) {
    const res = await fetch(
      `https://api.atlassian.com/ex/jira/${auth.session.cloud_id}/rest/api/3/issue/${key}`,
      {
        method: 'PUT',
        headers: auth.headers,
        body: JSON.stringify({ fields: { [field]: Number(points) } }),
      }
    )
    if (res.ok || res.status === 204) return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'failed_to_update' }, { status: 500 })
}
