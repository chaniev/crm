import { describe, expect, test } from 'vitest'
import {
  canUseClientsPreviewSplit,
  getClientsPreviewWidthPx,
} from './clientListPreviewLayout'

describe('client preview split layout boundary', () => {
  test('uses the deterministic 48rem list + 1rem gap + preview clamp threshold', () => {
    expect(getClientsPreviewWidthPx(1072)).toBe(288)
    expect(canUseClientsPreviewSplit(1071)).toBe(false)
    expect(canUseClientsPreviewSplit(1072)).toBe(true)
  })

  test('keeps tablet fallback out of serialized responsive state', () => {
    expect(canUseClientsPreviewSplit(768)).toBe(false)
    expect(canUseClientsPreviewSplit(Number.NaN)).toBe(false)
  })
})
