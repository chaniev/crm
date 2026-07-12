import {
  Alert,
  Drawer,
  Group,
  Loader,
  Modal,
  Paper,
  Popover,
  Skeleton as MantineSkeleton,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Title,
  type MantineSpacing,
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
  onClose: () => void
  onConfirm: MouseEventHandler<HTMLButtonElement>
}

export function ConfirmActionModal({
  opened,
  title,
  description,
  confirmLabel,
  pending = false,
  confirmColor = 'brand.7',
  onClose,
  onConfirm,
}: ConfirmActionModalProps) {
  return (
    <Modal
      centered
      onClose={onClose}
      opened={opened}
      radius="24px"
      title={title}
      withCloseButton={!pending}
    >
      <Stack gap="lg">
        <Text c="dimmed" size="sm">
          {description}
        </Text>

        <ResponsiveButtonGroup justify="flex-end">
          <Button disabled={pending} onClick={onClose} variant="secondary">
            {resources.common.actions.cancel}
          </Button>
          <Button color={confirmColor} loading={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </ResponsiveButtonGroup>
      </Stack>
    </Modal>
  )
}

type MetricCardProps = {
  description: string
  label: string
  value: string
}

export function MetricCard({
  description,
  label,
  value,
}: MetricCardProps) {
  return (
    <Paper className="surface-card metric-card" radius="var(--page-card-radius)" withBorder>
      <Stack gap={6}>
        <Text c="dimmed" fw={600} size="sm">
          {label}
        </Text>
        <Title order={3}>{value}</Title>
        <Text c="dimmed" size="sm">
          {description}
        </Text>
      </Stack>
    </Paper>
  )
}

type PageLayoutProps = ComponentPropsWithoutRef<'div'> & {
  children: ReactNode
  className?: string
  description?: string
  actions?: ReactNode
  eyebrow?: ReactNode
  showHeader?: boolean
  title: string
}

export function PageLayout({
  children,
  className,
  description,
  actions,
  eyebrow,
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
          description={description}
          eyebrow={eyebrow}
          title={title}
          titleOrder={1}
        />
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
      className={['filter-toolbar', className].filter(Boolean).join(' ')}
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
}

const compactFilterGapPx = 8
const compactFilterMobileQuery = '(max-width: 47.99em)'

export function CompactFilterPanel({
  actions,
  applyLabel = 'Применить',
  primary,
  secondary = [],
  className,
  mobileLabel = 'Фильтры',
  moreLabel = 'Ещё фильтры',
  onReset,
  resetLabel = 'Сбросить',
  sheetTitle = 'Фильтры',
  ...props
}: CompactFilterPanelProps) {
  const isMobile = useMediaQuery(compactFilterMobileQuery)
  const [moreOpened, setMoreOpened] = useState(false)
  const [sheetOpened, setSheetOpened] = useState(false)
  const [visiblePrimaryCount, setVisiblePrimaryCount] = useState(primary.length)
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
    const resetWidth = widthCacheRef.current.reset ||
      getEstimatedCompactActionWidth(resetLabel)

    const actionCount = hasMoreAction ? 2 : 1
    const actionWidth =
      moreWidth + resetWidth + (actionCount - 1) * compactFilterGapPx

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
  }, [canOverflowPrimary, hasMoreAction, isMobile, moreLabel, primary, resetLabel])

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
          'compact-filter-panel',
          'compact-filter-panel--mobile',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        <div className="compact-filter-panel__mobile-row">
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
          onClose={() => setSheetOpened(false)}
          opened={sheetOpened}
          position="bottom"
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
              leftSection={<IconFilterOff size={16} />}
              onClick={handleReset}
              type="button"
              variant="secondary"
            >
              {resetLabel}
            </Button>
            <Button
              onClick={() => setSheetOpened(false)}
              type="button"
            >
              {applyLabel}
            </Button>
          </div>
        </Drawer>
      </div>
    )
  }

  return (
    <div
      className={[
        'filter-toolbar',
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
          {resetButton}
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
  className?: string
  description?: string
  actions?: ReactNode
  eyebrow?: ReactNode
  titleOrder?: 1 | 2 | 3 | 4 | 5 | 6
}

export function PageHeader({
  title,
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
            <Title className="page-header__title" order={titleOrder}>
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

type LoadingStateProps = {
  label?: string
}

export function LoadingState({ label = 'Загружаем данные...' }: LoadingStateProps) {
  return (
    <Group className="state-panel state-panel--loading" justify="center">
      <Loader color="brand.7" size="sm" />
      <Text c="dimmed" fw={600} size="sm">
        {label}
      </Text>
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
      className="state-panel state-panel--error"
      color="red"
      icon={<IconAlertCircle size={18} />}
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

type SkeletonProps = {
  rows?: number
}

export function Skeleton({ rows = 3 }: SkeletonProps) {
  return (
    <Stack gap="sm">
      {Array.from({ length: rows }, (_, index) => (
        <MantineSkeleton className="skeleton-row" height={72} key={index} radius="md" />
      ))}
    </Stack>
  )
}

export { AppLayout } from './AppLayout'
export { Button } from './Button'
export { Header } from './Header'
export { IconButton } from './IconButton'
export { MobileBottomNavigation } from './MobileBottomNavigation'
export { NavigationTabs } from './NavigationTabs'
