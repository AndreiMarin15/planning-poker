import { NextResponse } from 'next/server'
import { getJiraSession } from '@/lib/jira-session'

export async function GET() {
  const session = await getJiraSession()
  if (!session) return NextResponse.json({ connected: false })
  return NextResponse.json({
    connected: true,
    cloud_name: session.cloud_name,
    cloud_url: session.cloud_url,
  })
}
