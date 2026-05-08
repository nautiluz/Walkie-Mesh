import { generateSecretKey, getPublicKey, nip19, SimplePool, type Event, type Filter } from 'nostr-tools'

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

let pool: SimplePool | null = null
const defaultRelays = [
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://relay.nostr.info'
]

const relayUrls: string[] = (import.meta.env.VITE_NOSTR_RELAYS || defaultRelays.join(',')).split(',')

function getPool(): SimplePool {
  if (!pool) {
    pool = new SimplePool()
  }
  return pool
}

export function generateKeyPair() {
  const sk = generateSecretKey()
  const pk = getPublicKey(sk)
  return {
    privateKey: bytesToHex(sk),
    publicKey: pk,
    nsec: nip19.nsecEncode(sk),
    npub: nip19.npubEncode(pk)
  }
}

export function getPublicKeyFromPrivate(privateKeyHex: string): string {
  return getPublicKey(hexToBytes(privateKeyHex))
}

export function isValidPublicKey(pubkey: string): boolean {
  return /^[0-9a-f]{64}$/i.test(pubkey)
}

export async function publishEvent(event: Omit<Event, 'id' | 'sig'>) {
  const p = getPool()
  return p.publish(relayUrls, event as Event)
}

export async function subscribeEvents(filter: Filter, onEvent: (event: Event) => void) {
  const p = getPool()
  const sub = p.subscribeMany(relayUrls, filter, { onevent: onEvent })
  return sub
}

export function closePool() {
  if (pool) {
    pool.close(relayUrls)
    pool = null
  }
}

export function createTextEvent(
  privateKeyHex: string,
  content: string,
  tags: string[][] = []
) {
  const sk = hexToBytes(privateKeyHex)
  const pubkey = getPublicKey(sk)
  const event: Event = {
    kind: 1,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
    id: '',
    sig: ''
  }
  return event
}

export async function publishProfileMetadata(
  privateKeyHex: string,
  metadata: { name: string; display_name?: string; about?: string; picture?: string }
) {
  const sk = hexToBytes(privateKeyHex)
  const pubkey = getPublicKey(sk)
  const { finalizeEvent } = await import('nostr-tools')

  const event = {
    kind: 0,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [] as string[][],
    content: JSON.stringify(metadata)
  }

  const signed = finalizeEvent(event, sk)
  const p = getPool()

  try {
    const relays = relayUrls.length > 0 ? relayUrls : defaultRelays
    await p.publish(relays, signed)
    return true
  } catch (err) {
    console.error('Failed to publish kind0:', err)
    return false
  }
}

export function npubToHex(npub: string): string | null {
  try {
    const decoded = nip19.decode(npub)
    if (decoded.type === 'npub') return decoded.data as string
    return null
  } catch {
    return null
  }
}

export function hexToNpub(hex: string): string {
  return nip19.npubEncode(hex)
}

export { nip19 }
