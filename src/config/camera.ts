import type { ActId, CameraPath } from '../types'

export const CAMERA_PATHS = {
  boot: {
    act: 'boot',
    damping: 0.08,
    pointerInfluence: [0.03, 0.03],
    keyframes: [
      { at: 0, position: [0, 0, 7.5], target: [0, 0, 0], fov: 34, focusDistance: 7.5 },
      { at: 1, position: [0, 0, 6.2], target: [0, 0, 0], fov: 32, focusDistance: 6.2 },
    ],
  },
  awakening: {
    act: 'awakening',
    damping: 0.065,
    pointerInfluence: [0.38, 0.24],
    keyframes: [
      { at: 0, position: [0.1, 0.15, 8.6], target: [0, 0, 0], fov: 38, focusDistance: 8.5 },
      { at: 0.28, position: [-0.55, 0.28, 7.1], target: [0.05, 0, 0], fov: 36, roll: -0.018, focusDistance: 7 },
      { at: 0.62, position: [0.35, -0.15, 4.9], target: [0, 0, -0.2], fov: 41, roll: 0.025, focusDistance: 4.7 },
      { at: 1, position: [0.02, 0.02, 1.35], target: [0, 0, -2.8], fov: 52, focusDistance: 1.6 },
    ],
  },
  descent: {
    act: 'descent',
    damping: 0.09,
    pointerInfluence: [0.7, 0.45],
    keyframes: [
      { at: 0, position: [0, 0, 0.6], target: [0, 0, -8], fov: 54, focusDistance: 5 },
      { at: 0.24, position: [-0.4, 0.22, -13], target: [0.25, -0.1, -24], fov: 61, roll: -0.055, focusDistance: 8 },
      { at: 0.52, position: [0.65, -0.38, -31], target: [-0.3, 0.2, -46], fov: 67, roll: 0.07, focusDistance: 11 },
      { at: 0.78, position: [-0.2, 0.15, -55], target: [0, 0, -76], fov: 72, roll: -0.035, focusDistance: 15 },
      { at: 1, position: [0, 0, -82], target: [0, 0, -98], fov: 48, roll: 0, focusDistance: 12 },
    ],
  },
  artifacts: {
    act: 'artifacts',
    damping: 0.055,
    pointerInfluence: [0.22, 0.16],
    keyframes: [
      { at: 0, position: [-9.1, 1.1, 8.2], target: [-8.2, 0.1, 0], fov: 34, focusDistance: 8.1 },
      { at: 0.25, position: [-4.8, 0.65, 7.3], target: [-4.1, 0, -0.4], fov: 32, focusDistance: 7.2 },
      { at: 0.5, position: [0.1, 0.75, 6.7], target: [0, 0.15, 0], fov: 31, focusDistance: 6.5 },
      { at: 0.75, position: [4.6, 0.55, 7.4], target: [4.2, -0.15, -0.2], fov: 33, focusDistance: 7.2 },
      { at: 1, position: [9, 0.8, 8], target: [8.4, 0, 0.1], fov: 35, focusDistance: 7.8 },
    ],
  },
  'signal-lab': {
    act: 'signal-lab',
    damping: 0.075,
    pointerInfluence: [0.32, 0.32],
    keyframes: [
      { at: 0, position: [0, 1.8, 8.3], target: [0, 0, 0], fov: 40, focusDistance: 8 },
      { at: 0.45, position: [-0.7, 0.45, 6.4], target: [0, 0, 0], fov: 43, roll: -0.015, focusDistance: 6.1 },
      { at: 1, position: [0, 0.15, 5.3], target: [0, 0, -0.3], fov: 46, focusDistance: 5 },
    ],
  },
  'memory-ocean': {
    act: 'memory-ocean',
    damping: 0.045,
    pointerInfluence: [0.26, 0.12],
    keyframes: [
      { at: 0, position: [0, 3.1, 8.2], target: [0, -0.65, -3], fov: 42, focusDistance: 10 },
      { at: 0.32, position: [-1, 1.6, 5], target: [0, -0.4, -5], fov: 47, roll: -0.015, focusDistance: 8 },
      { at: 0.66, position: [0.7, 0.4, 3], target: [0, 1.1, -7], fov: 52, roll: 0.018, focusDistance: 7 },
      { at: 1, position: [0, 0, 2.2], target: [0, 6, -5], fov: 58, roll: 0, focusDistance: 9 },
    ],
  },
  constellation: {
    act: 'constellation',
    damping: 0.05,
    pointerInfluence: [0.18, 0.18],
    keyframes: [
      { at: 0, position: [0, 0.3, 14], target: [0, 0, 0], fov: 42, focusDistance: 14 },
      { at: 0.5, position: [0.8, -0.2, 11.5], target: [0, 0, -0.5], fov: 45, roll: 0.01, focusDistance: 11 },
      { at: 1, position: [3.9, -0.8, 8.2], target: [5.8, -1.6, -1.8], fov: 38, roll: -0.012, focusDistance: 9.5 },
    ],
  },
  portal: {
    act: 'portal',
    damping: 0.04,
    pointerInfluence: [0.12, 0.1],
    keyframes: [
      { at: 0, position: [0, 0.4, 10.5], target: [0, 0, 0], fov: 36, focusDistance: 10 },
      { at: 0.58, position: [0, 0.1, 7.4], target: [0, 0, -0.8], fov: 40, focusDistance: 7.2 },
      { at: 0.86, position: [0, 0.02, 5.8], target: [0, 0, -1.4], fov: 42, focusDistance: 5.6 },
      { at: 1, position: [0, 0, 5.2], target: [0, 0, -1.8], fov: 43, focusDistance: 5.1 },
    ],
  },
  'specimen-lab': {
    act: 'specimen-lab',
    damping: 0.1,
    pointerInfluence: [0.44, 0.44],
    keyframes: [
      { at: 0, position: [0, 0.8, 7], target: [0, 0, 0], fov: 44, focusDistance: 6.8 },
      { at: 1, position: [0.5, 0.1, 5.8], target: [0, 0, 0], fov: 48, focusDistance: 5.5 },
    ],
  },
} as const satisfies Readonly<Record<ActId, CameraPath>>

export function getCameraPath(act: ActId): CameraPath {
  return CAMERA_PATHS[act]
}
