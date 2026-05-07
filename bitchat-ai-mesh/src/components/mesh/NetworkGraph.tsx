import { useMemo } from 'react'
import { useMeshStore } from '../../store/meshStore'

export function NetworkGraph() {
  const { peers } = useMeshStore()

  const radarStyle = useMemo(() => ({
    animation: 'pulse-radar 3s ease-in-out infinite'
  }), [])

  return (
    <div className="relative w-full aspect-square max-w-xs mx-auto">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <circle cx="100" cy="100" r="90" fill="none" stroke="#1e293b" strokeWidth="0.5" />
        <circle cx="100" cy="100" r="60" fill="none" stroke="#1e293b" strokeWidth="0.5" />
        <circle cx="100" cy="100" r="30" fill="none" stroke="#1e293b" strokeWidth="0.5" />

        <line x1="100" y1="10" x2="100" y2="190" stroke="#1e293b" strokeWidth="0.3" />
        <line x1="10" y1="100" x2="190" y2="100" stroke="#1e293b" strokeWidth="0.3" />
        <line x1="36" y1="36" x2="164" y2="164" stroke="#1e293b" strokeWidth="0.3" />
        <line x1="164" y1="36" x2="36" y2="164" stroke="#1e293b" strokeWidth="0.3" />

        <circle cx="100" cy="100" r="4" fill="#14b8a6" />

        {peers.map((peer, i) => {
          const angle = (i / peers.length) * 2 * Math.PI - Math.PI / 2
          const distance = Math.max(20, Math.min(85, Math.abs(peer.signal + 100) * 1.5))
          const x = 100 + distance * Math.cos(angle)
          const y = 100 + distance * Math.sin(angle)
          const signalStrength = peer.signal > -50 ? 'high' : peer.signal > -70 ? 'mid' : 'low'
          const color = signalStrength === 'high' ? '#22c55e' : signalStrength === 'mid' ? '#eab308' : '#ef4444'

          return (
            <g key={peer.id}>
              <circle cx={x} cy={y} r={5} fill={color} opacity={0.8} />
              <text x={x} y={y - 10} textAnchor="middle" fill="#94a3b8" fontSize="6">
                {peer.username}
              </text>
              <line x1="100" y1="100" x2={x} y2={y} stroke={color} strokeWidth="0.5" opacity="0.3" />
            </g>
          )
        })}
      </svg>

      {peers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center" style={radarStyle}>
            <span className="text-4xl opacity-30">◈</span>
          </div>
        </div>
      )}
    </div>
  )
}
