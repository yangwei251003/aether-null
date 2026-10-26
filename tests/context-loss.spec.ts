import { expect, test } from '@playwright/test'

test('moves to the complete 2D experience after a runtime WebGL context loss', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One desktop context-loss regression is sufficient.')
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const enter = page.getByRole('button', { name: 'Enter the signal and enable sound' })
  await expect(enter).toBeEnabled({ timeout: 30_000 })
  await enter.press('Enter')
  const canvas = page.locator('.scene-layer canvas')
  await expect(canvas).toBeVisible()
  const prevented = await canvas.evaluate((element) => {
    const event = new Event('webglcontextlost', { cancelable: true })
    element.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(prevented).toBe(true)
  await expect(page.locator('.webgl-fallback')).toBeVisible()
  await expect(page.locator('.scene-layer canvas')).toHaveCount(0)
  await page.locator('#signal-lab h2').evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await expect(page.locator('.webgl-fallback')).toHaveAttribute('data-fallback-act', 'signal-lab')
  await expect(page.locator('#main-content')).toBeVisible()
})
