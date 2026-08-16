import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
} from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import {
  findAllowlistMatch,
  type TouchTargetInventoryAllowlistMatch,
} from './touch-target-inventory.allowlist'

type ViewportCase = {
  height: number
  isCompactHeight: boolean
  label: string
  pointerMode: 'coarse' | 'fine'
  width: number
}

type TouchCandidate = {
  gapKind?: 'independent' | 'composite'
  hiddenAtWidths?: number[]
  label: string
  locator: (page: Page) => Locator
  role?: 'button' | 'textbox'
  touchOnly?: boolean
}

type RouteCase = {
  controls: TouchCandidate[]
  path: string
  screenTestId: string
  state?: 'default' | 'preview-open' | 'search-focused'
}

type RouteWithState = RouteCase & {
  state: 'default' | 'preview-open' | 'search-focused'
}

const MOBILE_BOTTOM_NAVIGATION_SELECTOR =
  'nav.mobile-bottom-nav[aria-label="Мобильная навигация"]'
const SIDE_NAVIGATION_SELECTOR = 'nav.app-shell__side-nav[aria-label="Основная навигация"]'

const VIEWPORT_MATRIX: ViewportCase[] = [
  { label: '360x780', width: 360, height: 780, isCompactHeight: false, pointerMode: 'coarse' },
  { label: '390x844', width: 390, height: 844, isCompactHeight: false, pointerMode: 'coarse' },
  { label: '420x912', width: 420, height: 912, isCompactHeight: false, pointerMode: 'coarse' },
  { label: '440x956', width: 440, height: 956, isCompactHeight: false, pointerMode: 'coarse' },
  { label: '768x1024', width: 768, height: 1024, isCompactHeight: false, pointerMode: 'coarse' },
  { label: '1440x1200', width: 1440, height: 1200, isCompactHeight: false, pointerMode: 'fine' },
  { label: '912x420', width: 912, height: 420, isCompactHeight: true, pointerMode: 'coarse' },
  { label: '956x440', width: 956, height: 440, isCompactHeight: true, pointerMode: 'coarse' },
] as const

const APP_CONFIG = {
  authBackgroundImageId: 'k4pro-login-v1',
  clubName: 'Gym CRM',
  themeId: 'default-green-v1',
} as const

const SUPER_ADMIN_SESSION = {
  bootstrapMode: false,
  csrfToken: 'touch-targets-superadmin-csrf',
  isAuthenticated: true,
  user: {
    assignedGroupIds: ['group-1'],
    branchId: null,
    canManageClients: true,
    canManageGroups: true,
    canManageSettings: true,
    canMarkAttendance: true,
    canViewAuditLog: true,
    canViewFinancialReports: true,
    fullName: 'Суперадминистратор',
    id: 'super-admin',
    isActive: true,
    landingScreen: 'Home',
    login: 'superadmin',
    mustChangePassword: false,
    permissions: {
      canManageClients: true,
      canManageGroups: true,
      canManageSettings: true,
      canMarkAttendance: true,
      canViewAuditLog: true,
      canManageUsers: true,
      canViewFinancialReports: true,
    },
    role: 'SuperAdministrator',
    allowedSections: ['Home', 'Schedule', 'Clients', 'Groups', 'Users', 'Audit', 'Settings'],
  },
} as const

const ADMIN_SESSION = {
  ...SUPER_ADMIN_SESSION,
  user: {
    ...SUPER_ADMIN_SESSION.user,
    fullName: 'Администратор',
    login: 'admin',
    role: 'Administrator',
    id: 'admin',
    allowedSections: ['Home', 'Schedule', 'Clients', 'Groups', 'Users', 'Audit', 'Finance', 'Settings'],
    permissions: {
      ...SUPER_ADMIN_SESSION.user.permissions,
    },
  },
} as const

const HEAD_COACH_SESSION = {
  bootstrapMode: false,
  csrfToken: 'touch-targets-headcoach-csrf',
  isAuthenticated: true,
  user: {
    id: 'headcoach-id',
    fullName: 'Главный тренер',
    login: 'headcoach',
    role: 'HeadCoach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Home',
    allowedSections: ['Home', 'Schedule', 'Clients', 'Groups', 'Users', 'Audit', 'Settings'],
    permissions: {
      canManageUsers: true,
      canManageClients: true,
      canManageGroups: true,
      canManageSettings: true,
      canMarkAttendance: true,
      canViewAuditLog: true,
      canViewFinancialReports: true,
    },
    assignedGroupIds: ['group-1'],
  },
} as const

