import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Alert, Badge, Group, MantineProvider, Modal, NativeSelect } from '@mantine/core'
import { IconArrowLeft, IconArrowRight, IconCalendar, IconChevronRight, IconCircleCheck, IconCreditCard,
  IconEdit, IconFileDescription, IconId, IconInfoCircle, IconLayoutSidebar, IconMapPin,
  IconMessageCircle, IconNotes, IconPhone, IconUserPlus, IconUsersGroup } from '@tabler/icons-react'
import { Button } from '../../../frontend/src/features/shared/Button'
import { ClientAvatar } from '../../../frontend/src/features/shared/ux'
import { createGymCrmTheme } from '../../../frontend/src/theme/createGymCrmTheme'
import { createSemanticVariables } from '../../../frontend/src/theme/semanticVariables'
import { defaultGreenProfile } from '../../../frontend/src/theme/profiles'
import { formatClientBirthDate, getClientAgeDisplayValue } from '../../../frontend/src/features/clients/clientBirthDate'
import { buildDraftClientName, type ClientFormValues } from '../../../frontend/src/features/clients/ClientManagement.form'
import '@mantine/core/styles.css'
import '@fontsource/onest/cyrillic-400.css'
import '@fontsource/onest/cyrillic-600.css'
import '@fontsource/onest/cyrillic-700.css'
import '@fontsource/onest/latin-400.css'
import '@fontsource/onest/latin-600.css'
import '@fontsource/onest/latin-700.css'
import { branches, demoPhoto, examples, fixture, groups, type Example } from './fixtures'
import { Photo, type PhotoValue } from './Photo'
import { PrototypeForm } from './PrototypeForm'
import './style.css'

const theme = createGymCrmTheme(defaultGreenProfile)
for (const [key, value] of Object.entries(createSemanticVariables(defaultGreenProfile))) {
  document.documentElement.style.setProperty(key, value)
}
const screens = {
  preview: { label: 'Краткая карточка', icon: IconLayoutSidebar },
  detail: { label: 'Полная карточка', icon: IconId },
  edit: { label: 'Редактирование', icon: IconEdit },
  create: { label: 'Новый клиент', icon: IconUserPlus },
}
type Screen = keyof typeof screens
const mobileLabels: Record<Screen, string> = { detail: 'Подробности', preview: 'Краткая', edit: 'Правка', create: 'Создание' }
function startScreen(): Screen {
  const key = location.hash.slice(1)
  return Object.hasOwn(screens, key) ? key as Screen : 'detail'
}
function Fact({ label, children, icon }: { label: string; children: ReactNode; icon: ReactNode }) {
  return <div className="fact"><dt>{icon}{label}</dt><dd>{children}</dd></div>
}
function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="section"><h2>{icon}{title}</h2><div>{children}</div></section>
}

