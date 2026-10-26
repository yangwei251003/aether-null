import { Select } from '@react-three/postprocessing'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { THEME_SCENE_COLORS } from '../config'
import { pointerSignal, prefersReducedMotion } from '../runtime/signals'
import { useAetherStore } from '../store'
import type { LabFieldMode, LabMaterialMode, LabShaderMode, QualityPreset } from '../types'
import { createSeededRandom, damp } from './sceneMath'
import { GLSL_NOISE } from './shaders'
import { useConditionalFrame } from './useActFrame'

type SpecimenLabSceneProps = {
  quality: QualityPreset
}

const SHADER_INDEX: Readonly<Record<LabShaderMode, number>> = {
  spectral: 0,
  interference: 1,
  'event-horizon': 2,
}

const MATERIAL_INDEX: Readonly<Record<LabMaterialMode, number>> = {
  chrome: 0,
  iridescent: 1,
  refractive: 2,
}

const FIELD_INDEX: Readonly<Record<LabFieldMode, number>> = {
  attract: 0,
  repel: 1,
  vortex: 2,
}

const MAX_SPECIMEN_FIELD_PARTICLES = 3_300

const SPECIMEN_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uShaderMode;
varying vec3 vNormalW;
varying vec3 vPositionW;
varying vec3 vObjectPosition;
varying float vField;

${GLSL_NOISE}

