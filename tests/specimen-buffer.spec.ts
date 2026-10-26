import { expect, test } from '@playwright/test'

test('specimen particle density reuses one bounded GPU buffer set', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    const audit = { created: 0, deleted: 0 }
    ;(window as typeof window & { __aetherBufferAudit?: typeof audit }).__aetherBufferAudit = audit
    const prototype = WebGL2RenderingContext.prototype
    const createBuffer = prototype.createBuffer
    const deleteBuffer = prototype.deleteBuffer
    prototype.createBuffer = function (...args) {
      audit.created += 1
      return createBuffer.apply(this, args)
    }
    prototype.deleteBuffer = function (...args) {
      audit.deleted += 1
      return deleteBuffer.apply(this, args)
    }
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const enter = page.getByRole('button', { name: 'Enter the signal and enable sound' })
  await expect(enter).toBeEnabled({ timeout: 30_000 })
  await enter.press('Enter')
  await page.getByRole('button', { name: 'Open hidden specimen lab' }).press('Enter')
  const lab = page.locator('#specimen-lab')
  await expect(lab).toHaveAttribute('aria-hidden', 'false')
  const slider = lab.getByRole('slider', { name: /particle field/i })
  const before = await page.evaluate(() => (
    window as typeof window & { __aetherBufferAudit?: { created: number; deleted: number } }
  ).__aetherBufferAudit!)

  for (const value of ['0.25', '1.5', '0.4', '1.25', '0.55', '1.4', '0.8', '1.1', '0.3', '1']) {
    await slider.evaluate((element, nextValue) => {
      const input = element as HTMLInputElement
      input.value = nextValue
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }, value)
  }
  await expect(slider).toHaveValue('1')
  await page.waitForTimeout(500)
  const after = await page.evaluate(() => (
    window as typeof window & { __aetherBufferAudit?: { created: number; deleted: number } }
  ).__aetherBufferAudit!)
  expect(after.created - before.created, 'new GPU buffers created by density-only changes').toBeLessThanOrEqual(2)
  await expect(page.locator('.scene-layer canvas')).toHaveCount(1)
  expect(await page.locator('.scene-layer canvas').evaluate((element) => Boolean(
    (element as HTMLCanvasElement).getContext('webgl2'),
  ))).toBe(true)
  await testInfo.attach('gpu-buffer-audit.json', {
    body: Buffer.from(JSON.stringify({ before, after, delta: {
      created: after.created - before.created,
      deleted: after.deleted - before.deleted,
    } }, null, 2)),
    contentType: 'application/json',
  })
})
