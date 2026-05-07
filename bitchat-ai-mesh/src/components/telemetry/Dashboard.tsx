import { useState, useEffect } from 'react'
import { useSettingsStore } from '../../store/settingsStore'
import { telemetryService } from '../../services/telemetry'

export function TelemetryDashboard() {
  const { telemetryEnabled, toggleTelemetry } = useSettingsStore()
  const [metrics, setMetrics] = useState<Array<{ name: string; value: string }>>([])

  useEffect(() => {
    if (!telemetryEnabled) return
    const interval = setInterval(() => {
      setMetrics([
        { name: 'Device ID', value: telemetryService.getDeviceId().slice(0, 8) + '...' },
        { name: 'Memoria JS', value: `${Math.round((performance as any).memory?.usedJSHeapSize / 1048576 || 0)} MB` },
        { name: 'Uptime', value: `${Math.round(performance.now() / 60000)} min` },
        { name: 'Online', value: navigator.onLine ? 'Sí' : 'No' }
      ])
    }, 5000)
    return () => clearInterval(interval)
  }, [telemetryEnabled])

  return (
    <div className="space-y-3">
      <div className="bg-slate-800/30 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Telemetría</p>
          <p className="text-xs text-slate-500">Monitoreo de sistema y rendimiento</p>
        </div>
        <button
          onClick={toggleTelemetry}
          className={`w-12 h-6 rounded-full transition-colors relative ${
            telemetryEnabled ? 'bg-mesh-600' : 'bg-slate-700'
          }`}
        >
          <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
            telemetryEnabled ? 'translate-x-6' : 'translate-x-0.5'
          }`} />
        </button>
      </div>

      {telemetryEnabled && (
        <div className="bg-slate-800/30 rounded-xl p-4">
          <div className="grid grid-cols-2 gap-2">
            {metrics.map((m) => (
              <div key={m.name} className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-slate-500">{m.name}</p>
                <p className="text-sm font-mono font-semibold mt-0.5">{m.value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-3 text-center">
            Los datos se envían por batch a Supabase cada 30s
          </p>
        </div>
      )}
    </div>
  )
}
