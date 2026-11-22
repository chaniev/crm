import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Alert, Group, MantineProvider, Modal, NativeSelect, Paper, Stack, Switch, Text, Title } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { LoginScreen, PasswordScreen } from '../../../frontend/src/app/AuthStages'
import { Button } from '../../../frontend/src/features/shared/Button'
import { LocalizedPasswordInput } from '../../../frontend/src/features/shared/LocalizedPasswordInput'
import { ApiError } from '../../../frontend/src/lib/api/errors'
import { createGymCrmTheme } from '../../../frontend/src/theme/createGymCrmTheme'
import { defaultGreenProfile } from '../../../frontend/src/theme/profiles'
import { createFoundationVariables } from '../../../frontend/src/theme/foundations'
import { createSemanticVariables } from '../../../frontend/src/theme/semanticVariables'
import '@mantine/core/styles.css'
import './prototype.css'

const trainer = { name: 'Анастасия Александровна Миронова-Лебедева', role: 'Тренер', login: 'a.mironova' }
const administrator = { name: 'Олег Андреевич Соколов', role: 'Администратор', login: 'o.sokolov' }
const scenes = [
  { value: 'trainer', label: 'Карточка тренера' },
  { value: 'administrator', label: 'Настройки администраторов' },
  { value: 'restricted', label: 'Нет права на сброс' },
  { value: 'revoked', label: 'Право отозвано при отправке' },
  { value: 'interrupted', label: 'Ответ на сброс потерян' },
  { value: 'recipient', label: 'Получатель временного пароля' },
]
const vars = { ...createSemanticVariables(defaultGreenProfile), ...createFoundationVariables() }
for (const [key, value] of Object.entries(vars)) document.documentElement.style.setProperty(key, String(value))

// Демонстрационные данные ограничены открытой страницей.
async function fingerprint(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes)).join(',')
}

function Prototype() {
  const [scene, setScene] = useState('trainer')
  const [recipient, setRecipient] = useState(trainer)
  const [digests, setDigests] = useState<Record<string, string>>({})
  const expected = digests[recipient.login]
  const [pendingLogins, setPendingLogins] = useState<string[]>([])
  const forced = !expected || pendingLogins.includes(recipient.login)
  const mobile = useMediaQuery('(max-width: 48em)')
  async function reset(person: typeof trainer, value: string) {
    const digest = await fingerprint(value)
    if (pendingLogins.includes(person.login) && digest === digests[person.login]) return false
    setDigests(current => ({ ...current, [person.login]: digest }))
    setPendingLogins(current => [...new Set([...current, person.login])])
    setRecipient(person)
    return true
  }
  return <MantineProvider theme={createGymCrmTheme(defaultGreenProfile, { mobile })}>
    <main>
      {scene === 'recipient' ? <Recipient
        login={recipient.login}
        forced={forced}
        matches={async value => (await fingerprint(value)) === (expected || await fingerprint('Пример1'))}
        onChanged={async value => {
          const digest = await fingerprint(value)
          setDigests(current => ({ ...current, [recipient.login]: digest }))
          setPendingLogins(current => current.filter(login => login !== recipient.login))
        }}
      /> : <Staff key={scene} scene={scene} onReset={reset} pendingLogins={pendingLogins} />}
    </main>
    <footer><details><summary>Сценарии прототипа</summary><Stack mt="xs" gap="xs">
      <NativeSelect label="Сценарий" data={scenes} value={scene} onChange={e => setScene(e.currentTarget.value)} />
      <Text size="sm">Используйте вымышленные пароли. Для входа получателя укажите логин из карточки и последний заданный пароль. Начальный пример для тренера — «Пример1».</Text>
    </Stack></details></footer>
  </MantineProvider>
}

