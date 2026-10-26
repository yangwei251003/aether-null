import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'

test.setTimeout(360_000)

type BrowserDiagnostics = {
  consoleErrors: string[]
  consoleWarnings: string[]
  pageErrors: string[]
  requestFailures: string[]
  httpErrors: string[]
}

function observeBrowser(page: Page): BrowserDiagnostics {
  const diagnostics: BrowserDiagnostics = {
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
  }

  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text())
    if (message.type() === 'warning') diagnostics.consoleWarnings.push(message.text())
  })
  page.on('pageerror', (error) => diagnostics.pageErrors.push(error.stack ?? error.message))
  page.on('requestfailed', (request) => {
    diagnostics.requestFailures.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown failure'}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`)
  })

  return diagnostics
}

const diagnosticsByPage = new WeakMap<Page, BrowserDiagnostics>()

test.beforeEach(async ({ page }) => {
  diagnosticsByPage.set(page, observeBrowser(page))
})

test.afterEach(async ({ page }, testInfo) => {
  const diagnostics = diagnosticsByPage.get(page)
  if (!diagnostics) return
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name)).catch(() => [] as string[])
  const externalResources = resources.filter((url) => {
    try { return new URL(url).origin !== 'http://127.0.0.1:4173' } catch { return false }
  })
  const liveWebglRenderer = await page.locator('.scene-layer canvas').first().evaluate((element) => {
    const gl = (element as HTMLCanvasElement).getContext('webgl2')
    if (!gl) return null
    const debug = gl.getExtension('WEBGL_debug_renderer_info')
    return String(debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
  }).catch(() => null)
  const cachedWebglRenderer = await page.evaluate(() => (
    window as typeof window & { __aetherWebGLRenderer?: string }
  ).__aetherWebGLRenderer ?? null).catch(() => null)
  const webglRenderer = liveWebglRenderer ?? cachedWebglRenderer
  const softwareReadbackWarning = (message: string) => (
    webglRenderer?.includes('SwiftShader')
    && /^\[\.WebGL-[^\]]+\]GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels(?: \(this message will no longer repeat\))?$/.test(message)
  )
  const unexpectedWarnings = diagnostics.consoleWarnings.filter((message) => (
    message !== 'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.'
    && !softwareReadbackWarning(message)
  ))
  await testInfo.attach('browser-diagnostics.json', {
    body: Buffer.from(JSON.stringify({ ...diagnostics, webglRenderer, externalResources }, null, 2)),
    contentType: 'application/json',
  })
  expect(diagnostics.consoleErrors, 'console.error output').toEqual([])
  expect(diagnostics.pageErrors, 'uncaught page errors').toEqual([])
  expect(diagnostics.requestFailures, 'failed network requests').toEqual([])
  expect(diagnostics.httpErrors, 'HTTP responses >= 400').toEqual([])
  expect(unexpectedWarnings, 'unexpected console warnings').toEqual([])
  expect(externalResources, 'remote hot-linked resources').toEqual([])
})

async function scrollToAct(page: Page, id: string, heading: RegExp) {
  const section = page.locator(`#${id}`)
  await expect(section).toBeAttached()
  const title = section.locator('h1, h2').first()
  await title.evaluate((element) => element.scrollIntoView({ behavior: 'auto', block: 'center' }))
  await expect(title).toHaveAccessibleName(heading)
  await expect(title).toBeInViewport({ ratio: 0.01 })
}

async function activate(control: Locator, touch: boolean) {
  if (touch) await control.tap()
  else await control.press('Enter')
}

