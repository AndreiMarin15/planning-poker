import { EventEmitter } from 'events'
import type { Room, Participant, Topic, HistoryEntry } from './types'

const rooms = new Map<string, Room>()
const emitter = new EventEmitter()
emitter.setMaxListeners(500)

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
    jiraTicket: room.jiraTicket,
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
    initialTopics: Array<{ title: string; jiraTicket?: string }> = [],
  ): { room: Room; participantId: string } {
    const roomId = randomId()
    const participantId = crypto.randomUUID()
    const participant: Participant = { id: participantId, name: creatorName }

    const topics: Topic[] = initialTopics.map((t) => ({
      id: crypto.randomUUID(),
      title: t.title,
      jiraTicket: t.jiraTicket || undefined,
    }))

    // Auto-start with the first topic if provided
    let story = ''
    let jiraTicket: string | undefined
    let remainingTopics = topics
    if (topics.length > 0) {
      story = topics[0].title
      jiraTicket = topics[0].jiraTicket
      remainingTopics = topics.slice(1)
    }

    const room: Room = {
      id: roomId,
      name: roomName,
      story,
      jiraTicket,
      topics: remainingTopics,
      history: [],
      participants: [participant],
      votes: {},
      phase: 'voting',
      moderatorId: participantId,
      createdAt: Date.now(),
    }
    rooms.set(roomId, room)
    return { room, participantId }
  },

  joinRoom(roomId: string, name: string): { room: Room; participantId: string } | null {
    const id = roomId.toUpperCase()
    const room = rooms.get(id)
    if (!room) return null
    const existing = room.participants.find((p) => p.name.toLowerCase() === name.toLowerCase())
    if (existing) return { room, participantId: existing.id }
    const participantId = crypto.randomUUID()
    const participant: Participant = { id: participantId, name }
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

  resetRound(roomId: string, story?: string, jiraTicket?: string): Room | null {
    const id = roomId.toUpperCase()
    const room = rooms.get(id)
    if (!room) return null

    let nextStory = story ?? ''
    let nextJira = jiraTicket
    let nextTopics = room.topics

    // Auto-advance to next queued topic if no explicit story provided
    if (!story && room.topics.length > 0) {
      nextStory = room.topics[0].title
      nextJira = room.topics[0].jiraTicket
      nextTopics = room.topics.slice(1)
    }

    const updated: Room = {
      ...room,
      phase: 'voting',
      votes: {},
      story: nextStory,
      jiraTicket: nextJira,
      topics: nextTopics,
    }
    rooms.set(id, updated)
    broadcast(id, updated)
    return updated
  },

  updateStory(roomId: string, story: string, jiraTicket: string): Room | null {
    const id = roomId.toUpperCase()
    const room = rooms.get(id)
    if (!room) return null
    const updated: Room = { ...room, story, jiraTicket: jiraTicket || undefined }
    rooms.set(id, updated)
    broadcast(id, updated)
    return updated
  },

  addTopic(roomId: string, title: string, jiraTicket?: string): Room | null {
    const id = roomId.toUpperCase()
    const room = rooms.get(id)
    if (!room) return null
    const topic: Topic = { id: crypto.randomUUID(), title, jiraTicket: jiraTicket || undefined }
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
      jiraTicket: topic.jiraTicket,
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
}
