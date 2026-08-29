import {
  Alert,
  Badge,
  Group,
  Loader,
  Notification,
  Select,
  Skeleton as MantineSkeleton,
  Tabs,
  TextInput,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUser,
} from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { LoginScreen, StageFrame } from '../app/AuthStages'
import type { AppSection } from '../lib/api'
import {
  ActiveFiltersBar,
  AppLayout,
  AppPagination,
  Button,
  ClientAvatar,
  CompactFilterPanel,
  ConfirmActionModal,
  EmptyState,
  EntityLocatorBar,
  ErrorState,
  FilterToolbar,
  Header,
  IconButton,
  ListRangeStatus,
  LoadingState,
  MobileBottomNavigation,
  NavigationTabs,
  PageCard,
  PageHeader,
  PageLayout,
  PageSection,
  PageTabsPanel,
  RefreshButton,
  ResponsiveButtonGroup,
  RestrictedState,
  SectionHeader,
  Skeleton,
  StickyFormActions,
  TaskItem,
  TaskToolbarAction,
  TaskToolbarActions,
  TaskToolbarRefreshAction,
  TemporarySurfaceFooter,
} from '../features/shared/ux'
import {
  getSemanticToneAttributes,
  getSemanticToneComponentProps,
} from '../theme/semanticTones'
import {
  getSharedComponentSource,
  type SharedComponentName,
} from './componentInventory'

const sourceUrlRoot = 'https://github.com/chaniev/crm/blob/main/'
const navigationSections: AppSection[] = [
  'Attendance',
  'Schedule',
  'Clients',
  'Groups',
  'Users',
  'Settings',
]

function CatalogExample({
  children,
  name,
}: {
  children: ReactNode
  name: SharedComponentName
}) {
  const source = getSharedComponentSource(name)

  return (
    <article
      className="catalog-example"
      data-catalog-component={name}
      data-testid={`catalog-component-${name}`}
    >
      <header className="catalog-example__header">
        <h3>{name}</h3>
        <a
          aria-label={`Source: ${name}`}
          href={`${sourceUrlRoot}${source}`}
          rel="noreferrer"
          target="_blank"
        >
          source
        </a>
      </header>
      <div className="catalog-example__body">{children}</div>
    </article>
  )
}

function RecipeCatalog() {
  return (
    <section
      aria-labelledby="recipes-heading"
      className="catalog-section"
      data-testid="catalog-reference-form"
    >
      <div className="catalog-section__heading">
        <div>
          <h2 id="recipes-heading">Mantine recipes</h2>
          <p>Production recipes: default, focusable, loading, disabled and error semantics.</p>
        </div>
        <a
          href={`${sourceUrlRoot}frontend/src/theme/componentRecipes.ts`}
          rel="noreferrer"
          target="_blank"
        >
          componentRecipes.ts
        </a>
      </div>
      <div className="catalog-example-grid">
        <div className="catalog-example catalog-recipe" data-testid="catalog-recipe-inputs">
          <h3>Form controls</h3>
          <TextInput
            description="Связанный helper text"
            error="Введите корректное имя клиента"
            label="Имя клиента"
            placeholder="Например, Александра"
          />
          <Select
            data={['Все группы', 'Утренняя группа', 'Вечерняя группа']}
            defaultValue="Все группы"
            label="Группа"
          />
          <TextInput disabled label="Недоступное поле" value="Управляется сервером" />
        </div>
        <div className="catalog-example catalog-recipe" data-testid="catalog-recipe-feedback">
          <h3>Feedback</h3>
          <Alert
            {...getSemanticToneAttributes('danger')}
            color={getSemanticToneComponentProps('danger').color}
            icon={<IconAlertCircle size={18} />}
            title="Не удалось сохранить"
          >
            Проверьте соединение и повторите действие.
          </Alert>
          <Group>
            <Badge>Нейтральный</Badge>
            <Badge {...getSemanticToneAttributes('success')}>Сохранено</Badge>
            <Loader aria-label="Загрузка" />
          </Group>
          <Notification
            {...getSemanticToneAttributes('info')}
            title="Расписание обновлено"
            withCloseButton={false}
          >
            Новые занятия уже доступны тренерам.
          </Notification>
          <MantineSkeleton height={44} />
        </div>
      </div>
    </section>
  )
}

