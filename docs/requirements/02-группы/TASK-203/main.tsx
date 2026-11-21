import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Alert, Badge, Group, MantineProvider, Modal, Paper, Select, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconAlertCircle, IconArrowLeft, IconCalendar, IconCheck, IconDots, IconUsers, IconUsersGroup } from '@tabler/icons-react'
import '@fontsource/onest/400.css'
import '@fontsource/onest/500.css'
import '@fontsource/onest/600.css'
import '@fontsource/onest/700.css'
import '@mantine/core/styles.css'
import '../../../../frontend/src/App.css'
import { gymCrmTheme, createSemanticVariables, createFoundationVariables, themeProfiles, getSemanticToneComponentProps } from '../../../../frontend/src/theme'
import { Button, LoadingState, PageLayout, PageSection } from '../../../../frontend/src/features/shared/ux'
import { GroupForm } from '../../../../frontend/src/features/groups/GroupForm'
import { PrototypeGroupForm } from './PrototypeGroupForm'
import type { GroupFormValues } from '../../../../frontend/src/features/groups/groupFormMapping'
import './prototype.css'

const scenarios = [
  { value: 'ready', label: 'Заполненная форма → успех' },
  { value: 'blank', label: 'Новая пустая форма' },
  { value: 'validation', label: 'Ошибка: не выбраны дни' },
  { value: 'access', label: 'Отказ в доступе при создании' },
  { value: 'unknown', label: 'Ответ о создании потерян' },
  { value: 'pending', label: 'Долгое создание → уход' },
  { value: 'lookup-error', label: 'Ошибка загрузки справочников' },
  { value: 'empty', label: 'Нет доступных филиалов' },
  { value: 'restricted', label: 'Роль «Тренер»: создание недоступно' },
  { value: 'long', label: 'Длинные названия' },
  { value: 'before', label: 'Сравнить: текущая форма' },
]
const initialScenario = new URLSearchParams(location.search).get('scenario') || 'ready'
const branches = [{ id: 'centre', name: 'Филиал Центр', address: 'ул. Спортивная, 12', isArchived: false, description: null, hallCount: 1, groupCount: 2, clientCount: 24 }]
const halls = [{ id: 'hall-1', branchId: 'centre', branchName: 'Филиал Центр', name: 'Зал 1', isArchived: false, description: null, groupCount: 2 }]
const groupTypes = [{ id: 'boxing', name: 'Бокс', isArchived: false, description: null, groupCount: 2 }]
const trainers = [{ id: 'trainer-1', fullName: 'Александр Соколов', login: 'sokolov' }, { id: 'trainer-2', fullName: 'Мария Крылова', login: 'krylova' }]
const longName = 'Бокс — начинающие взрослые, вечерняя группа спортивного центра «Олимп»'
type Result = 'ready' | 'pending' | 'error' | 'unknown'
type Route = 'form' | 'list' | 'clients'
Object.entries({ ...createSemanticVariables(themeProfiles[0]), ...createFoundationVariables() }).forEach(([key, value]) => document.documentElement.style.setProperty(key, String(value)))
document.body.classList.add('app-shell', 'prototype-body')

function App() {
  const [scenario, setScenario] = useState(initialScenario)
  const [revision, setRevision] = useState(0)
  function choose(value: string | null) {
    const next = value || 'ready'
    setScenario(next)
    setRevision(n => n + 1)
    history.replaceState({}, '', `?scenario=${next}#form`)
  }
  return <MantineProvider theme={gymCrmTheme} defaultColorScheme="light">
    <aside className="review-bar" aria-label="Управление прототипом">
      <div><Text fw={700} size="sm">TASK-203 · Прототип для согласования</Text><Text size="xs" c="dimmed">Демонстрационные данные · ничего не записывается в CRM</Text></div>
      <Select aria-label="Сценарий прототипа" data={scenarios} value={scenario} onChange={choose} allowDeselect={false} />
      <Button variant="secondary" onClick={() => choose(scenario)}>Начать заново</Button>
    </aside>
    <Experience key={`${scenario}-${revision}`} scenario={scenario} />
  </MantineProvider>
}

