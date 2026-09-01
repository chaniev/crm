import { expect, test, type Locator, type Page, type Route } from '@playwright/test'

const APP_CONFIG = {
  clubName: 'Iron Club',
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
} as const

const session = {
  isAuthenticated: true,
  csrfToken: 'schedule-occurrence-csrf',
  bootstrapMode: false,
  user: {
    id: 'headcoach-id',
    fullName: 'Главный тренер',
    login: 'headcoach',
    role: 'HeadCoach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Schedule',
    allowedSections: ['Attendance', 'Attention', 'Schedule', 'Clients', 'Groups'],
    permissions: {
      canManageUsers: false,
      canManageClients: true,
      canManageGroups: true,
      canManageSettings: false,
      canMarkAttendance: true,
      canViewAuditLog: false,
      canViewFinancialReports: false,
    },
    assignedGroupIds: [],
    attendanceScope: { kind: 'Global', groupIds: [] },
    branchId: null,
  },
} as const

test.describe('Occurrence schedule calendar', () => {
  test('opens exact occurrence attendance route and saves via lesson endpoint', async ({ page }) => {
    let savedPayload: unknown = null
    await mockApi(page, async ({ pathname, method, searchParams, route }) => {
      if (pathname === '/api/schedule/lessons' && method === 'GET') {
        expect(searchParams.get('from')).toBe('2026-08-20')
        expect(searchParams.get('to')).toBe('2026-08-20')
        await fulfillJson(route, 200, scheduleResponse())
        return true
      }

      if (
        pathname === '/api/attendance/lessons/occ-evening/clients' &&
        method === 'GET'
      ) {
        expect(searchParams.get('lessonDate')).toBe('2026-08-20')
        await fulfillJson(route, 200, rosterResponse({ canEdit: true }))
        return true
      }

      if (
        pathname === '/api/schedule/lessons/occ-evening' &&
        method === 'GET'
      ) {
        expect(searchParams.get('lessonDate')).toBe('2026-08-20')
        await fulfillJson(route, 200, lesson({
          lessonOccurrenceId: 'occ-evening',
          startTime: '18:00',
          endTime: '18:50',
          hasAttendanceMarks: true,
        }))
        return true
      }

      if (
        pathname === '/api/attendance/lessons/occ-evening' &&
        method === 'POST'
      ) {
        expect(searchParams.get('lessonDate')).toBe('2026-08-20')
        expect(route.request().headers()['x-csrf-token']).toBe(session.csrfToken)
        savedPayload = route.request().postDataJSON()
        await fulfillJson(route, 200, {
          groupId: 'group-1',
          trainingDate: '2026-08-20',
          lessonOccurrenceId: 'occ-evening',
          lessonDate: '2026-08-20',
          today: '2026-08-20',
          maxTrainingDate: '2026-08-20',
          attendanceMarks: [{ clientId: 'client-1', state: 'Present' }],
        })
        return true
      }

      return false
    })

    await page.goto('/schedule?date=2026-08-20&view=day')

    await expect(page.getByTestId('schedule-screen')).toBeVisible()
    await expect(page.getByTestId('schedule-time-group-2026-08-20-08:00-08:50')).toContainText('08:00-08:50')
    await expect(page.getByTestId('schedule-time-group-2026-08-20-18:00-18:50')).toContainText('18:00-18:50')
    await page
      .getByTestId('schedule-card-occ-evening')
      .getByRole('button', { name: /Открыть занятие/ })
      .click()

    await expect(page).toHaveURL(/\/schedule\/lessons\/occ-evening\?lessonDate=2026-08-20$/)
    await expect(page.getByTestId('schedule-lesson-detail-screen')).toBeVisible()
    await expect(page.getByText('occ-evening')).toHaveCount(0)
    await page.goBack()
    await expect(page.getByTestId('schedule-screen')).toBeVisible()

    await page
      .getByTestId('schedule-card-occ-evening')
      .getByRole('button', { name: 'Посещение' })
      .click()

    await expect(page).toHaveURL(/\/attendance\/occ-evening\?lessonDate=2026-08-20$/)
    await expect(page.getByTestId('attendance-client-card-client-1')).toBeVisible()
    await expect(page.getByText('occ-evening')).toHaveCount(0)

    await page.getByRole('radio', { name: 'Был', exact: true }).click()
    await expect.poll(() => savedPayload).toEqual({
      LessonDate: '2026-08-20',
      AttendanceMarks: [{ ClientId: 'client-1', State: 'Present' }],
    })
  })

  test('week mode renders seven vertical sections and tools drawer preserves filters in URL', async ({ page }) => {
    await mockApi(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/schedule?date=2026-08-20&view=week')

    await expect(page.getByTestId('schedule-week-view')).toBeVisible()
    await expect(page.locator('[data-testid^="schedule-day-section-"]')).toHaveCount(7)

    await page.getByRole('button', { name: 'Параметры календаря' }).click()
    await expect(page.getByRole('dialog', { name: 'Параметры календаря' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Сегодня' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Обновить' })).toBeVisible()
    await page.getByRole('combobox', { name: 'Филиал' }).click()
    await page.getByRole('option', { name: 'Центр' }).click()

    await expect(page).toHaveURL(/branchId=branch-1/)
    await expect(page.getByRole('button', { name: /активных фильтров: 1/ })).toBeVisible()
  })

  test('creates one-off lesson through preview confirmation and opens exact detail', async ({ page }) => {
    let previewPayload: unknown = null
    let executePayload: unknown = null

    await mockApi(page, async ({ pathname, method, route }) => {
      if (pathname === '/api/schedule/lessons/one-off/preview' && method === 'POST') {
        expect(route.request().headers()['x-csrf-token']).toBe(session.csrfToken)
        previewPayload = route.request().postDataJSON()
        await fulfillJson(route, 200, {
          confirmationToken: 'one-off-preview-token',
          expiresAt: '2026-08-20T09:15:00Z',
          lesson: lesson({
            lessonOccurrenceId: 'preview-one-off',
            sourceKind: 'OneOff',
            isMaterialized: false,
            lessonDate: '2026-08-20',
            startTime: '12:30',
            durationMinutes: 60,
            endTime: '13:30',
            hasAttendanceMarks: false,
          }),
          warnings: [{ code: 'hall-load', message: 'Проверьте нагрузку зала.' }],
        })
        return true
      }

      if (pathname === '/api/schedule/lessons/one-off' && method === 'POST') {
        expect(route.request().headers()['x-csrf-token']).toBe(session.csrfToken)
        executePayload = route.request().postDataJSON()
        await fulfillJson(route, 201, lesson({
          lessonOccurrenceId: 'created-one-off',
          sourceKind: 'OneOff',
          isMaterialized: true,
          lessonDate: '2026-08-20',
          startTime: '12:30',
          durationMinutes: 60,
          endTime: '13:30',
          hasAttendanceMarks: false,
        }))
        return true
      }

      if (pathname === '/api/schedule/lessons/created-one-off' && method === 'GET') {
        await fulfillJson(route, 200, lesson({
          lessonOccurrenceId: 'created-one-off',
          sourceKind: 'OneOff',
          isMaterialized: true,
          lessonDate: '2026-08-20',
          startTime: '12:30',
          durationMinutes: 60,
          endTime: '13:30',
          hasAttendanceMarks: false,
        }))
        return true
      }

      return false
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/schedule?date=2026-08-20&view=day')
    await page.getByRole('button', { name: 'Создать разовое занятие' }).click()

    const drawer = page.getByTestId('schedule-lesson-create-screen')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByLabel('Группа')).toHaveValue('Утренняя база')
    await expect(drawer.getByLabel('Зал')).toHaveValue('Основной зал')
    await drawer.getByLabel('Дата').fill('2026-08-20')
    await drawer.getByLabel('Время').fill('12:30')
    await drawer.getByRole('button', { name: 'Получить предпросмотр' }).click()

    await expect.poll(() => previewPayload).toEqual({
      groupId: 'group-1',
      lessonDate: '2026-08-20',
      startTime: '12:30',
      durationMinutes: 60,
      hallId: 'hall-1',
    })
    await expect(drawer.getByText('Проверьте нагрузку зала.')).toBeVisible()

    await drawer.getByRole('button', { name: 'Создать занятие' }).click()
    await expect.poll(() => executePayload).toEqual({
      groupId: 'group-1',
      lessonDate: '2026-08-20',
      startTime: '12:30',
      durationMinutes: 60,
      hallId: 'hall-1',
      confirmationToken: 'one-off-preview-token',
    })
    await expect(page).toHaveURL(/\/schedule\/lessons\/created-one-off\?lessonDate=2026-08-20$/)
    await expect(page.getByTestId('schedule-lesson-detail-screen')).toBeVisible()
    await expect(page.getByText('one-off-preview-token')).toHaveCount(0)
  })

  test('recovers from stale one-off confirmation while preserving draft', async ({ page }) => {
    let executeCalls = 0

    await mockApi(page, async ({ pathname, method, route }) => {
      if (pathname === '/api/schedule/lessons/one-off/preview' && method === 'POST') {
        await fulfillJson(route, 200, {
          confirmationToken: 'stale-preview-token',
          expiresAt: '2026-08-20T09:15:00Z',
          lesson: lesson({
            lessonOccurrenceId: 'preview-one-off',
            sourceKind: 'OneOff',
            isMaterialized: false,
            lessonDate: '2026-08-20',
            startTime: '12:30',
            durationMinutes: 60,
            endTime: '13:30',
          }),
          warnings: [],
        })
        return true
      }

      if (pathname === '/api/schedule/lessons/one-off' && method === 'POST') {
        executeCalls += 1
        await fulfillJson(route, 409, {
          title: 'Schedule confirmation token is not valid for this mutation.',
          code: 'lesson-mutation-preview-stale',
        })
        return true
      }

      return false
    })

    await page.goto('/schedule?date=2026-08-20&view=day')
    await page.getByRole('button', { name: 'Создать разовое занятие' }).click()

    const drawer = page.getByTestId('schedule-lesson-create-screen')
    await drawer.getByLabel('Время').fill('12:30')
    await drawer.getByRole('button', { name: 'Получить предпросмотр' }).click()
    await expect(drawer.getByText('Проверьте занятие перед созданием')).toBeVisible()
    await drawer.getByRole('button', { name: 'Создать занятие' }).click()

    await expect(drawer.getByText('Параметры изменились после предпросмотра. Получите новый предпросмотр.')).toBeVisible()
    await expect(drawer.getByText('lesson-mutation-preview-stale')).toHaveCount(0)
    await expect(drawer.getByLabel('Время')).toHaveValue('12:30')
    await expect(drawer.getByRole('button', { name: 'Обновить предпросмотр' })).toBeVisible()
    expect(executeCalls).toBe(1)
  })

  test('moves occurrence from detail change action and opens returned exact lesson date', async ({ page }) => {
    let previewPayload: unknown = null
    let executePayload: unknown = null

    await mockApi(page, async ({ pathname, method, route, searchParams }) => {
      if (pathname === '/api/schedule/lessons' && method === 'GET') {
        await fulfillJson(route, 200, scheduleResponse({
          items: [
            lesson({
              lessonOccurrenceId: 'occ-evening',
              startTime: '18:00',
              endTime: '18:50',
              allowedActions: buildAllowedActions({
                move: { allowed: true, reason: null },
              }),
            }),
          ],
        }))
        return true
      }

      if (pathname === '/api/schedule/lessons/occ-evening' && method === 'GET') {
        await fulfillJson(route, 200, lesson({
          lessonOccurrenceId: 'occ-evening',
          lessonDate: searchParams.get('lessonDate') ?? '2026-08-20',
          startTime: searchParams.get('lessonDate') === '2026-08-21' ? '11:15' : '18:00',
          durationMinutes: 60,
          endTime: searchParams.get('lessonDate') === '2026-08-21' ? '12:15' : '19:00',
          isMaterialized: searchParams.get('lessonDate') === '2026-08-21',
          revision: searchParams.get('lessonDate') === '2026-08-21' ? 'revision-2' : 'revision-1',
          allowedActions: buildAllowedActions({
            move: { allowed: true, reason: null },
          }),
        }))
        return true
      }

      if (pathname === '/api/schedule/lessons/occ-evening/change/preview' && method === 'POST') {
        expect(searchParams.get('lessonDate')).toBe('2026-08-20')
        expect(route.request().headers()['x-csrf-token']).toBe(session.csrfToken)
        previewPayload = route.request().postDataJSON()
        await fulfillJson(route, 200, {
          confirmationToken: 'change-preview-token',
          expiresAt: '2026-08-20T09:15:00Z',
          lesson: lesson({
            lessonOccurrenceId: 'occ-evening',
            lessonDate: '2026-08-21',
            startTime: '11:15',
            durationMinutes: 60,
            endTime: '12:15',
            revision: 'preview-change',
            allowedActions: buildAllowedActions({
              move: { allowed: true, reason: null },
            }),
          }),
          warnings: [{ code: 'lesson_hall_overlap', message: 'Проверьте пересечение зала.' }],
        })
        return true
      }

      if (pathname === '/api/schedule/lessons/occ-evening/change' && method === 'POST') {
        expect(searchParams.get('lessonDate')).toBe('2026-08-20')
        expect(route.request().headers()['x-csrf-token']).toBe(session.csrfToken)
        executePayload = route.request().postDataJSON()
        await fulfillJson(route, 200, lesson({
          lessonOccurrenceId: 'occ-evening',
          lessonDate: '2026-08-21',
          startTime: '11:15',
          durationMinutes: 60,
          endTime: '12:15',
          isMaterialized: true,
          revision: 'revision-2',
          allowedActions: buildAllowedActions({
            move: { allowed: true, reason: null },
          }),
        }))
        return true
      }

      return false
    })

    await page.goto('/schedule?date=2026-08-20&view=day')
    await page
      .getByTestId('schedule-card-occ-evening')
      .getByRole('button', { name: /Открыть занятие/ })
      .click()
    await expect(page).toHaveURL(/\/schedule\/lessons\/occ-evening\?lessonDate=2026-08-20$/)
    await page.getByRole('button', { name: 'Перенести' }).click()

    const drawer = page.getByTestId('schedule-lesson-move-screen')
    await drawer.getByLabel('Дата').fill('2026-08-21')
    await drawer.getByLabel('Время').fill('11:15')
    await drawer.getByRole('button', { name: 'Получить предпросмотр' }).click()

    await expect.poll(() => previewPayload).toEqual({
      scope: 'Occurrence',
      newLessonDate: '2026-08-21',
      startTime: '11:15',
      durationMinutes: 60,
      hallId: 'hall-1',
      expectedRevision: 'revision-1',
    })
    await expect(drawer.getByText('Проверьте пересечение зала.')).toBeVisible()
    await drawer.getByRole('button', { name: 'Сохранить изменение' }).click()

    await expect.poll(() => executePayload).toEqual({
      scope: 'Occurrence',
      newLessonDate: '2026-08-21',
      startTime: '11:15',
      durationMinutes: 60,
      hallId: 'hall-1',
      expectedRevision: 'revision-1',
      confirmationToken: 'change-preview-token',
    })
    await expect(page).toHaveURL(/\/schedule\/lessons\/occ-evening\?lessonDate=2026-08-21$/)
    await expect(page.getByTestId('schedule-lesson-detail-screen')).toContainText('11:15-12:15')
  })

  test('row change stale recovery keeps draft and hides raw confirmation code', async ({ page }) => {
    await mockApi(page, async ({ pathname, method, route }) => {
      if (pathname === '/api/schedule/lessons' && method === 'GET') {
        await fulfillJson(route, 200, scheduleResponse({
          items: [
            lesson({
              lessonOccurrenceId: 'occ-evening',
              startTime: '18:00',
              durationMinutes: 60,
              endTime: '19:00',
              allowedActions: buildAllowedActions({
                edit: { allowed: true, reason: null },
              }),
            }),
          ],
        }))
        return true
      }

      if (pathname === '/api/schedule/lessons/occ-evening' && method === 'GET') {
        await fulfillJson(route, 200, lesson({
          lessonOccurrenceId: 'occ-evening',
          startTime: '18:00',
          durationMinutes: 60,
          endTime: '19:00',
          revision: 'revision-1',
          allowedActions: buildAllowedActions({
            edit: { allowed: true, reason: null },
          }),
        }))
        return true
      }

      if (pathname === '/api/schedule/lessons/occ-evening/change/preview' && method === 'POST') {
        await fulfillJson(route, 200, {
          confirmationToken: 'stale-change-token',
          expiresAt: '2026-08-20T09:15:00Z',
          lesson: lesson({
            lessonOccurrenceId: 'occ-evening',
            startTime: '11:15',
            durationMinutes: 60,
            endTime: '12:15',
          }),
          warnings: [],
        })
        return true
      }

      if (pathname === '/api/schedule/lessons/occ-evening/change' && method === 'POST') {
        await fulfillJson(route, 409, {
          title: 'Schedule confirmation token is not valid for this mutation.',
          code: 'lesson-mutation-preview-stale',
        })
        return true
      }

      return false
    })

    await page.goto('/schedule?date=2026-08-20&view=day')
    await page
      .getByTestId('schedule-card-occ-evening')
      .getByRole('button', { name: /Изменить занятие/ })
      .click()

    const drawer = page.getByTestId('schedule-lesson-edit-screen')
    await drawer.getByLabel('Время').fill('11:15')
    await drawer.getByRole('button', { name: 'Получить предпросмотр' }).click()
    await expect(drawer.getByText('Проверьте изменение перед сохранением')).toBeVisible()
    await drawer.getByRole('button', { name: 'Сохранить изменение' }).click()

    await expect(drawer.getByText('Параметры изменились после предпросмотра. Получите новый предпросмотр.')).toBeVisible()
    await expect(drawer.getByText('lesson-mutation-preview-stale')).toHaveCount(0)
    await expect(drawer.getByLabel('Время')).toHaveValue('11:15')
    await expect(drawer.getByRole('button', { name: 'Обновить предпросмотр' })).toBeVisible()
  })

  test('series edit route previews, applies and returns to exact source lesson', async ({ page }) => {
    let previewPayload: unknown = null
    let executePayload: unknown = null

    await mockApi(page, async ({ pathname, method, route, searchParams }) => {
      if (pathname === '/api/groups/series-1/lesson-series' && method === 'GET') {
        await fulfillJson(route, 200, seriesResponse())
        return true
      }

      if (pathname === '/api/groups/series-1/lesson-series/preview' && method === 'POST') {
        previewPayload = route.request().postDataJSON()
        await fulfillJson(route, 200, seriesPreviewResponse())
        return true
      }

      if (pathname === '/api/groups/series-1/lesson-series' && method === 'POST') {
        executePayload = route.request().postDataJSON()
        await fulfillJson(route, 200, {
          ...seriesPreviewResponse(),
          confirmationToken: undefined,
          revision: 'series-revision-2',
        })
        return true
      }

      if (pathname === '/api/schedule/lessons/occ-morning' && method === 'GET') {
        expect(searchParams.get('lessonDate')).toBe('2026-08-20')
        await fulfillJson(route, 200, lesson({
          lessonOccurrenceId: 'occ-morning',
          allowedActions: buildAllowedActions({
            edit: { allowed: true, reason: null },
          }),
        }))
        return true
      }

      return false
    })

    await page.goto('/schedule/series/series-1/edit?scope=this-and-future&groupId=group-1&lessonOccurrenceId=occ-morning&lessonDate=2026-08-20')

    const screen = page.getByTestId('schedule-series-edit-screen')
    await expect(screen).toContainText('Утренняя база')
    const addSlotButton = screen.getByRole('button', { name: 'Добавить слот' })
    const firstRemoveButton = screen.getByRole('button', { name: 'Удалить слот' })
    await expect(firstRemoveButton).toBeDisabled()
    await expectTouchTargetAtLeast(addSlotButton, 44)
    await screen.getByLabel('Время начала').fill('09:00')
    await addSlotButton.click()
    await expect(screen.locator('[data-testid^="schedule-series-slot-"]')).toHaveCount(2)
    await screen.getByRole('button', { name: 'Удалить слот' }).first().click()
    await expect(screen.locator('[data-testid^="schedule-series-slot-"]')).toHaveCount(1)
    await screen.getByRole('button', { name: 'Получить предпросмотр' }).click()
    await expect(screen.getByText('Проверьте изменение серии')).toBeVisible()
    expect(previewPayload).toEqual(expect.objectContaining({
      scope: 'ThisAndFuture',
      effectiveFrom: '2026-08-20',
      expectedRevision: 'series-revision-1',
      slots: [expect.objectContaining({
        isoWeekday: 1,
        startTime: '09:00',
        durationMinutes: 50,
        hallId: 'hall-1',
      })],
    }))

    await screen.getByRole('button', { name: 'Подтвердить изменение серии' }).click()
    await expect(page).toHaveURL(/\/schedule\/lessons\/occ-morning\?lessonDate=2026-08-20$/)
    expect(executePayload).toEqual(expect.objectContaining({
      confirmationToken: 'series-token',
      expectedRevision: 'series-revision-1',
    }))
  })

  test('cancels exact occurrence through preview confirmation and opens returned detail', async ({ page }) => {
    let previewPayload: unknown = null
    let executePayload: unknown = null

    await mockApi(page, async ({ pathname, method, route, searchParams }) => {
      if (pathname === '/api/schedule/lessons' && method === 'GET') {
        await fulfillJson(route, 200, scheduleResponse({
          items: [
            lesson({
              lessonOccurrenceId: 'occ-evening',
              startTime: '18:00',
              endTime: '18:50',
              allowedActions: buildAllowedActions({
                cancel: { allowed: true, reason: null },
              }),
            }),
          ],
        }))
        return true
      }

      if (pathname === '/api/schedule/lessons/occ-evening/cancellation/preview' && method === 'POST') {
        expect(searchParams.get('lessonDate')).toBe('2026-08-20')
        expect(route.request().headers()['x-csrf-token']).toBe(session.csrfToken)
        previewPayload = route.request().postDataJSON()
        await fulfillJson(route, 200, {
          confirmationToken: 'cancel-preview-token',
          expiresAt: '2026-08-20T09:15:00Z',
          action: 'Cancel',
          lesson: lesson({
            lessonOccurrenceId: 'occ-evening',
            startTime: '18:00',
            endTime: '18:50',
            status: 'Cancelled',
            allowedActions: buildAllowedActions({
              restore: { allowed: true, reason: null },
            }),
          }),
        })
        return true
      }

      if (pathname === '/api/schedule/lessons/occ-evening/cancellation' && method === 'POST') {
        expect(searchParams.get('lessonDate')).toBe('2026-08-20')
        expect(route.request().headers()['x-csrf-token']).toBe(session.csrfToken)
        executePayload = route.request().postDataJSON()
        await fulfillJson(route, 200, lesson({
          lessonOccurrenceId: 'occ-evening',
          startTime: '18:00',
          endTime: '18:50',
          status: 'Cancelled',
          isMaterialized: true,
          revision: 'revision-2',
          allowedActions: buildAllowedActions({
            restore: { allowed: true, reason: null },
          }),
        }))
        return true
      }

      if (pathname === '/api/schedule/lessons/occ-evening' && method === 'GET') {
        expect(searchParams.get('lessonDate')).toBe('2026-08-20')
        await fulfillJson(route, 200, lesson({
          lessonOccurrenceId: 'occ-evening',
          startTime: '18:00',
          endTime: '18:50',
          status: 'Cancelled',
          isMaterialized: true,
          revision: 'revision-2',
          allowedActions: buildAllowedActions({
            restore: { allowed: true, reason: null },
          }),
        }))
        return true
      }

      return false
    })

    await page.goto('/schedule?date=2026-08-20&view=day')
    const card = page.getByTestId('schedule-card-occ-evening')
    await expect(card.getByRole('button', { name: /Отменить занятие/ })).toHaveCount(0)
    await card.getByRole('button', { name: /Ещё действий/ }).click()
    const moreCancelButton = page
      .getByRole('dialog', { name: /Ещё действий/ })
      .getByRole('button', { name: /Отменить занятие/ })
      .or(page.getByRole('menuitem', { name: /Отменить занятие/ }))
    await expect(moreCancelButton).toBeVisible()
    await expect(
      page
        .getByRole('dialog', { name: /Ещё действий/ })
        .getByRole('button', { name: /Восстановить занятие/ })
        .or(page.getByRole('menuitem', { name: /Восстановить занятие/ })),
    ).toHaveCount(0)
    await moreCancelButton.click()

    const drawer = page.getByRole('dialog', { name: 'Отменить занятие' })
    await expect(drawer).toContainText('Утренняя база')
    await expect(drawer).toContainText('18:00-18:50')
    await drawer.getByRole('button', { name: 'Получить предпросмотр' }).click()

    await expect.poll(() => previewPayload).toEqual({
      action: 'Cancel',
      expectedRevision: 'revision-1',
    })
    await expect(drawer.getByText('Проверьте действие перед подтверждением')).toBeVisible()
    await drawer.getByRole('button', { name: 'Отменить занятие' }).click()

    await expect.poll(() => executePayload).toEqual({
      action: 'Cancel',
      expectedRevision: 'revision-1',
      confirmationToken: 'cancel-preview-token',
    })
    await expect(page).toHaveURL(/\/schedule\/lessons\/occ-evening\?lessonDate=2026-08-20$/)
    await expect(page.getByTestId('schedule-lesson-detail-screen')).toContainText('Отменено')
    await expect(page.getByText('cancel-preview-token')).toHaveCount(0)
  })

  test('cancels exact occurrence trainer substitution through preview confirmation', async ({ page }) => {
    let previewPayload: unknown = null
    let executePayload: unknown = null

    await mockApi(page, async ({ pathname, method, route, searchParams }) => {
      if (pathname === '/api/schedule/lessons' && method === 'GET') {
        await fulfillJson(route, 200, scheduleResponse({
          items: [
            lesson({
              lessonOccurrenceId: 'occ-evening',
              startTime: '18:00',
              endTime: '18:50',
              allowedActions: buildAllowedActions({
                cancelTrainerSubstitution: { allowed: true, reason: null },
              }),
              effectiveTrainers: [
                {
                  trainerId: 'trainer-1',
                  fullName: 'Алиса',
                  kind: 'Permanent',
                  replacedTrainerId: null,
                  substitutionId: null,
                },
                {
                  trainerId: 'trainer-2',
                  fullName: 'Борис',
                  kind: 'Substitute',
                  replacedTrainerId: 'trainer-1',
                  substitutionId: 'substitution-1',
                },
              ],
            }),
          ],
        }))
        return true
      }

      if (pathname === '/api/schedule/lesson-trainer-substitutions/cancellations/preview' && method === 'POST') {
        expect(route.request().headers()['x-csrf-token']).toBe(session.csrfToken)
        previewPayload = route.request().postDataJSON()
        await fulfillJson(route, 200, {
          confirmationToken: 'substitution-cancel-token',
          expiresAt: '2026-08-20T09:15:00Z',
          targets: [{
            lessonOccurrenceId: 'occ-evening',
            lessonDate: '2026-08-20',
            groupId: 'group-1',
            groupName: 'Утренняя база',
            substitutionId: 'substitution-1',
            warnings: [],
          }],
          warnings: [],
        })
        return true
      }

      if (pathname === '/api/schedule/lesson-trainer-substitutions/cancellations' && method === 'POST') {
        executePayload = route.request().postDataJSON()
        await fulfillJson(route, 200, {
          lessons: [lesson({
            lessonOccurrenceId: 'occ-evening',
            startTime: '18:00',
            endTime: '18:50',
            revision: 'after-substitution-cancel',
          })],
          warnings: [],
        })
        return true
      }

      if (pathname === '/api/schedule/lessons/occ-evening' && method === 'GET') {
        expect(searchParams.get('lessonDate')).toBe('2026-08-20')
        await fulfillJson(route, 200, lesson({
          lessonOccurrenceId: 'occ-evening',
          startTime: '18:00',
          endTime: '18:50',
          revision: 'after-substitution-cancel',
        }))
        return true
      }

      return false
    })

    await page.goto('/schedule?date=2026-08-20&view=day')
    await page
      .getByTestId('schedule-card-occ-evening')
      .getByRole('button', { name: /Ещё действий/ })
      .click()
    await page
      .getByRole('dialog', { name: /Ещё действий/ })
      .getByRole('button', { name: /Снять замену тренера/ })
      .or(page.getByRole('menuitem', { name: /Снять замену тренера/ }))
      .click()

    const drawer = page.getByRole('dialog', { name: 'Снять замену тренера' })
    await drawer.getByRole('button', { name: 'Получить предпросмотр' }).click()
    await expect(drawer.getByText('Проверьте замену перед подтверждением')).toBeVisible()
    await drawer.getByRole('button', { name: 'Снять замену' }).click()

    await expect(page).toHaveURL(/\/schedule\/lessons\/occ-evening\?lessonDate=2026-08-20$/)
    expect(previewPayload).toEqual({
      targets: [{
        lessonOccurrenceId: 'occ-evening',
        lessonDate: '2026-08-20',
        expectedRevision: 'revision-1',
        substitutionId: 'substitution-1',
      }],
      reason: null,
    })
    expect(executePayload).toEqual({
      targets: [{
        lessonOccurrenceId: 'occ-evening',
        lessonDate: '2026-08-20',
        expectedRevision: 'revision-1',
        substitutionId: 'substitution-1',
      }],
      reason: null,
      confirmationToken: 'substitution-cancel-token',
    })
  })

  test('cancellation attendance conflict keeps exact context and exposes localized recovery', async ({ page }) => {
    await mockApi(page, async ({ pathname, method, route }) => {
      if (pathname === '/api/schedule/lessons' && method === 'GET') {
        await fulfillJson(route, 200, scheduleResponse({
          items: [
            lesson({
              lessonOccurrenceId: 'occ-evening',
              startTime: '18:00',
              endTime: '18:50',
              hasAttendanceMarks: true,
              allowedActions: buildAllowedActions({
                cancel: { allowed: true, reason: null },
              }),
            }),
          ],
        }))
        return true
      }

      if (pathname === '/api/schedule/lessons/occ-evening/cancellation/preview' && method === 'POST') {
        await fulfillJson(route, 200, {
          confirmationToken: 'conflict-cancel-token',
          expiresAt: '2026-08-20T09:15:00Z',
          action: 'Cancel',
          lesson: lesson({
            lessonOccurrenceId: 'occ-evening',
            startTime: '18:00',
            endTime: '18:50',
            status: 'Cancelled',
            hasAttendanceMarks: true,
          }),
        })
        return true
      }

      if (pathname === '/api/schedule/lessons/occ-evening/cancellation' && method === 'POST') {
        await fulfillJson(route, 409, {
          title: 'Cannot cancel occurrence with attendance marks.',
          code: 'lesson-attendance-state-conflict',
          recoveryCode: 'edit-attendance-before-cancellation',
        })
        return true
      }

      return false
    })

    await page.goto('/schedule?date=2026-08-20&view=day')
    await page
      .getByTestId('schedule-card-occ-evening')
      .getByRole('button', { name: /Ещё действий/ })
      .click()
    await page
      .getByRole('dialog', { name: /Ещё действий/ })
      .getByRole('button', { name: /Отменить занятие/ })
      .or(page.getByRole('menuitem', { name: /Отменить занятие/ }))
      .click()

    const drawer = page.getByRole('dialog', { name: 'Отменить занятие' })
    await drawer.getByRole('button', { name: 'Получить предпросмотр' }).click()
    await expect(drawer.getByText('Проверьте действие перед подтверждением')).toBeVisible()
    await drawer.getByRole('button', { name: 'Отменить занятие' }).click()

    await expect(drawer.getByText('У занятия уже есть отметки посещаемости.')).toBeVisible()
    await expect(drawer).toContainText('Утренняя база')
    await expect(drawer).toContainText('Отметки есть')
    await expect(drawer.getByText('lesson-attendance-state-conflict')).toHaveCount(0)
    await expect(drawer.getByText('Cannot cancel occurrence with attendance marks.')).toHaveCount(0)
    await expect(drawer.getByRole('button', { name: 'Обновить предпросмотр' })).toBeVisible()
  })

  test('week mode switches to seven-column desktop grid at wide viewport', async ({ page }) => {
    await mockApi(page)
    await page.setViewportSize({ width: 1440, height: 1200 })
    await page.goto('/schedule?date=2026-08-20&view=week')

    const weekView = page.getByTestId('schedule-week-view')
    await expect(weekView).toBeVisible()
    await expect(page.locator('[data-testid^="schedule-day-section-"]')).toHaveCount(7)
    await expect.poll(async () =>
      weekView.evaluate((element) =>
        window.getComputedStyle(element).gridTemplateColumns.split(' ').length,
      ),
    ).toBe(7)
  })

  test('attendance permission restriction remains visible and blocks open', async ({ page }) => {
    await mockApi(page, async ({ pathname, method, route, searchParams }) => {
      if (pathname === '/api/schedule/lessons' && method === 'GET') {
        expect(searchParams.get('from')).toBe('2026-08-20')
        expect(searchParams.get('to')).toBe('2026-08-20')
        await fulfillJson(route, 200, scheduleResponse({
          items: [lesson({
            lessonOccurrenceId: 'occ-evening',
            startTime: '18:00',
            endTime: '18:50',
            hasAttendanceMarks: true,
            allowedActions: buildAllowedActions({
              viewAttendance: { allowed: false, reason: 'attendance-forbidden' },
            }),
          })],
        }))
        return true
      }

      return false
    })

    await page.goto('/schedule?date=2026-08-20&view=day')
    const card = page.getByTestId('schedule-card-occ-evening')

    await expect(card).toBeVisible()
    await expect(card.getByRole('button', { name: 'Посещение' })).toBeDisabled()
    await expect(card).toHaveText(/Посещаемость недоступна для вашей роли или зоны доступа./)
    await expect(card).not.toHaveText(/attendance-forbidden/)
  })

  test('preserves query params through a schedule retry after failure', async ({ page }) => {
    const scheduleCalls: string[] = []
    let allowSuccess = false

    await mockApi(page, async ({ pathname, method, route, searchParams }) => {
      if (pathname === '/api/schedule/lessons' && method === 'GET') {
        scheduleCalls.push(searchParams.toString())

        if (!allowSuccess) {
          await route.fulfill({
            status: 503,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify({ message: 'temporary error' }),
          })
          return true
        }

        await fulfillJson(route, 200, scheduleResponse())
        return true
      }

      return false
    })

    await page.goto('/schedule?date=2026-08-20&view=week&branchId=branch-1&trainerId=trainer-1')
    await expect(page.getByText('Расписание не загрузилось')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Повторить' })).toBeVisible()
    await expect(page).toHaveURL('/schedule?date=2026-08-20&view=week&branchId=branch-1&trainerId=trainer-1')

    allowSuccess = true
    await page.getByRole('button', { name: 'Повторить' }).click()
    await expect(page.getByTestId('schedule-week-view')).toBeVisible()

    await expect(page).toHaveURL('/schedule?date=2026-08-20&view=week&branchId=branch-1&trainerId=trainer-1')
    expect(scheduleCalls.length).toBeGreaterThanOrEqual(2)
    const firstQuery = new URLSearchParams(scheduleCalls[0])
    const secondQuery = new URLSearchParams(scheduleCalls[1])
    expect(firstQuery.get('from')).toBe('2026-08-17')
    expect(firstQuery.get('to')).toBe('2026-08-23')
    expect(firstQuery.get('branchId')).toBe('branch-1')
    expect(firstQuery.get('trainerId')).toBe('trainer-1')
    expect(secondQuery.get('branchId')).toBe('branch-1')
    expect(secondQuery.get('trainerId')).toBe('trainer-1')
  })

  test('Calendar tools close returns focus to trigger for keyboard users', async ({ page }) => {
    await mockApi(page)
    await page.goto('/schedule?date=2026-08-20&view=day')

    const toolsButton = page.getByRole('button', { name: 'Параметры календаря' })
    await toolsButton.click()
    const drawer = page.getByRole('dialog', { name: 'Параметры календаря' })

    await expect(drawer).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(toolsButton).toBeFocused()
  })

  test('schedule avoids horizontal overflow across mobile and compact-height targets', async ({ page }) => {
    await mockApi(page)

    for (const viewport of [
      { width: 360, height: 780 },
      { width: 390, height: 844 },
      { width: 420, height: 912 },
      { width: 440, height: 956 },
      { width: 912, height: 420 },
      { width: 956, height: 440 },
      { width: 768, height: 1024 },
      { width: 1440, height: 1200 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/schedule?date=2026-08-20&view=week')
      await expect(page.getByTestId('schedule-screen')).toBeVisible()

      const dimensions = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }))
      expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1)
    }
  })

  test('dense day groups parallel intervals, keeps cards task-first and restores attendance context', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockApi(page, async ({ pathname, method, route }) => {
      if (pathname === '/api/schedule/lessons' && method === 'GET') {
        await fulfillJson(route, 200, scheduleResponse({ items: denseDayLessons() }))
        return true
      }

      if (pathname === '/api/attendance/lessons/dense-parallel-a/clients' && method === 'GET') {
        await fulfillJson(route, 200, rosterResponse({ canEdit: true }))
        return true
      }

      return false
    })

    await page.goto('/schedule?date=2026-08-20&view=day')
    await expect(page.getByTestId('schedule-screen')).toBeVisible()

    // Exact interval grouping: three parallel occurrences share one heading.
    const parallelGroup = page.getByTestId('schedule-time-group-2026-08-20-10:00-10:50')
    await expect(parallelGroup).toBeVisible()
    for (const occurrenceId of ['dense-parallel-a', 'dense-parallel-b', 'dense-parallel-c']) {
      await expect(parallelGroup.getByTestId(`schedule-card-${occurrenceId}`)).toBeVisible()
    }
    await expect(page.getByTestId('schedule-time-group-2026-08-20-10:00-11:00')).toBeVisible()

    // Task-first row: attendance remains visible while edit moves into mobile `Ещё`.
    const primaryCard = page.getByTestId('schedule-card-dense-parallel-a')
    await expect(primaryCard.getByRole('button', { name: /Открыть занятие/ })).toBeVisible()
    await expect(primaryCard.getByRole('button', { name: 'Посещение' })).toBeVisible()
    await expect(primaryCard.getByRole('button', { name: /Изменить занятие/ })).toHaveCount(0)
    await expect(primaryCard.getByRole('button', { name: /Ещё действий/ })).toBeVisible()
    const visiblePrimaryCardActions = await primaryCard
      .locator('.schedule-occurrence-card__actions button:visible')
      .count()
    expect(visiblePrimaryCardActions).toBeLessThanOrEqual(2)
    await expect(primaryCard.getByRole('button', { name: /Перенести занятие/ })).toHaveCount(0)
    await expect(primaryCard.getByRole('button', { name: /Отменить занятие/ })).toHaveCount(0)

    // Neutral attendance badge is exhaustive and response-driven.
    await expect(primaryCard.getByText('Без отметок')).toBeVisible()
    await expect(page.getByTestId('schedule-card-dense-morning-marks').getByText('Отметки есть')).toBeVisible()

    // Restricted attendance keeps the backend reason attached to the disabled control.
    const restrictedCard = page.getByTestId('schedule-card-dense-parallel-b')
    await expect(restrictedCard.getByRole('button', { name: 'Посещение' })).toBeDisabled()
    await expect(restrictedCard).toContainText('Посещаемость недоступна для вашей роли или зоны доступа.')
    await expect(restrictedCard.getByRole('button', { name: /Ещё действий/ })).toHaveCount(0)

    // Cancelled card shares the body trigger and hides restore behind `Ещё`.
    const cancelledCard = page.getByTestId('schedule-card-dense-parallel-c')
    await expect(cancelledCard.getByRole('button', { name: /Открыть занятие/ })).toBeVisible()
    await expect(cancelledCard.getByRole('button', { name: 'Подробнее' })).toHaveCount(0)
    await expect(cancelledCard.getByRole('button', { name: /Отменить занятие/ })).toHaveCount(0)

    // Deferred surface exposes occurrence context and ordered actions; explicit close returns focus.
    await primaryCard.getByRole('button', { name: /Ещё действий/ }).click()
    const moreDrawer = page.getByRole('dialog', { name: /Ещё действий/ })
    await expect(moreDrawer).toBeVisible()
    await expect(moreDrawer).toContainText('Плавание для дошкольников средней группы с инструктором')
    await expect(moreDrawer).toContainText('10:00-10:50')
    const deferredButtons = moreDrawer.locator('.schedule-more-drawer__action')
    await expect(deferredButtons).toHaveCount(5)
    await expect(deferredButtons.nth(0)).toContainText('Изменить')
    await expect(deferredButtons.nth(4)).toContainText('Отменить')
    await moreDrawer.getByRole('button', { name: 'Закрыть дополнительные действия' }).click()
    await expect(moreDrawer).toBeHidden()
    await expect(primaryCard.getByRole('button', { name: /Ещё действий/ })).toBeFocused()

    // Primary flow: attendance opens from the dense card and back restores the exact list URL and card.
    await primaryCard.getByRole('button', { name: 'Посещение' }).click()
    await expect(page).toHaveURL(/\/attendance\/dense-parallel-a\?lessonDate=2026-08-20$/)
    await page.goBack()
    await expect(page).toHaveURL('/schedule?date=2026-08-20&view=day')
    await expect(page.getByTestId('schedule-card-dense-parallel-a')).toBeVisible()

    // Geometry at the mobile stress baseline: readable date and navigation labels, no overflow.
    const dimensions = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      viewport: document.documentElement.clientWidth,
      labels: [...document.querySelectorAll('.mobile-bottom-nav__label')].map((label) => ({
        scrollWidth: label.scrollWidth,
        clientWidth: label.clientWidth,
        text: label.textContent,
      })),
    }))
    expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1)
    expect(dimensions.labels.length).toBeGreaterThanOrEqual(5)
    for (const label of dimensions.labels) {
      expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth + 1)
    }
  })

  test('mobile density keeps the required complete rows and following interval heading above navigation', async ({ page }) => {
    await mockApi(page, async ({ pathname, method, route }) => {
      if (pathname === '/api/schedule/lessons' && method === 'GET') {
        await fulfillJson(route, 200, scheduleResponse({ items: denseDayLessons() }))
        return true
      }

      return false
    })

    for (const target of [
      { width: 390, height: 844, minimumRows: 3 },
      { width: 420, height: 912, minimumRows: 4 },
      { width: 440, height: 956, minimumRows: 4 },
    ]) {
      await page.setViewportSize(target)
      await page.goto('/schedule?date=2026-08-20&view=day')
      await expect(page.getByTestId('schedule-card-dense-morning-marks')).toBeVisible()

      const geometry = await page.evaluate(() => {
        const navigationTop = document.querySelector('.mobile-bottom-nav')?.getBoundingClientRect().top
          ?? window.innerHeight
        const fullyVisibleRows = [...document.querySelectorAll<HTMLElement>('.schedule-occurrence-card')]
          .filter((row) => {
            const rect = row.getBoundingClientRect()
            return rect.top >= 0 && rect.bottom <= navigationTop
          })
        const visibleHeadings = [...document.querySelectorAll<HTMLElement>('.schedule-time-group__heading')]
          .filter((heading) => {
            const rect = heading.getBoundingClientRect()
            return rect.top >= 0 && rect.bottom <= navigationTop
          })

        return {
          fullyVisibleRows: fullyVisibleRows.length,
          visibleHeadings: visibleHeadings.length,
          bodyWidth: document.body.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        }
      })

      expect(geometry.fullyVisibleRows).toBeGreaterThanOrEqual(target.minimumRows)
      expect(geometry.visibleHeadings).toBeGreaterThanOrEqual(2)
      expect(geometry.bodyWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1)
    }

    await page.setViewportSize({ width: 420, height: 912 })
    await page.goto('/schedule?date=2026-08-20&view=day')
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%'
    })
    await expect(page.getByTestId('schedule-card-dense-morning-marks')).toBeVisible()
    const zoomed = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      locationVisible: Boolean(document.querySelector('[data-testid="schedule-location"]')?.getClientRects().length),
      trainersVisible: Boolean(document.querySelector('[data-testid="schedule-trainers"]')?.getClientRects().length),
    }))
    expect(zoomed.bodyWidth).toBeLessThanOrEqual(zoomed.viewportWidth + 1)
    expect(zoomed.locationVisible).toBe(true)
    expect(zoomed.trainersVisible).toBe(true)
  })
})

