export async function copyTextToClipboard(value: string) {
  if (!value) {
    return false
  }

  if (window.isSecureContext !== false && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Fall through to the legacy path for browsers or origins that block
      // Clipboard API even during a user gesture.
    }
  }

  return copyTextWithTextarea(value)
}

function copyTextWithTextarea(value: string) {
  if (!document.body || typeof document.execCommand !== 'function') {
    return false
  }

  const textarea = document.createElement('textarea')
  const activeElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : null

  textarea.value = value
  textarea.readOnly = true
  textarea.setAttribute('aria-hidden', 'true')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '0'
  textarea.style.width = '1px'
  textarea.style.height = '1px'
  textarea.style.padding = '0'
  textarea.style.border = '0'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'

  document.body.appendChild(textarea)
  textarea.focus({ preventScroll: true })
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
    activeElement?.focus({ preventScroll: true })
  }
}
