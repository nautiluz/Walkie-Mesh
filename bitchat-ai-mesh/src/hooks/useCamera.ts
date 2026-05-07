import { useState, useCallback, useEffect, useRef } from 'react'

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchActive, setTorchActive] = useState(false)

  const startCamera = useCallback(async (facingMode: 'environment' | 'user' = 'environment') => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })
      setStream(mediaStream)
      setIsActive(true)
      setError(null)

      const track = mediaStream.getVideoTracks()[0]
      const capabilities = track.getCapabilities() as any
      setTorchAvailable(!!capabilities?.torch)

      return mediaStream
    } catch (err) {
      const message = err instanceof DOMException
        ? 'Cámara no disponible. Permisos denegados o dispositivo sin cámara.'
        : 'Error al acceder a la cámara.'
      setError(message)
      return null
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      setStream(null)
      setIsActive(false)
      setTorchActive(false)
    }
  }, [stream])

  const toggleTorch = useCallback(async () => {
    if (!stream) return
    const track = stream.getVideoTracks()[0]
    try {
      await (track as any).applyConstraints({
        advanced: [{ torch: !torchActive }]
      })
      setTorchActive(!torchActive)
    } catch {
      setError('Torch no disponible en este dispositivo')
    }
  }, [stream, torchActive])

  const captureFrame = useCallback((): ImageData | null => {
    if (!videoRef.current || !stream) return null
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(videoRef.current, 0, 0)
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }, [stream])

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop())
      }
    }
  }, [stream])

  return {
    videoRef,
    stream,
    error,
    isActive,
    torchAvailable,
    torchActive,
    startCamera,
    stopCamera,
    toggleTorch,
    captureFrame
  }
}
