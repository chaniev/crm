import { NumberInput, UnstyledButton, type NumberInputHandlers, type NumberInputProps } from '@mantine/core'
import { useMergedRef } from '@mantine/hooks'
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import { useRef, type Ref } from 'react'
import { fe17SharedRoutingThemeText as text } from '../../resources/fe-17-shared-routing-theme'

export function DurationInput({ ref, ...props }: NumberInputProps & { ref?: Ref<HTMLInputElement> }) {
  const input = useRef<HTMLInputElement>(null)
  const mergedRef = useMergedRef(input, ref)
  const handlers = useRef<NumberInputHandlers>(undefined)
  const { disabled, min, max, value } = props

  return (
    <NumberInput
      {...props}
      ref={mergedRef}
      handlersRef={handlers}
      rightSection={
        <div
          className={NumberInput.classes.controls}
          onPointerDown={event => {
            event.preventDefault()
            input.current?.focus()
          }}
        >
          <UnstyledButton
            aria-label={text.increaseDuration}
            className={NumberInput.classes.control}
            disabled={disabled || (typeof value === 'number' && max !== undefined && value >= max)}
            mod={{ direction: 'up' }}
            onClick={() => handlers.current?.increment()}
            type="button"
          >
            <IconChevronUp aria-hidden="true" size="var(--ni-chevron-size)" />
          </UnstyledButton>
          <UnstyledButton
            aria-label={text.decreaseDuration}
            className={NumberInput.classes.control}
            disabled={disabled || (typeof value === 'number' && min !== undefined && value <= min)}
            mod={{ direction: 'down' }}
            onClick={() => handlers.current?.decrement()}
            type="button"
          >
            <IconChevronDown aria-hidden="true" size="var(--ni-chevron-size)" />
          </UnstyledButton>
        </div>
      }
    />
  )
}
