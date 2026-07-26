import { IconX } from '@tabler/icons-react'
import type { ComponentPropsWithoutRef } from 'react'

export type ActiveFilter = {
  id: string
  label: string
  onRemove: () => void
}

export type ActiveFiltersBarProps = ComponentPropsWithoutRef<'div'> & {
  filters: readonly ActiveFilter[]
  onReset: () => void
  resetLabel: string
}

export function ActiveFiltersBar({
  className,
  filters,
  onReset,
  resetLabel,
  ...props
}: ActiveFiltersBarProps) {
  if (filters.length === 0) {
    return null
  }

  return (
    <div
      aria-label="Активные фильтры"
      aria-live="polite"
      className={['active-filters-bar', className].filter(Boolean).join(' ')}
      role="region"
      {...props}
    >
      <div className="active-filters-bar__items">
        {filters.map((filter) => (
          <button
            aria-label={`Удалить фильтр «${filter.label}»`}
            className="active-filters-bar__item"
            key={filter.id}
            onClick={filter.onRemove}
            type="button"
          >
            <span>{filter.label}</span>
            <IconX aria-hidden="true" size={16} />
          </button>
        ))}
      </div>
      <button
        className="active-filters-bar__reset"
        onClick={onReset}
        type="button"
      >
        {resetLabel}
      </button>
    </div>
  )
}
