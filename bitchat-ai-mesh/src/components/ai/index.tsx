import { useSettingsStore } from '../../store/settingsStore'

export function NoiseSuppressor() {
  const { noiseSuppression, toggleNoiseSuppression } = useSettingsStore()

  return (
    <div className="bg-slate-800/30 rounded-xl p-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">Noise Suppression</p>
        <p className="text-xs text-slate-500">Limpieza de ruido ambiental con IA</p>
      </div>
      <button
        onClick={toggleNoiseSuppression}
        className={`w-12 h-6 rounded-full transition-colors relative ${
          noiseSuppression ? 'bg-mesh-600' : 'bg-slate-700'
        }`}
      >
        <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
          noiseSuppression ? 'translate-x-6' : 'translate-x-0.5'
        }`} />
      </button>
    </div>
  )
}

export function VADDetector() {
  const { vadEnabled, toggleVAD } = useSettingsStore()

  return (
    <div className="bg-slate-800/30 rounded-xl p-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">VAD (Voice Activity)</p>
        <p className="text-xs text-slate-500">Detección automática de voz humana</p>
      </div>
      <button
        onClick={toggleVAD}
        className={`w-12 h-6 rounded-full transition-colors relative ${
          vadEnabled ? 'bg-mesh-600' : 'bg-slate-700'
        }`}
      >
        <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
          vadEnabled ? 'translate-x-6' : 'translate-x-0.5'
        }`} />
      </button>
    </div>
  )
}

export function SignalOptimizer() {
  const { autoBitrate, toggleAutoBitrate } = useSettingsStore()

  return (
    <div className="bg-slate-800/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Optimización de bitrate</p>
          <p className="text-xs text-slate-500">Ajuste dinámico según calidad de señal</p>
        </div>
        <button
          onClick={toggleAutoBitrate}
          className={`w-12 h-6 rounded-full transition-colors relative ${
            autoBitrate ? 'bg-mesh-600' : 'bg-slate-700'
          }`}
        >
          <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
            autoBitrate ? 'translate-x-6' : 'translate-x-0.5'
          }`} />
        </button>
      </div>

      {autoBitrate && (
        <div className="bg-slate-900/50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500">Bitrate ajustado automáticamente según calidad de señal</p>
        </div>
      )}
    </div>
  )
}
