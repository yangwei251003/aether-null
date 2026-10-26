import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'

const galleryEnabled = process.env.AETHER_FINAL_GALLERY === '1'
const galleryRoot = 'screenshots/final-round3'

test.skip(!galleryEnabled, 'Set AETHER_FINAL_GALLERY=1 to capture the final round-three evidence gallery.')
test.setTimeout(360_000)

type BrowserDiagnostics = {
  consoleErrors: string[]
  pageErrors: string[]
  requestFailures: string[]
  httpErrors: string[]
}

function observeBrowser(page: Page): BrowserDiagnostics {
  const diagnostics: BrowserDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
  }

  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => diagnostics.pageErrors.push(error.stack ?? error.message))
  page.on('requestfailed', (request) => {
    diagnostics.requestFailures.push(
      `${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown failure'}`,
    )
  })
  page.on('response', (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`)
  })

  return diagnostics
}

async function activate(control: Locator, touch: boolean) {
  if (touch) await control.tap()
  else await control.press('Enter')
}

async function settleLiveFrame(page: Page, delay = 320) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
  await page.waitForTimeout(delay)
}

async function sectionProgress(page: Page, id: string, progress: number) {
  const section = page.locator(`#${id}`)
  await expect(section).toBeAttached()
  await section.evaluate((element, nextProgress) => {
    const rect = element.getBoundingClientRect()
    const top = window.scrollY + rect.top
    const travel = Math.max(0, element.scrollHeight - window.innerHeight)
    window.scrollTo({ top: top + travel * nextProgress, behavior: 'auto' })
  }, progress)
  await settleLiveFrame(page, 620)
}

async function bringIntoView(locator: Locator, block: ScrollLogicalPosition = 'center') {
  await locator.evaluate((element, alignment) => {
    element.scrollIntoView({ behavior: 'auto', block: alignment })
  }, block)
  await expect(locator).toBeInViewport({ ratio: 0.01 })
}

function createCapture(page: Page, testInfo: TestInfo) {
  const captured: string[] = []
  const project = testInfo.project.name

  return {
    captured,
    async frame(index: number, name: string, delay = 180, settle = true) {
      if (settle) await settleLiveFrame(page, delay)
      else if (delay > 0) await page.waitForTimeout(delay)
      const filename = `${String(index).padStart(2, '0')}-${name}.png`
      const path = `${galleryRoot}/${project}/${filename}`
      await page.screenshot({
        path,
        animations: 'allow',
        caret: 'hide',
        fullPage: false,
        scale: 'css',
        timeout: 60_000,
      })
      captured.push(path)
    },
  }
}

function resetProjectGallery(project: string) {
  const directory = join(galleryRoot, project)
  mkdirSync(directory, { recursive: true })
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isFile() && (entry.name.endsWith('.png') || entry.name === 'manifest.json')) {
      unlinkSync(join(directory, entry.name))
    }
  }
}

async function enterArchive(
  page: Page,
  touch: boolean,
  captureBoot?: () => Promise<void>,
) {
  await expect.poll(() => page.evaluate(() => (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ))).toBe(false)

  const boot = page.getByRole('dialog', { name: 'Aether archive boot sequence' })
  const enter = page.getByRole('button', { name: 'Enter the signal and enable sound' })
  await expect(boot).toBeVisible()
  await expect(enter).toBeEnabled({ timeout: 30_000 })
  await expect(boot.locator('.boot__core-center strong')).toHaveText('100')
  await expect(boot).toContainText('READY')
  await captureBoot?.()
  if (touch) await enter.tap()
  else {
    // The Boot button intentionally unmounts on key activation. Driving the
    // focused page avoids Locator.press waiting on a node that correctly
    // disappeared during a very slow software-WebGL frame.
    await enter.focus()
    await page.keyboard.press('Enter')
  }
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true')
  await expect(boot).toBeHidden()
  await expect(page.locator('.scene-layer canvas')).toBeVisible({ timeout: 30_000 })
}

