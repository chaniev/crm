import { Drawer, Text, UnstyledButton } from '@mantine/core'
import { IconDots } from '@tabler/icons-react'
import { useRef, useState } from 'react'
import type { AppSection } from '../../lib/api'
import {
  APP_SECTION_LABELS,
  getMobileNavigationSections,
} from '../../lib/appRoutes'
import { getAppSectionIcon } from './navigationIcons'
import { fe17SharedRoutingThemeText } from '../../resources/fe-17-shared-routing-theme'


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
  const overflowTriggerRef = useRef<HTMLButtonElement | null>(null)
  const { primarySections, overflowSections } = getMobileNavigationSections(
    sections,
    currentSection,
  )
  const hasOverflow = overflowSections.length > 0

  function handleNavigate(section: AppSection) {
    setOverflowOpened(false)
    onNavigate(section)
  }

  function closeOverflow() {
    setOverflowOpened(false)
    window.requestAnimationFrame(() => overflowTriggerRef.current?.focus())
  }

  if (primarySections.length === 0) {
    return null
  }

  return (
    <>
      <nav
        aria-label={fe17SharedRoutingThemeText.mobileBottomNavigation_ariaLabel_65356651}
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
              <span className="mobile-bottom-nav__label" data-no-truncate="true">
                {APP_SECTION_LABELS[section]}
              </span>
            </UnstyledButton>
          ))}

          {hasOverflow ? (
            <UnstyledButton
              aria-expanded={overflowOpened}
              aria-haspopup="dialog"
              aria-label={fe17SharedRoutingThemeText.mobileBottomNavigation_ariaLabel_da94ad10}
              className="mobile-bottom-nav__item"
              onClick={() => setOverflowOpened(true)}
              ref={overflowTriggerRef}
              type="button"
            >
              <span className="mobile-bottom-nav__icon" aria-hidden="true">
                <IconDots size={20} />
              </span>
              <span className="mobile-bottom-nav__label" data-no-truncate="true">{fe17SharedRoutingThemeText.mobileBottomNavigation_jsxText_2071fb99}</span>
            </UnstyledButton>
          ) : null}
        </div>
      </nav>

      {hasOverflow ? (
        <Drawer
          aria-label={fe17SharedRoutingThemeText.mobileBottomNavigation_ariaLabel_9b2568a1}
          classNames={{
            body: 'mobile-bottom-nav__sheet-body',
            content: 'mobile-bottom-nav__sheet-content',
            header: 'mobile-bottom-nav__sheet-header',
            title: 'mobile-bottom-nav__sheet-title',
          }}
          closeButtonProps={{
            'aria-label': fe17SharedRoutingThemeText.mobileBottomNavigation_ariaLabel_f88e31a8,
            className: 'temporary-surface-close mobile-bottom-nav__sheet-close',
          }}
          closeOnClickOutside
          closeOnEscape
          onClose={closeOverflow}
          opened={overflowOpened}
          overlayProps={{ backgroundOpacity: 0.18, blur: 2 }}
          position="bottom"
          returnFocus
          size="min(24rem, calc(100dvh - 1rem))"
          title={
            <Text component="span" fw={800}>
              {fe17SharedRoutingThemeText.mobileBottomNavigation_ariaLabel_9b2568a1}</Text>
          }
          trapFocus
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
