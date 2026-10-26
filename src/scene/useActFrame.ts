import { useFrame, type RootState } from '@react-three/fiber'
import { useRef } from 'react'
import { prefersReducedMotion, scrollSignal } from '../runtime/signals'
import { useAetherStore } from '../store'

type ActFrameCallback = (state: RootState, delta: number) => void

/**
 * Runs a scene animation only while one of its acts is current. LITE can skip
 * frames without losing elapsed time, and reduced-motion renders keep the
 * scroll-linked uniforms responsive while advancing time by at most 1/120 s.
 */
export function useActFrame(
  acts: readonly number[],
  updateEveryNthFrame: number,
  callback: ActFrameCallback,
  renderPriority?: number,
) {
  useConditionalFrame(
    () => !useAetherStore.getState().lab.open && acts.includes(scrollSignal.act),
    updateEveryNthFrame,
    callback,
    renderPriority,
  )
}

/** Same frame budget for overlays whose visibility is not tied to a scroll act. */
export function useConditionalFrame(
  isActive: () => boolean,
  updateEveryNthFrame: number,
  callback: ActFrameCallback,
  renderPriority?: number,
) {
  const callbackRef = useRef(callback)
  const activeRef = useRef(isActive)
  const frameRef = useRef(0)
  const elapsedRef = useRef(0)
  callbackRef.current = callback
  activeRef.current = isActive

  useFrame((state, delta) => {
    if (!activeRef.current()) {
      frameRef.current = 0
      elapsedRef.current = 0
      return
    }

    if (prefersReducedMotion()) {
      callbackRef.current(state, Math.min(delta, 1 / 120))
      return
    }

    const nth = Math.max(1, Math.round(updateEveryNthFrame))
    elapsedRef.current += Math.min(delta, 0.1)
    frameRef.current += 1
    if (frameRef.current < nth) return

    const elapsed = elapsedRef.current
    frameRef.current = 0
    elapsedRef.current = 0
    callbackRef.current(state, elapsed)
  }, renderPriority)
}
