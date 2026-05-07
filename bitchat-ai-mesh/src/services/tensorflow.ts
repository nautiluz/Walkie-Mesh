import * as tf from '@tensorflow/tfjs'

class TensorFlowService {
  private initialized = false
  private backend: 'webgl' | 'webgpu' | 'cpu' = 'cpu'
  private models: Map<string, tf.LayersModel> = new Map()

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

    this.initialized = true
    console.log(`TF.js initialized with backend: ${this.backend}`)
  }

  getBackend() { return this.backend }

  isInitialized() { return this.initialized }

  async loadModel(name: string, url: string) {
    try {
      const model = await tf.loadLayersModel(url)
      this.models.set(name, model)
      return model
    } catch (err) {
      console.error(`Failed to load model ${name}:`, err)
      return null
    }
  }

  getModel(name: string) {
    return this.models.get(name) || null
  }

  async optimizeBitrate(metrics: {
    rssi: number
    packetLoss: number
    latency: number
  }): Promise<number> {
    if (!this.initialized) return this.heuristicBitrate(metrics)

    const input = tf.tensor2d([
      [metrics.rssi, metrics.packetLoss, metrics.latency]
    ])

    const model = this.models.get('signal-optimizer')
    if (model) {
      const prediction = model.predict(input) as tf.Tensor
      const bitrate = (await prediction.data())[0]
      input.dispose()
      prediction.dispose()
      return Math.max(8000, Math.min(64000, Math.round(bitrate)))
    }

    input.dispose()
    return this.heuristicBitrate(metrics)
  }

  private heuristicBitrate(metrics: {
    rssi: number
    packetLoss: number
    latency: number
  }): number {
    const { rssi, packetLoss, latency } = metrics
    if (rssi > -50 && packetLoss < 0.02 && latency < 100) return 64000
    if (rssi > -70 && packetLoss < 0.05 && latency < 200) return 32000
    if (rssi > -85 && packetLoss < 0.1 && latency < 400) return 16000
    return 8000
  }

  createSignalOptimizerModel(): tf.LayersModel {
    const model = tf.sequential()
    model.add(tf.layers.dense({ units: 8, activation: 'relu', inputShape: [3] }))
    model.add(tf.layers.dense({ units: 8, activation: 'relu' }))
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }))
    model.compile({ optimizer: 'adam', loss: 'meanSquaredError' })
    this.models.set('signal-optimizer', model)
    return model
  }

  dispose() {
    this.models.forEach(m => m.dispose())
    this.models.clear()
  }
}

export const tfService = new TensorFlowService()
