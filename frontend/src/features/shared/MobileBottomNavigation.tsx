import {
  Drawer,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { IconDots } from '@tabler/icons-react'
import { useState } from 'react'
import type { AppSection } from '../../lib/api'
import {
  APP_SECTION_LABELS,
  getMobileNavigationSections,
} from '../../lib/appRoutes'
import { getAppSectionIcon } from './navigationIcons'

type MobileBottomNavigationProps = {
  currentSection: AppSection | null
  onNavigate: (section: AppSection) => void
  sections: readonly AppSection[]
}

export function MobileBottomNavigation({
  currentSection,
  onNavigate,
  sections,
}: MobileBottomNavigationProps) {
  const [overflowOpened, setOverflowOpened] = useState(false)
  const { primarySections, overflowSections } = getMobileNavigationSections(sections)
  const hasOverflow = overflowSections.length > 0
  const overflowIsActive = Boolean(
    currentSection && overflowSections.includes(currentSection),
  )

  function handleNavigate(section: AppSection) {
    setOverflowOpened(false)
    onNavigate(section)
  }

  if (primarySections.length === 0) {
    return null
  }

  return (
    <>
      <nav
        aria-label="Мобильная навигация"
        className="mobile-bottom-nav"
        data-testid="mobile-bottom-navigation"
      >
        <div className="mobile-bottom-nav__inner">
          {primarySections.map((section) => (
            <UnstyledButton
              aria-current={section === currentSection ? 'page' : undefined}
              className="mobile-bottom-nav__item"
              data-active={section === currentSection ? 'true' : undefined}
              key={section}
              onClick={() => handleNavigate(section)}
              type="button"
            >
              <span className="mobile-bottom-nav__icon" aria-hidden="true">
                {getAppSectionIcon(section, 20)}
              </span>
              <span className="mobile-bottom-nav__label">
                {APP_SECTION_LABELS[section]}
              </span>
            </UnstyledButton>
          ))}

          {hasOverflow ? (
            <UnstyledButton
              aria-current={overflowIsActive ? 'page' : undefined}
              aria-expanded={overflowOpened}
              aria-haspopup="dialog"
              aria-label="Открыть остальные разделы"
              className="mobile-bottom-nav__item"
              data-active={overflowIsActive ? 'true' : undefined}
              onClick={() => setOverflowOpened(true)}
              type="button"
            >
              <span className="mobile-bottom-nav__icon" aria-hidden="true">
                <IconDots size={20} />
              </span>
              <span className="mobile-bottom-nav__label">Еще</span>
            </UnstyledButton>
          ) : null}
        </div>
      </nav>

      {hasOverflow ? (
        <Drawer
          aria-label="Остальные разделы"
          classNames={{
            body: 'mobile-bottom-nav__sheet-body',
            content: 'mobile-bottom-nav__sheet-content',
            header: 'mobile-bottom-nav__sheet-header',
            title: 'mobile-bottom-nav__sheet-title',
          }}
          onClose={() => setOverflowOpened(false)}
          opened={overflowOpened}
          overlayProps={{ backgroundOpacity: 0.18, blur: 2 }}
          position="bottom"
          size="min(70vh, 24rem)"
          title="Остальные разделы"
          withCloseButton
        >
          <div className="mobile-bottom-nav__overflow-list">
            {overflowSections.map((section) => (
              <UnstyledButton
                aria-current={section === currentSection ? 'page' : undefined}
                className="mobile-bottom-nav__overflow-item"
                data-active={section === currentSection ? 'true' : undefined}
                key={section}
                onClick={() => handleNavigate(section)}
                type="button"
              >
                <span className="mobile-bottom-nav__overflow-icon" aria-hidden="true">
                  {getAppSectionIcon(section, 20)}
                </span>
                <Text component="span" fw={800}>
                  {APP_SECTION_LABELS[section]}
                </Text>
              </UnstyledButton>
            ))}
          </div>
        </Drawer>
      ) : null}
    </>
  )
}
