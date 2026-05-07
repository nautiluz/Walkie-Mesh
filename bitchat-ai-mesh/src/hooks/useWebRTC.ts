import { useState, useCallback, useRef } from 'react'
import SimplePeer from 'simple-peer'
import { webRTCService } from '../services/webrtc'

export function useWebRTC() {
  const [connectedPeers, setConnectedPeers] = useState<string[]>([])
  const signalCallbacks = useRef<Map<string, (signal: SimplePeer.SignalData) => void>>(new Map())

  const createPeer = useCallback((
    pubkey: string,
    initiator: boolean,
    onData: (data: string) => void,
    onSignalOut?: (signal: SimplePeer.SignalData) => void
  ) => {
    const peer = webRTCService.createPeer(
      pubkey,
      initiator,
      (signal) => {
        signalCallbacks.current.set(pubkey, (s: SimplePeer.SignalData) => {
          webRTCService.signalPeer(pubkey, s)
        })
        onSignalOut?.(signal)
      },
      onData,
      () => setConnectedPeers(webRTCService.getConnectedPeers()),
      () => setConnectedPeers(webRTCService.getConnectedPeers())
    )
    return peer
  }, [])

  const signalPeer = useCallback((pubkey: string, signal: SimplePeer.SignalData) => {
    webRTCService.signalPeer(pubkey, signal)
  }, [])

  const sendData = useCallback((pubkey: string, data: string) => {
    webRTCService.sendData(pubkey, data)
  }, [])

  const broadcast = useCallback((data: string) => {
    webRTCService.broadcast(data)
  }, [])

  const disconnectAll = useCallback(() => {
    webRTCService.disconnectAll()
    setConnectedPeers([])
  }, [])

  return {
    connectedPeers,
    error: null as string | null,
    createPeer,
    signalPeer,
    sendData,
    broadcast,
    disconnectAll,
    peerCount: connectedPeers.length
  }
}
