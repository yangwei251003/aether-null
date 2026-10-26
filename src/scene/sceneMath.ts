import * as THREE from 'three'
import type { AccentColor, CameraKeyframe } from '../types'

export const ACT_IDS = [
  'boot',
  'awakening',
  'descent',
  'artifacts',
  'signal-lab',
  'memory-ocean',
  'constellation',
  'portal',
] as const

export const ACCENT_HEX: Readonly<Record<AccentColor, number>> = {
  chrome: 0xaab5c2,
  cyan: 0x35f2ff,
  magenta: 0xff3fbd,
  amber: 0xffb547,
  pearl: 0xf3f6f8,
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function smoothstep(min: number, max: number, value: number): number {
  const normalized = clamp01((value - min) / Math.max(0.00001, max - min))
  return normalized * normalized * (3 - 2 * normalized)
}

export function damp(current: number, target: number, lambda: number, delta: number): number {
  return THREE.MathUtils.damp(current, target, lambda, Math.min(delta, 0.05))
}

export function createSeededRandom(seed = 0x6d2b79f5): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

export type CameraSample = {
  fov: number
  roll: number
  focusDistance: number
}

export function sampleCameraPath(
  keyframes: readonly CameraKeyframe[],
  progress: number,
  position: THREE.Vector3,
  target: THREE.Vector3,
  sample: CameraSample,
): CameraSample {
  const p = clamp01(progress)
  let from = keyframes[0]
  let to = keyframes[keyframes.length - 1]

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const next = keyframes[index + 1]
    if (p <= next.at) {
      from = keyframes[index]
      to = next
      break
    }
  }

  const span = Math.max(0.0001, to.at - from.at)
  const local = smoothstep(0, 1, (p - from.at) / span)
  position.set(
    THREE.MathUtils.lerp(from.position[0], to.position[0], local),
    THREE.MathUtils.lerp(from.position[1], to.position[1], local),
    THREE.MathUtils.lerp(from.position[2], to.position[2], local),
  )
  target.set(
    THREE.MathUtils.lerp(from.target[0], to.target[0], local),
    THREE.MathUtils.lerp(from.target[1], to.target[1], local),
    THREE.MathUtils.lerp(from.target[2], to.target[2], local),
  )

  sample.fov = THREE.MathUtils.lerp(from.fov, to.fov, local)
  sample.roll = THREE.MathUtils.lerp(from.roll ?? 0, to.roll ?? 0, local)
  sample.focusDistance = THREE.MathUtils.lerp(
    from.focusDistance ?? position.distanceTo(target),
    to.focusDistance ?? position.distanceTo(target),
    local,
  )
  return sample
}

export function setAttribute(
  geometry: THREE.BufferGeometry,
  name: string,
  array: Float32Array,
  itemSize: number,
): void {
  geometry.setAttribute(name, new THREE.BufferAttribute(array, itemSize))
}
