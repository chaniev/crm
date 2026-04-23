import {
  Button,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Title,
  type MantineSpacing,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import {
  Children,
  cloneElement,
  isValidElement,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
} from 'react'
import { resources } from '../../lib/resources'

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
          <Button disabled={pending} onClick={onClose} variant="default">
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
