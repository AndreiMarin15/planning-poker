import { Redis } from '@upstash/redis'
import type { JiraSession } from './jira-session'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const TTL = 60 * 60 * 8 // 8 hours

export const jiraStore = {
  async set(id: string, session: JiraSession) {
    await redis.set(`jira:${id}`, session, { ex: TTL })
  },
  async get(id: string): Promise<JiraSession | null> {
    return redis.get<JiraSession>(`jira:${id}`)
  },
  async delete(id: string) {
    await redis.del(`jira:${id}`)
  },
}