async function mockApi(
  page: Page,
  handler: (context: {
    method: string
    pathname: string
    route: Route
    searchParams: URLSearchParams
  }) => boolean | Promise<boolean | void> | void = () => false,
) {
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const context = {
      method: request.method(),
      pathname: url.pathname,
      route,
      searchParams: url.searchParams,
    }

    if (!context.pathname.startsWith('/api/')) {
      await route.fallback()
      return
    }

    const handled = await handler(context)
    if (handled) return

    if (context.pathname === '/api/config' && context.method === 'GET') {
      await fulfillJson(route, 200, APP_CONFIG)
      return
    }

    if (context.pathname === '/api/auth/session' && context.method === 'GET') {
      await fulfillJson(route, 200, session)
      return
    }

    if (context.pathname === '/api/schedule/lessons' && context.method === 'GET') {
      await fulfillJson(route, 200, scheduleResponse())
      return
    }

    throw new Error(`Unexpected API request in occurrence schedule e2e: ${context.method} ${context.pathname}`)
  })
}

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function expectTouchTargetAtLeast(locator: Locator, minSize: number) {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThanOrEqual(minSize)
  expect(box!.height).toBeGreaterThanOrEqual(minSize)
}

function scheduleResponse(overrides: {
  items?: ReturnType<typeof lesson>[]
  from?: string
  to?: string
  capabilities?: { createOneOff: { allowed: boolean; reason: string | null } }
  filterOptions?: {
    branches: Array<{ id: string; name: string }>
    halls: Array<{ id: string; name: string }>
    trainers: Array<{ id: string; name: string }>
    groups: Array<{ id: string; name: string }>
    groupTypes: Array<{ id: string; name: string }>
  }
} = {}) {
  return {
    from: overrides.from ?? '2026-08-20',
    to: overrides.to ?? '2026-08-20',
    capabilities: overrides.capabilities ?? {
      createOneOff: { allowed: true, reason: null },
    },
    filterOptions: overrides.filterOptions ?? {
      branches: [{ id: 'branch-1', name: 'Центр' }],
      halls: [{ id: 'hall-1', name: 'Основной зал' }],
      trainers: [{ id: 'trainer-1', name: 'Алиса' }],
      groups: [{ id: 'group-1', name: 'Утренняя база' }],
      groupTypes: [{ id: 'type-1', name: 'Кардио' }],
    },
    items: overrides.items ?? [
      lesson({
        lessonOccurrenceId: 'occ-morning',
        startTime: '08:00',
        endTime: '08:50',
      }),
      lesson({
        lessonOccurrenceId: 'occ-evening',
        startTime: '18:00',
        endTime: '18:50',
        hasAttendanceMarks: true,
      }),
    ],
  }
}

