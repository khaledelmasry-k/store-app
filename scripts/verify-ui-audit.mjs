#!/usr/bin/env node
/**
 * Accessibility and mobile-layout audit, driven by a real browser.
 *
 * Runs axe-core (WCAG 2.1 A + AA) over each route and, in the same pass,
 * measures the things axe does not: horizontal overflow, elements clipped
 * off-screen, and form controls under 16px — the threshold below which iOS
 * Safari zooms the whole page on focus.
 *
 * Hand-written contrast checks were tried first and produced false failures:
 * reading `background-color` from CSS cannot see through a `linear-gradient`,
 * and sampling the corners of an element box misses on a rounded button. axe
 * resolves gradients, overlap and rounding properly, and skips what it
 * genuinely cannot determine. Do not replace it with a bespoke checker.
 *
 *   node scripts/verify-ui-audit.mjs                       # public routes
 *   node scripts/verify-ui-audit.mjs --group=merchant      # needs a login
 *   node scripts/verify-ui-audit.mjs --group=storefront --slug=test-store-a
 *   node scripts/verify-ui-audit.mjs --group=all
 *
 * Expects a built app already being served (`npx vite preview --port 4173`).
 * The merchant, platform and storefront groups additionally expect the
 * emulators running and seeded (`npm run emulators`, `npm run emulators:seed`)
 * and the app built with VITE_FIREBASE_USE_EMULATOR=true.
 *
 * NOTE: the storefront group needs the *functions* emulator specifically —
 * its shell is resolved by the getPublicStore callable and the pages gate on
 * subscription state, so without it every storefront route renders the
 * "store unavailable" card and the audit measures nothing real.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('@playwright/test')
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const BASE = arg('base', 'http://localhost:4173').replace(/\/$/, '')
const GROUP = arg('group', 'public')
const SLUG = arg('slug', 'test-store-a')
/** Set when the browser is not on Playwright's own download path. */
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined

const MERCHANT = { email: arg('merchant-email', 'owner@a.store'), password: arg('merchant-password', 'Owner12345') }
const ADMIN = { email: arg('admin-email', 'khaaledelmasry@gmail.com'), password: arg('admin-password', 'Admin12345') }

const GROUPS = {
  public: { login: null, routes: ['/', '/login', '/register', '/forgot-password', '/partners/shipping/apply'] },
  merchant: {
    login: MERCHANT,
    routes: ['/dashboard/', '/dashboard/products', '/dashboard/orders', '/dashboard/customers',
      '/dashboard/analytics', '/dashboard/coupons', '/dashboard/shipping', '/dashboard/settings',
      '/dashboard/categories', '/dashboard/team', '/dashboard/landing-pages'],
  },
  platform: {
    login: ADMIN,
    routes: ['/platform/', '/platform/merchants', '/platform/orders', '/platform/products',
      '/platform/plans', '/platform/subscriptions', '/platform/tickets', '/platform/settings'],
  },
  storefront: {
    login: null,
    routes: ['', '/catalog', '/cart', '/checkout', '/track'].map((s) => `/store/${SLUG}${s}`),
  },
}

/** Phone, phone, small phone, tablet — the widths real traffic arrives at. */
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, touch: true },
  { name: 'desktop', width: 1280, height: 900, touch: false },
]

/**
 * A refused connection is the most common reason a run produces nothing
 * useful, and finding out twenty audited pages later wastes a round trip.
 * Check the services this group actually needs, up front, and name the
 * terminal that starts whichever one is down.
 */
async function reachable(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2500) })
    return true
  } catch (e) {
    // Any HTTP answer at all means something is listening; only a refused
    // or unreachable socket means the service is not running.
    return !/ECONNREFUSED|EHOSTUNREACH|ENOTFOUND|timed out|aborted/i.test(String(e.cause?.code || e.message))
  }
}

async function preflight(groupNames) {
  const needsEmulators = groupNames.some((g) => g !== 'public')
  const needsFunctions = groupNames.includes('storefront')
  const checks = [[BASE, 'preview server', 'npm run build -- --mode emulator && npx vite preview --port 4173']]
  if (needsEmulators) checks.push(['http://127.0.0.1:8080', 'firestore emulator', 'npm run emulators'])
  if (needsFunctions) checks.push(['http://127.0.0.1:5001', 'functions emulator', 'npm run emulators   (make sure "functions" is in the list it prints)'])

  const down = []
  for (const [url, what, how] of checks) if (!(await reachable(url))) down.push([url, what, how])
  if (!down.length) return

  console.error('\nCannot audit — these are not running:\n')
  for (const [url, what, how] of down) console.error(`  ${what} (${url})\n      start it with:  ${how}\n`)
  if (needsFunctions && down.some((d) => d[1] === 'functions emulator')) {
    console.error('  Without the functions emulator every /store/ route renders the')
    console.error('  "store not found" card, so the audit would measure nothing real.\n')
  }
  process.exit(2)
}

const groups = GROUP === 'all' ? Object.keys(GROUPS) : [GROUP]
if (groups.some((g) => !GROUPS[g])) {
  console.error(`Unknown group. Pick one of: ${Object.keys(GROUPS).join(', ')}, all`)
  process.exit(2)
}
await preflight(groups)

const browser = await chromium.launch({ executablePath: EXECUTABLE })
let violations = 0
let layoutIssues = 0
let audited = 0

