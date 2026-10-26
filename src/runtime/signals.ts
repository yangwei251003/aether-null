export type PointerSignal = {
  x: number
  y: number
  normalizedX: number
  normalizedY: number
  speed: number
  down: boolean
}

export type ScrollSignal = {
  progress: number
  velocity: number
  direction: 1 | -1
  act: number
  actProgress: number
}

export const pointerSignal: PointerSignal = {
  x: 0,
  y: 0,
  normalizedX: 0,
  normalizedY: 0,
  speed: 0,
  down: false,
}

export const scrollSignal: ScrollSignal = {
  progress: 0,
  velocity: 0,
  direction: 1,
  act: 0,
  actProgress: 0,
}

export const renderSignal = {
  invalidate: null as null | (() => void),
  hidden: false,
}

export const navigationSignal = {
  scrollTo: null as null | ((target: HTMLElement, immediate?: boolean) => void),
}

const reducedMotionQuery = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null

export function prefersReducedMotion() {
  return reducedMotionQuery?.matches ?? false
}
