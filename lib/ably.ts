import Ably from 'ably'
import type { Room } from './types'

let _rest: Ably.Rest | null = null

export function getRest(): Ably.Rest {
  if (!_rest) _rest = new Ably.Rest({ key: process.env.ABLY_API_KEY! })
  return _rest
}

export function channelName(roomId: string) {
  return `room:${roomId.toUpperCase()}`
}

export async function publishRoom(room: Room): Promise<void> {
  if (!process.env.ABLY_API_KEY) return
  try {
    const channel = getRest().channels.get(channelName(room.id))
    await channel.publish('update', room)
  } catch {
    // non-fatal — clients fall back to polling
  }
}

export async function mintToken(roomId: string): Promise<Ably.TokenRequest> {
  const rest = getRest()
  return rest.auth.createTokenRequest({
    capability: { [channelName(roomId)]: ['subscribe'] },
    ttl: 3600_000,
  })
}
