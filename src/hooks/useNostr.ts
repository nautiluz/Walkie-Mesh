import { useState, useCallback } from 'react'
import { generateKeyPair, getPublicKeyFromPrivate, npubToHex, isValidPublicKey, nip19 } from '../services/nostr'

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

export function useNostr() {
  const [isGenerating, setIsGenerating] = useState(false)

  const createIdentity = useCallback(() => {
    setIsGenerating(true)
    const keys = generateKeyPair()
    setIsGenerating(false)
    return keys
  }, [])

  const importIdentity = useCallback((nsecOrHex: string) => {
    let privateKeyHex: string | null = null
    if (nsecOrHex.startsWith('nsec')) {
      try {
        const decoded = nip19.decode(nsecOrHex)
        if (decoded.type === 'nsec') {
          privateKeyHex = Array.from(decoded.data as Uint8Array)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
        }
      } catch {
        return null
      }
    } else if (/^[0-9a-f]{64}$/i.test(nsecOrHex)) {
      privateKeyHex = nsecOrHex
    }

    if (!privateKeyHex) return null

    const publicKey = getPublicKeyFromPrivate(privateKeyHex)
    return {
      privateKey: privateKeyHex,
      publicKey,
      nsec: nip19.nsecEncode(hexToBytes(privateKeyHex)),
      npub: nip19.npubEncode(publicKey)
    }
  }, [])

  const resolvePubkey = useCallback((input: string) => {
    if (isValidPublicKey(input)) return input
    if (input.startsWith('npub')) return npubToHex(input)
    return null
  }, [])

  return {
    isGenerating,
    createIdentity,
    importIdentity,
    resolvePubkey
  }
}
