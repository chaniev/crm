import { afterEach, describe, expect, test, vi } from 'vitest'
import { copyTextToClipboard } from './clipboard'

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand')

afterEach(() => {
  restoreProperty(navigator, 'clipboard', originalClipboard)
  restoreProperty(document, 'execCommand', originalExecCommand)
})

describe('copyTextToClipboard', () => {
  test('uses Clipboard API when the browser allows it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    await expect(copyTextToClipboard('https://t.me/k4pro_admin')).resolves.toBe(
      true,
    )
    expect(writeText).toHaveBeenCalledWith('https://t.me/k4pro_admin')
  })

  test('falls back to a textarea copy command when Clipboard API is unavailable', async () => {
    const execCommand = vi.fn().mockReturnValue(true)

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    })

    await expect(copyTextToClipboard('https://t.me/k4pro_admin')).resolves.toBe(
      true,
    )
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea[aria-hidden="true"]')).toBeNull()
  })
})

function restoreProperty<T extends object, K extends keyof T>(
  target: T,
  key: K,
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor)
    return
  }

  Reflect.deleteProperty(target, key)
}
