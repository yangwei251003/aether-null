import { expect, test } from '@playwright/test'

test('portal charge follows elapsed time and restart clears the full loop', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 3 })
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 4 })
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const enter = page.getByRole('button', { name: 'Enter the signal and enable sound' })
  await expect(enter).toBeEnabled({ timeout: 30_000 })
  await enter.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true')
  const session = await page.context().newCDPSession(page)
  await session.send('HeapProfiler.collectGarbage')
  const baselineHeap = await session.send('Runtime.getHeapUsage')

  const portal = page.locator('#portal')
  await portal.locator('h2').evaluate((element) => element.scrollIntoView({ block: 'center' }))
  const canvas = page.locator('.scene-layer canvas')
  await expect(canvas).toHaveAttribute('data-camera-z', /.+/)
  expect(Number(await canvas.getAttribute('data-camera-z')), 'dormant portal camera stays in front of the gate').toBeGreaterThan(0)
  const charge = page.getByRole('button', { name: 'Hold to charge the portal' })
  await charge.focus()
  await page.keyboard.down('Space')
  await page.waitForTimeout(420)
  await charge.blur()
  await page.keyboard.up('Space')
  await expect(portal).not.toHaveClass(/is-complete/)
  await expect(page.locator('.portal__charge-readout')).toHaveText('GATE::000')

  await charge.focus()
  await page.keyboard.down('Space')
  await expect(portal).toHaveAttribute('data-portal-state', 'crossing', { timeout: 8_000 })
  await expect(portal).toHaveClass(/is-crossing/)
  await expect(charge).toBeDisabled()
  await expect.poll(async () => Number(await canvas.getAttribute('data-camera-z')), {
    message: 'camera crosses the gate only after the charged state begins',
  }).toBeLessThan(0)
  await expect(portal).toHaveClass(/is-complete/, { timeout: 12_000 })
  await expect(portal).toHaveAttribute('data-portal-state', 'complete')
  await page.keyboard.up('Space')

  await portal.getByRole('button', { name: /restart/i }).press('Enter')
  await expect(portal).not.toHaveClass(/is-complete/)
  await expect(portal.locator('h2')).toHaveAccessibleName(/MAKE THE UNKNOWN POSSIBLE/i)
  await expect(page.locator('.signal-instrument__readout strong')).not.toHaveText('100%')
  await expect(page.locator('.signal-instrument__readout small')).toHaveText('UNRESOLVED')
  await session.send('HeapProfiler.collectGarbage')
  const restartHeap = await session.send('Runtime.getHeapUsage')
  expect(restartHeap.usedSize - baselineHeap.usedSize, 'retained JS heap after Portal restart').toBeLessThan(8 * 1024 * 1024)
  await testInfo.attach('restart-memory.json', {
    body: Buffer.from(JSON.stringify({ baselineHeap, restartHeap, delta: restartHeap.usedSize - baselineHeap.usedSize }, null, 2)),
    contentType: 'application/json',
  })
  await session.detach()
})
