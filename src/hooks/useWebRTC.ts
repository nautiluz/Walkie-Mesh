import { useState, useCallback } from 'react'
import { webRTCService } from '../services/webrtc'

export function useWebRTC() {
  const [connectedPeers, setConnectedPeers] = useState<string[]>([])

  const signalPeer = useCallback((pubkey: string, signal: any) => {
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
    signalPeer,
    sendData,
    broadcast,
    disconnectAll,
    peerCount: connectedPeers.length
  }
}
