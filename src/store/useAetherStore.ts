import { create } from 'zustand'
import { SIGNAL_LAB, scoreSignal } from '../config/signal-lab'
import type {
  ArtifactId,
  ConstellationNodeId,
  ExperienceState,
  LabFieldMode,
  LabMaterialMode,
  LabShaderMode,
  MainActId,
  QualityLevel,
  QualitySource,
  SignalParameterId,
  ThemeVariant,
} from '../types'

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const clamp01 = (value: number): number => clamp(value, 0, 1)

const INITIAL_STATE: ExperienceState = {
  entered: false,
  activeAct: 'boot',
  chapterProgress: 0,
  boot: {
    phase: 'loading',
    progress: 0,
    loaded: 0,
    total: 0,
    error: null,
  },
  audio: {
    enabled: false,
    initialized: false,
    muted: true,
    volume: 0.42,
  },
  quality: {
    level: 'BALANCED',
    source: 'auto',
  },
  lab: {
    open: false,
    shader: 'spectral',
    material: 'chrome',
    field: 'attract',
    theme: 'aether',
    timeScale: 1,
    particleMultiplier: 1,
    postProcessing: true,
    postFxIntensity: 1,
    debug: false,
    fps: 0,
    dpr: 1,
  },
  game: {
    status: 'idle',
    parameters: {
      frequency: SIGNAL_LAB.parameters.frequency.initial,
      coherence: SIGNAL_LAB.parameters.coherence.initial,
      entropy: SIGNAL_LAB.parameters.entropy.initial,
    },
    alignment: 0,
    signalId: null,
    attempts: 0,
  },
  portal: {
    status: 'dormant',
    charge: 0,
    traversed: false,
  },
  artifact: {
    selectedId: null,
    discoveredIds: [],
  },
  node: {
    hoveredId: null,
    focusedId: null,
    discoveredIds: [],
  },
}

function createSignalId(): string {
  const bytes = new Uint8Array(4)

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()

  return `${SIGNAL_LAB.signalPrefix}-${token.slice(0, 4)}-${token.slice(4)}`
}

export interface AetherStore extends ExperienceState {
  setBootProgress: (progress: number, loaded?: number, total?: number) => void
  markBootReady: () => void
  markBootEntering: () => void
  setBootError: (message: string) => void
  enterExperience: (enableAudio?: boolean) => void

  setActiveAct: (act: MainActId) => void
  setChapterProgress: (progress: number) => void

  setAudioEnabled: (enabled: boolean) => void
  markAudioInitialized: () => void
  setMuted: (muted: boolean) => void
  toggleMuted: () => void
  setVolume: (volume: number) => void

  setQuality: (level: QualityLevel, source?: QualitySource) => void
  setAutoQuality: (level: QualityLevel) => void

  setLabOpen: (open: boolean) => void
  toggleLab: () => void
  setLabShader: (shader: LabShaderMode) => void
  setLabMaterial: (material: LabMaterialMode) => void
  setLabField: (field: LabFieldMode) => void
  setLabTheme: (theme: ThemeVariant) => void
  setTimeScale: (timeScale: number) => void
  setParticleMultiplier: (multiplier: number) => void
  setPostProcessing: (enabled: boolean) => void
  setPostFxIntensity: (intensity: number) => void
  setDebug: (enabled: boolean) => void
  setDebugMetrics: (fps: number, dpr: number) => void

  beginSignalCalibration: () => void
  setSignalParameter: (parameter: SignalParameterId, value: number) => void
  lockSignal: () => string | null
  resetSignalGame: () => void

  startPortalCharge: () => void
  setPortalCharge: (charge: number) => void
  addPortalCharge: (delta: number) => void
  cancelPortalCharge: () => void
  beginPortalCrossing: () => void
  completePortalTraversal: () => void
  resetPortal: () => void

  selectArtifact: (id: ArtifactId) => void
  closeArtifact: () => void
  clearArtifactDiscovery: () => void

  setHoveredNode: (id: ConstellationNodeId | null) => void
  focusNode: (id: ConstellationNodeId | null) => void
  clearNodeDiscovery: () => void

  restartExperience: () => void
}

