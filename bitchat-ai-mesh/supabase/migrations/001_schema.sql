-- BitChat AI-Mesh — Supabase Schema
-- GNU GPL v3 — Angel Rodriguez

-- 1. Users (Nostr-based identity)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nostr_public_key VARCHAR(64) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE,
  display_name VARCHAR(100),
  avatar_url TEXT,
  role VARCHAR(20) DEFAULT 'driver' CHECK (role IN ('admin', 'driver', 'monitor')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

-- 2. Device profiles (multi-session with biometric/PIN)
CREATE TABLE IF NOT EXISTS device_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(64) NOT NULL,
  profile_name VARCHAR(50),
  pin_hash VARCHAR(256),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, device_id)
);

-- 3. Contacts (Nostr address book)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  contact_pubkey VARCHAR(64) NOT NULL,
  alias VARCHAR(50),
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, contact_pubkey)
);

-- 4. Telemetry logs (time-series metrics)
CREATE TABLE IF NOT EXISTS telemetry_logs (
  id BIGSERIAL PRIMARY KEY,
  device_id VARCHAR(64) NOT NULL,
  user_id UUID REFERENCES users(id),
  metric_name VARCHAR(100) NOT NULL,
  metric_value JSONB NOT NULL,
  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  client_timestamp TIMESTAMPTZ NOT NULL,
  server_timestamp TIMESTAMPTZ DEFAULT now()
);

-- 5. Licenses (anti-plagiarism heartbeat)
CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key VARCHAR(64) UNIQUE NOT NULL,
  domain VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_heartbeat_at TIMESTAMPTZ
);

-- 6. Messages (optional cloud backup)
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  sender_pubkey VARCHAR(64) NOT NULL,
  recipient_pubkey VARCHAR(64),
  room_id VARCHAR(64),
  content TEXT,
  content_type VARCHAR(20) DEFAULT 'text' CHECK (content_type IN ('text', 'audio', 'image', 'system')),
  signature VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_pubkey ON users(nostr_public_key);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_pubkey ON contacts(contact_pubkey);
CREATE INDEX IF NOT EXISTS idx_telemetry_device ON telemetry_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_user ON telemetry_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_severity ON telemetry_logs(severity);
CREATE INDEX IF NOT EXISTS idx_telemetry_ts ON telemetry_logs(server_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_pubkey);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(created_at DESC);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  USING (nostr_public_key = current_setting('request.jwt.claims')::json->>'sub');

CREATE POLICY "Users can upsert own data"
  ON users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING (nostr_public_key = current_setting('request.jwt.claims')::json->>'sub');

CREATE POLICY "Contacts are readable by owner"
  ON contacts FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE nostr_public_key = current_setting('request.jwt.claims')::json->>'sub'));

CREATE POLICY "Contacts are writable by owner"
  ON contacts FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM users WHERE nostr_public_key = current_setting('request.jwt.claims')::json->>'sub'));

CREATE POLICY "Telemetry insertable by any authed device"
  ON telemetry_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Licenses readable by public"
  ON licenses FOR SELECT
  USING (true);

CREATE POLICY "Messages readable by participants"
  ON messages FOR SELECT
  USING (true);

CREATE POLICY "Messages insertable by sender"
  ON messages FOR INSERT
  WITH CHECK (true);

-- Seed initial license for development
INSERT INTO licenses (license_key, domain, is_active)
VALUES ('DEV-LICENSE-2025', 'localhost', true)
ON CONFLICT (license_key) DO NOTHING;
