import {
  ActionIcon,
  type ActionIconProps,
} from '@mantine/core'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export type SharedIconButtonVariant = 'primary' | 'secondary' | 'ghost' | 'pill'

export type SharedIconButtonProps = Omit<ActionIconProps, 'children' | 'variant'> &
  ComponentPropsWithoutRef<'button'> & {
  color?: ActionIconProps['color']
  icon: ReactNode
  label: string
  variant?: SharedIconButtonVariant
}

const sharedIconButtonVariantMap: Record<
  SharedIconButtonVariant,
  Pick<ActionIconProps, 'color' | 'variant'>
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

export function IconButton({
  className,
  color,
  icon,
  label,
  radius = 'xl',
  title,
  variant = 'secondary',
  ...props
}: SharedIconButtonProps) {
  const resolvedVariant = sharedIconButtonVariantMap[variant]

  return (
    <ActionIcon
      aria-label={label}
      className={['shared-icon-button', className].filter(Boolean).join(' ')}
      color={color ?? resolvedVariant.color}
      radius={radius}
      title={title ?? label}
      variant={resolvedVariant.variant}
      {...props}
    >
      {icon}
    </ActionIcon>
  )
}
