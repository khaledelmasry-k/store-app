export type AppCheckStrategy = 'disabled' | 'emulator' | 'recaptcha-enterprise'

type AppCheckRuntime = {
  isProduction: boolean
  useEmulator: boolean
  siteKey?: string
}

/**
 * Emulator mode always wins over Vite's production-build flag. This prevents
 * `vite build --mode emulator` from ever starting the real reCAPTCHA provider,
 * even when a site key is present in the shell environment.
 */
export function resolveAppCheckStrategy(runtime: AppCheckRuntime): AppCheckStrategy {
  if (runtime.useEmulator) return 'emulator'
  if (runtime.isProduction && String(runtime.siteKey || '').trim()) return 'recaptcha-enterprise'
  return 'disabled'
}

function encodeJwtPart(value: object): string {
  return btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/**
 * Local-only unsigned token for the Functions emulator. The emulator decodes
 * callable tokens with verification disabled; production always verifies the
 * signature and therefore rejects this token. No debug secret is required.
 */
export function createEmulatorAppCheckToken(projectId: string): string {
  const issuedAt = Math.floor(Date.now() / 1000)
  return [
    encodeJwtPart({ alg: 'none', typ: 'JWT' }),
    encodeJwtPart({
      sub: `${projectId}-emulator-web`,
      aud: [`projects/${projectId}`],
      iss: `https://firebaseappcheck.googleapis.com/projects/${projectId}`,
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
    'emulator',
  ].join('.')
}
