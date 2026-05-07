import { useMeshStore } from '../../store/meshStore'

export function ConnectionStatus() {
  const { peers, isOnline, dominantProtocol, signalMetrics } = useMeshStore()

  const avgSignal = peers.length > 0
    ? Math.round(peers.reduce((sum, p) => sum + p.signal, 0) / peers.length)
    : 0

  return (
    <div className="bg-slate-800/30 rounded-xl p-4 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-400">Estado de la red</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          isOnline ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
        }`}>
          {isOnline ? 'Online' : 'Local Only'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-2xl font-bold text-mesh-400">{peers.length}</p>
          <p className="text-xs text-slate-500">Pares</p>
        </div>
        <div className="text-center">
          <p className={`text-2xl font-bold ${
            avgSignal > -50 ? 'text-green-400' :
            avgSignal > -70 ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {avgSignal || '--'}
          </p>
          <p className="text-xs text-slate-500">dBm avg</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-mesh-400">{dominantProtocol.toUpperCase()}</p>
          <p className="text-xs text-slate-500">Protocolo</p>
        </div>
      </div>

      {signalMetrics && (
        <div className="border-t border-slate-700 pt-3 mt-2 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Latencia</span>
            <span className="text-slate-300">{signalMetrics.latency}ms</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Pérdida de paquetes</span>
            <span className="text-slate-300">{(signalMetrics.packetLoss * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Bitrate</span>
            <span className="text-slate-300">{signalMetrics.bitrate / 1000}kbps</span>
          </div>
        </div>
      )}
    </div>
  )
}
