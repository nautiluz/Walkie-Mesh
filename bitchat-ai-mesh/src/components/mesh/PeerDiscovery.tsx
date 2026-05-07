import { useMeshStore } from '../../store/meshStore'

export function PeerDiscovery() {
  const { peers, isOnline, dominantProtocol } = useMeshStore()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">Pares descubiertos</h3>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-yellow-500'}`} />
          <span className="text-xs text-slate-500">{dominantProtocol.toUpperCase()}</span>
        </div>
      </div>

      {peers.length === 0 ? (
        <div className="bg-slate-800/30 rounded-xl p-6 text-center">
          <div className="radar-pulse text-3xl mb-2">◈</div>
          <p className="text-sm text-slate-500">Buscando pares en la red mesh...</p>
          <p className="text-xs text-slate-600 mt-1">
            Activa Bluetooth o Wi-Fi Direct para descubrimiento local
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {peers.map((peer) => (
            <div
              key={peer.id}
              className="bg-slate-800/50 rounded-xl p-3 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold">
                {peer.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{peer.username}</p>
                <p className="text-xs text-slate-500">{peer.protocol.toUpperCase()}</p>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor:
                      peer.signal > -50 ? '#22c55e' :
                      peer.signal > -70 ? '#eab308' :
                      '#ef4444'
                  }}
                />
                <span className="text-xs text-slate-400">{peer.signal}dBm</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
