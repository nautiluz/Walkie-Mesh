import * as tf from '@tensorflow/tfjs'
import { signalOptimizer } from '../ai/signalOptimizer'
import { noiseSuppressor } from '../ai/noiseSuppressor'

class TensorFlowService {
  private initialized = false
  private backend: 'webgpu' | 'webgl' | 'cpu' = 'cpu'

  async init() {
    if (this.initialized) return

    await tf.ready()
    const backends = ['webgpu', 'webgl', 'cpu'] as const
    for (const b of backends) {
      if (tf.findBackend(b)) {
        try {
          await tf.setBackend(b)
          this.backend = b
          break
        } catch {
          continue
        }
      }
    }

    await signalOptimizer.init()
    await noiseSuppressor.init()

    signalOptimizer.train(50)

    this.initialized = true
    console.log(`TF.js initialized: ${this.backend} backend`)
  }

  getBackend() { return this.backend }

  isInitialized() { return this.initialized }

  async optimizeBitrate(metrics: { rssi: number; packetLoss: number; latency: number }) {
    return signalOptimizer.predict(metrics.rssi, metrics.packetLoss, metrics.latency)
  }

  getNoiseSuppressor() { return noiseSuppressor }

  getSignalOptimizer() { return signalOptimizer }

  dispose() {
    signalOptimizer.dispose()
    noiseSuppressor.dispose()
  }
}

export const tfService = new TensorFlowService()
