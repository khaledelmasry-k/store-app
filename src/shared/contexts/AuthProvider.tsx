import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { AuthContext, AuthState } from './auth-context'
import type { User } from '../types'

export const AuthProvider: FunctionalComponent = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (!fbUser) {
          setUser(null)
          return
        }
        // A profile read must not leave the whole app in an infinite bootstrap
        // state when the network is unavailable. Auth identity is still real;
        // the caller gets a deterministic retryable unauthenticated state.
        const profileRead = getDoc(doc(db, 'users', fbUser.uid))
        let timeoutId: number | undefined
        const timeout = new Promise<never>((_, reject) => { timeoutId = window.setTimeout(() => reject(new Error('auth-profile-timeout')), 8000) })
        try {
          const snap = await Promise.race([profileRead, timeout])
          if (timeoutId !== undefined) window.clearTimeout(timeoutId)
          if (snap.exists()) {
          const userData = { id: snap.id, uid: snap.id, ...snap.data() } as unknown as User
          setUser(userData)
          setLoading(false)
          setInitialized(true)
          } else {
          console.warn(`User document not found for uid=${fbUser.uid}. Please create one in Firestore.`)
          setUser(null)
          setLoading(false)
          setInitialized(true)
          }
        } finally {
          if (timeoutId !== undefined) window.clearTimeout(timeoutId)
        }
      } catch (err) {
        console.error('Auth state error:', err)
        setUser(null)
      } finally {
        setLoading(false)
        setInitialized(true)
      }
    })
    return () => unsub()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        initialized,
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