async function enterArchive(page: Page, touch: boolean) {
  const boot = page.getByRole('dialog', { name: 'Aether archive boot sequence' })
  await expect(boot).toBeVisible()
  await expect(page.getByRole('link', { name: 'Skip to archive narrative' })).toHaveCount(0)

  // Readiness is driven by document.fonts, the compressed ocean image and the
  // dynamic SceneCanvas module; no state or network response is mocked here.
  const enter = page.getByRole('button', { name: 'Enter the signal and enable sound' })
  await expect(enter).toBeEnabled({ timeout: 30_000 })
  await expect(boot.locator('.boot__core-center strong')).toHaveText('100')
  await expect(boot).toContainText('READY')
  // Keyboard activation verifies the accessible entry path while avoiding the
  // software-WebGL pointer raycaster competing with Playwright's synthetic mouse.
  await activate(enter, touch)

  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true')
  await expect(boot).toBeHidden()
  await expect(page.locator('#main-content')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Skip to archive narrative' })).toHaveCount(1)
  await expect(page.locator('.scene-layer canvas, .webgl-fallback').first()).toBeVisible()
}

async function captureHero(page: Page, testInfo: TestInfo) {
  await page.locator('#awakening').evaluate((element) => element.scrollIntoView({ behavior: 'auto', block: 'start' }))
  await expect(page.locator('.awakening__title')).toBeInViewport({ ratio: 0.2 })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(900)

  // `animations: disabled` only stabilizes the capture frame. The preceding and
  // following assertions exercise the live GSAP, Lenis, Canvas and WebGL paths.
  await page.screenshot({
    path: `output/playwright/${testInfo.project.name}.png`,
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    scale: 'css',
  })
}

test('boots, traverses all acts and completes the interaction loop', async ({ page }, testInfo) => {
  const touch = testInfo.project.name !== 'desktop'
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 6 })
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 8 })
    const runtime = window as typeof window & { __aetherLongTasks?: Array<{ start: number; duration: number }> }
    runtime.__aetherLongTasks = []
    if ('PerformanceObserver' in window) {
      try {
        new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => runtime.__aetherLongTasks?.push({ start: entry.startTime, duration: entry.duration }))
        }).observe({ type: 'longtask', buffered: true })
      } catch { /* Long Task API is optional. */ }
    }
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await enterArchive(page, touch)
  await captureHero(page, testInfo)
  const canvas = page.locator('.scene-layer canvas')
  await expect(canvas).toBeVisible()
  await canvas.evaluate((element) => {
    const gl = (element as HTMLCanvasElement).getContext('webgl2')
    const debug = gl?.getExtension('WEBGL_debug_renderer_info')
    ;(window as typeof window & { __aetherWebGLRenderer?: string }).__aetherWebGLRenderer = String(
      gl && debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) ?? '',
    )
  })
  await expect(page.locator('.webgl-fallback')).toHaveCount(0)
  // The compact volume panel is intentionally disclosed by hover/focus.
  // Focus the audio toggle first so the range is both visually and
  // accessibly present before exercising it on every pointer profile.
  await page.getByRole('button', { name: /archive audio/i }).focus()
  const volume = page.getByRole('slider', { name: 'Archive audio volume' })
  await expect(volume).toBeVisible()
  await volume.fill('0.31')
  await expect(volume).toHaveValue('0.31')
  await expect(volume).toHaveAttribute('aria-valuetext', '31 percent')
  const startupAntialias = await canvas.evaluate((element) => (
    (element as HTMLCanvasElement).getContext('webgl2')?.getContextAttributes()?.antialias
  ))
  if (testInfo.project.name === 'desktop') {
    expect(['balanced', 'lite']).toContain(await page.locator('html').getAttribute('data-quality'))
  } else {
    await expect(page.locator('html')).toHaveAttribute('data-quality', 'lite')
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'lite')
  await expect(page.locator('.cursor-trail')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Locked by reduced motion preference/i })).toBeDisabled()
  expect(await canvas.evaluate((element) => Boolean((element as HTMLCanvasElement).getContext('webgl2'))), 'WebGL2 context').toBe(true)
  let baselineHeapUsed: number | null = null
  if (testInfo.project.name === 'desktop') {
    const baselineSession = await page.context().newCDPSession(page)
    await baselineSession.send('HeapProfiler.collectGarbage')
    baselineHeapUsed = (await baselineSession.send('Runtime.getHeapUsage')).usedSize
    await baselineSession.detach()
  }
  await expect(canvas).toBeVisible()
  expect(
    await canvas.evaluate((element) => (element as HTMLCanvasElement).getContext('webgl2')?.getContextAttributes()?.antialias),
    'startup WebGL context remains stable during a runtime LITE switch',
  ).toBe(startupAntialias)
  if (testInfo.project.name !== 'desktop') expect(startupAntialias, 'mobile starts with LITE antialiasing disabled').toBe(false)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  if (testInfo.project.name === 'desktop') {
    await expect(page.getByRole('button', { name: /Click to change/i })).toBeEnabled()
    const qualityButton = page.locator('.quality-button')
    for (let attempt = 0; attempt < 3 && await page.locator('html').getAttribute('data-quality') !== 'balanced'; attempt += 1) {
      await qualityButton.press('Enter')
    }
    await expect(page.locator('html')).toHaveAttribute('data-quality', 'balanced')
    await expect(canvas).toBeVisible()
    expect(
      await canvas.evaluate((element) => (element as HTMLCanvasElement).getContext('webgl2')?.getContextAttributes()?.antialias),
      'restored BALANCED context antialiasing',
    ).toBe(true)
    await qualityButton.press('Enter')
    await expect(page.locator('html')).toHaveAttribute('data-quality', 'lite')
  } else {
    await expect(page.locator('html')).toHaveAttribute('data-quality', 'lite')
    await expect(page.getByRole('button', { name: /Locked by mobile performance policy/i })).toBeDisabled()
  }
  await expect(page.locator('#awakening')).toHaveAccessibleName(/AETHER/i)
  await expect(page.locator('#descent')).toHaveAccessibleName(/FALL THROUGH THE CARRIER WAVE/i)
  await expect(page.locator('#artifacts')).toHaveAccessibleName(/OBJECTS THAT OUTLIVED THEIR MAKERS/i)
  await expect(page.locator('#memory-ocean')).toHaveAccessibleName(/EVERY MEMORY LEARNS TO BECOME WATER/i)

  await scrollToAct(page, 'descent', /FALL THROUGH THE CARRIER WAVE/i)
  await scrollToAct(page, 'artifacts', /OBJECTS THAT OUTLIVED THEIR MAKERS/i)
  const inspect = page.locator('[data-testid="artifact-metal-seed"]').getByRole('button', { name: /inspect specimen/i })
  await page.locator('.artifacts__stage').evaluate((element) => element.scrollIntoView({ behavior: 'auto', block: 'start' }))
  await expect(inspect).toBeVisible()
  await activate(inspect, touch)
  const artifactDialog = page.getByRole('dialog', { name: /The Breathing Seed/i })
  await expect(artifactDialog).toBeVisible()
  await expect(artifactDialog).toContainText('A machine that practised becoming alive.')
  if (touch) await page.locator('.artifact-modal__backdrop').tap({ position: { x: 4, y: 4 } })
  else await page.locator('.artifact-modal__backdrop').click({ position: { x: 4, y: 4 } })
  await expect(artifactDialog).toBeHidden()
  await page.waitForTimeout(250)
  await expect(page.getByRole('dialog', { name: /The Breathing Seed/i })).toHaveCount(0)
  await activate(inspect, touch)
  await expect(page.getByRole('dialog', { name: /The Breathing Seed/i })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: /The Breathing Seed/i })).toBeHidden()

  await scrollToAct(page, 'signal-lab', /ALIGN\s+WHAT REMAINS/i)
  await activate(page.getByRole('button', { name: /auto align/i }), touch)
  await expect(page.locator('.signal-instrument__readout strong')).toHaveText('100%')
  await expect(page.locator('#signal-lab')).toHaveClass(/is-locked/, { timeout: 5_000 })
  await expect(page.locator('.signal-instrument__readout small')).toHaveText(/^AETH-[A-F0-9]{4}-[A-F0-9]{4}$/)

  await scrollToAct(page, 'memory-ocean', /EVERY MEMORY LEARNS TO BECOME WATER/i)
  const oceanSection = page.locator('#memory-ocean')
  await oceanSection.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const top = window.scrollY + rect.top
    const travel = Math.max(0, element.scrollHeight - window.innerHeight)
    window.scrollTo({ top: top + travel * 0.66, behavior: 'auto' })
  })
  await page.waitForTimeout(650)
  // `overflow: clip` is intentional here: unlike hidden, it does not turn the
  // section into a non-scrolling sticky container and strand the ocean stage.
  // The live rotateX/parallax composition deliberately reduces the browser's
  // axis-aligned intersection ratio while the stage still fills the frame.
  await expect(page.locator('.ocean__visual')).toBeInViewport({ ratio: 0.58 })
  await scrollToAct(page, 'constellation', /THE MAP IS\s+LOOKING BACK/i)
  await expect(page.getByRole('list', { name: 'Major constellation nodes' })).toBeVisible()
  const originNode = page.locator('.constellation__node-list button').filter({ hasText: 'Origin Vault' })
  await expect(originNode).toBeVisible()
  await activate(originNode, touch)
  await expect(originNode).toHaveClass(/is-focused/)
  await expect(page.locator('.node-focus')).toContainText('Origin Vault')

  await scrollToAct(page, 'portal', /MAKE THE\s+UNKNOWN POSSIBLE/i)
  const portalCharge = page.getByRole('button', { name: 'Hold to charge the portal' })
  if (touch) {
    const box = await portalCharge.boundingBox()
    expect(box).not.toBeNull()
    const session = await page.context().newCDPSession(page)
    const point = { x: box!.x + box!.width * 0.5, y: box!.y + box!.height * 0.5 }
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
    await expect(page.locator('#portal')).toHaveClass(/is-complete/, { timeout: 12_000 })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await session.detach()
  } else {
    const buttonBox = await portalCharge.boundingBox()
    expect(buttonBox).not.toBeNull()
    await page.mouse.move(buttonBox!.x + buttonBox!.width * 0.76, buttonBox!.y + buttonBox!.height * 0.5)
    await expect.poll(() => portalCharge.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2)
    }), {
      message: 'magnetic motion preserves the Portal control base centering transform',
    }).toBeLessThan(await page.evaluate(() => window.innerWidth * 0.02))
    await portalCharge.focus()
    await page.keyboard.down('Space')
    await expect(page.locator('#portal')).toHaveClass(/is-complete/, { timeout: 12_000 })
    await page.keyboard.up('Space')
  }
  await expect(page.locator('#portal-title')).toHaveText('THE UNKNOWN IS OPEN')
  await expect.poll(() => page.locator('#portal-title').evaluate((element) => {
    const title = element.getBoundingClientRect()
    const hud = document.querySelector<HTMLElement>('.system-hud')?.getBoundingClientRect()
    const portal = element.closest<HTMLElement>('#portal')
    const narrative = portal?.querySelector<HTMLElement>('.portal__copy > p:last-child')?.getBoundingClientRect()
    const actions = portal?.querySelector<HTMLElement>('.portal__final-actions')?.getBoundingClientRect()
    return title.top >= (hud?.bottom ?? 0) - 1
      && title.bottom <= window.innerHeight * 0.72
      && (!narrative || !actions || narrative.bottom + 12 <= actions.top)
  }), { message: 'the completed portal declaration stays fully composed below the HUD' }).toBe(true)
  await expect(page.locator('.portal__charge-readout')).toHaveText('GATE::OPEN')

  // The final fixed composition is scoped to the active Portal act. Moving
  // away must restore normal document positioning so the ending cannot become
  // a viewport-wide overlay over earlier chapters.
  await page.locator('#awakening').evaluate((element) => element.scrollIntoView({ behavior: 'auto', block: 'start' }))
  await expect(page.locator('.app-shell')).toHaveAttribute('data-active-act', 'awakening')
  await expect(page.locator('#portal-title')).not.toBeInViewport()
  await page.locator('#portal').evaluate((element) => element.scrollIntoView({ behavior: 'auto', block: 'center' }))
  await expect(page.locator('.app-shell')).toHaveAttribute('data-active-act', 'portal')
  await expect(page.locator('#portal-title')).toBeInViewport({ ratio: 0.5 })

  const finalActions = page.locator('.portal__final-actions')
  const restartAction = finalActions.getByRole('button', { name: /restart/i })
  const enterLabAction = finalActions.getByRole('button', { name: /enter lab/i })
  const viewSystemAction = finalActions.getByRole('button', { name: /view system/i })
  await expect(restartAction).toBeAttached()
  await expect(enterLabAction).toBeEnabled()
  await expect(viewSystemAction).toBeEnabled()
  await enterLabAction.scrollIntoViewIfNeeded()
  await activate(enterLabAction, touch)

  const specimenLab = page.locator('#specimen-lab')
  await expect(specimenLab).toHaveAttribute('aria-hidden', 'false')
  await expect(specimenLab).toBeVisible()
  await expect(specimenLab.locator('.specimen-lab__metrics')).toContainText('FPS')
  await expect(specimenLab.locator('.specimen-lab__metrics')).toContainText('DPR')
  if (testInfo.project.name === 'mobile') {
    const undersizedButtons = await page.locator('button:visible, [role="slider"]:visible').evaluateAll((buttons) => buttons
      .map((button) => ({ label: button.getAttribute('aria-label') ?? button.textContent?.trim(), rect: button.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width < 43.5 || rect.height < 43.5)
      .map(({ label, rect }) => ({ label, width: rect.width, height: rect.height })))
    expect(undersizedButtons, 'mobile interactive targets smaller than 44 CSS px').toEqual([])
  }
  await activate(specimenLab.getByRole('button', { name: 'event-horizon', exact: true }), touch)
  await expect(specimenLab.getByRole('button', { name: 'event-horizon', exact: true })).toHaveClass(/is-active/)
  await activate(specimenLab.getByRole('button', { name: 'solar', exact: true }), touch)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'solar')
  await activate(specimenLab.getByRole('button', { name: 'lite', exact: true }), touch)
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'lite')
  const postFx = specimenLab.getByRole('button', { name: /post fx/i })
  if (await postFx.getAttribute('aria-pressed') === 'false') {
    await activate(postFx, touch)
    await expect(postFx).toHaveClass(/is-active/)
  }
  await activate(postFx, touch)
  await expect(postFx).not.toHaveClass(/is-active/)
  await activate(postFx, touch)
  await expect(postFx).toHaveClass(/is-active/)
  const postFxIntensity = specimenLab.getByRole('slider', { name: 'Post processing intensity' })
  await postFxIntensity.fill('0.35')
  await expect(postFxIntensity).toHaveValue('0.35')
  await expect(page.locator('html')).toHaveCSS('--post-fx-intensity', '0.35')
  const debugField = specimenLab.getByRole('button', { name: /debug field/i })
  await activate(debugField, touch)
  await expect(debugField).toHaveClass(/is-active/)
  await activate(specimenLab.getByRole('button', { name: 'Close specimen lab' }), touch)
  await expect(specimenLab).toHaveAttribute('aria-hidden', 'true')

  // Complete the real end-to-start loop after every mutable subsystem has
  // been exercised, then compare retained heap to the pre-journey baseline.
  await restartAction.scrollIntoViewIfNeeded()
  await activate(restartAction, touch)
  await expect(page.locator('#awakening-title')).toBeInViewport({ ratio: 0.05 })
  await expect(page.locator('nav[aria-label="Archive chapters"] button').first()).toHaveAttribute('aria-current', 'step')
  await expect(page.locator('#portal')).not.toHaveClass(/is-complete/)
  await expect(page.locator('.portal__charge-readout')).toHaveText('GATE::000')
  await expect(page.locator('#signal-lab')).not.toHaveClass(/is-locked/)
  await expect(page.locator('.signal-instrument__readout strong')).not.toHaveText('100%')
  await expect(page.locator('.signal-instrument__readout small')).toHaveText('UNRESOLVED')
  await expect(originNode).not.toHaveClass(/is-focused/)
  await expect(page.locator('.node-focus')).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: /The Breathing Seed/i })).toHaveCount(0)

  const runtimeMetrics = await page.evaluate(async () => {
    const intervals: number[] = []
    let previous = performance.now()
    await Promise.race([new Promise<void>((resolve) => {
      const sample = (now: number) => {
        intervals.push(now - previous)
        previous = now
        if (intervals.length >= 24) resolve()
        else requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    }), new Promise<void>((resolve) => window.setTimeout(resolve, 8_000))])
    const sorted = intervals.slice().sort((a, b) => a - b)
    const runtime = window as typeof window & { __aetherLongTasks?: Array<{ start: number; duration: number }> }
    return {
      samples: sorted.length,
      frameIntervalMedianMs: sorted[Math.floor(sorted.length * 0.5)] ?? null,
      frameIntervalP95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? null,
      longTasks: runtime.__aetherLongTasks ?? [],
      resources: performance.getEntriesByType('resource').length,
    }
  })
  if (testInfo.project.name === 'desktop') {
    const session = await page.context().newCDPSession(page)
    await session.send('Performance.enable')
    await session.send('HeapProfiler.collectGarbage')
    const performanceMetrics = await session.send('Performance.getMetrics')
    const heap = await session.send('Runtime.getHeapUsage')
    const heapDelta = baselineHeapUsed === null ? null : heap.usedSize - baselineHeapUsed
    if (heapDelta !== null) expect(heapDelta, 'retained JS heap after the full journey and Restart').toBeLessThan(16 * 1024 * 1024)
    await testInfo.attach('performance-memory.json', {
      body: Buffer.from(JSON.stringify({ runtimeMetrics, performanceMetrics, heap, baselineHeapUsed, heapDelta }, null, 2)),
      contentType: 'application/json',
    })
    await session.detach()
  } else {
    await testInfo.attach('performance-memory.json', {
      body: Buffer.from(JSON.stringify({ runtimeMetrics }, null, 2)),
      contentType: 'application/json',
    })
  }
})
