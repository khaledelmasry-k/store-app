import { spawnSync } from 'node:child_process'

// Vite gives process.env precedence over .env files. Remove every emulator
// override inherited by the deploy shell, then set release values explicitly.
const env = { ...process.env }
for (const key of [
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIREBASE_STORAGE_EMULATOR_HOST',
  'FUNCTIONS_EMULATOR_HOST',
  'VITE_FIREBASE_USE_EMULATOR',
  'VITE_FIREBASE_PROJECT_ID',
]) delete env[key]
env.VITE_FIREBASE_PROJECT_ID = 'mk-store-app'
env.VITE_FIREBASE_USE_EMULATOR = 'false'

const result = spawnSync('npm', ['run', 'build', '--', '--mode', 'production'], { stdio: 'inherit', env })
process.exit(result.status ?? 1)