const COACH_SESSION = {
  bootstrapMode: false,
  csrfToken: 'touch-targets-coach-csrf',
  isAuthenticated: true,
  user: {
    id: 'coach-id',
    fullName: 'Тренер',
    login: 'coach',
    role: 'Coach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Home',
    allowedSections: ['Home', 'Schedule', 'Clients'],
    permissions: {
      canManageUsers: false,
      canManageClients: false,
      canManageGroups: false,
      canManageSettings: false,
      canMarkAttendance: true,
      canViewAuditLog: false,
      canViewFinancialReports: false,
    },
    assignedGroupIds: ['group-1'],
  },
} as const

const ROUTE_CASES: RouteWithState[] = [
  {
    path: '/',
    screenTestId: 'home-screen',
    state: 'default',
    controls: [
      {
        label: 'Главная',
        locator: (page) => page.getByRole('button', { name: 'Главная' }).first(),
        touchOnly: true,
      },
    ],
  },
  {
    path: '/schedule',
    screenTestId: 'schedule-screen',
    state: 'default',
    controls: [
      { label: 'Обновить', locator: (page) => page.getByRole('button', { name: 'Обновить' }).first() },
    ],
  },
  {
    path: '/clients',
    screenTestId: 'clients-screen',
    state: 'default',
    controls: [
      {
        gapKind: 'composite',
        label: 'Поиск по имени или телефону',
        locator: (page) => page.getByRole('textbox', { name: 'Поиск по имени или телефону' }),
        role: 'textbox',
      },
      {
        label: 'Фильтры',
        locator: (page) => page.getByRole('button', { name: /фильтры/i }).first(),
      },
      {
        label: 'Обновить список',
        locator: (page) => page.getByRole('button', { name: 'Обновить список' }).first(),
      },
      {
        label: 'Новый клиент',
        locator: (page) => page.getByRole('button', { name: 'Новый клиент' }).first(),
      },
      {
        gapKind: 'composite',
        label: 'Назад',
        locator: (page) => page.getByRole('button', { name: 'Назад' }),
        touchOnly: true,
      },
      {
        gapKind: 'composite',
        label: 'Страница 1',
        locator: (page) => page.getByRole('button', { name: 'Страница 1' }),
        touchOnly: true,
      },
      {
        gapKind: 'composite',
        label: 'Дальше',
        locator: (page) => page.getByRole('button', { name: 'Дальше' }),
        touchOnly: true,
      },
    ],
  },
  {
    path: '/clients',
    screenTestId: 'clients-screen',
    state: 'search-focused',
    controls: [
      {
        gapKind: 'composite',
        label: 'Поиск по имени или телефону',
        locator: (page) => page.getByRole('textbox', { name: 'Поиск по имени или телефону' }),
        role: 'textbox',
      },
      {
        label: 'Фильтры',
        locator: (page) => page.getByRole('button', { name: /фильтры/i }).first(),
      },
      {
        gapKind: 'composite',
        label: 'Сбросить поисковый запрос',
        locator: (page) => page.getByRole('button', { name: 'Сбросить поисковый запрос' }),
      },
      {
        label: 'Обновить список',
        locator: (page) => page.getByRole('button', { name: 'Обновить список' }),
      },
      {
        label: 'Новый клиент',
        locator: (page) => page.getByRole('button', { name: 'Новый клиент' }),
      },
    ],
  },
  {
    path: '/clients',
    screenTestId: 'clients-screen',
    state: 'preview-open',
    controls: [
      {
        label: 'Открыть карточку',
        locator: (page) => page.getByRole('button', { name: 'Открыть карточку' }).first(),
      },
    ],
  },
  {
    path: '/groups',
    screenTestId: 'groups-screen',
    state: 'default',
    controls: [
      { label: 'Новая группа', locator: (page) => page.getByRole('button', { name: 'Новая группа' }).first() },
      {
        label: 'Обновить список групп',
        locator: (page) =>
          page.getByRole('button', { name: 'Обновить список групп' }).first(),
      },
      {
        label: 'Редактировать',
        locator: (page) => page.getByRole('button', { name: 'Редактировать' }).first(),
      },
    ],
  },
  {
    path: '/settings',
    screenTestId: 'settings-screen',
    state: 'default',
    controls: [
      {
        label: 'Добавить абонемент',
        locator: (page) => page.getByRole('button', { name: 'Добавить абонемент' }).first(),
      },
      {
        label: 'Обновить',
        locator: (page) => page.getByRole('button', { name: 'Обновить' }).first(),
      },
    ],
  },
  {
    path: '/audit',
    screenTestId: 'audit-screen',
    state: 'default',
    controls: [
      {
        label: 'Обновить',
        locator: (page) => page.getByRole('button', { name: 'Обновить' }).first(),
      },
      {
        label: 'Фильтры',
        locator: (page) => page.getByRole('button', { name: /фильтры/i }).first(),
      },
    ],
  },
]

