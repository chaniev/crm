import {
  Button as MantineButton,
  type ButtonProps as MantineButtonProps,
} from '@mantine/core'
import type { ComponentPropsWithoutRef } from 'react'

export type SharedButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'pill'
  | 'filled'
  | 'default'
  | 'subtle'
  | 'light'

export type SharedButtonProps = Omit<MantineButtonProps, 'variant'> &
  ComponentPropsWithoutRef<'button'> & {
  color?: MantineButtonProps['color']
  variant?: SharedButtonVariant
}

const sharedButtonVariantMap: Record<
  SharedButtonVariant,
  Pick<MantineButtonProps, 'color' | 'variant'>
> = {
  primary: {
    color: 'var(--crm-action-primary)',
    variant: 'filled',
  },
  secondary: {
    variant: 'default',
  },
  ghost: {
    variant: 'subtle',
  },
  pill: {
    variant: 'light',
  },
  filled: {
    color: 'var(--crm-action-primary)',
    variant: 'filled',
  },
  default: {
    variant: 'default',
  },
  subtle: {
    variant: 'subtle',
  },
  light: {
    variant: 'light',
  },
}

export function Button({
  className,
  color,
  radius = 'xl',
  variant = 'primary',
  ...props
}: SharedButtonProps) {
  const resolvedVariant = sharedButtonVariantMap[variant]

  return (
    <MantineButton
      className={['shared-button', className].filter(Boolean).join(' ')}
      color={color ?? resolvedVariant.color}
      radius={radius}
      variant={resolvedVariant.variant}
      {...props}
    />
  )
}
