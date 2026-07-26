const manifest = await fetch('./manifest.json').then((response) => response.json())
const params = new URLSearchParams(window.location.search)
const requestedScreen = params.get('screen') || manifest.screens[0].id
const requestedTheme = params.get('theme') || 'default-green-v1'
const screen = manifest.screens.find((item) => item.id === requestedScreen) ?? manifest.screens[0]

document.body.dataset.theme = requestedTheme
document.body.dataset.screen = screen.id
document.title = `${screen.title} · TASK-090`

const iconPaths = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M9.5 20v-6h5v6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>',
  clients: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  groups: '<circle cx="9" cy="7" r="3"/><circle cx="17" cy="8" r="2.5"/><path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1M15 15a4 4 0 0 1 6 3.5V20"/>',
  dots: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  refresh: '<path d="M20 11a8 8 0 1 0 1 5"/><path d="M20 4v7h-7"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  warning: '<path d="M10.3 3.6 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  building: '<path d="M4 21V4h10v17M14 9h6v12M8 8h2M8 12h2M8 16h2M17 13h1M17 17h1M2 21h20"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  save: '<path d="M5 3h12l3 3v15H4V4a1 1 0 0 1 1-1Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
  shield: '<path d="M12 3 4 7v5c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V7Z"/><path d="m9 12 2 2 4-4"/>',
  money: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M17 14h.01"/><circle cx="12" cy="12" r="2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
  message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
  branch: '<path d="M6 3v12a4 4 0 0 0 4 4h8"/><circle cx="6" cy="3" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 9h7a4 4 0 0 0 4-4V3"/><circle cx="17" cy="3" r="2"/>',
}

