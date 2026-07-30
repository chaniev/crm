import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Tabs } from '@mantine/core'
import { describe, expect, test, vi } from 'vitest'
import type { AppSection } from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import {
  AppLayout,
  Button,
  EntityLocatorBar,
  ActiveFiltersBar,
  ListRangeStatus,
  MobileBottomNavigation,
  RestrictedState,
  TaskItem,
  TemporarySurfaceFooter,
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
  TaskToolbarAction,
  TaskToolbarActions,
  TaskToolbarRefreshAction,
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
            profileControl={<button type="button">Профиль</button>}
          />
        )}
      >
        <main>Рабочая область</main>
      </AppLayout>,
    )

    expect(screen.getByRole('banner')).toBeVisible()
    expect(screen.getByText('Iron Club')).toBeVisible()
    expect(document.querySelector('.app-shell__brand-meta')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Профиль' })).toBeVisible()
    expect(screen.queryByRole('navigation', { name: 'Основная навигация' })).not.toBeInTheDocument()
    expect(screen.getByText('Рабочая область')).toBeVisible()
  })

  test('AppLayout can render vertical navigation in navbar slot', () => {
    renderWithProviders(
      <AppLayout
        header={<Header />}
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

  test('PageLayout renders route title, actions and shared wrapper', () => {
    const { container } = renderWithProviders(
      <PageLayout
        actions={<button type="button">Обновить</button>}
        data-testid="layout-test"
        title="Клиенты"
      >
        <p>Рабочая область</p>
      </PageLayout>,
    )

    expect(screen.getByTestId('layout-test')).toHaveClass('page-layout')
    expect(screen.getByRole('heading', { level: 1, name: 'Клиенты' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeVisible()
    expect(screen.getByText('Рабочая область')).toBeVisible()
    expect(container.querySelector('.page-layout__header')).toBeTruthy()
  })

  test('PageLayout keeps semantic heading when header is hidden', () => {
    renderWithProviders(
      <PageLayout showHeader={false} title="Главная">
        <div>Рабочая область</div>
      </PageLayout>,
    )

    expect(screen.getByText('Рабочая область')).toBeVisible()
    expect(
      screen.getByRole('heading', {
        hidden: true,
        level: 1,
        name: 'Главная',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        hidden: true,
        level: 1,
        name: 'Главная',
      }),
    ).toHaveClass('visually-hidden')
  })

  test('PageLayout can delegate the only h1 to route-state content', () => {
    renderWithProviders(
      <PageLayout renderHiddenHeading={false} showHeader={false} title="Нет доступа">
        <h1>Нет доступа</h1>
      </PageLayout>,
    )

    expect(screen.getAllByRole('heading', { hidden: true, level: 1, name: 'Нет доступа' })).toHaveLength(1)
  })

  test('MobileBottomNavigation surfaces overflow via drawer and keeps active route semantics', async () => {
    const onNavigate = vi.fn()

    renderWithProviders(
      <MobileBottomNavigation
        currentSection="Home"
        onNavigate={onNavigate}
        sections={sections}
      />,
    )

    const overflowTrigger = screen.getByRole('button', { name: 'Ещё, открыть остальные разделы' })
    const homeButton = screen.getByRole('button', { name: 'Главная' })

    expect(screen.getByRole('navigation', { name: 'Мобильная навигация' })).toBeVisible()
    expect(overflowTrigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(overflowTrigger).toHaveAttribute('aria-expanded', 'false')
    expect(homeButton).toHaveAttribute('aria-current', 'page')
    expect(overflowTrigger).not.toHaveAttribute('aria-current', 'page')

    fireEvent.click(overflowTrigger)
    expect(overflowTrigger).toHaveAttribute('aria-expanded', 'true')

    const overflowItem = await screen.findByRole('button', { name: 'Тренеры' })
    fireEvent.click(overflowItem)

    expect(onNavigate).toHaveBeenCalledWith('Users')
  })

  test('MobileBottomNavigation keeps overflow trigger stable when active route is displaced', () => {
    renderWithProviders(
      <MobileBottomNavigation
        currentSection="Users"
        onNavigate={() => undefined}
        sections={sections}
      />,
    )

    const overflowTrigger = screen.getByRole('button', { name: 'Ещё, открыть остальные разделы' })

    expect(overflowTrigger).not.toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Тренеры' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('MobileBottomNavigation does not render overflow trigger when no overflow exists', () => {
    renderWithProviders(
      <MobileBottomNavigation
        currentSection="Home"
        onNavigate={() => undefined}
        sections={['Home', 'Clients', 'Groups']}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Ещё, открыть остальные разделы' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Главная' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Клиенты' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Группы' })).toBeVisible()
  })

  test('MobileBottomNavigation promotes displaced active overflow section into visible fourth slot', () => {
    renderWithProviders(
      <MobileBottomNavigation
        currentSection="Users"
        onNavigate={() => undefined}
        sections={['Home', 'Schedule', 'Clients', 'Groups', 'Users', 'Audit']}
      />,
    )

    const root = screen.getByRole('navigation', { name: 'Мобильная навигация' })
    const labels = within(root)
      .getAllByRole('button')
      .map((button) => button.textContent?.trim())
      .filter(Boolean)

    expect(labels).toEqual(['Главная', 'Расписание', 'Клиенты', 'Тренеры', 'Ещё'])
    expect(screen.getByRole('button', { name: 'Тренеры' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Ещё, открыть остальные разделы' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  test('MobileBottomNavigation moves displaced section into overflow drawer and toggles expanded state', async () => {
    renderWithProviders(
      <MobileBottomNavigation
        currentSection="Users"
        onNavigate={() => undefined}
        sections={['Home', 'Schedule', 'Clients', 'Groups', 'Users', 'Audit']}
      />,
    )

    const overflowTrigger = screen.getByRole('button', { name: 'Ещё, открыть остальные разделы' })

    fireEvent.click(overflowTrigger)
    const overflowList = await screen.findByRole('dialog')
    const drawerItemGroup = within(overflowList).getByRole('button', { name: 'Группы' })
    const drawerItemAudit = within(overflowList).getByRole('button', { name: 'Журнал' })

    expect(overflowTrigger).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => {
      expect(drawerItemGroup).toBeVisible()
      expect(drawerItemAudit).toBeVisible()
    })
    expect(within(overflowList).queryByRole('button', { name: 'Тренеры' })).not.toBeInTheDocument()
  })

  test('EntityLocatorBar keeps locator, filter count, clear, and action slots in one task row', async () => {
    const onFilterOpen = vi.fn()
    const onFilterClear = vi.fn()
    const onChange = vi.fn()

    renderWithProviders(
      <EntityLocatorBar
        data-testid="entity-locator-bar"
        accessibleLabel="Поиск клиентов"
        placeholder="Поиск клиентов..."
        value="Алекс"
        onChange={onChange}
        onClear={onFilterClear}
        onOpenFilters={onFilterOpen}
        activeFilterCount={2}
        resultsId="entity-results"
        primaryAction={<button type="button">Создать</button>}
        disabled={false}
      />,
    )

    const locatorRoot = screen.getByTestId('entity-locator-bar')
    const locator = screen.getByRole('search')
    const searchInput = within(locator).getByRole('textbox', { name: 'Поиск клиентов' })
    const filtersToggle = screen.getByRole('button', { name: /фильтры/i })
    const clearButton = screen.getByRole('button', { name: /сброс/i })

    expect(locatorRoot).toHaveClass('entity-locator-bar', 'crm-filter-surface')
    expect(locatorRoot).toHaveAttribute('role', 'search')
    expect(searchInput).toBeVisible()
    expect(searchInput).toHaveAttribute('aria-controls', 'entity-results')
    expect(filtersToggle).toHaveAttribute('aria-haspopup', 'dialog')
    expect(filtersToggle).toBeVisible()
    expect(clearButton).toBeVisible()

    fireEvent.change(searchInput, { target: { value: 'Алина' } })
    expect(onChange).toHaveBeenCalledWith('Алина')

    fireEvent.click(clearButton)
    expect(onFilterClear).toHaveBeenCalled()

    fireEvent.click(filtersToggle)
    expect(onFilterOpen).toHaveBeenCalled()

    expect(screen.getByRole('button', { name: 'Создать' })).toBeVisible()
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
  })

  test('EntityLocatorBar keeps clear action with dedicated touch contract class', () => {
    renderWithProviders(
      <EntityLocatorBar
        data-testid="entity-locator-bar"
        accessibleLabel="Поиск клиентов"
        placeholder="Поиск клиентов..."
        value="Алекс"
        onChange={() => undefined}
        onClear={() => undefined}
        onOpenFilters={() => undefined}
        activeFilterCount={0}
        resultsId="entity-results"
      />,
    )

    const clearButton = screen.getByRole('button', { name: 'Сбросить поисковый запрос' })

    expect(clearButton).toHaveClass('entity-locator-bar__clear')
    expect(clearButton).toHaveAttribute('type', 'button')
  })

  test('EntityLocatorBar keeps primary and frequent actions in the same non-wrapping container', () => {
    renderWithProviders(
      <EntityLocatorBar
        data-testid="entity-locator-bar"
        accessibleLabel="Поиск клиентов"
        placeholder="Поиск..."
        value=""
        onChange={() => undefined}
        onClear={() => undefined}
        onOpenFilters={() => undefined}
        activeFilterCount={1}
        resultsId="entity-results"
        primaryAction={<button type="button">Создать</button>}
        frequentActions={<button type="button">Импорт</button>}
      />,
    )

    const root = screen.getByTestId('entity-locator-bar')
    const actions = root.querySelector('.entity-locator-bar__actions')
    const primaryAction = screen.getByRole('button', { name: 'Создать' })
    const frequentAction = screen.getByRole('button', { name: 'Импорт' })

    expect(actions).toContainElement(primaryAction)
    expect(actions).toContainElement(frequentAction)
    expect(root).toHaveClass('entity-locator-bar', 'crm-filter-surface')
  })

  test('EntityLocatorBar can render locator actions without a filter trigger', () => {
    renderWithProviders(
      <EntityLocatorBar
        data-testid="entity-locator-bar"
        accessibleLabel="Поиск тренеров"
        placeholder="Имя тренера"
        value=""
        onChange={() => undefined}
        onClear={() => undefined}
        resultsId="users-results"
        frequentActions={<TaskToolbarRefreshAction label="Обновить" onClick={() => undefined} />}
        primaryAction={(
          <TaskToolbarAction
            icon={<span aria-hidden="true">+</span>}
            label="Создать тренера"
            onClick={() => undefined}
            priority="primary"
          />
        )}
      />,
    )

    const locator = screen.getByRole('search')
    const searchInput = screen.getByRole('textbox', { name: 'Поиск тренеров' })
    const refresh = screen.getByRole('button', { name: 'Обновить' })
    const create = screen.getByRole('button', { name: 'Создать тренера' })

    expect(within(locator).queryByRole('button', { name: /фильтры/i })).not.toBeInTheDocument()
    expect(searchInput).toHaveAttribute('aria-controls', 'users-results')
    expect(refresh).toHaveClass('task-toolbar-action', 'task-toolbar-action--refresh')
    expect(create).toHaveClass('task-toolbar-action', 'task-toolbar-action--primary')
  })

  test('TaskToolbarActions keeps frequent actions before the sole primary action', () => {
    renderWithProviders(
      <TaskToolbarActions
        data-testid="task-actions"
        frequentActions={<TaskToolbarRefreshAction label="Обновить список" onClick={() => undefined} />}
        primaryAction={(
          <TaskToolbarAction
            icon={<span aria-hidden="true">+</span>}
            label="Новый клиент"
            onClick={() => undefined}
            priority="primary"
          />
        )}
      />,
    )

    const actions = screen.getByTestId('task-actions')
    const buttons = within(actions).getAllByRole('button')

    expect(actions).toHaveClass('task-toolbar-actions')
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Обновить список',
      'Новый клиент',
    ])
    expect(buttons[0]).toHaveAttribute('data-action-priority', 'frequent')
    expect(buttons[1]).toHaveAttribute('data-action-priority', 'primary')
  })

  test('TaskToolbarAction and refresh action preserve exact accessible names and disabled states', () => {
    const onCreate = vi.fn()
    const onRefresh = vi.fn()

    renderWithProviders(
      <>
        <TaskToolbarAction
          icon={<span aria-hidden="true">+</span>}
          label="Добавить администратора"
          onClick={onCreate}
          priority="primary"
        />
        <TaskToolbarRefreshAction
          disabled
          label="Обновить список групп"
          loading
          onClick={onRefresh}
        />
      </>,
    )

    const create = screen.getByRole('button', { name: 'Добавить администратора' })
    const refresh = screen.getByRole('button', { name: 'Обновить список групп' })

    expect(create).toHaveClass('task-toolbar-action--primary')
    expect(refresh).toHaveClass('task-toolbar-action--refresh')
    expect(refresh).toBeDisabled()

    fireEvent.click(create)
    fireEvent.click(refresh)

    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onRefresh).not.toHaveBeenCalled()
  })

  test('ActiveFiltersBar renders accessible region with clear actions and minimum touch targets', () => {
    const onRemove = vi.fn()
    const onReset = vi.fn()

    renderWithProviders(
      <ActiveFiltersBar
        data-testid="active-filters"
        filters={[
          { id: 'status', label: 'Статус', onRemove },
          { id: 'branch', label: 'Филиал', onRemove },
        ]}
        onReset={onReset}
        resetLabel="Сбросить"
      />,
    )

    const region = screen.getByRole('region')
    const resetButton = screen.getByRole('button', { name: /сбросить/i })
    const buttons = within(region).getAllByRole('button')

    expect(region).toBeInTheDocument()
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(resetButton).toBeVisible()
    expect(buttons).toHaveLength(3)

    fireEvent.click(buttons[1])
    expect(onRemove).toHaveBeenCalledTimes(1)

    fireEvent.click(resetButton)
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  test('ListRangeStatus exposes status role semantics and avoids fabricated total while loading', () => {
    const { rerender } = renderWithProviders(
      <ListRangeStatus
        data-testid="list-range"
        start={1}
        end={20}
        total={200}
        hasMore={true}
      />,
    )

    const status = screen.getByRole('status')

    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent(/1\s*[–-]\s*20/)
    expect(status).toHaveTextContent('200')

    rerender(
      <ListRangeStatus
        data-testid="list-range"
        start={1}
        end={20}
        total={null}
        hasMore={false}
        loading={true}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/1\s*[–-]\s*20/)
    expect(screen.queryByText(/200/)).not.toBeInTheDocument()
  })

  test('TaskItem derives only the semantics declared by its interaction', () => {
    const onActivate = vi.fn()
    const { container, rerender } = renderWithProviders(
      <TaskItem
        accessibleName="Иван Петров"
        identity="Клиент"
        metadata="№1024"
        status="active"
      />,
    )

    const staticItem = container.firstElementChild
    expect(staticItem).not.toHaveAttribute('role')
    expect(staticItem).not.toHaveAttribute('tabindex')

    rerender(
      <TaskItem
        accessibleName="Иван Петров"
        identity="Клиент"
        metadata="№1024"
        status="active"
        leading={<span>Л</span>}
        interaction={{ kind: 'link', href: '/clients/1' }}
      />,
    )

    expect(screen.getByRole('link', { name: 'Иван Петров' })).toHaveAttribute(
      'href',
      '/clients/1',
    )

    rerender(
      <TaskItem
        accessibleName="Иван Петров"
        identity="Клиент"
        interaction={{ kind: 'button', onActivate, pressed: true }}
      />,
    )

    const actionButton = screen.getByRole('button', { name: 'Иван Петров' })
    expect(actionButton).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(actionButton)
    expect(onActivate).toHaveBeenCalledTimes(1)

    rerender(
      <ul role="listbox" aria-label="Варианты">
        <TaskItem
          accessibleName="Иван Петров"
          identity="Клиент"
          metadata="№1024"
          status="active"
          leading={<span>Л</span>}
          interaction={{ kind: 'option', onActivate, selected: false }}
        />
      </ul>,
    )

    const option = screen.getByRole('option')

    expect(option).toHaveAttribute('aria-selected', 'false')
    fireEvent.click(option)
    expect(onActivate).toHaveBeenCalledTimes(2)

    rerender(
      <div role="grid" aria-label="Задачи">
        <TaskItem
          accessibleName="Иван Петров"
          identity="Клиент"
          interaction={{ kind: 'row', onActivate, selected: true }}
        />
      </div>,
    )

    const row = screen.getByRole('row', { name: 'Иван Петров' })
    expect(row).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(onActivate).toHaveBeenCalledTimes(3)
  })

  test('RestrictedState moves focus to heading and exposes primary action after mount', async () => {
    const onRetry = vi.fn()

    renderWithProviders(
      <RestrictedState
        data-testid="restricted-state"
        title="Недостаточно прав"
        description="Доступ ограничен"
        primaryAction={<button type="button" onClick={onRetry}>Назад</button>}
        secondaryAction={<button type="button">Поддержка</button>}
        focusOnMount="primary-action"
      />,
    )

    const heading = screen.getByRole('heading', { level: 2, name: 'Недостаточно прав' })
    const primaryAction = screen.getByRole('button', { name: 'Назад' })

    expect(heading).toBeVisible()
    expect(primaryAction).toBeVisible()
    await waitFor(() => expect(document.activeElement).toBe(primaryAction))
    fireEvent.click(primaryAction)
  })

  test('RestrictedState can own a route-level h1', () => {
    renderWithProviders(
      <RestrictedState
        title="Нет доступа"
        titleOrder={1}
        description="Доступ ограничен"
        primaryAction={<button type="button">Открыть Главная</button>}
      />,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Нет доступа' })).toBeVisible()
  })

  test('TemporarySurfaceFooter keeps shared structure, action order, and safe-area ownership class', () => {
    renderWithProviders(
      <TemporarySurfaceFooter
        data-testid="temp-footer"
        secondaryAction={<button type="button">Отмена</button>}
        primaryAction={<button type="button">Сохранить</button>}
      />,
    )

    const footer = screen.getByTestId('temp-footer')
    const buttons = within(footer).getAllByRole('button')

    expect(footer).toHaveClass('temporary-surface-footer')
    expect(footer).toHaveAttribute('data-safe-area-aware', 'true')
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Отмена',
      'Сохранить',
    ])
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

    expect(container.querySelector('.filter-toolbar.crm-filter-surface.custom-toolbar')).toBeTruthy()
    expect(container.querySelector('.filter-toolbar__controls')).toBeTruthy()
    expect(container.querySelector('.filter-toolbar__actions')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Сбросить' })).toBeVisible()
  })

  test('shared filter surface recipe is a paint-only class on filter components', () => {
    const { container } = renderWithProviders(
      <>
        <FilterToolbar data-testid="filter-toolbar">
          <label>
            Поиск
            <input />
          </label>
        </FilterToolbar>
        <CompactFilterPanel
          data-testid="compact-panel"
          onReset={() => undefined}
          primary={[
            {
              key: 'query',
              label: 'Поиск',
              render: () => <label htmlFor="compact-query">Поиск<input id="compact-query" /></label>,
            },
          ]}
        />
      </>,
    )

    const filterToolbar = screen.getByTestId('filter-toolbar')
    const compactPanel = screen.getByTestId('compact-panel')

    expect(filterToolbar).toHaveClass('crm-filter-surface')
    expect(compactPanel).toHaveClass('crm-filter-surface')
    expect(container.querySelector('.crm-filter-surface .filter-toolbar__controls')).toBeTruthy()
    expect(container.querySelector('.crm-filter-surface .compact-filter-panel__desktop-row')).toBeTruthy()
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
          data-testid="compact-panel"
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

      const compactPanel = screen.getByTestId('compact-panel')

      expect(compactPanel).toHaveClass('crm-filter-surface')
      expect(screen.getByRole('button', { name: 'Фильтры' })).toBeVisible()
      expect(screen.queryByLabelText('Поиск')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Фильтры' }))

      expect(await screen.findByLabelText('Поиск')).toBeInTheDocument()
      expect(await screen.findByRole('button', { name: /Сбросить/i })).toBeInTheDocument()
      const applyButton = await screen.findByRole('button', { name: 'Готово' })
      const sheetActions = document.querySelector<HTMLElement>(
        '.compact-filter-panel__sheet-actions',
      )

      expect(sheetActions).not.toBeNull()
      expect(compactPanel).not.toContainElement(sheetActions)
      expect(within(sheetActions!).getAllByRole('button').map((button) => button.textContent)).toEqual([
        'Готово',
        'Сбросить',
      ])

      fireEvent.click(applyButton)

      await waitFor(() => {
        expect(screen.queryByLabelText('Поиск')).not.toBeInTheDocument()
      })
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: originalMatchMedia,
      })
    }
  })

  test('CompactFilterPanel mobile mode keeps launcher and sheet action classes', () => {
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
              render: () => <label htmlFor="query">Поиск<input id="query" /></label>,
            },
          ]}
        />,
      )

      const launcher = screen.getByRole('button', { name: 'Фильтры' })

      expect(launcher).toHaveClass('compact-filter-panel__mobile-launcher')
      expect(launcher).toHaveAttribute('type', 'button')
      expect(launcher).toHaveClass('shared-button')
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

  test('RefreshButton keeps shared refresh contract class', () => {
    renderWithProviders(<RefreshButton />)

    expect(screen.getByRole('button', { name: 'Обновить' })).toHaveClass('refresh-button')
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
