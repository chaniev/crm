const sharedSourceRoot = 'frontend/src/features/shared/'

export const sharedComponentInventory = [
  { name: 'ActiveFiltersBar', source: `${sharedSourceRoot}ActiveFiltersBar.tsx` },
  { name: 'AppLayout', source: `${sharedSourceRoot}AppLayout.tsx` },
  { name: 'AppPagination', source: `${sharedSourceRoot}ux.tsx` },
  { name: 'Button', source: `${sharedSourceRoot}Button.tsx` },
  { name: 'ClientAvatar', source: `${sharedSourceRoot}ux.tsx` },
  { name: 'CompactFilterPanel', source: `${sharedSourceRoot}ux.tsx` },
  { name: 'ConfirmActionModal', source: `${sharedSourceRoot}ux.tsx` },
  { name: 'EmptyState', source: `${sharedSourceRoot}ux.tsx` },
  { name: 'EntityLocatorBar', source: `${sharedSourceRoot}EntityLocatorBar.tsx` },
  { name: 'ErrorState', source: `${sharedSourceRoot}ux.tsx` },
  { name: 'FilterToolbar', source: `${sharedSourceRoot}ux.tsx` },
  { name: 'Header', source: `${sharedSourceRoot}Header.tsx` },
  { name: 'IconButton', source: `${sharedSourceRoot}IconButton.tsx` },
  { name: 'ListRangeStatus', source: `${sharedSourceRoot}ListRangeStatus.tsx` },
  { name: 'LoadingState', source: `${sharedSourceRoot}ux.tsx` },
  { name: 'MobileBottomNavigation', source: `${sharedSourceRoot}MobileBottomNavigation.tsx` },
  { name: 'NavigationTabs', source: `${sharedSourceRoot}NavigationTabs.tsx` },
  { name: 'PageCard', source: `${sharedSourceRoot}ux.tsx` },
  { name: 'PageHeader', source: `${sharedSourceRoot}ux.tsx` },
  { name: 'PageLayout', source: `${sharedSourceRoot}ux.tsx` },
  { name: 'PageSection', source: `${sharedSourceRoot}ux.tsx` },
  { name: 'PageTabsPanel', source: `${sharedSourceRoot}ux.tsx` },
  { name: 'RefreshButton', source: `${sharedSourceRoot}ux.tsx` },
  { name: 'ResponsiveButtonGroup', source: `${sharedSourceRoot}ux.tsx` },
  { name: 'RestrictedState', source: `${sharedSourceRoot}RestrictedState.tsx` },
  { name: 'SectionHeader', source: `${sharedSourceRoot}ux.tsx` },
  { name: 'Skeleton', source: `${sharedSourceRoot}ux.tsx` },
  { name: 'TaskItem', source: `${sharedSourceRoot}TaskItem.tsx` },
  { name: 'TaskToolbarAction', source: `${sharedSourceRoot}TaskToolbarActions.tsx` },
  { name: 'TaskToolbarActions', source: `${sharedSourceRoot}TaskToolbarActions.tsx` },
  { name: 'TaskToolbarRefreshAction', source: `${sharedSourceRoot}TaskToolbarActions.tsx` },
  { name: 'TemporarySurfaceFooter', source: `${sharedSourceRoot}TemporarySurfaceFooter.tsx` },
] as const

export type SharedComponentName = typeof sharedComponentInventory[number]['name']

export function getSharedComponentSource(name: SharedComponentName) {
  const item = sharedComponentInventory.find((entry) => entry.name === name)

  if (!item) {
    throw new Error(`Unknown shared component: ${name}`)
  }

  return item.source
}
