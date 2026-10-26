import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test('records bounded render, loading and memory evidence', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One desktop sample avoids duplicating software-WebGL load.')
  test.setTimeout(150_000)

  const errors: string[] = []
  const warnings: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
    if (message.type() === 'warning') warnings.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 6 })
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 8 })
    const runtime = window as typeof window & { __aetherPerfLongTasks?: Array<{ start: number; duration: number }> }
    runtime.__aetherPerfLongTasks = []
    try {
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => runtime.__aetherPerfLongTasks?.push({ start: entry.startTime, duration: entry.duration }))
      }).observe({ type: 'longtask', buffered: true })
    } catch { /* Optional in some engines. */ }
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const enter = page.getByRole('button', { name: 'Enter the signal and enable sound' })
  await expect(enter).toBeEnabled({ timeout: 30_000 })
  await enter.press('Enter')
  const canvas = page.locator('.scene-layer canvas')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('data-frameloop', 'always')

  const sampleFrames = (label: string) => page.evaluate(async (sampleLabel) => {
    const intervals: number[] = []
    let previous = performance.now()
    await Promise.race([
      new Promise<void>((resolve) => {
        const sample = (now: number) => {
          intervals.push(now - previous)
          previous = now
          if (intervals.length >= 36) resolve()
          else requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
      }),
      new Promise<void>((resolve) => window.setTimeout(resolve, 10_000)),
    ])
    const sorted = intervals.slice().sort((a, b) => a - b)
    return {
      label: sampleLabel,
      samples: sorted.length,
      medianMs: sorted[Math.floor(sorted.length * 0.5)] ?? null,
      p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? null,
      estimatedFps: sorted.length ? 1_000 / (sorted[Math.floor(sorted.length * 0.5)] || 1) : null,
    }
  }, label)

  await page.locator('#awakening').evaluate((element) => element.scrollIntoView({ behavior: 'auto', block: 'start' }))
  await page.waitForTimeout(650)
  const balanced = await sampleFrames('AUTO / BALANCED START / software WebGL')
  const qualityAfterBalancedSample = await page.locator('html').getAttribute('data-quality')
  const sampledRenderer = await page.locator('.scene-layer canvas').evaluate((element) => {
    const gl = (element as HTMLCanvasElement).getContext('webgl2')
    const debug = gl?.getExtension('WEBGL_debug_renderer_info')
    return String(debug && gl ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) ?? '')
  })
  if (sampledRenderer.toLowerCase().includes('swiftshader')) {
    // Preserve the automatic source: one slow window lowers BALANCED to LITE,
    // then the following LITE window disables even the reduced post stack.
    await expect.poll(() => page.locator('html').getAttribute('data-quality'), {
      message: 'software WebGL is automatically reduced to LITE',
      timeout: 20_000,
    }).toBe('lite')
  } else {
    const qualityButton = page.locator('.quality-button')
    for (let attempt = 0; attempt < 3 && await page.locator('html').getAttribute('data-quality') !== 'lite'; attempt += 1) {
      await qualityButton.press('Enter')
    }
  }
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'lite')
  await expect(canvas).toHaveAttribute('data-frameloop', 'demand')
  await page.waitForTimeout(450)
  const lite = await sampleFrames('LITE / software WebGL')
  if (sampledRenderer.toLowerCase().includes('swiftshader')) {
    await expect.poll(() => page.locator('html').getAttribute('data-post-fx'), {
      message: 'a second slow automatic window disables the LITE post stack',
      timeout: 15_000,
    }).toBe('off')
  }

  const browserTimings = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    const canvas = document.querySelector<HTMLCanvasElement>('.scene-layer canvas')
    const context = canvas?.getContext('webgl2') ?? null
    const rendererInfo = context?.getExtension('WEBGL_debug_renderer_info') ?? null
    return {
      domContentLoadedMs: navigation ? navigation.domContentLoadedEventEnd - navigation.startTime : null,
      loadEventMs: navigation ? navigation.loadEventEnd - navigation.startTime : null,
      resourceCount: resources.length,
      transferredBytes: resources.reduce((total, resource) => total + resource.transferSize, 0),
      decodedBytes: resources.reduce((total, resource) => total + resource.decodedBodySize, 0),
      webglVendor: context && rendererInfo ? String(context.getParameter(rendererInfo.UNMASKED_VENDOR_WEBGL)) : null,
      webglRenderer: context && rendererInfo ? String(context.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL)) : null,
      longTasks: (() => {
        const runtime = window as typeof window & { __aetherPerfLongTasks?: Array<{ start: number; duration: number }> }
        const entries = runtime.__aetherPerfLongTasks ?? []
        return {
          count: entries.length,
          totalDurationMs: entries.reduce((total, entry) => total + entry.duration, 0),
          maxDurationMs: entries.reduce((maximum, entry) => Math.max(maximum, entry.duration), 0),
        }
      })(),
    }
  })
  const session = await page.context().newCDPSession(page)
  await session.send('Performance.enable')
  const chromiumMetrics = await session.send('Performance.getMetrics')
  const heap = await session.send('Runtime.getHeapUsage')
  await session.detach()

  const evidence = {
    capturedAt: new Date().toISOString(),
    environment: 'Playwright Chromium headless on Windows. Renderer identity is captured below; these figures are regression evidence, not a native end-user GPU benchmark.',
    balanced,
    lite,
    adaptiveState: {
      qualityAfterBalancedSample,
      qualityAfterLiteSample: await page.locator('html').getAttribute('data-quality'),
      postFxAfterLiteSample: await page.locator('html').getAttribute('data-post-fx'),
      frameloopAfterLiteSample: await canvas.getAttribute('data-frameloop'),
    },
    browserTimings,
    heap,
    chromiumMetrics,
    errors,
    warnings,
  }
  mkdirSync('output/playwright', { recursive: true })
  writeFileSync('output/playwright/performance-desktop.json', `${JSON.stringify(evidence, null, 2)}\n`)
  await testInfo.attach('performance-desktop.json', {
    body: Buffer.from(JSON.stringify(evidence, null, 2)),
    contentType: 'application/json',
  })
  expect(errors).toEqual([])
  expect(balanced.samples).toBeGreaterThan(4)
  expect(lite.samples).toBeGreaterThan(4)
  expect(browserTimings.domContentLoadedMs ?? Number.POSITIVE_INFINITY).toBeLessThan(3_000)
  expect(browserTimings.loadEventMs ?? Number.POSITIVE_INFINITY).toBeLessThan(15_000)
  expect(browserTimings.resourceCount).toBeLessThanOrEqual(20)
  expect(browserTimings.transferredBytes).toBeLessThan(1_500_000)
  expect(browserTimings.decodedBytes).toBeLessThan(3_000_000)
  expect(browserTimings.longTasks.maxDurationMs).toBeLessThan(10_000)
  expect(heap.usedSize).toBeLessThan(32 * 1024 * 1024)
  expect(lite.medianMs ?? Number.POSITIVE_INFINITY).toBeLessThan(1_000)
  expect(lite.p95Ms ?? Number.POSITIVE_INFINITY).toBeLessThan(2_000)
  if (browserTimings.webglRenderer?.toLowerCase().includes('swiftshader')) {
    expect(evidence.adaptiveState.qualityAfterLiteSample).toBe('lite')
    expect(evidence.adaptiveState.postFxAfterLiteSample).toBe('off')
  }
})
