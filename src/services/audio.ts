import { noiseSuppressor } from '../ai/noiseSuppressor'

export class AudioService {
  private stream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private processor: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private isPTTActive = false
  private vadThreshold = 0.02
  private audioElements: Map<string, HTMLAudioElement> = new Map()
  private noiseSuppressionEnabled = false

  async init() {
    this.audioContext = new AudioContext()
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000
      }
    })
    this.source = this.audioContext.createMediaStreamSource(this.stream)
  }

  setNoiseSuppression(enabled: boolean) {
    this.noiseSuppressionEnabled = enabled
    if (enabled) {
      noiseSuppressor.init()
    }
  }

  async learnNoiseProfile(data: Float32Array) {
    if (!this.noiseSuppressionEnabled) return
    await noiseSuppressor.learnNoise(data)
  }

  startPTT(
    onAudioData: (data: Float32Array) => void,
    onVAD?: (speaking: boolean) => void
  ) {
    if (!this.audioContext || !this.source) return
    this.isPTTActive = true
    const bufferSize = 4096
    this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1)
    this.source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)

    this.processor.onaudioprocess = async (e) => {
      if (!this.isPTTActive) return
      const input = e.inputBuffer.getChannelData(0)

      let processed: Float32Array = input
      if (this.noiseSuppressionEnabled && !noiseSuppressor.hasNoiseProfile()) {
        await this.learnNoiseProfile(input)
      }
      if (this.noiseSuppressionEnabled && noiseSuppressor.hasNoiseProfile()) {
        processed = await noiseSuppressor.process(input) as Float32Array
      }

      const energy = processed.reduce((sum, s) => sum + Math.abs(s), 0) / processed.length
      if (onVAD) onVAD(energy > this.vadThreshold)
      if (energy > this.vadThreshold) {
        onAudioData(new Float32Array(processed))
      } else if (!this.noiseSuppressionEnabled) {
        onAudioData(new Float32Array(processed))
      }
    }
  }

  stopPTT() {
    this.isPTTActive = false
    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
    }
  }

  addPeerAudio(pubkey: string, stream: MediaStream) {
    const existing = this.audioElements.get(pubkey)
    if (existing) {
      existing.srcObject = stream
      return
    }

    const audio = new Audio()
    audio.srcObject = stream
    audio.autoplay = true
    audio.setAttribute('playsinline', '')
    audio.volume = 1

    audio.play().catch(() => {
      document.addEventListener('click', () => audio.play(), { once: true })
    })

    this.audioElements.set(pubkey, audio)
  }

  removePeerAudio(pubkey: string) {
    const audio = this.audioElements.get(pubkey)
    if (audio) {
      audio.pause()
      audio.srcObject = null
      this.audioElements.delete(pubkey)
    }
  }

  setVADThreshold(threshold: number) {
    this.vadThreshold = threshold
  }

  getStream() { return this.stream }

  getAudioContext() { return this.audioContext }

  destroy() {
    this.stopPTT()
    this.audioElements.forEach((audio) => {
      audio.pause()
      audio.srcObject = null
    })
    this.audioElements.clear()
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop())
      this.stream = null
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    noiseSuppressor.dispose()
  }
}

export const audioService = new AudioService()