const ROLE_MATRIX = [
  { label: 'SuperAdministrator', session: SUPER_ADMIN_SESSION },
  { label: 'Administrator', session: ADMIN_SESSION },
  { label: 'HeadCoach', session: HEAD_COACH_SESSION },
  { label: 'Coach', session: COACH_SESSION },
] as const

type AppConfigFixture = {
  authBackgroundImageId: string
  clubName: string
  themeId: string
}

type InventoryEntry = {
  exception: TouchTargetInventoryAllowlistMatch | null
  fontSizePx: number | null
  gap: {
    distancePx: number
    kind: 'independent' | 'composite'
    nearestLocator: string
  }
  locator: string
  measuredBox: {
    height: number
    width: number
    x: number
    y: number
  }
  pointerMode: 'coarse' | 'fine'
  role: string
  route: string
  state: string
  viewport: { height: number; width: number }
}

type MeasuredTarget = {
  entry: InventoryEntry
  id: string
  pageRect: {
    x: number
    y: number
    width: number
    height: number
  }
}

for (const viewport of VIEWPORT_MATRIX) {
  test.describe(`touch-target inventory ${viewport.label}`, () => {
    test.use({
      hasTouch: viewport.pointerMode === 'coarse',
      viewport: { width: viewport.width, height: viewport.height },
    })

    test('checks representative routes for touch targets and records machine-readable inventory', async ({ page }, testInfo) => {
      const relevantRoutes = ROUTE_CASES.filter(
        (route) =>
          route.state !== 'preview-open' || viewport.label === '1440x1200',
      )
      const selectedRole: (typeof ROLE_MATRIX)[number] = ROLE_MATRIX[0]

      await mockApi(page, selectedRole.session, APP_CONFIG)
      const inventory: InventoryEntry[] = []
      const violations: string[] = []
      await page.goto('/')
      await expect(page.getByTestId('home-screen')).toBeVisible()

      const profileLocator = page.getByRole('button', {
        name: `Открыть профильное меню пользователя ${selectedRole.session.user.fullName}`,
      })
      const profileLocatorCount = await profileLocator.count()

      if (profileLocatorCount === 0) {
        violations.push('Missing control shared-auth-shell profile-trigger')
      } else {
        const profileTarget = await measureTarget(
          profileLocator,
          '/__shell__/authenticated',
          'default',
          selectedRole.label,
          viewport,
          'Профильное меню',
          'button',
          'independent',
        )

        if (viewport.pointerMode === 'coarse' && (
          profileTarget.pageRect.width < 44 || profileTarget.pageRect.height < 44
        )) {
          violations.push(
            `${viewport.label} __shell__/authenticated profile-trigger target ` +
            `${profileTarget.pageRect.width}x${profileTarget.pageRect.height}`,
          )
        }

        const profileLabelClipped = await isVisibleLabelClipped(profileLocator)

        if (profileLabelClipped) {
          const allowlistMatch = findAllowlistMatch(profileTarget.entry)

          if (allowlistMatch?.criterion !== 'label-clipping') {
            violations.push(
              `${viewport.label} __shell__/authenticated profile-trigger visible label is clipped`,
            )
          } else {
            profileTarget.entry.exception = allowlistMatch
          }
        }

        if (await hasHorizontalScroll(page)) {
          violations.push(`${viewport.label} __shell__/authenticated has horizontal page overflow`)
        }

        inventory.push({
          ...resolveGapEntries([profileTarget])[0],
          route: '/__shell__/authenticated',
        })
      }

      for (const route of relevantRoutes) {
        await page.goto(route.path)
        await expect(page.getByTestId(route.screenTestId)).toBeVisible()
        const routeTargets: MeasuredTarget[] = []

        if (viewport.isCompactHeight) {
          await expectNoServiceIntro(page)
          if (await page.locator(SIDE_NAVIGATION_SELECTOR).isVisible()) {
            violations.push(`${viewport.label} must hide desktop navigation`)
          }
          if (!(await page.locator(MOBILE_BOTTOM_NAVIGATION_SELECTOR).isVisible())) {
            violations.push(`${viewport.label} must keep mobile bottom navigation visible`)
          }
        }

        if (route.state === 'preview-open') {
          await openClientsPreview(page)
          await expect(page.getByTestId('client-preview-panel')).toBeVisible()
        } else if (route.state === 'search-focused') {
          await page
            .getByRole('textbox', { name: 'Поиск по имени или телефону' })
            .fill('Алекс')
        }

        for (const control of route.controls) {
          if (control.touchOnly && viewport.pointerMode === 'fine') {
            continue
          }

          const locator = control.locator(page)
          const controlCount = await locator.count()

          if (control.hiddenAtWidths?.includes(viewport.width)) {
            if (controlCount > 0 && await locator.first().isVisible()) {
              violations.push(
                `${viewport.label} ${route.path} ${control.label} must use hidden fallback`,
              )
            }
            continue
          }

          if (controlCount === 0) {
            violations.push(`Missing control ${route.state} ${route.path}: ${control.label}`)
            continue
          }

          const targetLocator = locator.first()
          const measurement = await measureTarget(
            targetLocator,
            route.path,
            route.state,
            selectedRole.label,
            viewport,
            control.label,
            control.role ?? 'button',
            control.gapKind ?? 'independent',
          )

          routeTargets.push(measurement)

          if (viewport.pointerMode === 'coarse') {
            const minSizeFail =
              measurement.pageRect.width < 44 || measurement.pageRect.height < 44

            if (minSizeFail) {
              violations.push(
                `${viewport.label} ${route.path} ${control.label} target ` +
                `${measurement.pageRect.width}x${measurement.pageRect.height}`,
              )
            }
          }

          if (measurement.entry.fontSizePx !== null && viewport.pointerMode === 'coarse') {
            if (measurement.entry.fontSizePx < 16) {
              violations.push(
                `${viewport.label} ${route.path} ${control.label} font-size ` +
                `${measurement.entry.fontSizePx}px`,
              )
            }
          }

          const labelClipped = await isVisibleLabelClipped(targetLocator)

          if (labelClipped) {
            const allowlistMatch = findAllowlistMatch(measurement.entry)

            if (allowlistMatch?.criterion === 'label-clipping') {
              measurement.entry.exception = allowlistMatch
            } else {
              violations.push(
                `${viewport.label} ${route.path} ${control.label} visible label is clipped`,
              )
            }
          }

          if (await hasHorizontalScroll(page)) {
            violations.push(`${viewport.label} ${route.path} has horizontal page overflow`)
          }
        }

        const withRouteGaps = resolveGapEntries(routeTargets)

        for (const entry of withRouteGaps) {
          if (
            viewport.pointerMode === 'coarse' &&
            entry.gap.kind === 'independent' &&
            entry.gap.nearestLocator !== 'none' &&
            entry.gap.distancePx < 8
          ) {
            violations.push(
              `${viewport.label} ${route.path} ${entry.locator} gap ` +
              `${entry.gap.distancePx}px to ${entry.gap.nearestLocator}`,
            )
          }

          inventory.push(entry)
        }
      }

      const payload = {
        generatedAt: new Date().toISOString(),
        matrix: {
          routeCount: relevantRoutes.length,
          role: selectedRole.label,
          viewport,
        },
        targets: inventory,
        violations,
      }

      const inventoryName =
        `touch-target-inventory-${selectedRole.label.toLowerCase()}-${viewport.label}.json`
      const inventoryPath = testInfo.outputPath(inventoryName)

      await writeFile(inventoryPath, JSON.stringify(payload, null, 2), 'utf8')
      await testInfo.attach(inventoryName, {
        path: inventoryPath,
        contentType: 'application/json',
      })

      expect(violations, JSON.stringify(payload, null, 2)).toEqual([])
    })
  })
}