mat2 rotate2d(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec3 p = position;
  float spectral = sin(position.y * 8.0 + uTime * 1.35) * 0.5 + 0.5;
  spectral += (fbm(position * 2.6 + vec3(uTime * 0.17)) - 0.5) * 0.9;
  float interference = sin(position.x * 13.0 + uTime * 1.8) *
    cos(position.y * 11.0 - uTime * 1.25) *
    sin(position.z * 9.0 + uTime * 0.72);
  float horizon = smoothstep(0.25, 1.65, length(position.xy));
  float displacement = mix(spectral * 0.18, interference * 0.2, smoothstep(0.35, 0.9, uShaderMode));
  displacement = mix(displacement, (fbm(position * 4.0 - vec3(uTime * 0.22)) - 0.5) * 0.34, smoothstep(1.35, 1.9, uShaderMode));
  p += normal * displacement;

  float horizonMix = smoothstep(1.35, 1.95, uShaderMode);
  p.xz = rotate2d((p.y * 0.34 + sin(uTime * 0.55) * 0.08) * horizonMix) * p.xz;
  p *= 1.0 - horizonMix * horizon * 0.07;

  vec4 world = modelMatrix * vec4(p, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vPositionW = world.xyz;
  vObjectPosition = p;
  vField = mix(spectral, interference * 0.5 + 0.5, smoothstep(0.35, 0.9, uShaderMode));
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const SPECIMEN_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uShaderMode;
uniform float uMaterialMode;
uniform float uOpacity;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uPearl;
varying vec3 vNormalW;
varying vec3 vPositionW;
varying vec3 vObjectPosition;
varying float vField;

void main() {
  vec3 normalW = normalize(vNormalW);
  vec3 viewDirection = normalize(cameraPosition - vPositionW);
  float facing = max(0.0, dot(normalW, viewDirection));
  float fresnel = pow(1.0 - facing, 2.35);
  float spectralBand = sin(vObjectPosition.y * 16.0 + vObjectPosition.x * 7.0 - uTime * 1.15) * 0.5 + 0.5;
  float interference = sin((vObjectPosition.x + vObjectPosition.z) * 28.0 + uTime * 2.1) * 0.5 + 0.5;
  float horizon = 1.0 - smoothstep(0.08, 1.7, length(vObjectPosition.xy));

  float shaderBand = mix(spectralBand, interference, smoothstep(0.35, 0.9, uShaderMode));
  shaderBand = mix(shaderBand, horizon, smoothstep(1.35, 1.9, uShaderMode));
  vec3 iridescence = mix(uColorA, uColorB, fract(shaderBand + fresnel * 0.72 + vField * 0.16));

  vec3 chrome = mix(vec3(0.018, 0.025, 0.034), uPearl, facing * 0.76 + shaderBand * 0.1);
  chrome += iridescence * fresnel * 1.1;
  vec3 pearl = mix(uColorA * 0.18, iridescence, 0.62 + fresnel * 0.38);
  pearl += uPearl * pow(facing, 18.0) * 1.8;
  vec3 glass = mix(vec3(0.002, 0.008, 0.014), uColorA * 0.34, fresnel);
  glass += uColorB * pow(fresnel, 4.0) * 2.4 + uPearl * pow(facing, 28.0) * 2.2;
  glass += iridescence * smoothstep(0.82, 1.0, shaderBand) * 0.34;

  vec3 materialColor = mix(chrome, pearl, smoothstep(0.35, 0.9, uMaterialMode));
  materialColor = mix(materialColor, glass, smoothstep(1.35, 1.9, uMaterialMode));
  float eventHorizon = smoothstep(1.35, 1.9, uShaderMode);
  materialColor = mix(materialColor, materialColor * (0.18 + fresnel * 1.8) + uColorB * pow(fresnel, 7.0) * 2.8, eventHorizon);
  float alpha = mix(1.0, 0.72 + fresnel * 0.27, smoothstep(1.35, 1.9, uMaterialMode));
  gl_FragColor = vec4(materialColor, alpha * uOpacity);
}
`

const FIELD_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uFieldMode;
uniform float uParticleMultiplier;
uniform float uSize;
attribute float aPhase;
attribute float aScale;
varying float vEnergy;
varying float vAlpha;

mat2 rotate2d(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec3 p = position;
  float radius = max(0.08, length(p));
  float fieldPulse = sin(uTime * 1.2 + aPhase * 19.0) * 0.5 + 0.5;
  float attractMix = 1.0 - smoothstep(0.3, 0.8, uFieldMode);
  float repelMix = 1.0 - smoothstep(0.3, 0.7, abs(uFieldMode - 1.0));
  float vortexMix = smoothstep(1.35, 1.9, uFieldMode);
  p *= 1.0 - attractMix * (0.12 + fieldPulse * 0.1);
  p *= 1.0 + repelMix * (0.13 + fieldPulse * 0.16);
  p.xz = rotate2d(uTime * (0.06 + vortexMix * 0.56) + p.y * vortexMix * 0.22) * p.xz;
  p.xy += normalize(p.xy + vec2(0.001)) * sin(uTime * 1.7 + radius * 3.8 + aPhase * 8.0) * 0.08;
  p.z += sin(uTime * 0.9 + aPhase * 13.0) * 0.08;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * aScale * (0.82 + uParticleMultiplier * 0.22) / max(0.12, -mvPosition.z * 0.14);
  gl_Position = projectionMatrix * mvPosition;
  vEnergy = fract(aPhase + fieldPulse * 0.22 + vortexMix * radius * 0.1);
  vAlpha = 0.32 + fieldPulse * 0.62;
}
`

const FIELD_FRAGMENT = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uOpacity;
varying float vEnergy;
varying float vAlpha;

void main() {
  float radius = length(gl_PointCoord - 0.5);
  float spark = smoothstep(0.5, 0.03, radius);
  vec3 color = mix(uColorA, uColorB, smoothstep(0.28, 0.82, vEnergy));
  gl_FragColor = vec4(color * (0.75 + spark * 3.6), spark * vAlpha * uOpacity);
}
`

function SpecimenSurface({ quality, opacity }: SpecimenLabSceneProps & { opacity: MutableRefObject<number> }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const specimenRef = useRef<THREE.Mesh>(null)
  const cageRef = useRef<THREE.Group>(null)
  const ringMaterialRefs = useRef<THREE.MeshBasicMaterial[]>([])
  const shader = useAetherStore((state) => state.lab.shader)
  const material = useAetherStore((state) => state.lab.material)
  const theme = useAetherStore((state) => state.lab.theme)
  const timeScale = useAetherStore((state) => state.lab.timeScale)
  const colors = useMemo(() => THEME_SCENE_COLORS[theme].map((color) => new THREE.Color(color)), [theme])
  const segments = quality.level === 'ULTRA' ? [256, 48] : quality.level === 'BALANCED' ? [160, 32] : [88, 18]
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uShaderMode: { value: 0 },
    uMaterialMode: { value: 0 },
    uOpacity: { value: 0 },
    uColorA: { value: new THREE.Color('#35F2FF') },
    uColorB: { value: new THREE.Color('#FF3FBD') },
    uPearl: { value: new THREE.Color('#F3F6F8') },
  }), [])

  useConditionalFrame(
    () => opacity.current > 0.002,
    quality.updateEveryNthFrame,
    (_, delta) => {
    const shaderMaterial = materialRef.current
    const specimen = specimenRef.current
    if (!shaderMaterial || !specimen) return
    const scaledDelta = delta * timeScale
    shaderMaterial.uniforms.uTime.value += scaledDelta
    shaderMaterial.uniforms.uShaderMode.value = damp(shaderMaterial.uniforms.uShaderMode.value, SHADER_INDEX[shader], 5.2, delta)
    shaderMaterial.uniforms.uMaterialMode.value = damp(shaderMaterial.uniforms.uMaterialMode.value, MATERIAL_INDEX[material], 5.2, delta)
    shaderMaterial.uniforms.uOpacity.value = opacity.current
    shaderMaterial.uniforms.uColorA.value.lerp(colors[0], 1 - Math.exp(-delta * 6))
    shaderMaterial.uniforms.uColorB.value.lerp(colors[1], 1 - Math.exp(-delta * 6))
    shaderMaterial.uniforms.uPearl.value.lerp(colors[2], 1 - Math.exp(-delta * 6))
    specimen.rotation.x += scaledDelta * (shader === 'event-horizon' ? 0.12 : 0.055)
    specimen.rotation.y += scaledDelta * (shader === 'interference' ? 0.22 : 0.105)
    specimen.rotation.z = Math.sin(shaderMaterial.uniforms.uTime.value * 0.28) * 0.12
    if (cageRef.current) {
      cageRef.current.rotation.y -= scaledDelta * 0.035
      cageRef.current.rotation.z += scaledDelta * 0.012
    }
    for (let index = 0; index < ringMaterialRefs.current.length; index += 1) {
      const ringMaterial = ringMaterialRefs.current[index]
      if (ringMaterial) ringMaterial.opacity = (0.42 - index * 0.08) * opacity.current
    }
    },
  )

  return (
      <group ref={cageRef}>
        <mesh ref={specimenRef}>
          <torusKnotGeometry args={[1.16, 0.37, segments[0], segments[1], 3, 2]} />
          <shaderMaterial
            ref={materialRef}
            uniforms={uniforms}
            vertexShader={SPECIMEN_VERTEX}
            fragmentShader={SPECIMEN_FRAGMENT}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
        {[0, 1, 2].map((index) => (
          <mesh key={index} rotation={[Math.PI * (0.25 + index * 0.18), index * 0.72, index * 0.31]}>
            <torusGeometry args={[2.0 + index * 0.28, 0.012 + index * 0.004, 6, quality.level === 'LITE' ? 72 : 144]} />
            <meshBasicMaterial
              ref={(ringMaterial) => {
                if (ringMaterial) ringMaterialRefs.current[index] = ringMaterial
              }}
              color={THEME_SCENE_COLORS[theme][index === 1 ? 1 : 0]}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
  )
}

function SpecimenField({ quality, opacity }: SpecimenLabSceneProps & { opacity: MutableRefObject<number> }) {
  const pointsRef = useRef<THREE.Points>(null)
  const geometryRef = useRef<THREE.BufferGeometry>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const field = useAetherStore((state) => state.lab.field)
  const theme = useAetherStore((state) => state.lab.theme)
  const timeScale = useAetherStore((state) => state.lab.timeScale)
  const particleMultiplier = useAetherStore((state) => state.lab.particleMultiplier)
  const baseCount = quality.level === 'ULTRA' ? 2200 : quality.level === 'BALANCED' ? 1200 : 520
  const count = Math.min(MAX_SPECIMEN_FIELD_PARTICLES, Math.max(128, Math.round(baseCount * particleMultiplier)))
  const data = useMemo(() => {
    const random = createSeededRandom(0x5ec1ab)
    const positions = new Float32Array(MAX_SPECIMEN_FIELD_PARTICLES * 3)
    const phases = new Float32Array(MAX_SPECIMEN_FIELD_PARTICLES)
    const scales = new Float32Array(MAX_SPECIMEN_FIELD_PARTICLES)
    for (let index = 0; index < MAX_SPECIMEN_FIELD_PARTICLES; index += 1) {
      const angle = random() * Math.PI * 2
      const radius = 2.2 + Math.pow(random(), 0.72) * 4.2
      const elevation = (random() - 0.5) * 3.4
      positions[index * 3] = Math.cos(angle) * radius
      positions[index * 3 + 1] = elevation
      positions[index * 3 + 2] = Math.sin(angle) * radius * 0.56
      phases[index] = random()
      scales[index] = 0.35 + random() * 1.65
    }
    return { positions, phases, scales }
  }, [])
  useLayoutEffect(() => {
    geometryRef.current?.setDrawRange(0, count)
  }, [count])
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uFieldMode: { value: 0 },
    uParticleMultiplier: { value: 1 },
    uSize: { value: quality.level === 'LITE' ? 3.6 : 4.8 },
    uOpacity: { value: 0 },
    uColorA: { value: new THREE.Color('#35F2FF') },
    uColorB: { value: new THREE.Color('#FF3FBD') },
  }), [quality.level])
  const colors = useMemo(() => THEME_SCENE_COLORS[theme].map((color) => new THREE.Color(color)), [theme])

  useConditionalFrame(
    () => opacity.current > 0.002,
    quality.updateEveryNthFrame,
    (_, delta) => {
    const shaderMaterial = materialRef.current
    if (!shaderMaterial) return
    shaderMaterial.uniforms.uTime.value += delta * timeScale
    shaderMaterial.uniforms.uFieldMode.value = damp(shaderMaterial.uniforms.uFieldMode.value, FIELD_INDEX[field], 5.6, delta)
    shaderMaterial.uniforms.uParticleMultiplier.value = damp(shaderMaterial.uniforms.uParticleMultiplier.value, particleMultiplier, 4.5, delta)
    shaderMaterial.uniforms.uOpacity.value = opacity.current
    shaderMaterial.uniforms.uColorA.value.lerp(colors[0], 1 - Math.exp(-delta * 6))
    shaderMaterial.uniforms.uColorB.value.lerp(colors[1], 1 - Math.exp(-delta * 6))
    if (pointsRef.current) pointsRef.current.rotation.z += delta * timeScale * (field === 'vortex' ? 0.08 : 0.012)
    },
  )

  return (
    <Select enabled>
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry ref={geometryRef}>
          <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
          <bufferAttribute attach="attributes-aPhase" args={[data.phases, 1]} />
          <bufferAttribute attach="attributes-aScale" args={[data.scales, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={FIELD_VERTEX}
          fragmentShader={FIELD_FRAGMENT}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </Select>
  )
}

function DiagnosticCage({ opacity, quality }: { opacity: MutableRefObject<number>; quality: QualityPreset }) {
  const debug = useAetherStore((state) => state.lab.debug)
  const theme = useAetherStore((state) => state.lab.theme)
  const rootRef = useRef<THREE.Group>(null)
  const materialRefs = useRef<THREE.Material[]>([])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const materials: THREE.Material[] = []
    root.traverse((child) => {
      const renderable = child as THREE.Mesh
      if (!renderable.material) return
      const next = Array.isArray(renderable.material) ? renderable.material : [renderable.material]
      materials.push(...next)
    })
    materialRefs.current = materials
    return () => { materialRefs.current = [] }
  }, [])

  useConditionalFrame(
    () => opacity.current > 0.002 || debug,
    quality.updateEveryNthFrame,
    (_, delta) => {
    const root = rootRef.current
    if (!root) return
    const target = debug ? opacity.current : 0
    const current = Number(root.userData.opacity ?? 0)
    const next = damp(current, target, 7, delta)
    root.userData.opacity = next
    root.visible = next > 0.002
    for (const material of materialRefs.current) {
      material.opacity = next * 0.52
    }
    },
  )

  const cyan = THEME_SCENE_COLORS[theme][0]
  const magenta = THEME_SCENE_COLORS[theme][1]
  return (
    <group ref={rootRef} visible={false}>
      <gridHelper args={[10, 20, cyan, '#17212A']} rotation={[Math.PI * 0.5, 0, 0]} position={[0, 0, -1.35]} />
      <gridHelper args={[7, 14, magenta, '#151B22']} rotation={[0, 0, Math.PI * 0.5]} position={[-3.5, 0, 0]} />
      <mesh>
        <boxGeometry args={[4.8, 4.8, 4.8]} />
        <meshBasicMaterial color={cyan} wireframe transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh rotation={[Math.PI * 0.5, 0, 0]}>
        <torusGeometry args={[2.72, 0.018, 6, 144]} />
        <meshBasicMaterial color={magenta} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <axesHelper args={[3.4]} />
    </group>
  )
}

export function SpecimenLabScene({ quality }: SpecimenLabSceneProps) {
  const open = useAetherStore((state) => state.lab.open)
  const theme = useAetherStore((state) => state.lab.theme)
  const rootRef = useRef<THREE.Group>(null)
  const backdropRef = useRef<THREE.MeshBasicMaterial>(null)
  const lightARef = useRef<THREE.PointLight>(null)
  const lightBRef = useRef<THREE.PointLight>(null)
  const opacity = useRef(0)
  const viewport = useThree((state) => state.viewport)

  useFrame((_, delta) => {
    const root = rootRef.current
    if (!root) return
    if (!open && opacity.current <= 0.002) {
      opacity.current = 0
      root.visible = false
      return
    }
    const reducedMotion = prefersReducedMotion()
    opacity.current = reducedMotion
      ? (open ? 1 : 0)
      : damp(opacity.current, open ? 1 : 0, open ? 5.8 : 8.5, delta)
    root.visible = opacity.current > 0.002
    const targetScale = open ? 1 : 0.78
    root.scale.setScalar(reducedMotion ? targetScale : damp(root.scale.x, targetScale, open ? 4.5 : 8, delta))
    const pointerX = reducedMotion ? 0 : pointerSignal.normalizedX * 0.035
    const pointerY = reducedMotion ? 0 : -pointerSignal.normalizedY * 0.025
    root.rotation.y = damp(root.rotation.y, pointerX, 3.6, delta)
    root.rotation.x = damp(root.rotation.x, pointerY, 3.6, delta)
    root.position.x = viewport.width > 9 ? -1.22 : -0.18
    if (backdropRef.current) backdropRef.current.opacity = opacity.current * 0.88
    if (lightARef.current) lightARef.current.intensity = opacity.current * 16
    if (lightBRef.current) lightBRef.current.intensity = opacity.current * 10
  })

  const [colorA, colorB] = THEME_SCENE_COLORS[theme]
  return (
    <group ref={rootRef} visible={false}>
      <mesh position={[1.22, 0, -2.8]} scale={[22, 14, 1]} renderOrder={-20}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={backdropRef} color="#020306" transparent opacity={0} depthWrite={false} />
      </mesh>
      <SpecimenField quality={quality} opacity={opacity} />
      <SpecimenSurface quality={quality} opacity={opacity} />
      <DiagnosticCage opacity={opacity} quality={quality} />
      <pointLight ref={lightARef} position={[-2.8, 2.6, 3.2]} color={colorA} intensity={0} distance={12} decay={2} />
      <pointLight ref={lightBRef} position={[2.7, -1.8, 2.2]} color={colorB} intensity={0} distance={10} decay={2} />
    </group>
  )
}
