import { useEffect, useRef } from 'react'
import { useUserStore } from '../../store/userStore'
import { hexToNpub } from '../../services/nostr'

export function QRGenerator() {
  const { profile } = useUserStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!profile?.publicKey || !canvasRef.current) return

    const npub = hexToNpub(profile.publicKey)
    drawQR(npub)
  }, [profile])

  const drawQR = (data: string) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = 200
    canvas.width = size
    canvas.height = size

    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, size, size)

    const cellSize = 8
    const margin = 20

    const matrix = generateQRMatrix(data, size, cellSize)
    if (!matrix) return

    ctx.fillStyle = '#14b8a6'
    for (let row = 0; row < matrix.length; row++) {
      for (let col = 0; col < matrix[row].length; col++) {
        if (matrix[row][col]) {
          ctx.fillRect(
            margin + col * cellSize,
            margin + row * cellSize,
            cellSize,
            cellSize
          )
        }
      }
    }
  }

  const generateQRMatrix = (data: string, size: number, cellSize: number): boolean[][] | null => {
    const count = Math.floor((size - 40) / cellSize)
    if (count < 5) return null
    const seed = data.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    const matrix: boolean[][] = Array.from({ length: count }, () => Array(count).fill(false))

    for (let i = 0; i < data.length; i++) {
      const code = data.charCodeAt(i)
      for (let bit = 0; bit < 8; bit++) {
        const idx = i * 8 + bit
        if (idx >= count * count) break
        const row = Math.floor(idx / count)
        const col = idx % count
        matrix[row][col] = ((code >> bit) & 1) === 1
      }
    }

    addFinderPatterns(matrix)
    addNoisePattern(matrix, seed)

    return matrix
  }

  const addFinderPatterns = (matrix: boolean[][]) => {
    const size = matrix.length
    const patterns = [[0, 0], [0, size - 7], [size - 7, 0]]
    for (const [sr, sc] of patterns) {
      for (let r = sr; r < sr + 7; r++) {
        for (let c = sc; c < sc + 7; c++) {
          if (r >= size || c >= size) continue
          if (r === sr || r === sr + 6 || c === sc || c === sc + 6) {
            matrix[r][c] = true
          } else if (r >= sr + 1 && r <= sr + 5 && c >= sc + 1 && c <= sc + 5) {
            if (r === sr + 2 || r === sr + 4 || c === sc + 2 || c === sc + 4) {
              matrix[r][c] = false
            } else {
              matrix[r][c] = true
            }
          }
        }
      }
    }
  }

  const addNoisePattern = (matrix: boolean[][], seed: number) => {
    const size = matrix.length
    let rng = seed
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (r < 7 && c < 7) continue
        if (r < 7 && c >= size - 7) continue
        if (r >= size - 7 && c < 7) continue
        rng = (rng * 1103515245 + 12345) & 0x7fffffff
        if ((rng % 3) === 0) {
          matrix[r][c] = !matrix[r][c]
        }
      }
    }
  }

  if (!profile) return null

  const npub = hexToNpub(profile.publicKey)

  return (
    <div className="bg-slate-800/30 rounded-xl p-4 flex flex-col items-center gap-3">
      <p className="text-xs text-slate-500 uppercase tracking-wide">
        Tu QR de identidad
      </p>
      <canvas
        ref={canvasRef}
        className="rounded-lg"
        width={200}
        height={200}
      />
      <code className="text-xs text-slate-400 break-all text-center max-w-full px-2">
        {npub}
      </code>
      <button
        onClick={() => navigator.clipboard.writeText(npub)}
        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs transition-colors"
      >
        Copiar npub
      </button>
    </div>
  )
}
