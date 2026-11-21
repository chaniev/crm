import { useState } from 'react'
import { NativeSelect } from '@mantine/core'
import { examples, type Example } from './fixtures'

export const phoneVariants = { first: 'Первый прототип', new: 'С типом абонемента' } as const
export type PhoneVariant = keyof typeof phoneVariants
const sizes = { 360: 780, 390: 844, 420: 912, 440: 956 } as const
type Width = keyof typeof sizes

export function phoneUrl(variant: PhoneVariant | 'both', sample: Example, frame = false) {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('phone', variant)
  url.searchParams.set('sample', sample)
  if (frame) url.searchParams.set('frame', '1')
  url.hash = 'preview'
  return url.href
}

export function PhoneGallery({ sample, onSample }: { sample: Example; onSample: (sample: Example) => void }) {
  const [width, setWidth] = useState<Width>(390)
  return <main className="phone-gallery">
    <header className="gallery-heading"><div><span className="review-id">TASK-018</span>
      <h1>Краткая карточка на телефоне</h1></div>
      <div className="gallery-controls">
        <NativeSelect label="Размер экрана" value={width}
          data={Object.entries(sizes).map(([w,h]) => ({value:w,label:w + ' × ' + h}))}
          onChange={e => setWidth(Number(e.target.value) as Width)}/>
        <NativeSelect label="Пример данных" value={sample}
          data={Object.entries(examples).map(([value,label]) => ({value,label}))}
          onChange={e => onSample(e.target.value as Example)}/>
      </div>
    </header>
    <div className="phone-pair">
      {(Object.keys(phoneVariants) as PhoneVariant[]).map(key =>
        <section className="phone-panel" key={key} style={{width}}>
          <h2>{phoneVariants[key]}</h2>
          <iframe title={phoneVariants[key]} src={phoneUrl(key, sample, true)} width={width} height={sizes[width]}/>
        </section>)}
    </div>
  </main>
}
