import type { MainActId } from '../types'

export function WebGLFallback({ act = 'boot' }: { act?: MainActId }) {
  return (
    <div className="webgl-fallback" data-fallback-act={act} aria-hidden="true">
      <div className="fallback-tunnel">
        {Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--item': index } as React.CSSProperties} />)}
      </div>
      <div className="fallback-orbit fallback-orbit--a" />
      <div className="fallback-orbit fallback-orbit--b" />
      <div className="fallback-core" />
      <div className="fallback-relics">{Array.from({ length: 5 }, (_, index) => <i key={index} style={{ '--item': index } as React.CSSProperties} />)}</div>
      <div className="fallback-horizon">{Array.from({ length: 3 }, (_, index) => <i key={index} style={{ '--item': index } as React.CSSProperties} />)}</div>
      <div className="fallback-network">
        {Array.from({ length: 24 }, (_, index) => (
          <i key={index} style={{ '--item': index, '--x': `${8 + ((index * 37) % 84)}%`, '--y': `${10 + ((index * 53) % 78)}%` } as React.CSSProperties} />
        ))}
      </div>
      <div className="fallback-gate">{Array.from({ length: 3 }, (_, index) => <i key={index} style={{ '--item': index } as React.CSSProperties} />)}</div>
      <div className="fallback-stars" />
    </div>
  )
}
