import { Redis } from '@upstash/redis'
import type { Room, Participant, Topic, HistoryEntry, EmojiThrow, CardTemplate } from './types'

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

function buildHistoryEntry(room: Room): HistoryEntry {
  const voteValues = Object.values(room.votes)
  const nums = voteValues.map(Number).filter((n) => !isNaN(n))
  const average = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '—'
  const consensus = new Set(voteValues).size === 1 && voteValues.length > 0 ? voteValues[0] : null
  return {
    id: crypto.randomUUID(),
    story: room.story,
    description: room.storyDescription,
    jiraTicket: room.jiraTicket,
    jiraLink: room.jiraLink,
    votes: { ...room.votes },
    participantNames: Object.fromEntries(room.participants.map((p) => [p.id, p.name])),
    consensus,
    average,
    completedAt: Date.now(),
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
  ): Promise<{ room: Room; participantId: string }> {
    const roomId = randomId()
    const participantId = crypto.randomUUID()
    const participant: Participant = { id: participantId, name: creatorName, avatarStyle: creatorAvatarStyle }

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
    let remainingTopics = topics
    if (topics.length > 0) {
      story = topics[0].title
      jiraTicket = topics[0].jiraTicket
      jiraLink = topics[0].jiraLink
      storyDescription = topics[0].description
      remainingTopics = topics.slice(1)
    }

    const room: Room = {
      id: roomId,
      name: roomName,
      story,
      storyDescription,
      jiraTicket,
      jiraLink,
      topics: remainingTopics,
      history: [],
      participants: [participant],
      votes: {},
      phase: 'voting',
      moderatorId: participantId,
      cardTemplate,
      createdAt: Date.now(),
    }
    await saveRoom(room)
    return { room, participantId }
  },

  async joinRoom(roomId: string, name: string, avatarStyle?: string, role?: 'voter' | 'facilitator'): Promise<{ room: Room; participantId: string } | null> {
    const room = await store.getRoom(roomId)
    if (!room) return null
    const existing = room.participants.find((p) => p.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (avatarStyle && avatarStyle !== existing.avatarStyle) {
        const updated: Room = {
          ...room,
          participants: room.participants.map((p) =>
            p.id === existing.id ? { ...p, avatarStyle } : p,
          ),
        }
        await saveRoom(updated)
        return { room: updated, participantId: existing.id }
      }
      return { room, participantId: existing.id }
    }
    const participantId = crypto.randomUUID()
    const participant: Participant = { id: participantId, name, avatarStyle, role: role ?? 'voter' }
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
    const updated: Room = { ...room, phase: 'revealed', history: [...room.history, entry] }
    await saveRoom(updated)
    return updated
  },

  async resetRound(roomId: string, story?: string, jiraTicket?: string, jiraLink?: string): Promise<Room | null> {
    const room = await store.getRoom(roomId)
    if (!room) return null

    let nextStory = story ?? ''
    let nextJira = jiraTicket
    let nextLink = jiraLink
    let nextDesc: string | undefined
    let nextTopics = room.topics

    if (!story && room.topics.length > 0) {
      nextStory = room.topics[0].title
      nextJira = room.topics[0].jiraTicket
      nextLink = room.topics[0].jiraLink
      nextDesc = room.topics[0].description
      nextTopics = room.topics.slice(1)
    }

    const updated: Room = {
      ...room,
      phase: 'voting',
      votes: {},
      story: nextStory,
      storyDescription: nextDesc,
      jiraTicket: nextJira,
      jiraLink: nextLink,
      topics: nextTopics,
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
    const updated: Room = { ...room, topics: [...room.topics, topic] }
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
    const updated: Room = {
      ...room,
      story: topic.title,
      storyDescription: topic.description,
      jiraTicket: topic.jiraTicket,
      jiraLink: topic.jiraLink,
      topics: room.topics.filter((t) => t.id !== topicId),
      phase: 'voting',
      votes: {},
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