function lesson(overrides: Record<string, unknown>) {
  return {
    lessonOccurrenceId: 'occ-morning',
    sourceKind: 'Recurring',
    isMaterialized: false,
    lessonSeriesId: 'series-1',
    lessonDate: '2026-08-20',
    startTime: '08:00',
    durationMinutes: 50,
    endTime: '08:50',
    groupId: 'group-1',
    groupName: 'Утренняя база',
    groupTypeId: 'type-1',
    groupTypeName: 'Кардио',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Основной зал',
    effectiveTrainers: [{
      trainerId: 'trainer-1',
      fullName: 'Алиса',
      kind: 'Permanent',
      replacedTrainerId: null,
      substitutionId: null,
    }],
    status: 'Scheduled',
    hasAttendanceMarks: false,
    allowedActions: buildAllowedActions(),
    revision: 'revision-1',
    ...overrides,
  }
}

function denseDayLessons() {
  const filler = (index: number, startTime: string, endTime: string) => lesson({
    lessonOccurrenceId: `dense-filler-${index}`,
    groupName: `Группа ${index}`,
    startTime,
    endTime,
    durationMinutes: 50,
    hasAttendanceMarks: index % 2 === 0,
  })

  return [
    lesson({
      lessonOccurrenceId: 'dense-morning-marks',
      groupName: 'Утренняя йога',
      startTime: '08:00',
      endTime: '08:50',
      hasAttendanceMarks: true,
    }),
    lesson({
      lessonOccurrenceId: 'dense-morning-parallel',
      groupName: 'Утренняя силовая подготовка для начинающих спортсменов',
      startTime: '08:00',
      endTime: '08:50',
      hallId: 'hall-2',
      hallName: 'Второй зал',
    }),
    lesson({
      lessonOccurrenceId: 'dense-parallel-a',
      groupName: 'Плавание для дошкольников средней группы с инструктором',
      startTime: '10:00',
      endTime: '10:50',
      hasAttendanceMarks: false,
      allowedActions: buildAllowedActions({
        edit: { allowed: true, reason: null },
        move: { allowed: true, reason: null },
        assignTrainerSubstitution: { allowed: true, reason: null },
        cancel: { allowed: true, reason: null },
      }),
    }),
    lesson({
      lessonOccurrenceId: 'dense-parallel-b',
      groupName: 'Растяжка',
      startTime: '10:00',
      endTime: '10:50',
      hallId: 'hall-2',
      hallName: 'Второй зал',
      allowedActions: buildAllowedActions({
        viewAttendance: { allowed: false, reason: 'attendance-forbidden' },
      }),
    }),
    lesson({
      lessonOccurrenceId: 'dense-parallel-c',
      groupName: 'Бокс',
      startTime: '10:00',
      endTime: '10:50',
      hallId: 'hall-3',
      hallName: 'Третий зал',
      status: 'Cancelled',
      effectiveTrainers: [
        {
          trainerId: 'trainer-1',
          fullName: 'Алиса',
          kind: 'Permanent',
          replacedTrainerId: null,
          substitutionId: null,
        },
        {
          trainerId: 'trainer-2',
          fullName: 'Борис',
          kind: 'Substitute',
          replacedTrainerId: 'trainer-1',
          substitutionId: 'substitution-1',
        },
      ],
      allowedActions: buildAllowedActions({
        viewAttendance: { allowed: false, reason: 'lesson-cancelled' },
        restore: { allowed: true, reason: null },
      }),
    }),
    lesson({
      lessonOccurrenceId: 'dense-long-interval',
      groupName: 'Персональная тренировка',
      startTime: '10:00',
      endTime: '11:00',
      durationMinutes: 60,
    }),
    filler(1, '11:00', '11:50'),
    filler(2, '12:00', '12:50'),
    filler(3, '13:00', '13:50'),
    filler(4, '14:00', '14:50'),
    filler(5, '15:00', '15:50'),
    filler(6, '16:00', '16:50'),
    filler(7, '17:00', '17:50'),
    filler(8, '18:00', '18:50'),
    filler(9, '19:00', '19:50'),
  ]
}

