import { Select } from '@react-three/postprocessing'
import { useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { useAetherStore } from '../store'
import type { QualityPreset } from '../types'
import { ActLayer } from './ActLayer'
import { createSeededRandom, damp } from './sceneMath'
import {
  PORTAL_FRAGMENT,
  PORTAL_PARTICLE_FRAGMENT,
  PORTAL_PARTICLE_VERTEX,
  PORTAL_VERTEX,
} from './shaders'
import { useActFrame } from './useActFrame'

type PortalSceneProps = {
  quality: QualityPreset
}

const PORTAL_ACTS = [7] as const

function PortalParticles({ count, chargeRef, updateEveryNthFrame }: { count: number; chargeRef: MutableRefObject<number>; updateEveryNthFrame: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const data = useMemo(() => {
    const random = createSeededRandom(0x90a71)
    const positions = new Float32Array(count * 3)
    const scales = new Float32Array(count)
    const phases = new Float32Array(count)
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2
      const radius = 2.5 + Math.pow(random(), 0.58) * 10.5
      positions[index * 3] = Math.cos(angle) * radius
      positions[index * 3 + 1] = Math.sin(angle) * radius
      positions[index * 3 + 2] = (random() - 0.5) * (4 + radius * 0.42)
      scales[index] = 0.24 + random() * 1.76
      phases[index] = random()
    }
    return { positions, scales, phases }
  }, [count])
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCharge: { value: 0 },
      uOpacity: { value: 0.94 },
      uSize: { value: 5.6 },
      uColorA: { value: new THREE.Color('#35F2FF') },
      uColorB: { value: new THREE.Color('#FFB547') },
    }),
    [],
  )
  useActFrame(PORTAL_ACTS, updateEveryNthFrame, (_, delta) => {
    const material = materialRef.current
    if (!material) return
    material.uniforms.uTime.value += delta
    material.uniforms.uCharge.value = damp(material.uniforms.uCharge.value, chargeRef.current, 7.5, delta)
  })
  return (
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
          vertexShader={PORTAL_PARTICLE_VERTEX}
          fragmentShader={PORTAL_PARTICLE_FRAGMENT}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </Select>
  )
}

function PortalAperture({ chargeRef, updateEveryNthFrame }: { chargeRef: MutableRefObject<number>; updateEveryNthFrame: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const discRef = useRef<THREE.Mesh>(null)
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCharge: { value: 0 },
      uOpacity: { value: 0.9 },
      uAmber: { value: new THREE.Color('#FFB547') },
      uCyan: { value: new THREE.Color('#35F2FF') },
    }),
    [],
  )
  useActFrame(PORTAL_ACTS, updateEveryNthFrame, (_, delta) => {
    const material = materialRef.current
    if (!material) return
    material.uniforms.uTime.value += delta
    material.uniforms.uCharge.value = damp(material.uniforms.uCharge.value, chargeRef.current, 8, delta)
    if (discRef.current) {
      const charge = material.uniforms.uCharge.value
      discRef.current.scale.setScalar(0.88 + charge * 0.12 + Math.sin(material.uniforms.uTime.value * 2.2) * 0.012)
    }
  })
  return (
    <Select enabled>
      <mesh ref={discRef}>
        <circleGeometry args={[2.24, 160]} />
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={PORTAL_VERTEX}
          fragmentShader={PORTAL_FRAGMENT}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </Select>
  )
}

function PortalRings({ quality, chargeRef }: PortalSceneProps & { chargeRef: MutableRefObject<number> }) {
  const ringRefs = useRef<THREE.Mesh[]>([])
  const count = quality.level === 'ULTRA' ? 8 : quality.level === 'BALANCED' ? 6 : 4
  useActFrame(PORTAL_ACTS, quality.updateEveryNthFrame, (state, delta) => {
    for (let index = 0; index < ringRefs.current.length; index += 1) {
      const ring = ringRefs.current[index]
      if (!ring) continue
      const direction = index % 2 === 0 ? 1 : -1
      ring.rotation.x += delta * direction * (0.03 + chargeRef.current * 0.28) * (index + 1)
      ring.rotation.z += delta * direction * (0.08 + chargeRef.current * 0.8)
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.8 * (index + 1)) * 0.018 * (1 + chargeRef.current)
      ring.scale.setScalar(pulse)
    }
  })
  return (
    <group>
      {Array.from({ length: count }, (_, index) => (
        <mesh
          key={index}
          ref={(mesh) => {
            if (mesh) ringRefs.current[index] = mesh
          }}
          rotation={[index * 0.19, index * 0.27, index * 0.4]}
        >
          <torusGeometry args={[2.4 + index * 0.26, index === 0 ? 0.052 : 0.013, 8, 160, Math.PI * (1.58 + (index % 3) * 0.16)]} />
          <meshBasicMaterial
            color={index % 3 === 0 ? '#FFB547' : index % 3 === 1 ? '#F3F6F8' : '#35F2FF'}
            transparent
            opacity={0.72 - index * 0.065}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

export function PortalScene({ quality }: PortalSceneProps) {
  const portal = useAetherStore((state) => state.portal)
  const rootRef = useRef<THREE.Group>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const chargeRef = useRef(0)

  useActFrame(PORTAL_ACTS, quality.updateEveryNthFrame, (_, delta) => {
    const storeCharge = portal.status === 'charged' || portal.status === 'crossing' || portal.status === 'complete'
      ? 1
      : portal.charge
    chargeRef.current = damp(chargeRef.current, storeCharge, storeCharge > chargeRef.current ? 10 : 4.5, delta)

    if (rootRef.current) {
      rootRef.current.rotation.z += delta * (0.008 + chargeRef.current * 0.035)
      const crossing = portal.status === 'crossing' || portal.status === 'complete'
      const scaleTarget = crossing ? 1.34 : 1
      rootRef.current.scale.setScalar(damp(rootRef.current.scale.x, scaleTarget, 2.8, delta))
    }
    if (lightRef.current) lightRef.current.intensity = 10 + chargeRef.current * 28
  })

  return (
    <ActLayer acts={PORTAL_ACTS} motionZ={2.4}>
      <group ref={rootRef}>
        <PortalParticles
          count={quality.particles.portal}
          chargeRef={chargeRef}
          updateEveryNthFrame={quality.updateEveryNthFrame}
        />
        <PortalRings quality={quality} chargeRef={chargeRef} />
        <PortalAperture chargeRef={chargeRef} updateEveryNthFrame={quality.updateEveryNthFrame} />
        <pointLight ref={lightRef} color="#FFB547" intensity={10} distance={15} decay={2} />
        <pointLight position={[0, 0, -6]} color="#35F2FF" intensity={12} distance={18} />
      </group>
    </ActLayer>
  )
}
