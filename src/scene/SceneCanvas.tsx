import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Bloom,
  ChromaticAberration,
  DepthOfField,
  EffectComposer,
  Noise,
  Selection,
  SelectiveBloom,
  SMAA,
  Vignette,
} from '@react-three/postprocessing'
import { BlendFunction, DepthOfFieldEffect } from 'postprocessing'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { CHAPTER_THEMES, FEATURE_FLAGS, getQualityProfile } from '../config'
import { renderSignal, scrollSignal } from '../runtime/signals'
import { useAetherStore } from '../store'
import type { QualityLevel, QualityPreset } from '../types'
import { ArtifactsScene } from './ArtifactsScene'
import { CameraRig } from './CameraRig'
import { ConstellationScene } from './ConstellationScene'
import { CoreScene } from './CoreScene'
import { OceanScene } from './OceanScene'
import { PortalScene } from './PortalScene'
import { SignalFieldScene } from './SignalFieldScene'
import { SpecimenLabScene } from './SpecimenLabScene'
import { TunnelScene } from './TunnelScene'
import { ACT_IDS, damp } from './sceneMath'

export type SceneCanvasProps = {
  className?: string
  interactive?: boolean
  onContextLost?: () => void
  qualityLevel: QualityLevel
}

type DevicePreferences = {
  reducedMotion: boolean
  coarsePointer: boolean
  pageHidden: boolean
}

const BACKGROUNDS = ACT_IDS.map((id) => new THREE.Color(CHAPTER_THEMES[id].background))
const FOG_COLORS = ACT_IDS.map((id) => new THREE.Color(CHAPTER_THEMES[id].fog))
const FOG_DENSITY = [0.028, 0.024, 0.018, 0.022, 0.025, 0.017, 0.016, 0.021] as const

