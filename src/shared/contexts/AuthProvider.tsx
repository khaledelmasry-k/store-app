import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
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
        const snap = await getDoc(doc(db, 'users', fbUser.uid))
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

  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setUser({ id: snap.id, uid: snap.id, ...snap.data() } as unknown as User)
    })
    return () => unsub()
  }, [user?.uid])

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
