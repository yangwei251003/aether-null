import { SplitText } from '../components/SplitText'
import { ACT_BY_ID, SITE_METADATA } from '../config'

export function AwakeningSection() {
  const act = ACT_BY_ID.awakening
  const [statementLead, statementTail = ''] = act.subtitle.split(' IS ')
  return (
    <section id="awakening" className="awakening" data-act="1" aria-labelledby="awakening-title">
      <div className="awakening__sticky">
        <div className="awakening__coordinates mono" aria-hidden="true">
          <span>CORE / ALPHA</span><span>X 000.000</span><span>Y -73.913</span>
        </div>
        <div className="awakening__title" data-split>
          <SplitText as="h1" id="awakening-title" className="awakening__aether" variableTitle>{act.title[0]}</SplitText>
          <SplitText as="span" className="awakening__null">{act.title[1]}</SplitText>
        </div>
        <p className="awakening__statement" data-native-split>{statementLead}<br />IS {statementTail}</p>
        <p className="awakening__narrative" data-reveal>{act.narrative}</p>
        <div className="awakening__scroll-code mono" aria-hidden="true">
          <i /><span>{SITE_METADATA.scrollLabel}</span>
        </div>
        <div className="awakening__rings" aria-hidden="true"><i /><i /><i /></div>
      </div>
    </section>
  )
}
