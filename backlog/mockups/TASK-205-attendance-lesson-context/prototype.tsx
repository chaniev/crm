import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Group, MantineProvider, Menu, Modal, NativeSelect, Stack, Text, Title } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconArrowLeft, IconCalendar, IconChevronDown, IconClock } from '@tabler/icons-react'
import '@fontsource/onest/cyrillic-400.css'
import '@fontsource/onest/cyrillic-500.css'
import '@fontsource/onest/cyrillic-600.css'
import '@fontsource/onest/cyrillic-700.css'
import '@fontsource/onest/latin-400.css'
import '@fontsource/onest/latin-700.css'
import '@mantine/core/styles.css'
import '../../../frontend/src/index.css'
import '../../../frontend/src/App.css'
import './prototype.css'
import { AttendanceWorkspace } from '../../../frontend/src/features/attendance/AttendanceScreen'
import { AttendanceTodayWorklist } from '../../../frontend/src/features/attendance/AttendanceTodayWorklist'
import {
  AppLayout, Button, ErrorState, Header, LoadingState, MobileBottomNavigation,
  NavigationTabs, PageLayout, PageSection,
} from '../../../frontend/src/features/shared/ux'
import type { AppSection } from '../../../frontend/src/lib/api/types'
import { createGymCrmTheme, createSemanticVariables } from '../../../frontend/src/theme'
import { defaultGreenProfile } from '../../../frontend/src/theme/profiles'
import { findLesson, lessons, today, user } from './fixtures'

const defaultRoute = 'lesson/' + today + '/morning'
const readRoute = () => window.location.hash.slice(1) || defaultRoute
const formatDate = (date: string) => new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(date + 'T00:00:00Z')).replace(/\s*г\.$/, '')
const sections: AppSection[] = ['Attendance', 'Schedule']

function LessonScreen({ date, id, example, origin, back }: {
  date: string; id: string; example?: string; origin?: string; back: () => void
}) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<'loading' | 'error' | 'unavailable' | 'ready'>('loading')
  const [profile, setProfile] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const retry = useRef(false)
  const target = useMemo(() => ({ lessonOccurrenceId: id, lessonDate: date }), [date, id])
  const lesson = findLesson(id, date)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!lesson || example === 'restricted') setState('unavailable')
      else if (example === 'error' && !attempt) setState('error')
      else setState('ready')
    }, example === 'loading' && !attempt ? 2200 : 260)
    return () => window.clearTimeout(timer)
  }, [attempt, lesson, example])

  useLayoutEffect(() => {
    if (state === 'ready') {
      document.title = lesson!.groupName + ' · Посещения'
      if (retry.current || document.activeElement === document.body) heading.current?.focus({ preventScroll: true })
      retry.current = false
    }
  }, [state, lesson])

  const label = origin?.startsWith('schedule') ? 'К расписанию' : 'К занятиям на сегодня'
  return <PageLayout showHeader={false} renderHiddenHeading={state !== 'ready'} title="Посещаемость занятия">
    <PageSection className="lesson-context" density="compact">
      <div className="lesson-context__layout">
        <div className="lesson-context__identity">
          {state === 'ready' && lesson ? <>
            <Title ref={heading} tabIndex={-1} order={1}>{lesson.groupName}</Title>
            <div className="lesson-context__when">
              <span><IconCalendar aria-hidden="true" size={18} /><time dateTime={date}>{formatDate(date)}</time></span>
              <span><IconClock aria-hidden="true" size={18} />{lesson.startTime}–{lesson.endTime}</span>
            </div>
          </> : state === 'loading' ? <LoadingState label="Загружаем данные занятия…" />
            : state === 'unavailable' ? <ErrorState title="Занятие недоступно" message="Вернитесь к списку, чтобы выбрать доступное занятие." />
            : <ErrorState title="Не удалось загрузить данные занятия" message="Попробуйте ещё раз, чтобы увидеть группу и время."
              action={<Button variant="secondary" onClick={() => {
                retry.current = true
                setState('loading')
                setAttempt(value => value + 1)
              }}>Повторить</Button>} />}
        </div>
        <Button className="lesson-context__back" variant="secondary" leftSection={<IconArrowLeft size={18} />} onClick={back}>
          {label}
        </Button>
      </div>
    </PageSection>
    {state === 'ready' && <div className="prototype-roster">
      <AttendanceWorkspace lessonTarget={target} user={user} onOpenClient={clientId => {
        const row = document.querySelector('[data-client-profile-action-id="' + clientId + '"]')
        setProfile(row?.getAttribute('aria-label')?.replace('Открыть карточку клиента ', '') ?? 'Клиент')
      }} />
    </div>}
    <Modal opened={profile !== null} onClose={() => setProfile(null)} title="Карточка клиента" centered
      closeButtonProps={{ 'aria-label': 'Закрыть карточку клиента' }}>
      <Text fw={700}>{profile}</Text>
      <Text mt="xs">В прототипе показан переход из состава занятия.</Text>
    </Modal>
  </PageLayout>
}

