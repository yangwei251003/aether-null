import type { ActId } from './experience'

export type QualityLevel = 'ULTRA' | 'BALANCED' | 'LITE'
export type QualitySource = 'auto' | 'manual'

export interface ParticleBudget {
  readonly boot: number
  readonly core: number
  readonly tunnel: number
  readonly artifacts: number
  readonly signalLab: number
  readonly ocean: number
  readonly constellation: number
  readonly portal: number
  readonly cursorTrail: number
}

export interface PostProcessingBudget {
  readonly enabled: boolean
  readonly multisampling: number
  readonly bloom: boolean
  readonly bloomIntensity: number
  readonly bloomLevels: number
  readonly chromaticAberration: number
  readonly vignette: number
  readonly noise: number
  readonly depthOfField: boolean
  readonly dofBokehScale: number
}

export interface QualityPreset {
  readonly level: QualityLevel
  readonly targetFps: 30 | 45 | 60
  readonly dpr: readonly [min: number, max: number]
  readonly antialias: boolean
  readonly powerPreference: WebGLPowerPreference
  readonly shadows: boolean
  readonly particles: ParticleBudget
  readonly post: PostProcessingBudget
  readonly geometrySegments: number
  readonly reflectionResolution: 0 | 128 | 256 | 512
  readonly updateEveryNthFrame: number
}

export interface MobileFallbackConfig {
  readonly breakpoint: number
  readonly compactBreakpoint: number
  readonly maxQuality: QualityLevel
  readonly dprCap: number
  readonly disablePointerParallax: boolean
  readonly disableScrollPin: boolean
  readonly replaceDepthOfField: boolean
  readonly reduceCameraRoll: boolean
  readonly cameraRollMultiplier: number
  readonly particleMultiplier: number
  readonly shortenScrollScenes: boolean
  readonly sceneSpanMultiplier: Readonly<Record<ActId, number>>
}

export interface QualityHeuristicInput {
  readonly width: number
  readonly coarsePointer: boolean
  readonly reducedMotion: boolean
  readonly devicePixelRatio: number
  readonly hardwareConcurrency?: number
  readonly deviceMemory?: number
  readonly webgl2: boolean
}
