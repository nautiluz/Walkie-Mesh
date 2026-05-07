import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Using offline-only mode.')
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 10 } }
    })
  : null

export const isSupabaseAvailable = () => supabase !== null

export async function upsertUser(nostrPublicKey: string, data: Partial<{
  username: string
  displayName: string
  avatarUrl: string
  role: string
}>) {
  if (!supabase) return null
  const { data: result, error } = await supabase
    .from('users')
    .upsert({
      nostr_public_key: nostrPublicKey,
      username: data.username,
      display_name: data.displayName,
      avatar_url: data.avatarUrl,
      role: data.role || 'driver',
      last_seen_at: new Date().toISOString()
    })
    .select()
    .single()
  if (error) console.error('Supabase upsertUser error:', error)
  return result
}

export async function getCurrentUser(nostrPublicKey: string) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('nostr_public_key', nostrPublicKey)
    .single()
  if (error && error.code !== 'PGRST116') console.error('Supabase getCurrentUser error:', error)
  return data
}

export async function addContact(userId: string, contactPubkey: string, alias: string) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('contacts')
    .insert({ user_id: userId, contact_pubkey: contactPubkey, alias })
    .select()
    .single()
  if (error) console.error('Supabase addContact error:', error)
  return data
}

export async function getContacts(userId: string) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
  if (error) console.error('Supabase getContacts error:', error)
  return data || []
}

export async function insertTelemetry(metrics: Array<{
  deviceId: string
  userId?: string
  metricName: string
  metricValue: Record<string, unknown>
  severity: string
}>) {
  if (!supabase) return
  const { error } = await supabase.from('telemetry_logs').insert(
    metrics.map(m => ({
      device_id: m.deviceId,
      user_id: m.userId,
      metric_name: m.metricName,
      metric_value: m.metricValue,
      severity: m.severity,
      client_timestamp: new Date().toISOString()
    }))
  )
  if (error) console.error('Supabase insertTelemetry error:', error)
}

export async function validateLicense(licenseKey: string, domain: string) {
  if (!supabase) return { valid: false, reason: 'offline' }
  const { data, error } = await supabase
    .from('licenses')
    .select('*')
    .eq('license_key', licenseKey)
    .eq('domain', domain)
    .eq('is_active', true)
    .single()
  if (error || !data) return { valid: false, reason: 'invalid' }
  const expired = data.expires_at && new Date(data.expires_at) < new Date()
  if (expired) return { valid: false, reason: 'expired' }
  await supabase.from('licenses').update({ last_heartbeat_at: new Date().toISOString() }).eq('id', data.id)
  return { valid: true, license: data }
}
