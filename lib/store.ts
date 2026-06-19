import { Redis } from '@upstash/redis'
import type { Room, Participant, Topic, HistoryEntry, EmojiThrow, CardTemplate, ParticipantTeam } from './types'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const ROOM_TTL = 60 * 60 * 24 // 24 hours
const EMOJI_TTL = 30 // seconds

function roomKey(id: string) { return `room:${id.toUpperCase()}` }
function emojiKey(id: string) { return `room:${id.toUpperCase()}:emojis` }

function randomId(length = 6): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function saveRoom(room: Room): Promise<void> {
  await redis.set(roomKey(room.id), room, { ex: ROOM_TTL })
}

function teamAvg(pids: string[], votes: Record<string, string>): string | undefined {
  const nums = pids.map((id) => votes[id]).filter(Boolean).map(Number).filter((n) => !isNaN(n))
  if (nums.length === 0) return undefined
  return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)
}

function buildHistoryEntry(room: Room): HistoryEntry {
  const voteValues = Object.values(room.votes)
  const nums = voteValues.map(Number).filter((n) => !isNaN(n))
  const average = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '—'
  const consensus = new Set(voteValues).size === 1 && voteValues.length > 0 ? voteValues[0] : null

  const devPids = room.participants.filter((p) => p.team === 'dev').map((p) => p.id)
  const qaPids = room.participants.filter((p) => p.team === 'qa').map((p) => p.id)
  const devAverage = teamAvg(devPids, room.votes)
  const qaAverage = teamAvg(qaPids, room.votes)

  const participantTeams = Object.fromEntries(
    room.participants.filter((p) => p.team).map((p) => [p.id, p.team!])
  ) as Record<string, ParticipantTeam>

  const duration = room.roundStartedAt ? Math.round((Date.now() - room.roundStartedAt) / 1000) : undefined

  return {
    id: crypto.randomUUID(),
    story: room.story,
    description: room.storyDescription,
    jiraTicket: room.jiraTicket,
    jiraLink: room.jiraLink,
    votes: { ...room.votes },
    participantNames: Object.fromEntries(room.participants.map((p) => [p.id, p.name])),
    participantTeams: Object.keys(participantTeams).length > 0 ? participantTeams : undefined,
    consensus,
    average,
    devAverage,
    qaAverage,
    completedAt: Date.now(),
    duration,
  }
}

