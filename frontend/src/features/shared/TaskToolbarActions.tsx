import { IconRefresh } from '@tabler/icons-react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Button, type SharedButtonProps } from './Button'
import { fe17SharedRoutingThemeText } from '../../resources/fe-17-shared-routing-theme'


type TaskToolbarActionsProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  frequentActions?: ReactNode
  primaryAction?: ReactNode
}

export function TaskToolbarActions({
  className,
  frequentActions,
  primaryAction,
  ...props
}: TaskToolbarActionsProps) {
  if (!frequentActions && !primaryAction) {
    return null
  }

  return (
    <div
      className={['task-toolbar-actions', className].filter(Boolean).join(' ')}
      {...props}
    >
      {frequentActions}
      {primaryAction}
    </div>
  )
}

type TaskToolbarActionProps = Omit<SharedButtonProps, 'children' | 'leftSection' | 'variant'> & {
  icon: ReactNode
  label: string
  priority: 'primary' | 'refresh'
}

export function TaskToolbarAction({
  className,
  icon,
  label,
  priority,
  ...props
}: TaskToolbarActionProps) {
  const dataActionPriority = priority === 'primary' ? 'primary' : 'frequent'

  return (
    <Button
      aria-label={label}
      className={[
        'task-toolbar-action',
        `task-toolbar-action--${priority}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-action-priority={dataActionPriority}
      leftSection={icon}
      variant={priority === 'primary' ? 'primary' : 'secondary'}
      {...props}
    >
      {label}
    </Button>
  )
}

type TaskToolbarRefreshActionProps = Omit<TaskToolbarActionProps, 'icon' | 'label' | 'priority'> & {
  label?: string
}

export function TaskToolbarRefreshAction({
  disabled,
  label = fe17SharedRoutingThemeText.taskToolbarActions_string_603e460b,
  loading = false,
  ...props
}: TaskToolbarRefreshActionProps) {
  return (
    <TaskToolbarAction
      disabled={disabled || loading}
      icon={<IconRefresh size={18} />}
      label={label}
      loading={loading}
      priority="refresh"
      {...props}
    />
  )
}