function ExampleView({ example, changeExample }: { example: Example; changeExample: (example: Example) => void }) {
  const manage = example !== 'coach'
  const [screen, setScreen] = useState<Screen>(() => manage ? startScreen() : 'detail')
  const [client, setClient] = useState(() => fixture(example))
  const [hasHistory, setHasHistory] = useState(true)
  const [photo, setPhoto] = useState<PhotoValue>(() => ({
    src: ['photo','coach','upload'].includes(example) ? demoPhoto() : null, broken: example === 'broken',
  }))
  const [notice, setNotice] = useState('')
  const [boundary, setBoundary] = useState('')
  const failNextUpload = useRef(example === 'upload')
  const failNextSave = useRef(example === 'save')
  const heading = useRef<HTMLHeadingElement>(null)
  const focusEdit = useRef<HTMLButtonElement>(null)
  const focusOpen = useRef<HTMLButtonElement>(null)
  const nextFocus = useRef<'edit' | 'open' | 'title'>('title')
  const name = buildDraftClientName(client)
  const branch = branches.find(item => item.id === client.branchId)?.name
  const assigned = groups.filter(item => client.groupIds.includes(item.id))
  function go(to: Screen) {
    if (!manage && (to === 'edit' || to === 'create')) return
    nextFocus.current = screen === 'edit' && to === 'detail' ? 'edit' :
      screen === 'detail' && to === 'preview' ? 'open' : 'title'
    setNotice('')
    location.hash = to
    setScreen(to)
  }
  useEffect(() => {
    function sync() {
      const target = startScreen()
      setScreen(!manage && (target === 'edit' || target === 'create') ? 'detail' : target)
    }
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [manage])
  useEffect(() => {
    const target = nextFocus.current === 'edit' ? focusEdit.current :
      nextFocus.current === 'open' ? focusOpen.current : null
    const focusTarget = target || heading.current
    focusTarget?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [screen])
  const form = screen === 'edit' || screen === 'create'
  const nav = Object.entries(screens).filter(([key]) => manage || key === 'detail' || key === 'preview')
  const photoActions = <Photo value={photo} onChange={setPhoto} name={name} manage={manage} failNextUpload={failNextUpload}/>
  const status = manage && <Badge color="teal" variant="light" tt="none">Активный</Badge>
  const warning = 'Абонемент просрочен'
  const quick = screen === 'preview'
  function save(values: ClientFormValues) {
    if (screen === 'create') {
      setHasHistory(false)
      setPhoto({src: null, broken: false})
    }
    setClient(values)
    go('detail')
    setNotice(screen === 'create' ? 'Карточка клиента создана.' : 'Изменения сохранены.')
  }
  return <>
    <header className="bar"><div className="brand"><span className="brand-symbol"><IconUsersGroup size={20}/></span>K-4PRO</div>
      <span className="review-id">Прототип <b>TASK-018</b></span></header>
    <div className="layout">
      <aside className="sidebar" aria-label="Управление прототипом">
        <div className="nav-title">Экраны прототипа</div>
        <nav>{nav.map(([key, {label, icon: Icon}]) =>
          <button key={key} type="button" aria-current={key === screen ? 'page' : undefined} onClick={() => go(key as Screen)}>
            <Icon size={18}/>{label}</button>)}</nav>
        <NativeSelect className="mobile-nav" label="Экран" data={nav.map(([value]) => ({value,label: mobileLabels[value as Screen]}))}
          value={screen} onChange={e => go(e.target.value as Screen)}/>
        <NativeSelect className="example" label="Пример данных" value={example} onChange={e => changeExample(e.target.value as Example)}
          data={Object.entries(examples).map(([value,label]) => ({value,label}))}/>
      </aside>
      <main>
        {!form && <div className="crumb">Клиенты <IconChevronRight size={14}/>{screens[screen].label}</div>}
        {!form && <article className={'sheet identity' + (quick ? ' preview' : '')}>
          <header className="identity-header"><ClientAvatar aria-hidden name={name} src={quick && !photo.broken ? photo.src : null} radius="xl" size={60} color="brand"/>
            <div>
            <h1 ref={heading} tabIndex={-1}>{name}</h1></div>{status}</header>
          {notice && <p role="status" className="success"><IconCircleCheck size={16}/>{notice}</p>}
          {!manage && <Alert title="Доступ тренера" icon={<IconInfoCircle size={18}/>}>Видны фото, ФИО, рабочая заметка, назначенные группы и история посещений.</Alert>}
          <dl className="facts">
            {manage && <Fact label="Телефон" icon={<IconPhone/>}>{client.phone}</Fact>}
            {manage && <Fact label="Филиал" icon={<IconMapPin/>}>{branch}</Fact>}
            {!quick && client.birthDate && <Fact label="Дата рождения" icon={<IconCalendar/>}>
              {formatClientBirthDate(client.birthDate)} · {getClientAgeDisplayValue(client.birthDate,'2026-11-21')}</Fact>}
            {quick && assigned.length > 0 && <Fact label="Группы" icon={<IconUsersGroup/>}>{assigned.map(g => g.name + ' · ' + g.hallName).join(', ')}</Fact>}
            {quick && manage && client.contacts.length > 0 && <Fact label="Контакты" icon={<IconId/>}>{client.contacts.length}</Fact>}
          </dl>
          {!quick && photoActions}
          {example === 'professional' && hasHistory && <Alert title="Профессионал" icon={<IconInfoCircle size={18}/>}>Индивидуальный график подготовки к соревнованиям.</Alert>}
          {quick && manage && hasHistory && example !== 'professional' && <Alert color="yellow" title={warning} icon={<IconInfoCircle size={18}/>}>Нужно продлить абонемент.</Alert>}
          {quick && hasHistory && manage && <Section title="Последние события" icon={<IconNotes/>}>24 августа · Оформлен абонемент</Section>}
          <Group className="actions" gap="xs">
            {quick ? <>
              {manage && ['Оформить абонемент','Сообщение','Посещение'].map(label => <Button key={label} variant="secondary" onClick={() => go('detail')}>{label}</Button>)}
              <button ref={focusOpen} className="primary-button" onClick={() => go('detail')}>Открыть карточку <IconArrowRight size={16}/></button>
            </> : <>
              {manage && <button className="primary-button" ref={focusEdit} onClick={() => go('edit')}><IconEdit size={16}/>Редактировать</button>}
              {manage && ['Перевести','В архив'].map(label => <Button variant="secondary" key={label} onClick={() => setBoundary(label)}>{label}</Button>)}
              <Button variant="ghost" leftSection={<IconArrowLeft size={16}/>} onClick={() => go('preview')}>К краткой карточке</Button>
            </>}
          </Group>
        </article>}
        {screen === 'detail' && <div className="sheet records">
          {manage && <Section title="История абонемента" icon={<IconCreditCard/>}>
            {hasHistory ? <><div className="section-line"><strong>Месячный тестовый</strong><span className="warning">{warning}</span></div>
            <p>24 авг. — 23 сент. 2026 г. · 6 000 ₽</p></> : 'Покупок пока нет.'}
            <Group gap={8} mt={8}>{(hasHistory ? ['Новый абонемент','Продлить','Исправить'] : ['Новый абонемент']).map(label =>
              <Button key={label} variant="secondary" onClick={() => setBoundary(label)}>{label}</Button>)}</Group>
          </Section>}
          <Section title="История посещений" icon={<IconCalendar/>}>{example === 'coach'
            ? 'История пока не загружена. Записи появятся после загрузки данных.'
            : 'Отмеченных посещений пока нет.'}</Section>
          {client.notes && <Section title="Рабочая заметка" icon={<IconFileDescription/>}>{client.notes}</Section>}
          {manage && <Section title="Telegram" icon={<IconMessageCircle/>}><div className="section-line"><span>Клиент ещё не подключил Telegram.</span>
            <Group gap={4}><Button variant="ghost" onClick={() => setNotice('Статус Telegram обновлён.')}>Обновить</Button>
            <Button variant="secondary" onClick={() => setBoundary('Ссылка и QR')}>Ссылка и QR</Button></Group></div></Section>}
          {manage && client.contacts.length > 0 && <Section title="Контактные лица" icon={<IconId/>}>
            {client.contacts.map((c,i) => <p key={i}>{c.type} · {c.fullName} · {c.phone}</p>)}</Section>}
          <Section title="Группы клиента" icon={<IconUsersGroup/>}>
            {assigned.length ? assigned.map(g => <p key={g.id}>{g.name} · {g.hallName}</p>) : 'Группы пока не назначены.'}
            {manage && <Button mt={6} variant="secondary" onClick={() => go('edit')}>Изменить группы</Button>}
          </Section>
        </div>}
        {form && <><h1 ref={heading} tabIndex={-1} className="form-title">{screen === 'edit' ? 'Редактирование клиента' : 'Новый клиент'}</h1>
          <PrototypeForm key={screen} initial={screen === 'edit' ? client : null} photo={photoActions} onSave={save}
            onCancel={() => go(screen === 'edit' ? 'detail' : 'preview')} failNextSave={failNextSave}/></>}
      </main>
    </div>
    <Modal centered opened={!!boundary} onClose={() => setBoundary('')} title={boundary} closeButtonProps={{'aria-label':'Закрыть'}}>
      <p>Эта операция показана для контекста. В прототипе можно редактировать данные клиента и работать с фотографией.</p>
    </Modal>
  </>
}
function App() {
  const [example, setExample] = useState<Example>('empty')
  return <MantineProvider theme={theme}><ExampleView key={example} example={example} changeExample={setExample}/></MantineProvider>
}
createRoot(document.getElementById('root')!).render(<App/>)
