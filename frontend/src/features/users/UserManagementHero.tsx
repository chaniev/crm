import { Badge, Group, Paper, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

type UserManagementHeroProps = {
  action?: ReactNode
  badge: string
  description: string
  title: string
}

export function UserManagementHero({
  action,
  badge,
  description,
  title,
}: UserManagementHeroProps) {
  return (
    <Paper className="surface-card surface-card--wide page-header-card" radius="28px" withBorder>
      <Stack className="page-header-card__content" gap="md">
        <Group gap="sm">
          <Badge color="brand.1" radius="xl" size="lg" variant="light">
            {badge}
          </Badge>
        </Group>

        <Stack gap="sm">
          <Title className="page-header-card__title" order={1}>
            {title}
          </Title>
          <Text className="page-header-card__description" size="sm">
            {description}
          </Text>
        </Stack>

        {action ? (
          <Group className="management-hero__actions" gap="sm" wrap="wrap">
            {action}
          </Group>
        ) : null}
      </Stack>
    </Paper>
  )
}