async function forceDesktopBalanced(page: Page) {
  const openLab = page.getByRole('button', { name: 'Open hidden specimen lab' })
  await openLab.press('Enter')
  const lab = page.locator('#specimen-lab')
  await expect(lab).toHaveAttribute('aria-hidden', 'false')
  await lab.getByRole('button', { name: 'balanced', exact: true }).press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'balanced')
  await lab.getByRole('button', { name: 'Close specimen lab' }).press('Enter')
  await expect(lab).toHaveAttribute('aria-hidden', 'true')
  await expect(page.locator('.scene-layer canvas')).toBeVisible()
  await settleLiveFrame(page, 900)
}

async function openArtifactDetail(page: Page, touch: boolean) {
  const firstCard = page.locator('[data-testid="artifact-metal-seed"]')
  const inspect = firstCard.getByRole('button', { name: /inspect specimen/i })
  await expect(firstCard).toBeInViewport({ ratio: 0.05 })
  await activate(inspect, touch)
  const dialog = page.getByRole('dialog', { name: /The Breathing Seed/i })
  await expect(dialog).toBeVisible()
  // Wait for the bounded runtime cleanup so the screenshot captures the live
  // modal, not Chromium's transient View Transition snapshot layer.
  await expect(page.locator('html')).not.toHaveAttribute('data-view-transition', /.+/, { timeout: 3_000 })
  await page.waitForTimeout(850)
  await expect(dialog).toHaveCSS('opacity', '1')
  await expect(dialog.getByRole('button', { name: 'Close artifact detail' })).toBeEnabled()
  return dialog
}

async function lockSignal(page: Page, touch: boolean) {
  const autoAlign = page.getByRole('button', { name: /auto align/i })
  await autoAlign.scrollIntoViewIfNeeded()
  await activate(autoAlign, touch)
  const lab = page.locator('#signal-lab')
  await expect(lab).toHaveClass(/is-locked/, { timeout: 8_000 })
  await expect(lab.locator('.signal-instrument__readout strong')).toHaveText('100%')
  await expect(lab.locator('.signal-instrument__readout small')).toHaveText(/^AETH-[A-F0-9]{4}-[A-F0-9]{4}$/)
  await bringIntoView(lab.locator('.signal-instrument'))
  return lab
}

async function focusConstellation(page: Page, touch: boolean, mobile: boolean) {
  await sectionProgress(page, 'constellation', mobile ? 0.92 : 0.38)
  const node = page.locator('.constellation__node-list button').filter({ hasText: 'Origin Vault' })
  await expect(node).toBeVisible()
  await activate(node, touch)
  await expect(node).toHaveClass(/is-focused/)
  await expect(page.locator('.node-focus')).toContainText('Origin Vault')
}

async function expectPortalTitleComposed(page: Page) {
  await expect.poll(() => page.locator('#portal-title').evaluate((element) => {
    const title = element.getBoundingClientRect()
    const hud = document.querySelector<HTMLElement>('.system-hud')?.getBoundingClientRect()
    const portal = element.closest<HTMLElement>('#portal')
    const narrative = portal?.querySelector<HTMLElement>('.portal__copy > p:last-child')?.getBoundingClientRect()
    const control = portal?.querySelector<HTMLElement>(portal.classList.contains('is-complete') ? '.portal__final-actions' : '.portal-charge')?.getBoundingClientRect()
    const controlsClearNarrative = !narrative || !control || narrative.bottom + 12 <= control.top
    const controlsCentered = !control || Math.abs((control.left + control.right) * 0.5 - window.innerWidth * 0.5) <= Math.max(4, window.innerWidth * 0.02)
    return title.top >= (hud?.bottom ?? 0) - 1
      && title.bottom <= window.innerHeight * 0.72
      && controlsClearNarrative
      && controlsCentered
  }), { message: 'portal declaration stays below the HUD and clear of its controls' }).toBe(true)
}