for (const roleFixture of ROLE_MATRIX) {
  test.describe(`navigation access ${roleFixture.label}` , () => {
    const mobileViewport: ViewportCase = VIEWPORT_MATRIX[0]

    test.use({
      hasTouch: true,
      viewport: { width: mobileViewport.width, height: mobileViewport.height },
    })

    test('keeps role-aware mobile primary and overflow sections', async ({ page }) => {
      await mockApi(page, roleFixture.session)
      await page.goto('/')

      await expect(page.getByTestId('home-screen')).toBeVisible()
      await expect(page.locator(MOBILE_BOTTOM_NAVIGATION_SELECTOR)).toBeVisible()

      const allowedSections = roleFixture.session.user.allowedSections
      const overflowTrigger = page
        .locator(MOBILE_BOTTOM_NAVIGATION_SELECTOR)
        .getByRole('button', { name: 'Ещё, открыть остальные разделы' })

      const allowedLabels = allowedSections
        .map((section) => sectionLabel(section))
        .filter(Boolean)
      const navigationText = await page.locator(MOBILE_BOTTOM_NAVIGATION_SELECTOR).locator('button').allTextContents()
      const visibleLabels = navigationText.map((label) => label.trim())

      for (const label of allowedLabels) {
        const normalized = label
        const isPrimary = visibleLabels.includes(normalized)

        if (isPrimary) {
          expect(visibleLabels).toContain(normalized)
          continue
        }

        await overflowTrigger.click()

        const overflow = page.locator('.mobile-bottom-nav__overflow-list')
        await expect(overflow).toBeVisible()
        await expect(overflow.getByRole('button', { name: normalized })).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(overflow).toBeHidden()
        await expect(overflowTrigger).toBeFocused()
      }

      if (!allowedLabels.includes('Финансы')) {
        expect(visibleLabels.join(' ')).not.toContain('Финансы')
        if (await overflowTrigger.count()) {
          await overflowTrigger.click()
          await expect(
            page
              .locator('.mobile-bottom-nav__overflow-list')
              .getByRole('button', { name: 'Финансы' }),
          ).toHaveCount(0)
          await page.keyboard.press('Escape')
          await expect(overflowTrigger).toBeFocused()
        }
      }
    })
  })
}

