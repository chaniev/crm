import { useLayoutEffect, useRef, useState } from 'react'

export function useUserFormErrorFocus() {
  const formElement = useRef<HTMLFormElement>(null)
  const [invalidSubmissions, setInvalidSubmissions] = useState(0)

  useLayoutEffect(() => {
    if (invalidSubmissions === 0) return

    const field = formElement.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]:enabled',
    )
    field?.focus({ preventScroll: true })
    field?.scrollIntoView({ block: 'center' })
  }, [invalidSubmissions])

  return { formElement, focusFirstError: () => setInvalidSubmissions(count => count + 1) }
}
