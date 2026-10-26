import type { SignalLabConfig, SignalParameterId } from '../types'

export const SIGNAL_LAB = {
  parameters: {
    frequency: {
      id: 'frequency',
      label: 'Frequency',
      shortLabel: 'FREQ',
      min: 17,
      max: 88,
      step: 0.1,
      initial: 43.2,
      target: 61.8,
      tolerance: 3.2,
      unit: 'THz',
    },
    coherence: {
      id: 'coherence',
      label: 'Coherence',
      shortLabel: 'COH',
      min: 0,
      max: 1,
      step: 0.01,
      initial: 0.24,
      target: 0.86,
      tolerance: 0.075,
      unit: '',
    },
    entropy: {
      id: 'entropy',
      label: 'Entropy',
      shortLabel: 'ENT',
      min: 0,
      max: 1,
      step: 0.01,
      initial: 0.76,
      target: 0.18,
      tolerance: 0.09,
      unit: '',
    },
  },
  lockHoldMs: 1_400,
  successThreshold: 0.88,
  attractionRadius: 2.8,
  repulsionRadius: 1.15,
  fieldStrength: 0.72,
  signalPrefix: 'AETH',
} as const satisfies SignalLabConfig

export function scoreSignal(
  parameters: Readonly<Record<SignalParameterId, number>>,
): number {
  const scores = (Object.keys(parameters) as SignalParameterId[]).map((id) => {
    const spec = SIGNAL_LAB.parameters[id]
    const distance = Math.abs(parameters[id] - spec.target)
    return 1 - Math.min(1, Math.max(0, distance / (spec.tolerance * 2.5)))
  })
  return scores.reduce((total, score) => total + score, 0) / scores.length
}
