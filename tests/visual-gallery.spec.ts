import { expect, test } from '@playwright/test'

test.skip(!process.env.AETHER_GALLERY, 'Set AETHER_GALLERY=1 for the optional art-direction contact sheet.')
test.setTimeout(180_000)

test('captures the second visual refinement pass', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 6 })
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 8 })
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const enter = page.getByRole('button', { name: 'Enter the signal and enable sound' })
  await expect(enter).toBeEnabled({ timeout: 30_000 })
  await enter.press('Enter')
  await expect(page.locator('.scene-layer canvas')).toBeVisible()
  await page.getByRole('button', { name: /Rendering quality balanced/i }).press('Enter')
  await page.emulateMedia({ reducedMotion: 'reduce' })

  const capture = async (id: string, navName: string, filename: string) => {
    const nav = page.getByRole('button', { name: navName, exact: true })
    await nav.press('Enter')
    await expect(nav).toHaveAttribute('aria-current', 'step')
    await expect(page.locator(`#${id} h1, #${id} h2`).first()).toBeInViewport({ ratio: 0.01 })
    await page.waitForTimeout(500)
    await page.screenshot({ path: `output/playwright/${filename}`, animations: 'disabled', caret: 'hide', scale: 'css' })
  }

  await capture('artifacts', 'RELICS', 'round2-artifacts.png')
  await capture('signal-lab', 'SIGNAL', 'round2-signal.png')
  await capture('memory-ocean', 'OCEAN', 'round2-ocean.png')
  await capture('constellation', 'MAP', 'round2-map.png')
  await capture('portal', 'PORTAL', 'round2-portal.png')
  await page.getByRole('button', { name: 'Open hidden specimen lab' }).press('Enter')
  await expect(page.locator('#specimen-lab')).toHaveAttribute('aria-hidden', 'false')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'output/playwright/round2-specimen-lab.png', animations: 'disabled', caret: 'hide', scale: 'css' })
  expect(errors).toEqual([])
})
