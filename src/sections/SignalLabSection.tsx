import { Lightning, WaveSine } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { aetherAudio } from '../audio/AetherAudio'
import { ACT_BY_ID } from '../config'
import { SIGNAL_LAB, scoreSignal } from '../config/signal-lab'
import { useAetherStore } from '../store'
import type { SignalParameterId } from '../types'

type Params = Record<SignalParameterId, number>

const initialParams: Params = {
  frequency: SIGNAL_LAB.parameters.frequency.initial,
  coherence: SIGNAL_LAB.parameters.coherence.initial,
  entropy: SIGNAL_LAB.parameters.entropy.initial,
}

const parameterOrder: SignalParameterId[] = ['frequency', 'coherence', 'entropy']

type SignalLabSectionProps = {
  onLock: (signalId: string) => void
}

export function SignalLabSection({ onLock }: SignalLabSectionProps) {
  const act = ACT_BY_ID['signal-lab']
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const paramsRef = useRef<Params>(initialParams)
  const pointerRef = useRef({ x: 0, y: 0, active: false, repel: false })
  const redrawRef = useRef<(() => void) | null>(null)
  const [params, setParams] = useState<Params>(initialParams)
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const gameStatus = useAetherStore((state) => state.game.status)
  const signalId = useAetherStore((state) => state.game.signalId) ?? 'UNRESOLVED'
  const locked = gameStatus === 'locked'

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    media.addEventListener('change', update)
    update()
    return () => media.removeEventListener('change', update)
  }, [])

  const alignment = useMemo(() => scoreSignal(params), [params])

  useEffect(() => {
    paramsRef.current = params
    aetherAudio.setSignalParams({
      frequency: (params.frequency / SIGNAL_LAB.parameters.frequency.max) * 100,
      coherence: params.coherence * 100,
      entropy: params.entropy * 100,
    })
    if (reducedMotion) requestAnimationFrame(() => redrawRef.current?.())
  }, [params, reducedMotion])

  useEffect(() => {
    if (gameStatus !== 'idle') return
    const reset = { ...initialParams }
    paramsRef.current = reset
    setParams(reset)
  }, [gameStatus])

  useEffect(() => {
    if (gameStatus === 'locked' || alignment < SIGNAL_LAB.successThreshold) return
    const timer = window.setTimeout(() => {
      const id = useAetherStore.getState().lockSignal()
      if (!id) return
      aetherAudio.chirp(true)
      aetherAudio.cue('signal-locked')
      aetherAudio.impact(0.72)
      onLock(id)
    }, SIGNAL_LAB.lockHoldMs)
    return () => window.clearTimeout(timer)
  }, [alignment, gameStatus, onLock])

  useEffect(() => {
    const canvas = canvasRef.current
    const section = sectionRef.current
    if (!canvas || !section) return
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) return
    let active = false
    let animation = 0
    let width = 0
    let height = 0
    const particleCount = reducedMotion ? 36 : window.innerWidth < 768 ? 72 : 190
    const particles = Array.from({ length: particleCount }, (_, index) => ({
      x: Math.random(), y: Math.random(),
      vx: 0, vy: 0,
      phase: (index / particleCount) * Math.PI * 2,
      size: 0.4 + Math.random() * 1.6,
    }))

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio, 1.6)
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = (time: number) => {
      if (!active) return
      const current = paramsRef.current
      const coherence = current.coherence
      const entropy = current.entropy
      const frequency = current.frequency
      context.clearRect(0, 0, width, height)
      const gradient = context.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.55)
      gradient.addColorStop(0, `rgba(81, 242, 255, ${0.05 + coherence * 0.09})`)
      gradient.addColorStop(0.45, `rgba(254, 72, 190, ${entropy * 0.025})`)
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)
      context.globalCompositeOperation = 'lighter'

      particles.forEach((particle, index) => {
        const px = particle.x * width
        const py = particle.y * height
        const centerAngle = Math.atan2(height * 0.5 - py, width * 0.5 - px)
        const wave = Math.sin(time * 0.001 * (0.5 + frequency / 80) + particle.phase)
        particle.vx += Math.cos(centerAngle + wave * entropy) * coherence * 0.00009
        particle.vy += Math.sin(centerAngle + wave * entropy) * coherence * 0.00009
        particle.vx += (Math.random() - 0.5) * entropy * 0.00032
        particle.vy += (Math.random() - 0.5) * entropy * 0.00032

        if (pointerRef.current.active) {
          const dx = pointerRef.current.x / width - particle.x
          const dy = pointerRef.current.y / height - particle.y
          const distance = Math.max(0.02, Math.hypot(dx, dy))
          const force = Math.min(0.0018, 0.000032 / distance)
          particle.vx += (dx / distance) * force * (pointerRef.current.repel ? -1 : 1)
          particle.vy += (dy / distance) * force * (pointerRef.current.repel ? -1 : 1)
        }
        particle.vx *= 0.975 - coherence * 0.012
        particle.vy *= 0.975 - coherence * 0.012
        particle.x = (particle.x + particle.vx + 1) % 1
        particle.y = (particle.y + particle.vy + 1) % 1

        const alpha = 0.24 + coherence * 0.68
        context.fillStyle = index % 11 === 0 ? `rgba(255,104,202,${alpha})` : `rgba(116,244,255,${alpha})`
        context.beginPath()
        context.arc(particle.x * width, particle.y * height, particle.size * (1 + coherence), 0, Math.PI * 2)
        context.fill()
      })
      context.globalCompositeOperation = 'source-over'
      if (!reducedMotion) animation = requestAnimationFrame(draw)
    }
    redrawRef.current = () => draw(performance.now())

    const observer = new IntersectionObserver(([entry]) => {
      const nextActive = entry.isIntersecting
      if (nextActive && !active) {
        active = true
        animation = requestAnimationFrame(draw)
      } else if (!nextActive && active) {
        active = false
        cancelAnimationFrame(animation)
      }
    }, { rootMargin: '15% 0px' })

    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointerRef.current.x = event.clientX - rect.left
      pointerRef.current.y = event.clientY - rect.top
      pointerRef.current.active = true
      pointerRef.current.repel = event.buttons === 2 || event.shiftKey
    }
    const onLeave = () => { pointerRef.current.active = false }
    const onContext = (event: MouseEvent) => event.preventDefault()
    resize()
    observer.observe(section)
    window.addEventListener('resize', resize)
    canvas.addEventListener('pointermove', onPointer)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('contextmenu', onContext)
    return () => {
      active = false
      cancelAnimationFrame(animation)
      observer.disconnect()
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('pointermove', onPointer)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('contextmenu', onContext)
      redrawRef.current = null
    }
  }, [reducedMotion])

  const update = (id: SignalParameterId, value: number) => {
    setParams((current) => ({ ...current, [id]: value }))
    const store = useAetherStore.getState()
    if (store.game.status === 'idle') store.beginSignalCalibration()
    store.setSignalParameter(id, value)
  }

  const autoAlign = () => {
    setParams({
      frequency: SIGNAL_LAB.parameters.frequency.target,
      coherence: SIGNAL_LAB.parameters.coherence.target,
      entropy: SIGNAL_LAB.parameters.entropy.target,
    })
    const store = useAetherStore.getState()
    if (store.game.status === 'idle') store.beginSignalCalibration()
    parameterOrder.forEach((id) => store.setSignalParameter(id, SIGNAL_LAB.parameters[id].target))
    aetherAudio.chirp(false)
  }

  return (
    <section ref={sectionRef} id="signal-lab" className={`signal-lab ${locked ? 'is-locked' : ''}`} data-act="4" aria-labelledby="signal-lab-title">
      <div className="signal-lab__head">
        <p className="chapter-label mono">{act.eyebrow}</p>
        <h2 id="signal-lab-title" className="section-title" data-reveal>{act.title[0]}<br />{act.title[1]}</h2>
        <p data-reveal>{act.narrative}</p>
      </div>
      <div className="signal-instrument">
        <canvas ref={canvasRef} className="signal-instrument__canvas" aria-label="Interactive signal particle field" />
        <div className="signal-instrument__scope" aria-hidden="true">
          <i /><i /><i />
          <span>{locked ? 'LOCKED' : 'SEARCHING'}</span>
        </div>
        <div className="signal-instrument__readout">
          <span>ALIGNMENT</span>
          <strong>{Math.round(alignment * 100).toString().padStart(2, '0')}%</strong>
          <small>{signalId}</small>
        </div>
        {locked && signalId ? <p className="sr-only" role="status">Signal locked. Signal ID {signalId}.</p> : null}
        <div className="signal-instrument__spectrum" aria-hidden="true">
          {Array.from({ length: 34 }, (_, index) => (
            <i key={index} style={{ '--bar': `${10 + ((index * 17 + params.frequency * 1.7) % 72) * (0.35 + params.coherence * 0.65)}%` } as React.CSSProperties} />
          ))}
        </div>
      </div>
      <div className="signal-controls">
        {parameterOrder.map((id) => {
          const spec = SIGNAL_LAB.parameters[id]
          const normalized = (params[id] - spec.min) / (spec.max - spec.min)
          const target = (spec.target - spec.min) / (spec.max - spec.min)
          return (
            <label key={id} className="signal-control">
              <span><b>{spec.shortLabel}</b><em>{params[id].toFixed(spec.step < 0.1 ? 2 : 1)}{spec.unit}</em></span>
              <span className="signal-control__rail" style={{ '--value': normalized, '--target': target } as React.CSSProperties}>
                <input type="range" min={spec.min} max={spec.max} step={spec.step} value={params[id]} onChange={(event) => update(id, Number(event.target.value))} aria-label={spec.label} />
              </span>
            </label>
          )
        })}
        <button type="button" className="lab-align-button magnetic" onClick={autoAlign}>
          <WaveSine weight="thin" /> AUTO ALIGN
        </button>
      </div>
      <div className="signal-lock-burst" aria-hidden="true"><Lightning weight="thin" /></div>
    </section>
  )
}
