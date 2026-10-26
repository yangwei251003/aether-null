import type { ArtifactId, ConstellationNodeId, MainActId } from './experience'
import type {
  LabFieldMode,
  LabMaterialMode,
  LabShaderMode,
  SignalParameterId,
  ThemeVariant,
} from './lab'
import type { QualityLevel, QualitySource } from './quality'

export type BootPhase = 'loading' | 'ready' | 'entering' | 'complete' | 'error'
export type SignalGameStatus = 'idle' | 'calibrating' | 'aligned' | 'locked'
export type PortalStatus = 'dormant' | 'charging' | 'charged' | 'crossing' | 'complete'

export interface BootRuntimeState {
  readonly phase: BootPhase
  readonly progress: number
  readonly loaded: number
  readonly total: number
  readonly error: string | null
}

export interface AudioRuntimeState {
  readonly enabled: boolean
  readonly initialized: boolean
  readonly muted: boolean
  readonly volume: number
}

export interface QualityRuntimeState {
  readonly level: QualityLevel
  readonly source: QualitySource
}

export interface LabRuntimeState {
  readonly open: boolean
  readonly shader: LabShaderMode
  readonly material: LabMaterialMode
  readonly field: LabFieldMode
  readonly theme: ThemeVariant
  readonly timeScale: number
  readonly particleMultiplier: number
  readonly postProcessing: boolean
  readonly postFxIntensity: number
  readonly debug: boolean
  /** Sampled at a low cadence by the diagnostics UI, never every frame. */
  readonly fps: number
  readonly dpr: number
}

export interface SignalGameRuntimeState {
  readonly status: SignalGameStatus
  readonly parameters: Readonly<Record<SignalParameterId, number>>
  readonly alignment: number
  readonly signalId: string | null
  readonly attempts: number
}

export interface PortalRuntimeState {
  readonly status: PortalStatus
  readonly charge: number
  readonly traversed: boolean
}

export interface ArtifactRuntimeState {
  readonly selectedId: ArtifactId | null
  readonly discoveredIds: readonly ArtifactId[]
}

export interface NodeRuntimeState {
  readonly hoveredId: ConstellationNodeId | null
  readonly focusedId: ConstellationNodeId | null
  readonly discoveredIds: readonly ConstellationNodeId[]
}

export interface ExperienceState {
  readonly entered: boolean
  readonly activeAct: MainActId
  readonly chapterProgress: number
  readonly boot: BootRuntimeState
  readonly audio: AudioRuntimeState
  readonly quality: QualityRuntimeState
  readonly lab: LabRuntimeState
  readonly game: SignalGameRuntimeState
  readonly portal: PortalRuntimeState
  readonly artifact: ArtifactRuntimeState
  readonly node: NodeRuntimeState
}
