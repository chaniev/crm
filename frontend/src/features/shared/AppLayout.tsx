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
  navbar?: ReactNode
  navbarConfiguration?: AppShellProps['navbar']
  padding?: AppShellProps['padding']
}

const defaultNavbarConfiguration: AppShellProps['navbar'] = {
  width: 232,
  breakpoint: 'lg',
  collapsed: { mobile: true },
}

export function AppLayout({
  children,
  className,
  containerSize = 'xl',
  header,
  headerHeight = { height: { base: 106, lg: 76 } },
  mainClassName,
  navbar,
  navbarConfiguration = defaultNavbarConfiguration,
  padding = { base: 'sm', sm: 'md', lg: 'xl' },
}: AppLayoutProps) {
  return (
    <AppShell
      className={['app-shell', className].filter(Boolean).join(' ')}
      header={headerHeight}
      navbar={navbar ? navbarConfiguration : undefined}
      padding={padding}
    >
      <AppShell.Header className="app-shell__header">{header}</AppShell.Header>

      {navbar ? (
        <AppShell.Navbar className="app-shell__navbar" role="presentation">
          {navbar}
        </AppShell.Navbar>
      ) : null}

      <AppShell.Main className={['app-shell__main', mainClassName].filter(Boolean).join(' ')}>
        <Container size={containerSize}>{children}</Container>
      </AppShell.Main>
    </AppShell>
  )
}
