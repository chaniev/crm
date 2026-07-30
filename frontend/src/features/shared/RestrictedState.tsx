import { Stack, Text, Title } from '@mantine/core'
import { useEffect, useRef } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export type RestrictedStateProps = ComponentPropsWithoutRef<'section'> & {
  description: string
  focusOnMount?: 'heading' | 'primary-action' | false
  primaryAction: ReactNode
  secondaryAction?: ReactNode
  title: string
  titleOrder?: 1 | 2 | 3 | 4 | 5 | 6
}

export function RestrictedState({
  className,
  description,
  focusOnMount = false,
  primaryAction,
  secondaryAction,
  title,
  titleOrder = 2,
  ...props
}: RestrictedStateProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const primaryActionRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!focusOnMount) {
      return
    }

    if (focusOnMount === 'heading') {
      headingRef.current?.focus()
      return
    }

    primaryActionRef.current
      ?.querySelector<HTMLElement>('button, a, [tabindex]:not([tabindex="-1"])')
      ?.focus()
  }, [focusOnMount])

  return (
    <section
      className={['restricted-state', className].filter(Boolean).join(' ')}
      {...props}
    >
      <Stack align="center" gap="md">
        <Title
          order={titleOrder}
          ref={headingRef}
          tabIndex={focusOnMount === 'heading' ? -1 : undefined}
        >
          {title}
        </Title>
        <Text c="dimmed" ta="center">
          {description}
        </Text>
        <div className="restricted-state__actions">
          {secondaryAction ? (
            <div className="restricted-state__secondary-action">{secondaryAction}</div>
          ) : null}
          <div className="restricted-state__primary-action" ref={primaryActionRef}>
            {primaryAction}
          </div>
        </div>
      </Stack>
    </section>
  )
}
