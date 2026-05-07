import { useEffect, useCallback, useState } from 'react'
import { useMeshStore } from '../store/meshStore'
import { useUserStore } from '../store/userStore'
import { webRTCService } from '../services/webrtc'
import { initSignaling, subscribeToSignals, connectToPeer } from '../services/signaling'
import { bluetoothService } from '../services/bluetooth'
import { closePool } from '../services/nostr'

export function useSignaling() {
  const { profile } = useUserStore()
  const { peers, addPeer } = useMeshStore()
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

      setIsInitialized(true)
    } catch (err) {
      setError('Error al inicializar mesh')
      console.error(err)
    }
  }

  const connectToRemotePeer = useCallback(async (targetPubkey: string) => {
    const peerStream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null)
    connectToPeer(
      targetPubkey,
      true,
      peerStream,
      (data) => console.log('Data from', targetPubkey, data),
      (_stream) => {
        const { addPeer: addToMesh } = useMeshStore.getState()
        addToMesh({
          id: targetPubkey,
          pubkey: targetPubkey,
          username: targetPubkey.slice(0, 8),
          signal: -45,
          protocol: 'webrtc',
          lastSeen: Date.now()
        })
      }
    )
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
