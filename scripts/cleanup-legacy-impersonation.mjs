// Safely inventory legacy profile-based impersonation state.
// Default is a read-only dry run. Pass --apply explicitly to remove only the
// four legacy fields from matching user documents.
import admin from 'firebase-admin'

const legacyFields = ['impersonatedBy', 'impersonatedUntil', 'impersonatedStoreId', 'impersonatedMerchantId']
const apply = process.argv.includes('--apply')

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'mk-store-app' })
const db = admin.firestore()
const auth = admin.auth()

const mask = (value, keep = 4) => {
  const text = String(value || '')
  if (text.length <= keep) return '••••'
  return `${text.slice(0, keep)}••••${text.slice(-2)}`
}

const main = async () => {
  const snapshot = await db.collection('users').get()
  let count = 0
  for (const doc of snapshot.docs) {
    const data = doc.data() || {}
    const fields = legacyFields.filter((field) => Object.prototype.hasOwnProperty.call(data, field))
    if (!fields.length) continue
    count += 1
    let email = ''
    try { email = (await auth.getUser(doc.id)).email || '' } catch { /* profile may outlive Auth */ }
    console.log(JSON.stringify({ uid: mask(doc.id), email: mask(email, 2), fields, wouldInvalidateSessions: true }))
    if (apply) {
      const updates = {
        sessionInvalidBeforeEpoch: Math.floor(Date.now() / 1000),
        ...Object.fromEntries(fields.map((field) => [field, admin.firestore.FieldValue.delete()])),
      }
      await doc.ref.update(updates)
      await auth.revokeRefreshTokens(doc.id)
    }
  }
  console.log(`TOTAL=${count}`)
  console.log(`MODE=${apply ? 'APPLY' : 'DRY_RUN'}`)
}

main().catch((error) => { console.error(error?.message || 'cleanup failed'); process.exitCode = 1 })