function useDevicePreferences(): DevicePreferences {
  const [preferences, setPreferences] = useState<DevicePreferences>(() => ({
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    pageHidden: document.hidden,
  }))

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pointer = window.matchMedia('(pointer: coarse)')
    const update = () => {
      setPreferences({
        reducedMotion: motion.matches,
        coarsePointer: pointer.matches,
        pageHidden: document.hidden,
      })
    }
    motion.addEventListener('change', update)
    pointer.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    update()
    return () => {
      motion.removeEventListener('change', update)
      pointer.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  return preferences
}

function EnvironmentDirector({ reducedMotion }: { reducedMotion: boolean }) {
  const scene = useThree((state) => state.scene)
  const background = useMemo(() => BACKGROUNDS[0].clone(), [])
  const fog = useMemo(() => new THREE.FogExp2(FOG_COLORS[0], FOG_DENSITY[0]), [])

  useEffect(() => {
    const previousBackground = scene.background
    const previousFog = scene.fog
    scene.background = background
    scene.fog = fog
    return () => {
      scene.background = previousBackground
      scene.fog = previousFog
    }
  }, [background, fog, scene])

  useFrame((_, delta) => {
    const index = Math.min(ACT_IDS.length - 1, Math.max(0, scrollSignal.act))
    if (reducedMotion) {
      background.copy(BACKGROUNDS[index])
      fog.color.copy(FOG_COLORS[index])
      fog.density = FOG_DENSITY[index]
      return
    }
    const alpha = 1 - Math.exp(-delta * 2.7)
    background.lerp(BACKGROUNDS[index], alpha)
    fog.color.lerp(FOG_COLORS[index], alpha)
    fog.density = damp(fog.density, FOG_DENSITY[index], 2.7, delta)
  }, -20)

  return null
}

function RendererBridge({ active, pageHidden, reducedMotion, targetFps }: {
  active: boolean
  pageHidden: boolean
  reducedMotion: boolean
  targetFps: number
}) {
  const invalidate = useThree((state) => state.invalidate)
  const frameloop = useThree((state) => state.frameloop)
  const gl = useThree((state) => state.gl)
  const metrics = useRef({ sampledAt: 0 })

  useEffect(() => {
    gl.domElement.dataset.frameloop = frameloop
  }, [frameloop, gl])

  useFrame(({ camera }) => {
    const now = performance.now()
    if (now - metrics.current.sampledAt < 500) return
    metrics.current.sampledAt = now
    const canvas = gl.domElement
    canvas.dataset.renderFrame = String(gl.info.render.frame)
    canvas.dataset.renderCalls = String(gl.info.render.calls)
    canvas.dataset.renderTriangles = String(gl.info.render.triangles)
    canvas.dataset.renderGeometries = String(gl.info.memory.geometries)
    canvas.dataset.renderTextures = String(gl.info.memory.textures)
    canvas.dataset.cameraZ = camera.position.z.toFixed(3)
    canvas.dataset.cameraFov = (camera as THREE.PerspectiveCamera).fov.toFixed(2)
  }, -5)

  useEffect(() => {
    renderSignal.invalidate = invalidate
    let budgetTimer = 0
    const budgeted = targetFps <= 30
    const stopBudgetLoop = () => {
      window.clearTimeout(budgetTimer)
      budgetTimer = 0
    }
    const startBudgetLoop = () => {
      stopBudgetLoop()
      if (!active || !budgeted || reducedMotion || pageHidden) return
      const interval = 1_000 / Math.max(1, targetFps)
      let nextFrame = performance.now() + interval
      const pulse = () => {
        if (pageHidden || reducedMotion) return
        invalidate()
        nextFrame += interval
        budgetTimer = window.setTimeout(pulse, Math.max(4, nextFrame - performance.now()))
      }
      budgetTimer = window.setTimeout(pulse, interval)
    }
    renderSignal.hidden = pageHidden
    startBudgetLoop()
    if (active && !pageHidden) invalidate()
    return () => {
      stopBudgetLoop()
      if (renderSignal.invalidate === invalidate) renderSignal.invalidate = null
    }
  }, [active, invalidate, pageHidden, reducedMotion, targetFps])

  return null
}

function InteractionBridge({ enabled }: { enabled: boolean }) {
  const setEvents = useThree((state) => state.setEvents)

  useEffect(() => {
    setEvents({ enabled })
    return () => setEvents({ enabled: true })
  }, [enabled, setEvents])

  return null
}

function ContextLossBridge({ onContextLost }: { onContextLost?: () => void }) {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const canvas = gl.domElement
    let pendingLoss = 0
    const handleContextLost = (event: Event) => {
      event.preventDefault()
      pendingLoss = window.setTimeout(() => {
        // Ignore losses emitted after an intentional React teardown. A loss on
        // the still-connected live canvas is genuine and activates the 2D fallback.
        if (canvas.isConnected) onContextLost?.()
      }, 0)
    }
    canvas.addEventListener('webglcontextlost', handleContextLost)
    return () => {
      window.clearTimeout(pendingLoss)
      canvas.removeEventListener('webglcontextlost', handleContextLost)
    }
  }, [gl, onContextLost])

  return null
}

function AdaptiveQualityDirector({ reducedMotion }: { reducedMotion: boolean }) {
  const windowRef = useRef({ startedAt: 0, warmUntil: performance.now() + 5_000, frames: 0 })

  useFrame(({ gl }) => {
    const now = performance.now()
    const sample = windowRef.current
    const snapshot = useAetherStore.getState()
    if (!snapshot.entered) {
      sample.startedAt = 0
      sample.frames = 0
      sample.warmUntil = now + 5_000
      return
    }
    if (document.hidden || reducedMotion || snapshot.lab.open) {
      sample.startedAt = 0
      sample.frames = 0
      sample.warmUntil = now + 2_000
      return
    }
    if (now < sample.warmUntil) return
    if (sample.startedAt === 0) sample.startedAt = now
    sample.frames += 1
    const elapsed = now - sample.startedAt
    if (elapsed < 6_000) return

    const fps = (sample.frames * 1_000) / Math.max(1, elapsed)
    snapshot.setDebugMetrics(fps, gl.getPixelRatio())
    if (snapshot.quality.source === 'auto') {
      const targetFps = getQualityProfile(snapshot.quality.level).targetFps
      if (snapshot.quality.level === 'ULTRA' && fps < targetFps * 0.8) snapshot.setAutoQuality('BALANCED')
      else if (snapshot.quality.level === 'BALANCED' && fps < targetFps * 0.6) snapshot.setAutoQuality('LITE')
      else if (snapshot.quality.level === 'LITE' && fps < targetFps * 0.67 && snapshot.lab.postProcessing) snapshot.setPostProcessing(false)
    }
    sample.startedAt = now
    sample.frames = 0
  }, -30)

  return null
}

