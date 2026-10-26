import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { prefersReducedMotion, scrollSignal } from '../runtime/signals'
import { damp } from './sceneMath'

type MaterialRecord = {
  material: THREE.Material
  baseOpacity: number
  baseDepthWrite: boolean
  opacityUniform: THREE.IUniform<number> | null
}

type ActLayerProps = {
  acts: readonly number[]
  children: ReactNode
  motionZ?: number
  groupRef?: RefObject<THREE.Group | null>
}

export function ActLayer({ acts, children, motionZ = 0.7, groupRef }: ActLayerProps) {
  const localRef = useRef<THREE.Group>(null)
  const rootRef = groupRef ?? localRef
  const fade = useRef(acts.includes(scrollSignal.act) ? 1 : 0)
  const records = useRef<MaterialRecord[]>([])

  useLayoutEffect(() => {
    const group = rootRef.current
    if (!group) return

    const nextRecords: MaterialRecord[] = []
    group.traverse((object) => {
      const renderable = object as THREE.Mesh
      if (!renderable.material) return
      const materials = Array.isArray(renderable.material)
        ? renderable.material
        : [renderable.material]

      for (const material of materials) {
        const shader = material as THREE.ShaderMaterial
        const opacityUniform = shader.uniforms?.uOpacity as THREE.IUniform<number> | undefined
        nextRecords.push({
          material,
          baseOpacity: material.opacity,
          baseDepthWrite: material.depthWrite,
          opacityUniform: opacityUniform ?? null,
        })
        material.transparent = true
        material.needsUpdate = true
      }
    })
    records.current = nextRecords

    return () => {
      records.current = []
    }
  }, [rootRef])

  useFrame((_, delta) => {
    const group = rootRef.current
    if (!group) return
    const active = acts.includes(scrollSignal.act)
    const progressShape = 0.86 + Math.sin(Math.PI * scrollSignal.actProgress) * 0.14
    const target = active ? progressShape : 0
    fade.current = prefersReducedMotion()
      ? target
      : damp(fade.current, target, active ? 5.2 : 7.4, delta)
    const opacity = fade.current

    if (!active && opacity <= 0.002) {
      fade.current = 0
      group.visible = false
      return
    }

    group.visible = opacity > 0.002
    const scale = 0.965 + opacity * 0.035
    group.scale.setScalar(scale)
    group.position.z = (1 - opacity) * motionZ

    const materialRecords = records.current
    for (let index = 0; index < materialRecords.length; index += 1) {
      const record = materialRecords[index]
      if (record.opacityUniform) record.opacityUniform.value = record.baseOpacity * opacity
      record.material.opacity = record.baseOpacity * opacity
      record.material.depthWrite = record.baseDepthWrite && opacity > 0.985
    }
  })

  return <group ref={rootRef}>{children}</group>
}
