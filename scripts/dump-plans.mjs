import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
const envRaw = readFileSync('.env.local', 'utf8')
const projectId = envRaw.match(/VITE_FIREBASE_PROJECT_ID=(\S+)/)?.[1] || 'mk-store-app'
const app = initializeApp({ projectId })
const db = getFirestore(app)
const snap = await db.collection('plans').get()
console.log('count:', snap.size)
for (const d of snap.docs) console.log(d.id, JSON.stringify({ name: d.data().name, active: d.data().active, price: d.data().priceMonthly }))
process.exit(0)
