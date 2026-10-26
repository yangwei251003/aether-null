import { defineConfig } from '@playwright/test'

const ci = Boolean(
  (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.CI,
)

const baseUse = {
  channel: process.env.AETHER_BROWSER_CHANNEL || undefined,
  baseURL: 'http://127.0.0.1:4173',
  browserName: 'chromium' as const,
  colorScheme: 'dark' as const,
  locale: 'en-US',
  timezoneId: 'Asia/Shanghai',
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference' as const,
  trace: 'retain-on-failure' as const,
  screenshot: 'only-on-failure' as const,
  video: 'retain-on-failure' as const,
  actionTimeout: 15_000,
  navigationTimeout: 30_000,
}

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 150_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'output/playwright/report', open: 'never' }],
  ],
  outputDir: 'output/playwright/results',
  projects: [
    {
      name: 'desktop',
      testIgnore: '**/fallback.spec.ts',
      use: {
        ...baseUse,
        viewport: { width: 1_440, height: 900 },
        hasTouch: false,
        isMobile: false,
      },
    },
    {
      name: 'tablet',
      testIgnore: '**/fallback.spec.ts',
      use: {
        ...baseUse,
        viewport: { width: 1_024, height: 1_366 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'mobile',
      testIgnore: '**/fallback.spec.ts',
      use: {
        ...baseUse,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'webgl-fallback',
      testMatch: '**/fallback.spec.ts',
      use: {
        ...baseUse,
        viewport: { width: 1_440, height: 900 },
        launchOptions: { args: ['--disable-webgl', '--disable-webgl2'] },
      },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