async function openLabVariant(page: Page, touch: boolean) {
  const enterLab = page.locator('#portal').getByRole('button', { name: /enter lab/i })
  await expect(enterLab).toBeEnabled({ timeout: 5_000 })
  await activate(enterLab, touch)
  const lab = page.locator('#specimen-lab')
  await expect(lab).toHaveAttribute('aria-hidden', 'false')

  const softwareRenderer = await page.locator('.scene-layer canvas').evaluate((element) => {
    const gl = (element as HTMLCanvasElement).getContext('webgl2')
    const debug = gl?.getExtension('WEBGL_debug_renderer_info')
    const renderer = String(debug && gl ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) ?? '')
    return /swiftshader|llvmpipe|software/i.test(renderer)
  })
  const fpsMetric = lab.locator('.specimen-lab__metrics span').first()
  if (softwareRenderer) await expect(fpsMetric.locator('b')).toHaveText('SW')
  else await expect.poll(async () => Number(await fpsMetric.locator('b').textContent()) > 0).toBe(true)

  for (const mode of ['event-horizon', 'refractive', 'vortex', 'solar']) {
    const control = lab.getByRole('button', { name: mode, exact: true })
    await activate(control, touch)
    await expect(control).toHaveClass(/is-active/)
  }
  const debug = lab.getByRole('button', { name: /debug field/i })
  if (await debug.getAttribute('aria-pressed') !== 'true') await activate(debug, touch)
  await expect(debug).toHaveClass(/is-active/)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'solar')
  return lab
}

async function chargePortalWithKeyboard(
  page: Page,
  frame: (index: number, name: string, delay?: number, settle?: boolean) => Promise<void>,
) {
  const portal = page.locator('#portal')
  const charge = portal.getByRole('button', { name: 'Hold to charge the portal' })
  await expect(charge).toBeVisible()
  await charge.focus()
  await page.keyboard.down('Space')
  await page.waitForTimeout(600)
  await expect(portal).toHaveAttribute('data-portal-state', 'charging')
  await expectPortalTitleComposed(page)

  await expect(portal).toHaveAttribute('data-portal-state', 'complete', { timeout: 8_000 })
  await page.keyboard.up('Space')
  await expect(portal.locator('#portal-title')).toHaveText('THE UNKNOWN IS OPEN')
  await expectPortalTitleComposed(page)
  await expect(portal.getByRole('button', { name: /enter lab/i })).toBeEnabled({ timeout: 5_000 })
  await frame(10, 'portal-open')
}

async function chargePortalWithTouch(
  page: Page,
) {
  const portal = page.locator('#portal')
  const charge = portal.getByRole('button', { name: 'Hold to charge the portal' })
  const box = await charge.boundingBox()
  expect(box).not.toBeNull()

  const session = await page.context().newCDPSession(page)
  const point = { x: box!.x + box!.width * 0.5, y: box!.y + box!.height * 0.5 }
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
    await expect(portal).toHaveAttribute('data-portal-state', 'complete', { timeout: 8_000 })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } finally {
    await session.detach()
  }

  await expect(portal.locator('#portal-title')).toHaveText('THE UNKNOWN IS OPEN')
  await expectPortalTitleComposed(page)
  await expect(portal.getByRole('button', { name: /enter lab/i })).toBeEnabled({ timeout: 5_000 })
}

async function captureDesktopJourney(page: Page, testInfo: TestInfo) {
  const capture = createCapture(page, testInfo)
  await enterArchive(page, false, () => capture.frame(0, 'boot-ready'))
  await forceDesktopBalanced(page)

  await bringIntoView(page.locator('#awakening-title'), 'start')
  await capture.frame(1, 'awakening-aether-core', 720)

  await sectionProgress(page, 'descent', 0.5)
  await expect(page.locator('#descent-title')).toBeInViewport({ ratio: 0.05 })
  await capture.frame(2, 'descent-carrier-tunnel', 520)

  await bringIntoView(page.locator('.artifacts__stage'), 'start')
  await expect(page.locator('[data-testid="artifact-metal-seed"]')).toBeInViewport({ ratio: 0.05 })
  await capture.frame(3, 'artifacts-breathing-seed', 620)

  const artifactDialog = await openArtifactDetail(page, false)
  await expect(artifactDialog).toContainText('A machine that practised becoming alive.')
  await capture.frame(4, 'artifact-shared-detail', 260)
  await artifactDialog.getByRole('button', { name: 'Close artifact detail' }).press('Enter')
  await expect(artifactDialog).toBeHidden()
  await expect(page.locator('html')).not.toHaveAttribute('data-view-transition', /.+/, { timeout: 3_000 })

  await bringIntoView(page.locator('#signal-lab-title'))
  await lockSignal(page, false)
  await capture.frame(5, 'signal-locked-success', 240)

  await sectionProgress(page, 'memory-ocean', 0.18)
  // The opening plane is deliberately pitched in 3D, so its axis-aligned
  // viewport ratio is about 0.64 even though the stage visually fills frame.
  await expect(page.locator('.ocean__visual')).toBeInViewport({ ratio: 0.58 })
  await capture.frame(6, 'memory-ocean-sea', 420)
  await sectionProgress(page, 'memory-ocean', 0.84)
  await capture.frame(7, 'memory-ocean-starlift', 520)

  await focusConstellation(page, false, false)
  await capture.frame(8, 'constellation-origin-focus', 360)

  await sectionProgress(page, 'portal', 0.34)
  await expectPortalTitleComposed(page)
  await capture.frame(9, 'portal-ready', 320)
  await chargePortalWithKeyboard(page, capture.frame)

  await openLabVariant(page, false)
  await capture.frame(11, 'specimen-lab-event-horizon', 520)

  return capture.captured
}

