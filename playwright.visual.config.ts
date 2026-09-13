import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: /ui-visual-review\.spec\.ts/,
  timeout: 45000,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', screenshot: 'only-on-failure' },
  projects: [
    { name: '1440', use: { viewport: { width: 1440, height: 900 } } },
    { name: '1024', use: { viewport: { width: 1024, height: 768 } } },
    { name: '768', use: { viewport: { width: 768, height: 1024 } } },
    { name: '430', use: { viewport: { width: 430, height: 932 } } },
    { name: '390', use: { viewport: { width: 390, height: 844 } } },
    { name: '360', use: { viewport: { width: 360, height: 800 } } },
  ],
})
