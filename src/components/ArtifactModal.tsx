import { X } from '@phosphor-icons/react'
import { useRef } from 'react'
import { flushSync } from 'react-dom'
import { FEATURE_FLAGS } from '../config'
import type { ArtifactDatum } from '../types'
import { useDialogLifecycle } from './useDialogLifecycle'

type ArtifactModalProps = {
  artifact: ArtifactDatum | null
  onClose: () => void
}

export function ArtifactModal({ artifact, onClose }: ArtifactModalProps) {
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const close = () => {
    if (!artifact) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const visual = document.querySelector<HTMLElement>(`[data-artifact-id="${artifact.id}"] [data-artifact-visual]`)
    if (!FEATURE_FLAGS.artifactViewTransitions || reducedMotion || !document.startViewTransition || !visual) {
      delete document.documentElement.dataset.artifactMorph
      onClose()
      return
    }

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
      delete document.documentElement.dataset.artifactMorph
    }
    try {
      const transition = document.startViewTransition(() => {
        visual.style.viewTransitionName = 'artifact-morph'
        flushSync(onClose)
      })
      cleanupTimer = window.setTimeout(() => {
        cleanup()
        try { transition.skipTransition() } catch { /* already settled */ }
      }, 1_200)
      void transition.ready.then(cleanup, cleanup)
      void transition.finished.then(cleanup, cleanup)
    } catch {
      cleanup()
      onClose()
    }
  }

  useDialogLifecycle({
    open: Boolean(artifact),
    dialogRef: panelRef,
    initialFocusRef: closeRef,
    onClose: close,
  })

  if (!artifact) return null
  return (
    <div className="artifact-modal">
      <div
        className="artifact-modal__backdrop"
        onMouseDown={(event) => event.preventDefault()}
        onClick={close}
        aria-hidden="true"
      />
      <article
        ref={panelRef}
        className="artifact-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="artifact-modal-title"
        aria-describedby="artifact-modal-description"
        tabIndex={-1}
        style={{ '--artifact-index': Number(artifact.catalogue.match(/\d+/)?.[0] ?? 1) } as React.CSSProperties}
      >
        <button ref={closeRef} className="artifact-modal__close icon-button" type="button" onClick={close} aria-label="Close artifact detail">
          <X weight="thin" />
        </button>
        <div className={`artifact-sigil artifact-sigil--${artifact.geometry}`} aria-hidden="true" style={{ viewTransitionName: 'artifact-morph' }}>
          <i /><i /><i /><i />
        </div>
        <div className="artifact-modal__content">
          <p className="mono">{artifact.catalogue}</p>
          <h2 id="artifact-modal-title">{artifact.title}</h2>
          <p className="artifact-modal__subtitle">{artifact.subtitle}</p>
          <p id="artifact-modal-description">{artifact.longDescription}</p>
          <dl>
            {Object.entries(artifact.data).map(([key, value]) => (
              <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
            ))}
          </dl>
          <button className="text-button magnetic" type="button" onClick={close}>RETURN TO VAULT</button>
        </div>
      </article>
    </div>
  )
}
