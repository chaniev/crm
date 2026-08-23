import {
  IconCalendarWeek,
  IconChartBar,
  IconChecklist,
  IconClipboardList,
  IconAlertTriangle,
  IconSettings,
  IconUserCog,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react'
import type { AppSection } from '../../lib/api'

export function getAppSectionIcon(section: AppSection, size = 17) {
  switch (section) {
    case 'Attendance':
      return <IconChecklist size={size} />
    case 'Attention':
      return <IconAlertTriangle size={size} />
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
