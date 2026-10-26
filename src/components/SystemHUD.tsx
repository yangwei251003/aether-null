import { ArrowsClockwise, Gauge, SpeakerHigh, SpeakerSlash, TestTube } from '@phosphor-icons/react'
import { SITE_METADATA, SYSTEM_NAVIGATION } from '../config'
import { navigationSignal } from '../runtime/signals'

export type HUDQuality = 'ultra' | 'balanced' | 'lite'

type SystemHUDProps = {
  activeAct: number
  audioEnabled: boolean
  audioVolume: number
  quality: HUDQuality
  qualityLocked?: boolean
  qualityLockReason?: string
  onToggleAudio: () => void
  onAudioVolumeChange: (volume: number) => void
  onCycleQuality: () => void
  onOpenLab: () => void
}

export function SystemHUD({ activeAct, audioEnabled, audioVolume, quality, qualityLocked = false, qualityLockReason = 'active performance preference', onToggleAudio, onAudioVolumeChange, onCycleQuality, onOpenLab }: SystemHUDProps) {
  const jump = (id: string) => {
    const target = document.getElementById(id)
    if (!target) return
    if (navigationSignal.scrollTo) navigationSignal.scrollTo(target)
    else target.scrollIntoView({ behavior: 'auto', block: 'start' })
  }
  return (
    <header className="system-hud">
      <button className="system-hud__brand magnetic" type="button" onClick={() => jump('awakening')} aria-label="Return to Aether Core">
        <span className="brand-mark"><i /><i /><i /></span>
        <span>{SITE_METADATA.displayName}</span>
      </button>
      <nav aria-label="Archive chapters">
        {SYSTEM_NAVIGATION.map(({ label, anchor, act }) => (
          <button type="button" key={anchor} aria-current={activeAct === act ? 'step' : undefined} onClick={() => jump(anchor)}>
            {label}
          </button>
        ))}
      </nav>
      <div className="system-hud__controls">
        <div className="audio-control" data-audio-state={audioEnabled ? 'live' : 'muted'}>
          <button type="button" className="icon-button" onClick={onToggleAudio} aria-label={audioEnabled ? 'Mute archive audio' : 'Enable archive audio'}>
            {audioEnabled ? <SpeakerHigh weight="thin" /> : <SpeakerSlash weight="thin" />}
          </button>
          <label className="audio-control__volume">
            <span className="mono">ARCHIVE VOLUME</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={audioVolume}
              onChange={(event) => onAudioVolumeChange(Number(event.target.value))}
              aria-label="Archive audio volume"
              aria-valuetext={`${Math.round(audioVolume * 100)} percent`}
            />
            <output aria-hidden="true">{Math.round(audioVolume * 100).toString().padStart(2, '0')}</output>
          </label>
        </div>
        <button type="button" className="quality-button" disabled={qualityLocked} onClick={onCycleQuality} aria-label={qualityLocked ? `Rendering quality ${quality}. Locked by ${qualityLockReason}` : `Rendering quality ${quality}. Click to change`}>
          <Gauge weight="thin" />
          <span>{quality.toUpperCase()}</span>
        </button>
        <button type="button" className="icon-button system-button" onClick={onOpenLab} aria-label="Open hidden specimen lab">
          <TestTube weight="thin" />
        </button>
      </div>
      <div className="system-hud__progress" style={{ '--chapter': activeAct } as React.CSSProperties}>
        <ArrowsClockwise weight="thin" />
        <span>{String(Math.max(1, activeAct)).padStart(2, '0')} / 07</span>
      </div>
    </header>
  )
}
