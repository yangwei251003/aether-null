import { Select } from '@react-three/postprocessing'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { aetherAudio } from '../audio/AetherAudio'
import { FEATURE_FLAGS, SIGNAL_LAB } from '../config'
import { pointerSignal, scrollSignal } from '../runtime/signals'
import { useAetherStore } from '../store'
import type { QualityPreset } from '../types'
import { ActLayer } from './ActLayer'
import { createSeededRandom, damp } from './sceneMath'
import { SIGNAL_FRAGMENT, SIGNAL_VERTEX } from './shaders'
import { useActFrame } from './useActFrame'

type SignalFieldSceneProps = {
  quality: QualityPreset
}

const SIGNAL_ACTS = [4] as const

export function SignalFieldScene({ quality }: SignalFieldSceneProps) {
  const particleMultiplier = useAetherStore((state) => state.lab.particleMultiplier)
  const fieldMode = useAetherStore((state) => state.lab.field)
  const shaderMode = useAetherStore((state) => state.lab.shader)
  const timeScale = useAetherStore((state) => state.lab.timeScale)
  const parameters = useAetherStore((state) => state.game.parameters)
  const alignment = useAetherStore((state) => state.game.alignment)
  const status = useAetherStore((state) => state.game.status)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const rootRef = useRef<THREE.Group>(null)
  const ringsRef = useRef<THREE.Group>(null)
  const count = Math.max(160, Math.round(quality.particles.signalLab * particleMultiplier))
  const data = useMemo(() => {
    const random = createSeededRandom(0x519aa1)
    const positions = new Float32Array(count * 3)
    const scales = new Float32Array(count)
    const phases = new Float32Array(count)
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2
      const radius = Math.pow(random(), 0.58) * 4.2 + 0.18
      positions[index * 3] = Math.cos(angle) * radius
      positions[index * 3 + 1] = Math.sin(angle) * radius * 0.72
      positions[index * 3 + 2] = (random() - 0.5) * 2.6
      scales[index] = 0.3 + random() * 1.7
      phases[index] = random()
    }
    return { positions, scales, phases }
  }, [count])
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2() },
      uFrequency: { value: 0.5 },
      uCoherence: { value: 0.5 },
      uEntropy: { value: 0.5 },
      uAlignment: { value: 0 },
      uFieldMode: { value: 0 },
      uOpacity: { value: 0.88 },
      uSize: { value: quality.level === 'LITE' ? 4.4 : 5.4 },
      uColorA: { value: new THREE.Color('#35F2FF') },
      uColorB: { value: new THREE.Color('#FF3FBD') },
    }),
    [quality.level],
  )
  const pointer = useRef({ x: 0, y: 0 })
  const normalizedFrequency =
    (parameters.frequency - SIGNAL_LAB.parameters.frequency.min) /
    (SIGNAL_LAB.parameters.frequency.max - SIGNAL_LAB.parameters.frequency.min)
  const normalizedCoherence =
    (parameters.coherence - SIGNAL_LAB.parameters.coherence.min) /
    (SIGNAL_LAB.parameters.coherence.max - SIGNAL_LAB.parameters.coherence.min)
  const normalizedEntropy =
    (parameters.entropy - SIGNAL_LAB.parameters.entropy.min) /
    (SIGNAL_LAB.parameters.entropy.max - SIGNAL_LAB.parameters.entropy.min)

  useActFrame(SIGNAL_ACTS, quality.updateEveryNthFrame, (_, delta) => {
    const material = materialRef.current
    if (!material) return
    const audioEnergy = FEATURE_FLAGS.audioAnalyserReactiveShader ? aetherAudio.getEnergy() : 0
    pointer.current.x = damp(pointer.current.x, pointerSignal.normalizedX, 6.5, delta)
    pointer.current.y = damp(pointer.current.y, pointerSignal.normalizedY, 6.5, delta)
    material.uniforms.uTime.value += delta * timeScale
    material.uniforms.uPointer.value.set(pointer.current.x, pointer.current.y)
    material.uniforms.uFrequency.value = damp(material.uniforms.uFrequency.value, normalizedFrequency, 6, delta)
    material.uniforms.uCoherence.value = damp(material.uniforms.uCoherence.value, normalizedCoherence, 6, delta)
    material.uniforms.uEntropy.value = damp(material.uniforms.uEntropy.value, normalizedEntropy, 6, delta)
    material.uniforms.uAlignment.value = damp(
      material.uniforms.uAlignment.value,
      (status === 'locked' ? 1.3 : alignment) + audioEnergy * 0.14,
      status === 'locked' ? 10 : 4,
      delta,
    )
    const baseSize = quality.level === 'LITE' ? 4.4 : 5.4
    material.uniforms.uSize.value = damp(
      material.uniforms.uSize.value,
      baseSize * (1 + audioEnergy * 0.18),
      8,
      delta,
    )
    material.uniforms.uFieldMode.value = fieldMode === 'attract' ? 0 : fieldMode === 'repel' ? 1 : 2

    const shaderScale = shaderMode === 'event-horizon' ? 0.8 : shaderMode === 'interference' ? 1.12 : 1
    if (rootRef.current) {
      rootRef.current.rotation.z += delta * (0.035 + normalizedFrequency * 0.06)
      const lockedPulse = status === 'locked' ? 1 + Math.sin(material.uniforms.uTime.value * 7) * 0.035 : 1
      rootRef.current.scale.setScalar(shaderScale * lockedPulse)
    }
    if (ringsRef.current) {
      ringsRef.current.rotation.x = Math.sin(material.uniforms.uTime.value * 0.18) * 0.34
      ringsRef.current.rotation.y += delta * 0.18
      ringsRef.current.rotation.z -= delta * 0.1
    }
  })

  return (
    <ActLayer acts={SIGNAL_ACTS} motionZ={1.2}>
      <group ref={rootRef}>
        <Select enabled>
          <points frustumCulled={false}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
              <bufferAttribute attach="attributes-aScale" args={[data.scales, 1]} />
              <bufferAttribute attach="attributes-aPhase" args={[data.phases, 1]} />
            </bufferGeometry>
            <shaderMaterial
              ref={materialRef}
              uniforms={uniforms}
              vertexShader={SIGNAL_VERTEX}
              fragmentShader={SIGNAL_FRAGMENT}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </points>
        </Select>
        <group ref={ringsRef}>
          {[0, 1, 2].map((index) => (
            <mesh key={index} rotation={[index * 0.72, index * 0.47, 0]} scale={1 + index * 0.54}>
              <torusGeometry args={[1.34, index === 0 ? 0.018 : 0.009, 6, 128]} />
              <meshBasicMaterial
                color={index === 1 ? '#FF3FBD' : '#35F2FF'}
                transparent
                opacity={0.38 - index * 0.07}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
        <mesh rotation={[0, 0, Math.PI * 0.25]}>
          <octahedronGeometry args={[0.28, 2]} />
          <meshBasicMaterial color="#F3F6F8" wireframe transparent opacity={0.72} toneMapped={false} />
        </mesh>
      </group>
      <pointLight color="#35F2FF" intensity={7 + alignment * 12} distance={9} />
      <pointLight position={[2, -1, 2]} color="#FF3FBD" intensity={4} distance={7} />
    </ActLayer>
  )
}
