import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export type StickyFormActionsProps = ComponentPropsWithoutRef<'footer'> & {
  primaryAction: ReactNode
  secondaryAction?: ReactNode
  surface?: 'drawer' | 'page'
}

export function StickyFormActions({
  className,
  primaryAction,
  secondaryAction,
  surface = 'page',
  ...props
}: StickyFormActionsProps) {
  return (
    <div className={`sticky-form-actions-slot sticky-form-actions-slot--${surface}`}>
      <footer
        className={[
          'sticky-form-actions',
          `sticky-form-actions--${surface}`,
          className,
        ].filter(Boolean).join(' ')}
        data-safe-area-aware="true"
        {...props}
      >
        {secondaryAction ? (
          <div className="sticky-form-actions__secondary">{secondaryAction}</div>
        ) : null}
        <div className="sticky-form-actions__primary" data-primary-dominant="true">
          {primaryAction}
        </div>
      </footer>
    </div>
  )
}
