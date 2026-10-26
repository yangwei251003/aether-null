import { Crosshair } from '@phosphor-icons/react'
import { ACT_BY_ID, constellationNodes } from '../config'
import type { ConstellationNode } from '../types'

type ConstellationSectionProps = {
  focusedNode: string | null
  onFocusNode: (node: ConstellationNode) => void
}

export function ConstellationSection({ focusedNode, onFocusNode }: ConstellationSectionProps) {
  const major = constellationNodes.filter((node) => node.major)
  const act = ACT_BY_ID.constellation
  return (
    <section id="constellation" className="constellation" data-act="6" aria-labelledby="constellation-title">
      <div className="constellation__copy">
        <p className="chapter-label mono">{act.eyebrow} / {constellationNodes.length} LIVE NODES</p>
        <h2 id="constellation-title" className="section-title" data-reveal>{act.title[0]}<br />{act.title[1]}</h2>
        <p data-reveal>{act.narrative}</p>
      </div>
      <div className="constellation__viewport" data-testid="constellation-viewport">
        <div className="constellation__reticle" aria-hidden="true"><i /><i /><i /></div>
        <p className="constellation__hint mono">DRAG FIELD / SELECT JUNCTION</p>
        <ul className="constellation__node-list" aria-label="Major constellation nodes">
          {major.map((node) => (
            <li key={node.id}>
              <button type="button" className={focusedNode === node.id ? 'is-focused' : ''} onClick={() => onFocusNode(node)}>
                <Crosshair weight="thin" />
                <span><b>{node.label}</b><small>{node.code}</small></span>
              </button>
            </li>
          ))}
        </ul>
        <div className="constellation__progress" aria-hidden="true">
          {major.map((node) => <i key={node.id} className={focusedNode === node.id ? 'is-active' : ''} />)}
        </div>
      </div>
      {focusedNode ? (
        <aside className="node-focus" aria-live="polite">
          <small className="mono">FOCUSED SIGNAL</small>
          <strong>{major.find((node) => node.id === focusedNode)?.label}</strong>
          <p>{major.find((node) => node.id === focusedNode)?.description}</p>
        </aside>
      ) : null}
    </section>
  )
}
