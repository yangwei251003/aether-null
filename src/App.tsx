import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { aetherAudio } from './audio/AetherAudio'
import { ArtifactModal } from './components/ArtifactModal'
import { BootSequence } from './components/BootSequence'
import { CustomCursor } from './components/CustomCursor'
import { SceneErrorBoundary } from './components/SceneErrorBoundary'
import { type LabSettings, SpecimenLab } from './components/SpecimenLab'
import { type HUDQuality, SystemHUD } from './components/SystemHUD'
import { WebGLFallback } from './components/WebGLFallback'
import { artifacts, MOBILE_FALLBACK, recommendQuality } from './config'
import { useAssetPreloader } from './hooks/useAssetPreloader'
import { useCinematicScroll } from './hooks/useCinematicScroll'
import { useWebGLSupport } from './hooks/useWebGLSupport'
import { NarrativeSections } from './sections/NarrativeSections'
import { navigationSignal } from './runtime/signals'
import { useAetherStore } from './store'
import type { ArtifactDatum, ConstellationNode, MainActId, QualityLevel } from './types'

const SceneCanvas = lazy(() => import('./scene/SceneCanvas'))

const actMap: Record<number, MainActId> = {
  1: 'awakening',
  2: 'descent',
  3: 'artifacts',
  4: 'signal-lab',
  5: 'memory-ocean',
  6: 'constellation',
  7: 'portal',
}

const qualityOrder: QualityLevel[] = ['ULTRA', 'BALANCED', 'LITE']

