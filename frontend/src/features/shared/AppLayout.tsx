import {
  AppShell,
  Container,
  type AppShellProps,
  type ContainerProps,
} from '@mantine/core'
import type { ReactNode } from 'react'

type AppLayoutProps = {
  children: ReactNode
  className?: string
  containerSize?: ContainerProps['size']
  header: ReactNode
  headerHeight?: AppShellProps['header']
  mainClassName?: string
  padding?: AppShellProps['padding']
}

export function AppLayout({
  children,
  className,
  containerSize = 'xl',
  header,
  headerHeight = { height: { base: 106, lg: 120 } },
  mainClassName,
  padding = { base: 'sm', sm: 'md', lg: 'xl' },
}: AppLayoutProps) {
  return (
    <AppShell
      className={['app-shell', className].filter(Boolean).join(' ')}
      header={headerHeight}
      padding={padding}
    >
      <AppShell.Header className="app-shell__header">{header}</AppShell.Header>

      <AppShell.Main className={['app-shell__main', mainClassName].filter(Boolean).join(' ')}>
        <Container size={containerSize}>{children}</Container>
      </AppShell.Main>
    </AppShell>
  )
}
