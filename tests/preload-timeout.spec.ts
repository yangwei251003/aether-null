import { expect, test } from '@playwright/test'

test('a stalled critical asset cannot trap the user in Boot', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  await page.addInitScript(() => {
    class NeverSettlingImage {
      decoding = 'async'
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) { /* Intentionally never settles. */ }
    }
    Object.defineProperty(window, 'Image', { configurable: true, value: NeverSettlingImage })
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const enter = page.locator('.boot__core')
  await expect(enter).toBeEnabled({ timeout: 20_000 })
  await expect(enter).toHaveAccessibleName('Enter the signal and enable sound')
  await expect(page.locator('.boot__status')).toContainText('Fallback retained')
  await enter.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true')
  await expect(page.locator('#main-content')).toBeVisible()
})
