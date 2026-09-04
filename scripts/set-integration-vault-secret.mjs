import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const project = process.env.FIREBASE_PRODUCTION_PROJECT
if (project !== 'mk-store-app' || process.env.CONFIRM_PRODUCTION_SECRET !== 'YES') {
  console.error('Refusing secret creation: set FIREBASE_PRODUCTION_PROJECT=mk-store-app and CONFIRM_PRODUCTION_SECRET=YES.')
  process.exit(2)
}

// The key is generated in memory and streamed directly to Firebase CLI stdin.
// It is never written to disk, placed in an environment variable, or printed.
const secret = randomBytes(32).toString('base64')
const result = spawnSync(
  'firebase',
  ['functions:secrets:set', 'INTEGRATION_VAULT_KEY', '--project', project, '--data-file=-'],
  { input: `${secret}\n`, stdio: ['pipe', 'inherit', 'inherit'] },
)
process.exit(result.status ?? 1)