function seriesResponse() {
  return {
    seriesId: 'series-1',
    groupId: 'group-1',
    groupName: 'Утренняя база',
    businessDate: '2026-08-20',
    startsOn: '2026-08-01',
    endsOn: null,
    revision: 'series-revision-1',
    currentVersion: {
      versionNumber: 1,
      effectiveFrom: '2026-08-01',
      effectiveTo: null,
      thisAndFutureMinEffectiveFrom: '2026-08-20',
      entireSeriesEffectiveFrom: '2026-08-01',
      slots: [{
        isoWeekday: 1,
        startTime: '08:00',
        durationMinutes: 50,
        hallId: 'hall-1',
        hallName: 'Основной зал',
      }],
    },
  }
}

function seriesPreviewResponse() {
  return {
    confirmationToken: 'series-token',
    expiresAt: '2026-08-20T09:15:00Z',
    revision: 'series-revision-1',
    scope: 'ThisAndFuture',
    effectiveFrom: '2026-08-20',
    endsOn: null,
    slots: [{
      isoWeekday: 1,
      startTime: '09:00',
      durationMinutes: 50,
      hallId: 'hall-1',
      hallName: 'Основной зал',
    }],
    impact: {
      totalAffectedOccurrences: 3,
      examples: [{
        lessonOccurrenceId: 'occ-morning',
        lessonDate: '2026-08-20',
        startTime: '09:00',
        hallId: 'hall-1',
        hallName: 'Основной зал',
      }],
      skipped: [],
    },
    warnings: [],
  }
}

