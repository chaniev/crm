import type { MouseEvent } from 'react'
import type { AppSection } from '../../lib/api'
import { getRoutePath } from '../../lib/appRoutes'

export function getSectionLinkProps(section: AppSection, navigate: (section: AppSection) => void) {
  return {
    href: getRoutePath({ kind: 'section', section }),
    onClick(event: MouseEvent<HTMLAnchorElement>) {
      if (event.defaultPrevented || event.button !== 0
        || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return
      }

      event.preventDefault()
      navigate(section)
    },
  }
}
