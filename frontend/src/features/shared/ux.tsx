import {
  Alert,
  Group,
  Loader,
  Modal,
  Paper,
  Skeleton as MantineSkeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
  type MantineSpacing,
  type PaperProps,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react'
import {
  Children,
  cloneElement,
  isValidElement,
  type ComponentPropsWithoutRef,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
} from 'react'
import { resources } from '../../lib/resources'
import { Button, type SharedButtonProps } from './Button'

type ResponsiveButtonGroupProps = {
  children: ReactNode
  gap?: MantineSpacing
  justify?: 'center' | 'flex-end' | 'flex-start' | 'space-between'
}

export function ResponsiveButtonGroup({
  children,
  gap = 'sm',
  justify = 'flex-start',
}: ResponsiveButtonGroupProps) {
  const isMobile = useMediaQuery('(max-width: 48em)')
  const normalizedChildren = Children.toArray(children)
    .filter(Boolean)
    .map((child) => {
      if (!isValidElement(child)) {
        return child
      }

      const element = child as ReactElement<Record<string, unknown>>

      return cloneElement(element, {
        ...element.props,
        fullWidth:
          isMobile || Boolean((element.props as { fullWidth?: boolean }).fullWidth),
      })
    })

  if (isMobile) {
    return <Stack gap={gap}>{normalizedChildren}</Stack>
  }

  return (
    <Group gap={gap} justify={justify} wrap="wrap">
      {normalizedChildren}
    </Group>
  )
}

type ConfirmActionModalProps = {
  opened: boolean
  title: string
  description: string
  confirmLabel: string
  pending?: boolean
  confirmColor?: string
  onClose: () => void
  onConfirm: MouseEventHandler<HTMLButtonElement>
}

export function ConfirmActionModal({
  opened,
  title,
  description,
  confirmLabel,
  pending = false,
  confirmColor = 'brand.7',
  onClose,
  onConfirm,
}: ConfirmActionModalProps) {
  return (
    <Modal
      centered
      onClose={onClose}
      opened={opened}
      radius="24px"
      title={title}
      withCloseButton={!pending}
    >
      <Stack gap="lg">
        <Text c="dimmed" size="sm">
          {description}
        </Text>

        <ResponsiveButtonGroup justify="flex-end">
          <Button disabled={pending} onClick={onClose} variant="secondary">
            {resources.common.actions.cancel}
          </Button>
          <Button color={confirmColor} loading={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </ResponsiveButtonGroup>
      </Stack>
    </Modal>
  )
}

type MetricCardProps = {
  description: string
  label: string
  value: string
}

export function MetricCard({
  description,
  label,
  value,
}: MetricCardProps) {
  return (
    <Paper className="surface-card metric-card" radius="28px" withBorder>
      <Stack gap={6}>
        <Text c="dimmed" fw={600} size="sm">
          {label}
        </Text>
        <Title order={3}>{value}</Title>
        <Text c="dimmed" size="sm">
          {description}
        </Text>
      </Stack>
    </Paper>
  )
}

type PageCardProps = PaperProps & {
  children: ReactNode
  className?: string
}

export function PageCard({
  children,
  className,
  radius = 'var(--radius-card)',
  ...props
}: PageCardProps) {
  return (
    <Paper
      className={['surface-card', 'surface-card--wide', 'page-card', className]
        .filter(Boolean)
        .join(' ')}
      radius={radius}
      withBorder
      {...props}
    >
      {children}
    </Paper>
  )
}

type PageHeaderProps = {
  title: string
  description?: string
  actions?: ReactNode
  eyebrow?: ReactNode
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: PageHeaderProps) {
  return (
    <Group className="page-header" justify="space-between" wrap="wrap">
      <Stack className="page-header__copy" gap={6}>
        {eyebrow ? (
          <div className="page-header__eyebrow">{eyebrow}</div>
        ) : null}
        <Title className="page-header__title" order={2}>
          {title}
        </Title>
        {description ? (
          <Text c="dimmed" className="page-header__description" size="sm">
            {description}
          </Text>
        ) : null}
      </Stack>

      {actions ? <Group className="page-header__actions">{actions}</Group> : null}
    </Group>
  )
}

type RefreshButtonProps = Omit<SharedButtonProps, 'children'> &
  ComponentPropsWithoutRef<'button'> & {
  label?: string
}

export function RefreshButton({
  label = resources.common.actions.refresh,
  leftSection = <IconRefresh size={18} />,
  loading = false,
  disabled,
  variant = 'pill',
  ...props
}: RefreshButtonProps) {
  return (
    <Button
      aria-label={label}
      className="refresh-button"
      disabled={disabled || loading}
      leftSection={leftSection}
      loading={loading}
      variant={variant}
      {...props}
    >
      {label}
    </Button>
  )
}

type EmptyStateProps = {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <Paper className="empty-state" radius="var(--radius-inner)" withBorder>
      <Stack align="center" gap="sm">
        {icon ? (
          <ThemeIcon className="empty-state__icon" radius="xl" size={56} variant="light">
            {icon}
          </ThemeIcon>
        ) : null}
        <Stack align="center" gap={4}>
          <Text className="empty-state__title" fw={800} ta="center">
            {title}
          </Text>
          {description ? (
            <Text c="dimmed" className="empty-state__description" size="sm" ta="center">
              {description}
            </Text>
          ) : null}
        </Stack>
        {action ? <div className="empty-state__action">{action}</div> : null}
      </Stack>
    </Paper>
  )
}

type LoadingStateProps = {
  label?: string
}

export function LoadingState({ label = 'Загружаем данные...' }: LoadingStateProps) {
  return (
    <Group className="state-panel state-panel--loading" justify="center">
      <Loader color="brand.7" size="sm" />
      <Text c="dimmed" fw={600} size="sm">
        {label}
      </Text>
    </Group>
  )
}

type ErrorStateProps = {
  title: string
  message: string
  action?: ReactNode
}

export function ErrorState({ title, message, action }: ErrorStateProps) {
  return (
    <Alert
      className="state-panel state-panel--error"
      color="red"
      icon={<IconAlertCircle size={18} />}
      title={title}
      variant="light"
    >
      <Stack gap="sm">
        <Text size="sm">{message}</Text>
        {action ? <div>{action}</div> : null}
      </Stack>
    </Alert>
  )
}

type SkeletonProps = {
  rows?: number
}

export function Skeleton({ rows = 3 }: SkeletonProps) {
  return (
    <Stack gap="sm">
      {Array.from({ length: rows }, (_, index) => (
        <MantineSkeleton className="skeleton-row" height={72} key={index} radius="md" />
      ))}
    </Stack>
  )
}

export { AppLayout } from './AppLayout'
export { Button } from './Button'
export { Header } from './Header'
export { IconButton } from './IconButton'
export { NavigationTabs } from './NavigationTabs'
