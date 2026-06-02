export interface Participant {
  id: string
  name: string
}

export interface Topic {
  id: string
  title: string
  jiraTicket?: string
  jiraLink?: string
}

export interface HistoryEntry {
  id: string
  story: string
  jiraTicket?: string
  jiraLink?: string
  votes: Record<string, string>
  participantNames: Record<string, string>
  consensus: string | null
  average: string
  completedAt: number
}

export interface Room {
  id: string
  name: string
  story: string
  jiraTicket?: string
  jiraLink?: string
  topics: Topic[]
  history: HistoryEntry[]
  participants: Participant[]
  votes: Record<string, string>
  phase: 'voting' | 'revealed'
  moderatorId: string
  createdAt: number
}

export const CARD_VALUES = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕']
