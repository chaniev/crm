import type { ComponentPropsWithoutRef } from 'react'

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
      ? 'есть ещё'
      : loading
        ? 'обновляем'
        : ''
    : `из ${total}`

  return (
    <div
      aria-live="polite"
      className={['list-range-status', className].filter(Boolean).join(' ')}
      role="status"
      {...props}
    >
      <span>{start}–{end}</span>
      {totalText ? <span>{totalText}</span> : null}
    </div>
  )
}
