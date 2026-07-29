export type TouchTargetInventoryAllowlistMatch = {
  route: string
  state: string
  role: string
  viewport: {
    width: number
    height: number
  }
  pointerMode: 'fine' | 'coarse'
  locator: string
  criterion: 'label-clipping' | 'insufficient-target' | 'invalid-gap'
  reason: string
  ownerTask: string
}

export const TOUCH_TARGET_ALLOWLIST: TouchTargetInventoryAllowlistMatch[] = [
  {
    route: '/clients',
    state: 'preview-open',
    role: 'SuperAdministrator',
    viewport: {
      width: 1440,
      height: 1200,
    },
    pointerMode: 'fine',
    locator: "role=button[name='Открыть']",
    criterion: 'label-clipping',
    reason: 'Known client preview-open desktop split geometry',
    ownerTask: 'TASK-089',
  },
]

export function findAllowlistMatch(
  entry: Omit<TouchTargetInventoryAllowlistMatch, 'criterion' | 'reason' | 'ownerTask'>,
): TouchTargetInventoryAllowlistMatch | undefined {
  return TOUCH_TARGET_ALLOWLIST.find(
    (allowlistItem) =>
      allowlistItem.route === entry.route &&
      allowlistItem.state === entry.state &&
      allowlistItem.role === entry.role &&
      allowlistItem.pointerMode === entry.pointerMode &&
      allowlistItem.viewport.width === entry.viewport.width &&
      allowlistItem.viewport.height === entry.viewport.height &&
      allowlistItem.locator === entry.locator,
  )
}
