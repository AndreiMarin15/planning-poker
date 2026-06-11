import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jiraStore } from '@/lib/jira-store'

export async function POST() {
  const cookieStore = await cookies()
  const sid = cookieStore.get('jira_sid')?.value
  if (sid) jiraStore.delete(sid)
  cookieStore.delete('jira_sid')
  return NextResponse.json({ ok: true })
}
