const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
]

export interface PeerConnection {
  pc: RTCPeerConnection
  pubkey: string
  connected: boolean
  dataChannel: RTCDataChannel | null
}

export interface WebRTCConfig {
  onSignal: (pubkey: string, signal: { type: string; sdp?: string; candidate?: string; sdpMid?: string; sdpMLineIndex?: number }) => void
  onData: (pubkey: string, data: string) => void
  onStream: (pubkey: string, stream: MediaStream) => void
  onConnect: (pubkey: string) => void
  onDisconnect: (pubkey: string) => void
}

class WebRTCService {
  private peers: Map<string, PeerConnection> = new Map()
  private localStream: MediaStream | null = null
  private config: WebRTCConfig = {
    onSignal: () => {},
    onData: () => {},
    onStream: () => {},
    onConnect: () => {},
    onDisconnect: () => {}
  }

  setConfig(config: Partial<WebRTCConfig>) {
    Object.assign(this.config, config)
  }

  setLocalStream(stream: MediaStream | null) {
    this.localStream = stream
  }

  addTracksToAllPeers(stream: MediaStream) {
    this.peers.forEach((conn) => {
      if (conn.connected) {
        stream.getTracks().forEach(track => {
          try { conn.pc.addTrack(track, stream) } catch {}
        })
      }
    })
  }

  startCall(pubkey: string): boolean {
    if (this.peers.has(pubkey)) return false
    console.log('[WRT] startCall', pubkey.slice(0, 8))
    this.createPeerInternal(pubkey, true)
    return true
  }

  signalPeer(pubkey: string, signal: any) {
    const conn = this.peers.get(pubkey)
    if (conn) {
      const kind = signal.type || 'candidate'
      console.log('[WRT] signalPeer existing', pubkey.slice(0, 8), kind)
      this.applySignal(conn, signal)
    } else {
      console.log('[WRT] signalPeer new peer', pubkey.slice(0, 8))
      this.createPeerInternal(pubkey, false)
      const newConn = this.peers.get(pubkey)
      if (newConn) {
        this.applySignal(newConn, signal)
      }
    }
  }

  private async applySignal(conn: PeerConnection, signal: any) {
    try {
      if (signal.type === 'offer') {
        await conn.pc.setRemoteDescription(new RTCSessionDescription(signal))
        const answer = await conn.pc.createAnswer()
        await conn.pc.setLocalDescription(answer)
        this.config.onSignal(conn.pubkey, { type: 'answer', sdp: answer.sdp || '' })
      } else if (signal.type === 'answer') {
        await conn.pc.setRemoteDescription(new RTCSessionDescription(signal))
      } else if (signal.candidate) {
        try {
          await conn.pc.addIceCandidate(new RTCIceCandidate(signal))
        } catch (e) {
          // ignore invalid candidates
        }
      }
    } catch (err) {
      console.error('[WRT] applySignal error:', err)
    }
  }

  private createPeerInternal(pubkey: string, initiator: boolean) {
    console.log('[WRT] createPeerInternal', pubkey.slice(0, 8), initiator ? 'initiator' : 'responder')

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    let dataChannel: RTCDataChannel | null = null

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!)
      })
    }

    if (initiator) {
      dataChannel = pc.createDataChannel('chat')
      dataChannel.onopen = () => {
        console.log('[WRT] dataChannel open', pubkey.slice(0, 8))
        const conn = this.peers.get(pubkey)
        if (conn) conn.connected = true
        this.config.onConnect(pubkey)
      }
      dataChannel.onclose = () => {
        console.log('[WRT] dataChannel closed', pubkey.slice(0, 8))
      }
      dataChannel.onmessage = (event) => {
        console.log('[WRT] data received from', pubkey.slice(0, 8), String(event.data).slice(0, 60))
        this.config.onData(pubkey, String(event.data))
      }
    } else {
      pc.ondatachannel = (event) => {
        dataChannel = event.channel
        const conn = this.peers.get(pubkey)
        if (conn) conn.dataChannel = dataChannel
        dataChannel.onopen = () => {
          console.log('[WRT] dataChannel open', pubkey.slice(0, 8))
          if (conn) conn.connected = true
          this.config.onConnect(pubkey)
        }
        dataChannel.onclose = () => {
          console.log('[WRT] dataChannel closed', pubkey.slice(0, 8))
        }
        dataChannel.onmessage = (event) => {
          console.log('[WRT] data received from', pubkey.slice(0, 8), String(event.data).slice(0, 60))
          this.config.onData(pubkey, String(event.data))
        }
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.config.onSignal(pubkey, {
          type: 'candidate',
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid || '',
          sdpMLineIndex: event.candidate.sdpMLineIndex || 0
        })
      }
    }

    pc.ontrack = (event) => {
      console.log('[WRT] stream received from', pubkey.slice(0, 8))
      if (event.streams[0]) {
        this.config.onStream(pubkey, event.streams[0])
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        console.log('[WRT] disconnected from', pubkey.slice(0, 8))
        this.peers.delete(pubkey)
        this.config.onDisconnect(pubkey)
      }
    }

    const conn: PeerConnection = { pc, pubkey, connected: false, dataChannel }
    this.peers.set(pubkey, conn)

    if (initiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          this.config.onSignal(pubkey, { type: 'offer', sdp: pc.localDescription?.sdp || '' })
        })
        .catch(err => console.error('[WRT] createOffer error:', err))
    }
  }

  sendData(pubkey: string, data: string) {
    const conn = this.peers.get(pubkey)
    if (conn && conn.dataChannel && conn.dataChannel.readyState === 'open') {
      conn.dataChannel.send(data)
    }
  }

  getConnectedPeers(): string[] {
    return Array.from(this.peers.entries())
      .filter(([_, conn]) => conn.connected)
      .map(([pubkey]) => pubkey)
  }

  hasPeer(pubkey: string): boolean {
    return this.peers.has(pubkey)
  }

  getPeer(pubkey: string): PeerConnection | undefined {
    return this.peers.get(pubkey)
  }

  getAllPeers(): PeerConnection[] {
    return Array.from(this.peers.values())
  }

  isConnected(pubkey: string): boolean {
    return this.peers.get(pubkey)?.connected ?? false
  }

  disconnect(pubkey: string) {
    const conn = this.peers.get(pubkey)
    if (conn) {
      conn.pc.close()
      this.peers.delete(pubkey)
    }
  }

  broadcast(data: string) {
    this.peers.forEach((conn) => {
      if (conn.dataChannel && conn.dataChannel.readyState === 'open') {
        conn.dataChannel.send(data)
      }
    })
  }

  disconnectAll() {
    this.peers.forEach((conn) => conn.pc.close())
    this.peers.clear()
  }

  get peerCount() { return this.peers.size }
}

export const webRTCService = new WebRTCService()