function sectionLabel(section: string) {
  const sectionMap: Record<string, string> = {
    Audit: 'Журнал',
    Clients: 'Клиенты',
    Groups: 'Группы',
    Home: 'Главная',
    Schedule: 'Расписание',
    Settings: 'Настройки',
    Users: 'Тренеры',
    Finance: 'Финансы',
  }

  return sectionMap[section] ?? ''
}

async function openClientsPreview(page: Page) {
  await page.getByTestId('client-card-client-1').click()
}

async function expectNoServiceIntro(page: Page) {
  await expect(page.locator('.page-header-card')).toHaveCount(0)
  await expect(page.locator('.finance-header-card')).toHaveCount(0)
}

async function measureTarget(
  locator: Locator,
  route: string,
  state: 'default' | 'preview-open' | 'search-focused',
  role: string,
  viewport: ViewportCase,
  locatorLabel: string,
  locatorRole: 'button' | 'textbox',
  gapKind: 'independent' | 'composite',
): Promise<MeasuredTarget> {
  const elementHandle = locator
  const bounds = await elementHandle.boundingBox()

  if (!bounds) {
    throw new Error(`Missing bounds for ${route} ${state}: ${locatorLabel}`)
  }

  const rawFontSize = await locator.evaluate((element) => {
    const tag = element.tagName.toLowerCase()
    const type = element.getAttribute('type')

    if (tag === 'input' || tag === 'select' || tag === 'textarea' || element.getAttribute('role') === 'textbox') {
      const computed = Number.parseFloat(getComputedStyle(element).fontSize)
      return Number.isNaN(computed) ? null : computed
    }

    if (type && ['text', 'search', 'tel', 'email', 'password'].includes(type)) {
      const computed = Number.parseFloat(getComputedStyle(element).fontSize)
      return Number.isNaN(computed) ? null : computed
    }

    return null
  })

  const entry: InventoryEntry = {
    exception: null,
    fontSizePx: rawFontSize,
    gap: {
      distancePx: Number.POSITIVE_INFINITY,
      nearestLocator: 'none',
      kind: gapKind,
    },
    locator: `role=${locatorRole}[name='${locatorLabel}']`,
    measuredBox: {
      height: bounds.height,
      width: bounds.width,
      x: bounds.x,
      y: bounds.y,
    },
    pointerMode: viewport.pointerMode,
    role,
    route,
    state,
    viewport: {
      height: viewport.height,
      width: viewport.width,
    },
  }

  return {
    entry,
    id: entry.locator,
    pageRect: bounds,
  }
}

