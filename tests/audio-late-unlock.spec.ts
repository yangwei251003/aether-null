import { expect, test } from '@playwright/test'

test('a late AudioContext resume cannot desynchronise sound and HUD state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  await page.addInitScript(() => {
    const audioParam = () => ({
      value: 0,
      cancelScheduledValues() {},
      exponentialRampToValueAtTime() {},
      linearRampToValueAtTime() {},
      setTargetAtTime() {},
      setValueAtTime() {},
    })
    class FakeNode {
      connect(destination?: unknown) { return destination }
      disconnect() {}
    }
    class DelayedAudioContext {
      state: AudioContextState = 'suspended'
      currentTime = 0
      sampleRate = 8_000
      destination = new FakeNode()
      createGain() { return Object.assign(new FakeNode(), { gain: audioParam() }) }
      createBiquadFilter() { return Object.assign(new FakeNode(), { type: 'lowpass', frequency: audioParam(), Q: audioParam() }) }
      createDynamicsCompressor() {
        return Object.assign(new FakeNode(), {
          threshold: audioParam(), knee: audioParam(), ratio: audioParam(), attack: audioParam(), release: audioParam(),
        })
      }
      createAnalyser() {
        return Object.assign(new FakeNode(), {
          fftSize: 2_048,
          smoothingTimeConstant: 0,
          getByteFrequencyData(target: Uint8Array) { target.fill(0) },
        })
      }
      createOscillator() {
        return Object.assign(new FakeNode(), {
          type: 'sine', frequency: audioParam(), detune: audioParam(), onended: null,
          start() {}, stop() {},
        })
      }
      createBuffer(_channels: number, length: number) {
        const data = new Float32Array(length)
        return { getChannelData: () => data }
      }
      createBufferSource() {
        return Object.assign(new FakeNode(), { buffer: null, loop: false, onended: null, start() {}, stop() {} })
      }
      resume() {
        const runtime = window as typeof window & { __lateAudioResumeCalls?: number }
        runtime.__lateAudioResumeCalls = (runtime.__lateAudioResumeCalls ?? 0) + 1
        return new Promise<void>((resolve) => window.setTimeout(() => {
          this.state = 'running'
          resolve()
        }, 1_800))
      }
      suspend() { this.state = 'suspended'; return Promise.resolve() }
      close() { this.state = 'closed'; return Promise.resolve() }
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: DelayedAudioContext })
    Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: undefined })
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  expect(await page.evaluate(() => window.AudioContext.name)).toBe('DelayedAudioContext')
  const enter = page.getByRole('button', { name: 'Enter the signal and enable sound' })
  await expect(enter).toBeEnabled({ timeout: 30_000 })
  await enter.press('Enter')
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __lateAudioResumeCalls?: number }
  ).__lateAudioResumeCalls ?? 0)).toBe(1)
  const audio = page.locator('.system-hud__controls button').first()
  await expect(audio).toBeVisible()
  await expect(audio).toHaveAccessibleName('Enable archive audio')
  await audio.press('Enter')
  await page.waitForTimeout(2_300)
  await expect(audio).toHaveAccessibleName('Mute archive audio')
})
