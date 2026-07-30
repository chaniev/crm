import { Badge, TextInput } from '@mantine/core'
import { IconFilter, IconSearch, IconX } from '@tabler/icons-react'
import { useRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'

export type EntityLocatorBarProps = Omit<ComponentPropsWithoutRef<'div'>, 'onChange'> & {
  accessibleLabel: string
  activeFilterCount: number
  disabled?: boolean
  frequentActions?: ReactNode
  onChange: (value: string) => void
  onClear: () => void
  onInputBlur?: () => void
  onInputFocus?: () => void
  onOpenFilters: () => void
  placeholder: string
  primaryAction?: ReactNode
  resultsId: string
  value: string
  visibleLabel?: string
}

export function EntityLocatorBar({
  accessibleLabel,
  activeFilterCount,
  className,
  disabled = false,
  frequentActions,
  onChange,
  onClear,
  onInputBlur,
  onInputFocus,
  onOpenFilters,
  placeholder,
  primaryAction,
  resultsId,
  value,
  visibleLabel,
  ...props
}: EntityLocatorBarProps) {
  const hasActions = Boolean(primaryAction || frequentActions)
  const inputRef = useRef<HTMLInputElement | null>(null)

  function clearAndKeepSearchFocus() {
    onClear()
    inputRef.current?.focus()
  }

  return (
    <div
      className={['entity-locator-bar', className].filter(Boolean).join(' ')}
      role="search"
      {...props}
    >
      {visibleLabel ? (
        <label className="entity-locator-bar__visible-label" htmlFor={`${resultsId}-locator`}>
          {visibleLabel}
        </label>
      ) : null}
      <div className="entity-locator-bar__row">
        <TextInput
          aria-controls={resultsId}
          aria-label={accessibleLabel}
          className="entity-locator-bar__input"
          disabled={disabled}
          id={`${resultsId}-locator`}
          leftSection={<IconSearch size={18} />}
          onBlur={onInputBlur}
          onChange={(event) => onChange(event.currentTarget.value)}
          onFocus={onInputFocus}
          placeholder={placeholder}
          ref={inputRef}
          rightSection={value ? (
            <button
              aria-label="Сбросить поисковый запрос"
              className="entity-locator-bar__clear"
              disabled={disabled}
              onBlur={onInputBlur}
              onClick={clearAndKeepSearchFocus}
              onFocus={onInputFocus}
              onMouseDown={(event) => event.preventDefault()}
              type="button"
            >
              <IconX size={16} />
            </button>
          ) : null}
          rightSectionWidth={value ? 44 : undefined}
          value={value}
        />
        <div className="entity-locator-bar__actions">
          <button
            aria-haspopup="dialog"
            aria-label={
              activeFilterCount > 0
                ? `Открыть фильтры, активно ${activeFilterCount}`
                : 'Открыть фильтры'
            }
            className="entity-locator-bar__filter"
            disabled={disabled}
            onClick={onOpenFilters}
            type="button"
          >
            <IconFilter aria-hidden="true" size={18} />
            <span className="entity-locator-bar__filter-label">Фильтры</span>
            {activeFilterCount > 0 ? (
              <Badge
                className="entity-locator-bar__filter-count"
                component="span"
                size="sm"
                variant="filled"
              >
                {activeFilterCount}
              </Badge>
            ) : null}
          </button>
          {hasActions ? (
            <>
              {frequentActions}
              {primaryAction}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
