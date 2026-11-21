import { Alert, Badge, Group } from '@mantine/core'
import { IconArrowRight, IconCreditCard, IconId, IconInfoCircle, IconMapPin, IconNotes, IconPhone, IconUsersGroup } from '@tabler/icons-react'
import type { Ref } from 'react'
import { Button } from '../../../frontend/src/features/shared/Button'
import { ClientAvatar } from '../../../frontend/src/features/shared/ux'

export type PreviewProps = {
  name: string
  src: string | null
  phone: string
  branch: string | undefined
  groupNames: string[]
  contacts: number
  manage: boolean
  professional: boolean
  hasHistory: boolean
  onOpen: () => void
}
type CardProps = PreviewProps & {
  variant: 'first' | 'new'
  embedded?: boolean
  titleRef?: Ref<HTMLHeadingElement>
  openRef?: Ref<HTMLButtonElement>
}
export function PreviewCard({ variant, embedded, titleRef, openRef, name, src, phone, branch,
  groupNames, contacts, manage, professional, hasHistory, onOpen }: CardProps) {
  const revised = variant === 'new'
  const Heading = embedded ? 'h3' : 'h1'
  const warning = manage && hasHistory && !professional
  const facts = [
    ...(!revised && manage ? [{ label: 'Телефон', value: phone, icon: IconPhone }] : []),
    ...(manage ? [{ label: 'Филиал', value: branch, icon: IconMapPin }] : []),
    ...(groupNames.length ? [{ label: 'Группы', value: groupNames.join(', '), icon: IconUsersGroup }] : []),
    ...(manage && contacts ? [{ label: 'Контакты', value: String(contacts), icon: IconId }] : []),
  ]
  const membership = warning && (revised
    ? <div className="membership-brief" role="note" aria-label="Состояние абонемента">
        <div className="membership-line"><strong><IconCreditCard size={18}/>На срок</strong><span className="warning">Абонемент просрочен</span></div>
        <p>Нужно продлить абонемент.</p>
      </div>
    : <Alert color="yellow" title="Абонемент просрочен" icon={<IconInfoCircle size={18}/>}>Нужно продлить абонемент.</Alert>)
  return <article className={'sheet identity preview' + (revised ? ' preview-new' : '')} aria-label={'Краткая карточка · ' + name}>
    <header className="identity-header">
      <ClientAvatar aria-hidden name={name} src={src} radius="xl" size={revised ? 48 : 60} color="brand"/>
      <div><Heading className="preview-name" ref={titleRef} tabIndex={-1}>{name}</Heading>
        {revised && manage && <p className="header-phone">{phone}</p>}</div>
      {manage && <Badge color="teal" variant="light" tt="none">Активный</Badge>}
    </header>
    {!manage && <Alert title="Доступ тренера" icon={<IconInfoCircle size={18}/>}>Видны фото, ФИО, рабочая заметка, назначенные группы и история посещений.</Alert>}
    {revised && membership}
    {facts.length > 0 && <dl className="facts">{facts.map(({label, value, icon: Icon}) =>
      <div className="fact" key={label}><dt><Icon/>{label}</dt><dd>{value}</dd></div>)}</dl>}
    {professional && hasHistory && <Alert title="Профессионал" icon={<IconInfoCircle size={18}/>}>Индивидуальный график подготовки к соревнованиям.</Alert>}
    {!revised && membership}
    {hasHistory && manage && <section className="section"><h2><IconNotes/>Последние события</h2>
      <div>24 августа · Оформлен абонемент</div></section>}
    <Group className="actions" gap="xs">
      {manage && ['Оформить абонемент','Сообщение','Посещение'].map(label =>
        <Button key={label} variant="secondary" onClick={onOpen}>{label}</Button>)}
      <button ref={openRef} className="primary-button" onClick={onOpen}>Открыть карточку <IconArrowRight size={16}/></button>
    </Group>
  </article>
}
