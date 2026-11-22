import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Alert, Badge, Group, MantineProvider, Modal, NativeSelect, Paper, Stack, Text, TextInput, Title } from '@mantine/core'
import { Button } from '../../../frontend/src/features/shared/Button'
import { createGymCrmTheme } from '../../../frontend/src/theme/createGymCrmTheme'
import { defaultGreenProfile } from '../../../frontend/src/theme/profiles'
import { createFoundationVariables } from '../../../frontend/src/theme/foundations'
import { createSemanticVariables } from '../../../frontend/src/theme/semanticVariables'
import '@mantine/core/styles.css'
import './prototype.css'

const variables = { ...createSemanticVariables(defaultGreenProfile), ...createFoundationVariables() }
for (const [name, value] of Object.entries(variables)) document.documentElement.style.setProperty(name, String(value))

type Period = { id: string; name: string; start: string; end: string }
const initial: Period = { id: 'current', name: 'Мария Крылова', start: '2026-11-20', end: '2026-11-27' }
const historical: Period = { id: 'old', name: 'Андрей Соколов', start: '2026-11-21', end: '2026-11-30' }
const trainers = ['Анастасия Александровна Миронова-Лебедева', 'Денис Соловьёв']
const groupName = 'Бокс · юниоры'
const display = (value: string) => value.split('-').reverse().join('.')
const dates = (period: Period) => display(period.start) + ' — ' + display(period.end)
const scenarios = [
  { value: 'manager', label: 'Управляющий сотрудник' },
  { value: 'conflict', label: 'Конфликт при назначении' },
  { value: 'restricted', label: 'Тренер без права управления' }
]

function Preview() {
  const start = new URLSearchParams(location.search).get('scenario')
  const [scene, setScene] = useState(scenarios.some(s => s.value === start) ? start! : 'manager')
  return <MantineProvider theme={createGymCrmTheme(defaultGreenProfile)}>
    <header className="brand"><div><b>Gym CRM</b><span>Филиал Центр</span></div></header>
    <Workspace key={scene} scene={scene} />
    <footer><details><summary>Сценарии прототипа</summary>
      <NativeSelect label="Режим проверки" data={scenarios} value={scene} onChange={e => setScene(e.currentTarget.value)} />
      <Text size="sm" c="dimmed">Демонстрационные данные на 22 ноября 2026 года.</Text>
    </details></footer>
  </MantineProvider>
}

