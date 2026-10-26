import { ArrowClockwise, ArrowRight, TestTube } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { aetherAudio } from '../audio/AetherAudio'
import { ACT_BY_ID, PORTAL_CONFIG, SYSTEM_COPY } from '../config'
import { useAetherStore } from '../store'

type PortalSectionProps = {
  onComplete: () => void
  onRestart: () => void
  onEnterLab: () => void
  onViewSystem: () => void
}

export function PortalSection({ onComplete, onRestart, onEnterLab, onViewSystem }: PortalSectionProps) {
  const act = ACT_BY_ID.portal
  const buttonRef = useRef<HTMLButtonElement>(null)
  const chargeRef = useRef(0)
  const animationRef = useRef(0)
  const lastDisplayRef = useRef(0)
  const crossingTimerRef = useRef(0)
  const [displayCharge, setDisplayCharge] = useState(0)
  const [pointerHeld, setPointerHeld] = useState(false)
  const [actionsReady, setActionsReady] = useState(false)
  const portalStatus = useAetherStore((state) => state.portal.status)
  const crossing = portalStatus === 'crossing'
  const complete = portalStatus === 'complete'

  useEffect(() => {
    if (!complete || pointerHeld) {
      setActionsReady(false)
      return
    }
    // Keep replacement controls inert until after the completing pointer has
    // lifted; this prevents touch-release click-through into Restart/Lab.
    const timer = window.setTimeout(() => setActionsReady(true), 180)
    return () => window.clearTimeout(timer)
  }, [complete, pointerHeld])

  const stop = () => {
    cancelAnimationFrame(animationRef.current)
    animationRef.current = 0
    aetherAudio.setPortalCharge(0)
    buttonRef.current?.classList.remove('is-holding')
    if (useAetherStore.getState().portal.status !== 'complete' && chargeRef.current < 100) {
      chargeRef.current = 0
      setDisplayCharge(0)
      buttonRef.current?.style.setProperty('--charge', '0')
      useAetherStore.getState().cancelPortalCharge()
    }
  }

  const start = (event?: React.PointerEvent<HTMLButtonElement>) => {
    if (complete || crossing) return
    if (animationRef.current) return
    if (event) {
      setPointerHeld(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    useAetherStore.getState().startPortalCharge()
    buttonRef.current?.classList.add('is-holding')
    let previous = performance.now()
    const advance = (now: number) => {
      // Charge tracks real hold duration even when a low-end GPU drops frames.
      // Blur/pointer-cancel handlers stop the loop before background gaps accrue.
      const delta = Math.min(250, now - previous)
      previous = now
      chargeRef.current = Math.min(100, chargeRef.current + (delta * 100) / PORTAL_CONFIG.chargeDurationMs)
      buttonRef.current?.style.setProperty('--charge', `${chargeRef.current / 100}`)
      aetherAudio.setPortalCharge(chargeRef.current)
      if (now - lastDisplayRef.current > 80) {
        setDisplayCharge(Math.round(chargeRef.current))
        useAetherStore.getState().setPortalCharge(chargeRef.current / 100)
        lastDisplayRef.current = now
      }
      if (chargeRef.current >= 100) {
        animationRef.current = 0
        setDisplayCharge(100)
        const portal = useAetherStore.getState()
        portal.setPortalCharge(1)
        portal.beginPortalCrossing()
        aetherAudio.setPortalCharge(0)
        aetherAudio.cue('portal-cross', 1.1)
        aetherAudio.chirp(true)
        crossingTimerRef.current = window.setTimeout(onComplete, PORTAL_CONFIG.crossingDurationMs)
        return
      }
      animationRef.current = requestAnimationFrame(advance)
    }
    animationRef.current = requestAnimationFrame(advance)
  }

  useEffect(() => {
    if (portalStatus !== 'dormant') return
    chargeRef.current = 0
    setDisplayCharge(0)
    buttonRef.current?.style.setProperty('--charge', '0')
  }, [portalStatus])

  useEffect(() => {
    const onBlur = () => {
      setPointerHeld(false)
      stop()
    }
    const onPointerRelease = () => setPointerHeld(false)
    window.addEventListener('blur', onBlur)
    window.addEventListener('pointerup', onPointerRelease)
    window.addEventListener('pointercancel', onPointerRelease)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('pointerup', onPointerRelease)
      window.removeEventListener('pointercancel', onPointerRelease)
    }
  }, [])

  useEffect(() => () => {
    cancelAnimationFrame(animationRef.current)
    window.clearTimeout(crossingTimerRef.current)
    aetherAudio.setPortalCharge(0)
  }, [])

  return (
    <section id="portal" className={`portal ${crossing ? 'is-crossing' : ''} ${complete ? 'is-complete' : ''}`} data-act="7" data-portal-state={portalStatus} aria-labelledby="portal-title">
      <div className="portal__lightwell" aria-hidden="true">
        <i className="portal-ring portal-ring--outer" />
        <i className="portal-ring portal-ring--middle" />
        <i className="portal-ring portal-ring--inner" />
        <i className="portal-core" />
        {Array.from({ length: 28 }, (_, index) => <b key={index} style={{ '--ray': index } as React.CSSProperties} />)}
      </div>
      <div className="portal-crossing-flash" aria-hidden="true" />
      <div className="portal__copy">
        <p className="chapter-label mono">{act.eyebrow}</p>
        <h2 id="portal-title" className="section-title" data-reveal>{complete ? 'THE UNKNOWN IS OPEN' : <>{act.title[0]}<br />{act.title[1]}</>}</h2>
        <p data-reveal>{complete ? 'The archive has rewritten its final boundary.' : act.narrative}</p>
      </div>
      {!complete ? (
        <button
          ref={buttonRef}
          type="button"
          className="portal-charge magnetic"
          disabled={crossing}
          onPointerDown={start}
          onPointerUp={() => { setPointerHeld(false); stop() }}
          onPointerLeave={() => { setPointerHeld(false); stop() }}
          onPointerCancel={() => { setPointerHeld(false); stop() }}
          onLostPointerCapture={() => {
            if (useAetherStore.getState().portal.status !== 'complete') {
              setPointerHeld(false)
              stop()
            }
          }}
          onBlur={stop}
          onKeyDown={(event) => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) start() }}
          onKeyUp={(event) => { if (event.key === ' ' || event.key === 'Enter') stop() }}
          style={{ '--charge': 0 } as React.CSSProperties}
          aria-label="Hold to charge the portal"
        >
          <span>{crossing ? 'CROSSING THRESHOLD' : 'HOLD TO CHARGE'}</span><strong key={displayCharge} className="numeric-flip numeric-flip--inline">{displayCharge}%</strong>
        </button>
      ) : (
        <div className="portal__final-actions" aria-label="Portal complete actions" aria-busy={!actionsReady}>
          <button type="button" disabled={!actionsReady} onClick={onRestart}><ArrowClockwise weight="thin" /> {SYSTEM_COPY.restart}</button>
          <button type="button" disabled={!actionsReady} onClick={onEnterLab}><TestTube weight="thin" /> {SYSTEM_COPY.enterLab}</button>
          <button type="button" disabled={!actionsReady} onClick={onViewSystem}>{SYSTEM_COPY.viewSystem} <ArrowRight weight="thin" /></button>
        </div>
      )}
      <p className="portal__charge-readout mono">GATE::<span key={complete ? 'open' : displayCharge} className="numeric-flip numeric-flip--inline">{complete ? 'OPEN' : displayCharge.toString().padStart(3, '0')}</span></p>
      {complete ? (
        <p className="sr-only" role="status">
          {actionsReady ? 'Portal open. Final actions are available.' : 'Portal open. Final actions are preparing.'}
        </p>
      ) : crossing ? <p className="sr-only" role="status">Portal charged. Crossing the threshold.</p> : null}
    </section>
  )
}
