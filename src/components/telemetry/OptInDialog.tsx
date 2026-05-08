import { useState, useEffect } from 'react'

export function TelemetryOptIn() {
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem('bitchat-telemetry-dismissed'))

  useEffect(() => {
    localStorage.setItem('bitchat-telemetry-info', 'true')
  }, [])

  const handleDismiss = () => {
    localStorage.setItem('bitchat-telemetry-dismissed', 'true')
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-slate-900 rounded-xl p-4 border border-slate-700 shadow-xl max-w-sm mx-auto">
      <h3 className="text-sm font-semibold mb-1">Telemetría activa</h3>
      <p className="text-xs text-slate-400 mb-3">
        BitChat recolecta métricas anónimas de rendimiento para mejorar la app.
        Datos: uso de CPU, memoria, latencia de red. No se recopila información personal.
        Puedes desactivarlo en Ajustes &rarr; Telemetría.
      </p>
      <button
        onClick={handleDismiss}
        className="w-full py-2 bg-mesh-600 hover:bg-mesh-500 rounded-lg text-xs font-semibold transition-colors"
      >
        Entendido
      </button>
    </div>
  )
}
