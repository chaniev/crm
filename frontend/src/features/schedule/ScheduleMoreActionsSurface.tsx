import { useRef, useState, type Ref } from 'react'
import { Button, Drawer, Menu, Stack, Text, UnstyledButton } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconDots } from '@tabler/icons-react'
import type { ScheduleDeferredAction } from './scheduleDeferredActions'
import { fe3ScheduleMutationsText } from '../../resources/fe-3-schedule-mutations'


export type ScheduleMoreActionsSurfaceProps = {
  actions: ScheduleDeferredAction[]
  accessibleContext: string
  context: {
    groupName: string
    interval: string
    hallLine: string
    trainers: string
  }
  fallbackFocusRef: Ref<HTMLElement | null>
  onSelectAction: (action: ScheduleDeferredAction) => void
}

/**
 * Renders the `Ещё` trigger plus the shared deferred-action surface:
 * a Mantine `Menu` on fine-pointer/keyboard layouts (>=768px) and a bottom
 * `Drawer` on coarse-pointer compact layouts. Both consume the same ordered
 * capability-derived action model; closing returns focus to the trigger with
 * a documented fallback when the trigger unmounted.
 */
export function ScheduleMoreActionsSurface({
  actions,
  accessibleContext,
  context,
  fallbackFocusRef,
  onSelectAction,
}: ScheduleMoreActionsSurfaceProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [drawerOpened, setDrawerOpened] = useState(false)
  const [menuOpened, setMenuOpened] = useState(false)
  const useMenu = useMediaQuery('(min-width: 48em) and (hover: hover) and (pointer: fine)')

  if (actions.length === 0) {
    return null
  }

  function returnFocus() {
    if (triggerRef.current) {
      triggerRef.current.focus()
      return
    }
    const fallback = fallbackFocusRef as { current?: HTMLElement | null }
    fallback.current?.focus()
  }

  function close() {
    setDrawerOpened(false)
    setMenuOpened(false)
    returnFocus()
  }

  function handleMenuChange(nextOpened: boolean) {
    setMenuOpened(nextOpened)
    if (!nextOpened) {
      returnFocus()
    }
  }

  function select(action: ScheduleDeferredAction) {
    setDrawerOpened(false)
    setMenuOpened(false)
    onSelectAction(action)
  }

  const triggerLabel = fe3ScheduleMutationsText.scheduleMoreActionsSurface_triggerLabel_0e137aa1(accessibleContext)

  const contextBlock = (
    <Stack gap={2}>
      <Text fw={900}>{context.groupName}</Text>
      <Text c="dimmed" size="sm">{context.interval}</Text>
      <Text c="dimmed" size="sm">{context.hallLine}</Text>
      <Text c="dimmed" size="sm">{context.trainers}</Text>
    </Stack>
  )

  if (useMenu) {
    return (
      <Menu
        onChange={handleMenuChange}
        opened={menuOpened}
        position="bottom-end"
        shadow="md"
        width={260}
        withinPortal
      >
        <Menu.Target>
          <Button
            aria-label={triggerLabel}
            className="schedule-occurrence-card__more"
            data-testid="schedule-more-trigger"
            leftSection={<IconDots size={18} />}
            ref={triggerRef}
            size="compact-sm"
            type="button"
            variant="light"
          >
            {fe3ScheduleMutationsText.scheduleMoreActionsSurface_jsxText_2071fb99}</Button>
        </Menu.Target>
        <Menu.Dropdown>
          {contextBlock}
          <Menu.Divider />
          {actions.map((action) => (
            <Menu.Item
              aria-label={action.accessibleName}
              color={action.danger ? 'red' : undefined}
              key={action.id}
              leftSection={action.icon}
              onClick={() => select(action)}
            >
              {action.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    )
  }

  return (
    <>
      <Button
        aria-label={triggerLabel}
        className="schedule-occurrence-card__more"
        data-testid="schedule-more-trigger"
        leftSection={<IconDots size={18} />}
        onClick={() => setDrawerOpened(true)}
        ref={triggerRef}
        size="compact-sm"
        type="button"
        variant="light"
      >
        {fe3ScheduleMutationsText.scheduleMoreActionsSurface_jsxText_2071fb99}</Button>
      <Drawer
        className="schedule-more-drawer"
        closeButtonProps={{
          'aria-label': fe3ScheduleMutationsText.scheduleMoreActionsSurface_ariaLabel_d3b1083d,
          className: 'temporary-surface-close',
        }}
        onClose={close}
        opened={drawerOpened}
        position="bottom"
        returnFocus={false}
        size="auto"
        title={(
          <Text component="span" fw={800}>
            {fe3ScheduleMutationsText.scheduleMoreActionsSurface_jsxText_ca0bc1ad}</Text>
        )}
        withinPortal
      >
        <div className="schedule-more-drawer__content">
          <div className="schedule-more-drawer__context">{contextBlock}</div>
          <div className="schedule-more-drawer__actions" role="list">
            {actions.map((action) => (
              <UnstyledButton
                aria-label={action.accessibleName}
                className="schedule-more-drawer__action"
                data-danger={action.danger ? 'true' : undefined}
                key={action.id}
                onClick={() => select(action)}
                type="button"
              >
                {action.icon}
                <Text component="span" fw={700}>{action.label}</Text>
              </UnstyledButton>
            ))}
          </div>
        </div>
      </Drawer>
    </>
  )
}
