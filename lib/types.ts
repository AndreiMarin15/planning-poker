export type ParticipantRole = 'voter' | 'facilitator'

export interface Participant {
  id: string
  name: string
  avatarStyle?: string
  role?: ParticipantRole
}

export interface Topic {
  id: string
  title: string
  description?: string
  jiraTicket?: string
  jiraLink?: string
}

export interface HistoryEntry {
  id: string
  story: string
  description?: string
  jiraTicket?: string
  jiraLink?: string
  votes: Record<string, string>
  participantNames: Record<string, string>
  consensus: string | null
  average: string
  completedAt: number
}

export type CardTemplate = 'fibonacci' | 'tshirt'

export interface Room {
  id: string
  name: string
  story: string
  storyDescription?: string
  jiraTicket?: string
  jiraLink?: string
  topics: Topic[]
  currentTopicId?: string
  history: HistoryEntry[]
  participants: Participant[]
  votes: Record<string, string>
  phase: 'voting' | 'revealed'
  moderatorId: string
  cardTemplate: CardTemplate
  createdAt: number
}

export interface EmojiThrow {
  id: string
  fromId: string
  fromName: string
  toId: string
  toName: string
  emoji: string
}

export const CARD_VALUES = ['0', '1', '2', '3', '5', '8', '13', '21']

export const CARD_TEMPLATES: Record<CardTemplate, string[]> = {
  fibonacci: ['1', '2', '3', '5', '8', '13', '21', '34'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'],
}

export const THROW_EMOJIS = ['🎉', '🔥', '💩', '👀', '❤️', '👏', '💀', '🤡', '🚀', '😤', '😂', '🎯']
