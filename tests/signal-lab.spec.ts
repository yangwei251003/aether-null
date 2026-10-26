import { expect, test, type Locator } from '@playwright/test'

async function setRange(input: Locator, value: number) {
  await input.evaluate((element, nextValue) => {
    const control = element as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(control, String(nextValue))
    control.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

test('manual signal tuning uses the same visible and lock scoring model', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const enter = page.getByRole('button', { name: 'Enter the signal and enable sound' })
  await expect(enter).toBeEnabled({ timeout: 30_000 })
  await enter.press('Enter')
  await page.locator('#signal-lab-title').evaluate((element) => element.scrollIntoView({ block: 'center' }))

  await setRange(page.getByRole('slider', { name: 'Coherence' }), 0.86)
  await setRange(page.getByRole('slider', { name: 'Entropy' }), 0.18)
  await setRange(page.getByRole('slider', { name: 'Frequency' }), 64.5)
  await expect(page.locator('.signal-instrument__readout strong')).toHaveText('89%')
  await expect(page.locator('#signal-lab')).toHaveClass(/is-locked/, { timeout: 5_000 })
  await expect(page.locator('.signal-instrument__readout small')).toHaveText(/^AETH-[A-F0-9]{4}-[A-F0-9]{4}$/)
})
