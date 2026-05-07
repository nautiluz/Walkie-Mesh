import { useEffect } from 'react'
import { useUserStore } from '../store/userStore'

export function useAuth() {
  const { profile, isAuthenticated, isInitialized, loadProfile } = useUserStore()

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  return { profile, isAuthenticated, isInitialized }
}
