import { defineConfig } from '@playwright/test'

// Emulator-mode E2E: runs against vite preview (built with --mode emulator) +
// Firebase local emulators. Projects run sequentially (workers: 1) because each
// project seeds and mutates the same emulator data store.
export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  // A single fresh-context retry distinguishes an intermittent Chromium/emulator
  // session loss from a deterministic product regression. A persistent failure
  // still blocks the release gate.
  retries: 1,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.PW_BASE_URL ?? 'http://localhost:4173',
  },
  projects: [
    {
      name: 'desktop',
      testMatch: /auth-harness\.spec\.ts|emulator\.spec\.ts|email-verification\.spec\.ts|subscription\.spec\.ts|landing\.spec\.ts|launch-ops-verification\.spec\.ts|launch-full-tour\.spec\.ts|launch-coupons\.spec\.ts|launch-impersonation\.spec\.ts|launch-shipping-onboarding\.spec\.ts|launch-tour-suppression\.spec\.ts|products\.spec\.ts|customer-flow\.spec\.ts|branding\.spec\.ts|saas\.spec\.ts|variant-logic\.spec\.ts|variant-flow\.spec\.ts|storage-limit\.spec\.ts|seo\.spec\.ts|platform-subscriptions\.spec\.ts|merchant-lifecycle\.spec\.ts|payment-proof\.spec\.ts|system-audit\.spec\.ts|integration-foundation\.spec\.ts|platform-crm\.spec\.ts/,
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-390',
      testMatch: /emulator\.spec\.ts|subscription\.spec\.ts|landing\.spec\.ts|launch-ops-verification\.spec\.ts|products\.spec\.ts|customer-flow\.spec\.ts|branding\.spec\.ts|saas\.spec\.ts|variant-logic\.spec\.ts|variant-flow\.spec\.ts|storage-limit\.spec\.ts|seo\.spec\.ts|platform-subscriptions\.spec\.ts/,
      use: { viewport: { width: 390, height: 844 } },
    },
    {
      name: 'mobile-360',
      testMatch: /responsive\.spec\.ts|landing\.spec\.ts|launch-ops-verification\.spec\.ts/,
      use: { viewport: { width: 360, height: 800 } },
    },
    {
      name: 'mobile-430',
      testMatch: /responsive\.spec\.ts|landing\.spec\.ts|launch-ops-verification\.spec\.ts/,
      use: { viewport: { width: 430, height: 932 } },
    },
  ],
})
