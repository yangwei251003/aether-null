import { useEffect, useRef, useState } from 'react'
import { getQualityProfile } from '../config'
import { pointerSignal } from '../runtime/signals'
import type { QualityLevel } from '../types'

export function CustomCursor({ quality, reducedMotion }: { quality: QualityLevel; reducedMotion: boolean }) {
  const trailCount = reducedMotion ? 0 : getQualityProfile(quality).particles.cursorTrail
  const [finePointer, setFinePointer] = useState(
    () => window.matchMedia('(hover: hover) and (pointer: fine)').matches,
  )
  const core = useRef<HTMLDivElement>(null)
  const follower = useRef<HTMLDivElement>(null)
  const trails = useRef<Array<HTMLSpanElement | null>>([])

  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => setFinePointer(query.matches)
    query.addEventListener('change', update)
    update()
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    pointerSignal.down = false
    if (reducedMotion || !finePointer) {
      pointerSignal.speed = 0
      pointerSignal.normalizedX = 0
      pointerSignal.normalizedY = 0
      return
    }
    let previousX = 0
    let previousY = 0
    let trailIndex = 0
    let lastTrailAt = 0

    const onPointerMove = (event: PointerEvent) => {
      const dx = event.clientX - previousX
      const dy = event.clientY - previousY
      const speed = Math.min(1, Math.hypot(dx, dy) / 40)
      previousX = event.clientX
      previousY = event.clientY
      pointerSignal.x = event.clientX
      pointerSignal.y = event.clientY
      pointerSignal.normalizedX = (event.clientX / window.innerWidth) * 2 - 1
      pointerSignal.normalizedY = -(event.clientY / window.innerHeight) * 2 + 1
      pointerSignal.speed = speed
      core.current?.style.setProperty('transform', `translate3d(${event.clientX}px, ${event.clientY}px, 0) scaleX(${1 + speed * 0.8})`)
      follower.current?.style.setProperty('transform', `translate3d(${event.clientX}px, ${event.clientY}px, 0)`)

      if (trailCount > 0 && event.timeStamp - lastTrailAt > 22) {
        const trail = trails.current[trailIndex]
        if (trail) {
          trail.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) scale(${0.35 + speed})`
          trail.animate(
            [{ opacity: 0.55 }, { opacity: 0, transform: `translate3d(${event.clientX}px, ${event.clientY}px, 0) scale(0)` }],
            { duration: 560, easing: 'cubic-bezier(.16,1,.3,1)' },
          )
        }
        trailIndex = (trailIndex + 1) % trailCount
        lastTrailAt = event.timeStamp
      }
    }
    const onPointerDown = () => { pointerSignal.down = true }
    const resetPointer = () => { pointerSignal.down = false }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointerup', resetPointer, { passive: true })
    window.addEventListener('pointercancel', resetPointer, { passive: true })
    window.addEventListener('blur', resetPointer)
    return () => {
      resetPointer()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', resetPointer)
      window.removeEventListener('pointercancel', resetPointer)
      window.removeEventListener('blur', resetPointer)
    }
  }, [finePointer, reducedMotion, trailCount])

  return (
    <div className="cursor-system" aria-hidden="true">
      <div ref={follower} className="cursor-follower" />
      <div ref={core} className="cursor-core" />
      {Array.from({ length: trailCount }, (_, index) => (
        <span key={index} ref={(node) => { trails.current[index] = node }} className="cursor-trail" />
      ))}
    </div>
  )
}
