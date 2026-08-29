import {
  Button as MantineButton,
  type ButtonProps as MantineButtonProps,
} from '@mantine/core'
import type { ComponentPropsWithoutRef } from 'react'
import {
  getSemanticToneAttributes,
  getSemanticToneComponentProps,
} from '../../theme/semanticTones'

export type SharedButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'pill'
  | 'filled'
  | 'default'
  | 'subtle'
  | 'light'
  | 'destructive'

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
  destructive: {
    color: getSemanticToneComponentProps('danger').color,
    variant: 'filled',
  },
}

export function Button({
  className,
  color,
  loaderProps,
  radius = 'xl',
  variant = 'primary',
  ...props
}: SharedButtonProps) {
  const resolvedVariant = sharedButtonVariantMap[variant]
  const semanticToneAttributes =
    variant === 'destructive' ? getSemanticToneAttributes('danger') : {}

  return (
    <MantineButton
      {...semanticToneAttributes}
      className={['shared-button', className].filter(Boolean).join(' ')}
      color={color ?? resolvedVariant.color}
      data-crm-recipe="button"
      data-crm-variant={variant}
      loaderProps={{
        size: 'sm',
        ...loaderProps,
      }}
      radius={radius}
      variant={resolvedVariant.variant}
      {...props}
    />
  )
}
