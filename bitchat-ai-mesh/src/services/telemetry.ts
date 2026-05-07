import { isSupabaseAvailable, insertTelemetry } from './supabase'
import { addTelemetryBuffer, flushTelemetryBuffer } from './storage'

class TelemetryService {
  private buffer: Array<{
    deviceId: string
    userId?: string
    metricName: string
    metricValue: Record<string, unknown>
    severity: 'info' | 'warning' | 'critical'
  }> = []

  private batchSize = 10
  private flushInterval: number | null = null
  private deviceId: string = crypto.randomUUID()
  private samplingRate = 1
  private batteryLevel = 100

  init(userId?: string) {
    this.flushInterval = window.setInterval(() => this.flush(), 30000)
    this.startBatteryMonitoring()
    this.collectSystemMetrics(userId)
    setInterval(() => this.collectSystemMetrics(userId), 60000)
  }

  private async startBatteryMonitoring() {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery()
        this.batteryLevel = battery.level * 100
        this.adjustSamplingRate()
        battery.addEventListener('levelchange', () => {
          this.batteryLevel = battery.level * 100
          this.adjustSamplingRate()
        })
      } catch { /* battery API not available */ }
    }
  }

  private adjustSamplingRate() {
    if (this.batteryLevel < 20) this.samplingRate = 0.2
    else if (this.batteryLevel < 50) this.samplingRate = 0.5
    else this.samplingRate = 1
  }

  private async collectSystemMetrics(userId?: string) {
    if (Math.random() > this.samplingRate) return

    const metrics = {
      memory: (performance as any).memory?.usedJSHeapSize || 0,
      uptime: Math.round(performance.now()),
      battery: this.batteryLevel,
      online: navigator.onLine
    }

    this.push('sys_health', metrics, 'info', userId)

    if ('storage' in navigator) {
      try {
        const estimate = await navigator.storage.estimate()
        this.push('storage', {
          usage: estimate.usage,
          quota: estimate.quota
        }, 'info', userId)
      } catch { /* ignore */ }
    }
  }

  push(
    metricName: string,
    metricValue: Record<string, unknown>,
    severity: 'info' | 'warning' | 'critical' = 'info',
    userId?: string
  ) {
    this.buffer.push({
      deviceId: this.deviceId,
      userId,
      metricName,
      metricValue,
      severity
    })

    if (this.buffer.length >= this.batchSize) {
      this.flush()
    }
  }

  async flush() {
    if (this.buffer.length === 0) return

    const payload = [...this.buffer]
    this.buffer = []

    if (!navigator.onLine) {
      await addTelemetryBuffer(JSON.stringify(payload))
      return
    }

    if (isSupabaseAvailable()) {
      await insertTelemetry(payload)
    } else {
      await addTelemetryBuffer(JSON.stringify(payload))
    }
  }

  async flushOfflineBuffer(userId?: string) {
    const items = await flushTelemetryBuffer()
    for (const item of items) {
      try {
        const parsed = JSON.parse(item.payload)
        if (isSupabaseAvailable() && userId) {
          await insertTelemetry(parsed.map((m: any) => ({ ...m, userId })))
        }
      } catch { /* skip invalid entries */ }
    }
  }

  getDeviceId() { return this.deviceId }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
    this.flush()
  }
}

export const telemetryService = new TelemetryService()
