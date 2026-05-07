import { create } from 'zustand'
import type { Contact } from '../types'
import { getActiveProfile, saveProfile, type StoredProfile } from '../services/storage'

interface UserState {
  profile: StoredProfile | null
  contacts: Contact[]
  isAuthenticated: boolean
  isInitialized: boolean

  loadProfile: () => Promise<void>
  setProfile: (profile: StoredProfile) => Promise<void>
  logout: () => void
  setContacts: (contacts: Contact[]) => void
  addContact: (contact: Contact) => void
}

export const useUserStore = create<UserState>((set) => ({
  profile: null,
  contacts: [],
  isAuthenticated: false,
  isInitialized: false,

  loadProfile: async () => {
    const profile = await getActiveProfile()
    set({
      profile: profile || null,
      isAuthenticated: !!profile,
      isInitialized: true
    })
  },

  setProfile: async (profile: StoredProfile) => {
    await saveProfile(profile)
    set({ profile, isAuthenticated: true })
  },

  logout: () => {
    set({ profile: null, isAuthenticated: false, contacts: [] })
  },

  setContacts: (contacts) => {
    set({ contacts })
  },

  addContact: (contact) => {
    set((state) => ({ contacts: [...state.contacts, contact] }))
  }
}))
