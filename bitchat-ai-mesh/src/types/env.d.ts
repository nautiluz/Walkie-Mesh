/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_NOSTR_RELAYS: string
  readonly VITE_APP_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Navigator {
  readonly bluetooth?: Bluetooth
}

interface Bluetooth {
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>
}

interface BluetoothDevice {
  readonly id: string
  readonly name?: string
  readonly gatt?: BluetoothRemoteGATTServer
  watchAdvertisements(): Promise<void>
  readonly watchingAdvertisements: boolean
  addEventListener(type: string, listener: EventListener): void
}

interface RequestDeviceOptions {
  filters?: BluetoothLEScanFilter[]
  optionalServices?: BluetoothServiceUUID[]
}

interface BluetoothLEScanFilter {
  name?: string
  namePrefix?: string
  services?: BluetoothServiceUUID[]
}

interface BluetoothRemoteGATTServer {
  readonly device: BluetoothDevice
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>
}

interface BluetoothRemoteGATTCharacteristic {
  readonly service: BluetoothRemoteGATTService
  readonly properties: BluetoothCharacteristicProperties
  readValue(): Promise<DataView>
  writeValue(value: BufferSource): Promise<void>
  startNotifications(): Promise<void>
  addEventListener(type: string, listener: EventListener): void
}

interface BluetoothCharacteristicProperties {
  readonly read: boolean
  readonly write: boolean
  readonly notify: boolean
}

type BluetoothServiceUUID = string | number
type BluetoothCharacteristicUUID = string | number

interface Performance {
  memory?: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
}
