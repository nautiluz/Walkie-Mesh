import { useState, useEffect } from 'react'
import { validateLicense } from '../../services/supabase'

export function LicenseValidator() {
  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid' | 'offline'>('checking')

  useEffect(() => {
    checkLicense()
  }, [])

  const checkLicense = async () => {
    const domain = window.location.hostname
    const licenseKey = localStorage.getItem('bitchat-license') || 'DEV-LICENSE-2025'

    const result = await validateLicense(licenseKey, domain)
    if (!result.valid) {
      if (result.reason === 'offline') {
        setStatus('offline')
      } else {
        setStatus('invalid')
      }
    } else {
      setStatus('valid')
    }
  }

  if (status === 'valid' || status === 'offline') return null

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl p-6 max-w-sm w-full border border-red-900/50 text-center space-y-4">
        <div className="text-4xl">🔒</div>
        <h2 className="text-lg font-bold text-red-400">Licencia no válida</h2>
        <p className="text-sm text-slate-400">
          Esta instancia de BitChat no está autorizada para ejecutarse en <strong className="text-slate-300">{window.location.hostname}</strong>.
        </p>
        <p className="text-xs text-slate-500">
          Ingresa una licencia válida o contacta al administrador.
        </p>
        <button
          onClick={checkLicense}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
