import { useState, useEffect } from 'react'
import { useSettingsStore } from '../../store/settingsStore'

export function TelemetryOptIn() {
  const { telemetryEnabled, toggleTelemetry } = useSettingsStore()
  const [show, setShow] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem('bitchat-telemetry-dismissed')
    if (!dismissed && !telemetryEnabled) {
      setShow(true)
    }
  }, [telemetryEnabled])

  const handleAccept = () => {
    toggleTelemetry()
    localStorage.setItem('bitchat-telemetry-dismissed', 'true')
    setShow(false)
  }

  const handleDismiss = () => {
    localStorage.setItem('bitchat-telemetry-dismissed', 'true')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-slate-900 rounded-xl p-4 border border-slate-700 shadow-xl max-w-sm mx-auto">
      <h3 className="text-sm font-semibold mb-1">Telemetría</h3>
      <p className="text-xs text-slate-400 mb-3">
        BitChat puede recolectar métricas anónimas de rendimiento para mejorar la aplicación.
        Datos: uso de CPU, memoria, latencia de red. No se recopila información personal.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleAccept}
          className="flex-1 py-2 bg-mesh-600 hover:bg-mesh-500 rounded-lg text-xs font-semibold transition-colors"
        >
          Aceptar
        </button>
        <button
          onClick={handleDismiss}
          className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs transition-colors"
        >
          Rechazar
        </button>
      </div>
    </div>
  )
}