export function SharedComponentsCatalog({ longContent }: { longContent: boolean }) {
  const [query, setQuery] = useState(longContent
    ? 'Северный спортивный центр имени команды чемпионов'
    : 'Александра')
  const [page, setPage] = useState(2)
  const [confirmOpened, setConfirmOpened] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [activeFilters, setActiveFilters] = useState([
    { id: 'status', label: 'Только активные' },
    { id: 'group', label: 'Утренняя группа с длинным названием' },
  ])

  const compactFilters = [
    {
      key: 'group',
      label: 'Группа',
      render: () => (
        <Select
          aria-label="Группа в compact filter"
          data={['Все группы', 'Утренняя группа', 'Вечерняя группа']}
          defaultValue="Все группы"
        />
      ),
    },
    {
      key: 'status',
      label: 'Статус',
      render: () => (
        <Select
          aria-label="Статус в compact filter"
          data={['Все статусы', 'Активные', 'Приостановленные']}
          defaultValue="Все статусы"
        />
      ),
    },
  ]

  return (
    <>
      <section
        aria-labelledby="auth-reference-heading"
        className="catalog-section"
        data-testid="catalog-reference-auth"
      >
        <div className="catalog-section__heading">
          <div>
            <h2 id="auth-reference-heading">Authentication reference</h2>
            <p>Production login screen with deterministic, image-free background.</p>
          </div>
        </div>
        <div className="catalog-auth-reference">
          <StageFrame
            authBackground={{
              asset: null,
              focalPoint: { xPercent: 50, yPercent: 50 },
              profileId: null,
            }}
          >
            <LoginScreen
              clubName={longContent
                ? 'Спортивный комплекс с очень длинным названием для проверки переноса'
                : 'Gym CRM'}
              onSubmit={async () => undefined}
              pending={false}
              showSetupHelp={false}
            />
          </StageFrame>
        </div>
      </section>

      <RecipeCatalog />

      <section
        aria-labelledby="actions-heading"
        className="catalog-section"
        data-testid="catalog-reference-actions"
      >
        <div className="catalog-section__heading">
          <div>
            <h2 id="actions-heading">Actions and feedback</h2>
            <p>Canonical hierarchy and observable pending, disabled and destructive states.</p>
          </div>
        </div>
        <div className="catalog-example-grid">
          <CatalogExample name="Button">
            <Group>
              <Button>Сохранить</Button>
              <Button variant="secondary">Отмена</Button>
              <Button variant="ghost">Подробнее</Button>
              <Button variant="destructive">Удалить</Button>
              <Button loading>Сохраняем</Button>
              <Button disabled>Недоступно</Button>
            </Group>
          </CatalogExample>
          <CatalogExample name="IconButton">
            <Group>
              <IconButton icon={<IconPlus />} label="Добавить клиента" variant="primary" />
              <IconButton icon={<IconRefresh />} label="Обновить список" />
              <IconButton disabled icon={<IconTrash />} label="Удаление недоступно" />
            </Group>
          </CatalogExample>
          <CatalogExample name="ResponsiveButtonGroup">
            <ResponsiveButtonGroup>
              <Button>Применить</Button>
              <Button variant="secondary">Сбросить</Button>
            </ResponsiveButtonGroup>
          </CatalogExample>
          <CatalogExample name="TaskToolbarActions">
            <TaskToolbarActions
              frequentActions={<Button variant="secondary">Экспорт</Button>}
              primaryAction={<Button>Добавить клиента</Button>}
            />
          </CatalogExample>
          <CatalogExample name="TaskToolbarAction">
            <TaskToolbarAction icon={<IconPlus />} label="Создать группу" priority="primary" />
          </CatalogExample>
          <CatalogExample name="TaskToolbarRefreshAction">
            <TaskToolbarRefreshAction label="Обновить расписание" />
          </CatalogExample>
          <CatalogExample name="RefreshButton">
            <RefreshButton label="Повторить загрузку" />
          </CatalogExample>
          <CatalogExample name="ConfirmActionModal">
            <Button onClick={() => setConfirmOpened(true)} variant="destructive">
              Открыть подтверждение
            </Button>
            <ConfirmActionModal
              confirmLabel="Удалить запись"
              description="Запись клиента исчезнет из текущего расписания."
              onClose={() => setConfirmOpened(false)}
              onConfirm={() => setConfirmOpened(false)}
              opened={confirmOpened}
              title="Удалить запись?"
            />
          </CatalogExample>
        </div>
      </section>

      <section
        aria-labelledby="locator-heading"
        className="catalog-section"
        data-testid="catalog-reference-locator"
      >
        <div className="catalog-section__heading">
          <div>
            <h2 id="locator-heading">Search, filters and collection controls</h2>
            <p>Long Russian values remain operable without horizontal page scrolling.</p>
          </div>
        </div>
        <div className="catalog-example-grid catalog-example-grid--wide">
          <CatalogExample name="EntityLocatorBar">
            <EntityLocatorBar
              accessibleLabel="Найти клиента"
              activeFilterCount={activeFilters.length}
              onChange={setQuery}
              onClear={() => setQuery('')}
              onOpenFilters={() => undefined}
              placeholder="Имя или телефон"
              primaryAction={<IconButton icon={<IconPlus />} label="Добавить клиента" variant="primary" />}
              resultsId="catalog-client-results"
              value={query}
            />
          </CatalogExample>
          <CatalogExample name="ActiveFiltersBar">
            <ActiveFiltersBar
              filters={activeFilters.map((filter) => ({
                ...filter,
                onRemove: () => setActiveFilters((current) =>
                  current.filter(({ id }) => id !== filter.id)),
              }))}
              onReset={() => setActiveFilters([])}
              resetLabel="Сбросить фильтры"
            />
          </CatalogExample>
          <CatalogExample name="FilterToolbar">
            <FilterToolbar actions={<Button variant="secondary">Сбросить</Button>}>
              <TextInput aria-label="Поиск в toolbar" leftSection={<IconSearch size={18} />} />
              <Select aria-label="Статус" data={['Все', 'Активные']} defaultValue="Все" />
            </FilterToolbar>
          </CatalogExample>
          <CatalogExample name="CompactFilterPanel">
            <CompactFilterPanel
              onReset={() => undefined}
              primary={compactFilters.slice(0, 1)}
              secondary={compactFilters.slice(1)}
            />
          </CatalogExample>
          <CatalogExample name="ListRangeStatus">
            <ListRangeStatus end={40} hasMore start={21} total={128} />
          </CatalogExample>
          <CatalogExample name="AppPagination">
            <AppPagination
              label="Страницы клиентов"
              onChange={setPage}
              page={page}
              summary={<span>21–40 из 128</span>}
              total={7}
            />
          </CatalogExample>
        </div>
      </section>

      <section
        aria-labelledby="content-heading"
        className="catalog-section"
        data-testid="catalog-reference-operational"
      >
        <div className="catalog-section__heading">
          <div>
            <h2 id="content-heading">Content and operational states</h2>
            <p>Identity, progress, empty, recovery and restricted contracts.</p>
          </div>
        </div>
        <div className="catalog-example-grid">
          <CatalogExample name="ClientAvatar">
            <Group>
              <ClientAvatar name="Александра Михайловна Долгополова" />
              <ClientAvatar name="Иван" />
            </Group>
          </CatalogExample>
          <CatalogExample name="TaskItem">
            <TaskItem
              accessibleName="Открыть клиента Александра Долгополова"
              identity={longContent
                ? 'Александра Михайловна Долгополова — персональная программа восстановления'
                : 'Александра Долгополова'}
              interaction={{
                kind: 'button',
                onActivate: () => setPressed((current) => !current),
                pressed,
              }}
              leading={<ClientAvatar name="Александра Долгополова" size="sm" />}
              metadata="Утренняя группа · +7 999 123-45-67"
              status={<Badge>{pressed ? 'Выбрано' : 'Активен'}</Badge>}
            />
          </CatalogExample>
          <CatalogExample name="LoadingState">
            <LoadingState description="Сохраняем выбранные фильтры" label="Обновляем клиентов…" />
          </CatalogExample>
          <CatalogExample name="Skeleton">
            <Skeleton rowHeight={52} rows={2} />
          </CatalogExample>
          <CatalogExample name="EmptyState">
            <EmptyState
              action={<Button>Добавить первого клиента</Button>}
              icon={<IconUser />}
              title="Клиенты не найдены"
              description="Измените запрос или сбросьте фильтры."
            />
          </CatalogExample>
          <CatalogExample name="ErrorState">
            <ErrorState
              action={<Button variant="secondary">Повторить</Button>}
              message="Сервер временно недоступен. Введённые фильтры сохранены."
              title="Не удалось загрузить клиентов"
            />
          </CatalogExample>
          <CatalogExample name="RestrictedState">
            <RestrictedState
              description="Для просмотра журнала обратитесь к администратору клуба."
              primaryAction={<Button>Вернуться к клиентам</Button>}
              title="Нет доступа к журналу"
              titleOrder={3}
            />
          </CatalogExample>
        </div>
      </section>

      <section
        aria-labelledby="layout-heading"
        className="catalog-section"
        data-testid="catalog-reference-shell"
      >
        <div className="catalog-section__heading">
          <div>
            <h2 id="layout-heading">Layout and navigation contracts</h2>
            <p>Isolated fixture frames preserve production component markup and behavior.</p>
          </div>
        </div>
        <div className="catalog-example-grid catalog-example-grid--wide">
          <CatalogExample name="PageHeader">
            <PageHeader actions={<Button>Добавить</Button>} title="Клиенты" titleOrder={3} />
          </CatalogExample>
          <CatalogExample name="SectionHeader">
            <SectionHeader actions={<Button variant="secondary">Изменить</Button>} title="Контакты" titleOrder={3} />
          </CatalogExample>
          <CatalogExample name="PageSection">
            <PageSection>Карточная секция с production spacing и elevation.</PageSection>
          </CatalogExample>
          <CatalogExample name="PageCard">
            <PageCard>Совместимый alias для существующих экранов.</PageCard>
          </CatalogExample>
          <CatalogExample name="PageLayout">
            <PageLayout actions={<Button>Создать</Button>} title="Группы">
              <PageSection variant="plain">Основное содержимое страницы</PageSection>
            </PageLayout>
          </CatalogExample>
          <CatalogExample name="PageTabsPanel">
            <Tabs defaultValue="clients">
              <Tabs.List>
                <Tabs.Tab value="clients">Клиенты</Tabs.Tab>
                <Tabs.Tab value="groups">Группы</Tabs.Tab>
              </Tabs.List>
              <PageTabsPanel value="clients">Содержимое активной вкладки</PageTabsPanel>
            </Tabs>
          </CatalogExample>
          <CatalogExample name="TemporarySurfaceFooter">
            <TemporarySurfaceFooter
              primaryAction={<Button>Применить</Button>}
              secondaryAction={<Button variant="secondary">Отмена</Button>}
            />
          </CatalogExample>
          <CatalogExample name="StickyFormActions">
            <div className="catalog-sticky-form-actions">
              <StickyFormActions
                primaryAction={<Button>Сохранить</Button>}
                secondaryAction={<Button variant="secondary">Отмена</Button>}
              />
            </div>
          </CatalogExample>
          <CatalogExample name="Header">
            <div className="catalog-isolated-header">
              <Header
                navigation={<span>Навигация</span>}
                profileControl={<IconButton icon={<IconUser />} label="Профиль пользователя" />}
              />
            </div>
          </CatalogExample>
          <CatalogExample name="NavigationTabs">
            <NavigationTabs
              ariaLabel="Пример основной навигации"
              currentSection="Clients"
              onNavigate={() => undefined}
              sections={navigationSections.slice(0, 4)}
            />
          </CatalogExample>
          <CatalogExample name="MobileBottomNavigation">
            <div className="catalog-isolated-mobile-nav">
              <MobileBottomNavigation
                currentSection="Clients"
                onNavigate={() => undefined}
                sections={navigationSections}
              />
            </div>
          </CatalogExample>
          <CatalogExample name="AppLayout">
            <div className="catalog-isolated-shell">
              <AppLayout
                header={<div className="catalog-shell-label">Shell header</div>}
                mainLabel="Пример содержимого приложения"
                navbar={<div className="catalog-shell-label">Navigation</div>}
                navbarConfiguration={{ width: 144, breakpoint: 0 }}
              >
                <div className="catalog-shell-label">Task content</div>
              </AppLayout>
            </div>
          </CatalogExample>
        </div>
      </section>
    </>
  )
}
