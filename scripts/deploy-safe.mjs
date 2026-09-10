import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const target = process.argv[2]
if (!['staging', 'production'].includes(target)) {
  console.error('Usage: npm run deploy:staging | npm run deploy:production')
  process.exit(2)
}

const project = target === 'staging'
  ? process.env.FIREBASE_STAGING_PROJECT
  : process.env.FIREBASE_PRODUCTION_PROJECT

if (!project) {
  console.error(`Refusing ${target} deploy: set FIREBASE_${target.toUpperCase()}_PROJECT explicitly.`)
  process.exit(2)
}

if (target === 'staging' && project === 'mk-store-app') {
  console.error('Refusing staging deploy: staging project must be separate from mk-store-app.')
  process.exit(2)
}

if (target === 'production' && (project !== 'mk-store-app' || process.env.CONFIRM_PRODUCTION_DEPLOY !== 'YES')) {
  console.error('Refusing production deploy: use mk-store-app and CONFIRM_PRODUCTION_DEPLOY=YES.')
  process.exit(2)
}

const run = (label, command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: 'inherit', env: options.env ?? process.env })
  if (result.status !== 0) {
    console.error(`${label} FAIL`)
    console.error(options.postDeploy ? 'PRODUCTION_RELEASE_FAILED' : 'RELEASE_BLOCKED')
    process.exit(result.status ?? 1)
  }
  console.log(`${label} PASS`)
}

if (target === 'production') {
  const productionEnv = readFileSync('.env.production', 'utf8')
  if (!/^VITE_FIREBASE_PROJECT_ID=mk-store-app$/m.test(productionEnv)
    || !/^VITE_FIREBASE_USE_EMULATOR=false$/m.test(productionEnv)
    || /localhost:|127\.0\.0\.1|VITE_FIREBASE_USE_EMULATOR=true/.test(productionEnv)) {
    console.error('Refusing production deploy: .env.production contains an invalid project or emulator setting.')
    process.exit(2)
  }
  // Metadata-only check. This command never reads the secret value.
  run('PRE_DEPLOY secret metadata', 'firebase', ['functions:secrets:get', 'INTEGRATION_VAULT_KEY', '--project', project])
}

// A deployment is impossible until every local safety gate is green.
run('PRE_DEPLOY typecheck', 'npm', ['run', 'typecheck'])
run('PRE_DEPLOY functions build', 'npm', ['--prefix', 'functions', 'run', 'build'])
run('PRE_DEPLOY production build', 'npm', ['run', 'build', '--', '--mode', target])
run('PRE_DEPLOY integration', 'npm', ['run', 'verify:integration'])
run('PRE_DEPLOY E2E', 'npm', ['run', 'verify:e2e'])
run('PRE_DEPLOY production-runtime', 'npm', ['run', 'verify:production-runtime'])

// Keep the release order explicit so a failure cannot skip prerequisite rules
// or silently publish Hosting ahead of the backend it depends on.
run('DEPLOY firestore indexes', 'firebase', ['deploy', '--project', project, '--only', 'firestore:indexes'])
run('DEPLOY firestore and storage rules', 'firebase', ['deploy', '--project', project, '--only', 'firestore:rules,storage'])
run('DEPLOY functions', 'firebase', ['deploy', '--project', project, '--only', 'functions'])
run('DEPLOY hosting', 'firebase', ['deploy', '--project', project, '--only', 'hosting'])

// Firebase CLI exit 0 is not a successful production release until the real
// built site renders in a browser without fatal runtime errors.
if (target === 'production') {
  run('POST_DEPLOY mtjari.shop browser smoke', 'npm', ['run', 'verify:production-live'], { postDeploy: true })
}

console.log('RELEASE_SUCCESS')