function Experience({ scenario }: { scenario: string }) {
  const empty = scenario === 'blank'
  const original = scenario === 'before'
  const initial: GroupFormValues = { name: empty ? '' : scenario === 'long' ? longName : 'Бокс · начинающие', branchId: 'centre', hallId: 'hall-1', groupTypeId: 'boxing', trainingStartTime: '19:00', weekdayStartTimes: { '1': '19:00', '3': '19:00', '5': '18:30' }, durationMinutes: 90, weekdays: empty || scenario === 'validation' ? [] : ['1', '3', '5'], initialSeriesStartsOn: '2026-11-23', initialSeriesEndsOn: '', isActive: true, trainerIds: [] }
  const form = useForm<GroupFormValues>({ initialValues: initial })
  const [route, setRoute] = useState<Route>('form')
  const [result, setResult] = useState<Result>('ready')
  const [loadError, setLoadError] = useState(scenario === 'lookup-error')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leaveTarget, setLeaveTarget] = useState<Route | null>(null)
  const [created, setCreated] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [seedDirty, setSeedDirty] = useState(!empty)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const routeRef = useRef<Route>('form')
  const busyRef = useRef(false)
  const routeEpoch = useRef(0)
  const active = useRef(true)
  const focusAlert = useRef<HTMLDivElement>(null)
  const formElement = useRef<HTMLDivElement>(null)
  const dirty = seedDirty || form.isDirty() || result === 'pending' || result === 'unknown'
  const demoBranches = scenario === 'long' ? [{ ...branches[0], name: 'Филиал «Северный спортивный центр имени команды чемпионов»', address: 'проспект Спортивных достижений, 128, корпус 3' }] : branches

  useEffect(() => {
    active.current = true
    history.replaceState({}, '', `${location.search}#form`)
    const navigateBrowser = () => {
      routeEpoch.current += 1
      busyRef.current = false
      const next = location.hash === '#list' ? 'list' : location.hash === '#clients' ? 'clients' : 'form'
      routeRef.current = next
      setRoute(next)
      setLeaveTarget(null)
      form.setValues({ ...initial, name: '', weekdays: [], trainerIds: [] })
      form.resetDirty()
      form.clearErrors()
      setSeedDirty(false)
      setResult('ready')
      setError(null)
    }
    window.addEventListener('popstate', navigateBrowser)
    return () => { active.current = false; clearTimeout(timer.current); window.removeEventListener('popstate', navigateBrowser) }
  }, [])

  useEffect(() => {
    if (result === 'unknown') { focusAlert.current?.focus(); focusAlert.current?.scrollIntoView({ block: 'center', behavior: 'instant' }) }
  }, [result])

  function navigate(next: Route) {
    routeEpoch.current += 1
    busyRef.current = false
    routeRef.current = next
    setRoute(next)
    history.pushState({}, '', `${location.search}#${next}`)
    setLeaveTarget(null)
    setSeedDirty(false)
    setError(null)
    setResult('ready')
    form.setValues({ ...initial, name: '', weekdays: [], trainerIds: [] })
    form.resetDirty()
    form.clearErrors()
    window.scrollTo({ top: 0 })
  }
  function requestLeave(next: Route) {
    if (route === 'form' && dirty) setLeaveTarget(next)
    else navigate(next)
  }
  function focusError() {
    requestAnimationFrame(() => {
      const invalid = formElement.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      const target = invalid?.matches('input,button') ? invalid : invalid?.querySelector<HTMLElement>('input,button')
      const fallback = formElement.current?.querySelector<HTMLElement>('[role="alert"]')
      ;(target || fallback)?.focus()
      ;(target || invalid || fallback)?.scrollIntoView({ block: 'center', behavior: 'instant' })
    })
  }
  async function submit(values: GroupFormValues) {
    if (busyRef.current || result === 'unknown') return
    form.clearErrors()
    setError(null)
    // Fixture responses demonstrate accepted states; this is not CRM validation.
    if (!values.name.trim() || !values.weekdays.length) {
      form.setErrors({ ...(!values.name.trim() ? { name: 'Укажите название группы.' } : {}), ...(!values.weekdays.length ? { weekdays: 'Выберите хотя бы один день занятий.' } : {}) })
      setError('Проверьте отмеченные поля. Введённые данные сохранены.')
      setResult('error')
      focusError()
      return
    }
    if (original && !preview) { setPreview(true); return }
    setResult('pending')
    busyRef.current = true
    const submittedName = values.name
    const submittedEpoch = routeEpoch.current
    timer.current = setTimeout(() => {
      busyRef.current = false
      if (!active.current) return
      if (scenario === 'access') {
        if (routeRef.current !== 'form' || routeEpoch.current !== submittedEpoch) return
        setResult('error')
        setError('У вас нет доступа к созданию групп в этом филиале. Введённые данные сохранены. Обратитесь к администратору, чтобы проверить доступ.')
        focusError()
      } else if (scenario === 'unknown') {
        if (routeRef.current !== 'form' || routeEpoch.current !== submittedEpoch) return
        setResult('unknown')
      } else {
        setCreated(submittedName)
        if (routeRef.current === 'form' && routeEpoch.current === submittedEpoch) navigate('list')
      }
    }, scenario === 'pending' ? 15000 : 1400)
  }
  const Form = original ? GroupForm : PrototypeGroupForm
  const nav = [{ label: 'Клиенты', route: 'clients' as Route, icon: IconUsers }, { label: 'Группы', route: 'list' as Route, icon: IconUsersGroup }, { label: 'Расписание', route: 'clients' as Route, icon: IconCalendar }, { label: 'Ещё', route: 'clients' as Route, icon: IconDots }]
  return <>
    <header className="prototype-header"><Text fw={800}>Gym CRM</Text><Text size="sm" c="dimmed">{scenario === 'restricted' ? 'Тренер' : 'Администратор'} · Филиал Центр</Text></header>
    <nav className="prototype-nav" aria-label="Основная навигация">{nav.map(item => <button key={item.label} onClick={() => requestLeave(item.route)} aria-current={item.label === 'Группы' && route !== 'clients' ? 'page' : undefined}><item.icon size={21} /><span>{item.label}</span></button>)}</nav>
    <main className="prototype-main">
      {route === 'form' ? <PageLayout title="Новая группа" actions={<Button variant="secondary" leftSection={<IconArrowLeft size={18} />} onClick={() => requestLeave('list')}>К списку групп</Button>}>
        <PageSection>
          {scenario === 'restricted' ? <Stack><Alert title="Создание групп недоступно" {...getSemanticToneComponentProps('warning')} icon={<IconAlertCircle />}>Ваша роль позволяет просматривать группы. Создавать их могут сотрудники с соответствующим правом.</Alert><Button variant="secondary" onClick={() => navigate('list')}>К списку групп</Button></Stack> : scenario === 'empty' ? <Stack><Alert title="Нет доступных филиалов" {...getSemanticToneComponentProps('info')}>Чтобы создать группу, нужен активный филиал и зал. Обратитесь к администратору для проверки настроек.</Alert><Button variant="secondary" onClick={() => navigate('list')}>К списку групп</Button></Stack> : loading ? <LoadingState label="Загружаем данные для создания группы…" /> : loadError ? <Stack><Alert title="Не удалось загрузить данные" {...getSemanticToneComponentProps('danger')}>Проверьте подключение и попробуйте ещё раз.</Alert><Button onClick={() => { setLoadError(false); setLoading(true); timer.current = setTimeout(() => setLoading(false), 800) }}>Повторить</Button></Stack> : <Stack gap="lg">
            {result === 'unknown' && <Alert ref={focusAlert} tabIndex={-1} title="Результат создания не подтверждён" {...getSemanticToneComponentProps('warning')} icon={<IconAlertCircle />}><Text size="sm">Ответ не получен. Группа могла быть создана. Проверьте список групп, прежде чем создавать её заново.</Text></Alert>}
            {result === 'pending' && <Text role="status" size="sm" c="dimmed">Проверяем данные и создаём группу…</Text>}
            <div ref={formElement}><Form form={form} formError={error} branchOptions={demoBranches} hallOptions={halls} groupTypeOptions={groupTypes} trainerOptions={trainers} cancelAction={result === 'unknown' ? null : { label: 'Отменить', onClick: () => requestLeave('list') }} onSubmit={submit} showInitialSeriesFields submitLabel={result === 'pending' ? 'Создаём…' : original && !preview ? 'Получить предпросмотр' : 'Создать группу'} submitting={result === 'pending'} resultUnknown={result === 'unknown'} onCheckList={() => requestLeave('list')} /></div>
            {original && preview && <Paper className="hint-card" withBorder p="lg"><Text fw={700}>Предпросмотр готов</Text><Text size="sm">Теперь нажмите «Создать группу» для сохранения.</Text></Paper>}
          </Stack>}
        </PageSection>
      </PageLayout> : route === 'list' ? <PageLayout title="Группы" actions={<Button onClick={() => navigate('form')}>Новая группа</Button>}>
        {created && <Alert title={`Группа «${created}» создана`} {...getSemanticToneComponentProps('success')} icon={<IconCheck />}>Начальное расписание сохранено.</Alert>}
        <PageSection><Stack><Group justify="space-between"><TextInput label="Поиск групп" defaultValue="Бокс" /><Badge variant="light">Филиал Центр</Badge></Group>
          {[...(created ? [created] : []), 'Бокс · юниоры', 'Бокс · продолжающие'].map((name, index) => <Paper key={index} className="prototype-list-row" withBorder p="md"><Text fw={700}>{name}</Text><Text size="sm" c="dimmed">Филиал Центр · Зал 1 · Пн, Ср, Пт</Text></Paper>)}
        </Stack></PageSection>
      </PageLayout> : <PageLayout title="Клиенты"><PageSection><Stack><Text>Вы перешли в другой раздел. Введённые данные группы потеряны.</Text><Button onClick={() => navigate('form')}>Вернуться к созданию группы</Button></Stack></PageSection></PageLayout>}
    </main>
    <Modal zIndex={300} opened={leaveTarget !== null} onClose={() => setLeaveTarget(null)} title={result === 'pending' ? 'Выйти во время создания?' : 'Выйти без сохранения?'} centered returnFocus closeOnClickOutside={false}>
      <Stack gap="lg"><Text>{result === 'pending' ? 'Введённые данные будут потеряны. Уход не отменяет создание: группа может появиться в списке после вашего ухода.' : result === 'unknown' ? 'Введённые данные будут потеряны. Группа могла быть создана — проверьте её наличие в списке.' : 'Введённые данные группы будут потеряны.'}</Text><Group className="leave-actions" justify="flex-end"><Button data-autofocus variant="secondary" onClick={() => setLeaveTarget(null)}>Остаться</Button><Button variant="destructive" onClick={() => navigate(leaveTarget!)}>Выйти без сохранения</Button></Group></Stack>
    </Modal>
  </>
}
createRoot(document.getElementById('root')!).render(<App />)
