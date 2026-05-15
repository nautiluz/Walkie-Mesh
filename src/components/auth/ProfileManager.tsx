import { useUserStore } from '../../store/userStore'
import { getAllProfiles } from '../../services/storage'
import { useState, useEffect } from 'react'
import { saveProfile, type StoredProfile } from '../../services/storage'

export function ProfileManager() {
  const { profile, logout, setProfile } = useUserStore()
  const [profiles, setProfiles] = useState<StoredProfile[]>([])
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    loadProfiles()
  }, [])

  useEffect(() => {
    if (profile) setEditName(profile.displayName)
  }, [profile])

  const loadProfiles = async () => {
    const all = await getAllProfiles()
    setProfiles(all)
  }

  const switchProfile = async (p: StoredProfile) => {
    await saveProfile(p)
    window.location.reload()
  }

  const handleSaveName = async () => {
    if (!profile || !editName.trim()) return
    await saveProfile({ ...profile, displayName: editName.trim(), username: editName.trim() })
    setProfile({ ...profile, displayName: editName.trim(), username: editName.trim() })
    setEditing(false)
  }

  return (
    <div className="space-y-4">
      {profile && (
        <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-mesh-600 flex items-center justify-center text-lg font-bold">
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex gap-2">
                  <input
                    name="displayName"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-3 py-1 bg-slate-700 rounded-lg text-sm border border-slate-600 focus:border-mesh-500 focus:outline-none"
                    maxLength={50}
                    autoFocus
                  />
                  <button onClick={handleSaveName} className="px-3 py-1 bg-mesh-600 rounded-lg text-sm">✓</button>
                  <button onClick={() => setEditing(false)} className="px-3 py-1 bg-slate-700 rounded-lg text-sm">✗</button>
                </div>
              ) : (
                <>
                  <p className="font-semibold">{profile.displayName}</p>
                  <p className="text-xs text-slate-400 truncate">{profile.publicKey.slice(0, 16)}...</p>
                </>
              )}
            </div>
            <button onClick={() => setEditing(!editing)} className="text-slate-400 hover:text-slate-200 text-sm">
              ✎
            </button>
          </div>
        </div>
      )}

      {profiles.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Otros perfiles</p>
          {profiles.filter(p => p.id !== profile?.id).map(p => (
            <button
              key={p.id}
              onClick={() => switchProfile(p)}
              className="w-full bg-slate-800/30 hover:bg-slate-800/50 rounded-xl p-3 flex items-center gap-3 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold">
                {p.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="text-left min-w-0">
                <p className="font-medium text-sm">{p.displayName}</p>
                <p className="text-xs text-slate-500 truncate">{p.publicKey.slice(0, 12)}...</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={logout}
        className="w-full py-3 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-xl font-semibold transition-colors text-sm"
      >
        Cerrar sesión
      </button>
    </div>
  )
}
