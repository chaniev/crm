import { Badge, TextInput } from '@mantine/core'
import { IconFilter, IconSearch, IconX } from '@tabler/icons-react'
import { useRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { TaskToolbarActions } from './TaskToolbarActions'
import { fe17SharedRoutingThemeText } from '../../resources/fe-17-shared-routing-theme'


export type EntityLocatorBarProps = Omit<ComponentPropsWithoutRef<'div'>, 'onChange'> & {
  accessibleLabel: string
  activeFilterCount?: number
  disabled?: boolean
  frequentActions?: ReactNode
  onChange: (value: string) => void
  onClear: () => void
  onInputBlur?: () => void
  onInputFocus?: () => void
  onOpenFilters?: () => void
  placeholder: string
  primaryAction?: ReactNode
  resultsId: string
  value: string
  visibleLabel?: string
}

export function EntityLocatorBar({
  accessibleLabel,
  activeFilterCount = 0,
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
  const hasFilterTrigger = Boolean(onOpenFilters)
  const hasActions = Boolean(hasFilterTrigger || primaryAction || frequentActions)
  const inputRef = useRef<HTMLInputElement | null>(null)

  function clearAndKeepSearchFocus() {
    onClear()
    inputRef.current?.focus()
  }

  return (
    <div
      className={['entity-locator-bar', 'crm-filter-surface', className]
        .filter(Boolean)
        .join(' ')}
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
              aria-label={fe17SharedRoutingThemeText.entityLocatorBar_ariaLabel_428def6e}
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
        {hasActions ? (
          <div className="entity-locator-bar__actions">
            {onOpenFilters ? (
              <button
                aria-haspopup="dialog"
                aria-label={
                  activeFilterCount > 0
                    ? fe17SharedRoutingThemeText.entityLocatorBar_template_e78405ae(activeFilterCount)
                    : fe17SharedRoutingThemeText.entityLocatorBar_string_1d04cab7
                }
                className="entity-locator-bar__filter"
                disabled={disabled}
                onClick={onOpenFilters}
                type="button"
              >
                <IconFilter aria-hidden="true" size={18} />
                <span className="entity-locator-bar__filter-label">{fe17SharedRoutingThemeText.entityLocatorBar_jsxText_a69757b1}</span>
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
            ) : null}
            <TaskToolbarActions
              frequentActions={frequentActions}
              primaryAction={primaryAction}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
