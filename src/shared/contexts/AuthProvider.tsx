import { FunctionalComponent } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { onIdTokenChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { AuthContext, AuthState } from './auth-context'
import type { User } from '../types'

export const AuthProvider: FunctionalComponent = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [supportSessionActive, setSupportSessionActive] = useState(false)
  const supportExpiryTimer = useRef<number | undefined>(undefined)

  const refreshUser = async () => {
    const fbUser = auth.currentUser
    if (supportExpiryTimer.current !== undefined) {
      window.clearTimeout(supportExpiryTimer.current)
      supportExpiryTimer.current = undefined
    }
    if (!fbUser) {
      setUser(null)
      setSupportSessionActive(false)
      setLoading(false)
      setInitialized(true)
      return
    }
    try {
      const tokenResult = await fbUser.getIdTokenResult()
      const supportExpiry = typeof tokenResult.claims.supportExpiresAt === 'number' ? tokenResult.claims.supportExpiresAt : 0
      const supportActive = tokenResult.claims.supportImpersonation === true && supportExpiry > Date.now()
      setSupportSessionActive(supportActive)
      if (supportActive) {
        supportExpiryTimer.current = window.setTimeout(() => {
          supportExpiryTimer.current = undefined
          setSupportSessionActive(false)
        }, Math.max(0, supportExpiry - Date.now()))
      }
      const profileRead = getDoc(doc(db, 'users', fbUser.uid))
      let timeoutId: number | undefined
      const timeout = new Promise<never>((_, reject) => { timeoutId = window.setTimeout(() => reject(new Error('auth-profile-timeout')), 8000) })
      try {
        const snap = await Promise.race([profileRead, timeout])
        if (timeoutId !== undefined) window.clearTimeout(timeoutId)
        if (snap.exists()) {
          const userData = { id: snap.id, uid: snap.id, ...snap.data(), emailVerified: fbUser.emailVerified } as unknown as User
          setUser(userData)
        } else {
          console.warn(`User document not found for uid=${fbUser.uid}. Please create one in Firestore.`)
          setUser(null)
        }
      } finally {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      }
    } catch (err) {
      console.error('Auth state error:', err)
      setUser(null)
      setSupportSessionActive(false)
    } finally {
      setLoading(false)
      setInitialized(true)
    }
  }

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (fbUser) => {
      try {
        if (!fbUser) {
          setUser(null)
          setSupportSessionActive(false)
          setLoading(false)
          setInitialized(true)
          return
        }
        await refreshUser()
      } catch (err) {
        console.error('Auth state error:', err)
        setUser(null)
      } finally {
        setLoading(false)
        setInitialized(true)
      }
    })
    return () => {
      unsub()
      if (supportExpiryTimer.current !== undefined) window.clearTimeout(supportExpiryTimer.current)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
          user,
          supportSessionActive,
        loading,
        initialized,
        refreshUser,
        state: initialized
          ? user
            ? AuthState.Authenticated
            : AuthState.Unauthenticated
          : loading
            ? AuthState.Loading
            : AuthState.Uninitialized,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
