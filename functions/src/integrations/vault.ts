import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

export type CredentialEnvelope = {
  algorithm: 'aes-256-gcm'
  ciphertext: string
  iv: string
  authTag: string
  keyVersion: number
}

const EMULATOR_KEY = 'mk-store-emulator-integration-vault-key-v1'

function masterKey(): Buffer {
  const configured = String(process.env.INTEGRATION_VAULT_KEY || '').trim()
  if (!configured && process.env.FUNCTIONS_EMULATOR !== 'true') {
    throw new Error('INTEGRATION_VAULT_KEY is not configured')
  }
  if (configured) {
    // A production vault key is an exact 32-byte key, not a passphrase. Node's
    // Base64 decoder is intentionally permissive, so validate the canonical
    // representation as well as the decoded length before using it.
    if (!/^[A-Za-z0-9+/]{43}=$/.test(configured)) {
      throw new Error('INTEGRATION_VAULT_KEY must be canonical Base64 for exactly 32 bytes')
    }
    const decoded = Buffer.from(configured, 'base64')
    if (decoded.length !== 32 || decoded.toString('base64') !== configured) {
      throw new Error('INTEGRATION_VAULT_KEY must decode to exactly 32 bytes')
    }
    return decoded
  }
  // This deterministic key exists only so local emulator fixtures survive
  // process restarts. It is never accepted by a deployed function.
  return createHash('sha256').update(EMULATOR_KEY, 'utf8').digest()
}

function aad(input: { storeId: string; provider: string; integrationType: string; keyVersion?: number }) {
  return Buffer.from(`${input.storeId}:${input.integrationType}:${input.provider}:v${input.keyVersion || 1}`, 'utf8')
}

export function encryptCredentials(
  credentials: Record<string, unknown>,
  identity: { storeId: string; provider: string; integrationType: string; keyVersion?: number },
): CredentialEnvelope {
  const keyVersion = identity.keyVersion || 1
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv)
  cipher.setAAD(aad({ ...identity, keyVersion }))
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()])
  return {
    algorithm: 'aes-256-gcm',
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    keyVersion,
  }
}

export function decryptCredentials(
  envelope: CredentialEnvelope,
  identity: { storeId: string; provider: string; integrationType: string },
): Record<string, unknown> {
  if (envelope.algorithm !== 'aes-256-gcm') throw new Error('Unsupported credential encryption algorithm')
  const decipher = createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(envelope.iv, 'base64'))
  decipher.setAAD(aad({ ...identity, keyVersion: envelope.keyVersion }))
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'))
  const clear = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
  return JSON.parse(clear) as Record<string, unknown>
}

export function redactCredentialValue(value: unknown): string | null {
  const normalized = String(value || '').trim()
  if (!normalized) return null
  return `${'*'.repeat(12)}${normalized.slice(-4)}`
}

export function sanitizeCredentials(provider: string, input: unknown): Record<string, string> {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  if (provider === 'bosta') {
    const apiKey = String(raw.apiKey || '').trim()
    const webhookSecret = String(raw.webhookSecret || '').trim()
    if (!apiKey) throw new Error('Bosta API key is required')
    if (!webhookSecret) throw new Error('Bosta webhook Authorization key is required')
    if (apiKey.length > 4096 || webhookSecret.length > 4096) throw new Error('Credential value is too long')
    return { apiKey, webhookSecret }
  }
  if (provider === 'wasla') {
    const apiKey = String(raw.apiKey || '').trim()
    if (!apiKey) throw new Error('Wasla API key is required')
    if (apiKey.length > 4096) throw new Error('Credential value is too long')
    return { apiKey }
  }
  throw new Error(`Unsupported credential provider: ${provider}`)
}

export function credentialSummary(credentials: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(credentials).map(([key, value]) => [key, redactCredentialValue(value)]))
}

export function sanitizeSensitiveText(value: unknown, credentialValues: unknown[] = []) {
  let text = String(value || 'Unexpected integration error').replace(/[\r\n\t]+/g, ' ').slice(0, 2000)
  for (const credential of credentialValues) {
    const secret = String(credential || '').trim()
    if (secret.length >= 4) text = text.split(secret).join('[REDACTED]')
  }
  return text
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(authorization|api[-_ ]?key|token|secret)\s*[:=]\s*["']?[^\s,"'};]+/gi, '$1=[REDACTED]')
    .slice(0, 500)
}
