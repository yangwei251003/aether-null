import type {
  MobileFallbackConfig,
  QualityHeuristicInput,
  QualityLevel,
  QualityPreset,
} from '../types'

export const QUALITY_PROFILES = {
  ULTRA: {
    level: 'ULTRA',
    targetFps: 60,
    dpr: [1, 2],
    antialias: true,
    powerPreference: 'high-performance',
    shadows: true,
    particles: {
      boot: 720,
      core: 5_200,
      tunnel: 7_200,
      artifacts: 620,
      signalLab: 4_800,
      ocean: 9_600,
      constellation: 36,
      portal: 7_400,
      cursorTrail: 32,
    },
    post: {
      enabled: true,
      multisampling: 0,
      bloom: true,
      bloomIntensity: 1.15,
      bloomLevels: 7,
      chromaticAberration: 0.00135,
      vignette: 0.42,
      noise: 0.025,
      depthOfField: true,
      dofBokehScale: 2.1,
    },
    geometrySegments: 128,
    reflectionResolution: 512,
    updateEveryNthFrame: 1,
  },
  BALANCED: {
    level: 'BALANCED',
    targetFps: 60,
    dpr: [1, 1.5],
    antialias: true,
    powerPreference: 'high-performance',
    shadows: true,
    particles: {
      boot: 420,
      core: 2_400,
      tunnel: 3_600,
      artifacts: 380,
      signalLab: 2_400,
      ocean: 4_400,
      constellation: 30,
      portal: 3_500,
      cursorTrail: 20,
    },
    post: {
      enabled: true,
      multisampling: 0,
      bloom: true,
      bloomIntensity: 0.92,
      bloomLevels: 5,
      chromaticAberration: 0.0008,
      vignette: 0.34,
      noise: 0.018,
      depthOfField: true,
      dofBokehScale: 1.25,
    },
    geometrySegments: 72,
    reflectionResolution: 256,
    updateEveryNthFrame: 1,
  },
  LITE: {
    level: 'LITE',
    targetFps: 30,
    dpr: [0.8, 1.15],
    antialias: false,
    powerPreference: 'default',
    shadows: false,
    particles: {
      boot: 160,
      core: 900,
      tunnel: 1_100,
      artifacts: 180,
      signalLab: 720,
      ocean: 1_300,
      constellation: 24,
      portal: 1_100,
      cursorTrail: 0,
    },
    post: {
      enabled: true,
      multisampling: 0,
      bloom: true,
      bloomIntensity: 0.62,
      bloomLevels: 3,
      chromaticAberration: 0,
      vignette: 0.22,
      noise: 0.01,
      depthOfField: false,
      dofBokehScale: 0,
    },
    geometrySegments: 36,
    reflectionResolution: 0,
    updateEveryNthFrame: 2,
  },
} as const satisfies Readonly<Record<QualityLevel, QualityPreset>>

export const MOBILE_FALLBACK = {
  breakpoint: 900,
  compactBreakpoint: 540,
  maxQuality: 'LITE',
  dprCap: 1.15,
  disablePointerParallax: true,
  disableScrollPin: true,
  replaceDepthOfField: true,
  reduceCameraRoll: true,
  cameraRollMultiplier: 0.16,
  particleMultiplier: 0.38,
  shortenScrollScenes: true,
  sceneSpanMultiplier: {
    boot: 1,
    awakening: 0.76,
    descent: 0.58,
    artifacts: 0.5,
    'signal-lab': 0.88,
    'memory-ocean': 0.64,
    constellation: 0.82,
    portal: 0.82,
    'specimen-lab': 1,
  },
} as const satisfies MobileFallbackConfig

export function recommendQuality(input: QualityHeuristicInput): QualityLevel {
  if (!input.webgl2 || input.reducedMotion) return 'LITE'

  const constrainedMemory = input.deviceMemory !== undefined && input.deviceMemory <= 4
  const constrainedCpu =
    input.hardwareConcurrency !== undefined && input.hardwareConcurrency <= 4

  if (
    input.width < MOBILE_FALLBACK.breakpoint ||
    input.coarsePointer ||
    constrainedMemory ||
    constrainedCpu
  ) {
    return 'LITE'
  }

  const ampleMemory = input.deviceMemory !== undefined && input.deviceMemory >= 8
  const ampleCpu = input.hardwareConcurrency !== undefined && input.hardwareConcurrency >= 8

  if (
    input.width >= 1_440 &&
    input.devicePixelRatio <= 2.5 &&
    ampleMemory &&
    ampleCpu
  ) {
    return 'ULTRA'
  }

  return 'BALANCED'
}

export function getQualityProfile(level: QualityLevel): QualityPreset {
  return QUALITY_PROFILES[level]
}
