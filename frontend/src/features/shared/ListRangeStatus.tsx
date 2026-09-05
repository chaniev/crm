import type { ComponentPropsWithoutRef } from 'react'
import { fe17SharedRoutingThemeText } from '../../resources/fe-17-shared-routing-theme'


export type ListRangeStatusProps = ComponentPropsWithoutRef<'div'> & {
  end: number
  hasMore?: boolean
  loading?: boolean
  start: number
  total: number | null
}

export function ListRangeStatus({
  className,
  end,
  hasMore = false,
  loading = false,
  start,
  total,
  ...props
}: ListRangeStatusProps) {
  const totalText = total === null
    ? hasMore
      ? fe17SharedRoutingThemeText.listRangeStatus_string_81a306d7
      : loading
        ? fe17SharedRoutingThemeText.listRangeStatus_string_eaa048e3
        : ''
    : fe17SharedRoutingThemeText.listRangeStatus_template_911657b5(total)

  return (
    <div
      aria-live="polite"
      className={['list-range-status', className].filter(Boolean).join(' ')}
      role="status"
      {...props}
    >
      <span>{start}{fe17SharedRoutingThemeText.listRangeStatus_jsxText_d4f85d36}{end}</span>
      {totalText ? <span>{totalText}</span> : null}
    </div>
  )
}
