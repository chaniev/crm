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