export const useAetherStore = create<AetherStore>()((set, get) => ({
  ...INITIAL_STATE,

  setBootProgress: (progress, loaded, total) =>
    set((state) => ({
      boot: {
        ...state.boot,
        phase: state.boot.phase === 'error' ? 'error' : 'loading',
        progress: clamp01(progress),
        loaded: loaded ?? state.boot.loaded,
        total: total ?? state.boot.total,
        error: null,
      },
    })),

  markBootReady: () =>
    set((state) => ({
      boot: { ...state.boot, phase: 'ready', progress: 1, error: null },
    })),

  markBootEntering: () =>
    set((state) => ({ boot: { ...state.boot, phase: 'entering' } })),

  setBootError: (message) =>
    set((state) => ({
      boot: { ...state.boot, phase: 'error', error: message },
    })),

  enterExperience: (enableAudio = false) =>
    set((state) => ({
      entered: true,
      activeAct: 'awakening',
      boot: { ...state.boot, phase: 'complete', progress: 1, error: null },
      audio: {
        ...state.audio,
        enabled: enableAudio,
        muted: enableAudio ? false : state.audio.muted,
      },
    })),

  setActiveAct: (activeAct) => set({ activeAct, chapterProgress: 0 }),
  setChapterProgress: (chapterProgress) => set({ chapterProgress: clamp01(chapterProgress) }),

  setAudioEnabled: (enabled) =>
    set((state) => ({
      audio: { ...state.audio, enabled, muted: enabled ? state.audio.muted : true },
    })),
  markAudioInitialized: () =>
    set((state) => ({ audio: { ...state.audio, initialized: true } })),
  setMuted: (muted) => set((state) => ({ audio: { ...state.audio, muted } })),
  toggleMuted: () =>
    set((state) => ({ audio: { ...state.audio, muted: !state.audio.muted } })),
  setVolume: (volume) =>
    set((state) => ({ audio: { ...state.audio, volume: clamp01(volume) } })),

  setQuality: (level, source = 'manual') => set({ quality: { level, source } }),
  setAutoQuality: (level) => set({ quality: { level, source: 'auto' } }),

  setLabOpen: (open) => set((state) => ({ lab: { ...state.lab, open } })),
  toggleLab: () => set((state) => ({ lab: { ...state.lab, open: !state.lab.open } })),
  setLabShader: (shader) => set((state) => ({ lab: { ...state.lab, shader } })),
  setLabMaterial: (material) => set((state) => ({ lab: { ...state.lab, material } })),
  setLabField: (field) => set((state) => ({ lab: { ...state.lab, field } })),
  setLabTheme: (theme) => set((state) => ({ lab: { ...state.lab, theme } })),
  setTimeScale: (timeScale) =>
    set((state) => ({ lab: { ...state.lab, timeScale: clamp(timeScale, 0.1, 2) } })),
  setParticleMultiplier: (particleMultiplier) =>
    set((state) => ({
      lab: { ...state.lab, particleMultiplier: clamp(particleMultiplier, 0.1, 2) },
    })),
  setPostProcessing: (postProcessing) =>
    set((state) => ({ lab: { ...state.lab, postProcessing } })),
  setPostFxIntensity: (postFxIntensity) =>
    set((state) => ({ lab: { ...state.lab, postFxIntensity: clamp(postFxIntensity, 0, 1.5) } })),
  setDebug: (debug) => set((state) => ({ lab: { ...state.lab, debug } })),
  setDebugMetrics: (fps, dpr) =>
    set((state) => ({
      lab: {
        ...state.lab,
        fps: Math.max(0, Math.round(fps)),
        dpr: Math.max(0.1, Number(dpr.toFixed(2))),
      },
    })),

  beginSignalCalibration: () =>
    set((state) => ({
      game: {
        ...state.game,
        status: 'calibrating',
        signalId: null,
        attempts: state.game.attempts + 1,
      },
    })),

  setSignalParameter: (parameter, value) =>
    set((state) => {
      const spec = SIGNAL_LAB.parameters[parameter]
      const parameters = {
        ...state.game.parameters,
        [parameter]: clamp(value, spec.min, spec.max),
      }
      const alignment = scoreSignal(parameters)

      return {
        game: {
          ...state.game,
          parameters,
          alignment,
          status: alignment >= SIGNAL_LAB.successThreshold ? 'aligned' : 'calibrating',
          signalId: null,
        },
      }
    }),

  lockSignal: () => {
    const { game } = get()
    if (game.alignment < SIGNAL_LAB.successThreshold) return null

    const signalId = createSignalId()
    set({ game: { ...game, status: 'locked', signalId } })
    return signalId
  },

  resetSignalGame: () =>
    set((state) => ({
      game: {
        status: 'idle',
        parameters: {
          frequency: SIGNAL_LAB.parameters.frequency.initial,
          coherence: SIGNAL_LAB.parameters.coherence.initial,
          entropy: SIGNAL_LAB.parameters.entropy.initial,
        },
        alignment: 0,
        signalId: null,
        attempts: state.game.attempts,
      },
    })),

  startPortalCharge: () =>
    set((state) => ({
      portal:
        state.portal.status === 'complete'
          ? state.portal
          : { ...state.portal, status: 'charging' },
    })),

  setPortalCharge: (charge) =>
    set((state) => {
      if (state.portal.status === 'complete' || state.portal.status === 'crossing') return state
      const nextCharge = clamp01(charge)
      return {
        portal: {
          ...state.portal,
          charge: nextCharge,
          status: nextCharge >= 1 ? 'charged' : nextCharge > 0 ? 'charging' : 'dormant',
        },
      }
    }),

  addPortalCharge: (delta) => get().setPortalCharge(get().portal.charge + delta),

  cancelPortalCharge: () =>
    set((state) => ({
      portal:
        state.portal.status === 'charging'
          ? { ...state.portal, status: 'dormant', charge: 0 }
          : state.portal,
    })),

  beginPortalCrossing: () =>
    set((state) => ({
      portal:
        state.portal.status === 'charged'
          ? { ...state.portal, status: 'crossing' }
          : state.portal,
    })),

  completePortalTraversal: () =>
    set((state) => ({
      portal: { ...state.portal, status: 'complete', charge: 1, traversed: true },
    })),

  resetPortal: () =>
    set({ portal: { status: 'dormant', charge: 0, traversed: false } }),

  selectArtifact: (selectedId) =>
    set((state) => ({
      artifact: {
        selectedId,
        discoveredIds: state.artifact.discoveredIds.includes(selectedId)
          ? state.artifact.discoveredIds
          : [...state.artifact.discoveredIds, selectedId],
      },
    })),
  closeArtifact: () =>
    set((state) => ({ artifact: { ...state.artifact, selectedId: null } })),
  clearArtifactDiscovery: () => set({ artifact: { selectedId: null, discoveredIds: [] } }),

  setHoveredNode: (hoveredId) =>
    set((state) => (
      state.node.hoveredId === hoveredId ? state : { node: { ...state.node, hoveredId } }
    )),
  focusNode: (focusedId) =>
    set((state) => ({
      node: {
        ...state.node,
        focusedId,
        discoveredIds:
          focusedId !== null && !state.node.discoveredIds.includes(focusedId)
            ? [...state.node.discoveredIds, focusedId]
            : state.node.discoveredIds,
      },
    })),
  clearNodeDiscovery: () =>
    set({ node: { hoveredId: null, focusedId: null, discoveredIds: [] } }),

  restartExperience: () =>
    set((state) => ({
      entered: true,
      activeAct: 'awakening',
      chapterProgress: 0,
      boot: { ...state.boot, phase: 'complete', progress: 1, error: null },
      game: { ...INITIAL_STATE.game },
      portal: { ...INITIAL_STATE.portal },
      artifact: { ...INITIAL_STATE.artifact, discoveredIds: [] },
      node: { ...INITIAL_STATE.node, discoveredIds: [] },
    })),
}))

export const aetherSelectors = {
  entered: (state: AetherStore): boolean => state.entered,
  activeAct: (state: AetherStore): MainActId => state.activeAct,
  bootProgress: (state: AetherStore): number => state.boot.progress,
  audio: (state: AetherStore) => state.audio,
  qualityLevel: (state: AetherStore): QualityLevel => state.quality.level,
  lab: (state: AetherStore) => state.lab,
  game: (state: AetherStore) => state.game,
  portal: (state: AetherStore) => state.portal,
  selectedArtifact: (state: AetherStore): ArtifactId | null => state.artifact.selectedId,
  focusedNode: (state: AetherStore): ConstellationNodeId | null => state.node.focusedId,
} as const

export const useExperienceStore = useAetherStore
