import { useEffect, useRef } from 'react'
import { useCamera } from '../../hooks/useCamera'
import { useMeshStore } from '../../store/meshStore'

export function AROverlay() {
  const { videoRef, stream, isActive, error, startCamera, stopCamera } = useCamera()
  const { peers } = useMeshStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    startCamera('environment')
    return () => stopCamera()
  }, [])

  useEffect(() => {
    if (!isActive || !canvasRef.current) return
    const animate = () => {
      drawOverlay()
      requestAnimationFrame(animate)
    }
    animate()
  }, [isActive, peers])

  const drawOverlay = () => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = video.videoWidth || 320
    canvas.height = video.videoHeight || 240

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    peers.forEach((peer, i) => {
      const angle = (i / peers.length) * 2 * Math.PI - Math.PI / 2
      const cx = canvas.width / 2
      const cy = canvas.height / 2
      const distance = Math.max(30, Math.min(canvas.width * 0.4, Math.abs(peer.signal + 100) * 3))
      const x = cx + distance * Math.cos(angle)
      const y = cy + distance * Math.sin(angle)

      const color = peer.signal > -50 ? '#22c55e' : peer.signal > -70 ? '#eab308' : '#ef4444'

      ctx.beginPath()
      ctx.arc(x, y, 20, 0, Math.PI * 2)
      ctx.fillStyle = color + '40'
      ctx.fill()
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.font = '12px system-ui'
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.fillText(peer.username, x, y - 25)

      ctx.font = '10px system-ui'
      ctx.fillStyle = '#94a3b8'
      ctx.fillText(`${peer.signal}dBm`, x, y + 35)

      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(x, y)
      ctx.strokeStyle = color + '30'
      ctx.lineWidth = 1
      ctx.stroke()
    })
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="text-4xl">📡</div>
        <p className="text-sm text-red-400 text-center">{error}</p>
      </div>
    )
  }

  return (
    <div className="relative rounded-xl overflow-hidden bg-black">
      {stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full aspect-video object-cover"
        />
      )}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      {peers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center bg-slate-900/80 px-4 py-2 rounded-lg">
            <p className="text-sm text-slate-400">Sin pares detectados</p>
            <p className="text-xs text-slate-500">Activa Bluetooth para ver señal en AR</p>
          </div>
        </div>
      )}
    </div>
  )
}
