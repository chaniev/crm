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
  brandMeta?: ReactNode
  brandMetaCompact?: ReactNode
  brandTitle?: string
  containerSize?: ContainerProps['size']
  navigation?: ReactNode
  profileControl?: ReactNode
}

export function Header({
  brandIcon,
  brandMeta,
  brandMetaCompact,
  brandTitle = 'Gym CRM',
  containerSize = 'xl',
  navigation,
  profileControl,
}: HeaderProps) {
  const compactMeta = brandMetaCompact ?? brandMeta
  const desktopMeta = brandMeta ?? brandMetaCompact

  return (
    <Container className="app-shell__header-inner" size={containerSize}>
      <div className="app-shell__header-top">
        <Group className="app-shell__brand" gap="sm" wrap="nowrap">
          {brandIcon ?? (
            <ThemeIcon color="brand.7" radius="xl" size={36} variant="filled">
              <IconProgressCheck size={20} />
            </ThemeIcon>
          )}
          <div className="app-shell__brand-copy">
            <Text className="app-shell__brand-title" fw={800}>
              {brandTitle}
            </Text>
            {compactMeta ? (
              <Text c="dimmed" className="app-shell__brand-meta" hiddenFrom="lg" size="sm">
                {compactMeta}
              </Text>
            ) : null}
            {desktopMeta ? (
              <Text c="dimmed" className="app-shell__brand-meta" visibleFrom="lg" size="sm">
                {desktopMeta}
              </Text>
            ) : null}
          </div>
        </Group>

        {profileControl}
      </div>

      {navigation}
    </Container>
  )
}
