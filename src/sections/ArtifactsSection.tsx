import { ArrowUpRight } from '@phosphor-icons/react'
import { flushSync } from 'react-dom'
import { ACT_BY_ID, artifacts, FEATURE_FLAGS } from '../config'
import type { ArtifactDatum } from '../types'
import { SplitText } from '../components/SplitText'

type ArtifactsSectionProps = {
  onInspect: (artifact: ArtifactDatum) => void
}

export function ArtifactsSection({ onInspect }: ArtifactsSectionProps) {
  const act = ACT_BY_ID.artifacts
  const inspect = (artifact: ArtifactDatum, trigger: HTMLButtonElement) => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const visual = trigger.closest<HTMLElement>('[data-artifact-id]')?.querySelector<HTMLElement>('[data-artifact-visual]') ?? null
    if (!FEATURE_FLAGS.artifactViewTransitions || reducedMotion || !document.startViewTransition || !visual) {
      onInspect(artifact)
      return
    }

    visual.style.viewTransitionName = 'artifact-morph'
    document.documentElement.dataset.viewTransition = 'artifact'
    document.documentElement.dataset.artifactMorph = 'shared'
    let cleanupTimer = 0
    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      window.clearTimeout(cleanupTimer)
      visual.style.removeProperty('view-transition-name')
      delete document.documentElement.dataset.viewTransition
    }
    try {
      const transition = document.startViewTransition(() => {
        visual.style.viewTransitionName = 'none'
        flushSync(() => onInspect(artifact))
      })
      cleanupTimer = window.setTimeout(() => {
        cleanup()
        try { transition.skipTransition() } catch { /* already settled */ }
      }, 1_200)
      void transition.ready.then(cleanup, cleanup)
      void transition.finished.then(cleanup, cleanup)
    } catch {
      cleanup()
      delete document.documentElement.dataset.artifactMorph
      onInspect(artifact)
    }
  }

  return (
    <section id="artifacts" className="artifacts" data-act="3" aria-labelledby="artifacts-title">
      <div className="artifacts__intro">
        <p className="chapter-label mono">{act.eyebrow}</p>
        <div data-split><SplitText as="h2" id="artifacts-title" className="section-title">{act.title.join(' ')}</SplitText></div>
        <p data-reveal>{act.subtitle}</p>
      </div>
      <div className="artifacts__stage">
        <div className="artifacts__track">
          {artifacts.map((artifact, index) => (
            <article className={`artifact-card artifact-card--${artifact.geometry}`} key={artifact.id} data-artifact-id={artifact.id} data-testid={`artifact-${artifact.id}`}>
              <div className="artifact-card__visual" data-artifact-visual aria-hidden="true">
                <div className="artifact-card__field"><i /><i /><i /></div>
                <div className="artifact-card__shape"><i /><i /><i /><i /></div>
                <span className="artifact-card__number">0{index + 1}</span>
              </div>
              <div className="artifact-card__copy">
                <p className="mono">{artifact.catalogue}</p>
                <h3>{artifact.title}</h3>
                <p>{artifact.description}</p>
                <button type="button" className="artifact-card__action magnetic" onClick={(event) => inspect(artifact, event.currentTarget)}>
                  INSPECT SPECIMEN <ArrowUpRight weight="thin" />
                </button>
              </div>
            </article>
          ))}
          <div className="artifact-card artifact-card--exit" aria-hidden="true">
            <div className="vault-aperture"><i /><i /><i /></div>
            <p>THE VAULT REMEMBERS YOU</p>
          </div>
        </div>
      </div>
    </section>
  )
}
