import { fireEvent, screen, within } from '@testing-library/react'
import { Tabs } from '@mantine/core'
import { describe, expect, test, vi } from 'vitest'
import type { AppSection } from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import {
  AppLayout,
  Button,
  CompactFilterPanel,
  EmptyState,
  ErrorState,
  FilterToolbar,
  Header,
  IconButton,
  LoadingState,
  NavigationTabs,
  PageCard,
  PageHeader,
  PageLayout,
  PageSection,
  PageTabsPanel,
  RefreshButton,
  SectionHeader,
  Skeleton,
} from './ux'

const sections: AppSection[] = [
  'Home',
  'Schedule',
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
    expect(screen.getByRole('button', { name: 'Расписание' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Клиенты' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Группы' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Тренеры' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Журнал' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Клиенты' }))

    expect(onNavigate).toHaveBeenCalledWith('Clients')
  })

  test('NavigationTabs keeps technical Users section active under trainer label', () => {
    const onNavigate = vi.fn()

    renderWithProviders(
      <NavigationTabs
        currentSection="Users"
        onNavigate={onNavigate}
        sections={sections}
      />,
    )

    expect(screen.getByRole('button', { name: 'Тренеры' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Тренеры' }))

    expect(onNavigate).toHaveBeenCalledWith('Users')
  })

  test('AppLayout and Header render brand and profile without embedded navigation', () => {
    renderWithProviders(
      <AppLayout
        header={(
          <Header
            brandTitle="Iron Club"
            brandMeta="Главный тренер"
            profileControl={<button type="button">Профиль</button>}
          />
        )}
      >
        <main>Рабочая область</main>
      </AppLayout>,
    )

    expect(screen.getByRole('banner')).toBeVisible()
    expect(screen.getByText('Iron Club')).toBeVisible()
    expect(screen.getAllByText('Главный тренер')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Профиль' })).toBeVisible()
    expect(screen.queryByRole('navigation', { name: 'Основная навигация' })).not.toBeInTheDocument()
    expect(screen.getByText('Рабочая область')).toBeVisible()
  })

  test('AppLayout can render vertical navigation in navbar slot', () => {
    renderWithProviders(
      <AppLayout
        header={<Header brandMeta="Главный тренер" />}
        navbar={(
          <NavigationTabs
            currentSection="Home"
            onNavigate={() => undefined}
            orientation="vertical"
            sections={sections}
          />
        )}
      >
        <main>Рабочая область</main>
      </AppLayout>,
    )

    const desktopNavigation = screen.getByRole('navigation', { name: 'Основная навигация' })

    expect(desktopNavigation).toBeVisible()
    expect(desktopNavigation).toHaveAttribute('data-orientation', 'vertical')
    expect(within(desktopNavigation).getByRole('button', { name: 'Главная' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('PageLayout renders route title, description, actions and shared wrapper', () => {
    const { container } = renderWithProviders(
      <PageLayout
        actions={<button type="button">Обновить</button>}
        data-testid="layout-test"
        description="Описание страницы"
        title="Клиенты"
      >
        <p>Рабочая область</p>
      </PageLayout>,
    )

    expect(screen.getByTestId('layout-test')).toHaveClass('page-layout')
    expect(screen.getByRole('heading', { level: 1, name: 'Клиенты' })).toBeVisible()
    expect(screen.getByText('Описание страницы')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeVisible()
    expect(screen.getByText('Рабочая область')).toBeVisible()
    expect(container.querySelector('.page-layout__header')).toBeTruthy()
  })

  test('PageLayout can keep its semantic title without rendering a page header', () => {
    renderWithProviders(
      <PageLayout showHeader={false} title="Главная">
        <div>Рабочая область</div>
      </PageLayout>,
    )

    expect(screen.getByText('Рабочая область')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Главная' })).not.toBeInTheDocument()
  })

  test('PageSection renders card and plain variants with density classes', () => {
    const { container } = renderWithProviders(
      <>
        <PageSection data-testid="card-section" density="compact">
          Карточка
        </PageSection>
        <PageSection data-testid="plain-section" variant="plain">
          Плоская секция
        </PageSection>
      </>,
    )

    expect(screen.getByTestId('card-section')).toHaveClass(
      'page-section',
      'page-section--card',
      'page-section--density-compact',
      'surface-card',
    )
    expect(screen.getByTestId('plain-section')).toHaveClass(
      'page-section',
      'page-section--plain',
    )
    expect(container.querySelector('.page-section--card')).toBeTruthy()
  })

  test('SectionHeader renders section copy without route-level H1 semantics', () => {
    renderWithProviders(
      <SectionHeader
        actions={<button type="button">Добавить</button>}
        description="Описание секции"
        title="Список клиентов"
      />,
    )

    expect(screen.getByRole('heading', { level: 2, name: 'Список клиентов' })).toBeVisible()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(screen.getByText('Описание секции')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeVisible()
  })

  test('PageTabsPanel wraps tab content in stable panel spacing container', () => {
    const { container } = renderWithProviders(
      <Tabs defaultValue="first">
        <Tabs.List>
          <Tabs.Tab value="first">Первая</Tabs.Tab>
        </Tabs.List>
        <PageTabsPanel value="first">
          <p>Содержимое вкладки</p>
        </PageTabsPanel>
      </Tabs>,
    )

    expect(screen.getByText('Содержимое вкладки')).toBeVisible()
    expect(container.querySelector('.page-tabs-panel')).toBeTruthy()
    expect(container.querySelector('.page-tabs-panel__content')).toBeTruthy()
  })

  test('PageCard renders nested content through shared page section alias', () => {
    const { container } = renderWithProviders(
      <PageCard>
        <p>Контент вкладки</p>
      </PageCard>,
    )

    expect(screen.getByText('Контент вкладки')).toBeVisible()
    expect(container.querySelector('.page-card')).toBeTruthy()
    expect(container.querySelector('.page-section--card')).toBeTruthy()
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

    rerender(
      <PageHeader actions={<button type="button">Только действие</button>} />,
    )

    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Только действие' })).toBeVisible()
  })

  test('FilterToolbar keeps controls and actions in shared layout', () => {
    const { container } = renderWithProviders(
      <FilterToolbar
        actions={<button type="button">Сбросить</button>}
        className="custom-toolbar"
      >
        <label>
          Поиск
          <input />
        </label>
      </FilterToolbar>,
    )

    expect(container.querySelector('.filter-toolbar.custom-toolbar')).toBeTruthy()
    expect(container.querySelector('.filter-toolbar__controls')).toBeTruthy()
    expect(container.querySelector('.filter-toolbar__actions')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Сбросить' })).toBeVisible()
  })

  test('CompactFilterPanel renders inline filters with more filters and reset actions', () => {
    const onReset = vi.fn()

    renderWithProviders(
      <CompactFilterPanel
        actions={<button type="button">Обновить</button>}
        onReset={onReset}
        primary={[
          {
            key: 'query',
            label: 'Поиск',
            render: () => (
              <label>
                Поиск
                <input />
              </label>
            ),
          },
        ]}
        secondary={[
          {
            key: 'status',
            label: 'Статус',
            render: () => (
              <label>
                Статус
                <input />
              </label>
            ),
          },
        ]}
      />,
    )

    expect(screen.getAllByLabelText('Поиск')[0]).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ещё фильтры/i })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeVisible()
    expect(screen.getByRole('button', { name: /Сбросить/i })).toBeVisible()
    expect(screen.queryByText(/\d+\s*фильтр/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Сбросить/i }))

    expect(onReset).toHaveBeenCalledTimes(1)
  })

  test('CompactFilterPanel keeps mobile page free of inline filter controls until sheet opens', async () => {
    const originalMatchMedia = window.matchMedia

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    })

    try {
      renderWithProviders(
        <CompactFilterPanel
          onReset={() => undefined}
          primary={[
            {
              key: 'query',
              label: 'Поиск',
              render: () => (
                <label>
                  Поиск
                  <input />
                </label>
              ),
            },
          ]}
        />,
      )

      expect(screen.getByRole('button', { name: 'Фильтры' })).toBeVisible()
      expect(screen.queryByLabelText('Поиск')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Фильтры' }))

      expect(await screen.findByLabelText('Поиск')).toBeInTheDocument()
      expect(await screen.findByRole('button', { name: /Сбросить/i })).toBeInTheDocument()
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: originalMatchMedia,
      })
    }
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
