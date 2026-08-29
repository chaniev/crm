import {
  Alert,
  Badge,
  Drawer,
  Loader,
  MantineProvider,
  Modal,
  PasswordInput,
  Pagination,
  Select,
  Skeleton,
  TextInput,
} from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { fireEvent, render, screen } from '@testing-library/react'
import { IconAlertCircle, IconSearch } from '@tabler/icons-react'
import { describe, expect, test, vi } from 'vitest'
import { Button } from '../features/shared/Button'
import { IconButton } from '../features/shared/IconButton'
import { showAppNotification } from '../features/shared/notifications'
import { createGymCrmTheme } from './createGymCrmTheme'
import { themeProfiles } from './profiles'

const recipeNames = [
  'Button',
  'ActionIcon',
  'Alert',
  'Badge',
  'TextInput',
  'PasswordInput',
  'Textarea',
  'NumberInput',
  'MultiSelect',
  'Select',
  'Input',
  'InputWrapper',
  'Modal',
  'Drawer',
  'Skeleton',
  'Loader',
  'Notification',
  'Notifications',
  'Pagination',
] as const

describe('TASK-149 Mantine component recipes', () => {
  test('registers every project-level Mantine recipe in both theme profiles', () => {
    for (const profile of themeProfiles) {
      const theme = createGymCrmTheme(profile)

      for (const recipeName of recipeNames) {
        expect(
          theme.components?.[recipeName],
          `${profile.id} must register ${recipeName}`,
        ).toBeTruthy()
      }
    }
  })

  test('resolves state, tone and geometry recipes in representative runtime components', () => {
    const focusTarget = vi.fn()

    render(
      <MantineProvider theme={createGymCrmTheme(themeProfiles[0])}>
        <Button data-testid="primary">Сохранить</Button>
        <Button data-testid="destructive" variant="destructive">
          Удалить
        </Button>
        <Button data-testid="loading" loading>
          Сохраняем
        </Button>
        <IconButton
          data-testid="icon"
          icon={<IconSearch aria-hidden="true" size={18} />}
          label="Найти клиента"
          onFocus={focusTarget}
          variant="ghost"
        />
        <Alert
          data-testid="alert"
          icon={<IconAlertCircle size={18} />}
          title="Нет доступа"
        >
          Проверьте роль пользователя.
        </Alert>
        <Badge data-testid="badge">Активен</Badge>
        <TextInput
          data-testid="text-input"
          error="Введите имя"
          label="Имя клиента"
        />
        <Select
          data={[{ label: '10', value: '10' }]}
          data-testid="select"
          label="Строк на странице"
        />
        <Skeleton data-testid="skeleton" height={32} />
        <Loader data-testid="loader" />
        <Pagination
          aria-label="Страницы журнала"
          data-testid="pagination"
          total={3}
        />
      </MantineProvider>,
    )

    expect(screen.getByTestId('primary')).toHaveAttribute('data-crm-recipe', 'button')
    expect(screen.getByTestId('primary')).toHaveAttribute('data-crm-variant', 'primary')
    expect(screen.getByTestId('destructive')).toHaveAttribute('data-crm-variant', 'destructive')
    expect(screen.getByTestId('destructive')).toHaveAttribute('data-semantic-tone', 'danger')
    expect(screen.getByTestId('loading')).toBeDisabled()

    const icon = screen.getByRole('button', { name: 'Найти клиента' })
    expect(icon).toHaveAttribute('data-crm-recipe', 'icon-button')
    expect(icon).toHaveAttribute('data-crm-variant', 'ghost')
    expect(icon.style.minWidth).toBe('44px')
    expect(icon.style.minHeight).toBe('44px')
    fireEvent.focus(icon)
    expect(focusTarget).toHaveBeenCalledTimes(1)

    expect(screen.getByTestId('alert')).toHaveAttribute('data-crm-recipe', 'alert')
    expect(screen.getByTestId('badge')).toHaveAttribute('data-crm-recipe', 'badge')
    expect(screen.getByTestId('text-input')).toHaveAttribute('data-crm-recipe', 'input')
    expect(screen.getByLabelText('Имя клиента')).toHaveAccessibleDescription('Введите имя')
    expect(screen.getByTestId('select')).toHaveAttribute('data-crm-recipe', 'input')
    expect(screen.getByTestId('skeleton')).toHaveAttribute('data-crm-recipe', 'skeleton')
    expect(screen.getByTestId('loader')).toHaveAttribute('data-crm-recipe', 'loader')
    expect(screen.getByTestId('pagination')).toHaveAttribute('data-crm-recipe', 'pagination')
  })

  test('Modal, Drawer and Notifications keep accessible temporary-surface defaults', () => {
    render(
      <MantineProvider theme={createGymCrmTheme(themeProfiles[1])}>
        <Notifications data-testid="notifications" />
        <Modal opened onClose={() => undefined} title="Удаление клиента">
          Подтверждение удаления
        </Modal>
        <Drawer opened onClose={() => undefined} title="Фильтры">
          Панель фильтров
        </Drawer>
      </MantineProvider>,
    )

    for (const container of screen.getAllByTestId('notifications')) {
      expect(container).toHaveAttribute('data-crm-recipe', 'notifications')
    }
    const modal = screen.getByRole('dialog', { name: 'Удаление клиента' })
    const drawer = screen.getByRole('dialog', { name: 'Фильтры' })

    expect(modal.closest('.mantine-Modal-root')).toHaveAttribute('data-crm-recipe', 'modal')
    expect(drawer.closest('.mantine-Drawer-root')).toHaveAttribute('data-crm-recipe', 'drawer')
  })
})

