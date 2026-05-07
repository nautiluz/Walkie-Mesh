import * as tf from '@tensorflow/tfjs'

class SignalOptimizerModel {
  private model: tf.LayersModel | null = null
  private trained = false

  async init() {
    this.model = this.buildModel()
  }

  private buildModel(): tf.LayersModel {
    const model = tf.sequential()
    model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [3] }))
    model.add(tf.layers.batchNormalization())
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }))
    model.add(tf.layers.dropout({ rate: 0.2 }))
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }))
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    })
    return model
  }

  async train(epochs = 50) {
    if (!this.model) return

    const { features, labels } = this.generateTrainingData(1000)
    const xs = tf.tensor2d(features)
    const ys = tf.tensor2d(labels)

    await this.model.fit(xs, ys, {
      epochs,
      batchSize: 32,
      shuffle: true,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            console.log(`Epoch ${epoch}: loss=${logs?.loss.toFixed(4)}, val_loss=${logs?.val_loss.toFixed(4)}`)
          }
        }
      }
    })

    xs.dispose()
    ys.dispose()
    this.trained = true
    console.log('Signal Optimizer model trained successfully')
  }

  private generateTrainingData(count: number): { features: number[][]; labels: number[][] } {
    const features: number[][] = []
    const labels: number[][] = []

    for (let i = 0; i < count; i++) {
      const rssi = -90 + Math.random() * 50
      const packetLoss = Math.random() * 0.2
      const latency = Math.random() * 500

      let targetBitrate: number
      if (rssi > -50 && packetLoss < 0.02 && latency < 100) {
        targetBitrate = 0.9 + Math.random() * 0.1
      } else if (rssi > -70 && packetLoss < 0.05 && latency < 200) {
        targetBitrate = 0.5 + Math.random() * 0.2
      } else if (rssi > -85 && packetLoss < 0.1 && latency < 400) {
        targetBitrate = 0.25 + Math.random() * 0.15
      } else {
        targetBitrate = 0.1 + Math.random() * 0.1
      }

      features.push([
        this.normalize(rssi, -100, -30),
        Math.min(packetLoss, 0.5),
        Math.min(latency / 1000, 1)
      ])
      labels.push([targetBitrate])
    }

    return { features, labels }
  }

  private normalize(value: number, min: number, max: number): number {
    return (value - min) / (max - min)
  }

  async predict(rssi: number, packetLoss: number, latency: number): Promise<number> {
    if (!this.model || !this.trained) {
      return this.heuristicBitrate(rssi, packetLoss, latency)
    }

    const input = tf.tensor2d([[
      this.normalize(rssi, -100, -30),
      Math.min(packetLoss, 0.5),
      Math.min(latency / 1000, 1)
    ]])

    const prediction = this.model.predict(input) as tf.Tensor
    const bitrateFraction = (await prediction.data())[0]
    input.dispose()
    prediction.dispose()

    const bitrate = Math.round(bitrateFraction * 64000)
    return Math.max(8000, Math.min(64000, bitrate))
  }

  private heuristicBitrate(rssi: number, packetLoss: number, latency: number): number {
    if (rssi > -50 && packetLoss < 0.02 && latency < 100) return 64000
    if (rssi > -70 && packetLoss < 0.05 && latency < 200) return 32000
    if (rssi > -85 && packetLoss < 0.1 && latency < 400) return 16000
    return 8000
  }

  isTrained() { return this.trained }

  dispose() {
    this.model?.dispose()
    this.model = null
  }
}

export const signalOptimizer = new SignalOptimizerModel()