function resolveGapEntries(targets: MeasuredTarget[]) {
  const computed = targets.map((target) => ({
    ...target,
    nearest: findNearestTarget(target, targets),
  }))

  return computed.map((target) => ({
    ...target.entry,
    gap: {
      ...target.entry.gap,
      nearestLocator: target.nearest.locator,
      distancePx: target.nearest.distance,
    },
  }))
}

function findNearestTarget(target: MeasuredTarget, allTargets: MeasuredTarget[]) {
  let nearest = {
    distance: 0,
    locator: 'none',
  }

  for (const other of allTargets) {
    if (other === target) {
      continue
    }

    const distance = rectGap(target.pageRect, other.pageRect)

    if (nearest.locator === 'none' || distance < nearest.distance) {
      nearest = {
        distance,
        locator: other.id,
      }
    }
  }

  return nearest
}

function rectGap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  const aLeft = a.x
  const aRight = a.x + a.width
  const aTop = a.y
  const aBottom = a.y + a.height

  const bLeft = b.x
  const bRight = b.x + b.width
  const bTop = b.y
  const bBottom = b.y + b.height

  const overlapX = Math.min(aRight, bRight) - Math.max(aLeft, bLeft)
  const overlapY = Math.min(aBottom, bBottom) - Math.max(aTop, bTop)

  if (overlapX > 0 && overlapY > 0) {
    const horizontal = Math.max(0, Math.max(aLeft - bRight, bLeft - aRight))
    const vertical = Math.max(0, Math.max(aTop - bBottom, bTop - aBottom))
    return Math.min(horizontal, vertical)
  }

  if (overlapX > 0) {
    return Math.max(0, Math.max(aTop - bBottom, bTop - aBottom))
  }

  if (overlapY > 0) {
    return Math.max(0, Math.max(aLeft - bRight, bLeft - aRight))
  }

  const dx = Math.max(aLeft, bLeft) - Math.min(aRight, bRight)
  const dy = Math.max(aTop, bTop) - Math.min(aBottom, bBottom)

  return Math.hypot(Math.max(0, dx), Math.max(0, dy))
}

async function isVisibleLabelClipped(locator: Locator) {
  return locator.evaluate((element) => {
    const label = element.querySelector<HTMLElement>('.mantine-Button-label') ??
      element
    const text = label.textContent?.trim() ?? ''

    if (!text) {
      return false
    }

    const labelBounds = label.getBoundingClientRect()
    const targetBounds = element.getBoundingClientRect()
    const style = getComputedStyle(label)

    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      labelBounds.width <= 1 ||
      labelBounds.height <= 1
    ) {
      return false
    }

    const horizontallyOutside =
      labelBounds.left < targetBounds.left - 1 ||
      labelBounds.right > targetBounds.right + 1

    return (
      label.scrollWidth > label.clientWidth + 1 ||
      label.scrollHeight > label.clientHeight + 1 ||
      horizontallyOutside
    )
  })
}

async function hasHorizontalScroll(page: Page) {
  const dimensions = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))

  return (
    dimensions.documentScrollWidth > dimensions.viewportWidth + 2 ||
    dimensions.bodyScrollWidth > dimensions.viewportWidth + 2
  )
}

