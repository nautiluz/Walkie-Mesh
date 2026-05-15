import { useEffect, useState, useCallback } from 'react'
import { useCamera } from '../../hooks/useCamera'
import jsQR from 'jsqr'
import { useNostr } from '../../hooks/useNostr'
import { useUserStore } from '../../store/userStore'
import { saveContact } from '../../services/storage'

export function QRScanner() {
  const { videoRef, stream, isActive, error, startCamera, stopCamera } = useCamera()
  const { resolvePubkey } = useNostr()
  const { profile } = useUserStore()
  const [scannedKey, setScannedKey] = useState<string | null>(null)
  const [alias, setAlias] = useState('')
  const [added, setAdded] = useState(false)
  const [scanning, setScanning] = useState(true)

  useEffect(() => {
    startCamera('environment')
    return () => stopCamera()
  }, [])

  useEffect(() => {
    if (!isActive || !scanning) return
    const interval = setInterval(scanQR, 500)
    return () => clearInterval(interval)
  }, [isActive, scanning])

  const scanQR = useCallback(() => {
    if (!videoRef.current) return
    const video = videoRef.current
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height)

    if (code) {
      const pubkey = resolvePubkey(code.data.trim())
      if (pubkey) {
        setScannedKey(pubkey)
        setScanning(false)
      }
    }
  }, [videoRef, scanning, resolvePubkey])

  const handleAddContact = async () => {
    if (!scannedKey || !profile) return
    await saveContact({
      ownerPubkey: profile.publicKey,
      contactPubkey: scannedKey,
      alias: alias || scannedKey.slice(0, 8),
      addedAt: new Date().toISOString()
    })
    setAdded(true)
  }

  const handleRescan = () => {
    setScannedKey(null)
    setAlias('')
    setAdded(false)
    setScanning(true)
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="text-4xl">📷</div>
        <p className="text-sm text-red-400 text-center">{error}</p>
        <button onClick={handleRescan} className="px-4 py-2 bg-slate-800 rounded-lg text-sm">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {stream && (
        <div className="relative rounded-xl overflow-hidden bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full aspect-square object-cover"
          />
          {scanning && (
            <div className="absolute inset-0 border-2 border-mesh-400 rounded-xl opacity-50" />
          )}
          {scannedKey && (
            <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
              <div className="bg-slate-900/90 px-4 py-2 rounded-lg text-center">
                <p className="text-green-400 text-sm font-semibold">✓ Llave detectada</p>
              </div>
            </div>
          )}
        </div>
      )}

      {scannedKey && !added && (
        <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Nuevo contacto</p>
          <code className="block text-xs text-slate-300 bg-slate-900 rounded-lg px-3 py-2 break-all">
            {scannedKey}
          </code>
          <input
            type="text"
            name="contactAlias"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Nombre del contacto"
            className="w-full px-4 py-2 bg-slate-800 rounded-lg border border-slate-700 focus:border-mesh-500 focus:outline-none text-sm"
            maxLength={50}
          />
          <div className="flex gap-2">
            <button onClick={handleRescan} className="flex-1 py-2 bg-slate-700 rounded-lg text-sm">
              Re-escanear
            </button>
            <button onClick={handleAddContact} className="flex-1 py-2 bg-mesh-600 rounded-lg text-sm font-semibold">
              Añadir contacto
            </button>
          </div>
        </div>
      )}

      {added && (
        <div className="text-center py-4">
          <p className="text-green-400 font-semibold">✓ Contacto añadido</p>
          <button onClick={handleRescan} className="mt-3 px-4 py-2 bg-slate-800 rounded-lg text-sm">
            Escanear otro
          </button>
        </div>
      )}
    </div>
  )
}
