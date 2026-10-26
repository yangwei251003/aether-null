import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CAMERA_PATHS, CONSTELLATION_NODES, MOBILE_FALLBACK, PORTAL_CONFIG } from '../config'
import { pointerSignal, scrollSignal } from '../runtime/signals'
import { useAetherStore } from '../store'
import type { ActId, ConstellationNode } from '../types'
import { ACT_IDS, clamp01, damp, sampleCameraPath } from './sceneMath'

type CameraRigProps = {
  reducedMotion: boolean
  coarsePointer: boolean
}

const NODE_BY_ID = new Map(CONSTELLATION_NODES.map((node) => [node.id, node] as const))

export function CameraRig({ reducedMotion, coarsePointer }: CameraRigProps) {
  const focusedNode = useAetherStore((state) => state.node.focusedId)
  const labOpen = useAetherStore((state) => state.lab.open)
  const portal = useAetherStore((state) => state.portal)
  const targetPosition = useMemo(() => new THREE.Vector3(), [])
  const targetLook = useMemo(() => new THREE.Vector3(), [])
  const focusPosition = useMemo(() => new THREE.Vector3(), [])
  const lookMatrix = useMemo(() => new THREE.Matrix4(), [])
  const desiredQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const rollQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const zAxis = useMemo(() => new THREE.Vector3(0, 0, 1), [])
  const pointer = useRef({ x: 0, y: 0 })
  const cameraSample = useRef({ fov: 38, roll: 0, focusDistance: 8 })

  useFrame((state, delta) => {
    const camera = state.camera as THREE.PerspectiveCamera
    const index = Math.min(ACT_IDS.length - 1, Math.max(0, scrollSignal.act))
    const actId: ActId = labOpen ? 'specimen-lab' : ACT_IDS[index]
    const path = CAMERA_PATHS[actId]
    const progress = reducedMotion
      ? THREE.MathUtils.lerp(0.42, 0.55, scrollSignal.actProgress)
      : clamp01(scrollSignal.actProgress)
    const frame = sampleCameraPath(
      path.keyframes,
      progress,
      targetPosition,
      targetLook,
      cameraSample.current,
    )

    const pointerEnabled = !reducedMotion && !coarsePointer
    pointer.current.x = damp(
      pointer.current.x,
      pointerEnabled ? pointerSignal.normalizedX : 0,
      4.2,
      delta,
    )
    pointer.current.y = damp(
      pointer.current.y,
      pointerEnabled ? pointerSignal.normalizedY : 0,
      4.2,
      delta,
    )
    targetPosition.x += pointer.current.x * path.pointerInfluence[0]
    targetPosition.y += pointer.current.y * path.pointerInfluence[1]
    targetLook.x += pointer.current.x * path.pointerInfluence[0] * 0.22
    targetLook.y += pointer.current.y * path.pointerInfluence[1] * 0.18

    if (actId === 'constellation' && focusedNode) {
      const node = NODE_BY_ID.get(focusedNode) as ConstellationNode | undefined
      if (node) {
        targetLook.set(node.position[0], node.position[1], node.position[2])
        focusPosition.set(
          node.position[0] + 0.78,
          node.position[1] + 0.42,
          node.position[2] + (node.major ? 4.3 : 3.1),
        )
        targetPosition.lerp(focusPosition, 0.82)
      }
    }

    let cinematicFov = frame.fov
    if (actId === 'portal') {
      const charge = portal.status === 'charged' || portal.status === 'crossing' || portal.status === 'complete'
        ? 1
        : clamp01(portal.charge)
      const crossing = portal.status === 'crossing' || portal.status === 'complete'
      const crossingMix = crossing ? 1 : 0
      const motionScale = reducedMotion ? 0.16 : 1
      targetPosition.z -= (charge * PORTAL_CONFIG.camera.chargeDolly + crossingMix * PORTAL_CONFIG.camera.crossingDolly) * motionScale
      targetLook.z -= (charge * PORTAL_CONFIG.camera.chargeLookDepth + crossingMix * PORTAL_CONFIG.camera.crossingLookDepth) * motionScale
      cinematicFov += (charge * PORTAL_CONFIG.camera.chargeFovBoost + crossingMix * PORTAL_CONFIG.camera.crossingFovBoost) * motionScale
      if (!reducedMotion && charge > 0.02) {
        const shake = PORTAL_CONFIG.camera.shakeAmplitude * charge * charge * (crossing ? 1.8 : 1)
        targetPosition.x += Math.sin(state.clock.elapsedTime * 31) * shake
        targetPosition.y += Math.cos(state.clock.elapsedTime * 27) * shake * 0.72
      }
    }

    const lambda = -Math.log(Math.max(0.001, 1 - path.damping)) * 60
    if (reducedMotion) {
      camera.position.copy(targetPosition)
    } else {
      camera.position.x = damp(camera.position.x, targetPosition.x, lambda, delta)
      camera.position.y = damp(camera.position.y, targetPosition.y, lambda, delta)
      camera.position.z = damp(camera.position.z, targetPosition.z, lambda, delta)
    }

    lookMatrix.lookAt(camera.position, targetLook, camera.up)
    desiredQuaternion.setFromRotationMatrix(lookMatrix)
    const velocityRoll = reducedMotion
      ? 0
      : THREE.MathUtils.clamp(scrollSignal.velocity * -0.0014, -0.035, 0.035)
    const pathRoll = reducedMotion ? 0 : coarsePointer ? frame.roll * MOBILE_FALLBACK.cameraRollMultiplier : frame.roll
    rollQuaternion.setFromAxisAngle(zAxis, pathRoll + velocityRoll)
    desiredQuaternion.multiply(rollQuaternion)
    if (reducedMotion) camera.quaternion.copy(desiredQuaternion)
    else camera.quaternion.slerp(desiredQuaternion, 1 - Math.exp(-lambda * delta))

    const fov = reducedMotion ? cinematicFov : damp(camera.fov, cinematicFov, lambda * 0.72, delta)
    if (Math.abs(fov - camera.fov) > 0.001) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    state.scene.userData.aetherFocusDistance = frame.focusDistance
  }, -10)

  return null
}
