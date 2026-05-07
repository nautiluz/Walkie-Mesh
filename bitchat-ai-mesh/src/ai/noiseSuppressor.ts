import * as tf from '@tensorflow/tfjs'

class NoiseSuppressorModel {
  private initialized = false
  private sampleRate = 48000
  private fftSize = 1024
  private noiseProfile: tf.Tensor | null = null
  private profileFrames = 0
  private readonly PROFILE_FRAMES_NEEDED = 30

  async init(sampleRate = 48000) {
    this.sampleRate = sampleRate
    this.initialized = true
  }

  async learnNoise(audioData: Float32Array) {
    if (!this.initialized) return

    const fft = await this.computeFFT(audioData)
    if (!this.noiseProfile) {
      this.noiseProfile = fft.clone()
      this.profileFrames = 1
    } else if (this.profileFrames < this.PROFILE_FRAMES_NEEDED) {
      const weighted = tf.add(
        this.noiseProfile.mul(this.profileFrames),
        fft
      ).div(this.profileFrames + 1)
      this.noiseProfile.dispose()
      this.noiseProfile = weighted
      this.profileFrames++
    }
    fft.dispose()
  }

  async process(audioData: Float32Array): Promise<Float32Array> {
    if (!this.initialized || !this.noiseProfile || this.profileFrames < this.PROFILE_FRAMES_NEEDED) {
      return audioData
    }

    const fft = await this.computeFFT(audioData)
    const noiseFloor = this.noiseProfile.mul(1.5)
    const mask = tf.greater(fft, noiseFloor).cast('float32')
    const maskSmoothed = tf.mul(mask, 0.8).add(0.2)

    const cleaned = tf.mul(fft, maskSmoothed)
    const ifft = await this.computeIFFT(cleaned, audioData.length)

    fft.dispose()
    noiseFloor.dispose()
    mask.dispose()
    maskSmoothed.dispose()
    cleaned.dispose()

    const result = await ifft.data() as Float32Array
    ifft.dispose()

    return result
  }

  private async computeFFT(data: Float32Array): Promise<tf.Tensor> {
    const tensor = tf.tensor1d(data)
    const frame = tensor.slice([0], [this.fftSize])
    const padded = tf.pad(frame, [[0, this.fftSize - frame.shape[0]]])
    const hann = this.hannWindow(this.fftSize)
    const windowed = tf.mul(padded, hann)
    const fft = tf.signal.stft(tf.reshape(windowed, [1, this.fftSize]), this.fftSize, this.fftSize / 2, this.fftSize)
    const mag = tf.abs(fft).squeeze()

    tensor.dispose()
    frame.dispose()
    padded.dispose()
    hann.dispose()
    windowed.dispose()
    fft.dispose()

    const mean = tf.mean(mag, 0)
    mag.dispose()
    return mean
  }

  private async computeIFFT(magnitude: tf.Tensor, length: number): Promise<tf.Tensor> {
    const tiled = tf.tile(tf.reshape(magnitude, [1, 1, -1]), [1, Math.ceil(length / (this.fftSize / 2)), 1])
    const istft = tf.signal.inverse_stft(tiled, this.fftSize, this.fftSize / 2, this.fftSize)
    const result = istft.squeeze().slice([0], [length])

    tiled.dispose()
    istft.dispose()
    return result
  }

  private hannWindow(size: number): tf.Tensor {
    const values = new Float32Array(size)
    for (let i = 0; i < size; i++) {
      values[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)))
    }
    return tf.tensor1d(values)
  }

  hasNoiseProfile() {
    return this.profileFrames >= this.PROFILE_FRAMES_NEEDED
  }

  getProgress() {
    return Math.min(this.profileFrames / this.PROFILE_FRAMES_NEEDED, 1)
  }

  isInitialized() { return this.initialized }

  resetProfile() {
    this.noiseProfile?.dispose()
    this.noiseProfile = null
    this.profileFrames = 0
  }

  dispose() {
    this.noiseProfile?.dispose()
    this.noiseProfile = null
    this.initialized = false
  }
}

export const noiseSuppressor = new NoiseSuppressorModel()
