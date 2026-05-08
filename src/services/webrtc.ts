import SimplePeer from 'simple-peer'

export interface PeerConnection {
  peer: SimplePeer.Instance
  pubkey: string
  connected: boolean
}

export interface WebRTCConfig {
  onSignal: (pubkey: string, signal: SimplePeer.SignalData) => void
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
          try { conn.peer.addTrack(track, stream) } catch {}
        })
      }
    })
  }

  createPeer(
    pubkey: string,
    initiator: boolean,
    _onSignal: (signal: SimplePeer.SignalData) => void,
    _onData: (data: string) => void,
    _onConnect?: () => void,
    _onDisconnect?: () => void
  ): SimplePeer.Instance {
    this.createPeerInternal(pubkey, initiator)
    const conn = this.peers.get(pubkey)
    return conn!.peer
  }

  broadcast(data: string) {
    this.peers.forEach((conn) => {
      if (conn.connected) {
        conn.peer.send(data)
      }
    })
  }

  startCall(pubkey: string): boolean {
    if (this.peers.has(pubkey)) return false
    this.createPeerInternal(pubkey, true)
    return true
  }

  signalPeer(pubkey: string, signal: SimplePeer.SignalData) {
    const conn = this.peers.get(pubkey)
    if (conn) {
      conn.peer.signal(signal)
    } else {
      this.createPeerInternal(pubkey, false)
      const newConn = this.peers.get(pubkey)
      if (newConn) newConn.peer.signal(signal)
    }
  }

  private createPeerInternal(pubkey: string, initiator: boolean) {
    const peer = new SimplePeer({
      initiator,
      stream: this.localStream || undefined,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    })

    peer.on('signal', (signal) => this.config.onSignal(pubkey, signal))

    peer.on('data', (data) => {
      const msg = data instanceof Uint8Array ? new TextDecoder().decode(data) : data.toString()
      this.config.onData(pubkey, msg)
    })

    peer.on('stream', (stream) => this.config.onStream(pubkey, stream))

    peer.on('connect', () => {
      const conn = this.peers.get(pubkey)
      if (conn) conn.connected = true
      this.config.onConnect(pubkey)
    })

    peer.on('close', () => {
      this.peers.delete(pubkey)
      this.config.onDisconnect(pubkey)
    })

    peer.on('error', (err) => {
      console.error(`WebRTC error with ${pubkey}:`, err)
    })

    this.peers.set(pubkey, { peer, pubkey, connected: false })
  }

  sendData(pubkey: string, data: string) {
    const conn = this.peers.get(pubkey)
    if (conn && conn.connected) {
      conn.peer.send(data)
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
      conn.peer.destroy()
      this.peers.delete(pubkey)
    }
  }

  disconnectAll() {
    this.peers.forEach((conn) => conn.peer.destroy())
    this.peers.clear()
  }

  get peerCount() { return this.peers.size }
}

export const webRTCService = new WebRTCService()
