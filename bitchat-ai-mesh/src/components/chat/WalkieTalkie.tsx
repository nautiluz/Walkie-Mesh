import { useState, useRef, useCallback, useEffect } from 'react'
import { useMeshStore } from '../../store/meshStore'
import { useUserStore } from '../../store/userStore'
import { audioService } from '../../services/audio'
import { webRTCService } from '../../services/webrtc'
import { initSignaling, subscribeToSignals, connectToPeer } from '../../services/signaling'
import { useSettingsStore } from '../../store/settingsStore'

export function WalkieTalkie() {
  const { isPTTActive, setPTTActive, peers } = useMeshStore()
  const { pttMode, vadEnabled } = useSettingsStore()
  const { profile } = useUserStore()
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isInit, setIsInit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toggleLock, setToggleLock] = useState(false)
  const [incomingPeers, setIncomingPeers] = useState<string[]>([])
  const pressTimer = useRef<number | null>(null)
  const initialisedRef = useRef(false)

  useEffect(() => {
    if (initialisedRef.current) return
    initialisedRef.current = true
    initAudioAndSignaling()
    return () => {
      audioService.destroy()
      webRTCService.disconnectAll()
    }
  }, [])

  const initAudioAndSignaling = async () => {
    try {
      await audioService.init()
      setIsInit(true)
      setError(null)

      if (profile?.privateKeyEncrypted) {
        let privkey = profile.privateKeyEncrypted
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

        {
          subscribeToSignals((fromPubkey, signal) => {
            webRTCService.signalPeer(fromPubkey, signal)
          })

          const localStream = audioService.getStream()
          if (localStream) {
            peers.forEach(peer => {
              if (!webRTCService.hasPeer(peer.pubkey)) {
                connectToPeer(
                  peer.pubkey,
                  false,
                  localStream,
                  (data) => console.log('Data from peer:', data),
                  (stream) => {
                    audioService.addPeerAudio(peer.pubkey, stream)
                    setIncomingPeers(prev => [...prev, peer.pubkey])
                  }
                )
              }
            })
          }
        }
      }
    } catch (err) {
      setError('Error al inicializar audio/comunicación')
      console.error(err)
    }
  }

  const handlePTTStart = useCallback(() => {
    if (!isInit) return
    if (pttMode === 'hold') {
      activatePTT()
    }
  }, [isInit, pttMode])

  const activatePTT = () => {
    const localStream = audioService.getStream()
    if (!localStream) return

    webRTCService.setLocalStream(localStream)

    peers.forEach(peer => {
      const conn = webRTCService.getPeer(peer.pubkey)
      if (conn?.connected) {
        localStream.getTracks().forEach(track => {
          conn.peer.addTrack(track, localStream)
        })
      }
    })

    audioService.startPTT(
      () => {},
      (speaking) => setIsSpeaking(speaking)
    )
    setPTTActive(true)
  }

  const handlePTTEnd = useCallback(() => {
    if (pttMode === 'hold') {
      deactivatePTT()
    }
  }, [pttMode])

  const deactivatePTT = () => {
    audioService.stopPTT()
    setPTTActive(false)
    setIsSpeaking(false)
  }

  const handleToggle = useCallback(() => {
    if (pttMode === 'toggle') {
      if (toggleLock) {
        deactivatePTT()
        setToggleLock(false)
      } else {
        activatePTT()
        setToggleLock(true)
      }
    }
  }, [pttMode, toggleLock])

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-12">
      {error && (
        <div className="bg-red-900/30 text-red-400 px-4 py-2 rounded-lg text-sm max-w-xs text-center">
          {error}
        </div>
      )}

      <div className="text-center">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
          {pttMode === 'hold' ? 'Mantén presionado para hablar' : 'Toca para activar'}
        </p>
        <p className="text-sm text-slate-400">
          {peers.length > 0
            ? `${peers.length} par(es) en la red`
            : 'Sin conexión mesh'}
        </p>
        {incomingPeers.length > 0 && (
          <p className="text-xs text-mesh-400 mt-1">
            {incomingPeers.length} con audio entrante
          </p>
        )}
      </div>

      <button
        onMouseDown={handlePTTStart}
        onMouseUp={handlePTTEnd}
        onMouseLeave={handlePTTEnd}
        onTouchStart={(e) => {
          e.preventDefault()
          if (pttMode === 'hold') {
            pressTimer.current = window.setTimeout(() => handleToggle(), 500)
            handlePTTStart()
          } else {
            handleToggle()
          }
        }}
        onTouchEnd={(e) => {
          e.preventDefault()
          if (pressTimer.current) {
            clearTimeout(pressTimer.current)
            pressTimer.current = null
          }
          handlePTTEnd()
        }}
        className={`ptt-button w-40 h-40 rounded-full flex flex-col items-center justify-center gap-2 font-bold text-lg transition-all duration-150 select-none ${
          isPTTActive
            ? 'bg-red-600 shadow-[0_0_40px_rgba(220,38,38,0.5)] scale-105'
            : 'bg-slate-800 shadow-lg hover:bg-slate-700 active:scale-95'
        }`}
      >
        <span className="text-3xl">{isPTTActive ? '🔴' : '🎙'}</span>
        <span className="text-sm">
          {isPTTActive ? (isSpeaking ? 'Hablando...' : 'Transmitiendo') : 'PTT'}
        </span>
      </button>

      {vadEnabled && isPTTActive && (
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-green-500' : 'bg-slate-600'}`} />
          <span className="text-xs text-slate-400">
            {isSpeaking ? 'Voz detectada' : 'Esperando voz...'}
          </span>
        </div>
      )}

      <div className="flex gap-2 text-xs text-slate-500">
        <span className={`px-2 py-1 rounded ${isInit ? 'bg-green-900/30 text-green-400' : 'bg-slate-800'}`}>
          {isInit ? 'Mic: OK' : 'Mic: --'}
        </span>
        <span className={`px-2 py-1 rounded ${peers.length > 0 ? 'bg-green-900/30 text-green-400' : 'bg-slate-800'}`}>
          Mesh: {peers.length}
        </span>
        <span className={`px-2 py-1 rounded ${incomingPeers.length > 0 ? 'bg-green-900/30 text-green-400' : 'bg-slate-800'}`}>
          Rx: {incomingPeers.length}
        </span>
      </div>
    </div>
  )
}
