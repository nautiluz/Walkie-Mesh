import * as tf from '@tensorflow/tfjs'

class NoiseSuppressorModel {
  private noiseMean = 0
  private noiseStd = 0.01
  private profileFrames = 0
  private readonly PROFILE_FRAMES_NEEDED = 20
  private reductionFactor = 0.3

  async init() {
  }

  async learnNoise(audioData: Float32Array) {
    if (this.profileFrames >= this.PROFILE_FRAMES_NEEDED) return

    const tensor = tf.tensor1d(audioData)
    const mean = tf.mean(tensor).dataSync()[0]
    const std = tf.moments(tensor).variance.sqrt().dataSync()[0]
    tensor.dispose()

    this.noiseMean = (this.noiseMean * this.profileFrames + mean) / (this.profileFrames + 1)
    this.noiseStd = (this.noiseStd * this.profileFrames + std) / (this.profileFrames + 1)
    this.profileFrames++
  }

  async process(audioData: Float32Array): Promise<Float32Array> {
    if (this.profileFrames < this.PROFILE_FRAMES_NEEDED) {
      return audioData
    }

    const tensor = tf.tensor1d(audioData)
    const threshold = this.noiseMean + this.noiseStd * 2

    const mask = tf.greater(tf.abs(tensor), threshold).cast('float32')
    const smoothed = mask.mul(1 - this.reductionFactor).add(this.reductionFactor)
    const result = tf.mul(tensor, smoothed)

    const output = (await result.data() as Float32Array).slice()
    tensor.dispose()
    mask.dispose()
    smoothed.dispose()
    result.dispose()

    return output
  }

  hasNoiseProfile() {
    return this.profileFrames >= this.PROFILE_FRAMES_NEEDED
  }

  getProgress() {
    return Math.min(this.profileFrames / this.PROFILE_FRAMES_NEEDED, 1)
  }

  setReductionFactor(factor: number) {
    this.reductionFactor = Math.max(0, Math.min(1, factor))
  }

  resetProfile() {
    this.noiseMean = 0
    this.noiseStd = 0.01
    this.profileFrames = 0
  }

  dispose() {
    this.resetProfile()
  }
}

export const noiseSuppressor = new NoiseSuppressorModel()
