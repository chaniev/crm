import {
  Container,
  Group,
  Text,
  ThemeIcon,
  type ContainerProps,
} from '@mantine/core'
import { IconProgressCheck } from '@tabler/icons-react'
import type { ReactNode } from 'react'

type HeaderProps = {
  brandIcon?: ReactNode
  brandTitle?: string
  containerSize?: ContainerProps['size']
  leadingControl?: ReactNode
  navigation?: ReactNode
  profileControl?: ReactNode
}

export function Header({
  brandIcon,
  brandTitle = 'Gym CRM',
  containerSize = '100%',
  leadingControl,
  navigation,
  profileControl,
}: HeaderProps) {
  return (
    <Container className="app-shell__header-inner" size={containerSize}>
      <div className="app-shell__header-top">
        {leadingControl}

        <Group className="app-shell__brand" gap="sm" wrap="nowrap">
          {brandIcon ?? (
            <ThemeIcon color="var(--crm-action-primary)" radius="xl" size={36} variant="filled">
              <IconProgressCheck size={20} />
            </ThemeIcon>
          )}
          <div className="app-shell__brand-copy">
            <Text className="app-shell__brand-title" fw={800} title={brandTitle}>
              {brandTitle}
            </Text>
          </div>
        </Group>

        {profileControl}
      </div>

      {navigation}
    </Container>
  )
}
