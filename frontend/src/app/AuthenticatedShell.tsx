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

type RolePresentation = {
  roleLabel: string
}

const rolePresentationMap: Record<AuthenticatedUser['role'], RolePresentation> = {
  HeadCoach: {
    roleLabel: 'Главный тренер',
  },
  SuperAdministrator: {
    roleLabel: 'Суперадминистратор',
  },
  Administrator: {
    roleLabel: 'Администратор',
  },
  Coach: {
    roleLabel: 'Тренер',
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
          aria-label={`Открыть профильное меню пользователя ${user.fullName}`}
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
          Смена пароля
        </Menu.Item>
        <Menu.Item
          color="red"
          disabled={logoutPending}
          leftSection={<IconDoorExit size={16} />}
          onClick={() => void handleLogoutAction()}
        >
          {logoutPending ? 'Завершаем сессию...' : 'Выход'}
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
