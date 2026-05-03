import {
  IconCalendarCheck,
  IconClipboardList,
  IconHome,
  IconUserCog,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react'
import type { ReactNode } from 'react'
import type { AppSection } from '../../lib/api'
import { APP_SECTION_LABELS } from '../../lib/appRoutes'
import { Button } from './Button'

type NavigationTabsProps = {
  ariaLabel?: string
  className?: string
  currentSection: AppSection | null
  onNavigate: (section: AppSection) => void
  sections: readonly AppSection[]
}

const sectionIconMap: Record<AppSection, ReactNode> = {
  Home: <IconHome size={17} />,
  Attendance: <IconCalendarCheck size={17} />,
  Clients: <IconUsers size={17} />,
  Groups: <IconUsersGroup size={17} />,
  Users: <IconUserCog size={17} />,
  Audit: <IconClipboardList size={17} />,
}

export function NavigationTabs({
  ariaLabel = 'Основная навигация',
  className,
  currentSection,
  onNavigate,
  sections,
}: NavigationTabsProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={['app-shell__desktop-nav', className].filter(Boolean).join(' ')}
      data-testid="app-navigation"
    >
      {sections.map((section) => (
        <Button
          aria-current={section === currentSection ? 'page' : undefined}
          className="app-shell__nav-button"
          key={section}
          leftSection={sectionIconMap[section]}
          onClick={() => onNavigate(section)}
          size="sm"
          type="button"
          variant="pill"
        >
          {APP_SECTION_LABELS[section]}
        </Button>
      ))}
    </nav>
  )
}