export function App() {
  const webgl = useWebGLSupport()
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [mobileQualityLocked, setMobileQualityLocked] = useState(
    () => window.innerWidth < MOBILE_FALLBACK.breakpoint || window.matchMedia('(pointer: coarse)').matches,
  )
  const [qualityInitialized, setQualityInitialized] = useState(false)
  const qualityBeforeReducedMotion = useRef<QualityLevel | null>(null)
  const [spatialFailed, setSpatialFailed] = useState(false)
  const preload = useAssetPreloader(webgl)
  const entered = useAetherStore((state) => state.entered)
  const activeAct = useAetherStore((state) => state.activeAct)
  const audio = useAetherStore((state) => state.audio)
  const quality = useAetherStore((state) => state.quality.level)
  const lab = useAetherStore((state) => state.lab)
  const selectedArtifactId = useAetherStore((state) => state.artifact.selectedId)
  const focusedNode = useAetherStore((state) => state.node.focusedId)
  const portalComplete = useAetherStore((state) => state.portal.status === 'complete')

  const setBootProgress = useAetherStore((state) => state.setBootProgress)
  const markBootReady = useAetherStore((state) => state.markBootReady)
  const setBootError = useAetherStore((state) => state.setBootError)
  const enterExperience = useAetherStore((state) => state.enterExperience)
  const setActiveAct = useAetherStore((state) => state.setActiveAct)
  const setAudioEnabled = useAetherStore((state) => state.setAudioEnabled)
  const markAudioInitialized = useAetherStore((state) => state.markAudioInitialized)
  const setMuted = useAetherStore((state) => state.setMuted)
  const setVolume = useAetherStore((state) => state.setVolume)
  const setQuality = useAetherStore((state) => state.setQuality)
  const setLabOpen = useAetherStore((state) => state.setLabOpen)
  const selectArtifact = useAetherStore((state) => state.selectArtifact)
  const closeArtifact = useAetherStore((state) => state.closeArtifact)
  const focusNode = useAetherStore((state) => state.focusNode)
  const completePortalTraversal = useAetherStore((state) => state.completePortalTraversal)
  const restartExperience = useAetherStore((state) => state.restartExperience)

  useEffect(() => {
    setBootProgress(preload.progress / 100, preload.progress, 100)
    if (preload.ready) markBootReady()
    if (preload.error) setBootError(preload.error)
  }, [markBootReady, preload.error, preload.progress, preload.ready, setBootError, setBootProgress])

  useEffect(() => {
    document.documentElement.dataset.quality = quality.toLowerCase()
    document.documentElement.dataset.theme = lab.theme
    document.documentElement.dataset.appReady = entered ? 'true' : 'false'
    document.documentElement.dataset.postFx = lab.postProcessing ? 'on' : 'off'
    document.documentElement.style.setProperty('--post-fx-intensity', String(lab.postFxIntensity))
    document.documentElement.style.setProperty('--time-scale', String(lab.timeScale))
  }, [entered, lab.postFxIntensity, lab.postProcessing, lab.theme, lab.timeScale, quality])

  useEffect(() => () => aetherAudio.dispose(), [])

  useEffect(() => {
    aetherAudio.setVolume(audio.volume)
  }, [audio.volume])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    media.addEventListener('change', update)
    update()
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const pointer = window.matchMedia('(pointer: coarse)')
    const update = () => setMobileQualityLocked(
      window.innerWidth < MOBILE_FALLBACK.breakpoint || pointer.matches,
    )
    pointer.addEventListener('change', update)
    window.addEventListener('resize', update, { passive: true })
    update()
    return () => {
      pointer.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const qualityLocked = reducedMotion || mobileQualityLocked

  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number }
    const recommended = recommendQuality({
      webgl2: webgl,
      width: window.innerWidth,
      devicePixelRatio: window.devicePixelRatio,
      deviceMemory: nav.deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      reducedMotion,
    })
    const state = useAetherStore.getState()
    if (qualityLocked) {
      if (state.quality.source === 'manual') qualityBeforeReducedMotion.current = state.quality.level
      state.setAutoQuality('LITE')
    } else if (qualityBeforeReducedMotion.current) {
      state.setQuality(qualityBeforeReducedMotion.current, 'manual')
      qualityBeforeReducedMotion.current = null
    } else if (!qualityInitialized || state.quality.source === 'auto') {
      state.setAutoQuality(recommended)
    }
    setQualityInitialized(true)
  }, [qualityInitialized, qualityLocked, reducedMotion, webgl])

  const onActChange = useCallback((act: number) => {
    const next = actMap[act]
    if (next) {
      setActiveAct(next)
      aetherAudio.setScene(next)
    }
  }, [setActiveAct])
  useCinematicScroll(entered, onActChange, reducedMotion)

  const selectedArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? null,
    [selectedArtifactId],
  )
  const activeActNumber = Object.entries(actMap).find(([, id]) => id === activeAct)?.[0]
  const hudQuality = quality.toLowerCase() as HUDQuality

  const handleEnter = (audioGranted: boolean) => {
    enterExperience(audioGranted)
    markAudioInitialized()
    setAudioEnabled(audioGranted)
    setMuted(!audioGranted)
  }

  const toggleAudio = async () => {
    if (!audio.initialized || !aetherAudio.isEnabled()) {
      const enabled = await aetherAudio.unlock()
      markAudioInitialized()
      setAudioEnabled(enabled)
      setMuted(!enabled)
      return
    }
    const enabled = aetherAudio.toggle()
    setAudioEnabled(enabled)
    setMuted(!enabled)
  }

  const cycleQuality = () => {
    if (qualityLocked) return
    const index = qualityOrder.indexOf(quality)
    const snapshot = useAetherStore.getState()
    if (snapshot.quality.source === 'auto' && !snapshot.lab.postProcessing) snapshot.setPostProcessing(true)
    setQuality(qualityOrder[(index + 1) % qualityOrder.length])
  }

  const updateLab = (patch: Partial<LabSettings>) => {
    const state = useAetherStore.getState()
    if (patch.shader) state.setLabShader(patch.shader)
    if (patch.material) state.setLabMaterial(patch.material)
    if (patch.field) state.setLabField(patch.field)
    if (patch.theme) state.setLabTheme(patch.theme)
    if (patch.timeScale !== undefined) state.setTimeScale(patch.timeScale)
    if (patch.particleMultiplier !== undefined) state.setParticleMultiplier(patch.particleMultiplier)
    if (patch.postProcessing !== undefined) state.setPostProcessing(patch.postProcessing)
    if (patch.postFxIntensity !== undefined) state.setPostFxIntensity(patch.postFxIntensity)
    if (patch.debug !== undefined) state.setDebug(patch.debug)
  }

  const inspectArtifact = useCallback((artifact: ArtifactDatum) => {
    selectArtifact(artifact.id)
    aetherAudio.cue('artifact-open')
  }, [selectArtifact])

  const handleFocusNode = useCallback((node: ConstellationNode) => {
    focusNode(node.id)
    aetherAudio.cue('node-focus')
  }, [focusNode])

  const handleSignalLock = useCallback((signalId: string) => {
    useAetherStore.setState((state) => ({
      game: { ...state.game, status: 'locked', alignment: 1, signalId },
    }))
  }, [])

  const handlePortalComplete = useCallback(() => completePortalTraversal(), [completePortalTraversal])

  const restart = () => {
    restartExperience()
    const awakening = document.getElementById('awakening')
    if (!awakening) return
    if (navigationSignal.scrollTo) navigationSignal.scrollTo(awakening)
    else awakening.scrollIntoView({ behavior: 'auto', block: 'start' })
  }

  const viewSystem = () => {
    useAetherStore.getState().setDebug(true)
    setLabOpen(true)
  }
  const enterSpatialFallback = useCallback(() => setSpatialFailed(true), [])

  return (
    <div className={`app-shell ${portalComplete ? 'portal-traversed' : ''}`} data-active-act={activeAct}>
      {entered ? <a className="skip-link" href="#main-content">Skip to archive narrative</a> : null}
      {!entered ? <BootSequence progress={preload.progress} ready={preload.ready} error={preload.error} onEnter={handleEnter} /> : null}
      <div className="scene-layer" aria-hidden="true">
        {webgl && qualityInitialized && !spatialFailed ? (
          <SceneErrorBoundary fallback={<WebGLFallback act={activeAct} />} onError={enterSpatialFallback}>
            <Suspense fallback={<WebGLFallback act={activeAct} />}><SceneCanvas qualityLevel={quality} interactive={entered} onContextLost={enterSpatialFallback} /></Suspense>
          </SceneErrorBoundary>
        ) : <WebGLFallback act={activeAct} />}
      </div>
      {entered ? (
        <>
          <SystemHUD
            activeAct={Number(activeActNumber ?? 1)}
            audioEnabled={audio.enabled && !audio.muted}
            audioVolume={audio.volume}
            quality={hudQuality}
            qualityLocked={qualityLocked}
            qualityLockReason={reducedMotion ? 'reduced motion preference' : 'mobile performance policy'}
            onToggleAudio={toggleAudio}
            onAudioVolumeChange={setVolume}
            onCycleQuality={cycleQuality}
            onOpenLab={() => setLabOpen(true)}
          />
          <main id="main-content" className="content-layer" tabIndex={-1}>
            <NarrativeSections
              focusedNode={focusedNode}
              onInspectArtifact={inspectArtifact}
              onFocusNode={handleFocusNode}
              onSignalLock={handleSignalLock}
              onPortalComplete={handlePortalComplete}
              onRestart={restart}
              onEnterLab={() => setLabOpen(true)}
              onViewSystem={viewSystem}
            />
          </main>
          <ArtifactModal artifact={selectedArtifact} onClose={closeArtifact} />
          <SpecimenLab
            open={lab.open}
            settings={lab}
            quality={hudQuality}
            qualityLocked={qualityLocked}
            onClose={() => setLabOpen(false)}
            onChange={updateLab}
            onQuality={(next) => {
              if (!qualityLocked) setQuality(next.toUpperCase() as QualityLevel)
            }}
          />
          <CustomCursor quality={quality} reducedMotion={reducedMotion} />
        </>
      ) : null}
    </div>
  )
}
