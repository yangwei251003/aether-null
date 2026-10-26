import { Html } from '@react-three/drei'
import { Select } from '@react-three/postprocessing'
import { type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CONSTELLATION_NODES, CONSTELLATION_PATHS } from '../config'
import { scrollSignal } from '../runtime/signals'
import { useAetherStore } from '../store'
import type { ConstellationNode, QualityPreset } from '../types'
import { ActLayer } from './ActLayer'
import { ACCENT_HEX, damp } from './sceneMath'
import {
  CONNECTION_FRAGMENT,
  CONNECTION_VERTEX,
  NODE_FRAGMENT,
  NODE_VERTEX,
} from './shaders'
import { useActFrame } from './useActFrame'

type ConstellationSceneProps = {
  quality: QualityPreset
}

const CONSTELLATION_ACTS = [6] as const

function pointerTargetsInterface(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('button, a, input, select, textarea, [role="dialog"], aside, nav'))
}

const NODE_INDEX = new Map(CONSTELLATION_NODES.map((node, index) => [node.id, index] as const))
const NODE_BY_ID = new Map(CONSTELLATION_NODES.map((node) => [node.id, node] as const))

function ConnectionField({ updateEveryNthFrame }: { updateEveryNthFrame: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const geometry = useMemo(() => {
    const vertexCount = CONSTELLATION_PATHS.length * 2
    const positions = new Float32Array(vertexCount * 3)
    const along = new Float32Array(vertexCount)
    const phase = new Float32Array(vertexCount)
    const strength = new Float32Array(vertexCount)

    for (let index = 0; index < CONSTELLATION_PATHS.length; index += 1) {
      const connection = CONSTELLATION_PATHS[index]
      const from = NODE_BY_ID.get(connection.from)
      const to = NODE_BY_ID.get(connection.to)
      if (!from || !to) continue
      const offset = index * 2
      positions.set(from.position, offset * 3)
      positions.set(to.position, (offset + 1) * 3)
      along[offset] = 0
      along[offset + 1] = 1
      phase[offset] = connection.pulseOffset
      phase[offset + 1] = connection.pulseOffset
      strength[offset] = connection.strength
      strength[offset + 1] = connection.strength
    }
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    result.setAttribute('aAlong', new THREE.BufferAttribute(along, 1))
    result.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    result.setAttribute('aStrength', new THREE.BufferAttribute(strength, 1))
    result.computeBoundingSphere()
    return result
  }, [])
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0.72 },
      uColor: { value: new THREE.Color('#35F2FF') },
    }),
    [],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useActFrame(CONSTELLATION_ACTS, updateEveryNthFrame, (_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta * (1 + scrollSignal.actProgress * 0.8)
    }
  })

  return (
    <Select enabled>
      <lineSegments geometry={geometry}>
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
    </Select>
  )
}

function NodeLabel({ node }: { node: ConstellationNode }) {
  return (
    <Html center position={node.position} distanceFactor={8} zIndexRange={[18, 8]}>
      <div
        style={{
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          transform: 'translateY(-34px)',
          color: '#F3F6F8',
          background: 'rgba(3, 7, 10, 0.78)',
          border: '1px solid rgba(93, 244, 255, 0.35)',
          padding: '7px 10px',
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '10px',
          letterSpacing: '0.12em',
          lineHeight: 1.35,
        }}
      >
        <strong style={{ display: 'block', fontWeight: 500 }}>{node.label.toUpperCase()}</strong>
        <span style={{ color: '#7DEBF2', opacity: 0.72 }}>{node.code}</span>
      </div>
    </Html>
  )
}

