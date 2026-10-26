import { expect, test } from '@playwright/test'

test('LITE constrains real WebGL render submissions to the 30 FPS budget', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 3 })
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 4 })
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const enter = page.getByRole('button', { name: 'Enter the signal and enable sound' })
  await expect(enter).toBeEnabled({ timeout: 30_000 })
  await enter.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'lite')
  const canvas = page.locator('.scene-layer canvas')
  await expect(canvas).toHaveAttribute('data-render-frame', /\d+/)
  await expect(canvas).toHaveAttribute('data-frameloop', 'demand')
  const startedAt = performance.now()
  const firstFrame = Number(await canvas.getAttribute('data-render-frame'))
  await page.waitForTimeout(3_000)
  const lastFrame = Number(await canvas.getAttribute('data-render-frame'))
  const elapsedMs = performance.now() - startedAt
  const submittedFrames = lastFrame - firstFrame
  const measuredFps = submittedFrames * 1_000 / elapsedMs
  expect(submittedFrames, 'enough WebGL frames remain for an animated LITE experience').toBeGreaterThanOrEqual(24)
  expect(measuredFps, 'WebGL submissions are capped rather than following a 60/120 Hz display loop').toBeLessThan(38)
  await testInfo.attach('lite-render-budget.json', {
    body: Buffer.from(JSON.stringify({ firstFrame, lastFrame, submittedFrames, elapsedMs, measuredFps }, null, 2)),
    contentType: 'application/json',
  })
})
