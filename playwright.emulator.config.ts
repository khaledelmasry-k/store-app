import { defineConfig } from '@playwright/test'

// Emulator-mode E2E: runs against vite preview (built with --mode emulator) +
// Firebase local emulators. Projects run sequentially (workers: 1) because each
// project seeds and mutates the same emulator data store.
export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  retries: 0,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
  },
  projects: [
    {
      name: 'desktop',
      testMatch: /emulator\.spec\.ts|subscription\.spec\.ts|landing\.spec\.ts|products\.spec\.ts|customer-flow\.spec\.ts/,
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-390',
      testMatch: /emulator\.spec\.ts|subscription\.spec\.ts|landing\.spec\.ts|products\.spec\.ts|customer-flow\.spec\.ts/,
      use: { viewport: { width: 390, height: 844 } },
    },
    {
      name: 'mobile-360',
      testMatch: /responsive\.spec\.ts|landing\.spec\.ts/,
      use: { viewport: { width: 360, height: 800 } },
    },
    {
      name: 'mobile-430',
      testMatch: /responsive\.spec\.ts|landing\.spec\.ts/,
      use: { viewport: { width: 430, height: 932 } },
    },
  ],
})