function FocusReticle({ node, updateEveryNthFrame }: { node: ConstellationNode; updateEveryNthFrame: number }) {
  const groupRef = useRef<THREE.Group>(null)
  useActFrame(CONSTELLATION_ACTS, updateEveryNthFrame, (state, delta) => {
    if (!groupRef.current) return
    groupRef.current.rotation.z += delta * 0.32
    const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.06
    groupRef.current.scale.setScalar(scale)
  })
  return (
    <group ref={groupRef} position={node.position}>
      <mesh>
        <torusGeometry args={[node.radius * 2.25 + 0.22, 0.012, 6, 96, Math.PI * 1.66]} />
        <meshBasicMaterial color="#FFB547" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[node.radius * 2.7 + 0.28, 0.006, 4, 96, Math.PI * 1.34]} />
        <meshBasicMaterial color="#35F2FF" transparent opacity={0.56} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function ConstellationScene({ quality }: ConstellationSceneProps) {
  const rootRef = useRef<THREE.Group>(null)
  const nodesRef = useRef<THREE.InstancedMesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const hoveredId = useAetherStore((state) => state.node.hoveredId)
  const focusedId = useAetherStore((state) => state.node.focusedId)
  const setHoveredNode = useAetherStore((state) => state.setHoveredNode)
  const focusNode = useAetherStore((state) => state.focusNode)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const drag = useRef({ active: false, x: 0, y: 0, targetX: 0, targetY: 0 })
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 1 },
    }),
    [],
  )

  useLayoutEffect(() => {
    const mesh = nodesRef.current
    if (!mesh) return
    for (let index = 0; index < CONSTELLATION_NODES.length; index += 1) {
      const node = CONSTELLATION_NODES[index]
      dummy.position.set(node.position[0], node.position[1], node.position[2])
      dummy.scale.setScalar(node.radius)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
      color.setHex(ACCENT_HEX[node.accent])
      mesh.setColorAt(index, color)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [color, dummy])

  useActFrame(CONSTELLATION_ACTS, quality.updateEveryNthFrame, (state, delta) => {
    const mesh = nodesRef.current
    const material = materialRef.current
    if (material) material.uniforms.uTime.value += delta
    if (mesh) {
      for (let index = 0; index < CONSTELLATION_NODES.length; index += 1) {
        const node = CONSTELLATION_NODES[index]
        const hovered = hoveredId === node.id
        const focused = focusedId === node.id
        const pulse = 1 + Math.sin(state.clock.elapsedTime * (node.major ? 1.7 : 1.15) + index * 0.71) * (node.major ? 0.18 : 0.1)
        const emphasis = focused ? 1.75 : hovered ? 1.46 : 1
        dummy.position.set(node.position[0], node.position[1], node.position[2])
        dummy.scale.setScalar(node.radius * pulse * emphasis)
        dummy.rotation.set(state.clock.elapsedTime * 0.08, index * 0.24, state.clock.elapsedTime * -0.05)
        dummy.updateMatrix()
        mesh.setMatrixAt(index, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
    if (rootRef.current) {
      rootRef.current.rotation.x = damp(rootRef.current.rotation.x, drag.current.targetY, 4.8, delta)
      rootRef.current.rotation.y = damp(rootRef.current.rotation.y, drag.current.targetX, 4.8, delta)
    }
  })

  const hoveredNode = hoveredId ? NODE_BY_ID.get(hoveredId) ?? null : null
  const focusedNode = focusedId ? NODE_BY_ID.get(focusedId) ?? null : null

  const startDrag = (event: ThreeEvent<PointerEvent>) => {
    if (scrollSignal.act !== 6 || pointerTargetsInterface(event.nativeEvent.target)) return
    drag.current.active = true
    drag.current.x = event.clientX
    drag.current.y = event.clientY
  }
  const moveDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!drag.current.active || pointerTargetsInterface(event.nativeEvent.target)) return
    const dx = event.clientX - drag.current.x
    const dy = event.clientY - drag.current.y
    drag.current.x = event.clientX
    drag.current.y = event.clientY
    drag.current.targetX = THREE.MathUtils.clamp(drag.current.targetX + dx * 0.0022, -0.38, 0.38)
    drag.current.targetY = THREE.MathUtils.clamp(drag.current.targetY + dy * 0.0018, -0.24, 0.24)
  }
  const stopDrag = () => {
    drag.current.active = false
  }
  const onNodeOver = (event: ThreeEvent<PointerEvent>) => {
    if (scrollSignal.act !== 6 || pointerTargetsInterface(event.nativeEvent.target)) return
    event.stopPropagation()
    const instanceId = event.instanceId
    if (instanceId === undefined) return
    setHoveredNode(CONSTELLATION_NODES[instanceId]?.id ?? null)
  }
  const onNodeClick = (event: ThreeEvent<MouseEvent>) => {
    if (scrollSignal.act !== 6 || pointerTargetsInterface(event.nativeEvent.target)) return
    event.stopPropagation()
    const instanceId = event.instanceId
    if (instanceId === undefined) return
    const node = CONSTELLATION_NODES[instanceId]
    if (node) focusNode(focusedId === node.id ? null : node.id)
  }

  return (
    <ActLayer acts={CONSTELLATION_ACTS} motionZ={2.2} groupRef={rootRef}>
      <ConnectionField updateEveryNthFrame={quality.updateEveryNthFrame} />
      <Select enabled>
        <instancedMesh
          ref={nodesRef}
          args={[undefined, undefined, CONSTELLATION_NODES.length]}
          onPointerOver={onNodeOver}
          onPointerMove={onNodeOver}
          onPointerOut={() => {
            if (scrollSignal.act === 6) setHoveredNode(null)
          }}
          onClick={onNodeClick}
        >
          <icosahedronGeometry args={[1, quality.level === 'LITE' ? 1 : 2]} />
          <shaderMaterial
            ref={materialRef}
            uniforms={uniforms}
            vertexShader={NODE_VERTEX}
            fragmentShader={NODE_FRAGMENT}
            vertexColors
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </instancedMesh>
      </Select>
      <mesh
        position={[0, 0, -3.2]}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerLeave={stopDrag}
      >
        <planeGeometry args={[24, 15]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      {hoveredNode ? <NodeLabel node={hoveredNode} /> : null}
      {focusedNode ? <FocusReticle node={focusedNode} updateEveryNthFrame={quality.updateEveryNthFrame} /> : null}
      <pointLight position={[0, 0, 2]} color="#35F2FF" intensity={4.5} distance={15} />
    </ActLayer>
  )
}

export { NODE_INDEX }
