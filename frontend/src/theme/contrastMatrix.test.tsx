import { Alert, Badge, Button, MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { contrastRatio } from './contrast'
import { buildThemeContrastMatrix } from './contrastMatrix'
import { createGymCrmTheme } from './createGymCrmTheme'
import { createSemanticVariables } from './semanticVariables'
import { themeProfiles } from './profiles'

function cssVariable(element: HTMLElement, name: string) {
  const value = element.style.getPropertyValue(name)
  expect(value, `${name} must be resolved by the Mantine component recipe`).toBeTruthy()
  return value
}

describe('resolved Mantine component contrast', () => {
  for (const profile of themeProfiles) {
    test(`${profile.id} resolves the foregrounds certified by the matrix`, () => {
      const variables = createSemanticVariables(profile)

      render(
        <MantineProvider theme={createGymCrmTheme(profile)}>
          <Button data-testid="primary" color="brand" variant="filled">
            Primary
          </Button>
          <Button
            data-testid="destructive"
            color={variables['--crm-status-danger']}
            variant="filled"
          >
            Destructive
          </Button>
          <Badge
            data-testid="badge"
            color={variables['--crm-status-success']}
            variant="light"
          >
            Success
          </Badge>
          <Alert
            data-testid="alert"
            color={variables['--crm-status-info']}
            variant="light"
          >
            Information
          </Alert>
        </MantineProvider>,
      )

      const primary = screen.getByTestId('primary')
      expect(cssVariable(primary, '--button-color')).toBe('var(--mantine-color-white)')
      expect(cssVariable(primary, '--button-bg')).toBe('var(--mantine-color-brand-filled)')

      const destructive = screen.getByTestId('destructive')
      const destructiveForeground = cssVariable(destructive, '--button-color')
      expect(destructiveForeground).toBe('var(--mantine-color-white)')
      expect(
        buildThemeContrastMatrix(profile).find(
          ({ component, state }) => component === 'Button' && state === 'destructive/default',
        )?.foreground,
      ).toBe(variables['--crm-text-inverse'])

      const badge = screen.getByTestId('badge')
      expect(
        contrastRatio(
          cssVariable(badge, '--badge-color'),
          cssVariable(badge, '--badge-bg'),
        ),
      ).toBeGreaterThanOrEqual(4.5)

      const alert = screen.getByTestId('alert')
      expect(
        contrastRatio(
          cssVariable(alert, '--alert-color'),
          cssVariable(alert, '--alert-bg'),
        ),
      ).toBeGreaterThanOrEqual(4.5)
    })
  }
})
