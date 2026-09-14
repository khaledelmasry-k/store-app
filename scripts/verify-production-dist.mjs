import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const distDir = path.resolve(process.env.PRODUCTION_DIST_DIR || 'dist')
const forbidden = /(?:https?:\/\/)?(?:localhost|127\.0\.0\.1):(?:8080|5001|9099|9199)(?:\b|\/)/i

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? filesIn(file) : [file]
  }))).flat()
}

const matches = []
for (const file of await filesIn(distDir)) {
  const match = (await readFile(file, 'utf8')).match(forbidden)
  if (match) matches.push(`${path.relative(distDir, file)}: ${match[0]}`)
}
if (matches.length) {
  console.error(`PRODUCTION_DIST_EMULATOR_GUARD FAIL\n${matches.join('\n')}`)
  process.exit(1)
}
console.log('FINAL_DIST_FIRESTORE_EMULATOR: NO')
console.log('FINAL_DIST_FUNCTIONS_EMULATOR: NO')
console.log('FINAL_DIST_AUTH_EMULATOR: NO')
console.log('FINAL_DIST_STORAGE_EMULATOR: NO')
console.log('PRODUCTION_DIST_EMULATOR_GUARD PASS')
