import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { LoginForm } from './components/auth/LoginForm'
import { ProfileManager } from './components/auth/ProfileManager'
import { WalkieTalkie } from './components/chat/WalkieTalkie'
import { PeerDiscovery } from './components/mesh/PeerDiscovery'
import { NetworkGraph } from './components/mesh/NetworkGraph'
import { ConnectionStatus } from './components/mesh/ConnectionStatus'
import { QRScanner } from './components/camera/QRScanner'
import { QRGenerator } from './components/camera/QRGenerator'
import { AROverlay } from './components/camera/AROverlay'
import { NoiseSuppressor, VADDetector, SignalOptimizer } from './components/ai/index'
import { TelemetryDashboard } from './components/telemetry/Dashboard'
import { TelemetryOptIn } from './components/telemetry/OptInDialog'
import { LicenseValidator } from './components/auth/LicenseValidator'
import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { useSettingsStore } from './store/settingsStore'
import { useSignaling } from './hooks/useSignaling'
import { telemetryService } from './services/telemetry'
import { tfService } from './services/tensorflow'

const isGitHubPages = window.location.hostname.includes('github.io')
const Router = isGitHubPages ? HashRouter : BrowserRouter

function HomePage() {
  const { isInitialized, startBluetoothDiscovery, stopBluetoothDiscovery, isBluetoothAvailable } = useSignaling()
  const [btScanning, setBtScanning] = useState(false)

  return (
    <div className="space-y-4 pt-4">
      {!isInitialized && (
        <div className="bg-yellow-900/30 text-yellow-400 px-4 py-2 rounded-lg text-sm text-center">
          Inicializando mesh...
        </div>
      )}
      {isBluetoothAvailable && (
        <button
          onClick={async () => {
            if (btScanning) {
              stopBluetoothDiscovery()
              setBtScanning(false)
            } else {
              setBtScanning(true)
              await startBluetoothDiscovery()
              setBtScanning(false)
            }
          }}
          disabled={btScanning}
          className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-xl text-sm transition-colors"
        >
          {btScanning ? 'Escaneando...' : 'Buscar dispositivos Bluetooth'}
        </button>
      )}
      <NetworkGraph />
      <ConnectionStatus />
      <PeerDiscovery />
    </div>
  )
}

function ChatPage() {
  return <WalkieTalkie />
}

function ContactsPage() {
  return (
    <div className="space-y-4 pt-4">
      <h2 className="text-lg font-bold">Contactos</h2>
      <ProfileManager />
    </div>
  )
}

function CameraPage() {
  return (
    <div className="space-y-4 pt-4">
      <h2 className="text-lg font-bold">Tu QR</h2>
      <QRGenerator />
      <h2 className="text-lg font-bold mt-6">Escanear QR</h2>
      <QRScanner />
      <h2 className="text-lg font-bold mt-6">Visión AR</h2>
      <AROverlay />
    </div>
  )
}

function SettingsPage() {
  return (
    <div className="space-y-4 pt-4">
      <h2 className="text-lg font-bold">Ajustes</h2>

      <div className="space-y-2">
        <h3 className="text-xs text-slate-500 uppercase tracking-wide px-1">Audio</h3>
        <NoiseSuppressor />
        <VADDetector />
      </div>

      <div className="space-y-2">
        <h3 className="text-xs text-slate-500 uppercase tracking-wide px-1">Red</h3>
        <SignalOptimizer />
      </div>

      <div className="space-y-2">
        <h3 className="text-xs text-slate-500 uppercase tracking-wide px-1">Telemetría</h3>
        <TelemetryDashboard />
      </div>

      <div className="space-y-2">
        <h3 className="text-xs text-slate-500 uppercase tracking-wide px-1">Perfil</h3>
        <ProfileManager />
      </div>
    </div>
  )
}

function AppContent() {
  const { isAuthenticated, isInitialized, profile } = useAuth()
  const { telemetryEnabled } = useSettingsStore()

  useEffect(() => {
    tfService.init()
  }, [])

  useEffect(() => {
    if (telemetryEnabled && profile) {
      telemetryService.init(profile.publicKey)
      return () => telemetryService.destroy()
    }
  }, [telemetryEnabled, profile])

  if (!isInitialized) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="radar-pulse text-4xl">◈</div>
        </div>
      </Layout>
    )
  }

  if (!isAuthenticated) {
    return (
      <Layout title="BitChat AI-Mesh">
        <LoginForm />
      </Layout>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Layout title="Mesh"><HomePage /></Layout>} />
      <Route path="/chat" element={<Layout title="Walkie-Talkie"><ChatPage /></Layout>} />
      <Route path="/contacts" element={<Layout title="Contactos"><ContactsPage /></Layout>} />
      <Route path="/camera" element={<Layout title="Cámara"><CameraPage /></Layout>} />
      <Route path="/settings" element={<Layout title="Ajustes"><SettingsPage /></Layout>} />
    </Routes>
  )
}

export default function App() {
  return (
    <Router>
      <LicenseValidator />
      <TelemetryOptIn />
      <AppContent />
    </Router>
  )
}
