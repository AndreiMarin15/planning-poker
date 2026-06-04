import { create } from 'zustand'
import type { Room } from './types'

export type SidebarTab = 'queue' | 'history'
export type MobileTab = 'table' | 'queue' | 'history'

interface RoomStore {
  room: Room | null
  participantId: string | null
  sidebarTab: SidebarTab
  mobileTab: MobileTab
  historyOpen: boolean

  setRoom: (room: Room) => void
  setParticipantId: (id: string | null) => void
  setSidebarTab: (tab: SidebarTab) => void
  setMobileTab: (tab: MobileTab) => void
  toggleHistory: () => void
}

export const useRoomStore = create<RoomStore>((set) => ({
  room: null,
  participantId: null,
  sidebarTab: 'queue',
  mobileTab: 'table',
  historyOpen: true,

  setRoom: (room) => set({ room }),
  setParticipantId: (participantId) => set({ participantId }),
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  setMobileTab: (mobileTab) => set({ mobileTab }),
  toggleHistory: () => set((s) => ({ historyOpen: !s.historyOpen })),
}))
