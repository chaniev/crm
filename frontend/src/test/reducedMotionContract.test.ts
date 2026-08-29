import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { createSemanticVariables } from '../theme/semanticVariables'
import { defaultGreenProfile } from '../theme/profiles'

const appCss = readFileSync(
  resolve(process.cwd(), 'src/App.css'),
  'utf8',
)

describe('TASK-144 reduced-motion contract', () => {
  test('exports one named duration and easing contract for custom CRM motion', () => {
    const variables = createSemanticVariables(defaultGreenProfile)

    expect(variables).toMatchObject({
      '--crm-motion-duration-fast': '120ms',
      '--crm-motion-duration-standard': '140ms',
      '--crm-motion-duration-continuous': '1400ms',
      '--crm-motion-easing-functional': 'ease',
      '--crm-motion-easing-continuous': 'ease-in-out',
    })
  })

  test('routes custom transitions and repeating animation through motion tokens', () => {
    expect(appCss).not.toMatch(/\b(?:120|140|1400)ms\s+(?:ease|ease-in-out)/)
    expect(appCss).toContain(
      'animation: schedule-skeleton-pulse var(--crm-motion-duration-continuous) var(--crm-motion-easing-continuous) infinite;',
    )
  })

  test('has one scoped reduced-motion policy that stops repetition without hiding loading state', () => {
    const policies = appCss.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/g)

    expect(policies).toHaveLength(1)
    expect(appCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.schedule-skeleton__line[\s\S]*animation:\s*none/,
    )
    expect(appCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.mantine-(?:Modal|Drawer|Notifications)-root/,
    )
    expect(appCss).not.toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.schedule-skeleton[^}]*display:\s*none/,
    )
  })
})
