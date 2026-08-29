import {
  Alert,
  Avatar as MantineAvatar,
  Drawer,
  Group,
  Loader,
  Modal,
  Paper,
  Pagination as MantinePagination,
  Popover,
  Skeleton as MantineSkeleton,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Title,
  type AvatarProps as MantineAvatarProps,
  type MantineSpacing,
  type PaginationProps as MantinePaginationProps,
  type PaperProps,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import {
  IconAdjustmentsHorizontal,
  IconAlertCircle,
  IconFilter,
  IconFilterOff,
  IconRefresh,
} from '@tabler/icons-react'
import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
} from 'react'
import { resources } from '../../lib/resources'
import {
  getSemanticToneAttributes,
  getSemanticToneComponentProps,
} from '../../theme/semanticTones'
import { Button, type SharedButtonProps } from './Button'

type ResponsiveButtonGroupProps = {
  children: ReactNode
  gap?: MantineSpacing
  justify?: 'center' | 'flex-end' | 'flex-start' | 'space-between'
}

export function ResponsiveButtonGroup({
  children,
  gap = 'sm',
  justify = 'flex-start',
}: ResponsiveButtonGroupProps) {
  const isMobile = useMediaQuery('(max-width: 48em)')
  const normalizedChildren = Children.toArray(children)
    .filter(Boolean)
    .map((child) => {
      if (!isValidElement(child)) {
        return child
      }

      const element = child as ReactElement<Record<string, unknown>>

      return cloneElement(element, {
        ...element.props,
        fullWidth:
          isMobile || Boolean((element.props as { fullWidth?: boolean }).fullWidth),
      })
    })

  if (isMobile) {
    return <Stack gap={gap}>{normalizedChildren}</Stack>
  }

  return (
    <Group gap={gap} justify={justify} wrap="wrap">
      {normalizedChildren}
    </Group>
  )
}

type ConfirmActionModalProps = {
  opened: boolean
  title: string
  description: string
  confirmLabel: string
  pending?: boolean
  confirmColor?: string
  cancelLabel?: string
  onClose: () => void
  onConfirm: MouseEventHandler<HTMLButtonElement>
}

