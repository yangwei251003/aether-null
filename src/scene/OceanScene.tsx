import { Select } from '@react-three/postprocessing'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { pointerSignal, scrollSignal } from '../runtime/signals'
import type { QualityPreset } from '../types'
import { ActLayer } from './ActLayer'
import { createSeededRandom, damp, smoothstep } from './sceneMath'
import {
  MORPH_FRAGMENT,
  MORPH_VERTEX,
  OCEAN_FRAGMENT,
  OCEAN_VERTEX,
} from './shaders'
import { useActFrame } from './useActFrame'

type OceanSceneProps = {
  quality: QualityPreset
}

const OCEAN_ACTS = [5] as const

function OceanSurface({ quality }: OceanSceneProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const segments = quality.geometrySegments
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uPointer: { value: new THREE.Vector2() },
      uOpacity: { value: 0.92 },
      uCyan: { value: new THREE.Color('#35F2FF') },
      uPearl: { value: new THREE.Color('#F3F6F8') },
    }),
    [],
  )

  useActFrame(OCEAN_ACTS, quality.updateEveryNthFrame, (_, delta) => {
    const material = materialRef.current
    if (!material) return
    pointer.current.x = damp(pointer.current.x, pointerSignal.normalizedX, 3.8, delta)
    pointer.current.y = damp(pointer.current.y, pointerSignal.normalizedY, 3.8, delta)
    material.uniforms.uTime.value += delta
    material.uniforms.uProgress.value = smoothstep(0.42, 0.94, scrollSignal.actProgress)
    material.uniforms.uPointer.value.set(pointer.current.x, pointer.current.y)
    if (meshRef.current) {
      meshRef.current.position.y = -1.05 + Math.sin(material.uniforms.uTime.value * 0.16) * 0.08
    }
  })

  return (
    <Select enabled>
      <mesh ref={meshRef} position={[0, -1.05, -7]} rotation={[-Math.PI * 0.5, 0, 0]}>
        <planeGeometry args={[28, 38, segments, segments]} />
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={OCEAN_VERTEX}
          fragmentShader={OCEAN_FRAGMENT}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </Select>
  )
}

function MemoryToStars({ count, lite, updateEveryNthFrame }: { count: number; lite: boolean; updateEveryNthFrame: number }) {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const data = useMemo(() => {
    const random = createSeededRandom(0x0cea71)
    const positions = new Float32Array(count * 3)
    const destinations = new Float32Array(count * 3)
    const scales = new Float32Array(count)
    const phases = new Float32Array(count)
    for (let index = 0; index < count; index += 1) {
      const x = (random() - 0.5) * 26
      const z = -3 - random() * 34
      const wave = Math.sin(x * 0.7) * 0.12 + Math.cos(z * 0.45) * 0.1
      positions[index * 3] = x
      positions[index * 3 + 1] = -0.88 + wave
      positions[index * 3 + 2] = z

      const angle = random() * Math.PI * 2
      const radius = 4 + Math.pow(random(), 0.45) * 13
      destinations[index * 3] = Math.cos(angle) * radius
      destinations[index * 3 + 1] = -1 + Math.pow(random(), 0.62) * 12
      destinations[index * 3 + 2] = -7 + Math.sin(angle) * radius - random() * 8
      scales[index] = 0.25 + random() * 1.75
      phases[index] = random()
    }
    return { positions, destinations, scales, phases }
  }, [count])
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMorph: { value: 0 },
      uOpacity: { value: 0.86 },
      uSize: { value: lite ? 4.6 : 6.2 },
      uColorA: { value: new THREE.Color('#C8F9FF') },
      uColorB: { value: new THREE.Color('#FFB547') },
    }),
    [lite],
  )

  useActFrame(OCEAN_ACTS, updateEveryNthFrame, (_, delta) => {
    const material = materialRef.current
    if (!material) return
    material.uniforms.uTime.value += delta
    material.uniforms.uMorph.value = damp(
      material.uniforms.uMorph.value,
      smoothstep(0.36, 0.92, scrollSignal.actProgress),
      4,
      delta,
    )
    if (pointsRef.current) pointsRef.current.rotation.y += delta * material.uniforms.uMorph.value * 0.006
  })

  return (
    <Select enabled>
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
          <bufferAttribute attach="attributes-aDestination" args={[data.destinations, 3]} />
          <bufferAttribute attach="attributes-aScale" args={[data.scales, 1]} />
          <bufferAttribute attach="attributes-aPhase" args={[data.phases, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={MORPH_VERTEX}
          fragmentShader={MORPH_FRAGMENT}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </Select>
  )
}

function OceanHorizon({ updateEveryNthFrame }: { updateEveryNthFrame: number }) {
  const ringsRef = useRef<THREE.Group>(null)
  useActFrame(OCEAN_ACTS, updateEveryNthFrame, (state, delta) => {
    if (!ringsRef.current) return
    ringsRef.current.rotation.z += delta * 0.012
    ringsRef.current.position.y = 3.6 + Math.sin(state.clock.elapsedTime * 0.14) * 0.16
  })
  return (
    <group ref={ringsRef} position={[0, 3.6, -17]} rotation={[0, 0.15, 0]}>
      <mesh>
        <torusGeometry args={[4.8, 0.025, 8, 192]} />
        <meshBasicMaterial color="#C8F9FF" transparent opacity={0.24} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI * 0.5]}>
        <torusGeometry args={[5.7, 0.008, 6, 192]} />
        <meshBasicMaterial color="#35F2FF" transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function OceanScene({ quality }: OceanSceneProps) {
  return (
    <ActLayer acts={OCEAN_ACTS} motionZ={1.8}>
      <OceanSurface quality={quality} />
      <MemoryToStars
        count={quality.particles.ocean}
        lite={quality.level === 'LITE'}
        updateEveryNthFrame={quality.updateEveryNthFrame}
      />
      <OceanHorizon updateEveryNthFrame={quality.updateEveryNthFrame} />
      <hemisphereLight color="#B8F8FF" groundColor="#020407" intensity={1.4} />
      <pointLight position={[0, 1, -9]} color="#35F2FF" intensity={8} distance={16} />
    </ActLayer>
  )
}
