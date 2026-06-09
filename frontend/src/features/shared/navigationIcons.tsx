import {
  IconCalendarWeek,
  IconChartBar,
  IconClipboardList,
  IconHome,
  IconSettings,
  IconUserCog,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react'
import type { AppSection } from '../../lib/api'

export function getAppSectionIcon(section: AppSection, size = 17) {
  switch (section) {
    case 'Home':
      return <IconHome size={size} />
    case 'Schedule':
      return <IconCalendarWeek size={size} />
    case 'Clients':
      return <IconUsers size={size} />
    case 'Groups':
      return <IconUsersGroup size={size} />
    case 'Users':
      return <IconUserCog size={size} />
    case 'Audit':
      return <IconClipboardList size={size} />
    case 'Finance':
      return <IconChartBar size={size} />
    case 'Settings':
      return <IconSettings size={size} />
  }
}
