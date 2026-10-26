import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { aetherAudio } from '../audio/AetherAudio'
import { SITE_METADATA } from '../config'

const glyphs = 'A3THΞR/NULL01⌁∴◇+'

function ScrambleLine({ resolved }: { resolved: boolean }) {
  const target = `${SITE_METADATA.displayName} / ${SITE_METADATA.archiveId}`
  const [value, setValue] = useState(target.replace(/./g, '·'))

  useEffect(() => {
    let frame = 0
    const timer = window.setInterval(() => {
      const reveal = Math.min(target.length, Math.floor(frame / 2))
      setValue(
        target
          .split('')
          .map((character, index) => {
            if (character === ' ') return ' '
            if (index < reveal || resolved) return character
            return glyphs[Math.floor(Math.random() * glyphs.length)]
          })
          .join(''),
      )
      frame += 1
      if (resolved || reveal >= target.length) window.clearInterval(timer)
    }, 42)
    return () => window.clearInterval(timer)
  }, [resolved])

  return <span aria-label={target}>{value}</span>
}

type BootSequenceProps = {
  progress: number
  ready: boolean
  error: string | null
  onEnter: (audioEnabled: boolean) => void
}

export function BootSequence({ progress, ready, error, onEnter }: BootSequenceProps) {
  const [entering, setEntering] = useState(false)
  const coreRef = useRef<HTMLButtonElement>(null)
  const particles = useMemo(() => Array.from({ length: 24 }, (_, index) => ({
    angle: (index / 24) * 360 + Math.sin(index * 12.9898) * 9,
    radius: 6.2 + (index % 6) * 0.82,
    size: 1.5 + (index % 4) * 0.65,
    delay: -(index % 9) * 0.37,
  })), [])
  const ringStyle = useMemo(
    () => ({ '--boot-progress': `${progress * 3.6}deg` }) as React.CSSProperties,
    [progress],
  )

  const updateMagneticField = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (entering || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const core = coreRef.current
    if (!core) return
    const rect = core.getBoundingClientRect()
    const dx = event.clientX - rect.left - rect.width / 2
    const dy = event.clientY - rect.top - rect.height / 2
    core.style.setProperty('--boot-magnet-x', `${dx * 0.105}px`)
    core.style.setProperty('--boot-magnet-y', `${dy * 0.105}px`)
    core.querySelectorAll<HTMLElement>('.boot__magnetic-field i').forEach((particle, index) => {
      const pull = 0.06 + (index % 7) * 0.012
      particle.style.setProperty('--particle-pull-x', `${dx * pull}px`)
      particle.style.setProperty('--particle-pull-y', `${dy * pull}px`)
    })
  }

  const releaseMagneticField = () => {
    const core = coreRef.current
    if (!core) return
    core.style.setProperty('--boot-magnet-x', '0px')
    core.style.setProperty('--boot-magnet-y', '0px')
    core.querySelectorAll<HTMLElement>('.boot__magnetic-field i').forEach((particle) => {
      particle.style.setProperty('--particle-pull-x', '0px')
      particle.style.setProperty('--particle-pull-y', '0px')
    })
  }

  const enter = () => {
    if (!ready || entering) return
    setEntering(true)
    const audioUnlock = new AbortController()
    const audioAttempt = aetherAudio.unlock(audioUnlock.signal)
    const boundedAudio = new Promise<boolean>((resolve) => {
      let settled = false
      const timeout = window.setTimeout(() => {
        if (settled) return
        settled = true
        audioUnlock.abort()
        aetherAudio.setEnabled(false)
        resolve(false)
      }, 580)
      void audioAttempt.then((enabled) => {
        if (settled) {
          if (enabled) aetherAudio.setEnabled(false)
          return
        }
        settled = true
        window.clearTimeout(timeout)
        if (enabled) aetherAudio.impact(1)
        resolve(enabled)
      })
    })
    window.setTimeout(() => {
      void boundedAudio.then(onEnter)
    }, 620)
  }

  return (
    <div className={`boot ${entering ? 'is-entering' : ''}`} role="dialog" aria-label="Aether archive boot sequence">
      <div className="boot__scan" />
      <div className="boot__coordinates" aria-hidden="true">
        <span>Ω / CARRIER</span>
        <span>DEC / NULL</span>
        <span>EDGE / NULL</span>
      </div>
      <button
        ref={coreRef}
        className="boot__core magnetic"
        style={ringStyle}
        type="button"
        disabled={!ready}
        aria-label={ready ? 'Enter the signal and enable sound' : `Loading archive ${progress}%`}
        onClick={enter}
        onPointerMove={updateMagneticField}
        onPointerLeave={releaseMagneticField}
      >
        <span className="boot__magnetic-field" aria-hidden="true">
          {particles.map((particle, index) => (
            <i key={index} style={{
              '--particle-angle': `${particle.angle}deg`,
              '--particle-radius': `${particle.radius}rem`,
              '--particle-size': `${particle.size}px`,
              '--particle-delay': `${particle.delay}s`,
            } as React.CSSProperties} />
          ))}
        </span>
        <span className="boot__orbit boot__orbit--a" />
        <span className="boot__orbit boot__orbit--b" />
        <span className="boot__core-center">
          <strong key={progress} className="numeric-flip">{String(progress).padStart(3, '0')}</strong>
          <small>{ready ? 'READY' : 'LOADING'}</small>
        </span>
      </button>
      <div className="boot__copy">
        <p className="mono"><ScrambleLine resolved={ready} /></p>
        <h1>{ready ? SITE_METADATA.entryLabel : 'RECONSTRUCTING'}</h1>
        <p className="boot__status" aria-live="polite">
          {error ? `Fallback retained: ${error}` : ready ? 'Click to awaken audio and enter' : 'Resolving spatial archive'}
        </p>
      </div>
      <div className="boot__bar"><i style={{ transform: `scaleX(${progress / 100})` }} /></div>
    </div>
  )
}
