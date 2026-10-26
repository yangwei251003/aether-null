export type SignalParameterId = 'frequency' | 'coherence' | 'entropy'

export interface SignalParameterSpec {
  readonly id: SignalParameterId
  readonly label: string
  readonly shortLabel: string
  readonly min: number
  readonly max: number
  readonly step: number
  readonly initial: number
  readonly target: number
  readonly tolerance: number
  readonly unit: string
}

export interface SignalLabConfig {
  readonly parameters: Readonly<Record<SignalParameterId, SignalParameterSpec>>
  readonly lockHoldMs: number
  readonly successThreshold: number
  readonly attractionRadius: number
  readonly repulsionRadius: number
  readonly fieldStrength: number
  readonly signalPrefix: string
}

export type LabShaderMode = 'spectral' | 'interference' | 'event-horizon'
export type LabMaterialMode = 'chrome' | 'iridescent' | 'refractive'
export type LabFieldMode = 'attract' | 'repel' | 'vortex'
export type ThemeVariant = 'aether' | 'solar' | 'null' | 'pearl'

