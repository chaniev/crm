import type { ReactNode } from 'react'
import { Menu, UnstyledButton } from '@mantine/core'
import {
  IconChevronDown,
  IconDoorExit,
  IconLockPassword,
  IconUserCircle,
} from '@tabler/icons-react'
import type { AppSection, AuthenticatedUser } from '../lib/api'
import { getAccessibleNavigationSections } from '../lib/appRoutes'
import {
  AppLayout,
  Header,
  MobileBottomNavigation,
  NavigationTabs,
} from '../features/shared/ux'
import { fe1AppShellAuthText } from '../resources/fe-1-app-shell-auth'


type RolePresentation = {
  roleLabel: string
}

const rolePresentationMap: Record<AuthenticatedUser['role'], RolePresentation> = {
  HeadCoach: {
    roleLabel: fe1AppShellAuthText.authenticatedShell_roleLabel_6d711278,
  },
  SuperAdministrator: {
    roleLabel: fe1AppShellAuthText.authenticatedShell_roleLabel_ba0c95d4,
  },
  Administrator: {
    roleLabel: fe1AppShellAuthText.authenticatedShell_roleLabel_6c771997,
  },
  Coach: {
    roleLabel: fe1AppShellAuthText.authenticatedShell_roleLabel_894d7ecc,
  },
}

type AuthenticatedShellProps = {
  clubName: string
  user: AuthenticatedUser
  currentSection: AppSection | null
  logoutPending: boolean
  mainLabel: string
  onNavigateSection: (section: AppSection) => void
  onOpenPassword: () => void
  onLogout: () => Promise<void>
  children: ReactNode
}

export function AuthenticatedShell({
  clubName,
  user,
  currentSection,
  logoutPending,
  mainLabel,
  onNavigateSection,
  onOpenPassword,
  onLogout,
  children,
}: AuthenticatedShellProps) {
  const presentation = rolePresentationMap[user.role]
  const navigationSections = getAccessibleNavigationSections(user)

  function handleSectionNavigation(section: AppSection) {
    onNavigateSection(section)
  }

  function handleOpenPassword() {
    onOpenPassword()
  }

  async function handleLogoutAction() {
    await onLogout()
  }

  const profileControl = (
    <Menu position="bottom-end" shadow="md" width={250}>
      <Menu.Target>
        <UnstyledButton
          aria-label={fe1AppShellAuthText.authenticatedShell_template_4d237756(user.fullName)}
          className="app-shell__profile-trigger"
        >
          <IconUserCircle size={18} />
          <span className="app-shell__profile-name">{user.fullName}</span>
          <IconChevronDown className="app-shell__profile-chevron" size={16} />
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>{user.fullName}</Menu.Label>
        <Menu.Label>{presentation.roleLabel}</Menu.Label>
        <Menu.Item
          leftSection={<IconLockPassword size={16} />}
          onClick={handleOpenPassword}
        >
          {fe1AppShellAuthText.authenticatedShell_jsxText_354d5f5b}</Menu.Item>
        <Menu.Item
          color="red"
          disabled={logoutPending}
          leftSection={<IconDoorExit size={16} />}
          onClick={() => void handleLogoutAction()}
        >
          {logoutPending ? fe1AppShellAuthText.authenticatedShell_string_29b1d990 : fe1AppShellAuthText.authenticatedShell_string_75cd24c3}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )

  const shellNavigation = (
    <div className="app-shell__navbar-inner">
      <NavigationTabs
        className="app-shell__side-nav"
        currentSection={currentSection}
        onNavigate={handleSectionNavigation}
        orientation="vertical"
        sections={navigationSections}
      />
    </div>
  )

  return (
    <>
      <AppLayout
        header={(
          <Header
            brandTitle={clubName}
            profileControl={profileControl}
          />
        )}
        navbar={shellNavigation}
        mainLabel={mainLabel}
      >
        {children}
      </AppLayout>

      <MobileBottomNavigation
        currentSection={currentSection}
        onNavigate={handleSectionNavigation}
        sections={navigationSections}
      />
    </>
  )
}
