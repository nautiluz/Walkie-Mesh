# BitChat AI-Mesh ◈

Comunicación descentralizada P2P con inteligencia artificial local. Walkie-Talkie mesh sobre WebRTC + Bluetooth LE + Nostr.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/deploy-GitHub%20Pages-222?logo=github)](https://nautiluz.github.io/bitchat-ai-mesh)

## Arquitectura

```
┌──────────────────────────────────────────┐
│             PWA (Vite + React + TS)      │
│  ┌────────┐ ┌─────────┐ ┌────────────┐  │
│  │ Nostr  │ │ WebRTC  │ │ TensorFlow │  │
│  │ Tools  │ │ simple- │ │ .js (AI)   │  │
│  │        │ │ peer    │ │            │  │
│  └────────┘ └─────────┘ └────────────┘  │
│  ┌──────────────────────────────────┐    │
│  │     IndexedDB (Dexie.js)         │    │
│  └──────────────────────────────────┘    │
└──────────────┬───────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
  ┌─▼─────────┐   ┌──────▼──────┐
  │  Supabase │   │Nostr Relays │
  │ (Auth+DB) │   │ (P2P Sync)  │
  └───────────┘   └─────────────┘
```

## Stack

- **Frontend**: Vite + React 19 + TypeScript + Tailwind CSS v4
- **PWA**: vite-plugin-pwa + Workbox (offline-first)
- **P2P**: simple-peer (WebRTC) + nostr-tools (Nostr protocol)
- **AI**: TensorFlow.js (WebGL/WebGPU)
- **Storage**: Dexie.js (IndexedDB), Supabase (PostgreSQL)
- **Identity**: Nostr cryptographic keys (npub/nsec)

## Funcionalidades

- ✓ Identidad descentralizada con llaves Nostr
- ✓ Walkie-Talkie PTT (Push-to-Talk) sobre WebRTC
- ✓ Mesh networking: Bluetooth LE + WebRTC + Nostr
- ✓ Escaneo QR de llaves públicas
- ✓ Superposición AR de señal de pares
- ✓ TensorFlow.js: optimización dinámica de bitrate
- ✓ Noise suppression + VAD (Voice Activity Detection)
- ✓ Telemetría con buffer offline
- ✓ Multi-perfil en un dispositivo
- ✓ Offline-first con IndexedDB
- ✓ Anti-plagio con validación de licencia heartbeat

## Desarrollo

```bash
npm install
cp .env.example .env  # Configurar Supabase credentials
npm run dev            # http://localhost:5173
```

## Build

```bash
npm run build     # → dist/
npm run preview   # Vista previa del build
```

## Despliegue (GitHub Pages)

1. Crear repo en GitHub
2. Agregar secrets en Settings → Secrets and variables → Actions:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_NOSTR_RELAYS`
3. Push a `main` → GitHub Actions despliega automáticamente

O manual:

```bash
npm run build
npx gh-pages -d dist
```

## Base de Datos (Supabase)

Ejecutar `supabase/migrations/001_schema.sql` en el SQL Editor de Supabase.

## Licencia

GNU General Public License v3.0 — [Angel Rodriguez](https://github.com/nautiluz)
