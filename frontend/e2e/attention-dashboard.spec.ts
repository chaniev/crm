import { expect, test, type Locator, type Page } from '@playwright/test'
import { attentionCard, fulfillJson, HEAD_COACH_SESSION, membershipReason, mockAttentionApi } from './support/attention'

test.describe('Attention dashboard', () => {
  test('TASK-181 section links support native tabs and browser history', async ({ page, context }) => {
    await mockAttentionApi(context, { attentionItems: [] })
    await context.route('**/api/attendance/lessons/today', route =>
      fulfillJson(route, 200, { today: '2026-07-12', items: [] }))
    await page.goto('/attention')

    const nav = page.getByRole('navigation', { name: 'Основная навигация' })
    const attendance = nav.getByRole('link', { name: 'Посещения' })
    await expect(attendance).toHaveAttribute('href', '/attendance')
    await expect(nav.getByRole('link', { name: 'Тренеры' })).toHaveAttribute('href', '/coaches')
    const popupEvent = context.waitForEvent('page')
    await attendance.click({ button: 'middle' })
    const popup = await popupEvent
    await expect(popup).toHaveURL('/attendance')
    await expect(popup.getByTestId('attendance-screen')).toBeVisible()
    await popup.close()
    await expect(page).toHaveURL('/attention')

    const documentRequests: string[] = []
    page.on('request', request => {
      if (request.isNavigationRequest()) documentRequests.push(request.url())
    })
    await attendance.focus()
    await page.keyboard.press('Enter')
    await expect(attendance).toHaveAttribute('aria-current', 'page')
    await expect(page).toHaveURL('/attendance')
    await page.goBack()
    await expect(nav.getByRole('link', { name: 'Внимание' })).toHaveAttribute('aria-current', 'page')
    await page.goForward()
    await expect(attendance).toHaveAttribute('aria-current', 'page')
    expect(documentRequests).toEqual([])
  })

  test('renders Attention shell without former dashboard tabs or attendance workbench', async ({ page }) => {
    let attendanceGroupsCalls = 0
    await mockAttentionApi(page, {
      attentionItems: [],
      async onAttendanceGroups(route) {
        attendanceGroupsCalls += 1
        await fulfillJson(route, 200, {
          groups: [],
          today: '2026-07-12',
          maxTrainingDate: '2026-07-12',
        })
      },
    })

    await page.goto('/attention')

    const shellHeader = page.getByRole('banner')
    const shellNavigation = page.getByRole('navigation', { name: 'Основная навигация' })

    await expect(page.getByTestId('attention-screen')).toBeVisible()
    await expect(shellHeader).toBeVisible()
    await expect(shellHeader.getByText('Iron Club')).toBeVisible()
    await expect(shellNavigation).toBeVisible()
    await expect(shellNavigation.getByRole('link', { name: 'Внимание' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(shellNavigation.getByRole('link', { name: 'Посещения' })).toBeVisible()
    await expect(page.getByRole('main', { name: 'Внимание' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Внимание' })).toHaveClass(/visually-hidden/)
    await expect(page.getByRole('heading', { name: 'Требуют внимания' })).toHaveCount(0)
    await expect(page.getByRole('tablist')).toHaveCount(0)
    await expect(page.getByTestId('attendance-screen')).toHaveCount(0)
    await expect.poll(() => attendanceGroupsCalls).toBe(0)
    await expect(page.getByText('Никому не требуется внимание')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('keeps mobile navigation priority and no overflow on management primary routes', async ({ page }) => {
    await mockAttentionApi(page, { attentionItems: [] })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/attention')

    const sideNavigation = page.locator(
      'nav.app-shell__side-nav[aria-label="Основная навигация"]',
    )
    const bottomNavigation = page.getByRole('navigation', {
      name: 'Мобильная навигация',
    })

    await expect(sideNavigation).toBeHidden()
    await expect(bottomNavigation).toBeVisible()
    await expect(bottomNavigation.getByRole('link', { name: 'Посещения' })).toBeVisible()
    await expect(bottomNavigation.getByRole('link', { name: 'Внимание' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(bottomNavigation.getByRole('link', { name: 'Расписание' })).toBeVisible()
    await expect(bottomNavigation.getByRole('link', { name: 'Клиенты' })).toBeVisible()
    await expect(
      bottomNavigation.getByRole('button', { name: 'Ещё, открыть остальные разделы' }),
    ).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('renders loading, error, retry and data states', async ({ page }) => {
    let shouldFail = true
    let continueInitialLoad: (() => void) | null = null

    await mockAttentionApi(page, {
      async onAttentionItems(route) {
        await new Promise<void>((resolve) => {
          continueInitialLoad = resolve
        })

        if (shouldFail) {
          await fulfillJson(route, 500, { title: 'CRM API временно недоступен' })
          return
        }

        await fulfillJson(route, 200, [attentionCard()])
      },
    })

    await page.goto('/attention')

    await expect(page.getByText('Загружаем клиентов...')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Обновить', exact: true })).toBeDisabled()

    continueInitialLoad?.()
    await expect(page.getByText('Список не загрузился')).toBeVisible()
    await expect(page.getByText(/CRM API временно недоступен/)).toBeVisible()

    shouldFail = false
    continueInitialLoad = null
    await page.getByRole('button', { name: 'Повторить' }).click()
    continueInitialLoad?.()

    await expect(page.getByTestId('attention-list')).toBeVisible()
    await expect(page.getByTestId('attention-client-card-client-1')).toBeVisible()
    await expect(page.getByText('Иван Иванов')).toBeVisible()
    await expect(page.getByText('Пропущено подряд: 4')).toBeVisible()
    await expect(page.getByText('Осталось 1 день')).toBeVisible()
    await expect(page.getByText('Требует оплаты')).toHaveCount(0)
  })

  test('preserves attention action recovery on a narrow screen', async ({ page }) => {
    const second = {
      ...membershipReason(2),
      membershipName: 'Вечерний курс дзюдо',
      targetGroups: [{ groupId: 'group-2', groupName: 'Дзюдо', branchName: 'Север' }],
      expirationDate: '2026-07-22',
      daysUntilExpiration: 2,
    }
    let card = attentionCard()
    card.reasons.push(second)
    let calls = 0
    await mockAttentionApi(page, { onAttentionItems: route => fulfillJson(route, 200, [card]) })
    await page.route('**/clients/client-1/attention/missed-training/contacted', async (route) => {
      calls += 1
      if (calls === 1) {
        await fulfillJson(route, 500, { title: 'Временная ошибка' })
        return
      }

      card = { ...card, reasons: card.reasons.filter(reason => reason.type !== 'missedTraining') }
      await fulfillJson(route, 200, card)
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/attention')

    await expect(page.getByRole('heading', { name: 'Список клиентов' })).toHaveClass(
      /visually-hidden/,
    )
    await expect(page.getByTestId('attention-list')).toHaveAttribute(
      'aria-labelledby',
      'attention-list-title',
    )
    const row = page.getByRole('list', { name: 'Список клиентов' }).getByRole('listitem')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('Месяц')
    await expect(row).toContainText('Вечерний курс дзюдо')
    await expect(row).toContainText('Дзюдо')
    await expect(row).toContainText('Север')
    await expectTextInsideCard(row)
    await expect(page.getByText('4 пропуска подряд')).toBeVisible()
    await expect(page.getByRole('link', { name: /Позвонить/ })).toHaveAttribute('href', 'tel:+79990000001')
    const actionMenu = page.getByRole('button', { name: 'Другие действия для Иван Иванов' })
    await actionMenu.click()
    await expect(page.getByRole('menuitem', { name: /Открыть Telegram/ })).toHaveAttribute(
      'target',
      '_blank',
    )
    await page.keyboard.press('Escape')
    await expect(actionMenu).toBeFocused()

    const action = page.getByRole('button', { name: 'Связались с Иван Иванов' })
    await action.click()
    await expect(page.getByText(/Временная ошибка/)).toBeVisible()
    await expect(page.getByText('4 пропуска подряд')).toBeVisible()

    await action.click()
    await expect(page.getByText('4 пропуска подряд')).toBeHidden()
    await expect(row).toContainText('Абонемент истекает через 1 день')
    await expect(row).toContainText('Абонемент истекает через 2 дня')
    await expect(row).toContainText('Месяц')
    await expect(row).toContainText('Вечерний курс дзюдо')
    expect(calls).toBe(2)
    await expectNoHorizontalScroll(page)
  })

  test('denies the attention list when the session excludes the section', async ({ page }) => {
    let listRequests = 0
    await mockAttentionApi(page, {
      async onAttentionItems(route) {
        listRequests++
        await fulfillJson(route, 200, [])
      },
    })
    await page.route('**/auth/session', route => fulfillJson(route, 200, {
      ...HEAD_COACH_SESSION, user: {
        ...HEAD_COACH_SESSION.user, role: 'Coach', allowedSections: ['Attendance'], landingScreen: 'Attendance',
      },
    }))
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/attention')
    await expect(page.getByRole('heading', { name: 'Нет доступа' })).toBeFocused()
    await expect(page.getByTestId('attention-list')).toHaveCount(0)
    expect(listRequests).toBe(0)
  })

  test('long records reflow at 200% text size and keep keyboard actions reachable', async ({ page }) => {
    const items = prototypeClients(true)
    items[0].reasons[0].targetGroups.push({ groupId: 'group-2', groupName: 'Дзюдо', branchName: 'Север' })
    items[0].notes += ' ' + 'ДлинныйКомментарий'.repeat(12)
    await mockAttentionApi(page, { attentionItems: items })
    await page.setViewportSize({ width: 360, height: 780 })
    await page.goto('/attention')
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
    const row = page.getByRole('listitem').first()
    await expect(row).toContainText(items[0].notes)
    await expect(row).toContainText('1. Самбо · отчётность · 2. Дзюдо')
    await expectTextInsideCard(row)
    await expectSpacedActions(row)
    const phone = row.getByRole('link', { name: /Позвонить/ })
    await phone.focus()
    await page.keyboard.press('Tab')
    await expect(row.getByRole('button', { name: /Связались/ })).toBeFocused()
    await page.keyboard.press('Tab')
    const more = row.getByRole('button', { name: /Другие действия/ })
    await expect(more).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem', { name: /Открыть карточку/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(more).toBeFocused()
    await expectNoHorizontalScroll(page)
  })

  for (const long of [false, true]) {
    for (const [width, height, ordinaryRows, longRows] of [
      [360, 780, 4, 3], [390, 844, 4, 3], [420, 912, 5, 4], [440, 956, 5, 5],
    ]) {
      test(`variant A at ${width}px with ${long ? 'long' : 'ordinary'} records`, async ({ page }, testInfo) => {
        const items = prototypeClients(long)
        await mockAttentionApi(page, { attentionItems: items })
        await page.setViewportSize({ width, height })
        await page.goto('/attention')
        const cards = page.getByRole('list', { name: 'Список клиентов' }).getByRole('listitem')
        await expect(cards).toHaveCount(7)
        await page.evaluate(() => document.fonts.ready)
        await expect(page.locator('.attention-controls-row, .attention-list-status')).toHaveCount(2)
        await expect(page.getByLabel('Всего клиентов: 7')).toBeVisible()
        await expect(page.getByLabel('Просроченных абонементов: 4')).toBeVisible()

        const first = cards.first()
        for (const i of [0, 1]) {
          const name = cards.nth(i).getByText(items[i].fullName, { exact: true })
          await expect(name).toBeVisible()
          expect(await name.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
        }
        const call = first.getByRole('link', { name: /Позвонить/ })
        await expect(call).toHaveText(items[0].phone!)
        await expect(call).toHaveAttribute('href', `tel:${items[0].phone}`)
        await expect(first.locator('.attention-client-row__reasons').locator(':scope > *'))
          .toHaveText(['Абонемент истёк 58 дней назад', '3 пропуска подряд'])
        await expect(cards.nth(2).getByRole('link', { name: /Telegram/ })).toBeVisible()
        await expect(cards.nth(2).locator('a[href^="tel:"]')).toHaveCount(0)
        for (const [i, card] of (await cards.all()).entries()) {
          await expect(card).toContainText(items[i].notes)
          await expect(card).toContainText(items[i].reasons[0].targetGroups[0].groupName)
          await expect(card).toContainText(items[i].reasons[0].targetGroups[0].branchName)
          await expectTextInsideCard(card)
          await expectSpacedActions(card)
        }

        const nav = page.getByRole('navigation', { name: 'Мобильная навигация' })
        const bottom = (await nav.boundingBox())!.y
        const count = await cards.evaluateAll((rows, limit) => rows.filter(row => {
          const box = row.getBoundingClientRect()
          return box.top >= 0 && box.bottom <= limit
        }).length, bottom)
        expect(count).toBeGreaterThanOrEqual(long ? longRows : ordinaryRows)
        await expectNoHorizontalScroll(page)
        await page.screenshot({ path: testInfo.outputPath(`list-${width}-${long ? 'long' : 'ordinary'}.png`) })
      })
    }
  }

})

function prototypeClients(long: boolean) {
  const names = [
    long ? 'Алексеев-Константинов Александр Константинович' : 'Алексеев Александр Сергеевич',
    long ? 'Алексеев-Константинов Алексей Константинович' : 'Алексеев Алексей Сергеевич',
    'Васильева Марина Игоревна', 'Иванов Павел Андреевич', 'Кузнецова Анна Олеговна',
    'Мельникова-Соколова Александра Константиновна', 'Петров Дмитрий Иванович',
  ]
  const notes = [long ? 'На этой неделе удобно разговаривать только после вечерней тренировки.' : 'Звонить после 18:00',
    'Уточнить продление', 'Удобнее в Telegram', 'Звонить утром', 'Звонить днём', 'Уточнить продление', 'Позвонить вечером']
  return names.map((fullName, index) => {
    const item = attentionCard(index + 1)
    const days = [-58, -8, -3, -1, 1, 2, 3][index]
    const groupName = [2, 4].includes(index) ? 'Бокс' : 'Самбо'
    const branchName = [1, 4].includes(index) ? 'Север' : 'Центр'
    const term = {
      ...membershipReason(index + 1),
      type: days < 0 ? 'expiredMembership' : 'expiringMembership',
      daysUntilExpiration: days,
      targetGroups: [{ groupId: 'group-1', groupName, branchName }],
    }
    return {
      ...item,
      fullName,
      notes: notes[index],
      phone: index === 2 ? null : `+7 900 000-00-0${index + 1}`,
      reasons: [term, ...(index === 0 ? [{ type: 'missedTraining', missedCount: 3 }] : [])] as const,
    }
  })
}

async function expectTextInsideCard(card: Locator) {
  const clipped = await card.evaluate(row => {
    const bounds = row.getBoundingClientRect()
    const content = row.querySelector('.attention-client-row__content')!
    for (const el of content.querySelectorAll('*')) {
      if (el.clientWidth && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') {
        return el.textContent
      }
    }
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const range = document.createRange()
      range.selectNodeContents(walker.currentNode)
      for (const rect of range.getClientRects()) {
        if (rect.left < bounds.left || rect.right > bounds.right) return walker.currentNode.textContent
      }
    }
    return null
  })
  expect(clipped).toBeNull()
}

async function expectSpacedActions(card: Locator) {
  const bounds = await card.locator('button:visible, a:visible').evaluateAll(actions =>
    actions.map(action => action.getBoundingClientRect().toJSON()))
  for (const [i, box] of bounds.entries()) {
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    for (const next of bounds.slice(i + 1)) {
      expect(Math.max(next.left - box.right, box.left - next.right, next.top - box.bottom, box.top - next.bottom))
        .toBeGreaterThanOrEqual(8)
    }
  }
}

async function expectNoHorizontalScroll(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement
    return root.scrollWidth - root.clientWidth
  })).toBeLessThanOrEqual(1)
}
