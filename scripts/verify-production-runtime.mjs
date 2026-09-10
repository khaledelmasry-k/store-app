import { spawn } from 'node:child_process'
import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const DIST_DIR = path.resolve('dist')
const PREVIEW_PORT = Number(process.env.PRODUCTION_PREVIEW_PORT || 4173)
const liveArg = process.argv.find((arg) => arg.startsWith('--url='))
const externalBaseUrl = liveArg?.slice('--url='.length).replace(/\/$/, '')
const baseUrl = externalBaseUrl || `http://127.0.0.1:${PREVIEW_PORT}`
const routes = ['/', '/login', '/register']
const fatalRuntimePattern = /Cannot read properties of undefined|reading ['"]_?_[Hh]['"]|reading ['"]context['"]|ChunkLoadError|Failed to fetch dynamically imported module|ErrorBoundary caught|unhandled(?: promise)? rejection/i

function fail(message) {
  throw new Error(message)
}

async function verifyBuildArtifacts() {
  const indexPath = path.join(DIST_DIR, 'index.html')
  const html = await readFile(indexPath, 'utf8')
  const referencedAssets = new Set()
  const tagPattern = /<(script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi

  for (const match of html.matchAll(tagPattern)) {
    const [tag, element, reference] = match
    if (/^https?:|^data:/.test(reference)) continue
    if (element.toLowerCase() === 'link' && !/rel=["'](?:modulepreload|stylesheet)["']/i.test(tag)) continue
    referencedAssets.add(reference)
  }

  if (referencedAssets.size === 0) fail('dist/index.html contains no script, modulepreload, or stylesheet assets.')

  for (const reference of referencedAssets) {
    const relativePath = reference.replace(/^\//, '').split(/[?#]/, 1)[0]
    const absolutePath = path.resolve(DIST_DIR, relativePath)
    if (!absolutePath.startsWith(`${DIST_DIR}${path.sep}`)) fail(`Unsafe dist asset reference: ${reference}`)
    await access(absolutePath).catch(() => fail(`Missing hashed build artifact referenced by index.html: ${reference}`))
  }

  const assets = await readdir(path.join(DIST_DIR, 'assets'))
  const forcedPreactChunks = assets.filter((name) => /^preact-vendor-.*\.js$/.test(name))
  if (forcedPreactChunks.length > 0) {
    fail(`Forced Preact vendor chunk returned: ${forcedPreactChunks.join(', ')}`)
  }

  console.log(`ARTIFACT_INTEGRITY PASS (${referencedAssets.size} index assets verified)`)
  console.log('PREACT_SINGLE_RUNTIME_BUILD_GUARD PASS')
}

async function waitForPreview(child) {
  const deadline = Date.now() + 20_000
  let lastError = 'preview did not respond'

  while (Date.now() < deadline) {
    if (child.exitCode !== null) fail(`vite preview exited early with code ${child.exitCode}`)
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  fail(`vite preview was not ready: ${lastError}`)
}

async function startPreview() {
  if (externalBaseUrl) return null

  const viteBin = path.resolve('node_modules/vite/bin/vite.js')
  const child = spawn(process.execPath, [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let previewOutput = ''
  const collect = (chunk) => {
    previewOutput = `${previewOutput}${chunk}`.slice(-4000)
  }
  child.stdout.on('data', collect)
  child.stderr.on('data', collect)
  child.on('error', (error) => fail(`Unable to start vite preview: ${error.message}`))

  try {
    await waitForPreview(child)
  } catch (error) {
    child.kill('SIGTERM')
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${previewOutput}`)
  }
  return child
}

async function inspectRoute(context, route) {
  const page = await context.newPage()
  const pageErrors = new Set()
  const fatalConsoleErrors = new Set()

  page.on('pageerror', (error) => pageErrors.add(error.stack || error.message))
  page.on('console', (message) => {
    const text = message.text()
    if (message.type() === 'error' || fatalRuntimePattern.test(text)) fatalConsoleErrors.add(`${message.type()}: ${text}`)
  })
  await page.addInitScript(() => {
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason instanceof Error ? event.reason.stack || event.reason.message : String(event.reason)
      console.error(`[production-runtime] unhandled rejection: ${reason}`)
    })
  })

  const url = new URL(route, `${baseUrl}/`).href
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  if (!response?.ok()) fail(`${route}: document failed to load (${response?.status() ?? 'no response'})`)

  let appReady = true
  await page.waitForFunction(() => {
    const root = document.querySelector('#root')
    return Boolean(root && root.textContent?.trim().length && !root.querySelector(':scope > .splash'))
  }, undefined, { timeout: 12_000 }).catch(() => {
    appReady = false
  })
  await page.waitForTimeout(750)

  const state = await page.locator('#root').evaluate((root) => {
    const style = getComputedStyle(root)
    const rect = root.getBoundingClientRect()
    const text = root.textContent?.trim() || ''
    return {
      bodyText: document.body.innerText.trim(),
      htmlLength: root.innerHTML.trim().length,
      rootText: text,
      rootVisible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
      shellVisible: Array.from(root.querySelectorAll('main, nav, header, form, [role="main"]')).some((element) => {
        const elementStyle = getComputedStyle(element)
        const elementRect = element.getBoundingClientRect()
        return elementStyle.display !== 'none' && elementStyle.visibility !== 'hidden' && elementRect.width > 0 && elementRect.height > 0
      }),
    }
  })

  const violations = []
  if (!appReady || !state.rootVisible || state.htmlLength === 0 || state.rootText.length < 20 || state.bodyText.length < 20 || !state.shellVisible) {
    violations.push(`blank-page detector failed: ${JSON.stringify(state)}`)
  }
  if (/حدث خطأ غير متوقع|تعذر عرض هذه الصفحة/.test(state.rootText)) {
    violations.push('fatal ErrorBoundary fallback rendered')
  }
  if (pageErrors.size > 0) violations.push(`pageerror detected:\n${[...pageErrors].join('\n')}`)
  if (fatalConsoleErrors.size > 0) violations.push(`fatal console error detected:\n${[...fatalConsoleErrors].join('\n')}`)
  if (violations.length > 0) fail(`${route}:\n${violations.join('\n')}`)

  console.log(`${route} PASS | pageerrors 0 | fatal console errors 0 | blank screen false`)
  await page.close()
}

async function run() {
  if (!externalBaseUrl) await verifyBuildArtifacts()
  const preview = await startPreview()
  let browser

  try {
    browser = await chromium.launch({ headless: true })
    const contextOptions = process.env.PRODUCTION_QA_STORAGE_STATE
      ? { storageState: process.env.PRODUCTION_QA_STORAGE_STATE }
      : undefined
    const context = await browser.newContext(contextOptions)
    for (const route of routes) await inspectRoute(context, route)

    if (externalBaseUrl && process.env.PRODUCTION_QA_STORAGE_STATE) {
      await inspectRoute(context, '/dashboard')
      console.log('MERCHANT_READ_ONLY_SMOKE PASS')
    } else if (externalBaseUrl) {
      console.log('MERCHANT_READ_ONLY_SMOKE SKIPPED (PRODUCTION_QA_STORAGE_STATE is not configured)')
    }

    await context.close()
    console.log(`PRODUCTION_RUNTIME PASS (${externalBaseUrl ? 'live' : 'built bundle'})`)
  } finally {
    await browser?.close()
    preview?.kill('SIGTERM')
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error)
  console.error(externalBaseUrl ? 'PRODUCTION_RELEASE_FAILED' : 'RELEASE_BLOCKED')
  process.exitCode = 1
})
