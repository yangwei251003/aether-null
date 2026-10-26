import { Select } from '@react-three/postprocessing'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { THEME_SCENE_COLORS } from '../config'
import type { QualityPreset, ThemeVariant } from '../types'
import { pointerSignal, scrollSignal } from '../runtime/signals'
import { useAetherStore } from '../store'
import { ActLayer } from './ActLayer'
import { createSeededRandom, damp } from './sceneMath'
import {
  CORE_FRAGMENT,
  CORE_VERTEX,
  PARTICLE_FRAGMENT,
  PARTICLE_VERTEX,
} from './shaders'
import { useActFrame } from './useActFrame'

type CoreSceneProps = {
  quality: QualityPreset
}

const CORE_ACTS = [0, 1] as const

const RING_ROTATIONS: readonly [number, number, number][] = [
  [Math.PI * 0.5, 0.1, 0],
  [Math.PI * 0.35, Math.PI * 0.18, 0.35],
  [Math.PI * 0.68, -Math.PI * 0.24, -0.18],
  [Math.PI * 0.5, Math.PI * 0.5, 0.6],
  [Math.PI * 0.22, -Math.PI * 0.36, 0.08],
]

function CoreParticles({ count, updateEveryNthFrame }: { count: number; updateEveryNthFrame: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const pointsRef = useRef<THREE.Points>(null)
  const data = useMemo(() => {
    const random = createSeededRandom(0xa37e4)
    const positions = new Float32Array(count * 3)
    const scales = new Float32Array(count)
    const phases = new Float32Array(count)
    for (let index = 0; index < count; index += 1) {
      const radius = 2.2 + Math.pow(random(), 1.8) * 6.2
      const angle = random() * Math.PI * 2
      const elevation = (random() - 0.5) * Math.PI
      const cosine = Math.cos(elevation)
      positions[index * 3] = Math.cos(angle) * cosine * radius
      positions[index * 3 + 1] = Math.sin(elevation) * radius * 0.62
      positions[index * 3 + 2] = Math.sin(angle) * cosine * radius
      scales[index] = 0.45 + random() * 1.55
      phases[index] = random()
    }
    return { positions, scales, phases }
  }, [count])
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: count > 4_000 ? 22 : count > 1_500 ? 18 : 15 },
      uMotion: { value: 0.045 },
      uOpacity: { value: count > 4_000 ? 0.74 : count > 1_500 ? 0.68 : 0.62 },
      uColorA: { value: new THREE.Color('#35F2FF') },
      uColorB: { value: new THREE.Color('#FF3FBD') },
    }),
    [count],
  )
  useActFrame(CORE_ACTS, updateEveryNthFrame, (_, delta) => {
    if (!materialRef.current || !pointsRef.current) return
    materialRef.current.uniforms.uTime.value += delta
    pointsRef.current.rotation.y += delta * 0.018
    pointsRef.current.rotation.x = Math.sin(materialRef.current.uniforms.uTime.value * 0.08) * 0.035
  })

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[data.scales, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[data.phases, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={PARTICLE_VERTEX}
        fragmentShader={PARTICLE_FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

function CoreSurface({ quality }: CoreSceneProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const innerRef = useRef<THREE.Mesh>(null)
  const labMaterial = useAetherStore((state) => state.lab.material)
  const labShader = useAetherStore((state) => state.lab.shader)
  const labTimeScale = useAetherStore((state) => state.lab.timeScale)
  const labTheme = useAetherStore((state) => state.lab.theme)
  const gameAlignment = useAetherStore((state) => state.game.alignment)
  const pointer = useRef({ x: 0, y: 0 })
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDistortion: { value: 0.24 },
      uPulse: { value: 0 },
      uOpacity: { value: 1 },
      uCyan: { value: new THREE.Color('#35F2FF') },
      uMagenta: { value: new THREE.Color('#FF3FBD') },
      uChrome: { value: new THREE.Color('#AAB5C2') },
    }),
    [],
  )
  const themeColors = useMemo(
    () => Object.fromEntries(Object.entries(THEME_SCENE_COLORS).map(([id, colors]) => [
      id,
      [new THREE.Color(colors[0]), new THREE.Color(colors[1])] as const,
    ])) as Readonly<Record<ThemeVariant, readonly [THREE.Color, THREE.Color]>>,
    [],
  )
  const detail = quality.level === 'ULTRA' ? 6 : quality.level === 'BALANCED' ? 5 : 4

  useActFrame(CORE_ACTS, quality.updateEveryNthFrame, (_, delta) => {
    const material = materialRef.current
    const mesh = meshRef.current
    if (!material || !mesh) return
    const speed = labTimeScale * (scrollSignal.act === 0 ? 0.52 : 1)
    material.uniforms.uTime.value += delta * speed
    const materialBoost = labMaterial === 'iridescent' ? 0.12 : labMaterial === 'refractive' ? -0.06 : 0
    const shaderBoost = labShader === 'event-horizon' ? 0.22 : labShader === 'interference' ? 0.1 : 0
    material.uniforms.uDistortion.value = damp(
      material.uniforms.uDistortion.value,
      0.22 + materialBoost + shaderBoost + Math.min(0.18, Math.abs(scrollSignal.velocity) * 0.008),
      3.4,
      delta,
    )
    material.uniforms.uPulse.value = damp(
      material.uniforms.uPulse.value,
      gameAlignment + (pointerSignal.down ? 0.35 : 0),
      5,
      delta,
    )
    pointer.current.x = damp(pointer.current.x, pointerSignal.normalizedX, 2.8, delta)
    pointer.current.y = damp(pointer.current.y, pointerSignal.normalizedY, 2.8, delta)
    mesh.rotation.x = material.uniforms.uTime.value * 0.045 + pointer.current.y * 0.075
    mesh.rotation.y = material.uniforms.uTime.value * 0.07 + pointer.current.x * 0.11
    const bootScale = scrollSignal.act === 0 ? 0.78 : 1
    mesh.scale.setScalar(damp(mesh.scale.x, bootScale, 2.2, delta))
    if (innerRef.current) {
      innerRef.current.rotation.x -= delta * 0.16
      innerRef.current.rotation.y += delta * 0.23
      innerRef.current.scale.setScalar(0.86 + Math.sin(material.uniforms.uTime.value * 1.4) * 0.06)
    }

    const targets = themeColors[labTheme]
    uniforms.uCyan.value.lerp(targets[0], 0.045)
    uniforms.uMagenta.value.lerp(targets[1], 0.045)
  })

  return (
    <Select enabled>
      <group>
        <mesh ref={meshRef}>
          <icosahedronGeometry args={[1.48, detail]} />
          <shaderMaterial
            ref={materialRef}
            uniforms={uniforms}
            vertexShader={CORE_VERTEX}
            fragmentShader={CORE_FRAGMENT}
            transparent
            depthWrite
            toneMapped={false}
          />
        </mesh>
        <mesh ref={innerRef} scale={0.73}>
          <icosahedronGeometry args={[1.2, 2]} />
          <meshBasicMaterial color="#35F2FF" wireframe transparent opacity={0.16} toneMapped={false} />
        </mesh>
        <pointLight color="#35F2FF" intensity={11} distance={8} decay={2.1} />
      </group>
    </Select>
  )
}

