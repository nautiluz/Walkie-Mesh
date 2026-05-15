import { useState, useRef, useCallback, useEffect } from 'react'
import { useMeshStore } from '../../store/meshStore'
import { useUserStore } from '../../store/userStore'
import { audioService } from '../../services/audio'
import { webRTCService } from '../../services/webrtc'
import { useSettingsStore } from '../../store/settingsStore'
import { SimplePool, finalizeEvent, getPublicKey, nip19 } from 'nostr-tools'

const SIGNAL_KIND = 2000
const PRESENCE_KIND = 2001
const MSG_KIND = 2002
const SIGNAL_RELAYS = ['wss://nos.lol', 'wss://relay.damus.io']

function npubToHex(encoded: string): string | null {
  try {
    if (encoded.startsWith('npub')) {
      const decoded = nip19.decode(encoded)
      if (decoded.type === 'npub') return decoded.data as string
    }
    if (/^[0-9a-f]{64}$/i.test(encoded)) return encoded
    return null
  } catch { return null }
}

function hexToSk(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)))
}

export function WalkieTalkie() {
  const { isPTTActive, setPTTActive, peers, selectedPeerId, setSelectedPeerId, chatMessages, addChatMessage, addPeer } = useMeshStore()
  const { pttMode, vadEnabled } = useSettingsStore()
  const { profile } = useUserStore()
  const [isInit, setIsInit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [toggleLock, setToggleLock] = useState(false)
  const [chatText, setChatText] = useState('')
  const [npubInput, setNpubInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const pressTimer = useRef<number | null>(null)
  const initRef = useRef(false)
  const poolRef = useRef<SimplePool | null>(null)
  const seenMsgRef = useRef<Set<string>>(new Set())
  const seenPeersRef = useRef<Set<string>>(new Set())

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
      poolRef.current?.close(SIGNAL_RELAYS)
      initRef.current = false
    }
  }, [])

  function addIncoming(fromPubkey: string, msgId: string, text: string) {
    if (seenMsgRef.current.has(msgId)) return
    seenMsgRef.current.add(msgId)
    addChatMessage(fromPubkey, { id: msgId, pubkey: fromPubkey, text, timestamp: Date.now() })
  }

  function publish(kind: number, tags: string[][], content: string, sk: Uint8Array) {
    const pool = poolRef.current
    if (!pool) return
    const pubkey = getPublicKey(sk)
    const event = { kind, pubkey, created_at: Math.floor(Date.now() / 1000), tags, content }
    Promise.allSettled(pool.publish(SIGNAL_RELAYS, finalizeEvent(event, sk)))
  }

  const initWalkieTalkie = async () => {
    let audioOk = false
    try {
      await audioService.init()
      audioOk = true
      const stream = audioService.getStream()
      if (stream) webRTCService.setLocalStream(stream)
    } catch (err) {
      console.error('Audio init error (non-fatal):', err)
    }

    if (!profile?.privateKeyEncrypted) {
      setIsInit(true)
      if (!audioOk) setError('Micrófono no disponible.')
      return
    }

    let privkey = profile.privateKeyEncrypted
    try {
      if (privkey.startsWith('nsec')) {
        const decoded = nip19.decode(privkey)
        if (decoded.type === 'nsec') {
          privkey = Array.from(decoded.data as Uint8Array).map(b => b.toString(16).padStart(2, '0')).join('')
        }
      }
    } catch {
      setError('Error al decodificar llave.')
      setIsInit(true)
      return
    }

    if (!/^[0-9a-f]{64}$/i.test(privkey)) {
      setError('Llave inválida.')
      setIsInit(true)
      return
    }

    try {
      const pool = new SimplePool()
      poolRef.current = pool
      const sk = hexToSk(privkey)
      const pubkey = getPublicKey(sk)

      webRTCService.setConfig({
        onSignal: (target, signal) => publish(SIGNAL_KIND, [['p', target]], JSON.stringify(signal), sk),
        onData: (from, data) => {
          try {
            const p = JSON.parse(data)
            if (p.type === 'chat' && p.text) addIncoming(from, p.id || crypto.randomUUID(), p.text)
          } catch {}
        },
        onStream: (from, stream) => audioService.addPeerAudio(from, stream),
        onConnect: () => {},
        onDisconnect: () => {}
      })

      pool.subscribeMany(SIGNAL_RELAYS, { kinds: [SIGNAL_KIND], '#p': [pubkey] }, {
        onevent: (e: any) => {
          try { webRTCService.signalPeer(e.pubkey, JSON.parse(e.content)) }
          catch {}
        }
      })

      pool.subscribeMany(SIGNAL_RELAYS, { kinds: [MSG_KIND], '#p': [pubkey] }, {
        onevent: (e: any) => {
          try {
            const data = JSON.parse(e.content)
            if (data.text) addIncoming(e.pubkey, e.id || crypto.randomUUID(), data.text)
          } catch {}
        }
      })

      pool.subscribeMany(SIGNAL_RELAYS, { kinds: [PRESENCE_KIND], limit: 100 }, {
        onevent: (e: any) => {
          if (e.pubkey === pubkey || seenPeersRef.current.has(e.pubkey)) return
          seenPeersRef.current.add(e.pubkey)
          try {
            const data = JSON.parse(e.content || '{}')
            addPeer({ id: e.pubkey, pubkey: e.pubkey, username: data.username || e.pubkey.slice(0, 8), signal: -50, protocol: 'nostr', lastSeen: Date.now() })
          } catch {}
        }
      })

      publish(PRESENCE_KIND, [], JSON.stringify({ username: profile?.username || profile?.displayName || 'Peer', online: true }), sk)

      console.log('[WT] Init OK', pubkey.slice(0, 8))
    } catch (err) {
      console.error('Nostr init error:', err)
      setError('Error al conectar con relays.')
    }

    setIsInit(true)
    if (!audioOk) setError('Micrófono no disponible. Solo texto.')
  }

  const connectByNpub = useCallback(() => {
    const hex = npubToHex(npubInput.trim())
    if (!hex) return
    setNpubInput('')
    if (seenPeersRef.current.has(hex)) return
    seenPeersRef.current.add(hex)
    addPeer({ id: hex, pubkey: hex, username: hex.slice(0, 8), signal: -50, protocol: 'nostr', lastSeen: Date.now() })
    setSelectedPeerId(hex)
  }, [npubInput, addPeer, setSelectedPeerId])

  const sendChatMessage = useCallback(() => {
    const text = chatText.trim()
    if (!text || !selectedPeerId) return
    const msgId = crypto.randomUUID()
    setChatText('')

    if (webRTCService.isConnected(selectedPeerId)) {
      webRTCService.sendData(selectedPeerId, JSON.stringify({ type: 'chat', text, id: msgId }))
    }

    if (poolRef.current && profile?.privateKeyEncrypted) {
      let pk = profile.privateKeyEncrypted
      try {
        if (pk.startsWith('nsec')) {
          const d = nip19.decode(pk)
          if (d.type === 'nsec') pk = Array.from(d.data as Uint8Array).map(b => b.toString(16).padStart(2, '0')).join('')
        }
      } catch {}
      if (/^[0-9a-f]{64}$/i.test(pk)) {
        const sk = hexToSk(pk)
        publish(MSG_KIND, [['p', selectedPeerId]], JSON.stringify({ text, id: msgId }), sk)
      }
    }

    addChatMessage(selectedPeerId, { id: msgId, pubkey: profile?.publicKey || '', text, timestamp: Date.now() })
  }, [chatText, selectedPeerId, profile])

  const activatePTT = useCallback(() => {
    if (!isInit || !selectedPeerId) return
    const s = audioService.getStream()
    if (!s) return
    webRTCService.setLocalStream(s)
    if (!webRTCService.hasPeer(selectedPeerId)) webRTCService.startCall(selectedPeerId)
    webRTCService.addTracksToAllPeers(s)
    audioService.startPTT(() => {}, sk => setIsSpeaking(sk))
    setPTTActive(true)
  }, [isInit, selectedPeerId, setPTTActive])

  const deactivatePTT = useCallback(() => {
    audioService.stopPTT()
    setPTTActive(false)
    setIsSpeaking(false)
  }, [setPTTActive])

  const handleToggle = useCallback(() => {
    if (pttMode === 'toggle') {
      if (toggleLock) { deactivatePTT(); setToggleLock(false) }
      else { activatePTT(); setToggleLock(true) }
    }
  }, [pttMode, toggleLock, activatePTT, deactivatePTT])

  const currentMessages = selectedPeerId ? (chatMessages[selectedPeerId] || []) : []
  const webrtcConnected = selectedPeerId ? webRTCService.isConnected(selectedPeerId) : false
  const selectedPeer = peers.find(p => p.pubkey === selectedPeerId)

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {error && <div className="bg-red-900/30 text-red-400 px-4 py-2 rounded-lg text-sm text-center mb-2">{error}</div>}

      <div className="mb-3 space-y-2">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Pares detectados</p>
        <div className="flex flex-wrap gap-2">
          {peers.length === 0 && <p className="text-xs text-slate-500 italic">Esperando pares...</p>}
          {peers.map(p => (
            <button key={p.id} onClick={() => setSelectedPeerId(p.pubkey)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedPeerId === p.pubkey ? 'bg-mesh-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >{p.username}</button>
          ))}
        </div>

        <div className="flex gap-2">
          <input type="text" value={npubInput} onChange={e => setNpubInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') connectByNpub() }}
            placeholder="Pega npub para conectar..."
            className="flex-1 bg-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:ring-1 focus:ring-mesh-500"
          />
          <button onClick={connectByNpub}
            className="px-3 py-2 bg-mesh-600 hover:bg-mesh-500 rounded-xl text-xs font-medium transition-colors"
          >+</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mb-3 space-y-2 bg-slate-900/50 rounded-xl p-3">
        {!selectedPeerId ? (
          <div className="flex items-center justify-center h-full text-xs text-slate-500">Selecciona o pega un npub arriba</div>
        ) : currentMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-slate-500">Sin mensajes aún. Escribe abajo.</div>
        ) : (
          currentMessages.map(m => (
            <div key={m.id} className={`flex ${m.pubkey === profile?.publicKey ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${m.pubkey === profile?.publicKey ? 'bg-mesh-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                {m.text}
                <div className="text-[10px] opacity-50 mt-0.5 text-right">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="flex gap-2 mb-3">
        <input type="text" name="chatMessage" value={chatText}
          onChange={e => setChatText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
          placeholder="Escribe un mensaje..." disabled={!selectedPeerId}
          className="flex-1 bg-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-500 disabled:opacity-40 outline-none focus:ring-1 focus:ring-mesh-500"
        />
        <button onClick={sendChatMessage} disabled={!selectedPeerId || !chatText.trim()}
          className="px-4 py-2 bg-mesh-600 hover:bg-mesh-500 disabled:opacity-40 rounded-xl text-sm font-medium transition-colors"
        >Enviar</button>
      </div>

      <div className="flex flex-col items-center gap-3 pb-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide text-center">
          {selectedPeer ? `Hablando con: ${selectedPeer.username}` : 'Conecta con un npub arriba'}
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className={`px-2 py-1 rounded ${isInit ? 'bg-green-900/30 text-green-400' : 'bg-slate-800'}`}>Mic: {isInit ? 'OK' : '--'}</span>
          <span className={`px-2 py-1 rounded ${webrtcConnected ? 'bg-green-900/30 text-green-400' : 'bg-slate-800'}`}>WebRTC: {webrtcConnected ? 'OK' : '--'}</span>
          <span className={`px-2 py-1 rounded ${poolRef.current ? 'bg-green-900/30 text-green-400' : 'bg-slate-800'}`}>Red: {poolRef.current ? 'OK' : '--'}</span>
        </div>
        <button disabled={!selectedPeerId}
          onMouseDown={() => { if (pttMode === 'hold') { if (!webRTCService.hasPeer(selectedPeerId!)) webRTCService.startCall(selectedPeerId!); audioService.startPTT(() => {}, s => setIsSpeaking(s)); setPTTActive(true) } }}
          onMouseUp={() => { if (pttMode === 'hold') { audioService.stopPTT(); setPTTActive(false); setIsSpeaking(false) } }}
          onMouseLeave={() => { if (pttMode === 'hold') { audioService.stopPTT(); setPTTActive(false); setIsSpeaking(false) } }}
          onTouchStart={e => { e.preventDefault(); if (pttMode === 'hold') { pressTimer.current = window.setTimeout(() => handleToggle(), 500); activatePTT() } else { handleToggle() } }}
          onTouchEnd={e => { e.preventDefault(); if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }; if (pttMode === 'hold') deactivatePTT() }}
          className={`ptt-button w-36 h-36 rounded-full flex flex-col items-center justify-center gap-2 font-bold text-lg transition-all duration-150 select-none ${!selectedPeerId ? 'bg-slate-800 opacity-40 cursor-not-allowed' : isPTTActive ? 'bg-red-600 shadow-[0_0_40px_rgba(220,38,38,0.5)] scale-105' : 'bg-slate-800 shadow-lg hover:bg-slate-700 active:scale-95'}`}
        >
          <span className="text-3xl">{isPTTActive ? '🔴' : '🎙'}</span>
          <span className="text-sm">{isPTTActive ? (isSpeaking ? 'Hablando...' : 'Transmitiendo') : 'PTT'}</span>
        </button>
        {vadEnabled && isPTTActive && (
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-green-500' : 'bg-slate-600'}`} />
            <span className="text-xs text-slate-400">{isSpeaking ? 'Voz detectada' : 'Esperando voz...'}</span>
          </div>
        )}
        <p className="text-xs text-slate-500">{pttMode === 'hold' ? 'Mantén presionado para hablar' : 'Toca para activar/desactivar'}</p>
      </div>
    </div>
  )
}