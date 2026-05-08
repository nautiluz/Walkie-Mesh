import { useEffect, useCallback, useState } from 'react'
import { useMeshStore } from '../store/meshStore'
import { useUserStore } from '../store/userStore'
import { webRTCService } from '../services/webrtc'
import { initSignaling, subscribeToSignals, publishPresence, subscribeToPresence, sendSignal } from '../services/signaling'
import { audioService } from '../services/audio'
import { bluetoothService } from '../services/bluetooth'
import { closePool } from '../services/nostr'

export function useSignaling() {
  const { profile } = useUserStore()
  const { peers, addPeer, addChatMessage } = useMeshStore()
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [btAvailable, setBtAvailable] = useState(false)

  useEffect(() => {
    bluetoothService.isAvailable().then(setBtAvailable)
  }, [])

  useEffect(() => {
    if (!profile?.privateKeyEncrypted) return
    initMesh()
    return () => { closePool() }
  }, [profile])

  const initMesh = async () => {
    try {
      let privkey = profile!.privateKeyEncrypted
      if (privkey.startsWith('nsec')) {
        const { nip19 } = await import('nostr-tools')
        const decoded = nip19.decode(privkey)
        if (decoded.type === 'nsec') {
          privkey = Array.from(decoded.data as Uint8Array)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
        }
      }

      const { SimplePool } = await import('nostr-tools')
      const pool = new SimplePool()
      initSignaling(privkey, pool)

      webRTCService.setConfig({
        onSignal: (pubkey, signal) => sendSignal(pubkey, signal),
        onData: (pubkey, data) => {
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'chat' && parsed.text) {
              addChatMessage(pubkey, {
                id: crypto.randomUUID(),
                pubkey,
                text: parsed.text,
                timestamp: Date.now()
              })
            }
          } catch {}
        },
        onStream: (pubkey, stream) => {
          audioService.addPeerAudio(pubkey, stream)
        },
        onConnect: (pubkey) => {
          addPeer({
            id: pubkey,
            pubkey,
            username: pubkey.slice(0, 8),
            signal: -45,
            protocol: 'webrtc',
            lastSeen: Date.now()
          })
        }
      })

      subscribeToSignals((fromPubkey, signal) => {
        webRTCService.signalPeer(fromPubkey, signal)
        const exists = peers.find(p => p.pubkey === fromPubkey)
        if (!exists) {
          addPeer({
            id: fromPubkey,
            pubkey: fromPubkey,
            username: fromPubkey.slice(0, 8),
            signal: -50,
            protocol: 'nostr',
            lastSeen: Date.now()
          })
        }
      })

      const seen = new Set<string>()
      subscribeToPresence((pubkey, username) => {
        if (pubkey === profile!.publicKey) return
        if (seen.has(pubkey)) return
        seen.add(pubkey)
        addPeer({
          id: pubkey,
          pubkey,
          username,
          signal: -50,
          protocol: 'nostr',
          lastSeen: Date.now()
        })
      })

      publishPresence(profile!.username || profile!.displayName || 'Peer')

      const presenceInterval = setInterval(() => {
        publishPresence(profile!.username || profile!.displayName || 'Peer')
      }, 30000)

      setIsInitialized(true)

      return () => {
        clearInterval(presenceInterval)
      }
    } catch (err) {
      setError('Error al inicializar mesh')
      console.error(err)
    }
  }

  const connectToRemotePeer = useCallback(async (targetPubkey: string) => {
    const peerStream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null)
    if (peerStream) {
      webRTCService.setLocalStream(peerStream)
    }
    webRTCService.startCall(targetPubkey)
  }, [])

  const startBluetoothDiscovery = useCallback(async () => {
    await bluetoothService.startDiscovery((peer) => {
      addPeer(peer)
    })
  }, [addPeer])

  const stopBluetoothDiscovery = useCallback(() => {
    bluetoothService.stopDiscovery()
  }, [])

  return {
    isInitialized,
    error,
    connectToRemotePeer,
    startBluetoothDiscovery,
    stopBluetoothDiscovery,
    isBluetoothAvailable: btAvailable
  }
}