async function signIn(context, creds) {
  const page = await context.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  await page.fill('#auth-email', creds.email)
  await page.fill('#auth-password', creds.password)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(6000)
  const landed = !page.url().endsWith('/login')
  await page.close()
  return landed
}

async function auditRoute(context, route, viewport, theme) {
  const page = await context.newPage()
  // An empty page has several possible causes — the preview server not
  // running, the app built without the emulator flag, a callable refusing —
  // and they are indistinguishable from the rendered output alone. Collect
  // the evidence so a failure names its own reason.
  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 110)) })
  page.on('pageerror', (e) => consoleErrors.push(`uncaught: ${String(e.message).slice(0, 110)}`))
  let navError = null
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' }).catch((e) => { navError = String(e.message).split('\n')[0].slice(0, 110) })
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
  await page.waitForTimeout(2600)
  // Scroll-revealed content is invisible until it enters the viewport; reveal
  // it up front so the audit sees the whole page rather than the first fold.
  await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-revealed')))
  await page.waitForTimeout(400)
  await page.addScriptTag({ content: AXE })

  const result = await page.evaluate(async ({ vw, touch }) => {
    const axeRun = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })
    const out = { overflow: 0, clipped: [], zoom: [], body: document.body.innerText.trim().length }
    if (document.documentElement.scrollWidth > vw + 1) out.overflow = document.documentElement.scrollWidth - vw

    const visible = (el) => {
      const s = getComputedStyle(el)
      if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }
    const label = (el) => {
      const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : ''
      return (el.tagName.toLowerCase() + cls).slice(0, 34)
    }
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el)) continue
      const r = el.getBoundingClientRect()
      if ((r.right > vw + 1 || r.left < -1) && (el.children.length === 0 || r.width > vw)) out.clipped.push(label(el))
      const tag = el.tagName
      // Only meaningful at touch widths: iOS zooms on focus below 16px, and
      // the fix is deliberately scoped to mobile so the desktop type scale
      // keeps its smaller controls. Flagging those would be a false positive.
      if (touch && ((tag === 'INPUT' && !['checkbox', 'radio', 'hidden'].includes(el.type)) || tag === 'TEXTAREA' || tag === 'SELECT')) {
        const size = parseFloat(getComputedStyle(el).fontSize)
        if (size < 16) out.zoom.push(`${label(el)}=${size}px`)
      }
    }
    const uniq = (a) => [...new Set(a)].slice(0, 4)
    return {
      axe: axeRun.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, target: v.nodes[0]?.target.join(' ').slice(0, 40) })),
      overflow: out.overflow, clipped: uniq(out.clipped), zoom: uniq(out.zoom), body: out.body,
    }
  }, { vw: viewport.width, touch: viewport.touch })

  const snippet = await page.evaluate(() => document.body.innerText.trim().replace(/\s+/g, ' ').slice(0, 90))
  await page.close()
  return { ...result, navError, consoleErrors: [...new Set(consoleErrors)].slice(0, 3), snippet }
}


for (const groupName of groups) {
  const group = GROUPS[groupName]
  console.log(`\n═══ ${groupName} ═══`)
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  if (group.login) {
    const ok = await signIn(context, group.login)
    if (!ok) {
      console.error(`  Sign-in failed for ${group.login.email} — skipping this group.`)
      console.error('  Are the emulators seeded, and was the app built with VITE_FIREBASE_USE_EMULATOR=true?')
      await context.close()
      process.exitCode = 1
      continue
    }
  }
  const state = await context.storageState()
  await context.close()

  for (const route of group.routes) {
    for (const viewport of VIEWPORTS) {
      for (const theme of ['light', 'dark']) {
        const ctx = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          isMobile: viewport.touch, hasTouch: viewport.touch,
          deviceScaleFactor: viewport.touch ? 2 : 1,
          colorScheme: theme, storageState: state,
        })
        const r = await auditRoute(ctx, route, viewport, theme)
        await ctx.close()
        audited += 1

        const notes = []
        if (r.body < 60) {
          notes.push(`page looks empty (${r.body} chars)${r.snippet ? ` — showing: "${r.snippet}"` : ''}`)
          if (r.navError) notes.push(`navigation failed: ${r.navError} — is the preview server up at ${BASE}?`)
          for (const e of r.consoleErrors) notes.push(`console: ${e}`)
          if (!r.navError && !r.consoleErrors.length) notes.push('no console errors — the page rendered this deliberately')
        }
        if (r.overflow) notes.push(`horizontal overflow ${r.overflow}px`)
        if (r.clipped.length) notes.push(`clipped: ${r.clipped.join(', ')}`)
        if (r.zoom.length) notes.push(`iOS zoom: ${r.zoom.join(', ')}`)
        layoutIssues += (r.overflow ? 1 : 0) + r.clipped.length + r.zoom.length
        for (const v of r.axe) {
          violations += v.n
          notes.push(`[${v.impact}] ${v.id} x${v.n} (${v.target})`)
        }
        const tag = `${route} · ${viewport.name} · ${theme}`
        console.log(notes.length ? `  ✗ ${tag}\n      ${notes.join('\n      ')}` : `  ✓ ${tag}`)
      }
    }
  }
}

await browser.close()
console.log(`\nAudited ${audited} route/viewport/theme combinations.`)
console.log(`axe violations: ${violations}    layout issues: ${layoutIssues}`)
if (violations || layoutIssues) process.exitCode = 1
