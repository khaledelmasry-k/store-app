import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, firebaseRuntime } from '../../firebase'

/** Development-only runtime probe; the route renders nothing in production. */
export const FirebaseDiagnostics: FunctionalComponent = () => {
  const [profile, setProfile] = useState<any>(null)
  const [diagnostic, setDiagnostic] = useState<Record<string, unknown> | null>(null)
  useEffect(() => {
    try { setDiagnostic(JSON.parse(sessionStorage.getItem('mk-dev-auth-diagnostic') || 'null')) } catch { setDiagnostic(null) }
    const uid = auth.currentUser?.uid
    if (!uid) return
    getDoc(doc(db, 'users', uid)).then((snap) => setProfile(snap.exists() ? snap.data() : null)).catch(() => setProfile(null))
  }, [])
  if (!import.meta.env.DEV) return null
  const user = auth.currentUser
  return (
    <main style={{ padding: 24, direction: 'ltr', fontFamily: 'monospace' }}>
      <h1>Firebase runtime diagnostics</h1>
      <pre>{JSON.stringify({
        mode: firebaseRuntime.mode,
        projectId: firebaseRuntime.projectId,
        authEmulatorHost: firebaseRuntime.authEmulatorHost,
        firestoreEmulatorHost: firebaseRuntime.firestoreEmulatorHost,
        functionsEmulatorHost: firebaseRuntime.functionsEmulatorHost,
        currentAuthUser: user ? { uid: user.uid, email: user.email } : null,
        profileFound: Boolean(profile),
        resolvedRole: profile?.role || null,
        resolvedStoreIds: profile?.storeIds || [],
        lastAuthErrorCode: firebaseRuntime.lastAuthErrorCode,
        latestLoginAttempt: diagnostic,
      }, null, 2)}</pre>
    </main>
  )
}