function ExposureDirector({ reducedMotion }: { reducedMotion: boolean }) {
  const gl = useThree((state) => state.gl)
  const portalStatus = useAetherStore((state) => state.portal.status)
  useFrame((_, delta) => {
    const act = scrollSignal.act
    const portalBoost = act === 7 && (portalStatus === 'crossing' || portalStatus === 'complete') ? 0.42 : 0
    const target = 0.88 + (act === 1 ? 0.08 : act === 5 ? -0.08 : 0) + portalBoost
    gl.toneMappingExposure = reducedMotion ? target : damp(gl.toneMappingExposure, target, 3.4, delta)
  }, -15)
  return null
}

function CinematicDepthOfField({ quality, intensity }: { quality: QualityPreset; intensity: number }) {
  const effect = useRef<DepthOfFieldEffect>(null)
  const labOpen = useAetherStore((state) => state.lab.open)
  useFrame((state, delta) => {
    if (!effect.current) return
    const critical = scrollSignal.act === 3 || scrollSignal.act === 7
    const targetBokeh = labOpen ? 0 : critical ? quality.post.dofBokehScale * intensity : 0.08 * intensity
    effect.current.bokehScale = damp(effect.current.bokehScale, targetBokeh, 3.6, delta)
    const focusDistance = Number(state.scene.userData.aetherFocusDistance ?? 7)
    effect.current.cocMaterial.focusDistance = damp(
      effect.current.cocMaterial.focusDistance,
      focusDistance,
      3.2,
      delta,
    )
  })
  return (
    <DepthOfField
      ref={effect}
      focusDistance={7}
      focusRange={2.8}
      bokehScale={0.08}
      resolutionScale={0.5}
    />
  )
}

function PostStack({ quality, enabled, intensity, bloomLight }: {
  quality: QualityPreset
  enabled: boolean
  intensity: number
  bloomLight: RefObject<THREE.AmbientLight | null>
}) {
  const chromaticOffset = useMemo(
    () => new THREE.Vector2(quality.post.chromaticAberration * intensity, quality.post.chromaticAberration * intensity * 0.62),
    [intensity, quality.post.chromaticAberration],
  )
  if (!enabled || !quality.post.enabled || intensity <= 0.01) return null

  return (
    <EffectComposer
      multisampling={quality.post.multisampling}
      depthBuffer
      stencilBuffer={false}
      resolutionScale={quality.level === 'LITE' ? 0.72 : 1}
    >
      {quality.level === 'LITE' ? (
        <Bloom
          intensity={quality.post.bloomIntensity * intensity}
          luminanceThreshold={0.82}
          luminanceSmoothing={0.28}
          mipmapBlur
          levels={quality.post.bloomLevels}
        />
      ) : (
        <SelectiveBloom
          lights={[bloomLight]}
          intensity={quality.post.bloomIntensity * intensity}
          luminanceThreshold={0.48}
          luminanceSmoothing={0.34}
          mipmapBlur
          levels={quality.post.bloomLevels}
          ignoreBackground
        />
      )}
      {quality.post.depthOfField && quality.level === 'ULTRA' ? (
        <CinematicDepthOfField quality={quality} intensity={intensity} />
      ) : null}
      {quality.post.chromaticAberration > 0 ? (
        <ChromaticAberration offset={chromaticOffset} />
      ) : null}
      {quality.level !== 'LITE' ? <SMAA /> : null}
      <Noise
        premultiply
        opacity={quality.post.noise * intensity}
        blendFunction={BlendFunction.SOFT_LIGHT}
      />
      <Vignette
        eskil={false}
        offset={0.22}
        darkness={quality.post.vignette * intensity}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  )
}

