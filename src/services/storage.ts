import Dexie, { type Table } from 'dexie'

export interface StoredProfile {
  id?: number
  publicKey: string
  privateKeyEncrypted: string
  username: string
  displayName: string
  avatarUrl: string
  isActive: number
  createdAt: string
}

export interface StoredContact {
  id?: number
  ownerPubkey: string
  contactPubkey: string
  alias: string
  addedAt: string
}

export interface CachedMessage {
  id?: number
  roomId: string
  senderPubkey: string
  content: string
  contentType: string
  signature: string
  createdAt: string
  synced: number
}

export interface TelemetryBuffer {
  id?: number
  payload: string
  createdAt: string
}

class BitChatDB extends Dexie {
  profiles!: Table<StoredProfile>
  contacts!: Table<StoredContact>
  messages!: Table<CachedMessage>
  telemetry!: Table<TelemetryBuffer>

  constructor() {
    super('bitchat-db')
    this.version(2).stores({
      profiles: '++id, publicKey, isActive',
      contacts: '++id, ownerPubkey, contactPubkey',
      messages: '++id, roomId, createdAt',
      telemetry: '++id, createdAt'
    })
  }
}

const db = new BitChatDB()

export async function saveProfile(profile: StoredProfile) {
  await db.profiles.where('isActive').equals(1).modify({ isActive: 0 })
  return db.profiles.put({ ...profile, isActive: 1 })
}

export async function getActiveProfile() {
  return db.profiles.where('isActive').equals(1).first()
}

export async function getAllProfiles() {
  return db.profiles.toArray()
}

export async function saveContact(contact: StoredContact) {
  const existing = await db.contacts
    .where({ ownerPubkey: contact.ownerPubkey, contactPubkey: contact.contactPubkey })
    .first()
  if (existing) {
    await db.contacts.update(existing.id!, { alias: contact.alias })
    return existing.id!
  }
  return db.contacts.add(contact)
}

export async function getContacts(ownerPubkey: string) {
  return db.contacts.where('ownerPubkey').equals(ownerPubkey).toArray()
}

export async function cacheMessage(msg: CachedMessage) {
  return db.messages.add(msg)
}

export async function getMessages(roomId: string, limit = 50) {
  return db.messages
    .where('roomId')
    .equals(roomId)
    .reverse()
    .limit(limit)
    .toArray()
}

export async function getUnsyncedMessages() {
  return db.messages.where('synced').equals(0).toArray()
}

export async function markMessageSynced(id: number) {
  return db.messages.update(id, { synced: 1 as any })
}

export async function addTelemetryBuffer(payload: string) {
  return db.telemetry.add({ payload, createdAt: new Date().toISOString() })
}

export async function flushTelemetryBuffer() {
  const items = await db.telemetry.toArray()
  await db.telemetry.clear()
  return items
}

export default db
