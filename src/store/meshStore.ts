import { create } from 'zustand'
import type { PeerInfo, SignalMetrics } from '../types'

interface MeshState {
  peers: PeerInfo[]
  isOnline: boolean
  dominantProtocol: 'bluetooth' | 'webrtc' | 'nostr'
  signalMetrics: SignalMetrics | null
  isPTTActive: boolean

  setPeers: (peers: PeerInfo[]) => void
  addPeer: (peer: PeerInfo) => void
  removePeer: (id: string) => void
  updatePeerSignal: (id: string, signal: number) => void
  setOnline: (online: boolean) => void
  setDominantProtocol: (protocol: 'bluetooth' | 'webrtc' | 'nostr') => void
  setSignalMetrics: (metrics: SignalMetrics) => void
  setPTTActive: (active: boolean) => void
}

export const useMeshStore = create<MeshState>((set) => ({
  peers: [],
  isOnline: navigator.onLine,
  dominantProtocol: 'nostr',
  signalMetrics: null,
  isPTTActive: false,

  setPeers: (peers) => set({ peers }),

  addPeer: (peer) =>
    set((state) => {
      const exists = state.peers.find((p) => p.id === peer.id)
      if (exists) {
        return {
          peers: state.peers.map((p) => (p.id === peer.id ? peer : p))
        }
      }
      return { peers: [...state.peers, peer] }
    }),

  removePeer: (id) =>
    set((state) => ({
      peers: state.peers.filter((p) => p.id !== id)
    })),

  updatePeerSignal: (id, signal) =>
    set((state) => ({
      peers: state.peers.map((p) =>
        p.id === id ? { ...p, signal } : p
      )
    })),

  setOnline: (online) => set({ isOnline: online }),
  setDominantProtocol: (protocol) => set({ dominantProtocol: protocol }),
  setSignalMetrics: (metrics) => set({ signalMetrics: metrics }),
  setPTTActive: (active) => set({ isPTTActive: active })
}))
