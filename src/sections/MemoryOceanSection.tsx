import { useRef } from 'react'
import { SplitText } from '../components/SplitText'
import { ACT_BY_ID } from '../config'

export function MemoryOceanSection() {
  const act = ACT_BY_ID['memory-ocean']
  const visual = useRef<HTMLDivElement>(null)
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--ripple-x', `${((event.clientX - rect.left) / rect.width) * 100}%`)
    event.currentTarget.style.setProperty('--ripple-y', `${((event.clientY - rect.top) / rect.height) * 100}%`)
  }

  return (
    <section id="memory-ocean" className="ocean" data-act="5" aria-labelledby="ocean-title">
      <div ref={visual} className="ocean__visual" onPointerMove={move} data-parallax="5">
        <picture>
          <source srcSet={`${import.meta.env.BASE_URL}assets/images/memory-ocean.avif`} type="image/avif" />
          <source srcSet={`${import.meta.env.BASE_URL}assets/images/memory-ocean.webp`} type="image/webp" />
          <img src={`${import.meta.env.BASE_URL}assets/images/memory-ocean.webp`} loading="lazy" decoding="async" alt="A luminous black wave turning into a star field" />
        </picture>
        <div className="ocean__refraction" aria-hidden="true" />
        <div className="ocean__starlift" aria-hidden="true" />
      </div>
      <div className="ocean__copy" data-split>
        <p className="chapter-label mono">{act.eyebrow}</p>
        <SplitText as="h2" id="ocean-title" className="section-title">{act.title.join(' ')}</SplitText>
        <p data-reveal>{act.narrative}</p>
      </div>
      <blockquote data-reveal>“We kept no history. We kept only the pressure it left behind.”</blockquote>
    </section>
  )
}
