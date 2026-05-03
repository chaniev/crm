import {
  Button as MantineButton,
  type ButtonProps as MantineButtonProps,
} from '@mantine/core'
import type { ComponentPropsWithoutRef } from 'react'

export type SharedButtonVariant = 'primary' | 'secondary' | 'ghost' | 'pill'

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
    color: 'brand.7',
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