function Schedule({ date, selectDate, open }: {
  date: string; selectDate: (date: string) => void; open: (id: string, date: string) => void
}) {
  useLayoutEffect(() => {
    const position = history.state?.schedulePosition
    if (position) {
      window.scrollTo(0, position.scroll)
      document.getElementById('schedule-' + position.id)?.focus({ preventScroll: true })
    }
  }, [date])
  return <PageLayout title="Расписание" showHeader={false}>
    <NativeSelect label="Дата занятия" value={date} onChange={event => selectDate(event.target.value)}
      data={[today, '2026-11-21'].map(value => ({ value, label: formatDate(value) }))} />
    <Stack gap="sm">{lessons.filter(lesson => lesson.lessonDate === date).map(lesson =>
      <PageSection key={lesson.lessonOccurrenceId} density="compact">
        <Group justify="space-between" gap="sm">
          <Stack gap={4}>
            <Text fw={700}>{lesson.startTime}–{lesson.endTime}</Text>
            <Title order={2} size="h3">{lesson.groupName}</Title>
            {lesson.note && <Text size="sm" c="dimmed">{lesson.note}</Text>}
          </Stack>
          <Button id={'schedule-' + lesson.lessonOccurrenceId} variant="secondary"
            aria-label={'Посещения · ' + lesson.groupName + ', ' + lesson.startTime}
            onClick={() => {
              history.replaceState({ schedulePosition: { id: lesson.lessonOccurrenceId, scroll: window.scrollY } }, '')
              open(lesson.lessonOccurrenceId, date)
            }}>Посещения</Button>
        </Group>
      </PageSection>)}</Stack>
  </PageLayout>
}

function Prototype() {
  const [route, setRoute] = useState(readRoute)
  const [visit, setVisit] = useState(0)
  const mobile = useMediaQuery('(max-width: 48rem)')
  const theme = useMemo(() => createGymCrmTheme(defaultGreenProfile, { mobile }), [mobile])
  useEffect(() => {
    const sync = () => setRoute(readRoute())
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])
  const [kind, date = today, id = 'morning', example] = route.split('/')
  const section = kind === 'schedule' ? 'Schedule' : 'Attendance'

  function go(next: string, state: object = {}, replace = false) {
    if (replace) history.replaceState(state, '', '#' + next)
    else history.pushState(state, '', '#' + next)
    window.scrollTo(0, 0)
    setVisit(current => current + 1)
    setRoute(next)
  }
  useLayoutEffect(() => {
    document.title = (kind === 'schedule' ? 'Расписание' : 'Посещения') + ' · TASK-205'
  }, [route, kind])
  function open(id: string, date: string) {
    go('lesson/' + date + '/' + id, { prototypeOrigin: route })
  }
  function back() {
    if (history.state?.prototypeOrigin) history.back()
    else go('attendance', {}, true)
  }
  const navigate = (section: AppSection) => go(section === 'Schedule' ? 'schedule/' + today : 'attendance')
  const cases = [
    ['Посещения сегодня', 'attendance'], ['Расписание', 'schedule/' + today],
    ['Прямая ссылка', defaultRoute], ['Длинное название', 'lesson/' + today + '/long'],
    ['Загрузка', defaultRoute + '/loading'], ['Ошибка и повтор', defaultRoute + '/error'],
    ['Доступ отозван', defaultRoute + '/restricted'], ['Будущее занятие', 'lesson/2026-11-21/future'],
  ]
  const controls = <Menu position="bottom-end" shadow="md" width={220}>
    <Menu.Target><Button variant="secondary" rightSection={<IconChevronDown size={15} />}>Сценарии</Button></Menu.Target>
    <Menu.Dropdown><Menu.Label>Прототип TASK-205</Menu.Label>
      {cases.map(([name, link]) => <Menu.Item key={name} onClick={() => go(link)}>{name}</Menu.Item>)}
    </Menu.Dropdown>
  </Menu>
  return <MantineProvider theme={theme} forceColorScheme="light">
    <AppLayout header={<Header brandTitle="K-4PRO" profileControl={controls} />}
      navbar={<div className="app-shell__navbar-inner"><NavigationTabs currentSection={section}
        orientation="vertical" sections={sections} onNavigate={navigate} /></div>}
      mainLabel={section === 'Schedule' ? 'Расписание' : 'Посещения'}>
      {kind === 'attendance' ? <PageLayout title="Посещения" showHeader={false}>
        <AttendanceTodayWorklist onOpenLesson={open} />
      </PageLayout> : kind === 'schedule' ? <Schedule date={date} open={open} selectDate={value => go('schedule/' + value, {}, true)} />
        : <LessonScreen key={route + ':' + visit} date={date} id={id} example={example} origin={history.state?.prototypeOrigin} back={back} />}
    </AppLayout>
    <MobileBottomNavigation currentSection={section} sections={sections} onNavigate={navigate} />
  </MantineProvider>
}

for (const [key, value] of Object.entries(createSemanticVariables(defaultGreenProfile))) {
  document.documentElement.style.setProperty(key, value)
}
createRoot(document.getElementById('root')!).render(<Prototype />)
