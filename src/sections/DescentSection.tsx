import { SplitText } from '../components/SplitText'
import { ACT_BY_ID } from '../config'

const transmissions = [
  ['COORDINATE COLLAPSE', 'Δ 00.0042'],
  ['ARCHIVE SHELL', 'BREACHED'],
  ['CARRIER DENSITY', '∞ / M³'],
  ['WITNESS COUNT', '01'],
] as const

export function DescentSection() {
  const act = ACT_BY_ID.descent
  return (
    <section id="descent" className="descent" data-act="2" aria-labelledby="descent-title">
      <div className="descent__sticky">
        <div className="descent__iris" aria-hidden="true"><i /><i /><i /></div>
        <div className="descent__title" data-split>
          <SplitText as="h2" id="descent-title" className="section-title">{act.title.join(' ')}</SplitText>
          <p data-reveal>{act.subtitle}</p>
        </div>
        <div className="descent__logs" aria-hidden="true">
          {transmissions.map(([label, value], index) => (
            <div key={label} style={{ '--depth': index } as React.CSSProperties}>
              <span>{label}</span><b>{value}</b>
            </div>
          ))}
        </div>
        <svg className="descent__vector" viewBox="0 0 800 800" fill="none" aria-hidden="true">
          <path data-vector-path data-vector-morph d="M38 617C176 625 231 516 310 397C403 258 511 163 759 191" />
          <path data-vector-path data-vector-target d="M97 714C257 662 296 501 373 397C462 277 578 255 731 126" />
          <circle data-vector-orb cx="38" cy="617" r="7" />
        </svg>
        <span className="descent__depth mono" data-scramble aria-hidden="true">{act.signalCode}</span>
      </div>
    </section>
  )
}
