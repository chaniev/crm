import { PasswordInput, type PasswordInputProps } from '@mantine/core'
import { useState, type Ref, type MouseEvent } from 'react'
import { fe17SharedRoutingThemeText as text } from '../../resources/fe-17-shared-routing-theme'

export function LocalizedPasswordInput(props: PasswordInputProps & { ref?: Ref<HTMLInputElement> }) {
  const [visible, setVisible] = useState(false)

  return (
    <PasswordInput
      {...props}
      aria-invalid={props.error ? true : undefined}
      visible={visible}
      onVisibilityChange={setVisible}
      visibilityToggleButtonProps={{
        'aria-label': visible ? text.hidePassword : text.showPassword,
        'aria-pressed': undefined,
        tabIndex: 0,
        // Mantine handles pointer activation and Space. Enter and assistive
        // technology can activate the button with a click alone.
        onClick: (event: MouseEvent) => {
          if (event.detail === 0) setVisible(current => !current)
        },
      }}
    />
  )
}
