import { MeshTransmissionMaterial } from '@react-three/drei'
import { Select } from '@react-three/postprocessing'
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { ARTIFACTS } from '../config'
import { scrollSignal } from '../runtime/signals'
import { useAetherStore } from '../store'
import type { ArtifactDatum, QualityPreset } from '../types'
import { ActLayer } from './ActLayer'
import { ACCENT_HEX, createSeededRandom, damp } from './sceneMath'
import { PARTICLE_FRAGMENT, PARTICLE_VERTEX } from './shaders'
import { useActFrame } from './useActFrame'

type ArtifactsSceneProps = {
  quality: QualityPreset
}

const ARTIFACT_ACTS = [3] as const

function pointerTargetsInterface(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('button, a, input, select, textarea, [role="dialog"], aside, nav'))
}

type ArtifactShellProps = {
  artifact: ArtifactDatum
  children: ReactNode
  updateEveryNthFrame: number
}

function ArtifactShell({ artifact, children, updateEveryNthFrame }: ArtifactShellProps) {
  const rootRef = useRef<THREE.Group>(null)
  const auraRef = useRef<THREE.Mesh>(null)
  const hovered = useRef(false)
  const selectedId = useAetherStore((state) => state.artifact.selectedId)
  const selectArtifact = useAetherStore((state) => state.selectArtifact)

  useActFrame(ARTIFACT_ACTS, updateEveryNthFrame, (state, delta) => {
    const root = rootRef.current
    if (!root) return
    root.rotation.y += delta * artifact.orbitRate * 0.18
    const selected = selectedId === artifact.id
    const targetScale = artifact.scale * (selected ? 1.58 : selectedId ? 0.42 : hovered.current ? 1.08 : 1)
    const current = damp(root.scale.x, targetScale, selected ? 5 : 7, delta)
    root.scale.setScalar(current)
    root.position.x = damp(root.position.x, selected ? 0 : artifact.position[0], selected ? 4.6 : 6.8, delta)
    root.position.y = damp(root.position.y, selected ? 0 : artifact.position[1], selected ? 4.6 : 6.8, delta)
    root.position.z = damp(root.position.z, selected ? 2.35 : artifact.position[2], selected ? 4.6 : 6.8, delta)
    if (auraRef.current) {
      auraRef.current.rotation.z -= delta * artifact.orbitRate
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.3 + artifact.position[0]) * 0.045
      auraRef.current.scale.setScalar(pulse)
    }
  })

  return (
    <group
      ref={rootRef}
      position={artifact.position}
      rotation={artifact.rotation}
      scale={artifact.scale}
      onPointerOver={(event) => {
        if (scrollSignal.act !== 3 || pointerTargetsInterface(event.nativeEvent.target)) return
        event.stopPropagation()
        hovered.current = true
      }}
      onPointerOut={() => {
        hovered.current = false
      }}
      onClick={(event) => {
        if (scrollSignal.act !== 3 || pointerTargetsInterface(event.nativeEvent.target)) return
        event.stopPropagation()
        selectArtifact(artifact.id)
      }}
    >
      {children}
      <mesh ref={auraRef} rotation={[Math.PI * 0.5, 0, 0]}>
        <torusGeometry args={[1.52, 0.008, 4, 96]} />
        <meshBasicMaterial
          color={ACCENT_HEX[artifact.accent]}
          transparent
          opacity={0.42}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

function BreathingSeed({ artifact, quality }: { artifact: ArtifactDatum; quality: QualityPreset }) {
  const shellRef = useRef<THREE.Mesh>(null)
  const seamRef = useRef<THREE.Mesh>(null)
  useActFrame(ARTIFACT_ACTS, quality.updateEveryNthFrame, (state, delta) => {
    const breath = 1 + Math.sin(state.clock.elapsedTime * 0.85) * 0.055
    if (shellRef.current) shellRef.current.scale.set(0.76 * breath, 1.35 / breath, 0.76 * breath)
    if (seamRef.current) seamRef.current.rotation.z += delta * 0.108
  })
  return (
    <ArtifactShell artifact={artifact} updateEveryNthFrame={quality.updateEveryNthFrame}>
      <Select enabled>
        <mesh ref={shellRef}>
          <icosahedronGeometry args={[1.05, 4]} />
          <meshPhysicalMaterial
            color="#929EAA"
            metalness={1}
            roughness={0.08}
            clearcoat={1}
            clearcoatRoughness={0.08}
            iridescence={0.72}
            iridescenceIOR={1.8}
          />
        </mesh>
      </Select>
      <mesh ref={seamRef} rotation={[Math.PI * 0.5, 0, 0]}>
        <torusGeometry args={[0.84, 0.018, 8, 128]} />
        <meshBasicMaterial color="#35F2FF" toneMapped={false} />
      </mesh>
      <pointLight color="#35F2FF" intensity={5} distance={4} />
    </ArtifactShell>
  )
}

function NestedOrbits({ artifact, quality }: { artifact: ArtifactDatum; quality: QualityPreset }) {
  const ringRefs = useRef<THREE.Mesh[]>([])
  const coreRef = useRef<THREE.Mesh>(null)
  useActFrame(ARTIFACT_ACTS, quality.updateEveryNthFrame, (state, delta) => {
    for (let index = 0; index < ringRefs.current.length; index += 1) {
      const ring = ringRefs.current[index]
      if (!ring) continue
      ring.rotation.x += delta * (0.09 + index * 0.022) * (index % 2 ? -1 : 1)
      ring.rotation.y += delta * (0.07 + index * 0.017)
    }
    if (coreRef.current) {
      coreRef.current.scale.setScalar(0.78 + Math.sin(state.clock.elapsedTime * 1.2) * 0.08)
    }
  })
  return (
    <ArtifactShell artifact={artifact} updateEveryNthFrame={quality.updateEveryNthFrame}>
      {Array.from({ length: 7 }, (_, index) => (
        <mesh
          key={index}
          ref={(mesh) => {
            if (mesh) ringRefs.current[index] = mesh
          }}
          rotation={[index * 0.31, index * -0.22, index * 0.13]}
        >
          <torusGeometry args={[0.52 + index * 0.105, 0.018 - index * 0.0012, 8, 96]} />
          <meshStandardMaterial
            color={index % 3 === 0 ? '#FFB547' : '#B8C1CA'}
            metalness={0.92}
            roughness={0.16}
            emissive={index % 3 === 0 ? '#5A2D00' : '#071216'}
            emissiveIntensity={1.1}
          />
        </mesh>
      ))}
      <mesh ref={coreRef}>
        <octahedronGeometry args={[0.24, 2]} />
        <meshBasicMaterial color="#FFF1D7" toneMapped={false} />
      </mesh>
    </ArtifactShell>
  )
}

function DataCrystal({ artifact, quality }: { artifact: ArtifactDatum; quality: QualityPreset }) {
  const rootRef = useRef<THREE.Group>(null)
  const shardRefs = useRef<THREE.Mesh[]>([])
  useActFrame(ARTIFACT_ACTS, quality.updateEveryNthFrame, (_, delta) => {
    if (rootRef.current) rootRef.current.rotation.y += delta * 0.065
    for (let index = 0; index < shardRefs.current.length; index += 1) {
      const shard = shardRefs.current[index]
      if (shard) shard.rotation.z += delta * (0.025 + index * 0.01)
    }
  })
  return (
    <ArtifactShell artifact={artifact} updateEveryNthFrame={quality.updateEveryNthFrame}>
      <group ref={rootRef}>
        <Select enabled>
          <mesh scale={[0.82, 1.42, 0.74]}>
            <octahedronGeometry args={[0.92, 1]} />
            {quality.reflectionResolution > 0 ? (
              <MeshTransmissionMaterial
                backside
                transmissionSampler
                samples={quality.level === 'ULTRA' ? 8 : 4}
                resolution={quality.reflectionResolution}
                transmission={1}
                roughness={0.05}
                thickness={1.4}
                ior={2.18}
                chromaticAberration={0.08}
                anisotropicBlur={quality.level === 'ULTRA' ? 0.14 : 0.04}
                color="#BDFBFF"
              />
            ) : (
              <meshPhysicalMaterial
                color="#BDFBFF"
                metalness={0.08}
                roughness={0.16}
                transmission={0.72}
                thickness={0.8}
                ior={1.72}
                transparent
                opacity={0.84}
              />
            )}
          </mesh>
        </Select>
        <mesh scale={[0.58, 1.02, 0.52]} rotation={[0.12, -0.22, 0.08]}>
          <octahedronGeometry args={[0.92, 1]} />
          <meshBasicMaterial
            color="#35F2FF"
            wireframe
            transparent
            opacity={0.24}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        {[-1, 1].map((direction, index) => (
          <mesh
            key={direction}
            ref={(mesh) => {
              if (mesh) shardRefs.current[index] = mesh
            }}
            position={[direction * 0.8, direction * 0.22, -0.2]}
            rotation={[0.2, 0.3 * direction, 0.4 * direction]}
            scale={0.34}
          >
            <tetrahedronGeometry args={[1, 0]} />
            <meshPhysicalMaterial color="#FF5BC8" transmission={0.66} opacity={0.58} transparent roughness={0.08} />
          </mesh>
        ))}
      </group>
      <pointLight color="#FF3FBD" intensity={4} distance={3.5} />
    </ArtifactShell>
  )
}

function FoldedCity({ artifact, quality }: { artifact: ArtifactDatum; quality: QualityPreset }) {
  const cityRef = useRef<THREE.InstancedMesh>(null)
  const rootRef = useRef<THREE.Group>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const count = 42
  useLayoutEffect(() => {
    const mesh = cityRef.current
    if (!mesh) return
    const random = createSeededRandom(0xc17f01d)
    for (let index = 0; index < count; index += 1) {
      const column = index % 7
      const row = Math.floor(index / 7)
      const height = 0.18 + random() * 1.25
      const bend = (column - 3) * 0.08
      dummy.position.set((column - 3) * 0.23, height * 0.5 - 0.7, (row - 2.5) * 0.22 + bend * bend)
      dummy.rotation.set(bend * 0.15, bend, (row - 2.5) * 0.035)
      dummy.scale.set(0.14 + random() * 0.07, height, 0.12 + random() * 0.1)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
      mesh.setColorAt(index, new THREE.Color(index % 8 === 0 ? '#FFD182' : '#69737E'))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [dummy])
  useActFrame(ARTIFACT_ACTS, quality.updateEveryNthFrame, (state) => {
    if (!rootRef.current) return
    rootRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.17) * 0.08
    rootRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.11) * 0.045
  })
  return (
    <ArtifactShell artifact={artifact} updateEveryNthFrame={quality.updateEveryNthFrame}>
      <group ref={rootRef} rotation={[0.1, -0.35, 0.08]}>
        <instancedMesh ref={cityRef} args={[undefined, undefined, count]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial vertexColors metalness={0.82} roughness={0.29} emissive="#281300" emissiveIntensity={0.64} />
        </instancedMesh>
        <mesh position={[0, -0.72, 0]} rotation={[Math.PI * 0.5, 0, 0]}>
          <ringGeometry args={[0.46, 1.25, 7]} />
          <meshBasicMaterial color="#FFB547" wireframe transparent opacity={0.18} />
        </mesh>
      </group>
    </ArtifactShell>
  )
}

function MaskParticles({ count, updateEveryNthFrame }: { count: number; updateEveryNthFrame: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const data = useMemo(() => {
    const random = createSeededRandom(0x5a5c)
    const positions = new Float32Array(count * 3)
    const scales = new Float32Array(count)
    const phases = new Float32Array(count)
    for (let index = 0; index < count; index += 1) {
      const theta = random() * Math.PI * 2
      const radius = Math.sqrt(random())
      positions[index * 3] = Math.cos(theta) * radius * 0.72
      positions[index * 3 + 1] = Math.sin(theta) * radius * 1.06
      positions[index * 3 + 2] = 0.35 - radius * radius * 0.2 + (random() - 0.5) * 0.08
      scales[index] = 0.45 + random() * 1.2
      phases[index] = random()
    }
    return { positions, scales, phases }
  }, [count])
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 9 },
      uMotion: { value: 0.018 },
      uOpacity: { value: 0.72 },
      uColorA: { value: new THREE.Color('#F3F6F8') },
      uColorB: { value: new THREE.Color('#35F2FF') },
    }),
    [],
  )
  useActFrame(ARTIFACT_ACTS, updateEveryNthFrame, (_, delta) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value += delta
  })
  return (
    <points>
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

function MemoryMask({ artifact, quality }: { artifact: ArtifactDatum; quality: QualityPreset }) {
  const maskRef = useRef<THREE.Mesh>(null)
  useActFrame(ARTIFACT_ACTS, quality.updateEveryNthFrame, (state) => {
    if (!maskRef.current) return
    maskRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.24) * 0.16
    maskRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.17) * 0.05
  })
  return (
    <ArtifactShell artifact={artifact} updateEveryNthFrame={quality.updateEveryNthFrame}>
      <Select enabled>
        <mesh ref={maskRef} scale={[0.74, 1.04, 0.36]} rotation={[0, Math.PI, 0]}>
          <sphereGeometry args={[1, quality.level === 'LITE' ? 32 : 64, quality.level === 'LITE' ? 24 : 48, 0, Math.PI * 2, 0.25, Math.PI * 0.68]} />
          <meshPhysicalMaterial
            color="#D8E1E7"
            metalness={0.72}
            roughness={0.16}
            transmission={0.18}
            opacity={0.72}
            transparent
            side={THREE.DoubleSide}
          />
        </mesh>
      </Select>
      <MaskParticles
        count={quality.particles.artifacts}
        updateEveryNthFrame={quality.updateEveryNthFrame}
      />
    </ArtifactShell>
  )
}

export function ArtifactsScene({ quality }: ArtifactsSceneProps) {
  return (
    <ActLayer acts={ARTIFACT_ACTS} motionZ={1.8}>
      {ARTIFACTS.map((artifact) => {
        switch (artifact.geometry) {
          case 'breathing-seed':
            return <BreathingSeed key={artifact.id} artifact={artifact} quality={quality} />
          case 'nested-orbits':
            return <NestedOrbits key={artifact.id} artifact={artifact} quality={quality} />
          case 'refractive-crystal':
            return <DataCrystal key={artifact.id} artifact={artifact} quality={quality} />
          case 'folded-architecture':
            return <FoldedCity key={artifact.id} artifact={artifact} quality={quality} />
          case 'spectral-mask':
            return <MemoryMask key={artifact.id} artifact={artifact} quality={quality} />
        }
      })}
      <directionalLight position={[-3, 5, 7]} color="#D9F9FF" intensity={2.8} />
      <pointLight position={[0, -2, 4]} color="#FFB547" intensity={4.2} distance={18} />
    </ActLayer>
  )
}
