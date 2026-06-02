import { EventEmitter } from 'events'
import type { Room, Participant } from './types'

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

export const store = {
  getRoom(id: string): Room | undefined {
    return rooms.get(id.toUpperCase())
  },

  createRoom(roomName: string, creatorName: string): { room: Room; participantId: string } {
    const roomId = randomId()
    const participantId = crypto.randomUUID()
    const participant: Participant = { id: participantId, name: creatorName }
    const room: Room = {
      id: roomId,
      name: roomName,
      story: '',
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

    // Check if name already exists (rejoin)
    const existing = room.participants.find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    )
    if (existing) {
      return { room, participantId: existing.id }
    }

    const participantId = crypto.randomUUID()
    const participant: Participant = { id: participantId, name }
    const updated: Room = {
      ...room,
      participants: [...room.participants, participant],
    }
    rooms.set(id, updated)
    broadcast(id, updated)
    return { room: updated, participantId }
  },

  castVote(roomId: string, participantId: string, value: string): Room | null {
    const id = roomId.toUpperCase()
    const room = rooms.get(id)
    if (!room || room.phase !== 'voting') return null
    const updated: Room = {
      ...room,
      votes: { ...room.votes, [participantId]: value },
    }
    rooms.set(id, updated)
    broadcast(id, updated)
    return updated
  },

  revealVotes(roomId: string): Room | null {
    const id = roomId.toUpperCase()
    const room = rooms.get(id)
    if (!room) return null
    const updated: Room = { ...room, phase: 'revealed' }
    rooms.set(id, updated)
    broadcast(id, updated)
    return updated
  },

  resetRound(roomId: string, story: string): Room | null {
    const id = roomId.toUpperCase()
    const room = rooms.get(id)
    if (!room) return null
    const updated: Room = { ...room, phase: 'voting', votes: {}, story }
    rooms.set(id, updated)
    broadcast(id, updated)
    return updated
  },

  updateStory(roomId: string, story: string): Room | null {
    const id = roomId.toUpperCase()
    const room = rooms.get(id)
    if (!room) return null
    const updated: Room = { ...room, story }
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
      votes: Object.fromEntries(
        Object.entries(room.votes).filter(([k]) => k !== participantId)
      ),
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
