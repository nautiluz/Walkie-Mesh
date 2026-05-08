import { create } from 'zustand'

interface SettingsState {
  theme: 'dark' | 'light'
  vadEnabled: boolean
  noiseSuppression: boolean
  autoBitrate: boolean
  telemetryEnabled: boolean
  pttMode: 'hold' | 'toggle'
  selectedRelays: string[]

  setTheme: (theme: 'dark' | 'light') => void
  toggleVAD: () => void
  toggleNoiseSuppression: () => void
  toggleAutoBitrate: () => void
  toggleTelemetry: () => void
  setPttMode: (mode: 'hold' | 'toggle') => void
  setSelectedRelays: (relays: string[]) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'dark',
  vadEnabled: true,
  noiseSuppression: true,
  autoBitrate: true,
  telemetryEnabled: true,
  pttMode: 'hold',
  selectedRelays: [
    'wss://nos.lol',
    'wss://relay.damus.io',
    'wss://relay.nostr.info'
  ],

  setTheme: (theme) => set({ theme }),
  toggleVAD: () => set((s) => ({ vadEnabled: !s.vadEnabled })),
  toggleNoiseSuppression: () => set((s) => ({ noiseSuppression: !s.noiseSuppression })),
  toggleAutoBitrate: () => set((s) => ({ autoBitrate: !s.autoBitrate })),
  toggleTelemetry: () => set((s) => ({ telemetryEnabled: !s.telemetryEnabled })),
  setPttMode: (mode) => set({ pttMode: mode }),
  setSelectedRelays: (relays) => set({ selectedRelays: relays })
}))