async function captureCompactJourney(page: Page, testInfo: TestInfo) {
  const capture = createCapture(page, testInfo)
  const project = testInfo.project.name
  const mobile = project === 'mobile'
  await enterArchive(page, true)
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'lite')

  await bringIntoView(page.locator('.artifacts__stage'), 'start')
  await expect(page.locator('[data-testid="artifact-metal-seed"]')).toBeInViewport({ ratio: 0.05 })
  await capture.frame(1, 'artifacts-recomposed', 520)

  await bringIntoView(page.locator('#signal-lab-title'))
  await lockSignal(page, true)
  await capture.frame(2, 'signal-locked-success', 240)

  await sectionProgress(page, 'memory-ocean', 0.66)
  await expect(page.locator('.ocean__visual')).toBeInViewport({ ratio: 0.35 })
  await capture.frame(3, 'memory-ocean-starlift', 420)

  await focusConstellation(page, true, mobile)
  await capture.frame(4, 'constellation-origin-focus', 320)

  await sectionProgress(page, 'portal', 0.34)
  await expectPortalTitleComposed(page)
  await capture.frame(5, 'portal-ready', 240)
  await chargePortalWithTouch(page)
  await capture.frame(6, 'portal-open', 240)

  await openLabVariant(page, true)
  await capture.frame(7, 'specimen-lab-event-horizon', 420)

  return capture.captured
}

test('captures final round-three art direction across the complete journey', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'webgl-fallback', 'The final WebGL art gallery uses the three primary viewports.')
  const touch = testInfo.project.name !== 'desktop'
  const diagnostics = observeBrowser(page)
  resetProjectGallery(testInfo.project.name)

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 8 })
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 12 })
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const captured = touch
    ? await captureCompactJourney(page, testInfo)
    : await captureDesktopJourney(page, testInfo)

  const renderer = await page.locator('.scene-layer canvas').evaluate((element) => {
    const gl = (element as HTMLCanvasElement).getContext('webgl2')
    const debug = gl?.getExtension('WEBGL_debug_renderer_info')
    return String(debug && gl ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) ?? '')
  })
  const manifest = {
    project: testInfo.project.name,
    viewport: page.viewportSize(),
    reducedMotion: await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    quality: await page.locator('html').getAttribute('data-quality'),
    renderer,
    captured,
    diagnostics,
  }
  const manifestDirectory = `${galleryRoot}/${testInfo.project.name}`
  mkdirSync(manifestDirectory, { recursive: true })
  writeFileSync(`${manifestDirectory}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`)
  await testInfo.attach('final-gallery-manifest.json', {
    body: Buffer.from(JSON.stringify(manifest, null, 2)),
    contentType: 'application/json',
  })

  expect(captured.length).toBe(testInfo.project.name === 'desktop' ? 12 : 7)
  expect(manifest.reducedMotion).toBe(false)
  expect(diagnostics.consoleErrors, 'console.error output').toEqual([])
  expect(diagnostics.pageErrors, 'uncaught page errors').toEqual([])
  expect(diagnostics.requestFailures, 'failed network requests').toEqual([])
  expect(diagnostics.httpErrors, 'HTTP responses >= 400').toEqual([])
})
