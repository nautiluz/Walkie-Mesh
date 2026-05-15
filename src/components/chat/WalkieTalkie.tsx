import { useState, useRef, useCallback, useEffect } from 'react'
import { useMeshStore } from '../../store/meshStore'
import { useUserStore } from '../../store/userStore'
import { audioService } from '../../services/audio'
import { webRTCService } from '../../services/webrtc'
import { useSettingsStore } from '../../store/settingsStore'

const SIGNAL_KIND = 2000
const PRESENCE_KIND = 2001
const SIGNAL_RELAYS = ['wss://nos.lol', 'wss://relay.damus.io']

export function WalkieTalkie() {
  const { isPTTActive, setPTTActive, peers, selectedPeerId, setSelectedPeerId, chatMessages, addChatMessage, addPeer } = useMeshStore()
  const { pttMode, vadEnabled } = useSettingsStore()
  const { profile } = useUserStore()
  const [isInit, setIsInit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [toggleLock, setToggleLock] = useState(false)
  const [chatText, setChatText] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const pressTimer = useRef<number | null>(null)
  const initRef = useRef(false)
  const poolRef = useRef<any>(null)
  const subRef = useRef<any>(null)
  const presenceSubRef = useRef<any>(null)
  const pendingMessagesRef = useRef<string[]>([])
  const seenPeersRef = useRef<Set<string>>(new Set())

  const selectedPeer = peers.find(p => p.pubkey === selectedPeerId)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    initWalkieTalkie()
    return () => {
      audioService.destroy()
      webRTCService.disconnectAll()
      if (poolRef.current) {
        try { poolRef.current.close(SIGNAL_RELAYS) } catch {}
      }
      initRef.current = false
    }
  }, [])

  const initWalkieTalkie = async () => {
    let audioOk = false
    try {
      await audioService.init()
      audioOk = true
    } catch (err) {
      console.error('Audio init error (non-fatal):', err)
    }

    if (audioOk) {
      const stream = audioService.getStream()
      if (stream) {
        webRTCService.setLocalStream(stream)
      }
    }

    if (profile?.privateKeyEncrypted) {
      let privkey = profile.privateKeyEncrypted
      try {
        if (privkey.startsWith('nsec')) {
          const { nip19 } = await import('nostr-tools')
          const decoded = nip19.decode(privkey)
          if (decoded.type === 'nsec') {
            privkey = Array.from(decoded.data as Uint8Array)
              .map(b => b.toString(16).padStart(2, '0'))
              .join('')
          }
        }
      } catch (err) {
        console.error('Key decode error:', err)
        setError('Error al decodificar llave Nostr.')
        return
      }

      try {
        const { SimplePool, finalizeEvent, getPublicKey } = await import('nostr-tools')
        const pool = new SimplePool()
        poolRef.current = pool
        const sk = new Uint8Array(privkey.match(/.{1,2}/g)!.map(b => parseInt(b, 16)))
        const pubkey = getPublicKey(sk)

        webRTCService.setConfig({
          onSignal: (targetPubkey, signal) => {
            console.log('[WT] Sending signal to', targetPubkey.slice(0, 8), typeof signal)
            const event = {
              kind: SIGNAL_KIND,
              pubkey,
              created_at: Math.floor(Date.now() / 1000),
              tags: [['p', targetPubkey]],
              content: JSON.stringify(signal)
            }
            const signed = finalizeEvent(event, sk)
            const promises = pool.publish(SIGNAL_RELAYS, signed)
            Promise.allSettled(promises).then(results => {
              results.forEach((r, i) => {
                if (r.status === 'rejected') console.error('[WT] Relay', i, 'rejected signal:', r.reason)
                else console.log('[WT] Relay', i, 'accepted signal:', String(r.value).slice(0, 16))
              })
            })
          },
          onData: (fromPubkey, data) => {
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'chat' && parsed.text) {
                addChatMessage(fromPubkey, {
                  id: crypto.randomUUID(),
                  pubkey: fromPubkey,
                  text: parsed.text,
                  timestamp: Date.now()
                })
              }
            } catch {}
          },
          onStream: (fromPubkey, stream) => {
            audioService.addPeerAudio(fromPubkey, stream)
          },
          onConnect: (pubkey) => {
            const msgs = pendingMessagesRef.current
            pendingMessagesRef.current = []
            msgs.forEach(text => {
              webRTCService.sendData(pubkey, JSON.stringify({ type: 'chat', text }))
            })
          },
          onDisconnect: () => {}
        })

        const sub = pool.subscribeMany(SIGNAL_RELAYS, { kinds: [SIGNAL_KIND], '#p': [pubkey] }, {
          onevent: (event: any) => {
            console.log('[WT] Incoming signal from', event.pubkey.slice(0, 8), 'kind:', event.kind)
            try {
              const signalData = JSON.parse(event.content)
              webRTCService.signalPeer(event.pubkey, signalData)
            } catch (e) {
              console.error('[WT] Failed to parse signal:', e)
            }
          }
        })
        subRef.current = sub

        const presenceSub = pool.subscribeMany(SIGNAL_RELAYS, { kinds: [PRESENCE_KIND], limit: 100 }, {
          onevent: (event: any) => {
            if (event.pubkey === pubkey) return
            if (seenPeersRef.current.has(event.pubkey)) return
            seenPeersRef.current.add(event.pubkey)
            console.log('[WT] Presence event from', event.pubkey.slice(0, 8))
            try {
              const data = JSON.parse(event.content || '{}')
              addPeer({
                id: event.pubkey,
                pubkey: event.pubkey,
                username: data.username || event.pubkey.slice(0, 8),
                signal: -50,
                protocol: 'nostr',
                lastSeen: Date.now()
              })
            } catch (e) {
              console.error('[WT] Failed to parse presence:', e)
            }
          },
          oneose: () => {
            console.log('[WT] Presence subscription EOSE received')
          }
        })
        presenceSubRef.current = presenceSub

        const presenceEvent = {
          kind: PRESENCE_KIND,
          pubkey,
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ username: profile?.username || profile?.displayName || 'Peer', online: true })
        }
        const signedPresence = finalizeEvent(presenceEvent, sk)
        Promise.allSettled(pool.publish(SIGNAL_RELAYS, signedPresence)).catch(() => {})

        console.log('[WT] Signal+Presence subscription active for', pubkey.slice(0, 8))
      } catch (err) {
        console.error('Nostr init error:', err)
        setError('Error al conectar con relays Nostr.')
        return
      }
    }

    setIsInit(true)
    if (!audioOk) setError('Micrófono no disponible. Los mensajes de texto funcionan.')
  }

  const sendChatMessage = useCallback(() => {
    const text = chatText.trim()
    if (!text || !selectedPeerId || !profile) return

    if (!webRTCService.isConnected(selectedPeerId)) {
      pendingMessagesRef.current.push(text)
      webRTCService.startCall(selectedPeerId)
    } else {
      webRTCService.sendData(selectedPeerId, JSON.stringify({ type: 'chat', text }))
    }

    addChatMessage(selectedPeerId, {
      id: crypto.randomUUID(),
      pubkey: profile.publicKey,
      text,
      timestamp: Date.now()
    })
    setChatText('')
  }, [chatText, selectedPeerId, profile, addChatMessage])

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

  const deactivatePTT = useCallback(() => {
    audioService.stopPTT()
    setPTTActive(false)
    setIsSpeaking(false)
  }, [setPTTActive])

  const handlePTTStart = useCallback(() => {
    if (pttMode === 'hold') activatePTT()
  }, [pttMode, activatePTT])

  const handlePTTEnd = useCallback(() => {
    if (pttMode === 'hold') deactivatePTT()
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendChatMessage()
    }
  }

  const currentMessages = selectedPeerId ? (chatMessages[selectedPeerId] || []) : []
  const webrtcConnected = selectedPeerId ? webRTCService.isConnected(selectedPeerId) : false

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {error && (
        <div className="bg-red-900/30 text-red-400 px-4 py-2 rounded-lg text-sm text-center mb-2">
          {error}
        </div>
      )}

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
              onClick={() => {
                setSelectedPeerId(peer.pubkey)
                if (!webRTCService.hasPeer(peer.pubkey)) {
                  webRTCService.startCall(peer.pubkey)
                }
              }}
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

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          name="chatMessage"
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
          <span className={`px-2 py-1 rounded ${webrtcConnected ? 'bg-green-900/30 text-green-400' : 'bg-slate-800'}`}>
            WebRTC: {webrtcConnected ? 'OK' : '--'}
          </span>
        </div>

        {pendingMessagesRef.current.length > 0 && (
          <p className="text-xs text-yellow-400">
            {pendingMessagesRef.current.length} mensaje(s) pendiente(s) — conectando...
          </p>
        )}

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
