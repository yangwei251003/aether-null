import { Gauge, SlidersHorizontal, X } from '@phosphor-icons/react'
import { Fragment, useEffect, useRef, useState } from 'react'
import type { HUDQuality } from './SystemHUD'
import { useDialogLifecycle } from './useDialogLifecycle'

export type LabSettings = {
  shader: 'spectral' | 'interference' | 'event-horizon'
  material: 'chrome' | 'iridescent' | 'refractive'
  field: 'attract' | 'repel' | 'vortex'
  theme: 'aether' | 'solar' | 'null' | 'pearl'
  timeScale: number
  particleMultiplier: number
  postProcessing: boolean
  postFxIntensity: number
  debug: boolean
}

type SpecimenLabProps = {
  open: boolean
  settings: LabSettings
  quality: HUDQuality
  qualityLocked?: boolean
  onClose: () => void
  onChange: (patch: Partial<LabSettings>) => void
  onQuality: (quality: HUDQuality) => void
}

const modes = {
  shader: ['spectral', 'interference', 'event-horizon'],
  material: ['chrome', 'iridescent', 'refractive'],
  field: ['attract', 'repel', 'vortex'],
  theme: ['aether', 'solar', 'null', 'pearl'],
} as const

export function SpecimenLab({ open, settings, quality, qualityLocked = false, onClose, onChange, onQuality }: SpecimenLabProps) {
  const [fps, setFps] = useState<number | null>(null)
  const [softwareRenderer, setSoftwareRenderer] = useState(false)
  const labRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useDialogLifecycle({
    open,
    dialogRef: labRef,
    initialFocusRef: closeRef,
    onClose,
  })

  useEffect(() => {
    if (!open) return
    setFps(null)
    const canvas = document.querySelector<HTMLCanvasElement>('.scene-layer canvas')
    const gl = canvas?.getContext('webgl2') ?? null
    const debug = gl?.getExtension('WEBGL_debug_renderer_info') ?? null
    const renderer = String(gl ? gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : '')
    const software = /swiftshader|llvmpipe|software/i.test(renderer)
    setSoftwareRenderer(software)
    // Software WebGL is invaluable for CI correctness, but its rAF throughput
    // is not a credible GPU performance number. Declare it instead of showing
    // a misleading 1 FPS; physical GPUs receive a two-window smoothed sample.
    if (software) return

    let frames = 0
    let animation = 0
    let previous = performance.now()
    const samples: number[] = []
    const sample = (now: number) => {
      frames += 1
      if (now - previous >= 1_000) {
        samples.push((frames * 1000) / (now - previous))
        if (samples.length > 3) samples.shift()
        if (samples.length >= 2) {
          setFps(Math.round(samples.reduce((total, value) => total + value, 0) / samples.length))
        }
        frames = 0
        previous = now
      }
      animation = requestAnimationFrame(sample)
    }
    animation = requestAnimationFrame(sample)
    return () => cancelAnimationFrame(animation)
  }, [open])

  return (
    <Fragment>
      {open ? (
        <div
          className="specimen-lab__backdrop"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}
      <aside
        ref={labRef}
        id="specimen-lab"
        className={`specimen-lab ${open ? 'is-open' : ''}`}
        role="dialog"
        aria-modal={open ? 'true' : undefined}
        aria-hidden={!open}
        aria-labelledby="specimen-lab-title"
        aria-describedby="specimen-lab-description"
        inert={!open}
        tabIndex={-1}
      >
        <div className="specimen-lab__head">
          <div>
            <SlidersHorizontal weight="thin" />
            <div className="specimen-lab__titles">
              <h2 id="specimen-lab-title">SPECIMEN LAB</h2>
              <small>LIVE SYSTEM OVERRIDES</small>
            </div>
          </div>
          <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="Close specimen lab"><X weight="thin" /></button>
        </div>
        <div className="specimen-lab__metrics mono" aria-label="Live rendering metrics">
          <span aria-label={softwareRenderer ? 'Software renderer detected; FPS is not representative' : fps === null ? 'FPS measuring' : `${fps} FPS`}><b>{softwareRenderer ? 'SW' : fps ?? '…'}</b> FPS</span><span><b>{Math.min(window.devicePixelRatio, quality === 'ultra' ? 2 : quality === 'balanced' ? 1.5 : 1).toFixed(1)}</b> DPR</span><span><b>{quality.toUpperCase()}</b> MODE</span>
        </div>
        {(Object.keys(modes) as Array<keyof typeof modes>).map((key) => (
          <fieldset key={key}>
            <legend>{key}</legend>
            <div className="segmented-control">
              {modes[key].map((value) => (
                <button type="button" key={value} className={settings[key] === value ? 'is-active' : ''} aria-pressed={settings[key] === value} onClick={() => onChange({ [key]: value })}>{value}</button>
              ))}
            </div>
          </fieldset>
        ))}
        <fieldset>
          <legend>quality</legend>
          <div className="segmented-control segmented-control--quality">
            {(['ultra', 'balanced', 'lite'] as HUDQuality[]).map((value) => <button type="button" key={value} disabled={qualityLocked && value !== 'lite'} className={quality === value ? 'is-active' : ''} aria-pressed={quality === value} onClick={() => onQuality(value)}>{value}</button>)}
          </div>
        </fieldset>
        <label className="lab-slider"><span>TIME SCALE <b>{settings.timeScale.toFixed(2)}×</b></span><input type="range" min="0.25" max="2" step="0.05" value={settings.timeScale} onChange={(event) => onChange({ timeScale: Number(event.target.value) })} /></label>
        <label className="lab-slider"><span>PARTICLE FIELD <b>{settings.particleMultiplier.toFixed(1)}×</b></span><input type="range" min="0.25" max="1.5" step="0.05" value={settings.particleMultiplier} onChange={(event) => onChange({ particleMultiplier: Number(event.target.value) })} /></label>
        <label className="lab-slider"><span>POST FX INTENSITY <b>{settings.postFxIntensity.toFixed(2)}×</b></span><input aria-label="Post processing intensity" type="range" min="0" max="1.5" step="0.05" value={settings.postFxIntensity} disabled={!settings.postProcessing} onChange={(event) => onChange({ postFxIntensity: Number(event.target.value) })} /></label>
        <div className="lab-toggles">
          <button type="button" className={settings.postProcessing ? 'is-active' : ''} aria-pressed={settings.postProcessing} onClick={() => onChange({ postProcessing: !settings.postProcessing })}><Gauge weight="thin" /> POST FX</button>
          <button type="button" className={settings.debug ? 'is-active' : ''} aria-pressed={settings.debug} onClick={() => onChange({ debug: !settings.debug })}>DEBUG FIELD</button>
        </div>
        <p id="specimen-lab-description" className="specimen-lab__note">Controls update live while preserving one stable WebGL context; immutable renderer flags are chosen at startup for the detected device.</p>
      </aside>
    </Fragment>
  )
}