export const store = {
  async getRoom(id: string): Promise<Room | null> {
    return redis.get<Room>(roomKey(id))
  },

  async createRoom(
    roomName: string,
    creatorName: string,
    initialTopics: Array<{ title: string; description?: string; jiraTicket?: string; jiraLink?: string }> = [],
    creatorAvatarStyle?: string,
    cardTemplate: CardTemplate = 'fibonacci',
    creatorRole: 'voter' | 'facilitator' = 'voter',
    creatorTeam?: ParticipantTeam,
  ): Promise<{ room: Room; participantId: string }> {
    const roomId = randomId()
    const participantId = crypto.randomUUID()
    const participant: Participant = { id: participantId, name: creatorName, avatarStyle: creatorAvatarStyle, role: creatorRole === 'facilitator' ? 'facilitator' : undefined, team: creatorTeam }

    const topics: Topic[] = initialTopics.map((t) => ({
      id: crypto.randomUUID(),
      title: t.title,
      description: t.description || undefined,
      jiraTicket: t.jiraTicket || undefined,
      jiraLink: t.jiraLink || undefined,
    }))

    let story = ''
    let jiraTicket: string | undefined
    let jiraLink: string | undefined
    let storyDescription: string | undefined
    let currentTopicId: string | undefined
    if (topics.length > 0) {
      story = topics[0].title
      jiraTicket = topics[0].jiraTicket
      jiraLink = topics[0].jiraLink
      storyDescription = topics[0].description
      currentTopicId = topics[0].id
    }

    const room: Room = {
      id: roomId,
      name: roomName,
      story,
      storyDescription,
      jiraTicket,
      jiraLink,
      topics,
      currentTopicId,
      history: [],
      participants: [participant],
      votes: {},
      phase: 'voting',
      moderatorId: participantId,
      cardTemplate,
      createdAt: Date.now(),
      roundStartedAt: Date.now(),
    }
    await saveRoom(room)
    return { room, participantId }
  },

  async joinRoom(roomId: string, name: string, avatarStyle?: string, role?: 'voter' | 'facilitator', team?: ParticipantTeam): Promise<{ room: Room; participantId: string } | null> {
    const room = await store.getRoom(roomId)
    if (!room) return null
    const existing = room.participants.find((p) => p.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      const needsUpdate = (avatarStyle && avatarStyle !== existing.avatarStyle) || (team !== undefined && team !== existing.team)
      if (needsUpdate) {
        const updated: Room = {
          ...room,
          participants: room.participants.map((p) =>
            p.id === existing.id ? { ...p, ...(avatarStyle ? { avatarStyle } : {}), ...(team !== undefined ? { team } : {}) } : p,
          ),
        }
        await saveRoom(updated)
        return { room: updated, participantId: existing.id }
      }
      return { room, participantId: existing.id }
    }
    const participantId = crypto.randomUUID()
    const participant: Participant = { id: participantId, name, avatarStyle, role: role ?? 'voter', team }
    const updated: Room = { ...room, participants: [...room.participants, participant] }
    await saveRoom(updated)
    return { room: updated, participantId }
  },

  async castVote(roomId: string, participantId: string, value: string): Promise<Room | null> {
    const room = await store.getRoom(roomId)
    if (!room || room.phase !== 'voting') return null
    const updated: Room = { ...room, votes: { ...room.votes, [participantId]: value } }
    await saveRoom(updated)
    return updated
  },

  async revealVotes(roomId: string): Promise<Room | null> {
    const room = await store.getRoom(roomId)
    if (!room) return null
    const entry = buildHistoryEntry(room)
    // Remove the current topic from the queue only now (it was actually voted on)
    const topics = room.currentTopicId
      ? room.topics.filter((t) => t.id !== room.currentTopicId)
      : room.topics
    const updated: Room = {
      ...room,
      phase: 'revealed',
      history: [...room.history, entry],
      topics,
      currentTopicId: undefined,
    }
    await saveRoom(updated)
    return updated
  },

  async resetRound(roomId: string): Promise<Room | null> {
    const room = await store.getRoom(roomId)
    if (!room) return null

    // After reveal, currentTopicId is already cleared and that topic removed from queue.
    // If there are remaining topics, advance to the first one (keep it in queue).
    // If no topics, start a free-form new round (clear story).
    let nextStory = room.story
    let nextJira = room.jiraTicket
    let nextLink = room.jiraLink
    let nextDesc = room.storyDescription
    let nextCurrentTopicId = room.currentTopicId

    if (room.topics.length > 0) {
      const next = room.topics[0]
      nextStory = next.title
      nextJira = next.jiraTicket
      nextLink = next.jiraLink
      nextDesc = next.description
      nextCurrentTopicId = next.id
    } else {
      nextStory = ''
      nextJira = undefined
      nextLink = undefined
      nextDesc = undefined
      nextCurrentTopicId = undefined
    }

    const resetTimer = room.timer?.autoReset
      ? { ...room.timer, startedAt: undefined }
      : room.timer
    const updated: Room = {
      ...room,
      phase: 'voting',
      votes: {},
      story: nextStory,
      storyDescription: nextDesc,
      jiraTicket: nextJira,
      jiraLink: nextLink,
      currentTopicId: nextCurrentTopicId,
      roundStartedAt: Date.now(),
      timer: resetTimer,
    }
    await saveRoom(updated)
    return updated
  },

  async updateStory(roomId: string, story: string, jiraTicket: string, jiraLink: string, description?: string): Promise<Room | null> {
    const room = await store.getRoom(roomId)
    if (!room) return null
    const updated: Room = {
      ...room,
      story,
      storyDescription: description || undefined,
      jiraTicket: jiraTicket || undefined,
      jiraLink: jiraLink || undefined,
    }
    await saveRoom(updated)
    return updated
  },

  async addTopic(roomId: string, title: string, jiraTicket?: string, jiraLink?: string, description?: string): Promise<Room | null> {
    const room = await store.getRoom(roomId)
    if (!room) return null
    const topic: Topic = {
      id: crypto.randomUUID(),
      title,
      description: description || undefined,
      jiraTicket: jiraTicket || undefined,
      jiraLink: jiraLink || undefined,
    }
    const isFirst = room.topics.length === 0 && !room.currentTopicId && !room.story.trim()
    const updated: Room = {
      ...room,
      topics: [...room.topics, topic],
      ...(isFirst ? {
        story: topic.title,
        storyDescription: topic.description,
        jiraTicket: topic.jiraTicket,
        jiraLink: topic.jiraLink,
        currentTopicId: topic.id,
      } : {}),
    }
    await saveRoom(updated)
    return updated
  },

  async removeTopic(roomId: string, topicId: string): Promise<Room | null> {
    const room = await store.getRoom(roomId)
    if (!room) return null
    const updated: Room = { ...room, topics: room.topics.filter((t) => t.id !== topicId) }
    await saveRoom(updated)
    return updated
  },

  async startTopic(roomId: string, topicId: string): Promise<Room | null> {
    const room = await store.getRoom(roomId)
    if (!room) return null
    const topic = room.topics.find((t) => t.id === topicId)
    if (!topic) return null
    // Keep topic in queue — it's only removed when votes are actually revealed
    const resetTimer = room.timer?.autoReset
      ? { ...room.timer, startedAt: undefined }
      : room.timer
    const updated: Room = {
      ...room,
      story: topic.title,
      storyDescription: topic.description,
      jiraTicket: topic.jiraTicket,
      jiraLink: topic.jiraLink,
      currentTopicId: topicId,
      phase: 'voting',
      votes: {},
      roundStartedAt: Date.now(),
      timer: resetTimer,
    }
    await saveRoom(updated)
    return updated
  },

  async removeParticipant(roomId: string, participantId: string): Promise<Room | null> {
    const room = await store.getRoom(roomId)
    if (!room) return null
    const updated: Room = {
      ...room,
      participants: room.participants.filter((p) => p.id !== participantId),
      votes: Object.fromEntries(Object.entries(room.votes).filter(([k]) => k !== participantId)),
    }
    await saveRoom(updated)
    return updated
  },

  async setTimer(roomId: string, duration: number, action: 'start' | 'stop', autoReset: boolean): Promise<Room | null> {
    const room = await store.getRoom(roomId)
    if (!room) return null
    const updated: Room = {
      ...room,
      timer: {
        duration,
        startedAt: action === 'start' ? Date.now() : undefined,
        autoReset,
      },
    }
    await saveRoom(updated)
    return updated
  },

  async pushEmoji(roomId: string, event: EmojiThrow): Promise<void> {
    const key = emojiKey(roomId)
    const entry = JSON.stringify({ ...event, ts: Date.now() })
    await redis.lpush(key, entry)
    await redis.ltrim(key, 0, 19)
    await redis.expire(key, EMOJI_TTL)
  },

  async popEmojis(roomId: string, since: number): Promise<(EmojiThrow & { ts: number })[]> {
    const key = emojiKey(roomId)
    const raw = await redis.lrange<string>(key, 0, -1)
    const all = raw.map((s) => (typeof s === 'string' ? JSON.parse(s) : s)) as (EmojiThrow & { ts: number })[]
    return all.filter((e) => e.ts > since)
  },
}
