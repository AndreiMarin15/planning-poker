export interface Participant {
  id: string
  name: string
}

export interface Room {
  id: string
  name: string
  story: string
  participants: Participant[]
  votes: Record<string, string> // participantId -> card value
  phase: 'voting' | 'revealed'
  moderatorId: string
  createdAt: number
}

export const CARD_VALUES = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕']