export function ConfirmActionModal({
  opened,
  title,
  description,
  confirmLabel,
  pending = false,
  confirmColor = 'var(--crm-action-primary)',
  cancelLabel = resources.common.actions.cancel,
  onClose,
  onConfirm,
}: ConfirmActionModalProps) {
  return (
    <Modal
      centered
      onClose={onClose}
      opened={opened}
      radius="var(--crm-radius-inner)"
      title={title}
      withCloseButton={!pending}
    >
      <Stack gap="lg">
        <Text c="dimmed" size="sm">
          {description}
        </Text>

        <ResponsiveButtonGroup justify="flex-end">
          <Button disabled={pending} onClick={onClose} variant="secondary">
            {cancelLabel}
          </Button>
          <Button color={confirmColor} loading={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </ResponsiveButtonGroup>
      </Stack>
    </Modal>
  )
}

type PageLayoutProps = ComponentPropsWithoutRef<'div'> & {
  children: ReactNode
  className?: string
  actions?: ReactNode
  renderHiddenHeading?: boolean
  showHeader?: boolean
  title: string
}

export function PageLayout({
  children,
  className,
  actions,
  renderHiddenHeading = true,
  showHeader = true,
  title,
  ...props
}: PageLayoutProps) {
  return (
    <Stack
      className={['page-layout', className].filter(Boolean).join(' ')}
      gap="var(--page-section-gap)"
      {...props}
    >
      {showHeader ? (
        <PageHeader
          actions={actions}
          className="page-layout__header"
          title={title}
          titleOrder={1}
        />
      ) : null}
      {!showHeader && renderHiddenHeading ? (
        <Title className="visually-hidden" order={1}>
          {title}
        </Title>
      ) : null}
      {children}
    </Stack>
  )
}

type PageSectionProps = PaperProps & {
  children: ReactNode
  className?: string
  density?: 'default' | 'compact'
  variant?: 'card' | 'plain'
}

export function PageSection({
  children,
  className,
  density = 'default',
  radius = 'var(--page-card-radius)',
  variant = 'card',
  ...props
}: PageSectionProps) {
  const classes = [
    'page-section',
    `page-section--${variant}`,
    `page-section--density-${density}`,
    variant === 'card' ? 'surface-card' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (variant === 'plain') {
    return (
      <div className={classes} {...(props as ComponentPropsWithoutRef<'div'>)}>
        {children}
      </div>
    )
  }

  return (
    <Paper className={classes} radius={radius} withBorder {...props}>
      {children}
    </Paper>
  )
}

type PageCardProps = Omit<PageSectionProps, 'variant'> & {
  width?: 'default' | 'wide' | 'full'
}

export function PageCard({
  children,
  className,
  width: _deprecatedWidth = 'default',
  ...props
}: PageCardProps) {
  void _deprecatedWidth

  return <PageSection className={['page-card', className].filter(Boolean).join(' ')} {...props}>{children}</PageSection>
}

type FilterToolbarProps = ComponentPropsWithoutRef<'div'> & {
  children: ReactNode
  actions?: ReactNode
  className?: string
}

export function FilterToolbar({
  children,
  actions,
  className,
  ...props
}: FilterToolbarProps) {
  return (
    <div
      className={['filter-toolbar', 'crm-filter-surface', className].filter(Boolean).join(' ')}
      {...props}
    >
      <div className="filter-toolbar__controls">{children}</div>
      {actions ? <div className="filter-toolbar__actions">{actions}</div> : null}
    </div>
  )
}

export type CompactFilterPlacement = 'inline' | 'popover' | 'sheet'

export type CompactFilterItem = {
  key: string
  label: string
  render: (placement: CompactFilterPlacement) => ReactNode
}

type CompactFilterPanelProps = ComponentPropsWithoutRef<'div'> & {
  actions?: ReactNode
  applyLabel?: string
  primary: CompactFilterItem[]
  secondary?: CompactFilterItem[]
  className?: string
  mobileLabel?: string
  moreLabel?: string
  onReset: () => void
  resetLabel?: string
  sheetTitle?: string
  showReset?: boolean
}

const compactFilterGapPx = 8
const compactFilterMobileQuery = '(max-width: 47.99em), (max-height: 30rem) and (pointer: coarse)'

export function CompactFilterPanel({
  actions,
  applyLabel = 'Готово',
  primary,
  secondary = [],
  className,
  mobileLabel = 'Фильтры',
  moreLabel = 'Ещё фильтры',
  onReset,
  resetLabel = 'Сбросить',
  sheetTitle = 'Фильтры',
  showReset = true,
  ...props
}: CompactFilterPanelProps) {
  const isMobile = useMediaQuery(compactFilterMobileQuery)
  const [moreOpened, setMoreOpened] = useState(false)
  const [sheetOpened, setSheetOpened] = useState(false)
  const [visiblePrimaryCount, setVisiblePrimaryCount] = useState(primary.length)
  const mobileRowRef = useRef<HTMLDivElement | null>(null)
  const rowRef = useRef<HTMLDivElement | null>(null)
  const widthCacheRef = useRef<{
    filters: Map<string, number>
    more: number
    reset: number
  }>({
    filters: new Map(),
    more: 0,
    reset: 0,
  })
  const hasSecondaryFilters = secondary.length > 0
  const hasMoreAction = hasSecondaryFilters
  const canOverflowPrimary = hasSecondaryFilters

  const measureLayout = useCallback(() => {
    if (!canOverflowPrimary || isMobile) {
      setVisiblePrimaryCount(primary.length)
      return
    }

    const row = rowRef.current

    if (!row) {
      setVisiblePrimaryCount(primary.length)
      return
    }

    const availableWidth = row.clientWidth

    if (availableWidth <= 0) {
      setVisiblePrimaryCount(primary.length)
      return
    }

    row.querySelectorAll<HTMLElement>('[data-filter-key]').forEach((node) => {
      const key = node.dataset.filterKey

      if (key && node.offsetWidth > 0) {
        widthCacheRef.current.filters.set(key, node.offsetWidth)
      }
    })

    const moreNode = row.querySelector<HTMLElement>('.compact-filter-panel__more')
    const resetNode = row.querySelector<HTMLElement>('.compact-filter-panel__reset')

    if (moreNode && moreNode.offsetWidth > 0) {
      widthCacheRef.current.more = moreNode.offsetWidth
    }

    if (resetNode && resetNode.offsetWidth > 0) {
      widthCacheRef.current.reset = resetNode.offsetWidth
    }

    const primaryWidths = primary.map((item) =>
      widthCacheRef.current.filters.get(item.key) ??
      getEstimatedCompactFilterWidth(item.label),
    )
    const moreWidth = widthCacheRef.current.more ||
      getEstimatedCompactActionWidth(moreLabel)
    const resetWidth = showReset
      ? widthCacheRef.current.reset || getEstimatedCompactActionWidth(resetLabel)
      : 0

    const actionCount = Number(hasMoreAction) + Number(showReset)
    const actionWidth =
      (hasMoreAction ? moreWidth : 0) +
      resetWidth +
      Math.max(0, actionCount - 1) * compactFilterGapPx

    let nextVisibleCount = primary.length

    while (nextVisibleCount > 0) {
      const primaryWidth = primaryWidths
        .slice(0, nextVisibleCount)
        .reduce((sum, width) => sum + width, 0)
      const primaryGapWidth = Math.max(0, nextVisibleCount - 1) *
        compactFilterGapPx
      const rowGapWidth = nextVisibleCount > 0 ? compactFilterGapPx : 0
      const requiredWidth =
        primaryWidth + primaryGapWidth + rowGapWidth + actionWidth

      if (requiredWidth <= availableWidth) {
        break
      }

      nextVisibleCount -= 1
    }

    setVisiblePrimaryCount(nextVisibleCount)
  }, [canOverflowPrimary, hasMoreAction, isMobile, moreLabel, primary, resetLabel, showReset])

  useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(measureLayout)

    return () => window.cancelAnimationFrame(frameId)
  }, [measureLayout])

  useEffect(() => {
    const row = rowRef.current

    if (!row || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measureLayout)
      return () => window.removeEventListener('resize', measureLayout)
    }

    const observer = new ResizeObserver(measureLayout)
    observer.observe(row)

    return () => observer.disconnect()
  }, [measureLayout])

  const [visiblePrimary, overflowedPrimary] = useMemo(() => {
    if (!canOverflowPrimary) {
      return [primary, []] as const
    }

    return [
      primary.slice(0, visiblePrimaryCount),
      primary.slice(visiblePrimaryCount),
    ] as const
  }, [canOverflowPrimary, primary, visiblePrimaryCount])
  const moreFilters = useMemo(
    () => [...overflowedPrimary, ...secondary],
    [overflowedPrimary, secondary],
  )
  const allFilters = useMemo(
    () => [...primary, ...secondary],
    [primary, secondary],
  )

  function handleReset() {
    onReset()
  }

  function closeMobileSheet() {
    setSheetOpened(false)
    window.requestAnimationFrame(() =>
      mobileRowRef.current
        ?.querySelector<HTMLButtonElement>(
          '.compact-filter-panel__mobile-launcher',
        )
        ?.focus(),
    )
  }

  function renderFilterItem(
    item: CompactFilterItem,
    placement: CompactFilterPlacement,
  ) {
    return (
      <div
        className={[
          'compact-filter-panel__item',
          `compact-filter-panel__item--${placement}`,
        ].join(' ')}
        data-filter-key={item.key}
        key={item.key}
      >
        {item.render(placement)}
      </div>
    )
  }

  const resetButton = (
    <Button
      className="compact-filter-panel__action compact-filter-panel__reset"
      leftSection={<IconFilterOff size={16} />}
      onClick={handleReset}
      type="button"
      variant="secondary"
    >
      {resetLabel}
    </Button>
  )

  const moreButton = (
    <Button
      className="compact-filter-panel__action compact-filter-panel__more"
      leftSection={<IconAdjustmentsHorizontal size={16} />}
      type="button"
      variant="secondary"
    >
      {moreLabel}
    </Button>
  )

  if (isMobile) {
    return (
      <div
        className={[
          'filter-toolbar',
          'crm-filter-surface',
          'compact-filter-panel',
          'compact-filter-panel--mobile',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        <div className="compact-filter-panel__mobile-row" ref={mobileRowRef}>
          <Button
            className="compact-filter-panel__mobile-launcher"
            fullWidth
            leftSection={<IconFilter size={16} />}
            onClick={() => setSheetOpened(true)}
            type="button"
            variant="secondary"
          >
            {mobileLabel}
          </Button>
          {actions ? (
            <div className="compact-filter-panel__custom-actions">{actions}</div>
          ) : null}
        </div>
        <Drawer
          classNames={{
            body: 'compact-filter-panel__sheet-body',
            content: 'compact-filter-panel__sheet-content',
            header: 'compact-filter-panel__sheet-header',
          }}
          closeButtonProps={{
            'aria-label': 'Закрыть фильтры',
            className: 'temporary-surface-close compact-filter-panel__sheet-close',
          }}
          closeOnEscape
          onClose={closeMobileSheet}
          opened={sheetOpened}
          position="bottom"
          returnFocus
          size="100%"
          title={sheetTitle}
          transitionProps={{ duration: 0 }}
          withCloseButton
          zIndex={300}
        >
          <div className="compact-filter-panel__sheet-fields">
            {allFilters.map((item) => renderFilterItem(item, 'sheet'))}
          </div>
          <div className="compact-filter-panel__sheet-actions">
            <Button
              onClick={closeMobileSheet}
              type="button"
            >
              {applyLabel}
            </Button>
            {showReset ? (
              <Button
                leftSection={<IconFilterOff size={16} />}
                onClick={handleReset}
                type="button"
                variant="secondary"
              >
                {resetLabel}
              </Button>
            ) : null}
          </div>
        </Drawer>
      </div>
    )
  }

  return (
    <div
      className={[
        'filter-toolbar',
        'crm-filter-surface',
        'compact-filter-panel',
        'compact-filter-panel--desktop',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <div className="compact-filter-panel__desktop-row" ref={rowRef}>
        <div className="compact-filter-panel__primary-row">
          {visiblePrimary.map((item) => renderFilterItem(item, 'inline'))}
        </div>
        <div className="compact-filter-panel__actions">
          {hasMoreAction ? (
            <Popover
              onChange={setMoreOpened}
              opened={moreOpened}
              position="bottom-end"
              shadow="none"
              trapFocus
              width={320}
              withinPortal
            >
              <Popover.Target>
                {cloneElement(moreButton, {
                  onClick: () => setMoreOpened((opened) => !opened),
                } as Partial<SharedButtonProps>)}
              </Popover.Target>
              <Popover.Dropdown className="compact-filter-panel__popover">
                <Stack gap="sm">
                  {moreFilters.map((item) => renderFilterItem(item, 'popover'))}
                </Stack>
              </Popover.Dropdown>
            </Popover>
          ) : null}
          {actions ? (
            <div className="compact-filter-panel__custom-actions">{actions}</div>
          ) : null}
          {showReset ? resetButton : null}
        </div>
      </div>
    </div>
  )
}

function getEstimatedCompactFilterWidth(label: string) {
  return Math.min(220, Math.max(140, label.length * 8 + 56))
}

function getEstimatedCompactActionWidth(label: string) {
  return Math.min(180, Math.max(112, label.length * 8 + 48))
}

type PageHeaderProps = {
  title?: string
  titleId?: string
  className?: string
  description?: string
  actions?: ReactNode
  eyebrow?: ReactNode
  titleOrder?: 1 | 2 | 3 | 4 | 5 | 6
}

export function PageHeader({
  title,
  titleId,
  className,
  description,
  actions,
  eyebrow,
  titleOrder = 2,
}: PageHeaderProps) {
  const hasCopy = Boolean(title || description || eyebrow)

  return (
    <Group
      className={['page-header', className].filter(Boolean).join(' ')}
      justify={hasCopy ? 'space-between' : 'flex-end'}
      wrap="wrap"
    >
      {hasCopy ? (
        <Stack className="page-header__copy" gap={6}>
          {eyebrow ? (
            <div className="page-header__eyebrow">{eyebrow}</div>
          ) : null}
          {title ? (
            <Title className="page-header__title" id={titleId} order={titleOrder}>
              {title}
            </Title>
          ) : null}
          {description ? (
            <Text c="dimmed" className="page-header__description" size="sm">
              {description}
            </Text>
          ) : null}
        </Stack>
      ) : null}

      {actions ? <Group className="page-header__actions">{actions}</Group> : null}
    </Group>
  )
}

type SectionHeaderProps = PageHeaderProps

export function SectionHeader({
  className,
  titleOrder = 2,
  ...props
}: SectionHeaderProps) {
  return (
    <PageHeader
      className={['section-header', className].filter(Boolean).join(' ')}
      titleOrder={titleOrder}
      {...props}
    />
  )
}

type PageTabsPanelProps = ComponentPropsWithoutRef<typeof Tabs.Panel> & {
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function PageTabsPanel({
  children,
  className,
  contentClassName,
  ...props
}: PageTabsPanelProps) {
  return (
    <Tabs.Panel
      className={['page-tabs-panel', className].filter(Boolean).join(' ')}
      {...props}
    >
      <div
        className={['page-tabs-panel__content', contentClassName]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </div>
    </Tabs.Panel>
  )
}

type RefreshButtonProps = Omit<SharedButtonProps, 'children'> &
  ComponentPropsWithoutRef<'button'> & {
  label?: string
}

export function RefreshButton({
  label = resources.common.actions.refresh,
  leftSection = <IconRefresh size={18} />,
  loading = false,
  disabled,
  variant = 'pill',
  ...props
}: RefreshButtonProps) {
  return (
    <Button
      aria-label={label}
      className="refresh-button"
      disabled={disabled || loading}
      leftSection={leftSection}
      loading={loading}
      variant={variant}
      {...props}
    >
      {label}
    </Button>
  )
}

type EmptyStateProps = {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <Paper className="empty-state" radius="var(--radius-inner)" withBorder>
      <Stack align="center" gap="sm">
        {icon ? (
          <ThemeIcon className="empty-state__icon" radius="xl" size={56} variant="light">
            {icon}
          </ThemeIcon>
        ) : null}
        <Stack align="center" gap={4}>
          <Text className="empty-state__title" fw={800} ta="center">
            {title}
          </Text>
          {description ? (
            <Text c="dimmed" className="empty-state__description" size="sm" ta="center">
              {description}
            </Text>
          ) : null}
        </Stack>
        {action ? <div className="empty-state__action">{action}</div> : null}
      </Stack>
    </Paper>
  )
}

type AppPaginationProps = Omit<
  MantinePaginationProps,
  | 'getControlProps'
  | 'getItemProps'
  | 'onChange'
  | 'total'
  | 'value'
  | 'withPages'
> & {
  label: string
  page: number
  total: number
  onChange: (page: number) => void
  disabled?: boolean
  nextLabel?: string
  previousLabel?: string
  pageLabel?: (page: number, currentPage: number) => string
  summary?: ReactNode
}

export function AppPagination({
  className,
  disabled,
  label,
  nextLabel = 'Дальше',
  onChange,
  page,
  pageLabel = getDefaultPageLabel,
  previousLabel = 'Назад',
  summary,
  total,
  ...props
}: AppPaginationProps) {
  const isCompact = useMediaQuery('(max-width: 47.99em)', undefined, {
    getInitialValueInEffect: false,
  })

  if (total <= 1) {
    return null
  }

  return (
    <Group
      aria-label={label}
      className={['app-pagination', className].filter(Boolean).join(' ')}
      justify={summary ? 'space-between' : 'center'}
      role="navigation"
      wrap="wrap"
    >
      {summary ? (
        <Text c="dimmed" className="app-pagination__summary" size="sm">
          {summary}
        </Text>
      ) : null}
      <MantinePagination
        disabled={disabled}
        getControlProps={(control) => ({
          'aria-label':
            control === 'previous'
              ? previousLabel
              : control === 'next'
                ? nextLabel
                : undefined,
        })}
        getItemProps={(pageNumber) => ({
          'aria-label': pageLabel(pageNumber, page),
        })}
        onChange={onChange}
        siblings={1}
        total={total}
        value={page}
        withPages={!isCompact}
        {...props}
      />
    </Group>
  )
}

function getDefaultPageLabel(pageNumber: number, currentPage: number) {
  return pageNumber === currentPage
    ? `Страница ${pageNumber}, текущая`
    : `Страница ${pageNumber}`
}

type ClientAvatarProps = Omit<
  MantineAvatarProps,
  'children' | 'name' | 'src'
> & {
  name: string
  src?: string | null
  ariaLabel?: string
  onError?: ComponentPropsWithoutRef<'div'>['onError']
}

export function ClientAvatar({
  ariaLabel,
  name,
  onError,
  src,
  ...props
}: ClientAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const resolvedSrc = src && failedSrc !== src ? src : undefined
  const initials = getInitials(name)

  return (
    <MantineAvatar
      aria-label={ariaLabel ?? name}
      alt={ariaLabel ?? name}
      name={name}
      onError={(event) => {
        if (src) {
          setFailedSrc(src)
        }

        onError?.(event)
      }}
      src={resolvedSrc}
      {...props}
    >
      {initials}
    </MantineAvatar>
  )
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/u)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)

  if (parts.length === 0) {
    return '?'
  }

  const initialsSource =
    parts.length === 1
      ? parts[0].slice(0, 2)
      : `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`

  return initialsSource.toLocaleUpperCase('ru-RU')
}

type LoadingStateProps = {
  description?: string
  label?: string
}

export function LoadingState({
  description,
  label = 'Загружаем данные...',
}: LoadingStateProps) {
  return (
    <Group
      aria-busy="true"
      aria-live="polite"
      className="state-panel state-panel--loading"
      data-crm-progress-state="loading"
      justify="center"
      role="status"
    >
      <Loader />
      <Stack gap={2}>
        <Text c="dimmed" fw={600} size="sm">
          {label}
        </Text>
        {description ? (
          <Text c="dimmed" size="sm">
            {description}
          </Text>
        ) : null}
      </Stack>
    </Group>
  )
}

type ErrorStateProps = {
  title: string
  message: string
  action?: ReactNode
}

export function ErrorState({ title, message, action }: ErrorStateProps) {
  return (
    <Alert
      {...getSemanticToneAttributes('danger')}
      className="state-panel state-panel--error"
      color={getSemanticToneComponentProps('danger').color}
      icon={<IconAlertCircle size={18} />}
      role="alert"
      title={title}
      variant="light"
    >
      <Stack gap="sm">
        <Text size="sm">{message}</Text>
        {action ? <div>{action}</div> : null}
      </Stack>
    </Alert>
  )
}

type SkeletonProps = ComponentPropsWithoutRef<typeof MantineSkeleton> & {
  className?: string
  gap?: MantineSpacing
  rowHeight?: number
  rows?: number
}

export function Skeleton({
  className,
  gap = 'sm',
  rowHeight = 72,
  rows,
  ...props
}: SkeletonProps) {
  if (rows === undefined && Object.keys(props).length > 0) {
    return <MantineSkeleton aria-hidden="true" className={className} {...props} />
  }

  const dataTestId = (props as { 'data-testid'?: string })['data-testid']

  return (
    <Stack aria-hidden="true" className={className} data-testid={dataTestId} gap={gap}>
      {Array.from({ length: rows ?? 3 }, (_, index) => (
        <MantineSkeleton
          className="skeleton-row"
          height={rowHeight}
          key={index}
        />
      ))}
    </Stack>
  )
}

export { AppLayout } from './AppLayout'
export { ActiveFiltersBar, type ActiveFilter } from './ActiveFiltersBar'
export { Button } from './Button'
export { EntityLocatorBar } from './EntityLocatorBar'
export { Header } from './Header'
export { IconButton } from './IconButton'
export { ListRangeStatus } from './ListRangeStatus'
export { MobileBottomNavigation } from './MobileBottomNavigation'
export { NavigationTabs } from './NavigationTabs'
export { RestrictedState } from './RestrictedState'
export {
  TaskToolbarAction,
  TaskToolbarActions,
  TaskToolbarRefreshAction,
} from './TaskToolbarActions'
export { TaskItem, type TaskItemInteraction } from './TaskItem'
export { StickyFormActions } from './StickyFormActions'
export { TemporarySurfaceFooter } from './TemporarySurfaceFooter'
