import { describe, expect, test } from 'vitest'
import {
  getSemanticToneAttributes,
  getSemanticToneComponentProps,
  semanticToneDefinitions,
  type SemanticTone,
} from './semanticTones'

const tones = Object.keys(semanticToneDefinitions) as SemanticTone[]

describe('TASK-143 semantic functional tones', () => {
  test('maps every functional tone to foreground, background, border and non-color cue', () => {
    expect(tones).toEqual([
      'danger',
      'warning',
      'success',
      'info',
      'neutral',
    ])

    for (const tone of tones) {
      const definition = semanticToneDefinitions[tone]

      expect(definition.foreground).toBe(`var(--crm-status-${tone}-fg)`)
      expect(definition.background).toBe(`var(--crm-status-${tone}-bg)`)
      expect(definition.border).toBe(`var(--crm-status-${tone}-border)`)
      expect(definition.iconCue.length).toBeGreaterThan(0)
      expect(definition.mantineColor).toBe(definition.foreground)
    }
  })

  test('exposes consistent component props and semantic cue attributes', () => {
    expect(getSemanticToneComponentProps('danger')).toMatchObject({
      color: 'var(--crm-status-danger-fg)',
      'data-semantic-tone': 'danger',
      'data-semantic-tone-cue': 'alert',
    })

    expect(getSemanticToneAttributes('neutral')).toEqual({
      'data-semantic-tone': 'neutral',
      'data-semantic-tone-cue': 'neutral',
    })
  })
})