function SceneWorld({ quality, preferences, postEnabled, postIntensity, interactive, onContextLost }: {
  quality: QualityPreset
  preferences: DevicePreferences
  postEnabled: boolean
  postIntensity: number
  interactive: boolean
  onContextLost?: () => void
}) {
  const bloomLight = useRef<THREE.AmbientLight>(null)
  const labOpen = useAetherStore((state) => state.lab.open)
  const entered = useAetherStore((state) => state.entered)
  return (
    <Selection enabled>
      <EnvironmentDirector reducedMotion={preferences.reducedMotion} />
      <RendererBridge active={entered} pageHidden={preferences.pageHidden} reducedMotion={preferences.reducedMotion} targetFps={quality.targetFps} />
      {FEATURE_FLAGS.adaptiveQuality ? <AdaptiveQualityDirector reducedMotion={preferences.reducedMotion} /> : null}
      <InteractionBridge enabled={interactive} />
      <ContextLossBridge onContextLost={onContextLost} />
      <ExposureDirector reducedMotion={preferences.reducedMotion} />
      <CameraRig
        reducedMotion={preferences.reducedMotion}
        coarsePointer={preferences.coarsePointer}
      />
      <ambientLight ref={bloomLight} intensity={0.12} color="#C9E7EC" />
      <group visible={!labOpen}>
        <CoreScene quality={quality} />
        <TunnelScene quality={quality} />
        <ArtifactsScene quality={quality} />
        <SignalFieldScene quality={quality} />
        <OceanScene quality={quality} />
        <ConstellationScene quality={quality} />
        <PortalScene quality={quality} />
      </group>
      {labOpen ? <SpecimenLabScene quality={quality} /> : null}
      <PostStack quality={quality} enabled={postEnabled} intensity={postIntensity} bloomLight={bloomLight} />
    </Selection>
  )
}

export function SceneCanvas({ className, interactive = true, onContextLost, qualityLevel }: SceneCanvasProps) {
  const postEnabled = useAetherStore((state) => state.lab.postProcessing)
  const postIntensity = useAetherStore((state) => state.lab.postFxIntensity)
  const quality = getQualityProfile(qualityLevel)
  const preferences = useDevicePreferences()
  const entered = useAetherStore((state) => state.entered)
  const activeAct = useAetherStore((state) => state.activeAct)
  const overlayOpen = useAetherStore((state) => state.lab.open || Boolean(state.artifact.selectedId))
  const sceneInteractionEnabled = interactive && !overlayOpen && !preferences.coarsePointer && (activeAct === 'artifacts' || activeAct === 'constellation')
  const canvasClassName = className ? 'scene-canvas ' + className : 'scene-canvas'
  const frameloop = !entered || preferences.pageHidden || preferences.reducedMotion || quality.targetFps <= 30
    ? 'demand'
    : 'always'

  return (
    <Canvas
      className={canvasClassName}
      aria-hidden="true"
      camera={{ position: [0, 0, 8.6], fov: 38, near: 0.05, far: 240 }}
      dpr={quality.dpr as [number, number]}
      frameloop={frameloop}
      eventSource={document.body}
      eventPrefix="client"
      shadows={quality.shadows ? 'soft' : false}
      performance={{ min: 0.45, max: 1, debounce: 320 }}
      gl={{
        alpha: true,
        antialias: quality.antialias,
        powerPreference: quality.powerPreference,
        stencil: false,
        depth: true,
      }}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
      onCreated={({ gl }) => {
        const context = gl.getContext()
        if (typeof WebGL2RenderingContext !== 'undefined' && !(context instanceof WebGL2RenderingContext)) {
          throw new Error('AETHER//NULL requires a WebGL2 rendering context.')
        }
        gl.outputColorSpace = THREE.SRGBColorSpace
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 0.88
        gl.setClearColor('#030407', 1)
      }}
    >
      <SceneWorld quality={quality} preferences={preferences} postEnabled={postEnabled} postIntensity={postIntensity} interactive={sceneInteractionEnabled} onContextLost={onContextLost} />
    </Canvas>
  )
}

export default SceneCanvas
