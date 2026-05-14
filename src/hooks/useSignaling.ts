import { useEffect, useCallback, useState } from 'react'
import { useMeshStore } from '../store/meshStore'
import { useUserStore } from '../store/userStore'
import { initSignaling, publishPresence, subscribeToPresence } from '../services/signaling'
import { webRTCService } from '../services/webrtc'
import { bluetoothService } from '../services/bluetooth'
import { closePool } from '../services/nostr'

export function useSignaling() {
  const { profile } = useUserStore()
  const { addPeer } = useMeshStore()
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
      webRTCService.startCall(targetPubkey)
    }
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
