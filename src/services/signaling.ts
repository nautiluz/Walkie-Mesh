import { getPublicKeyFromPrivate } from './nostr'

const PRESENCE_KIND = 2001

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

const SIGNAL_RELAYS = ['wss://nos.lol', 'wss://relay.damus.io']

export async function publishPresence(username: string) {
  if (!privateKeyHex || !relayPool || !publicKey) return
  try {
    const { finalizeEvent } = await import('nostr-tools')
    const sk = new Uint8Array(privateKeyHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)))
    const event = {
      kind: PRESENCE_KIND,
      pubkey: publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify({ username, online: true })
    }
    const signed = finalizeEvent(event, sk)
    await relayPool.publish(SIGNAL_RELAYS, signed)
  } catch (err) {
    console.error('Presence publish error:', err)
  }
}

export function subscribeToPresence(onPresence: (pubkey: string, username: string) => void) {
  if (!relayPool) return null
  const filter = { kinds: [PRESENCE_KIND], limit: 100 }
  try {
    return relayPool.subscribeMany(SIGNAL_RELAYS, filter, {
      onevent: (event: any) => {
        try {
          const data = JSON.parse(event.content)
          onPresence(event.pubkey, data.username || event.pubkey.slice(0, 8))
        } catch { /* ignore */ }
      }
    })
  } catch {
    return null
  }
}
