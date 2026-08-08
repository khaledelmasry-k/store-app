#!/usr/bin/env node
/**
 * Icon integrity check for M&K Store.
 *
 * Verifies that every icon name referenced in `src/` exists in the canonical
 * mapping (`src/shared/utils/icons.ts`), and that every Lucide component used in
 * that mapping is actually exported by the installed `lucide-react` package.
 * This prevents raw icon names from leaking into the UI as text (see the
 * signal_cellular_connected_no_internet_1_bar bug).
 *
 * Usage: node scripts/check-icons.mjs
 * Exit code 0 = OK, 1 = violations found.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, 'src')
const iconsPath = path.join(srcDir, 'shared/utils/icons.ts')
const iconsSrc = fs.readFileSync(iconsPath, 'utf8')

// Lucide components imported by the mapping.
const importBlock = iconsSrc.match(/import \{\s*([\s\S]*?)\s*\} from 'lucide-react'/)
if (!importBlock) {
  console.error('check-icons: could not parse the lucide-react import in src/shared/utils/icons.ts')
  process.exit(1)
}
const imported = new Set(
  [...importBlock[1].matchAll(/([A-Za-z0-9_]+)/g)]
    .map((m) => m[1])
    .filter((n) => n !== 'type' && n !== 'LucideIcon'),
)

// Mapping keys → Lucide component identifiers.
const mapMatch = iconsSrc.match(/export const ICONS = \{([\s\S]*?)\} satisfies/)
if (!mapMatch) {
  console.error('check-icons: could not parse ICONS mapping in src/shared/utils/icons.ts')
  process.exit(1)
}
const mapping = new Map()
for (const m of mapMatch[1].matchAll(/(?:'([a-z0-9_]+)'|([a-z0-9_]+))\s*:\s*([A-Za-z0-9_]+)/g)) {
  const key = m[1] || m[2]
  mapping.set(key, m[3])
}

// Confirm every component identifier exists in the installed lucide-react.
const lucide = await import('lucide-react')
const violations = []

for (const [name, comp] of mapping) {
  if (!imported.has(comp)) {
    violations.push(`"${name}" maps to "${comp}" but that identifier is not imported in icons.ts`)
  } else if (!(comp in lucide)) {
    violations.push(`"${name}" maps to "${comp}" but lucide-react has no such export`)
  }
}

// Every source icon name must exist in the mapping.
const seen = new Set()

function check(name, where) {
  if (!name) return
  if (seen.has(name + where)) return
  seen.add(name + where)
  if (!mapping.has(name)) {
    violations.push(`"${name}" (${where}) — missing from ICONS mapping in src/shared/utils/icons.ts`)
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) scan(full)
  }
}

function scan(file) {
  const src = fs.readFileSync(file, 'utf8')
  const rel = path.relative(root, file)
  for (const m of src.matchAll(/icon="([a-z0-9_]+)"/g)) check(m[1], rel)
  for (const m of src.matchAll(/<Icon\s+name="([a-z0-9_]+)"/g)) check(m[1], rel)
  for (const m of src.matchAll(/icon\s*:\s*'([a-z0-9_]+)'/g)) check(m[1], rel)
  // No Material Symbols font/class may remain anywhere in src.
  if (/material-symbols|material-icons/i.test(src)) {
    violations.push(`stray Material Symbols reference in ${rel}`)
  }
}

walk(srcDir)

if (violations.length > 0) {
  console.error('✗ Icon violations:')
  for (const v of violations) console.error('  ' + v)
  process.exit(1)
}
console.log(`✓ Icons OK — ${mapping.size} mappings, all referenced names resolve to real Lucide icons`)
