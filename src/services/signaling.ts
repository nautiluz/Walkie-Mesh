import { getPublicKeyFromPrivate } from './nostr'
import { webRTCService } from './webrtc'
import SimplePeer from 'simple-peer'

const SIGNAL_KIND = 2000

let privateKeyHex: string | null = null
let publicKey: string | null = null
let relayPool: any = null

export function initSignaling(privkey: string, pool: any) {
  privateKeyHex = privkey
  publicKey = getPublicKeyFromPrivate(privkey)
  relayPool = pool
}

export function getPublicKeyForSignaling() {
  return publicKey
}

export function subscribeToSignals(onSignal: (fromPubkey: string, signal: SimplePeer.SignalData) => void) {
  if (!relayPool || !publicKey) return null

  const filters = [{ kinds: [SIGNAL_KIND], '#p': [publicKey] }]
  const sub = relayPool.subscribeMany(
    ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.nostr.info'],
    filters,
    {
      onevent: (event: any) => {
        try {
          const tag = event.tags.find((t: string[]) => t[0] === 'p')
          if (!tag) return
          const signalData = JSON.parse(event.content)
          onSignal(event.pubkey, signalData)
        } catch { /* ignore malformed signals */ }
      }
    }
  )
  return sub
}

export async function sendSignal(targetPubkey: string, signal: SimplePeer.SignalData) {
  if (!privateKeyHex || !relayPool) return

  const event = {
    kind: SIGNAL_KIND,
    pubkey: publicKey!,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['p', targetPubkey]],
    content: JSON.stringify(signal)
  }

  const { finalizeEvent } = await import('nostr-tools')
  const sk = new Uint8Array(privateKeyHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)))
  const signedEvent = finalizeEvent(event, sk)

  try {
    await relayPool.publish(['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.nostr.info'], signedEvent)
  } catch (err) {
    console.error('Signal publish error:', err)
  }
}

export function connectToPeer(
  targetPubkey: string,
  initiator: boolean,
  localStream: MediaStream | null,
  onData: (data: string) => void,
  onStream?: (stream: MediaStream) => void
) {
  const peer = webRTCService.createPeer(
    targetPubkey,
    initiator,
    (signal) => {
      sendSignal(targetPubkey, signal)
    },
    onData,
    () => {
      console.log(`Connected to peer: ${targetPubkey}`)
    },
    () => {
      console.log(`Disconnected from peer: ${targetPubkey}`)
    }
  )

  if (localStream) {
    localStream.getTracks().forEach(track => {
      peer.addTrack(track, localStream)
    })
  }

  peer.on('stream', (stream: MediaStream) => {
    onStream?.(stream)
  })

  return peer
}