describe('TASK-161 responsive mobile control recipes', () => {
  test('uses touch-safe inputs, top-center notifications and a bottom drawer on mobile', () => {
    const mobileTheme = createGymCrmTheme(themeProfiles[0], { mobile: true })

    render(
      <MantineProvider theme={mobileTheme}>
        <TextInput label="Имя клиента" />
        <PasswordInput label="Пароль" />
        <Notifications data-testid="mobile-notifications" />
        <Drawer opened onClose={() => undefined} title="Фильтры">
          Панель фильтров
        </Drawer>
      </MantineProvider>,
    )

    expect(window.getComputedStyle(screen.getByLabelText('Имя клиента')).minHeight).toBe(
      '44px',
    )
    expect(window.getComputedStyle(screen.getByLabelText('Имя клиента')).fontSize).toBe(
      '1rem',
    )
    expect(
      window.getComputedStyle(screen.getByLabelText('Пароль').parentElement!).minHeight,
    ).toBe('44px')
    expect(window.getComputedStyle(screen.getByLabelText('Пароль')).minHeight).toBe(
      '44px',
    )
    expect(
      (
        mobileTheme.components?.Notifications as {
          defaultProps?: { position?: string }
        }
      ).defaultProps?.position,
    ).toBe('top-center')

    const drawerRoot = screen
      .getByRole('dialog', { name: 'Фильтры' })
      .closest('.mantine-Drawer-root')
    expect(drawerRoot).toHaveStyle({
      '--drawer-align': 'flex-end',
      '--drawer-flex': '0 0 calc(100% - var(--drawer-offset, 0rem) * 2)',
      '--drawer-height': 'var(--drawer-size)',
    })
  })

  test('preserves the desktop input, notification and right-drawer geometry', () => {
    const desktopTheme = createGymCrmTheme(themeProfiles[0], { mobile: false })

    render(
      <MantineProvider theme={desktopTheme}>
        <TextInput label="Название группы" />
        <Notifications data-testid="desktop-notifications" />
        <Drawer opened onClose={() => undefined} title="Параметры">
          Параметры расписания
        </Drawer>
      </MantineProvider>,
    )

    expect(window.getComputedStyle(screen.getByLabelText('Название группы')).minHeight).not.toBe(
      '44px',
    )
    expect(
      (
        desktopTheme.components?.Notifications as {
          defaultProps?: { position?: string }
        }
      ).defaultProps?.position,
    ).toBe('top-right')

    const drawerRoot = screen
      .getByRole('dialog', { name: 'Параметры' })
      .closest('.mantine-Drawer-root')
    expect(drawerRoot).not.toHaveStyle({ '--drawer-align': 'flex-end' })
  })
})

vi.mock('@mantine/notifications', async (importOriginal) => {
  const original = await importOriginal<typeof import('@mantine/notifications')>()

  return {
    ...original,
    notifications: {
      cleanQueue: vi.fn(),
      show: vi.fn(() => 'recipe-notification'),
      update: vi.fn(),
    },
  }
})

describe('TASK-149 notification helper recipe defaults', () => {
  test('marks destructive notifications with assertive semantic alert defaults', async () => {
    showAppNotification({
      message: 'Ошибка сохранения.',
      title: 'Не удалось сохранить',
      tone: 'danger',
    })

    const { notifications } = await import('@mantine/notifications')

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        'aria-live': 'assertive',
        color: 'var(--crm-status-danger-fg)',
        role: 'alert',
      }),
    )
  })
})