function Staff({ scene, pendingLogins, onReset }: { scene: string; pendingLogins: string[]; onReset: (person: typeof trainer, value: string) => Promise<boolean> }) {
  const isAdministrator = scene === 'administrator'
  const person = isAdministrator ? administrator : trainer
  const [allowed, setAllowed] = useState(scene !== 'restricted')
  const [opened, setOpened] = useState(false)
  const [editing, setEditing] = useState(false)
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [denied, setDenied] = useState(false)
  const [pending, setPending] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const lostOnce = useRef(false)
  const opener = useRef<HTMLButtonElement | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (denied) heading.current?.focus() }, [denied])
  function close() {
    setSecret('')
    setError('')
    setUncertain(false)
    setOpened(false)
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    if (!secret) {
      setError('Введите временный пароль.')
      input.current?.focus()
      return
    }
    setPending(true)
    await new Promise(resolve => setTimeout(resolve, 220))
    if (scene === 'revoked') {
      setDenied(true)
      setAllowed(false)
    } else {
      const changed = await onReset(person, secret)
      if (!changed || (scene === 'interrupted' && !lostOnce.current)) {
        setPending(false)
        if (!changed) setError('Этот временный пароль уже действует. Введите другой временный пароль.')
        else {
          lostOnce.current = true
          setUncertain(true)
          setSecret('')
        }
        requestAnimationFrame(() => input.current?.focus())
        return
      }
      setSuccess(true)
    }
    setPending(false)
    close()
  }
  const lockedChange = <Switch checked disabled aria-label="Требовать смену пароля при входе"
    label="Требовать смену пароля при входе" description="Действует до смены временного пароля сотрудником." />
  return <>
    <header>
      <Text c="dimmed" size="sm">{isAdministrator ? 'Настройки' : 'Тренеры'}</Text>
      <Title ref={heading} tabIndex={-1} order={1}>{isAdministrator ? 'Администраторы' : person.name}</Title>
    </header>
    <Paper className="card" radius="xl" withBorder>
      <Stack>
        <div><Title order={2}>{isAdministrator ? person.name : 'Учётная запись'}</Title>
          <Text c="dimmed">{person.role} · {person.login}</Text></div>
        {denied && <Alert color="red" title="Право на сброс изменилось">У вас больше нет доступа к сбросу пароля этого сотрудника.</Alert>}
        {success && <Text role="status">Пароль сброшен. Передайте временный пароль сотруднику лично.</Text>}
        {!isAdministrator && pendingLogins.includes(person.login) && lockedChange}
        <Group gap="xs">
        {isAdministrator && pendingLogins.includes(person.login) && <Button variant="secondary" onClick={() => setEditing(true)}>Редактировать</Button>}
        {allowed && <Button variant="secondary" onClick={event => {
          opener.current = event.currentTarget
          setSuccess(false)
          setOpened(true)
        }}>Сбросить пароль</Button>}
        </Group>
      </Stack>
    </Paper>
    <Modal opened={editing} onClose={() => setEditing(false)} title="Редактирование администратора" centered
      closeButtonProps={{ 'aria-label': 'Закрыть' }}><Stack>
      <Text fw={700}>{person.name}</Text>{lockedChange}
      <Group justify="flex-end"><Button variant="secondary" onClick={() => setEditing(false)}>Закрыть форму</Button></Group>
    </Stack></Modal>
    <Modal opened={opened} onClose={close} title="Сбросить пароль" centered size="md"
      closeButtonProps={{ 'aria-label': 'Закрыть' }} closeOnClickOutside={!pending}
      closeOnEscape={!pending} withCloseButton={!pending} returnFocus={false}
      onExitTransitionEnd={() => (opener.current?.isConnected ? opener.current : heading.current)?.focus()}>
      <form onSubmit={submit}><Stack>
        <div><Text fw={700}>{person.name}</Text><Text c="dimmed" size="sm">{person.role} · {person.login}</Text></div>
        {uncertain && <Alert color="red" title="Подтверждение не получено">Проверьте связь и задайте другой временный пароль. Передайте его после подтверждения сброса.</Alert>}
        <LocalizedPasswordInput ref={input} data-autofocus autoComplete="new-password" label="Временный пароль"
          error={error || undefined} value={secret} disabled={pending} onChange={event => {
            setSecret(event.currentTarget.value)
            setError('')
          }} />
        <Alert color="yellow" title="Все сеансы сотрудника завершатся">
          Несохранённые изменения будут потеряны. Передайте пароль лично. При следующем входе сотрудник установит свой пароль.
        </Alert>
        <Group justify="flex-end"><Button variant="secondary" disabled={pending} onClick={close}>Отмена</Button>
          <Button type="submit" loading={pending}>Сбросить пароль</Button></Group>
      </Stack></form>
    </Modal>
  </>
}

type RecipientProps = {
  login: string
  forced: boolean
  matches: (value: string) => Promise<boolean>
  onChanged: (password: string) => Promise<void>
}

function Recipient({ login, forced, matches, onChanged }: RecipientProps) {
  const [stage, setStage] = useState<'login' | 'forced' | 'done'>('login')
  return <section className="recipient">
    {stage === 'login' && <LoginScreen clubName="K4 PRO" showSetupHelp={false} pending={false}
      onSubmit={async values => {
        if (values.login !== login || !await matches(values.password)) throw new ApiError('Проверьте логин и пароль.', 401)
        setStage(forced ? 'forced' : 'done')
      }} />}
    {stage === 'forced' && <PasswordScreen mode="forced" pending={false} onSubmit={async values => {
      if (!await matches(values.currentPassword)) throw new ApiError('Проверьте текущий пароль.', 400)
      if (values.newPassword === values.currentPassword) throw new ApiError('Новый пароль должен отличаться от временного.', 400)
      await onChanged(values.newPassword)
      setStage('done')
    }} />}
    {stage === 'done' && <Paper className="card" withBorder><Title order={1}>Вход выполнен</Title>
      <Text role="status">Можно продолжить работу в CRM.</Text></Paper>}
  </section>
}

createRoot(document.getElementById('root')!).render(<Prototype />)