function icon(name, size = 20) {
  const path = iconPaths[name] ?? iconPaths.dots
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`
}

const iconActionLabels = {
  back: 'Назад',
  close: 'Закрыть',
  edit: 'Редактировать',
  plus: 'Добавить',
  refresh: 'Обновить',
}

function button(label, {
  kind = 'default',
  iconName = '',
  block = false,
  extra = '',
  ariaLabel = '',
} = {}) {
  const classes = [
    'button',
    kind === 'primary' ? 'button--primary' : '',
    kind === 'accent' ? 'button--accent' : '',
    kind === 'soft' ? 'button--soft' : '',
    kind === 'danger' ? 'button--danger' : '',
    block ? 'button--block' : '',
    label === '' ? 'button--icon' : '',
    extra,
  ].filter(Boolean).join(' ')
  const accessibleName = ariaLabel || iconActionLabels[iconName] || ''
  const aria = label === '' && accessibleName ? ` aria-label="${accessibleName}"` : ''
  return `<button class="${classes}" type="button"${aria}>${iconName ? icon(iconName, 19) : ''}${label ? `<span>${label}</span>` : ''}</button>`
}

function badge(label, tone = 'brand') {
  return `<span class="badge badge--${tone}">${label}</span>`
}

function avatar(name, initials) {
  return `<span aria-label="${name}" class="avatar">${initials}</span>`
}

function pageHeader(title, actions = '') {
  return `
    <header class="page-header" data-geometry="page-header">
      <div class="page-header__copy">
        <h1>${title}</h1>
      </div>
      ${actions ? `<div class="page-header__actions">${actions}</div>` : ''}
    </header>`
}

function section(content, { compact = false, plain = false, subtle = false, extra = '' } = {}) {
  const classes = ['section', plain ? 'section--plain' : '', subtle ? 'section--subtle' : '', extra].filter(Boolean).join(' ')
  return `<section class="${classes}"><div class="section__inner${compact ? ' section__inner--compact' : ''}">${content}</div></section>`
}

function sectionTitle(title, description = '', action = '') {
  return `
    <div class="section-title-row">
      <div>
        <h2>${title}</h2>
        ${description ? `<p>${description}</p>` : ''}
      </div>
      ${action}
    </div>`
}

function locator({
  value = '',
  placeholder = 'Поиск',
  count = 0,
  label = 'Поиск',
  geometry = true,
  visibleLabel = false,
  kind = 'search',
  actions = '',
} = {}) {
  const isSearch = kind === 'search'
  const fieldRole = isSearch ? 'searchbox' : 'button'
  const fieldLabel = isSearch ? label : `${label}: ${value}`
  return `
    <div class="locator locator--${kind}${actions ? ' locator--with-actions' : ''}" role="${isSearch ? 'search' : 'group'}" data-locator-kind="${kind}"${geometry ? ' data-geometry="locator"' : ''}>
      <div class="locator__field">
        <span class="persistent-label${visibleLabel ? '' : ' sr-only'}">${label}</span>
        <div class="input-shell" role="${fieldRole}" aria-label="${fieldLabel}">
          ${icon(isSearch ? 'search' : 'calendar', 19)}
          <span class="${value ? 'input-shell__value' : 'input-shell__placeholder'}">${value || placeholder}</span>
          ${value ? icon('close', 18) : ''}
        </div>
      </div>
      <button aria-label="Открыть фильтры" class="filter-button" type="button">
        ${icon('filter', 20)}
        ${count ? `<span class="filter-button__count">${count}</span>` : ''}
      </button>
      ${actions ? `<div class="locator__actions">${actions}</div>` : ''}
    </div>`
}

function activeFilters(items) {
  return `<div aria-label="Активные фильтры" class="active-filters">${items.map((item) => `<span class="chip chip--active">${item}<span class="chip__remove">${icon('close', 15)}</span></span>`).join('')}</div>`
}

function rangeStatus(text) {
  return `<div class="range-status" data-geometry="range" role="status">${text}</div>`
}

function metric(label, value, hint = '') {
  return `<div class="metric"><div class="metric__label">${label}</div><div class="metric__value">${value}</div>${hint ? `<div class="metric__hint">${hint}</div>` : ''}</div>`
}

function field(label, value, { kind = 'input', description = '' } = {}) {
  const shell = kind === 'textarea'
    ? `<div class="text-area">${value}</div>`
    : `<div class="${kind === 'select' ? 'select-shell' : kind === 'date' ? 'date-shell' : 'input-shell'}"><span class="${value ? 'input-shell__value' : 'field-placeholder'}">${value || 'Не выбрано'}</span>${kind === 'select' ? icon('down', 18) : ''}</div>`
  return `<div class="field"><label>${label}</label>${shell}${description ? `<div class="field__description">${description}</div>` : ''}</div>`
}

function switchRow(label, meta, on = true) {
  return `<div class="switch-row"><div class="switch-row__copy"><div class="switch-row__label">${label}</div>${meta ? `<div class="switch-row__meta">${meta}</div>` : ''}</div><span class="switch${on ? ' switch--on' : ''}"></span></div>`
}

function header(role = 'Суперадминистратор') {
  return `
    <header class="app-header" data-geometry="app-header">
      <div class="app-header__inner">
        <div class="app-brand">
          <div class="app-brand__mark">K4</div>
          <div class="app-brand__copy">
            <div class="app-brand__title">K-4PRO</div>
            <div class="app-brand__meta">${role}</div>
          </div>
        </div>
        <button aria-label="Открыть профиль пользователя Мария Соколова" class="profile-trigger" type="button">МС</button>
      </div>
    </header>`
}

const navigationItems = [
  ['home', 'home', 'Главная'],
  ['schedule', 'calendar', 'Расписание'],
  ['clients', 'clients', 'Клиенты'],
  ['groups', 'groups', 'Группы'],
  ['users', 'user', 'Тренеры'],
  ['audit', 'list', 'Журнал'],
  ['finance', 'money', 'Финансы'],
  ['settings', 'settings', 'Настройки'],
]

const primaryNavigationIds = ['home', 'schedule', 'clients', 'groups']
const overflowNavigationIds = ['users', 'audit', 'finance', 'settings']

function mobileNavigation(active = 'home') {
  const visibleIds = overflowNavigationIds.includes(active)
    ? ['home', 'schedule', 'clients', active]
    : primaryNavigationIds
  const visibleItems = visibleIds.map((id) => navigationItems.find(([itemId]) => itemId === id))
  const hiddenItems = navigationItems.filter(([id]) => !visibleIds.includes(id))
  return { visibleItems, hiddenItems }
}

function bottomNav(active = 'home') {
  const { visibleItems } = mobileNavigation(active)
  const routeButtons = visibleItems.map(([id, iconName, label]) => {
    const current = active === id
    return `<button${current ? ' aria-current="page"' : ''} class="nav-item${current ? ' nav-item--active' : ''}" data-nav-id="${id}" type="button">${icon(iconName, 20)}<span class="nav-item__label">${label}</span></button>`
  }).join('')
  return `<nav aria-label="Мобильная навигация" class="bottom-nav" data-geometry="bottom-nav">${routeButtons}<button aria-expanded="false" aria-haspopup="dialog" aria-label="Ещё, открыть остальные разделы" class="nav-item" data-nav-id="more" type="button">${icon('dots', 20)}<span class="nav-item__label">Ещё</span></button></nav>`
}

function desktopNav(active = 'home') {
  return `<aside class="desktop-nav" data-geometry="desktop-nav"><nav aria-label="Основная навигация" class="desktop-nav__list">${navigationItems.map(([id, iconName, label]) => {
    const current = active === id
    return `<button${current ? ' aria-current="page"' : ''} class="desktop-nav__item${current ? ' desktop-nav__item--active' : ''}" data-nav-id="${id}" type="button">${icon(iconName, 20)}<span>${label}</span></button>`
  }).join('')}</nav></aside>`
}

function shell(content, { active = 'home', role = 'Суперадминистратор', sticky = '' } = {}) {
  return `<div class="screen-root" data-active-section="${active}">${header(role)}${desktopNav(active)}<main class="screen-main" data-geometry="screen-main"><div class="page-stack">${content}</div></main>${sticky}${bottomNav(active)}</div>`
}

function hiddenRouteTitle(title) {
  return `<h1 class="sr-only">${title}</h1>`
}

function overflowRows(active) {
  const { hiddenItems } = mobileNavigation(active)
  return `<div class="overflow-list">${hiddenItems.map(([id, iconName, label]) => `<div class="overflow-item" data-nav-id="${id}"><span class="overflow-item__icon">${icon(iconName, 20)}</span><span class="overflow-item__label">${label}</span>${icon('chevron', 18)}</div>`).join('')}</div>`
}

function statePanel(title, description, { tone = '', action = '', iconName = 'warning' } = {}) {
  return `<div class="state-panel${tone ? ` state-panel--${tone}` : ''}"><div class="state-panel__icon">${icon(iconName, 28)}</div><h2>${title}</h2><p>${description}</p>${action}</div>`
}

function clientItem(name, initials, phone, status, action, index, selected = false) {
  const tone = status.includes('Нет') || status.includes('Истекает') ? 'warning' : status.includes('Архив') ? 'neutral' : 'success'
  return `
    <article class="task-item task-item--client${selected ? ' task-item--selected' : ''}" data-geometry="task-item-${index}">
      ${avatar(name, initials)}
      <div>
        <div class="task-item__identity task-item__identity--wrap">${name}</div>
        <div class="task-item__meta">${phone}</div>
        <div style="margin-top:6px">${badge(status, tone)}</div>
      </div>
      <div class="task-item__action-copy">${action}<div style="display:flex;justify-content:flex-end;margin-top:5px">${icon('chevron', 18)}</div></div>
    </article>`
}

function compactClientItem(name, initials, phone, status, action, index) {
  const tone = status.includes('Нет') || status.includes('Истекает') ? 'warning' : 'success'
  return `
    <article class="task-item task-item--client-compact" data-geometry="task-item-${index}">
      ${avatar(name, initials)}
      <div>
        <div class="task-item__identity task-item__identity--wrap">${name}</div>
        <div class="client-compact__meta"><span>${phone}</span>${badge(status, tone)}</div>
      </div>
      <div class="task-item__action-copy">${action}<div style="display:flex;justify-content:flex-end;margin-top:5px">${icon('chevron', 18)}</div></div>
    </article>`
}

function groupItem(name, schedule, scope, trainer, counts, index, warning = false) {
  return `
    <article class="task-item task-item--group" data-geometry="task-item-${index}">
      <div class="task-item__top">
        <div>
          <div class="task-item__identity task-item__identity--wrap">${name}</div>
          <div class="task-item__meta">${schedule}</div>
        </div>
        ${badge(warning ? 'Без тренера' : 'Активна', warning ? 'warning' : 'success')}
      </div>
      <div class="task-item__secondary">${scope}</div>
      <div class="task-item__bottom">
        <div><div class="task-item__secondary">${trainer}</div><div class="badge-row" style="margin-top:6px">${badge(counts, 'neutral')}</div></div>
        ${button('', { iconName: 'edit', kind: 'soft' })}
      </div>
    </article>`
}

function formPage({ title, active, fields, submit, backLabel = 'Назад', role = 'Суперадминистратор', extra = '' }) {
  const sticky = `<div class="sticky-action" data-geometry="sticky-action">${button(submit, { kind: 'primary', iconName: 'save', block: true })}</div>`
  return shell(
    `${pageHeader(title, button('', { iconName: 'back' }))}
    ${section(`<div class="form-grid">${fields.join('')}${extra}</div>`)}`,
    { active, role, sticky },
  )
}

function settingsTabs(active) {
  const tabs = [
    ['catalog', 'card', 'Абонементы'],
    ['types', 'list', 'Типы групп'],
    ['branches', 'building', 'Филиалы и залы'],
    ['admins', 'user', 'Администраторы'],
  ]
  return `<div class="settings-tabs">${tabs.map(([id, iconName, label]) => `<button class="tab${active === id ? ' tab--active' : ''}" type="button">${icon(iconName, 17)}<span>${label}</span></button>`).join('')}</div>`
}

function baseClientsContext(body) {
  return shell(
    `<h1 class="sr-only">Клиенты</h1>
    ${locator({ placeholder: 'Имя или телефон', label: 'Найти клиента' })}
    ${body}`,
    { active: 'clients' },
  )
}

function modalOverlay(title, body, footer, { large = false } = {}) {
  if (large) {
    return `<div class="overlay"><section class="sheet sheet--large"><header class="sheet__header"><div class="sheet__title">${title}</div>${button('', { iconName: 'close' })}</header><div class="sheet__body">${body}</div><footer class="sheet__footer">${footer}</footer></section></div>`
  }
  return `<div class="overlay"><section class="modal-card"><header class="modal-card__header"><div class="modal-card__title">${title}</div>${button('', { iconName: 'close' })}</header><div class="modal-card__body">${body}</div><footer class="modal-card__footer">${footer}</footer></section></div>`
}

function scheduleCards() {
  return `
    <div class="task-list">
      <article class="schedule-item" style="--event-color:var(--crm-accent-1)" data-geometry="task-item-0">
        <div><div class="schedule-item__time">09:00</div><div class="schedule-item__duration">60 мин</div></div>
        <div><div class="schedule-item__title">Функциональная тренировка</div><div class="schedule-item__meta">Анна Лебедева · Северный / Зал 2</div><div style="margin-top:7px">${badge('Взрослые', 'warning')}</div></div>
      </article>
      <article class="schedule-item" style="--event-color:var(--crm-accent-2)" data-geometry="task-item-1">
        <div><div class="schedule-item__time">12:30</div><div class="schedule-item__duration">45 мин</div></div>
        <div><div class="schedule-item__title">Детская группа «Ракета»</div><div class="schedule-item__meta">Илья Миронов · Центр / Синий зал</div><div style="margin-top:7px">${badge('Дети 8–11', 'info')}</div></div>
      </article>
      <article class="schedule-item" style="--event-color:var(--crm-accent-3)" data-geometry="task-item-2">
        <div><div class="schedule-item__time">19:00</div><div class="schedule-item__duration">90 мин</div></div>
        <div><div class="schedule-item__title">Группа 7: вечер</div><div class="schedule-item__meta">Максим Орлов · Северный / Основной</div><div style="margin-top:7px">${badge('Профессионалы', 'neutral')}</div></div>
      </article>
    </div>`
}

function dayStrip() {
  const days = [['Пн', 27], ['Вт', 28], ['Ср', 29], ['Чт', 30], ['Пт', 31], ['Сб', 1], ['Вс', 2]]
  return `<div class="day-strip">${days.map(([name, day], index) => `<button class="day-cell${index === 2 ? ' day-cell--active' : ''}" type="button"><span><span class="day-cell__name">${name}</span><span class="day-cell__number" style="display:block">${day}</span></span></button>`).join('')}</div>`
}

const scenes = {
  'auth-login': () => `
    <main class="auth-screen">
      <div class="auth-brand">
        <div class="app-brand__mark">K4</div>
        <div class="app-brand__title">K-4PRO</div>
      </div>
      <section class="auth-card" data-geometry="auth-card">
        <h1>С возвращением</h1>
        <div class="form-grid">
          ${field('Логин', 'maria.sokolova')}
          ${field('Пароль', '••••••••••')}
          ${button('Войти', { kind: 'primary', iconName: 'chevron', block: true })}
        </div>
      </section>
    </main>`,

  'auth-password-change': () => `
    <main class="auth-screen">
      <div class="auth-brand">
        <div class="app-brand__mark">K4</div>
        <div class="app-brand__title">K-4PRO</div>
      </div>
      <section class="auth-card">
        <h1>Смените пароль</h1>
        <div class="form-grid">
          ${field('Текущий пароль', '••••••••')}
          ${field('Новый пароль', '••••••••••••', { description: 'Минимум 10 символов' })}
          ${field('Повторите новый пароль', '••••••••••••')}
          ${button('Сменить пароль и продолжить', { kind: 'primary', iconName: 'lock', block: true })}
        </div>
      </section>
    </main>`,

  'system-config-loading': () => `
    <main class="bootstrap-screen">
      <section class="bootstrap-card">
        <div class="app-brand__mark">K4</div>
        <div class="spinner"></div>
        <h1 class="bootstrap-card__title">Готовим рабочее пространство</h1>
        <div class="bootstrap-card__copy">Загружаем конфигурацию клуба и доступные разделы.</div>
        <div class="skeleton skeleton--line"></div>
        <div class="skeleton skeleton--line skeleton--line-short"></div>
      </section>
    </main>`,

  'system-restricted-route': () => shell(
    `${hiddenRouteTitle('Главная')}
    ${statePanel('Раздел недоступен', 'Ваша роль не разрешает изменять филиалы и системные настройки.', { tone: 'restricted', iconName: 'shield', action: button('Вернуться на главную', { kind: 'primary', iconName: 'home' }) })}`,
    { active: 'home', role: 'Тренер' },
  ),

  'system-error-state': () => baseClientsContext(`
    ${activeFilters(['Без абонемента'])}
    ${rangeStatus('Контекст сохранён · страница 2')}
    ${statePanel('Список клиентов не загрузился', 'Проверьте соединение и повторите запрос. Поиск, фильтры и текущая страница сохранены.', { tone: 'error', iconName: 'warning', action: button('Повторить', { kind: 'primary', iconName: 'refresh' }) })}`),

  'system-empty-first-run': () => baseClientsContext(
    `${rangeStatus('0 клиентов')}${statePanel('Клиентов пока нет', 'Создайте первую карточку клиента.', { iconName: 'clients', action: button('Новый клиент', { kind: 'primary', iconName: 'plus' }) })}`,
  ),

  'system-empty-filtered': () => shell(
    `<h1 class="sr-only">Клиенты</h1>
    ${locator({ value: 'Алексей', count: 2, label: 'Найти клиента' })}
    ${activeFilters(['Без абонемента', 'Группа 7'])}
    ${rangeStatus('0 совпадений')}
    ${statePanel('Клиенты не найдены', 'Поиск «Алексей» сохранён. Сбросьте только расширенные фильтры или очистите запрос отдельно.', { iconName: 'search', action: button('Сбросить фильтры', { kind: 'primary', iconName: 'filter' }) })}`,
    { active: 'clients' },
  ),

  'system-notification-success': () => shell(
    `${pageHeader('Карточка клиента')}
    ${section(`${sectionTitle('Абонемент')}${badge('Оплачен до 26.08.2026', 'success')}<div class="fact-list" style="margin-top:14px"><div class="fact-row"><span class="fact-row__label">Тип</span><span class="fact-row__value">На 3 месяца</span></div><div class="fact-row"><span class="fact-row__label">Группа</span><span class="fact-row__value">Группа 7: вечер</span></div></div>`)}
    ${section(`${sectionTitle('Последняя операция')}<div class="task-item"><div class="task-item__identity">Продление абонемента</div><div class="task-item__meta">Сегодня, 09:42 · Мария Соколова</div></div>`)}`,
    { active: 'clients' },
  ) + `<aside class="notification"><span class="notification__icon">${icon('check', 21)}</span><div><div class="notification__title">Абонемент продлён</div><div class="notification__copy">Александра Константинопольская · до 26.08.2026</div></div>${button('', { iconName: 'close' })}</aside>`,

  'navigation-overflow': () => shell(
    `${hiddenRouteTitle('Финансы')}
    ${locator({ value: 'Июль 2026', count: 1, label: 'Период отчёта', visibleLabel: true, kind: 'period' })}
    <div class="metrics">${metric('Выручка', '486 200 ₽')}${metric('Продано', '64')}</div>`,
    { active: 'finance', role: 'Администратор' },
  ) + `<div class="overflow-only-mobile">${modalOverlay(
    'Остальные разделы',
    overflowRows('finance'),
    button('Закрыть', { kind: 'primary', block: true }),
    { large: true },
  )}</div>`,

  'home-attendance-ready': () => shell(
    `<h1 class="sr-only">Главная</h1>
    <div class="tabs" data-geometry="page-header"><button class="tab tab--active" type="button">${icon('check', 18)}Посещения</button><button class="tab" type="button">${icon('warning', 18)}Требуют внимания ${badge('4', 'danger')}</button></div>
    ${section(`
      ${sectionTitle('Отметка посещений', 'Среда, 29 июля')}
      <div class="form-grid">
        ${field('Группа', 'Группа 7: вечер', { kind: 'select' })}
        <div class="segmented"><span class="segmented__item">28 июл.</span><span class="segmented__item segmented__item--active">Сегодня</span><span class="segmented__item">30 июл.</span></div>
        <div class="progress"><div class="progress__track"><div class="progress__value" style="--progress:42%"></div></div><span class="progress__label">5 из 12</span></div>
      </div>
    `, { compact: true })}
    <div class="task-list">
      <article class="attendance-row" data-geometry="task-item-0"><div class="attendance-row__top">${avatar('Мария Петрова', 'МП')}<div><div class="task-item__identity">Мария Петрова</div><div class="task-item__meta">Абонемент активен · до 14.09</div></div></div><div class="attendance-state"><span class="attendance-state__option attendance-state__option--active">Была</span><span class="attendance-state__option">Не была</span><span class="attendance-state__option">Позже</span></div></article>
      <article class="attendance-row" data-geometry="task-item-1"><div class="attendance-row__top">${avatar('Алексей Смирнов', 'АС')}<div><div class="task-item__identity">Алексей Смирнов</div><div class="task-item__meta">${badge('Проверить оплату', 'warning')}</div></div></div><div class="attendance-state"><span class="attendance-state__option">Был</span><span class="attendance-state__option">Не был</span><span class="attendance-state__option">Позже</span></div></article>
    </div>`,
    { active: 'home', role: 'Главный тренер' },
  ),

  'home-attendance-all-marked': () => shell(
    `<h1 class="sr-only">Главная</h1>
    <div class="tabs"><button class="tab tab--active" type="button">${icon('check', 18)}Посещения</button><button class="tab" type="button">${icon('warning', 18)}Требуют внимания</button></div>
    ${section(`${sectionTitle('Группа 7: вечер', 'Среда, 29 июля · 12 клиентов')}<div class="progress"><div class="progress__track"><div class="progress__value" style="--progress:100%"></div></div><span class="progress__label">12 из 12</span></div>`)}
    ${statePanel('Все клиенты отмечены', 'Можно проверить сохранённые отметки или изменить их в полном списке.', { iconName: 'check', action: button('Показать всех', { kind: 'primary', iconName: 'clients' }) })}`,
    { active: 'home', role: 'Главный тренер' },
  ),

  'home-attention-ready': () => shell(
    `<h1 class="sr-only">Главная</h1>
    <div class="tabs"><button class="tab" type="button">${icon('check', 18)}Посещения</button><button class="tab tab--active" type="button">${icon('warning', 18)}Требуют внимания ${badge('4', 'danger')}</button></div>
    ${section(`${sectionTitle('Клиенты, требующие внимания')}${rangeStatus('4 клиента · по приоритету')}`, { compact: true })}
    <div class="task-list">
      ${clientItem('Александра Константинопольская', 'АК', 'Группа 7 · 2 пропуска', 'Истекает через 2 дня', 'Открыть карточку', 0)}
      ${clientItem('Иван Иванов', 'ИИ', 'Без группы · нет визитов', 'Нет оплаты', 'Связаться', 1)}
      ${clientItem('Екатерина Воронцова', 'ЕВ', 'Пробная группа · 3 пропуска', 'Нужна проверка', 'Отметить контакт', 2)}
    </div>`,
    { active: 'home', role: 'Администратор' },
  ),

  'schedule-ready': () => shell(
    `<h1 class="sr-only">Расписание</h1>
    ${locator({ placeholder: 'Группа или тренер', count: 1, label: 'Найти занятие', actions: button('', { iconName: 'refresh' }) })}
    ${activeFilters(['Северный'])}
    ${dayStrip()}
    ${scheduleCards()}`,
    { active: 'schedule', role: 'Главный тренер' },
  ),

  'schedule-filter-surface': () => shell(
    `<h1 class="sr-only">Расписание</h1>${dayStrip()}${scheduleCards()}`,
    { active: 'schedule', role: 'Главный тренер' },
  ) + modalOverlay(
    'Фильтры расписания',
    `<div class="form-grid">${field('Филиал', 'Северный', { kind: 'select' })}${field('Зал', 'Все залы', { kind: 'select' })}${field('Тренер', 'Все тренеры', { kind: 'select' })}${field('Группа', 'Все группы', { kind: 'select' })}<div class="alert alert--info">${icon('filter', 21)}<div><div class="alert__title">Фильтры применяются сразу</div><div class="alert__copy">«Готово» только закрывает панель.</div></div></div></div>`,
    `${button('Сбросить', { block: true })}${button('Готово', { kind: 'primary', block: true })}`,
    { large: true },
  ),

  'clients-browse': () => shell(
    `<h1 class="sr-only">Клиенты</h1>
    ${locator({
      placeholder: 'Имя или телефон',
      count: 2,
      label: 'Найти клиента',
      actions: `${button('', { iconName: 'refresh' })}${button('Новый клиент', { kind: 'accent', iconName: 'plus', extra: 'button--responsive-label' })}`,
    })}
    ${activeFilters(['Без абонемента', 'Активные'])}
    ${rangeStatus('Показаны 1–5 из 48')}
    <div class="task-list">
      ${clientItem('Александра Константинопольская', 'АК', '+7 900 000-00-00', 'Истекает через 2 дня', 'Продлить', 0)}
      ${clientItem('Иван Иванов', 'ИИ', '+7 900 100-20-30', 'Нет оплаты', 'Оформить', 1)}
      ${clientItem('Мария Петрова', 'МП', '+7 911 245-42-10', 'Активный', 'Открыть', 2)}
      ${clientItem('Алексей Смирнов', 'АС', '+7 988 314-12-07', 'Активный', 'Открыть', 3)}
    </div>`,
    { active: 'clients' },
  ),

  'clients-search-focused': () => shell(
    `<div class="page-stack" style="gap:12px">
      <h1 class="sr-only">Клиенты</h1>
      ${locator({ value: 'А', count: 2, label: 'Найти клиента' })}
      ${activeFilters(['Активные', 'Без группы'])}
      ${rangeStatus('Показаны 1–6 · есть ещё')}
      <div class="task-list">
        ${compactClientItem('Александра Константинопольская', 'АК', '+7 900 000-00-00', 'Истекает', 'Продлить', 0)}
        ${compactClientItem('Алексей Смирнов', 'АС', '+7 988 314-12-07', 'Активный', 'Открыть', 1)}
        ${compactClientItem('Алина Савельева', 'АС', '+7 912 700-14-44', 'Нет группы', 'Назначить', 2)}
        ${compactClientItem('Артём Козлов', 'АК', '+7 911 630-10-08', 'Активный', 'Открыть', 3)}
        ${compactClientItem('Анастасия Гордеева', 'АГ', '+7 952 911-22-01', 'Активный', 'Открыть', 4)}
        ${compactClientItem('Антон Рябов', 'АР', '+7 921 080-55-09', 'Нет оплаты', 'Оформить', 5)}
      </div>
    </div>`,
    { active: 'clients' },
  ),

  'clients-preview': () => shell(
    `${pageHeader('Краткая карточка', button('', { iconName: 'back' }))}
    ${section(`
      <div class="client-summary">${avatar('Александра Константинопольская', 'АК')}<div><div class="task-item__identity task-item__identity--wrap">Александра Константинопольская</div><div class="task-item__meta">+7 900 000-00-00</div><div style="margin-top:7px">${badge('Активный клиент', 'success')}</div></div></div>
      <div class="alert" style="margin-top:16px">${icon('warning', 22)}<div><div class="alert__title">Нужно сейчас</div><div class="alert__copy">Абонемент истекает через 2 дня.</div></div></div>
      <div class="fact-list" style="margin-top:16px">
        <div class="fact-row"><span class="fact-row__label">Группа</span><span class="fact-row__value">Группа 7: вечер</span></div>
        <div class="fact-row"><span class="fact-row__label">Последний визит</span><span class="fact-row__value">27.07.2026</span></div>
        <div class="fact-row"><span class="fact-row__label">Посещений</span><span class="fact-row__value">14</span></div>
        <div class="fact-row"><span class="fact-row__label">Оплата</span><span class="fact-row__value">Внесена</span></div>
      </div>
    `)}
    ${section(`${sectionTitle('Последние события')}<div class="task-item"><div class="task-item__identity">Посещение отмечено</div><div class="task-item__meta">27 июля · Мария Соколова</div></div><div class="task-item" style="margin-top:8px"><div class="task-item__identity">Абонемент продлён</div><div class="task-item__meta">12 июля · до 31 июля</div></div>`)}`,
    {
      active: 'clients',
      sticky: `<div class="sticky-action">${button('Открыть карточку', { kind: 'primary', iconName: 'chevron', block: true })}</div>`,
    },
  ),

  'client-details': () => shell(
    `${pageHeader('Карточка клиента', `${button('', { iconName: 'back' })}${button('', { iconName: 'edit' })}`)}
    ${section(`<div class="client-summary">${avatar('Александра Константинопольская', 'АК')}<div><div class="task-item__identity task-item__identity--wrap">Александра Константинопольская</div><div class="task-item__meta">+7 900 000-00-00</div><div class="badge-row" style="margin-top:7px">${badge('Активный', 'success')}${badge('Группа 7', 'brand')}</div></div></div>`)}
    ${section(`${sectionTitle('Абонемент', 'Оплачен · истекает 31.07.2026')}${badge('Осталось 2 дня', 'warning')}<div class="fact-list" style="margin-top:14px"><div class="fact-row"><span class="fact-row__label">Тип</span><span class="fact-row__value">На 1 месяц</span></div><div class="fact-row"><span class="fact-row__label">Посещений</span><span class="fact-row__value">14</span></div></div>`)}
    ${section(`${sectionTitle('Контакты и заметки')}<div class="fact-list"><div class="fact-row"><span class="fact-row__label">Telegram</span><span class="fact-row__value">Подключён</span></div><div class="fact-row"><span class="fact-row__label">Последний контакт</span><span class="fact-row__value">28.07.2026</span></div></div>`)}`,
    {
      active: 'clients',
      sticky: `<div class="sticky-action">${button('Продлить абонемент', { kind: 'primary', iconName: 'card', block: true })}</div>`,
    },
  ),

  'client-create': () => formPage({
    title: 'Новый клиент',
    active: 'clients',
    submit: 'Сохранить клиента',
    fields: [
      field('ФИО', 'Александра Константинопольская'),
      field('Телефон', '+7 900 000-00-00'),
      field('Дата рождения', '14.09.1994', { kind: 'date' }),
      field('Филиал', 'Северный', { kind: 'select' }),
      field('Группа', 'Не назначена', { kind: 'select' }),
    ],
  }),

  'client-edit': () => formPage({
    title: 'Александра Константинопольская',
    active: 'clients',
    submit: 'Сохранить изменения',
    fields: [
      field('ФИО', 'Александра Константинопольская'),
      field('Телефон', '+7 900 000-00-00'),
      field('Статус', 'Активный', { kind: 'select' }),
      field('Группа', 'Группа 7: вечер', { kind: 'select' }),
      field('Комментарий', 'Предпочитает занятия после 18:00', { kind: 'textarea' }),
    ],
  }),

  'client-transfer-modal': () => shell(
    `${pageHeader('Карточка клиента')}${section(`${sectionTitle('Текущая группа')}<div class="task-item"><div class="task-item__identity">Группа 7: вечер</div><div class="task-item__meta">Северный · Основной зал</div></div>`)}`,
    { active: 'clients' },
  ) + modalOverlay(
    'Перевод клиента',
    `<div class="form-grid"><div class="fact-row"><span class="fact-row__label">Клиент</span><span class="fact-row__value">Александра Константинопольская</span></div>${field('Новый филиал', 'Центр', { kind: 'select' })}${field('Новая группа', 'Функциональная 19:30', { kind: 'select' })}<div class="alert">${icon('warning', 21)}<div><div class="alert__title">Проверьте абонемент</div><div class="alert__copy">Цена новой группы выше на 600 ₽. Перед переводом потребуется подтвердить продажу.</div></div></div></div>`,
    `${button('Отмена')}${button('Продолжить', { kind: 'primary' })}`,
  ),

  'client-telegram-link-modal': () => shell(
    `${pageHeader('Карточка клиента')}${section(`${sectionTitle('Мессенджер')}<div class="task-item"><div class="task-item__identity">Telegram не подключён</div><div class="task-item__meta">Создайте персональную ссылку для клиента.</div></div>`)}`,
    { active: 'clients' },
  ) + modalOverlay(
    'Подключение Telegram',
    `<div class="form-grid"><div class="fact-row"><span class="fact-row__label">Клиент</span><span class="fact-row__value">Александра Константинопольская</span></div><div class="state-panel" style="min-height:160px;padding:18px"><div class="state-panel__icon">${icon('message', 28)}</div><h2 style="font-size:18px">Ссылка готова</h2><p>Отправьте её клиенту. После входа статус обновится автоматически.</p></div><div class="code-box">https://t.me/k4pro_bot?start=client_8fa2</div></div>`,
    `${button('Закрыть')}${button('Скопировать', { kind: 'primary', iconName: 'message' })}`,
  ),

  'groups-list': () => shell(
    `<h1 class="sr-only">Группы</h1>
    ${locator({
      placeholder: 'Название группы',
      count: 1,
      label: 'Найти группу',
      actions: `${button('', { iconName: 'refresh' })}${button('Создать группу', { kind: 'accent', iconName: 'plus', extra: 'button--responsive-label' })}`,
    })}
    ${rangeStatus('Показаны 1–3 из 12')}
    <div class="task-list">
      ${groupItem('Группа 7: вечер', 'Вт, Чт · старт 19:00 · 90 мин', 'Северный · Основной зал', 'Максим Орлов, Анна Лебедева', '14 клиентов · 2 тренера', 0)}
      ${groupItem('Детская группа «Ракета»', 'Пн, Ср, Пт · старт 17:30 · 60 мин', 'Центр · Синий зал', 'Илья Миронов', '11 клиентов · 1 тренер', 1)}
      ${groupItem('Функциональная 19:30', 'Сб · старт 12:00 · 60 мин', 'Центр · Большой зал', 'Тренер не назначен', '3 клиента · 0 тренеров', 2, true)}
    </div>`,
    { active: 'groups' },
  ),

  'group-create': () => formPage({
    title: 'Новая группа',
    active: 'groups',
    submit: 'Создать группу',
    fields: [
      field('Название', 'Функциональная 19:30'),
      field('Филиал', 'Центр', { kind: 'select' }),
      field('Зал', 'Большой зал', { kind: 'select' }),
      field('Тип группы', 'Взрослая группа', { kind: 'select' }),
      field('Время начала', '19:30', { kind: 'date' }),
    ],
    extra: switchRow('Группа активна', 'Доступна в расписании и формах', true),
  }),

  'group-edit': () => formPage({
    title: 'Группа 7: вечер',
    active: 'groups',
    submit: 'Сохранить группу',
    fields: [
      field('Название', 'Группа 7: вечер'),
      field('Филиал', 'Северный', { kind: 'select' }),
      field('Зал', 'Основной зал', { kind: 'select' }),
      field('Дни недели', 'Вторник, четверг', { kind: 'select' }),
      field('Тренеры', 'Максим Орлов, Анна Лебедева', { kind: 'select' }),
    ],
    extra: `${switchRow('Группа активна', 'В расписании вторник и четверг', true)}<div class="alert alert--info">${icon('clock', 21)}<div><div class="alert__title">Временное замещение</div><div class="alert__copy">31 июля занятие проведёт Илья Миронов.</div></div></div>`,
  }),

  'users-list': () => shell(
    `${hiddenRouteTitle('Тренеры')}
    <div class="metrics">${metric('Активные', '7')}${metric('Смена пароля', '1')}</div>
    ${locator({ placeholder: 'ФИО или логин', count: 1, label: 'Найти тренера', actions: `${button('', { iconName: 'refresh' })}${button('Создать тренера', { kind: 'accent', iconName: 'plus', extra: 'button--responsive-label' })}` })}
    ${rangeStatus('Показаны 1–4 из 8')}
    <div class="task-list">
      <article class="task-item" data-geometry="task-item-0"><div class="task-item__top"><div><div class="task-item__identity">Максим Орлов</div><div class="task-item__meta">maxim.orlov · Telegram подключён</div></div>${button('', { iconName: 'edit', kind: 'soft' })}</div><div class="badge-row">${badge('Главный тренер', 'brand')}${badge('Активен', 'success')}</div></article>
      <article class="task-item" data-geometry="task-item-1"><div class="task-item__top"><div><div class="task-item__identity">Анна Лебедева</div><div class="task-item__meta">anna.coach · Telegram подключён</div></div>${button('', { iconName: 'edit', kind: 'soft' })}</div><div class="badge-row">${badge('Тренер', 'brand')}${badge('Активна', 'success')}</div></article>
      <article class="task-item" data-geometry="task-item-2"><div class="task-item__top"><div><div class="task-item__identity">Илья Миронов</div><div class="task-item__meta">ilya.mironov · Telegram не подключён</div></div>${button('', { iconName: 'edit', kind: 'soft' })}</div><div class="badge-row">${badge('Тренер', 'brand')}${badge('Сменить пароль', 'warning')}</div></article>
    </div>`,
    { active: 'users', role: 'Главный тренер' },
  ),

  'user-create': () => formPage({
    title: 'Новый тренер',
    active: 'users',
    submit: 'Сохранить тренера',
    fields: [
      field('ФИО', 'Иван Петров'),
      field('Роль', 'Тренер', { kind: 'select' }),
      field('Логин', 'coach.petrov'),
      field('Стартовый пароль', '••••••••••'),
      field('Telegram ID', '123456789'),
    ],
    extra: switchRow('Сменить пароль при входе', '', true),
  }),

  'user-edit': () => formPage({
    title: 'Анна Лебедева',
    active: 'users',
    submit: 'Сохранить изменения',
    fields: [
      field('ФИО', 'Анна Лебедева'),
      field('Логин', 'anna.coach', { description: 'Логин фиксируется после создания.' }),
      field('Роль', 'Тренер', { kind: 'select' }),
      field('Telegram ID', '985443210'),
      switchRow('Тренер активен', 'Может войти в CRM и бот', true),
    ],
  }),

  'audit-list': () => shell(
    `${hiddenRouteTitle('Журнал')}
    ${locator({ placeholder: 'Пользователь или действие', count: 2, label: 'Найти запись журнала', actions: button('', { iconName: 'refresh' }) })}
    ${activeFilters(['Клиенты', 'За 7 дней'])}
    ${rangeStatus('Показаны 1–5 из 128')}
    <div class="task-list">
      <article class="audit-event" data-geometry="task-item-0"><div class="badge-row">${badge('Клиент изменён', 'brand')}${badge('Web', 'neutral')}</div><div class="audit-event__title">Обновлены данные Александры Константинопольской</div><div class="audit-event__footer"><span class="audit-event__meta">29.07 · 09:42 · Мария Соколова</span>${icon('chevron', 18)}</div></article>
      <article class="audit-event" data-geometry="task-item-1"><div class="badge-row">${badge('Абонемент', 'warning')}${badge('Web', 'neutral')}</div><div class="audit-event__title">Оформлено продление абонемента</div><div class="audit-event__footer"><span class="audit-event__meta">29.07 · 09:40 · Мария Соколова</span>${icon('chevron', 18)}</div></article>
      <article class="audit-event" data-geometry="task-item-2"><div class="badge-row">${badge('Посещение', 'success')}${badge('Бот', 'info')}</div><div class="audit-event__title">Сохранены отметки группы 7</div><div class="audit-event__footer"><span class="audit-event__meta">29.07 · 09:18 · Максим Орлов</span>${icon('chevron', 18)}</div></article>
    </div>`,
    { active: 'audit', role: 'Главный тренер' },
  ),

  'audit-details-modal': () => shell(
    `${hiddenRouteTitle('Журнал')}${locator({ placeholder: 'Пользователь или действие', count: 2, label: 'Найти запись журнала' })}<div class="task-list"><article class="audit-event"><div class="badge-row">${badge('Клиент изменён', 'brand')}</div><div class="audit-event__title">Обновлены данные Александры Константинопольской</div><div class="audit-event__meta">29.07 · 09:42 · Мария Соколова</div></article></div>`,
    { active: 'audit', role: 'Главный тренер' },
  ) + modalOverlay(
    'Подробности записи',
    `<div class="fact-list"><div class="fact-row"><span class="fact-row__label">Действие</span><span class="fact-row__value">Клиент изменён</span></div><div class="fact-row"><span class="fact-row__label">Пользователь</span><span class="fact-row__value">Мария Соколова</span></div><div class="fact-row"><span class="fact-row__label">Дата</span><span class="fact-row__value">29.07.2026 09:42</span></div></div><div class="diff-grid" style="margin-top:16px"><div class="diff-card"><div class="diff-card__label">Было</div><div class="diff-card__copy">Группа: не назначена<br>Абонемент до 31.07</div></div><div class="diff-card"><div class="diff-card__label">Стало</div><div class="diff-card__copy">Группа: Группа 7<br>Абонемент до 31.08</div></div></div>`,
    `${button('Закрыть', { kind: 'primary', block: true })}<span></span>`,
  ),

  'finance-report': () => shell(
    `${hiddenRouteTitle('Финансы')}
    ${locator({ value: 'Июль 2026', count: 1, label: 'Период отчёта', visibleLabel: true, kind: 'period', actions: button('', { iconName: 'refresh' }) })}
    ${activeFilters(['Все филиалы'])}
    <div class="metrics">${metric('Выручка', '486 200 ₽', 'продажи за период')}${metric('Чистая выручка', '462 800 ₽', 'после возвратов')}${metric('Продано', '64', 'абонемента')}${metric('Новые клиенты', '18')}</div>
    ${section(`${sectionTitle('По филиалам')}<div class="breakdown-row"><span class="breakdown-row__name">Северный</span><span class="breakdown-row__value">286 400 ₽</span></div><div class="breakdown-row"><span class="breakdown-row__name">Центр</span><span class="breakdown-row__value">176 400 ₽</span></div>`)}
    ${section(`${sectionTitle('По тренерам')}<div class="breakdown-row"><span class="breakdown-row__name">Максим Орлов</span><span class="breakdown-row__value">182 100 ₽</span></div>`)}`,
    { active: 'finance', role: 'Администратор' },
  ),

  'finance-zero-report': () => shell(
    `${hiddenRouteTitle('Финансы')}
    ${locator({ value: '1–7 января 2025', count: 2, label: 'Период отчёта', visibleLabel: true, kind: 'period', actions: button('', { iconName: 'refresh' }) })}
    ${activeFilters(['Центр', 'Илья Миронов'])}
    <div class="metrics">${metric('Выручка', '0 ₽')}${metric('Продано', '0')}</div>
    ${statePanel('За выбранный период операций нет', 'Измените период или снимите фильтры. Текущий отчёт и выбранный контекст сохранены.', { iconName: 'money', action: button('Сбросить фильтры', { kind: 'primary', iconName: 'filter' }) })}`,
    { active: 'finance', role: 'Администратор' },
  ),

  'settings-catalog': () => shell(
    `${hiddenRouteTitle('Настройки')}
    ${settingsTabs('catalog')}
    ${section(`${sectionTitle('Каталог абонементов', 'Северный', button('Добавить', { kind: 'accent', iconName: 'plus' }))}
      <div class="task-list">
        <article class="task-item" data-geometry="task-item-0"><div class="task-item__top"><div><div class="task-item__identity">Абонемент на месяц</div><div class="task-item__meta">30 дней · 12 посещений</div></div>${button('', { iconName: 'edit', kind: 'soft' })}</div><div class="task-item__bottom">${badge('4 800 ₽', 'brand')}${badge('Активен', 'success')}</div></article>
        <article class="task-item" data-geometry="task-item-1"><div class="task-item__top"><div><div class="task-item__identity">Разовое посещение</div><div class="task-item__meta">1 посещение · без срока</div></div>${button('', { iconName: 'edit', kind: 'soft' })}</div><div class="task-item__bottom">${badge('700 ₽', 'brand')}${badge('Активен', 'success')}</div></article>
        <article class="task-item" data-geometry="task-item-2"><div class="task-item__top"><div><div class="task-item__identity">Профессиональный</div><div class="task-item__meta">30 дней · без лимита</div></div>${button('', { iconName: 'edit', kind: 'soft' })}</div><div class="task-item__bottom">${badge('7 500 ₽', 'brand')}${badge('Активен', 'success')}</div></article>
      </div>`)}`,
    { active: 'settings' },
  ),

  'settings-group-types': () => shell(
    `${hiddenRouteTitle('Настройки')}
    ${settingsTabs('types')}
    ${section(`${sectionTitle('Типы групп', '', button('Добавить', { kind: 'accent', iconName: 'plus' }))}
      <div class="task-list">
        <article class="task-item" data-geometry="task-item-0"><div class="task-item__top"><div><div class="task-item__identity">Взрослая группа</div><div class="task-item__meta">Основные групповые тренировки</div></div>${button('', { iconName: 'edit', kind: 'soft' })}</div><div class="badge-row">${badge('6 групп', 'brand')}</div></article>
        <article class="task-item" data-geometry="task-item-1"><div class="task-item__top"><div><div class="task-item__identity">Детская группа</div><div class="task-item__meta">Возрастные группы 6–14 лет</div></div>${button('', { iconName: 'edit', kind: 'soft' })}</div><div class="badge-row">${badge('4 группы', 'brand')}</div></article>
        <article class="task-item" data-geometry="task-item-2"><div class="task-item__top"><div><div class="task-item__identity">Персональная</div><div class="task-item__meta">Индивидуальный формат</div></div>${button('', { iconName: 'edit', kind: 'soft' })}</div><div class="badge-row">${badge('2 группы', 'brand')}</div></article>
      </div>`)}`,
    { active: 'settings' },
  ),

  'settings-branches': () => shell(
    `${hiddenRouteTitle('Настройки')}
    ${settingsTabs('branches')}
    ${section(`${sectionTitle('Филиалы и залы', '2 активных филиала', button('Добавить', { kind: 'accent', iconName: 'plus' }))}
      <div class="task-list">
        <article class="task-item task-item--selected" data-geometry="task-item-0"><div class="task-item__top"><div><div class="task-item__identity">Северный</div><div class="task-item__meta">ул. Спортивная, 18</div></div>${badge('Активный', 'success')}</div><div class="task-item__bottom"><span class="task-item__secondary">3 зала · 7 групп · 84 клиента</span>${icon('chevron', 18)}</div></article>
        <article class="task-item" data-geometry="task-item-1"><div class="task-item__top"><div><div class="task-item__identity">Центр</div><div class="task-item__meta">пр. Мира, 42</div></div>${badge('Активный', 'success')}</div><div class="task-item__bottom"><span class="task-item__secondary">2 зала · 5 групп · 46 клиентов</span>${icon('chevron', 18)}</div></article>
      </div>
      <div class="section section--subtle" style="margin-top:12px"><div class="section__inner section__inner--compact">${sectionTitle('Залы филиала')}<div class="breakdown-row"><span class="breakdown-row__name">Основной зал</span>${badge('4 группы', 'brand')}</div><div class="breakdown-row"><span class="breakdown-row__name">Зал 2</span>${badge('3 группы', 'brand')}</div></div></div>`)}`,
    { active: 'settings' },
  ),

  'settings-admins': () => shell(
    `${hiddenRouteTitle('Настройки')}
    ${settingsTabs('admins')}
    ${section(`${sectionTitle('Администраторы', 'Доступ привязан к филиалу', button('Добавить', { kind: 'accent', iconName: 'plus' }))}
      <div class="task-list">
        <article class="task-item" data-geometry="task-item-0"><div class="task-item__top"><div><div class="task-item__identity">Мария Соколова</div><div class="task-item__meta">maria.sokolova · Северный</div></div>${button('', { iconName: 'edit', kind: 'soft' })}</div><div class="badge-row">${badge('Администратор', 'brand')}${badge('Активна', 'success')}</div></article>
        <article class="task-item" data-geometry="task-item-1"><div class="task-item__top"><div><div class="task-item__identity">Наталья Власова</div><div class="task-item__meta">natalia.admin · Центр</div></div>${button('', { iconName: 'edit', kind: 'soft' })}</div><div class="badge-row">${badge('Администратор', 'brand')}${badge('Активна', 'success')}</div></article>
      </div>`)}`,
    { active: 'settings' },
  ),

  'settings-modal-form': () => shell(
    `${hiddenRouteTitle('Настройки')}${settingsTabs('types')}${section(`${sectionTitle('Типы групп')}<div class="task-item"><div class="task-item__identity">Взрослая группа</div><div class="task-item__meta">6 групп</div></div>`)}`,
    { active: 'settings' },
  ) + modalOverlay(
    'Новый тип группы',
    `<div class="form-grid">${field('Название', 'Йога для начинающих')}${field('Описание', 'Мягкая групповая тренировка для взрослых', { kind: 'textarea' })}</div>`,
    `${button('Отмена')}${button('Сохранить', { kind: 'primary', iconName: 'save' })}`,
  ),

  'settings-delete-confirm': () => shell(
    `${hiddenRouteTitle('Настройки')}${settingsTabs('types')}${section(`${sectionTitle('Типы групп')}<div class="task-item"><div class="task-item__identity">Пробная группа</div><div class="task-item__meta">Не используется</div></div>`)}`,
    { active: 'settings' },
  ) + modalOverlay(
    'Удалить тип группы?',
    `<div class="state-panel state-panel--error" style="min-height:220px;border:0;box-shadow:none;padding:8px"><div class="state-panel__icon">${icon('trash', 28)}</div><h2>«Пробная группа»</h2><p>Тип будет удалён из справочника. Это действие нельзя отменить.</p></div>`,
    `${button('Отмена')}${button('Удалить', { kind: 'danger', iconName: 'trash' })}`,
  ),
}

const renderer = scenes[screen.id] ?? scenes['system-config-loading']
document.querySelector('#app').innerHTML = renderer()
document.body.dataset.ready = 'yes'
