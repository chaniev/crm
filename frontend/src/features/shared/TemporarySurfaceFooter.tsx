import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export type TemporarySurfaceFooterProps = ComponentPropsWithoutRef<'footer'> & {
  primaryAction: ReactNode
  secondaryAction?: ReactNode
}

export function TemporarySurfaceFooter({
  className,
  primaryAction,
  secondaryAction,
  ...props
}: TemporarySurfaceFooterProps) {
  return (
    <footer
      className={['temporary-surface-footer', className].filter(Boolean).join(' ')}
      data-safe-area-aware="true"
      {...props}
    >
      {secondaryAction ? (
        <div className="temporary-surface-footer__secondary">{secondaryAction}</div>
      ) : null}
      <div className="temporary-surface-footer__primary">{primaryAction}</div>
    </footer>
  )
}
