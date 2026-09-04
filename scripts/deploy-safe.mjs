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

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
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
  run('firebase', ['functions:secrets:get', 'INTEGRATION_VAULT_KEY', '--project', project])
}

// A deployment is impossible until every local safety gate is green.
run('npm', ['run', 'typecheck'])
run('npm', ['--prefix', 'functions', 'run', 'build'])
run('npm', ['run', 'build', '--', '--mode', target])
run('npm', ['run', 'verify:integration'])
run('npm', ['run', 'verify:e2e'])

// Keep the release order explicit so a failure cannot skip prerequisite rules
// or silently publish Hosting ahead of the backend it depends on.
run('firebase', ['deploy', '--project', project, '--only', 'firestore:indexes'])
run('firebase', ['deploy', '--project', project, '--only', 'firestore:rules,storage'])
run('firebase', ['deploy', '--project', project, '--only', 'functions'])
run('firebase', ['deploy', '--project', project, '--only', 'hosting'])
