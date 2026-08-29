import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Drawer,
  Input,
  InputWrapper,
  Loader,
  Modal,
  Notification,
  Pagination,
  Select,
  Skeleton,
  TextInput,
  type MantineThemeComponents,
} from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import {
  GYM_CRM_NOTIFICATION_AUTO_CLOSE_MS,
  GYM_CRM_NOTIFICATION_LIMIT,
} from './componentRecipeConstants'

const controlTransition = [
  'background-color var(--crm-motion-duration-fast) var(--crm-motion-easing-functional)',
  'border-color var(--crm-motion-duration-fast) var(--crm-motion-easing-functional)',
  'box-shadow var(--crm-motion-duration-fast) var(--crm-motion-easing-functional)',
  'color var(--crm-motion-duration-fast) var(--crm-motion-easing-functional)',
].join(', ')

const interactiveControlStyles = {
  fontWeight: 700,
  transition: controlTransition,
}

const focusRingStyles = {
  outline: '2px solid var(--crm-focus-ring)',
  outlineOffset: '2px',
}

const inputStyles = {
  input: {
    backgroundColor: 'var(--crm-surface-card)',
    borderColor: 'var(--crm-border-default)',
    color: 'var(--crm-text-primary)',
    fontSize: '1rem',
    transition: controlTransition,
  },
  label: {
    color: 'var(--crm-text-heading)',
    fontWeight: 700,
  },
  description: {
    color: 'var(--crm-text-secondary)',
  },
  error: {
    color: 'var(--crm-status-danger-fg)',
  },
}

const temporarySurfaceStyles = {
  content: {
    backgroundColor: 'var(--crm-surface-card)',
    border: '1px solid var(--crm-border-default)',
    borderRadius: 'var(--crm-radius-inner)',
    color: 'var(--crm-text-primary)',
  },
  header: {
    borderBottom: '1px solid var(--crm-border-muted)',
    color: 'var(--crm-text-heading)',
  },
  title: {
    color: 'var(--crm-text-heading)',
    fontWeight: 800,
  },
  close: {
    minHeight: 44,
    minWidth: 44,
  },
}

export const gymCrmComponentRecipes: MantineThemeComponents = {
  Button: Button.extend({
    defaultProps: {
      autoContrast: true,
      'data-crm-recipe': 'button',
      loaderProps: {
        size: 'sm',
      },
      radius: 'md',
    },
    styles: {
      root: {
        ...interactiveControlStyles,
        minHeight: 44,
      },
      label: {
        lineHeight: 1.2,
      },
    },
  }),
  ActionIcon: ActionIcon.extend({
    defaultProps: {
      autoContrast: true,
      'data-crm-recipe': 'icon-button',
      loaderProps: {
        size: 'sm',
      },
      radius: 'md',
      size: 44,
    },
    styles: {
      root: {
        ...interactiveControlStyles,
        minHeight: 44,
        minWidth: 44,
      },
    },
  }),
  Alert: Alert.extend({
    defaultProps: {
      'data-crm-recipe': 'alert',
      color: 'var(--crm-status-info-fg)',
      radius: 'md',
      variant: 'light',
    },
    styles: {
      root: {
        borderColor: 'var(--crm-status-info-border)',
      },
      title: {
        color: 'var(--crm-text-heading)',
        fontWeight: 800,
      },
      message: {
        color: 'var(--crm-text-primary)',
      },
    },
  }),
  Badge: Badge.extend({
    defaultProps: {
      autoContrast: true,
      'data-crm-recipe': 'badge',
      color: 'var(--crm-status-neutral-fg)',
      radius: 'sm',
      variant: 'light',
    },
    styles: {
      root: {
        borderColor: 'var(--crm-status-neutral-border)',
        fontWeight: 700,
      },
    },
  }),
  TextInput: TextInput.extend({
    defaultProps: {
      'data-crm-recipe': 'input',
      radius: 'md',
      size: 'sm',
    },
    styles: inputStyles,
  }),
  Select: Select.extend({
    defaultProps: {
      'data-crm-recipe': 'input',
      checkIconPosition: 'right',
      radius: 'md',
      size: 'sm',
    },
    styles: inputStyles,
  }),
  Input: Input.extend({
    defaultProps: {
      'data-crm-recipe': 'input',
      radius: 'md',
      size: 'sm',
    },
    styles: inputStyles,
  }),
  InputWrapper: InputWrapper.extend({
    defaultProps: {
      'data-crm-recipe': 'input-wrapper',
      size: 'sm',
    },
    styles: inputStyles,
  }),
  Modal: Modal.extend({
    defaultProps: {
      'data-crm-recipe': 'modal',
      closeButtonProps: {
        'aria-label': 'Закрыть окно',
      },
      overlayProps: {
        backgroundOpacity: 0.18,
        blur: 2,
      },
      radius: 'md',
      returnFocus: true,
      trapFocus: true,
    },
    styles: temporarySurfaceStyles,
  }),
  Drawer: Drawer.extend({
    defaultProps: {
      'data-crm-recipe': 'drawer',
      closeButtonProps: {
        'aria-label': 'Закрыть панель',
      },
      overlayProps: {
        backgroundOpacity: 0.18,
        blur: 2,
      },
      returnFocus: true,
      trapFocus: true,
    },
    styles: temporarySurfaceStyles,
  }),
  Skeleton: Skeleton.extend({
    defaultProps: {
      'data-crm-recipe': 'skeleton',
      radius: 'md',
    },
  }),
  Loader: Loader.extend({
    defaultProps: {
      'data-crm-recipe': 'loader',
      color: 'var(--crm-action-primary)',
      size: 'sm',
    },
  }),
  Notification: Notification.extend({
    defaultProps: {
      'data-crm-recipe': 'notification',
      color: 'var(--crm-status-neutral-fg)',
      radius: 'md',
    },
    styles: {
      root: {
        backgroundColor: 'var(--crm-surface-card)',
        borderColor: 'var(--crm-border-default)',
        color: 'var(--crm-text-primary)',
      },
      title: {
        color: 'var(--crm-text-heading)',
        fontWeight: 800,
      },
      description: {
        color: 'var(--crm-text-primary)',
      },
    },
  }),
  Notifications: Notifications.extend({
    defaultProps: {
      autoClose: GYM_CRM_NOTIFICATION_AUTO_CLOSE_MS,
      'data-crm-recipe': 'notifications',
      limit: GYM_CRM_NOTIFICATION_LIMIT,
      position: 'top-right',
    },
    styles: {
      notification: {
        boxShadow: 'var(--crm-elevation-section)',
      },
    },
  }),
  Pagination: Pagination.extend({
    defaultProps: {
      autoContrast: true,
      'data-crm-recipe': 'pagination',
      color: 'brand',
      gap: 8,
      radius: 'md',
      size: 'sm',
    },
    styles: {
      control: {
        ...interactiveControlStyles,
        minHeight: 44,
        minWidth: 44,
      },
    },
  }),
}

export const gymCrmFocusStyles = {
  control: focusRingStyles,
} as const
