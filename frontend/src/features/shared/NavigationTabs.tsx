import type { AppSection } from '../../lib/api'
import { APP_SECTION_LABELS } from '../../lib/appRoutes'
import { Button } from './Button'
import { getAppSectionIcon } from './navigationIcons'

type NavigationTabsProps = {
  ariaLabel?: string
  className?: string
  currentSection: AppSection | null
  onNavigate: (section: AppSection) => void
  orientation?: 'horizontal' | 'vertical'
  sections: readonly AppSection[]
}

export function NavigationTabs({
  ariaLabel = 'Основная навигация',
  className,
  currentSection,
  onNavigate,
  orientation = 'horizontal',
  sections,
}: NavigationTabsProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={[
        'app-shell__navigation',
        `app-shell__navigation--${orientation}`,
        className,
      ].filter(Boolean).join(' ')}
      data-orientation={orientation}
      data-testid="app-navigation"
    >
      {sections.map((section) => (
        <Button
          aria-current={section === currentSection ? 'page' : undefined}
          className="app-shell__nav-button"
          key={section}
          leftSection={getAppSectionIcon(section)}
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
