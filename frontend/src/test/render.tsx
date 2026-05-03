import { MantineProvider } from '@mantine/core'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'
import { gymCrmTheme } from '../theme'

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <MantineProvider defaultColorScheme="light" theme={gymCrmTheme}>
        {children}
      </MantineProvider>
    ),
    ...options,
  })
}
