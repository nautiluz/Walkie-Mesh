import { useState, useCallback, useEffect } from 'react'
import { tfService } from '../services/tensorflow'

export function useTensorFlow() {
  const [isReady, setIsReady] = useState(false)
  const [backend, setBackend] = useState<string>('cpu')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    initTF()
  }, [])

  const initTF = useCallback(async () => {
    try {
      await tfService.init()
      setIsReady(true)
      setBackend(tfService.getBackend())
    } catch (err) {
      setError('Error al inicializar TensorFlow.js')
      console.error(err)
    }
  }, [])

  const optimizeBitrate = useCallback(async (metrics: {
    rssi: number
    packetLoss: number
    latency: number
  }) => {
    if (!isReady) return 32000
    return tfService.optimizeBitrate(metrics)
  }, [isReady])

  return {
    isReady,
    backend,
    error,
    optimizeBitrate
  }
}
