const CLIENTS_PREVIEW_MIN_WIDTH_REM = 18
const CLIENTS_PREVIEW_MAX_WIDTH_REM = 21
const CLIENTS_PREVIEW_IDEAL_RATIO = 0.24
const CLIENTS_PREVIEW_GAP_PX = 16
const CLIENTS_LIST_MIN_WIDTH_PX = 48 * 16
const ROOT_FONT_SIZE_PX = 16

export function canUseClientsPreviewSplit(inlineSizePx: number) {
  if (!Number.isFinite(inlineSizePx) || inlineSizePx <= 0) {
    return false
  }

  const previewWidth = getClientsPreviewWidthPx(inlineSizePx)

  return inlineSizePx - previewWidth - CLIENTS_PREVIEW_GAP_PX >= CLIENTS_LIST_MIN_WIDTH_PX
}

export function getClientsPreviewWidthPx(inlineSizePx: number) {
  const minWidth = CLIENTS_PREVIEW_MIN_WIDTH_REM * ROOT_FONT_SIZE_PX
  const maxWidth = CLIENTS_PREVIEW_MAX_WIDTH_REM * ROOT_FONT_SIZE_PX
  const idealWidth = inlineSizePx * CLIENTS_PREVIEW_IDEAL_RATIO

  return Math.min(maxWidth, Math.max(minWidth, idealWidth))
}
