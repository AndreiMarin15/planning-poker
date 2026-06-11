// Server-side in-memory Jira session store (keyed by session ID)
// Sessions survive the process lifetime but not restarts — users re-auth on redeploy.

import type { JiraSession } from './jira-session'

const sessions = new Map<string, JiraSession>()

export const jiraStore = {
  set(id: string, session: JiraSession) { sessions.set(id, session) },
  get(id: string): JiraSession | null { return sessions.get(id) ?? null },
  delete(id: string) { sessions.delete(id) },
}
