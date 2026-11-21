import { useState, type Ref } from 'react'
import { NativeSelect } from '@mantine/core'
import { PreviewCard, type PreviewProps } from './PreviewCard'
import type { Example } from './fixtures'
import { phoneUrl } from './PhoneReview'
import auditImage from '../../../processed/2026-11-20-interface-audit/05-client-card/mobile.jpg'

type Version = 'crm' | 'first' | 'new'
const names = { crm: 'Текущая CRM', first: 'Первый прототип', new: 'Новый вариант' } as const
export function PreviewComparison({ data, sample, auditAvailable, titleRef, returnVariant, openRef, left, setLeft, onOpen }: {
  data: PreviewProps; sample: Example; auditAvailable: boolean; titleRef: Ref<HTMLHeadingElement>
  openRef: Ref<HTMLButtonElement>; left: 'crm' | 'first'; setLeft: (value: 'crm' | 'first') => void
  returnVariant: 'first' | 'new'; onOpen: (variant: 'first' | 'new') => void
}) {
  const [single, setSingle] = useState<Version>(returnVariant)
  const baseline = auditAvailable ? left : 'first'
  const selected = single === 'crm' && !auditAvailable ? 'new' : single
  const choices: Version[] = auditAvailable ? ['crm','first','new'] : ['first','new']
  return <div className="comparison">
    <header className="compare-heading"><h1 ref={titleRef} tabIndex={-1}>Сравнение кратких карточек</h1>
      <a className="phone-entry" href={phoneUrl('both', sample)}>Сравнить на телефоне</a>
      <NativeSelect disabled={!auditAvailable} className="compare-desktop-select" label="С чем сравнить новый вариант" value={baseline}
        data={choices.filter(key => key !== 'new').map(value => ({value,label:names[value]}))}
        onChange={event => setLeft(event.target.value as 'crm' | 'first')}/>
    </header>
    <div className="compare-switch" role="group" aria-label="Версия карточки">
      {choices.map(key => <button key={key} aria-pressed={selected === key} onClick={() => setSingle(key)}>{names[key]}</button>)}
    </div>
    <div className="compare-grid" data-audit={baseline === 'crm'}>{choices.map(key =>
      <section key={key} aria-label={names[key]} className="compare-column" data-wide={key === baseline || key === 'new'} data-narrow={selected === key}>
        <div className="compare-label"><h2>{names[key]}</h2>
          <p>{key === 'crm' ? 'Снимок экрана · 20 ноября 2026' : key === 'first' ? 'Предупреждение после данных клиента' : 'Тип и состояние абонемента сразу под именем'}</p></div>
        {key === 'crm'
          ? <img className="audit-reference" src={auditImage} width="390" height="844" alt="Исходная карточка Алексеева: тип «На срок», предупреждение о просрочке, две отметки статуса, ноль контактов и отсутствие визитов."/>
          : <PreviewCard {...data} openRef={returnVariant === key ? openRef : undefined} embedded variant={key} onOpen={() => onOpen(key)}/>}
      </section>)}</div>
  </div>
}
