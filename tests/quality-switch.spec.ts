import { expect, test } from '@playwright/test'

test('runtime quality switches preserve one WebGL context and reduced-motion recovery', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message))
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 6 })
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 8 })
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const enter = page.getByRole('button', { name: 'Enter the signal and enable sound' })
  await expect(enter).toBeEnabled({ timeout: 30_000 })
  await enter.press('Enter')

  const canvas = page.locator('.scene-layer canvas')
  await expect(canvas).toBeVisible()
  await canvas.evaluate((element) => { element.dataset.rendererGeneration = 'initial' })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'lite')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('data-renderer-generation', 'initial')
  expect(await canvas.evaluate((element) => (
    (element as HTMLCanvasElement).getContext('webgl2')?.getContextAttributes()?.antialias
  ))).toBe(true)
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  const qualityButton = page.locator('.quality-button')
  for (let attempt = 0; attempt < 3 && await page.locator('html').getAttribute('data-quality') !== 'balanced'; attempt += 1) {
    await qualityButton.press('Enter')
  }
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'balanced')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('data-renderer-generation', 'initial')
  await expect(page.locator('.webgl-fallback')).toHaveCount(0)
  expect(await canvas.evaluate((element) => (
    (element as HTMLCanvasElement).getContext('webgl2')?.getContextAttributes()?.antialias
  ))).toBe(true)
  await qualityButton.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'lite')
  expect(await canvas.evaluate((element) => (
    (element as HTMLCanvasElement).getContext('webgl2')?.getContextAttributes()?.antialias
  ))).toBe(true)
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
  await page.getByRole('button', { name: 'Open hidden specimen lab' }).press('Enter')
  const lab = page.locator('#specimen-lab')
  await expect(lab).toBeVisible()
  const postFx = lab.getByRole('button', { name: /post fx/i })
  await postFx.press('Enter')
  await expect(postFx).toHaveAttribute('aria-pressed', 'false')
  await postFx.press('Enter')
  await expect(postFx).toHaveAttribute('aria-pressed', 'true')
  await lab.getByRole('button', { name: 'Close specimen lab' }).press('Enter')
  await expect(lab).not.toBeVisible()
  expect(pageErrors, 'uncaught errors across live quality reconfiguration').toEqual([])
})
