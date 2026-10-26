import { expect, test } from '@playwright/test'

test('preserves the complete narrative through the designed 2D fallback', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const enter = page.getByRole('button', { name: 'Enter the signal and enable sound' })
  await expect(enter).toBeEnabled({ timeout: 30_000 })
  await enter.press('Enter')

  const fallback = page.locator('.webgl-fallback')
  await expect(fallback).toBeVisible()
  await expect(page.locator('.scene-layer canvas')).toHaveCount(0)
  await page.locator('#awakening-title').evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await expect(page.locator('#awakening')).toHaveAccessibleName(/AETHER/i)
  await expect(fallback).toHaveAttribute('data-fallback-act', 'awakening')
  await expect(fallback.locator('.fallback-core')).toBeVisible()
  for (const id of ['descent', 'artifacts', 'signal-lab', 'memory-ocean', 'constellation', 'portal']) {
    await page.locator(`#${id} h2`).first().evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await expect(fallback).toHaveAttribute('data-fallback-act', id)
    if (id === 'artifacts') {
      const inspect = page.locator('[data-testid="artifact-metal-seed"]').getByRole('button', { name: /inspect specimen/i })
      await page.locator('.artifacts__stage').evaluate((element) => element.scrollIntoView({ block: 'start' }))
      await inspect.press('Enter')
      await expect(page.getByRole('dialog', { name: /The Breathing Seed/i })).toBeVisible()
      await page.keyboard.press('Escape')
    }
    if (id === 'signal-lab') {
      await page.getByRole('button', { name: /auto align/i }).press('Enter')
      await expect(page.locator('.signal-instrument__readout strong')).toHaveText('100%')
    }
    if (id === 'constellation') {
      const node = page.getByRole('button', { name: /Origin Vault/i })
      await node.press('Enter')
      await expect(node).toHaveClass(/is-focused/)
    }
  }
  const charge = page.getByRole('button', { name: 'Hold to charge the portal' })
  await charge.focus()
  await page.keyboard.down('Space')
  await expect(page.locator('#portal')).toHaveClass(/is-complete/, { timeout: 12_000 })
  await page.keyboard.up('Space')
  const enterLab = page.getByRole('button', { name: /enter lab/i })
  await expect(enterLab).toBeEnabled()
  await enterLab.press('Enter')
  await expect(page.locator('#specimen-lab')).toHaveAttribute('aria-hidden', 'false')
  await page.getByRole('button', { name: 'Close specimen lab' }).press('Enter')
  await expect(page.locator('#main-content')).toBeVisible()
  expect(errors).toEqual([])
})
