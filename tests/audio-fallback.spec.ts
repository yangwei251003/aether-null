import { expect, test } from '@playwright/test'

test('enters silently and keeps audio controls truthful when Web Audio is unavailable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One desktop failure-path check is sufficient.')
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined })
    Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: undefined })
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const enter = page.getByRole('button', { name: 'Enter the signal and enable sound' })
  await expect(enter).toBeEnabled({ timeout: 30_000 })
  await enter.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true')
  const audio = page.getByRole('button', { name: 'Enable archive audio' })
  await expect(audio).toBeVisible()
  await audio.press('Enter')
  await expect(audio).toHaveAccessibleName('Enable archive audio')
})
