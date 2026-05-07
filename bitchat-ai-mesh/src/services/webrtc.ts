import SimplePeer from 'simple-peer'

export interface PeerConnection {
  peer: SimplePeer.Instance
  pubkey: string
  connected: boolean
}

class WebRTCService {
  private peers: Map<string, PeerConnection> = new Map()
  private localStream: MediaStream | null = null

  setLocalStream(stream: MediaStream) {
    this.localStream = stream
  }

  createPeer(
    pubkey: string,
    initiator: boolean,
    onSignal: (signal: SimplePeer.SignalData) => void,
    onData: (data: string) => void,
    onConnect?: () => void,
    onDisconnect?: () => void
  ): SimplePeer.Instance {
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

    peer.on('signal', (signal) => onSignal(signal))

    peer.on('data', (data) => {
      const msg = data instanceof Uint8Array ? new TextDecoder().decode(data) : data.toString()
      onData(msg)
    })

    peer.on('connect', () => {
      const conn = this.peers.get(pubkey)
      if (conn) conn.connected = true
      onConnect?.()
    })

    peer.on('close', () => {
      this.peers.delete(pubkey)
      onDisconnect?.()
    })

    peer.on('error', (err) => {
      console.error(`WebRTC error with ${pubkey}:`, err)
    })

    this.peers.set(pubkey, { peer, pubkey, connected: false })
    return peer
  }

  signalPeer(pubkey: string, signal: SimplePeer.SignalData) {
    const conn = this.peers.get(pubkey)
    if (conn) {
      conn.peer.signal(signal)
    }
  }

  sendData(pubkey: string, data: string) {
    const conn = this.peers.get(pubkey)
    if (conn && conn.connected) {
      conn.peer.send(data)
    }
  }

  broadcast(data: string) {
    this.peers.forEach((conn) => {
      if (conn.connected) {
        conn.peer.send(data)
      }
    })
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