async function mockApi(
  page: Page,
  session:
    | typeof SUPER_ADMIN_SESSION
    | typeof ADMIN_SESSION
    | typeof HEAD_COACH_SESSION
    | typeof COACH_SESSION,
  appConfig: AppConfigFixture = APP_CONFIG,
) {
  await page.route('**/api/**', async (route: Route) => {
    const requestUrl = new URL(route.request().url())
    const { pathname } = requestUrl
    const method = route.request().method()

    if (!pathname.startsWith('/api/')) {
      await route.continue()
      return
    }

    if (pathname === '/api/config' && method === 'GET') {
      await fulfillJson(route, appConfig)
      return
    }

    if (pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, session)
      return
    }

    if (pathname === '/api/clients' && method === 'GET') {
      await fulfillJson(route, CLIENTS_RESPONSE)
      return
    }

    if (pathname === '/api/clients/client-1' && method === 'GET') {
      await fulfillJson(route, CLIENTS_RESPONSE.items[0])
      return
    }

    if (pathname === '/api/clients/expiring-memberships' && method === 'GET') {
      await fulfillJson(route, { items: [] })
      return
    }

    if (pathname === '/api/clients/attention' && method === 'GET') {
      await fulfillJson(route, { items: [] })
      return
    }

    if (pathname === '/api/schedule/groups' && method === 'GET') {
      await fulfillJson(route, SCHEDULE_GROUPS_RESPONSE)
      return
    }

    if (pathname === '/api/groups' && method === 'GET') {
      await fulfillJson(route, GROUPS_RESPONSE)
      return
    }

    if (pathname === '/api/groups/summary' && method === 'GET') {
      await fulfillJson(route, GROUPS_SUMMARY_RESPONSE)
      return
    }

    if (pathname === '/api/groups/options/trainers' && method === 'GET') {
      await fulfillJson(route, TRAINERS_RESPONSE)
      return
    }

    if (pathname === '/api/users' && method === 'GET') {
      await fulfillJson(route, [])
      return
    }

    if (pathname === '/api/branches' && method === 'GET') {
      await fulfillJson(route, [
        {
          clientCount: 1,
          createdAt: '2026-05-01T10:00:00Z',
          groupCount: 1,
          hallCount: 1,
          id: 'branch-1',
          updatedAt: '2026-05-01T10:00:00Z',
          name: 'Центр',
          address: null,
          description: 'Основной филиал',
          isArchived: false,
        },
      ])
      return
    }

    if (pathname === '/api/settings/membership-catalog' && method === 'GET') {
      await fulfillJson(route, { items: [] })
      return
    }

    if (pathname === '/api/halls' && method === 'GET') {
      await fulfillJson(route, [
        {
          id: 'hall-1',
          branchId: 'branch-1',
          branchName: 'Центр',
          name: 'Основной зал',
          description: 'Зал',
          isArchived: false,
          groupCount: 1,
          clientCount: 1,
          createdAt: '2026-05-01T10:00:00Z',
          updatedAt: '2026-05-01T10:00:00Z',
        },
      ])
      return
    }

    if (pathname === '/api/group-types' && method === 'GET') {
      await fulfillJson(route, [
        {
          id: 'group-type-1',
          name: 'Базовый тип',
          description: 'Тип',
          groupCount: 1,
          createdAt: '2026-05-01T10:00:00Z',
          updatedAt: '2026-05-01T10:00:00Z',
        },
      ])
      return
    }

    if (pathname === '/api/settings/administrators' && method === 'GET') {
      await fulfillJson(route, { items: [] })
      return
    }

    if (pathname === '/api/attendance/groups' && method === 'GET') {
      await fulfillJson(route, {
        groups: [],
        today: '2026-07-25',
        maxTrainingDate: '2026-07-25',
      })
      return
    }

    if (pathname === '/api/attendance/groups/group-1/clients' && method === 'GET') {
      await fulfillJson(route, {
        clients: [],
        groupId: 'group-1',
        trainingDate: '2026-07-25',
        today: '2026-07-25',
        maxTrainingDate: '2026-07-25',
      })
      return
    }

    if (pathname === '/api/audit-logs/options' && method === 'GET') {
      await fulfillJson(route, {
        users: [
          {
            fullName: 'Главный тренер',
            id: 'headcoach-id',
            login: 'headcoach',
          },
        ],
      })
      return
    }

    if (pathname === '/api/audit-logs' && method === 'GET') {
      await fulfillJson(route, {
        items: [],
        page: 1,
        pageSize: 20,
        totalCount: 0,
      })
      return
    }

    if (pathname === '/api/reports/financial' && method === 'GET') {
      await fulfillJson(route, {
        totals: {
          grossSales: 4_500,
          netTotal: 4_500,
          newClientsCount: 0,
          refundTotal: 0,
          soldMembershipCount: 0,
        },
        period: {
          anchorDate: '2026-07-01',
          from: '2026-07-01',
          preset: 'month',
          to: '2026-07-31',
        },
        branchBreakdown: [],
        groupBreakdown: [],
        trainerBreakdown: [],
      })
      return
    }

    if (pathname === '/api/settings/group-types' && method === 'GET') {
      await fulfillJson(route, {
        items: [{
          id: 'group-type-1',
          name: 'Базовый',
          description: 'Тип',
          groupCount: 1,
          createdAt: '2026-05-01T10:00:00Z',
          updatedAt: '2026-05-01T10:00:00Z',
        }],
      })
      return
    }

    throw new Error(`Unexpected API request in touch target inventory: ${method} ${pathname}`)
  })
}

