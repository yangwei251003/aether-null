import type { ArtifactDatum, ConstellationNode } from '../types'
import { ArtifactsSection } from './ArtifactsSection'
import { AwakeningSection } from './AwakeningSection'
import { ConstellationSection } from './ConstellationSection'
import { DescentSection } from './DescentSection'
import { MemoryOceanSection } from './MemoryOceanSection'
import { PortalSection } from './PortalSection'
import { SignalLabSection } from './SignalLabSection'

type NarrativeSectionsProps = {
  focusedNode: string | null
  onInspectArtifact: (artifact: ArtifactDatum) => void
  onFocusNode: (node: ConstellationNode) => void
  onSignalLock: (signalId: string) => void
  onPortalComplete: () => void
  onRestart: () => void
  onEnterLab: () => void
  onViewSystem: () => void
}

export function NarrativeSections(props: NarrativeSectionsProps) {
  return (
    <>
      <AwakeningSection />
      <DescentSection />
      <ArtifactsSection onInspect={props.onInspectArtifact} />
      <SignalLabSection onLock={props.onSignalLock} />
      <MemoryOceanSection />
      <ConstellationSection focusedNode={props.focusedNode} onFocusNode={props.onFocusNode} />
      <PortalSection onComplete={props.onPortalComplete} onRestart={props.onRestart} onEnterLab={props.onEnterLab} onViewSystem={props.onViewSystem} />
    </>
  )
}