function Workspace({ scene }: { scene: string }) {
  const [periods, setPeriods] = useState<Period[]>([initial])
  const [history, setHistory] = useState<Period[]>([])
  const [expanded, setExpanded] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [cancel, setCancel] = useState<Period | null>(null)
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const fail = useRef(scene === 'conflict')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const openButton = useRef<HTMLButtonElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const returnTarget = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (formOpen || cancel || !returnTarget.current) return
    const frame = requestAnimationFrame(() => { returnTarget.current?.focus(); returnTarget.current = null })
    return () => cancelAnimationFrame(frame)
  }, [formOpen, cancel])
  useEffect(() => () => clearTimeout(timer.current), [])

  function create(event: React.FormEvent) {
    event.preventDefault()
    if (end < start) { setError('Дата окончания должна совпадать с датой начала или быть позже.'); return }
    setPending(true); setError('')
    timer.current = setTimeout(() => {
      setPending(false)
      if (fail.current || periods.some(p => p.name === name && start <= p.end && p.start <= end)) {
        fail.current = false
        if (scene === 'conflict' && !periods.some(p => p.name === name)) {
          setPeriods(rows => [...rows, { id: 'other', name, start, end }])
        }
        setError('Для тренера уже есть замещение на эти даты. Проверьте период или выберите другого тренера.')
        return
      }
      setPeriods(rows => [...rows, { id: crypto.randomUUID(), name, start, end }])
      setFormOpen(false)
      setNotice('Замещение назначено. ' + name + ', ' + display(start) + ' — ' + display(end) + '.')
    }, 240)
  }

  function revoke() {
    if (!cancel || pending) return
    setPending(true)
    timer.current = setTimeout(() => {
      setPeriods(rows => rows.filter(row => row.id !== cancel.id))
      setHistory(rows => [cancel, ...rows])
      setNotice('Замещение отменено. ' + cancel.name + ', ' + dates(cancel) + '.')
      setPending(false); returnTarget.current = title.current; setCancel(null)
    }, 240)
  }

  if (scene === 'restricted') return <main><Text c="dimmed">Группы</Text>
    <Paper className="box" withBorder><Title order={1}>Управление группой недоступно</Title>
      <Text>Назначать замещения могут сотрудники с правом управления тренерами этой группы.</Text>
    </Paper></main>

  return <main>
    <Text c="dimmed" size="sm">Группы / Редактирование группы</Text>
    <Title mt="xs" order={1}>{groupName}</Title>
    <Paper className="box" withBorder>
      <div className="sectionHead"><Title ref={title} tabIndex={-1} order={2}>Временные замещения</Title>
        <Button ref={openButton} onClick={() => {
          returnTarget.current = openButton.current
          setName(''); setStart(''); setEnd(''); setNotice(''); setError(''); setFormOpen(true)
        }}>Назначить на период</Button>
      </div>
      {notice && <Alert role="status" color="teal">{notice}</Alert>}
      <div><Title order={3}>Текущие и будущие</Title>
        {periods.length === 0 && <Text c="dimmed">Действующих и запланированных замещений нет.</Text>}
        {periods.map(period => <div className="row" key={period.id}>
          <div><Text fw={700}>{period.name}</Text><Text size="sm">{dates(period)}</Text></div>
          <Badge variant="light" color={period.start <= '2026-11-22' ? 'teal' : 'blue'}>{period.start <= '2026-11-22' ? 'Действует' : 'Запланировано'}</Badge>
          <Button variant="secondary" aria-label={'Отменить замещение ' + period.name} onClick={e => { returnTarget.current = e.currentTarget; setCancel(period) }}>Отменить</Button>
        </div>)}
      </div>
      <div><Button variant="secondary" aria-expanded={expanded} aria-controls="history" onClick={() => setExpanded(!expanded)}>{expanded ? 'Скрыть историю' : 'Показать историю'}</Button>
        {expanded && <div id="history"><Title order={3} mt="md">История замещений</Title>
          {[...history, historical].map(period => <div className="row history" key={period.id}>
            <div><Text fw={700}>{period.name}</Text><Text size="sm">{dates(period)}</Text></div>
            <Text c="dimmed" size="sm">{period.id === 'old' ? 'Архивная запись. Доступ к группе не предоставляется.' : 'Отменено'}</Text>
          </div>)}
        </div>}
      </div>
    </Paper>
    <Modal returnFocus={false} opened={formOpen} onClose={() => { if (!pending) setFormOpen(false) }} centered title="Назначить на период" closeButtonProps={{ 'aria-label': 'Закрыть', disabled: pending }} closeOnClickOutside={false} closeOnEscape={!pending} transitionProps={{ duration: 0 }}>
      <form onSubmit={create}><Stack>
        <Text>{name || 'Тренер'} получит доступ к группе «{groupName}» и её клиентам с первого по последний день периода включительно.</Text>
        <NativeSelect data-autofocus required label="Замещающий тренер" value={name} disabled={pending} data={[{value:'',label:'Выберите тренера'}, ...trainers]} onChange={e => { setName(e.currentTarget.value); setError('') }} />
        <div className="dateFields">
          <TextInput required type="date" min="2026-11-22" label="Дата начала" disabled={pending} value={start} onChange={e => { setStart(e.currentTarget.value); setError('') }} />
          <TextInput required type="date" label="Дата окончания" disabled={pending} value={end} onChange={e => { setEnd(e.currentTarget.value); setError('') }} />
        </div>
        {error && <Alert color="red" role="alert">{error}</Alert>}
        <Group justify="flex-end"><Button variant="secondary" disabled={pending} onClick={() => setFormOpen(false)}>Закрыть</Button>
          <Button type="submit" loading={pending}>Назначить</Button></Group>
      </Stack></form>
    </Modal>
    <Modal returnFocus={false} opened={cancel !== null} onClose={() => { if (!pending) setCancel(null) }} centered title="Отменить замещение?" closeButtonProps={{ 'aria-label': 'Закрыть', disabled: pending }} closeOnClickOutside={false} closeOnEscape={!pending}
       transitionProps={{ duration: 0 }}>
      {cancel && <Stack><div><Text fw={700}>{cancel.name}</Text><Text>Группа «{groupName}» · {dates(cancel)}</Text></div>
        <Text>Отмена прекращает доступ по этому назначению.</Text>
        <Group justify="flex-end"><Button data-autofocus variant="secondary" disabled={pending} onClick={() => setCancel(null)}>Оставить</Button>
          <Button variant="destructive" loading={pending} onClick={revoke}>Отменить замещение</Button></Group>
      </Stack>}
    </Modal>
  </main>
}

createRoot(document.getElementById('root')!).render(<Preview />)
