import { useState } from 'react'
import { useNostr } from '../../hooks/useNostr'
import { useUserStore } from '../../store/userStore'
import { publishProfileMetadata } from '../../services/nostr'

export function KeyGenerator() {
  const [step, setStep] = useState<'welcome' | 'generated' | 'import'>('welcome')
  const [keys, setKeys] = useState<{ privateKey: string; nsec: string; npub: string; publicKey: string } | null>(null)
  const [importInput, setImportInput] = useState('')
  const [username, setUsername] = useState('')
  const [copied, setCopied] = useState<'npub' | 'nsec' | null>(null)

  const { createIdentity, importIdentity } = useNostr()
  const { setProfile } = useUserStore()

  const handleCreate = () => {
    const identity = createIdentity()
    setKeys(identity)
    setStep('generated')
  }

  const handleImport = () => {
    const identity = importIdentity(importInput.trim())
    if (identity) {
      setKeys(identity)
      setStep('generated')
    }
  }

  const handleCopy = (type: 'npub' | 'nsec', value: string) => {
    navigator.clipboard.writeText(value)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleSave = async () => {
    if (!keys || !username.trim()) return
    await setProfile({
      publicKey: keys.publicKey,
      privateKeyEncrypted: keys.nsec,
      username: username.trim(),
      displayName: username.trim(),
      avatarUrl: '',
      isActive: 1,
      createdAt: new Date().toISOString()
    })

    publishProfileMetadata(keys.privateKey, {
      name: username.trim(),
      display_name: username.trim()
    }).then(success => {
      if (success) console.log('Perfil publicado en Nostr relays')
    })
  }

  if (step === 'welcome') {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="w-16 h-16 rounded-full bg-mesh-500/20 flex items-center justify-center text-2xl">
          ◈
        </div>
        <h2 className="text-xl font-bold">BitChat AI-Mesh</h2>
        <p className="text-sm text-slate-400 text-center max-w-xs">
          Identidad descentralizada con llaves criptográficas Nostr.
          Sin registro, sin email.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={handleCreate}
            className="w-full py-3 bg-mesh-600 hover:bg-mesh-500 rounded-xl font-semibold transition-colors"
          >
            Crear nueva identidad
          </button>
          <button
            onClick={() => setStep('import')}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-colors"
          >
            Importar llave existente
          </button>
        </div>
      </div>
    )
  }

  if (step === 'generated' && keys) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center text-2xl text-green-400">
          ✓
        </div>
        <h2 className="text-xl font-bold">Identidad creada</h2>

        <div className="w-full max-w-xs space-y-3">
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wide">Nombre de usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tu nombre en la red"
              className="w-full mt-1 px-4 py-2 bg-slate-800 rounded-lg border border-slate-700 focus:border-mesh-500 focus:outline-none"
              maxLength={50}
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wide">Llave pública (compartir)</label>
            <div className="flex gap-2 mt-1">
              <code className="flex-1 px-3 py-2 bg-slate-800 rounded-lg text-xs truncate border border-slate-700">
                {keys.npub}
              </code>
              <button
                onClick={() => handleCopy('npub', keys.npub)}
                className="px-3 py-2 bg-slate-800 rounded-lg border border-slate-700 hover:bg-slate-700 text-xs"
              >
                {copied === 'npub' ? '✓' : 'Copy'}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wide">Llave privada (secreta)</label>
            <div className="flex gap-2 mt-1">
              <code className="flex-1 px-3 py-2 bg-red-900/20 rounded-lg text-xs truncate border border-red-900/30 text-red-400">
                {keys.nsec.slice(0, 12)}...{keys.nsec.slice(-4)}
              </code>
              <button
                onClick={() => handleCopy('nsec', keys.nsec)}
                className="px-3 py-2 bg-slate-800 rounded-lg border border-slate-700 hover:bg-slate-700 text-xs"
              >
                {copied === 'nsec' ? '✓' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-red-400 mt-1">
              Guarda esta llave. Es la única forma de recuperar tu identidad.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={!username.trim()}
            className="w-full py-3 bg-mesh-600 hover:bg-mesh-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-xl font-semibold transition-colors mt-4"
          >
            Entrar a BitChat
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <h2 className="text-xl font-bold">Importar llave</h2>
      <textarea
        value={importInput}
        onChange={(e) => setImportInput(e.target.value)}
        placeholder="Pega tu nsec o hex private key..."
        className="w-full max-w-xs h-24 px-4 py-3 bg-slate-800 rounded-lg border border-slate-700 focus:border-mesh-500 focus:outline-none text-xs resize-none"
      />
      <div className="flex gap-3 w-full max-w-xs">
        <button
          onClick={() => setStep('welcome')}
          className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
        >
          Volver
        </button>
        <button
          onClick={handleImport}
          disabled={!importInput.trim()}
          className="flex-1 py-3 bg-mesh-600 hover:bg-mesh-500 disabled:bg-slate-700 rounded-xl font-semibold transition-colors"
        >
          Importar
        </button>
      </div>
    </div>
  )
}
