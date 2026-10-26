import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { QualityPreset } from '../types'
import { scrollSignal } from '../runtime/signals'
import { ActLayer } from './ActLayer'
import { createSeededRandom } from './sceneMath'
import {
  CONNECTION_FRAGMENT,
  CONNECTION_VERTEX,
  TUNNEL_FRAGMENT,
  TUNNEL_VERTEX,
} from './shaders'
import { useActFrame } from './useActFrame'

type TunnelSceneProps = {
  quality: QualityPreset
}

const TUNNEL_ACTS = [2] as const

function TunnelParticles({ count, updateEveryNthFrame }: { count: number; updateEveryNthFrame: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const data = useMemo(() => {
    const random = createSeededRandom(0x71f1e1)
    const positions = new Float32Array(count * 3)
    const scales = new Float32Array(count)
    const phases = new Float32Array(count)
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2
      const radius = 0.72 + Math.pow(random(), 0.68) * 5.8
      positions[index * 3] = Math.cos(angle) * radius
      positions[index * 3 + 1] = Math.sin(angle) * radius
      positions[index * 3 + 2] = 4 - random() * 124
      scales[index] = 0.22 + random() * 1.78
      phases[index] = random()
    }
    return { positions, scales, phases }
  }, [count])
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTravel: { value: 0 },
      uVelocity: { value: 0 },
      uSize: { value: 2.8 },
      uOpacity: { value: 0.9 },
      uColorA: { value: new THREE.Color('#35F2FF') },
      uColorB: { value: new THREE.Color('#FF3FBD') },
    }),
    [],
  )

  useActFrame(TUNNEL_ACTS, updateEveryNthFrame, (_, delta) => {
    const material = materialRef.current
    if (!material) return
    material.uniforms.uTime.value += delta
    material.uniforms.uTravel.value = scrollSignal.actProgress
    material.uniforms.uVelocity.value = THREE.MathUtils.lerp(
      material.uniforms.uVelocity.value,
      Math.abs(scrollSignal.velocity),
      0.12,
    )
  })

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[data.scales, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[data.phases, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={TUNNEL_VERTEX}
        fragmentShader={TUNNEL_FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

function TunnelLightRails({ rails, segments, updateEveryNthFrame }: { rails: number; segments: number; updateEveryNthFrame: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const geometry = useMemo(() => {
    const positions = new Float32Array(rails * segments * 2 * 3)
    const along = new Float32Array(rails * segments * 2)
    const phase = new Float32Array(rails * segments * 2)
    const strength = new Float32Array(rails * segments * 2)
    let vertex = 0
    for (let rail = 0; rail < rails; rail += 1) {
      const angle = (rail / rails) * Math.PI * 2 + (rail % 3) * 0.07
      const radius = 2.45 + (rail % 5) * 0.48
      const railPhase = (rail * 0.137) % 1
      for (let segment = 0; segment < segments; segment += 1) {
        for (let endpoint = 0; endpoint < 2; endpoint += 1) {
          const t = (segment + endpoint) / segments
          const z = 3 - t * 122
          const twist = angle + t * 2.3
          positions[vertex * 3] = Math.cos(twist) * radius
          positions[vertex * 3 + 1] = Math.sin(twist) * radius
          positions[vertex * 3 + 2] = z
          along[vertex] = t
          phase[vertex] = railPhase
          strength[vertex] = 0.34 + (rail % 4) * 0.12
          vertex += 1
        }
      }
    }
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    result.setAttribute('aAlong', new THREE.BufferAttribute(along, 1))
    result.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    result.setAttribute('aStrength', new THREE.BufferAttribute(strength, 1))
    return result
  }, [rails, segments])
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0.42 },
      uColor: { value: new THREE.Color('#5AF6FF') },
    }),
    [],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useActFrame(TUNNEL_ACTS, updateEveryNthFrame, (_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta * (1 + Math.abs(scrollSignal.velocity) * 0.018)
    }
  })

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={CONNECTION_VERTEX}
        fragmentShader={CONNECTION_FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </lineSegments>
  )
}

function TunnelRings({ quality }: TunnelSceneProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const rootRef = useRef<THREE.Group>(null)
  const count = quality.level === 'ULTRA' ? 34 : quality.level === 'BALANCED' ? 24 : 15
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let index = 0; index < count; index += 1) {
      const z = 2 - (index / Math.max(1, count - 1)) * 121
      const radius = 3.05 + Math.sin(index * 1.7) * 0.65
      dummy.position.set(0, 0, z)
      dummy.rotation.set(0, 0, index * 0.34)
      dummy.scale.set(radius, radius, radius)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
      mesh.setColorAt(index, new THREE.Color(index % 4 === 0 ? '#FF3FBD' : '#35F2FF'))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [count, dummy])

  useActFrame(TUNNEL_ACTS, quality.updateEveryNthFrame, (_, delta) => {
    if (rootRef.current) {
      rootRef.current.rotation.z += delta * (0.035 + Math.abs(scrollSignal.velocity) * 0.001)
    }
  })

  return (
    <group ref={rootRef}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <torusGeometry args={[1, 0.006, 4, 96]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  )
}

export function TunnelScene({ quality }: TunnelSceneProps) {
  const rails = quality.level === 'ULTRA' ? 20 : quality.level === 'BALANCED' ? 14 : 8
  const segments = quality.level === 'ULTRA' ? 48 : quality.level === 'BALANCED' ? 32 : 20

  return (
    <ActLayer acts={TUNNEL_ACTS} motionZ={3}>
      <TunnelParticles count={quality.particles.tunnel} updateEveryNthFrame={quality.updateEveryNthFrame} />
      <TunnelLightRails rails={rails} segments={segments} updateEveryNthFrame={quality.updateEveryNthFrame} />
      <TunnelRings quality={quality} />
      <pointLight position={[0, 0, -28]} color="#FF3FBD" intensity={18} distance={44} />
      <pointLight position={[0, 0, -74]} color="#35F2FF" intensity={15} distance={42} />
    </ActLayer>
  )
}
