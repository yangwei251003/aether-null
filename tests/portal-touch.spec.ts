import { expect, test } from '@playwright/test'

test('touch release cannot click through Portal completion actions', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const enter = page.getByRole('button', { name: 'Enter the signal and enable sound' })
  await expect(enter).toBeEnabled({ timeout: 30_000 })
  await enter.tap()

  const portal = page.locator('#portal')
  await portal.locator('h2').evaluate((element) => element.scrollIntoView({ block: 'center' }))
  const charge = page.getByRole('button', { name: 'Hold to charge the portal' })
  const box = await charge.boundingBox()
  expect(box).not.toBeNull()
  const session = await page.context().newCDPSession(page)
  const point = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
  await expect(portal).toHaveAttribute('data-portal-state', 'crossing', { timeout: 8_000 })
  await expect(portal).toHaveClass(/is-crossing/)
  await expect(portal).toHaveClass(/is-complete/, { timeout: 12_000 })
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await session.detach()

  await expect(page.locator('#portal-title')).toHaveText('THE UNKNOWN IS OPEN')
  await expect(page.locator('#specimen-lab')).toHaveAttribute('aria-hidden', 'true')
  await expect(portal.getByRole('button', { name: /restart/i })).toBeEnabled()
  await expect(portal.getByRole('button', { name: /enter lab/i })).toBeEnabled()
})
