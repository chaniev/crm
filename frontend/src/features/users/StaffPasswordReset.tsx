import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Alert, Group, Modal, Stack, Text } from '@mantine/core'
import { ApiError, applyFieldErrors, type UserListItem } from '../../lib/api'
import { resources } from '../../lib/resources'
import { fe11SettingsUsersText } from '../../resources/fe-11-settings-users'
import { Button } from '../shared/Button'
import { LocalizedPasswordInput } from '../shared/LocalizedPasswordInput'
import { userRoleLabels } from './UserManagement.constants'

const text = fe11SettingsUsersText.passwordReset

type Props = {
  user: UserListItem
  reset: (id: string, temporaryPassword: string) => Promise<void>
  reload: (id: string, signal: AbortSignal) => Promise<UserListItem>
  onUpdated: (user: UserListItem, reason: 'reset' | 'denied') => void
}

export function StaffPasswordReset({ user, reset, reload, onUpdated }: Props) {
  const [opened, setOpened] = useState(false)
  const [secret, setSecret] = useState('')
  const [pending, setPending] = useState(false)
  const [fieldError, setFieldError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [result, setResult] = useState<'success' | 'denied' | null>(null)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const activeRequest = useRef<AbortController | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const resultHeading = useRef<HTMLSpanElement | null>(null)
  const allowed = user.allowedActions?.includes('ResetPassword')
  useEffect(() => () => activeRequest.current?.abort(), [])

  function close() {
    setOpened(false)
    setSecret('')
    setFieldError('')
    setUncertain(false)
  }

  useLayoutEffect(() => {
    if (opened || !opener.current) return
    if (opener.current.isConnected) {
      opener.current.focus()
    } else {
      const title = resultHeading.current?.closest('.page-layout')?.querySelector<HTMLElement>('h1:not(.visually-hidden)')
      if (title) {
        title.tabIndex = -1
        title.focus()
      } else {
        resultHeading.current?.focus()
      }
    }
  }, [opened])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (activeRequest.current) return
    if (!secret.trim()) {
      setFieldError(text.required)
      input.current?.focus()
      return
    }

    const controller = new AbortController()
    activeRequest.current = controller
    setPending(true)
    try {
      await reset(user.id, secret)
      if (controller.signal.aborted) return
      close()
      setResult('success')
      onUpdated({ ...user, mustChangePassword: true, passwordResetPending: true }, 'reset')
      try {
        const updated = await reload(user.id, controller.signal)
        if (!controller.signal.aborted) onUpdated(updated, 'reset')
      } catch {
        if (!controller.signal.aborted) setRefreshFailed(true)
      }
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
        close()
        setResult('denied')
        onUpdated({ ...user, allowedActions: user.allowedActions?.filter(action => action !== 'ResetPassword') }, 'denied')
      } else if (error instanceof ApiError && error.status < 500) {
        setFieldError(applyFieldErrors(error.fieldErrors).temporaryPassword ?? error.message)
        requestAnimationFrame(() => input.current?.focus())
      } else {
        setSecret('')
        setFieldError('')
        setUncertain(true)
        requestAnimationFrame(() => input.current?.focus())
      }
    } finally {
      activeRequest.current = null
      if (!controller.signal.aborted) setPending(false)
    }
  }

  if (!allowed && !result && !opened) return null

  return (
    <Stack gap="xs" align="flex-start">
      {result === 'success' && (
        <Text component="span" role="status" tabIndex={-1} ref={resultHeading}>
          {text.success}
        </Text>
      )}
      {refreshFailed && <Text role="alert">{text.refreshFailed}</Text>}
      {result === 'denied' && (
        <Alert color="red" title={(
          <span role="heading" aria-level={3} ref={resultHeading} tabIndex={-1}>
            {text.deniedTitle}
          </span>
        )}>
          {text.denied}
        </Alert>
      )}
      {allowed && (
        <Button
          type="button"
          variant="secondary"
          aria-disabled={pending || undefined}
          onClick={event => {
            if (pending) return
            opener.current = event.currentTarget
            setResult(null)
            setRefreshFailed(false)
            setOpened(true)
          }}
        >
          {text.action}
        </Button>
      )}
      {opened && (
        <Modal
          opened
          centered
          size="md"
          title={text.action}
          zIndex={300}
          onClose={close}
          closeButtonProps={{ 'aria-label': text.close }}
          withCloseButton={!pending}
          closeOnEscape={!pending}
          closeOnClickOutside={!pending}
          returnFocus={false}
        >
          <form onSubmit={submit}>
            <Stack>
              <div style={{ overflowWrap: 'anywhere' }}>
                <Text fw={700}>{user.fullName}</Text>
                <Text c="dimmed" size="sm">{userRoleLabels[user.role]} · {user.login}</Text>
              </div>
              {uncertain && <Alert color="red" title={text.unknownTitle}>{text.unknown}</Alert>}
              <LocalizedPasswordInput
                ref={input}
                data-autofocus
                autoComplete="new-password"
                label={text.label}
                error={fieldError || undefined}
                value={secret}
                disabled={pending}
                onChange={event => {
                  setSecret(event.currentTarget.value)
                  setFieldError('')
                }}
              />
              <Alert color="yellow" title={text.warningTitle}>{text.warning}</Alert>
              <Group justify="flex-end">
                <Button type="button" variant="secondary" disabled={pending} onClick={close}>
                  {resources.common.actions.cancel}
                </Button>
                <Button type="submit" loading={pending}>{text.action}</Button>
              </Group>
            </Stack>
          </form>
        </Modal>
      )}
    </Stack>
  )
}