function buildAllowedActions(overrides: Partial<{
  viewAttendance: { allowed: boolean; reason: string | null }
  editAttendance: { allowed: boolean; reason: string | null }
  edit: { allowed: boolean; reason: string | null }
  move: { allowed: boolean; reason: string | null }
  cancel: { allowed: boolean; reason: string | null }
  restore: { allowed: boolean; reason: string | null }
  assignTrainerSubstitution: { allowed: boolean; reason: string | null }
  cancelTrainerSubstitution: { allowed: boolean; reason: string | null }
}> = {}) {
  return {
    viewAttendance: overrides.viewAttendance ?? { allowed: true, reason: null },
    editAttendance: overrides.editAttendance ?? { allowed: true, reason: null },
    edit: overrides.edit ?? { allowed: false, reason: 'not-wired' },
    move: overrides.move ?? { allowed: false, reason: 'not-wired' },
    cancel: overrides.cancel ?? { allowed: false, reason: 'not-wired' },
    restore: overrides.restore ?? { allowed: false, reason: 'not-cancelled' },
    assignTrainerSubstitution: overrides.assignTrainerSubstitution ?? { allowed: false, reason: 'not-wired' },
    cancelTrainerSubstitution: overrides.cancelTrainerSubstitution ?? { allowed: false, reason: 'no-substitution' },
  }
}

function rosterResponse({ canEdit }: { canEdit: boolean }) {
  return {
    groupId: 'group-1',
    trainingDate: '2026-08-20',
    lessonOccurrenceId: 'occ-evening',
    lessonDate: '2026-08-20',
    canEditAttendance: { allowed: canEdit, reason: canEdit ? null : 'future-lesson' },
    today: '2026-08-20',
    maxTrainingDate: '2026-08-20',
    clients: [{
      clientId: 'client-1',
      fullName: 'Иван Иванов',
      state: 'Unmarked',
      hasActiveMembership: true,
      isProfessional: false,
    }],
  }
}
