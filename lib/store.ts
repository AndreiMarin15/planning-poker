import { EventEmitter } from 'events'
import type { Room, Participant, Topic, HistoryEntry, EmojiThrow, CardTemplate } from './types'

// Persist across Next.js HMR reloads in dev (module is re-evaluated on hot reload)
const g = globalThis as typeof globalThis & {
  __rooms?: Map<string, Room>
  __emitter?: EventEmitter
  __emojiEmitter?: EventEmitter
}
if (!g.__rooms) g.__rooms = new Map<string, Room>()
if (!g.__emitter) { g.__emitter = new EventEmitter(); g.__emitter.setMaxListeners(500) }
if (!g.__emojiEmitter) { g.__emojiEmitter = new EventEmitter(); g.__emojiEmitter.setMaxListeners(500) }

const rooms = g.__rooms
const emitter = g.__emitter
const emojiEmitter = g.__emojiEmitter

function randomId(length = 6): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function broadcast(roomId: string, room: Room) {
  emitter.emit(roomId, room)
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
  getRoom(id: string): Room | undefined {
    return rooms.get(id.toUpperCase())
  },

  createRoom(
    roomName: string,
    creatorName: string,
    initialTopics: Array<{ title: string; description?: string; jiraTicket?: string; jiraLink?: string }> = [],
    creatorAvatarStyle?: string,
    cardTemplate: CardTemplate = 'fibonacci',
  ): { room: Room; participantId: string } {
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

    // Auto-start with the first topic if provided
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
    rooms.set(roomId, room)
    return { room, participantId }
  },

  joinRoom(roomId: string, name: string, avatarStyle?: string, role?: 'voter' | 'facilitator'): { room: Room; participantId: string } | null {
    const id = roomId.toUpperCase()
    const room = rooms.get(id)
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
        rooms.set(id, updated)
        broadcast(id, updated)
        return { room: updated, participantId: existing.id }
      }
      return { room, participantId: existing.id }
    }
    const participantId = crypto.randomUUID()
    const participant: Participant = { id: participantId, name, avatarStyle, role: role ?? 'voter' }
    const updated: Room = { ...room, participants: [...room.participants, participant] }
    rooms.set(id, updated)
    broadcast(id, updated)
    return { room: updated, participantId }
  },

  castVote(roomId: string, participantId: string, value: string): Room | null {
    const id = roomId.toUpperCase()
    const room = rooms.get(id)
    if (!room || room.phase !== 'voting') return null
    const updated: Room = { ...room, votes: { ...room.votes, [participantId]: value } }
    rooms.set(id, updated)
    broadcast(id, updated)
    return updated
  },

  revealVotes(roomId: string): Room | null {
    const id = roomId.toUpperCase()
    const room = rooms.get(id)
    if (!room) return null
    const entry = buildHistoryEntry(room)
    const updated: Room = { ...room, phase: 'revealed', history: [...room.history, entry] }
    rooms.set(id, updated)
    broadcast(id, updated)
    return updated
  },

  resetRound(roomId: string, story?: string, jiraTicket?: string, jiraLink?: string): Room | null {
    const id = roomId.toUpperCase()
    const room = rooms.get(id)
    if (!room) return null

    let nextStory = story ?? ''
    let nextJira = jiraTicket
    let nextLink = jiraLink
    let nextDesc: string | undefined
    let nextTopics = room.topics

    // Auto-advance to next queued topic if no explicit story provided
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
    rooms.set(id, updated)
    broadcast(id, updated)
    return updated
  },

  updateStory(roomId: string, story: string, jiraTicket: string, jiraLink: string, description?: string): Room | null {
    const id = roomId.toUpperCase()
    const room = rooms.get(id)
    if (!room) return null
    const updated: Room = {
      ...room,
      story,
      storyDescription: description || undefined,
      jiraTicket: jiraTicket || undefined,
      jiraLink: jiraLink || undefined,
    }
    rooms.set(id, updated)
    broadcast(id, updated)
    return updated
  },

  addTopic(roomId: string, title: string, jiraTicket?: string, jiraLink?: string, description?: string): Room | null {
    const id = roomId.toUpperCase()
    const room = rooms.get(id)
    if (!room) return null
    const topic: Topic = {
      id: crypto.randomUUID(),
      title,
      description: description || undefined,
      jiraTicket: jiraTicket || undefined,
      jiraLink: jiraLink || undefined,
    }
    const updated: Room = { ...room, topics: [...room.topics, topic] }
    rooms.set(id, updated)
    broadcast(id, updated)
    return updated
  },

  removeTopic(roomId: string, topicId: string): Room | null {
    const id = roomId.toUpperCase()
    const room = rooms.get(id)
    if (!room) return null
    const updated: Room = { ...room, topics: room.topics.filter((t) => t.id !== topicId) }
    rooms.set(id, updated)
    broadcast(id, updated)
    return updated
  },

  startTopic(roomId: string, topicId: string): Room | null {
    const id = roomId.toUpperCase()
    const room = rooms.get(id)
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
    rooms.set(id, updated)
    broadcast(id, updated)
    return updated
  },

  removeParticipant(roomId: string, participantId: string): Room | null {
    const id = roomId.toUpperCase()
    const room = rooms.get(id)
    if (!room) return null
    const updated: Room = {
      ...room,
      participants: room.participants.filter((p) => p.id !== participantId),
      votes: Object.fromEntries(Object.entries(room.votes).filter(([k]) => k !== participantId)),
    }
    rooms.set(id, updated)
    broadcast(id, updated)
    return updated
  },

  subscribe(roomId: string, callback: (room: Room) => void): () => void {
    const id = roomId.toUpperCase()
    emitter.on(id, callback)
    return () => emitter.off(id, callback)
  },

  throwEmoji(roomId: string, event: EmojiThrow): void {
    emojiEmitter.emit(roomId.toUpperCase(), event)
  },

  subscribeEmoji(roomId: string, callback: (event: EmojiThrow) => void): () => void {
    const id = roomId.toUpperCase()
    emojiEmitter.on(id, callback)
    return () => emojiEmitter.off(id, callback)
  },
}
