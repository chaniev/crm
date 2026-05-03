import { Badge, Group } from '@mantine/core'
import type { ReactNode } from 'react'
import { PageCard, PageHeader } from '../shared/ux'

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
    <PageCard className="page-header-card">
      <PageHeader
        actions={action}
        description={description}
        eyebrow={(
          <Group gap="sm">
            <Badge color="brand.1" radius="xl" size="lg" variant="light">
              {badge}
            </Badge>
          </Group>
        )}
        title={title}
      />
    </PageCard>
  )
}
