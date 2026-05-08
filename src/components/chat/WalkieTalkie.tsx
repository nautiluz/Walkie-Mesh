import { useState, useRef, useCallback, useEffect } from 'react'
import { useMeshStore } from '../../store/meshStore'
import { useUserStore } from '../../store/userStore'
import { audioService } from '../../services/audio'
import { webRTCService } from '../../services/webrtc'
import { useSettingsStore } from '../../store/settingsStore'

export function WalkieTalkie() {
  const { isPTTActive, setPTTActive, peers, selectedPeerId, setSelectedPeerId, chatMessages, addChatMessage } = useMeshStore()
  const { pttMode, vadEnabled } = useSettingsStore()
  const { profile } = useUserStore()
  const [isInit, setIsInit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [toggleLock, setToggleLock] = useState(false)
  const [chatText, setChatText] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const pressTimer = useRef<number | null>(null)
  const initialisedRef = useRef(false)

  const selectedPeer = peers.find(p => p.pubkey === selectedPeerId)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    if (initialisedRef.current) return
    initialisedRef.current = true
    initAudio()
    return () => {
      audioService.destroy()
      webRTCService.disconnectAll()
    }
  }, [])

  const initAudio = async () => {
    try {
      await audioService.init()
      const stream = audioService.getStream()
      if (stream) {
        webRTCService.setLocalStream(stream)
      }
      setIsInit(true)
      setError(null)
    } catch (err) {
      setError('Error al inicializar audio')
      console.error(err)
    }
  }

  const activatePTT = useCallback(() => {
    if (!isInit || !selectedPeerId) return

    const localStream = audioService.getStream()
    if (!localStream) return

    webRTCService.setLocalStream(localStream)

    if (!webRTCService.hasPeer(selectedPeerId)) {
      webRTCService.startCall(selectedPeerId)
    }

    webRTCService.addTracksToAllPeers(localStream)
    audioService.startPTT(
      () => {},
      (speaking) => setIsSpeaking(speaking)
    )
    setPTTActive(true)
  }, [isInit, selectedPeerId, setPTTActive])

  const handlePTTStart = useCallback(() => {
    if (pttMode === 'hold') {
      activatePTT()
    }
  }, [pttMode, activatePTT])

  const deactivatePTT = useCallback(() => {
    audioService.stopPTT()
    setPTTActive(false)
    setIsSpeaking(false)
  }, [setPTTActive])

  const handlePTTEnd = useCallback(() => {
    if (pttMode === 'hold') {
      deactivatePTT()
    }
  }, [pttMode, deactivatePTT])

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
  }, [pttMode, toggleLock, activatePTT, deactivatePTT])

  const sendChatMessage = useCallback(() => {
    const text = chatText.trim()
    if (!text || !selectedPeerId || !profile) return

    webRTCService.sendData(selectedPeerId, JSON.stringify({ type: 'chat', text }))
    addChatMessage(selectedPeerId, {
      id: crypto.randomUUID(),
      pubkey: profile.publicKey,
      text,
      timestamp: Date.now()
    })
    setChatText('')
  }, [chatText, selectedPeerId, profile, addChatMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendChatMessage()
    }
  }

  const currentMessages = selectedPeerId ? (chatMessages[selectedPeerId] || []) : []

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {error && (
        <div className="bg-red-900/30 text-red-400 px-4 py-2 rounded-lg text-sm text-center mb-2">
          {error}
        </div>
      )}

      {/* Peer list */}
      <div className="mb-3">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
          Pares disponibles
        </p>
        <div className="flex flex-wrap gap-2">
          {peers.length === 0 && (
            <p className="text-xs text-slate-500 italic">Esperando pares...</p>
          )}
          {peers.map((peer) => (
            <button
              key={peer.id}
              onClick={() => setSelectedPeerId(peer.pubkey)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedPeerId === peer.pubkey
                  ? 'bg-mesh-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {peer.username}
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto mb-3 space-y-2 bg-slate-900/50 rounded-xl p-3">
        {!selectedPeerId ? (
          <div className="flex items-center justify-center h-full text-xs text-slate-500">
            Selecciona un contacto para iniciar el chat
          </div>
        ) : currentMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-slate-500">
            Sin mensajes aún. Presiona PTT para hablar o escribe un mensaje.
          </div>
        ) : (
          currentMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.pubkey === profile?.publicKey ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                  msg.pubkey === profile?.publicKey
                    ? 'bg-mesh-600 text-white'
                    : 'bg-slate-800 text-slate-200'
                }`}
              >
                {msg.text}
                <div className="text-[10px] opacity-50 mt-0.5 text-right">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Chat input */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={chatText}
          onChange={(e) => setChatText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          disabled={!selectedPeerId}
          className="flex-1 bg-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-500 disabled:opacity-40 outline-none focus:ring-1 focus:ring-mesh-500"
        />
        <button
          onClick={sendChatMessage}
          disabled={!selectedPeerId || !chatText.trim()}
          className="px-4 py-2 bg-mesh-600 hover:bg-mesh-500 disabled:opacity-40 rounded-xl text-sm font-medium transition-colors"
        >
          Enviar
        </button>
      </div>

      {/* PTT section */}
      <div className="flex flex-col items-center gap-3 pb-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide text-center">
          {selectedPeer
            ? `Hablando con: ${selectedPeer.username}`
            : 'Selecciona un contacto arriba'}
        </p>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className={`px-2 py-1 rounded ${isInit ? 'bg-green-900/30 text-green-400' : 'bg-slate-800'}`}>
            Mic: {isInit ? 'OK' : '--'}
          </span>
          <span className={`px-2 py-1 rounded ${webRTCService.isConnected(selectedPeerId || '') ? 'bg-green-900/30 text-green-400' : 'bg-slate-800'}`}>
            WebRTC: {webRTCService.isConnected(selectedPeerId || '') ? 'OK' : '--'}
          </span>
        </div>

        <button
          disabled={!selectedPeerId}
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
          className={`ptt-button w-36 h-36 rounded-full flex flex-col items-center justify-center gap-2 font-bold text-lg transition-all duration-150 select-none ${
            !selectedPeerId
              ? 'bg-slate-800 opacity-40 cursor-not-allowed'
              : isPTTActive
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

        <p className="text-xs text-slate-500">
          {pttMode === 'hold' ? 'Mantén presionado para hablar' : 'Toca para activar/desactivar'}
        </p>
      </div>
    </div>
  )
}
