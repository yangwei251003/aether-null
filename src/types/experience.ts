export type Vec2 = readonly [x: number, y: number]
export type Vec3 = readonly [x: number, y: number, z: number]

export type MainActId =
  | 'boot'
  | 'awakening'
  | 'descent'
  | 'artifacts'
  | 'signal-lab'
  | 'memory-ocean'
  | 'constellation'
  | 'portal'

export type ActId = MainActId | 'specimen-lab'
export type MainActIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
export type ActIndex = MainActIndex | 8

export type AccentColor =
  | 'chrome'
  | 'cyan'
  | 'magenta'
  | 'amber'
  | 'pearl'

export type SignalMotif = 'signal' | 'ring' | 'light-trail' | 'fragment'

export interface ActContent {
  readonly id: ActId
  readonly index: ActIndex
  readonly anchor: string
  readonly eyebrow: string
  readonly title: readonly string[]
  readonly subtitle: string
  readonly narrative: string
  readonly prompt: string
  readonly signalCode: string
  readonly accent: AccentColor
  readonly secondaryAccent: AccentColor
  readonly visualLead: string
  readonly motifs: readonly SignalMotif[]
  readonly scrollSpanVh: number
  readonly hidden?: boolean
}

export type ArtifactId =
  | 'metal-seed'
  | 'chrono-orbit'
  | 'data-crystal'
  | 'folded-city'
  | 'memory-mask'

export type ArtifactGeometry =
  | 'breathing-seed'
  | 'nested-orbits'
  | 'refractive-crystal'
  | 'folded-architecture'
  | 'spectral-mask'

export interface ArtifactDatum {
  readonly id: ArtifactId
  readonly catalogue: string
  readonly title: string
  readonly subtitle: string
  readonly description: string
  readonly longDescription: string
  readonly geometry: ArtifactGeometry
  readonly accent: AccentColor
  readonly position: Vec3
  readonly rotation: Vec3
  readonly scale: number
  readonly orbitRate: number
  readonly distortion: number
  readonly data: Readonly<Record<string, string>>
}

export type MajorConstellationNodeId =
  | 'origin-vault'
  | 'echo-choir'
  | 'glass-frontier'
  | 'pale-engine'
  | 'memory-delta'
  | 'null-gate'

export type ConstellationNodeId = MajorConstellationNodeId | `relay-${number}`

export interface ConstellationNode {
  readonly id: ConstellationNodeId
  readonly label: string
  readonly code: string
  readonly position: Vec3
  readonly radius: number
  readonly intensity: number
  readonly major: boolean
  readonly accent: AccentColor
  readonly chapter?: MainActId
  readonly description?: string
}

export interface ConstellationConnection {
  readonly from: ConstellationNodeId
  readonly to: ConstellationNodeId
  readonly strength: number
  readonly pulseOffset: number
}

export interface CameraKeyframe {
  /** Normalized scene progress from 0 to 1. */
  readonly at: number
  readonly position: Vec3
  readonly target: Vec3
  readonly fov: number
  readonly roll?: number
  readonly focusDistance?: number
}

export interface CameraPath {
  readonly act: ActId
  readonly damping: number
  readonly pointerInfluence: Vec2
  readonly keyframes: readonly CameraKeyframe[]
}

export interface SiteMetadata {
  readonly name: string
  readonly displayName: string
  readonly subtitle: string
  readonly archiveId: string
  readonly language: string
  readonly entryLabel: string
  readonly scrollLabel: string
}

