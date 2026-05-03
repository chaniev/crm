import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import type { AppSection } from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import {
  AppLayout,
  Button,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  LoadingState,
  NavigationTabs,
  PageCard,
  PageHeader,
  RefreshButton,
  Skeleton,
} from './ux'

const sections: AppSection[] = [
  'Home',
  'Attendance',
  'Clients',
  'Groups',
  'Users',
  'Audit',
]

describe('shared UX components', () => {
  test('NavigationTabs renders configured sections and marks active tab', () => {
    const onNavigate = vi.fn()

    renderWithProviders(
      <NavigationTabs
        currentSection="Home"
        onNavigate={onNavigate}
        sections={sections}
      />,
    )

    expect(screen.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Главная' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('button', { name: 'Посещения' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Клиенты' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Группы' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Пользователи' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Журнал' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Клиенты' }))

    expect(onNavigate).toHaveBeenCalledWith('Clients')
  })

  test('AppLayout and Header render brand, profile slot and navigation', () => {
    renderWithProviders(
      <AppLayout
        header={(
          <Header
            brandMeta="Главный тренер"
            navigation={(
              <NavigationTabs
                currentSection="Clients"
                onNavigate={() => undefined}
                sections={sections}
              />
            )}
            profileControl={<button type="button">Профиль</button>}
          />
        )}
      >
        <main>Рабочая область</main>
      </AppLayout>,
    )

    expect(screen.getByRole('banner')).toBeVisible()
    expect(screen.getByText('Gym CRM')).toBeVisible()
    expect(screen.getAllByText('Главный тренер')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Профиль' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Клиенты' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByText('Рабочая область')).toBeVisible()
  })

  test('PageCard renders nested content inside shared page container', () => {
    const { container } = renderWithProviders(
      <PageCard>
        <p>Контент вкладки</p>
      </PageCard>,
    )

    expect(screen.getByText('Контент вкладки')).toBeVisible()
    expect(container.querySelector('.page-card')).toBeTruthy()
  })

  test('PageHeader supports title, optional actions and no-action mode', () => {
    const { rerender } = renderWithProviders(
      <PageHeader
        actions={<button type="button">Действие</button>}
        title="Заголовок страницы"
      />,
    )

    expect(screen.getByRole('heading', { name: 'Заголовок страницы' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Действие' })).toBeVisible()

    rerender(
      <PageHeader
        description="Описание страницы"
        title="Заголовок без actions"
      />,
    )

    expect(screen.getByRole('heading', { name: 'Заголовок без actions' })).toBeVisible()
    expect(screen.getByText('Описание страницы')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Действие' })).not.toBeInTheDocument()
  })

  test('Button and IconButton expose accessible controls', () => {
    const onButtonClick = vi.fn()
    const onIconClick = vi.fn()

    renderWithProviders(
      <>
        <Button onClick={onButtonClick} variant="secondary">
          Сохранить
        </Button>
        <IconButton icon={<span aria-hidden="true">i</span>} label="Открыть меню" onClick={onIconClick} />
      </>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    fireEvent.click(screen.getByRole('button', { name: 'Открыть меню' }))

    expect(onButtonClick).toHaveBeenCalledTimes(1)
    expect(onIconClick).toHaveBeenCalledTimes(1)
  })

  test('RefreshButton calls handler and stays disabled while loading', () => {
    const onClick = vi.fn()
    const { rerender } = renderWithProviders(
      <RefreshButton onClick={onClick} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))

    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(<RefreshButton loading onClick={onClick} />)

    expect(screen.getByRole('button', { name: 'Обновить' })).toBeDisabled()
  })

  test('EmptyState renders title, optional description and optional action', () => {
    const { rerender } = renderWithProviders(
      <EmptyState
        action={<button type="button">Создать</button>}
        description="Описание пустого состояния"
        icon={<span aria-hidden="true">calendar</span>}
        title="Данных нет"
      />,
    )

    expect(screen.getByText('Данных нет')).toBeVisible()
    expect(screen.getByText('Описание пустого состояния')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Создать' })).toBeVisible()

    rerender(<EmptyState title="Все готово" />)

    expect(screen.getByText('Все готово')).toBeVisible()
    expect(screen.queryByText('Описание пустого состояния')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Создать' })).not.toBeInTheDocument()
  })

  test('LoadingState, ErrorState and Skeleton render reusable data states', () => {
    const { container } = renderWithProviders(
      <>
        <LoadingState label="Загружаем тестовые данные..." />
        <ErrorState
          action={<button type="button">Повторить</button>}
          message="Сервер недоступен"
          title="Ошибка загрузки"
        />
        <Skeleton rows={2} />
      </>,
    )

    expect(screen.getByText('Загружаем тестовые данные...')).toBeVisible()
    expect(screen.getByText('Ошибка загрузки')).toBeVisible()
    expect(screen.getByText('Сервер недоступен')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeVisible()
    expect(container.querySelectorAll('.skeleton-row')).toHaveLength(2)
  })
})
