import { test, expect } from '@playwright/test'
import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

// Point the Admin SDK at the local emulators.
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
process.env.STORAGE_EMULATOR_HOST = 'http://localhost:9199'

const envRaw = readFileSync('.env.local', 'utf8')
const projectId = envRaw.match(/VITE_FIREBASE_PROJECT_ID=(\S+)/)?.[1] || 'mk-store-app'
if (!admin.apps.length) admin.initializeApp({ projectId })
const db = admin.firestore()
const bucket = admin.storage().bucket('mk-store-app.firebasestorage.app')

const STORE_ID = 'test-storage-limit-store'
const MB = 1024 * 1024

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 20000, intervalMs = 400): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return
    await sleep(intervalMs)
  }
  throw new Error('waitFor timed out')
}

async function usedBytes(): Promise<number> {
  const s = await db.doc(`stores/${STORE_ID}`).get()
  return Number(s.data()?.storageUsed || 0)
}

test.beforeAll(async () => {
  await db.doc(`stores/${STORE_ID}`).set({
    id: STORE_ID,
    active: true,
    name: 'Storage Limit Test',
    slug: STORE_ID,
    ownerId: 'test-owner',
    currency: 'SAR',
    storageUsed: 0,
    storageLimitBytes: 1 * MB, // 1MB plan quota for the test
  })
})

test.afterAll(async () => {
  // Best-effort cleanup of uploaded objects + the store doc.
  await bucket.deleteFiles({ prefix: `stores/${STORE_ID}/` }).catch(() => {})
  await db.doc(`stores/${STORE_ID}`).delete().catch(() => {})
})

test('storageUsed counter increments on upload and rejects over-quota objects', async () => {
  // 1) Upload a 600KB object → counter should increment to ~600KB.
  const first = Buffer.alloc(600 * 1024, 7)
  const firstPath = `stores/${STORE_ID}/first.bin`
  await bucket.file(firstPath).save(first, { metadata: { contentType: 'application/octet-stream', metadata: { storeId: STORE_ID } } })

  await waitFor(async () => (await usedBytes()) >= 600 * 1024 - 1024)
  const afterFirst = await usedBytes()
  expect(afterFirst).toBeGreaterThanOrEqual(600 * 1024 - 2 * 1024)
  expect(afterFirst).toBeLessThanOrEqual(600 * 1024 + 2 * 1024)

  // 2) Upload a 500KB object → would push usage to 1100KB > 1MB limit.
  //    The finalize trigger must DELETE it and NOT increment the counter.
  const second = Buffer.alloc(500 * 1024, 9)
  const secondPath = `stores/${STORE_ID}/second.bin`
  await bucket.file(secondPath).save(second, { metadata: { contentType: 'application/octet-stream', metadata: { storeId: STORE_ID } } })

  // Give the trigger time to reject + delete the over-quota object.
  await sleep(3000)
  const afterSecond = await usedBytes()
  expect(afterSecond).toBeLessThanOrEqual(1 * MB)

  // The over-quota object must have been removed by the server-side trigger.
  const [exists] = await bucket.file(secondPath).exists()
  expect(exists).toBe(false)
})
