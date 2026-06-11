// Server-side in-memory Jira session store (keyed by session ID)
// Sessions survive the process lifetime but not restarts — users re-auth on redeploy.

import type { JiraSession } from './jira-session'

const g = globalThis as typeof globalThis & { __jiraSessions?: Map<string, JiraSession> }
if (!g.__jiraSessions) g.__jiraSessions = new Map<string, JiraSession>()
const sessions = g.__jiraSessions

export const jiraStore = {
  set(id: string, session: JiraSession) { sessions.set(id, session) },
  get(id: string): JiraSession | null { return sessions.get(id) ?? null },
  delete(id: string) { sessions.delete(id) },
}