function OrbitAssembly({ quality }: CoreSceneProps) {
  const groupRef = useRef<THREE.Group>(null)
  const ringRefs = useRef<THREE.Mesh[]>([])
  const fragmentRef = useRef<THREE.InstancedMesh>(null)
  const fragmentCount = quality.level === 'ULTRA' ? 132 : quality.level === 'BALANCED' ? 84 : 42
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    const mesh = fragmentRef.current
    if (!mesh) return
    const random = createSeededRandom(0x0f7b17)
    for (let index = 0; index < fragmentCount; index += 1) {
      const angle = random() * Math.PI * 2
      const radius = 2.15 + random() * 2.7
      dummy.position.set(
        Math.cos(angle) * radius,
        (random() - 0.5) * 2.9,
        Math.sin(angle) * radius * 0.58,
      )
      dummy.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI)
      const size = 0.035 + random() * 0.14
      dummy.scale.set(size * (0.35 + random()), size, size * 0.16)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
      mesh.setColorAt(index, new THREE.Color(index % 9 === 0 ? '#FF3FBD' : '#AAB5C2'))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [dummy, fragmentCount])

  useActFrame(CORE_ACTS, quality.updateEveryNthFrame, (_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.028
      groupRef.current.rotation.z += delta * 0.009
    }
    for (let index = 0; index < ringRefs.current.length; index += 1) {
      const ring = ringRefs.current[index]
      if (!ring) continue
      ring.rotation.z += delta * (index % 2 === 0 ? 0.08 : -0.055) * (index + 1)
    }
  })

  return (
    <group ref={groupRef}>
      {RING_ROTATIONS.map((rotation, index) => (
        <mesh
          key={index}
          ref={(mesh) => {
            if (mesh) ringRefs.current[index] = mesh
          }}
          rotation={rotation}
          scale={1 + index * 0.28}
        >
          <torusGeometry args={[2.05, index === 0 ? 0.026 : 0.012, 8, 160]} />
          <meshBasicMaterial
            color={index % 3 === 1 ? '#FF3FBD' : index === 4 ? '#FFB547' : '#35F2FF'}
            transparent
            opacity={index === 0 ? 0.72 : 0.3}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      <instancedMesh ref={fragmentRef} args={[undefined, undefined, fragmentCount]} frustumCulled={false}>
        <tetrahedronGeometry args={[1, 0]} />
        <meshStandardMaterial vertexColors roughness={0.18} metalness={0.92} transparent opacity={0.58} />
      </instancedMesh>
    </group>
  )
}

export function CoreScene({ quality }: CoreSceneProps) {
  return (
    <ActLayer acts={CORE_ACTS} motionZ={1.4}>
      <CoreParticles count={quality.particles.core} updateEveryNthFrame={quality.updateEveryNthFrame} />
      <OrbitAssembly quality={quality} />
      <CoreSurface quality={quality} />
    </ActLayer>
  )
}