async function fulfillJson(route: Route, payload: unknown) {
  await route.fulfill({
    body: JSON.stringify(payload),
    contentType: 'application/json; charset=utf-8',
    status: 200,
  })
}

const CLIENTS_RESPONSE = {
  items: [
    {
      id: 'client-1',
      fullName: 'Александра Константинопольская',
      groupCount: 2,
      branchId: 'branch-1',
      branchName: 'Центр',
      hasActiveMembership: false,
      hasCurrentMembership: true,
      membershipWarning: false,
      status: 'Active',
      phone: '+7 999 123-45-67',
      notes: 'Снижение скорости восстановления',
      currentMembership: {
        id: 'membership-1',
        saleId: 'sale-1',
        membershipCatalogItemId: 'catalog-1',
        membershipName: 'Месяц',
        behaviorKind: 'Term',
        purchaseDate: '2026-04-01',
        paymentDate: '2026-04-01',
        paymentRecordedAt: '2026-04-01T09:00:00Z',
        paymentRecordedByUserId: 'coach-1',
        paymentRecordedByUserName: 'Тренер',
        expirationDate: '2026-05-22',
        grossAmount: 3500,
        catalogPrice: 3500,
        singleVisitUsed: false,
        pricingMode: 'Catalog',
      },
      currentMembershipSummary: {
        id: 'membership-1',
        saleId: 'sale-1',
        membershipCatalogItemId: 'catalog-1',
        membershipName: 'Месяц',
        behaviorKind: 'Term',
        purchaseDate: '2026-04-01',
        paymentDate: '2026-04-01',
        paymentRecordedAt: '2026-04-01T09:00:00Z',
        paymentRecordedByUserId: 'coach-1',
        paymentRecordedByUserName: 'Тренер',
        expirationDate: '2026-05-22',
        grossAmount: 3500,
        catalogPrice: 3500,
        singleVisitUsed: false,
        pricingMode: 'Catalog',
      },
      attendanceHistory: [],
      attendanceHistoryTotalCount: 0,
      membershipHistory: [],
    },
  ],
  totalCount: 120,
  activeCount: 120,
  archivedCount: 0,
  skip: 0,
  take: 20,
  page: 1,
  pageSize: 20,
  hasNextPage: true,
}

const GROUPS_RESPONSE = {
  hasNextPage: false,
  items: [
    {
      id: 'group-1',
      name: 'Группа 7: вечерний поток',
      branchId: 'branch-1',
      branchName: 'Центр',
      hallId: 'hall-1',
      hallName: 'Основной зал',
      groupTypeId: 'group-type-1',
      groupTypeName: 'Базовый',
      trainingStartTime: '19:00',
      durationMinutes: 60,
      weekdays: [2, 4],
      trainers: [{ id: 'coach-id', fullName: 'Тренер группы', login: 'coach' }],
      trainerIds: ['coach-id'],
      trainerCount: 1,
      trainerNames: ['Тренер группы'],
      clientCount: 12,
      isActive: true,
    },
  ],
  skip: 0,
  take: 20,
  totalCount: 1,
}

const SCHEDULE_GROUPS_RESPONSE = GROUPS_RESPONSE

const GROUPS_SUMMARY_RESPONSE = {
  activeWithoutTrainerCount: 4,
  totalCount: 100,
}

const TRAINERS_RESPONSE = [
  {
    id: 'coach-id',
    fullName: 'Тренер группы',
    login: 'coach',
  },
]
