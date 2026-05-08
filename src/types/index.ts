export type UserRole = 'admin' | 'driver' | 'monitor'

export interface User {
  id: string
  nostrPublicKey: string
  username: string
  displayName: string
  avatarUrl: string
  role: UserRole
  isActive: boolean
  createdAt: string
  lastSeenAt: string
}

export interface DeviceProfile {
  id: string
  userId: string
  deviceId: string
  profileName: string
  pinHash: string
  createdAt: string
}

export interface Contact {
  id: string
  userId: string
  contactPubkey: string
  alias: string
  addedAt: string
}

export interface Message {
  id?: number
  senderPubkey: string
  recipientPubkey?: string
  roomId?: string
  content: string
  contentType: 'text' | 'audio' | 'image' | 'system'
  signature: string
  createdAt: string
}

export interface TelemetryMetric {
  id?: number
  deviceId: string
  userId?: string
  metricName: string
  metricValue: Record<string, unknown>
  severity: 'info' | 'warning' | 'critical'
  clientTimestamp: string
  serverTimestamp?: string
}

export interface License {
  id: string
  licenseKey: string
  domain: string
  isActive: boolean
  expiresAt: string
  createdAt: string
  lastHeartbeatAt: string
}

export interface PeerInfo {
  id: string
  pubkey: string
  username: string
  signal: number
  protocol: 'bluetooth' | 'webrtc' | 'nostr'
  lastSeen: number
}

export interface MeshState {
  peers: PeerInfo[]
  isOnline: boolean
  dominantProtocol: 'bluetooth' | 'webrtc' | 'nostr'
}

export interface SignalMetrics {
  rssi: number
  packetLoss: number
  latency: number
  bitrate: number
  recommendedBitrate: number
}

export interface ChatMessage {
  id: string
  pubkey: string
  text: string
  timestamp: number
}
