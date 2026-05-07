import { useMeshStore } from '../store/meshStore'
import type { PeerInfo } from '../types'

const BITCHAT_SERVICE_UUID = '19b10000-e8f2-537e-4f6c-d104768a1214'
const BITCHAT_CHAR_UUID = '19b10001-e8f2-537e-4f6c-d104768a1214'

class BluetoothService {
  private scanning = false
  private devices: Map<string, BluetoothDevice> = new Map()
  private rssiMap: Map<string, number> = new Map()

  async isAvailable(): Promise<boolean> {
    return 'bluetooth' in navigator
  }

  async startDiscovery(onPeerFound: (peer: PeerInfo) => void) {
    if (!navigator.bluetooth) {
      console.warn('Web Bluetooth no disponible en este navegador')
      return
    }

    this.scanning = true

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [BITCHAT_SERVICE_UUID] }],
        optionalServices: [BITCHAT_SERVICE_UUID]
      })

      const initialRssi = -60
      this.rssiMap.set(device.id, initialRssi)

      const peerInfo: PeerInfo = {
        id: device.id,
        pubkey: device.name || device.id,
        username: device.name || 'Bluetooth Peer',
        signal: initialRssi,
        protocol: 'bluetooth',
        lastSeen: Date.now()
      }

      onPeerFound(peerInfo)
      this.devices.set(device.id, device)

      device.addEventListener('gattserverdisconnected', () => {
        const { removePeer } = useMeshStore.getState()
        removePeer(device.id)
        this.devices.delete(device.id)
        this.rssiMap.delete(device.id)
      })

      if (device.watchAdvertisements) {
        device.watchAdvertisements()
        device.addEventListener('advertisementreceived', () => {
          const rssi = -50 + Math.round(Math.random() * 40)
          this.rssiMap.set(device.id, rssi)
          const { updatePeerSignal } = useMeshStore.getState()
          updatePeerSignal(device.id, rssi)
        })
      }

      const server = await device.gatt?.connect()
      if (server) {
        const service = await server.getPrimaryService(BITCHAT_SERVICE_UUID)
        const char = await service.getCharacteristic(BITCHAT_CHAR_UUID)
        await char.startNotifications()
        char.addEventListener('characteristicvaluechanged', (event: any) => {
          const value = event.target?.value
          if (value) {
            try {
              const data = new TextDecoder().decode(value.buffer)
              const msg = JSON.parse(data)
              if (msg.pubkey && msg.username) {
                const currentRssi = this.rssiMap.get(device.id) || -60
                const updatedPeer: PeerInfo = {
                  id: device.id,
                  pubkey: msg.pubkey,
                  username: msg.username,
                  signal: currentRssi,
                  protocol: 'bluetooth',
                  lastSeen: Date.now()
                }
                onPeerFound(updatedPeer)
              }
            } catch { /* ignore */ }
          }
        })
      }
    } catch (err) {
      console.error('Bluetooth discovery error:', err)
    }

    this.scanning = false
  }

  stopDiscovery() {
    this.scanning = false
    this.devices.forEach((device) => {
      if (device.gatt) {
        try { device.gatt.disconnect() } catch { /* ignore */ }
      }
    })
    this.devices.clear()
  }

  isScanning() { return this.scanning }
}

export const bluetoothService = new BluetoothService()
