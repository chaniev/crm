import { expect, test, type Page, type Route } from '@playwright/test'

const session = {
  isAuthenticated: true,
  csrfToken: 'task-077-csrf',
  bootstrapMode: false,
  user: {
    id: 'head-coach-1',
    fullName: 'Главный тренер',
    login: 'head-coach',
    role: 'HeadCoach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Clients',
    allowedSections: ['Home', 'Clients'],
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
    branchId: null,
  },
} as const

const catalogItem = {
  id: 'catalog-1',
  branchId: 'branch-1',
  name: 'Месяц',
  price: 3000,
  behaviorKind: 'Term',
  availableFrom: '2026-01-01',
  availableTo: null,
  isSystemOwned: false,
} as const

test.describe('TASK-077 membership sale pricing', () => {
  test('purchase starts unselected and exposes three explicit modes on desktop and mobile', async ({ page }) => {
    await mockMembershipPricingApi(page, buildClient())

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 320, height: 844 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/clients/client-1')
      await page.getByRole('button', { name: 'Новый абонемент' }).click()

      await expect(page.getByRole('radio', { name: 'По каталожной цене' })).not.toBeChecked()
      await expect(page.getByRole('radio', { name: 'Индивидуальная сумма' })).not.toBeChecked()
      await expect(page.getByRole('radio', { name: 'Без варианта каталога' })).not.toBeChecked()
      await expect(page.getByLabel('Дата оплаты')).toHaveValue('2026-07-23')
      await expect(page.getByLabel('Дата оплаты')).toHaveAttribute('max', '2026-07-23')
      await expect(page.getByRole('combobox', { name: 'Статус оплаты' })).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    }
  })

  test('renewal requires a new pricing choice and keeps previous pricing as context only', async ({ page }) => {
    await mockMembershipPricingApi(
      page,
      buildClient({
        behaviorKind: 'Term',
        pricingMode: 'CatalogOverride',
        grossAmount: 4100,
        catalogPrice: 3000,
      }),
    )

    await page.goto('/clients/client-1')
    await page.getByRole('button', { name: 'Продлить' }).click()

    await expect(page.getByRole('radio', { name: 'По каталожной цене' })).not.toBeChecked()
    await expect(page.getByRole('radio', { name: 'Индивидуальная сумма' })).not.toBeChecked()
    await expect(page.getByRole('radio', { name: 'Без варианта каталога' })).not.toBeChecked()
    await expect(page.getByText('Предыдущая продажа', { exact: true })).toBeVisible()
    await expect(page.getByText('Месяц • 4 100 ₽', { exact: true })).toBeVisible()
    await expect(page.locator('input[value="4100"]')).toHaveCount(0)
  })

  test('sale-producing transfer exposes the same unselected three-mode choice', async ({ page }) => {
    await mockMembershipPricingApi(page, buildClient())

    await page.goto('/clients/client-1')
    await page.getByRole('button', { name: 'Перевести' }).click()

    const dialog = page.getByRole('dialog', { name: 'Перевод клиента' })
    await expect(dialog.getByRole('radio', { name: 'По каталожной цене' })).not.toBeChecked()
    await expect(dialog.getByRole('radio', { name: 'Индивидуальная сумма' })).not.toBeChecked()
    await expect(dialog.getByRole('radio', { name: 'Без варианта каталога' })).not.toBeChecked()
  })

  test('preserved unused SingleVisit transfer has no new-sale pricing controls', async ({ page }) => {
    let requestBody: Record<string, unknown> | null = null
    let idempotencyKey: string | null = null
    await mockMembershipPricingApi(
      page,
      buildClient({
        behaviorKind: 'SingleVisit',
        expirationDate: null,
        singleVisitUsed: false,
      }),
      async ({ pathname, method, route }) => {
        if (pathname === '/api/clients/client-1/transfer' && method === 'POST') {
          requestBody = route.request().postDataJSON() as Record<string, unknown>
          idempotencyKey = route.request().headers()['idempotency-key'] ?? null
          await fulfillJson(route, buildClient({
            behaviorKind: 'SingleVisit',
            expirationDate: null,
            singleVisitUsed: false,
          }))
          return true
        }
        return false
      },
    )

    await page.goto('/clients/client-1')
    await page.getByRole('button', { name: 'Перевести' }).click()

    const dialog = page.getByRole('dialog', { name: 'Перевод клиента' })
    await expect(dialog.getByText(/перенесено без новой продажи/i)).toBeVisible()
    await expect(dialog.getByText('По каталожной цене')).toHaveCount(0)
    await expect(dialog.getByText('Индивидуальная сумма')).toHaveCount(0)
    await expect(dialog.getByText('Без варианта каталога')).toHaveCount(0)
    await expect(dialog.getByRole('combobox', { name: 'Вариант абонемента' })).toHaveCount(0)
    await expect(dialog.getByRole('spinbutton', { name: 'Фактическая сумма продажи, ₽' })).toHaveCount(0)
    await expect(dialog.getByLabel('Дата оплаты')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Перевести клиента' }).click()
    await expect.poll(() => requestBody).toEqual({
      targetBranchId: 'branch-1',
      targetGroupIds: [],
    })
    expect(requestBody).not.toHaveProperty('paymentDate')
    await expect.poll(() => idempotencyKey).toEqual(expect.any(String))
  })

  test('confirms a Catalog purchase and sends only the exact caller-owned request', async ({ page }) => {
    let requestBody: Record<string, unknown> | null = null
    await mockMembershipPricingApi(page, buildClient(), async ({ pathname, method, route }) => {
      if (pathname === '/api/clients/client-1/membership/purchase' && method === 'POST') {
        requestBody = route.request().postDataJSON() as Record<string, unknown>
        await fulfillJson(route, buildClient())
        return true
      }
      return false
    })

    await page.goto('/clients/client-1')
    await page.getByRole('button', { name: 'Новый абонемент' }).click()
    await page.getByRole('radio', { name: 'По каталожной цене' }).check()
    await selectOption(page, 'Вариант абонемента', /Месяц/)
    await page.getByLabel('Действует с').fill('2026-07-22')
    await page.getByLabel('Действует по').fill('2026-08-20')
    await page.getByLabel('Дата оплаты').fill('2026-07-10')
    await page.getByRole('button', { name: 'Оформить абонемент' }).click()

    const confirmation = page.getByRole('dialog', { name: 'Подтвердить новую продажу?' })
    await expect(confirmation.getByText('По каталожной цене')).toBeVisible()
    await expect(confirmation.getByText('3 000 ₽')).toBeVisible()
    await expect(confirmation.getByText(/10.*июл.*2026|10\.07\.2026/)).toBeVisible()
    await confirmation.getByRole('button', { name: 'Подтвердить продажу' }).click()

    await expect.poll(() => requestBody).toEqual({
      MembershipCatalogItemId: 'catalog-1',
      ValidFrom: '2026-07-22',
      ValidTo: '2026-08-20',
      PaymentDate: '2026-07-10',
    })
    expect(requestBody).not.toHaveProperty('PaymentStatus')
    expect(requestBody).not.toHaveProperty('IsPaid')
  })

  test('confirms a CatalogOverride renewal without inheriting its previous amount', async ({ page }) => {
    let requestBody: Record<string, unknown> | null = null
    const client = buildClient({
      behaviorKind: 'Term',
      pricingMode: 'CatalogOverride',
      grossAmount: 4100,
      catalogPrice: 3000,
    })
    await mockMembershipPricingApi(page, client, async ({ pathname, method, route }) => {
      if (pathname === '/api/clients/client-1/membership/renew' && method === 'POST') {
        requestBody = route.request().postDataJSON() as Record<string, unknown>
        await fulfillJson(route, client)
        return true
      }
      return false
    })

    await page.goto('/clients/client-1')
    await page.getByRole('button', { name: 'Продлить' }).click()
    await expect(page.locator('input[value="4100"]')).toHaveCount(0)
    await page.getByRole('radio', { name: 'Индивидуальная сумма' }).check()
    await selectOption(page, 'Вариант абонемента', /Месяц/)
    await page.getByRole('spinbutton', { name: 'Фактическая сумма продажи, ₽' }).fill('5100')
    await page.getByLabel('Дата оплаты').fill('2026-07-05')
    await page.getByRole('button', { name: 'Продлить абонемент' }).click()

    const confirmation = page.getByRole('dialog', { name: 'Подтвердить новую продажу?' })
    await expect(confirmation.getByText('Индивидуальная сумма')).toBeVisible()
    await expect(confirmation.getByText('5 100 ₽')).toBeVisible()
    await expect(confirmation.getByText(/5.*июл.*2026|05\.07\.2026/)).toBeVisible()
    await confirmation.getByRole('button', { name: 'Подтвердить продажу' }).click()

    await expect.poll(() => requestBody).toEqual({
      MembershipCatalogItemId: 'catalog-1',
      ManualSaleAmount: 5100,
      PaymentDate: '2026-07-05',
    })
    expect(requestBody).not.toHaveProperty('PaymentStatus')
  })

  test('confirms an AmountOnly transfer and sends no stale catalog identity', async ({ page }) => {
    let requestBody: Record<string, unknown> | null = null
    let idempotencyKey: string | null = null
    await mockMembershipPricingApi(page, buildClient(), async ({ pathname, method, route }) => {
      if (pathname === '/api/clients/client-1/transfer' && method === 'POST') {
        requestBody = route.request().postDataJSON() as Record<string, unknown>
        idempotencyKey = route.request().headers()['idempotency-key'] ?? null
        await fulfillJson(route, buildClient())
        return true
      }
      return false
    })

    await page.goto('/clients/client-1')
    await page.getByRole('button', { name: 'Перевести' }).click()
    const transferDialog = page.getByRole('dialog', { name: 'Перевод клиента' })
    await transferDialog.getByRole('radio', { name: 'Без варианта каталога' }).check()
    await transferDialog.getByRole('spinbutton', { name: 'Фактическая сумма продажи, ₽' }).fill('6200')
    await transferDialog.getByLabel('Действует с').fill('2026-07-22')
    await transferDialog.getByLabel('Действует по').fill('2026-08-20')
    await transferDialog.getByLabel('Дата оплаты').fill('2026-07-01')
    await transferDialog.getByRole('button', { name: 'Перевести клиента' }).click()

    const confirmation = page.getByRole('dialog', { name: 'Подтвердить новую продажу?' })
    await expect(confirmation.getByText('Без варианта каталога')).toBeVisible()
    await expect(confirmation.getByText('6 200 ₽')).toBeVisible()
    await expect(confirmation.getByText(/1.*июл.*2026|01\.07\.2026/)).toBeVisible()
    await confirmation.getByRole('button', { name: 'Подтвердить продажу' }).click()

    await expect.poll(() => requestBody).toEqual({
      targetBranchId: 'branch-1',
      targetGroupIds: [],
      membershipCatalogItemId: null,
      manualSaleAmount: 6200,
      validFrom: '2026-07-22',
      validTo: '2026-08-20',
      paymentDate: '2026-07-01',
    })
    await expect.poll(() => idempotencyKey).toEqual(expect.any(String))
    expect(requestBody).not.toHaveProperty('paymentStatus')
  })

  test('keeps the manual draft and server field error visible after a 400 response', async ({ page }) => {
    let requestBody: Record<string, unknown> | null = null
    await mockMembershipPricingApi(page, buildClient(), async ({ pathname, method, route }) => {
      if (pathname === '/api/clients/client-1/membership/purchase' && method === 'POST') {
        requestBody = route.request().postDataJSON() as Record<string, unknown>
        await route.fulfill({
          status: 400,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            title: 'Ошибка проверки данных.',
            errors: {
              ManualSaleAmount: ['Сумма должна быть указана целыми рублями.'],
            },
          }),
        })
        return true
      }
      return false
    })

    await page.goto('/clients/client-1')
    await page.getByRole('button', { name: 'Новый абонемент' }).click()
    await page.getByRole('radio', { name: 'Без варианта каталога' }).check()
    const amount = page.getByRole('spinbutton', { name: 'Фактическая сумма продажи, ₽' })
    await amount.fill('100')
    await page.getByLabel('Действует с').fill('2026-07-22')
    await page.getByLabel('Действует по').fill('2026-08-20')
    await page.getByRole('button', { name: 'Оформить абонемент' }).click()
    await page.getByRole('dialog', { name: 'Подтвердить новую продажу?' })
      .getByRole('button', { name: 'Подтвердить продажу' }).click()

    await expect.poll(() => requestBody).toMatchObject({ ManualSaleAmount: 100 })
    await expect(page.getByText('Сумма должна быть указана целыми рублями.')).toBeVisible()
    await expect(amount).toHaveValue('100')
  })

  test('renders AmountOnly provenance and actual gross amount after reload', async ({ page }) => {
    let client = buildClient()
    await mockMembershipPricingApi(page, () => client, async ({ pathname, method, route }) => {
      if (pathname === '/api/clients/client-1/membership/purchase' && method === 'POST') {
        client = buildClient({
          behaviorKind: 'Term',
          pricingMode: 'AmountOnly',
          grossAmount: 4200,
          catalogPrice: null,
        })
        await fulfillJson(route, client)
        return true
      }
      return false
    })

    await page.goto('/clients/client-1')
    await page.getByRole('button', { name: 'Новый абонемент' }).click()
    await page.getByRole('radio', { name: 'Без варианта каталога' }).check()
    await page.getByRole('spinbutton', { name: 'Фактическая сумма продажи, ₽' }).fill('4200')
    await page.getByLabel('Действует с').fill('2026-07-22')
    await page.getByLabel('Действует по').fill('2026-08-20')
    await page.getByRole('button', { name: 'Оформить абонемент' }).click()
    await page.getByRole('dialog', { name: 'Подтвердить новую продажу?' })
      .getByRole('button', { name: 'Подтвердить продажу' }).click()

    await expect(page.getByText('4 200 ₽').first()).toBeVisible()
    await expect(page.getByText('Без варианта каталога').first()).toBeVisible()
    await page.reload()
    await expect(page.getByText('4 200 ₽').first()).toBeVisible()
    await expect(page.getByText('Без варианта каталога').first()).toBeVisible()
  })
})

test.describe('TASK-078 membership write regressions', () => {
  test('correction sends addressed payment date and keeps ProblemDetails draft', async ({ page }) => {
    let requestBody: Record<string, unknown> | null = null
    let idempotencyKey: string | null = null
    await mockMembershipPricingApi(
      page,
      buildClient({ behaviorKind: 'Term' }),
      async ({ pathname, method, route }) => {
        if (
          pathname === '/api/clients/client-1/membership/correct' &&
          method === 'POST'
        ) {
          requestBody = route.request().postDataJSON() as Record<string, unknown>
          idempotencyKey = route.request().headers()['idempotency-key'] ?? null
          await route.fulfill({
            status: 409,
            contentType: 'application/problem+json',
            body: JSON.stringify({
              detail: 'Срок пересекается с другим абонементом.',
              errors: {
                ValidFrom: ['Начало срока пересекается с другой продажей.'],
                PaymentDate: ['Дата оплаты не может быть позже текущей даты.'],
              },
            }),
          })
          return true
        }
        return false
      },
    )

    await page.goto('/clients/client-1')
    await page.getByRole('button', { name: 'Исправить' }).click()
    await expect(page.getByText('Дата покупки', { exact: true })).toBeVisible()
    await expect(page.getByText(/22.*июн.*2026|22\.06\.2026/).first()).toBeVisible()
    await expect(page.getByRole('switch', { name: 'Оплачен' })).toHaveCount(0)
    await expect(page.getByText('Не оплачен')).toHaveCount(0)

    const validFrom = page.getByLabel('Действует с')
    const validTo = page.getByLabel('Действует по')
    const paymentDate = page.getByLabel('Дата оплаты')
    await expect(paymentDate).toHaveValue('2026-06-22')
    await expect(paymentDate).toHaveAttribute('max', '2026-07-23')
    await validFrom.fill('2026-07-05')
    await validTo.fill('2026-08-04')
    await paymentDate.fill('2026-07-24')
    await page.getByRole('button', { name: 'Сохранить исправление' }).click()

    await expect.poll(() => requestBody).toEqual({
      SaleId: 'sale-1',
      ExpectedMembershipId: 'membership-1',
      ValidFrom: '2026-07-05',
      ValidTo: '2026-08-04',
      PaymentDate: '2026-07-24',
    })
    await expect.poll(() => idempotencyKey).toEqual(expect.any(String))
    await expect(page.getByText('Срок пересекается с другим абонементом.')).toBeVisible()
    await expect(page.getByText('Начало срока пересекается с другой продажей.')).toBeVisible()
    await expect(page.getByText('Дата оплаты не может быть позже текущей даты.')).toBeVisible()
    await expect(validFrom).toHaveValue('2026-07-05')
    await expect(validTo).toHaveValue('2026-08-04')
    await expect(paymentDate).toHaveValue('2026-07-24')
  })

  test('direct overlapping purchase shows stable reason and keeps the draft on desktop and mobile', async ({ page }) => {
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 320, height: 844 },
    ]) {
      let requestBody: Record<string, unknown> | null = null
      await page.unroute('**/*').catch(() => undefined)
      await mockMembershipPricingApi(
        page,
        buildClient({ behaviorKind: 'Term' }),
        async ({ pathname, method, route }) => {
          if (
            pathname === '/api/clients/client-1/membership/purchase' &&
            method === 'POST'
          ) {
            requestBody = route.request().postDataJSON() as Record<string, unknown>
            await route.fulfill({
              status: 409,
              contentType: 'application/problem+json',
              body: JSON.stringify({
                detail: 'Срок пересекается с действующим абонементом.',
                errors: {
                  membership: ['Оформите продление вместо новой покупки.'],
                },
              }),
            })
            return true
          }
          return false
        },
      )

      await page.setViewportSize(viewport)
      await page.goto('/clients/client-1')
      await page.getByRole('button', { name: 'Новый абонемент' }).click()
      await page.getByRole('radio', { name: 'Без варианта каталога' }).check()
      const amount = page.getByRole('spinbutton', { name: 'Фактическая сумма продажи, ₽' })
      await amount.fill('4200')
      await page.getByLabel('Действует с').fill('2026-06-25')
      await page.getByLabel('Действует по').fill('2026-07-25')
      await page.getByRole('button', { name: 'Оформить абонемент' }).click()
      await page.getByRole('dialog', { name: 'Подтвердить новую продажу?' })
        .getByRole('button', { name: 'Подтвердить продажу' }).click()

      await expect.poll(() => requestBody).toMatchObject({
        ManualSaleAmount: 4200,
        ValidFrom: '2026-06-25',
        ValidTo: '2026-07-25',
        PaymentDate: '2026-07-23',
      })
      expect(requestBody).not.toHaveProperty('PaymentStatus')
      await expect(page.getByText('Срок пересекается с действующим абонементом.').first()).toBeVisible()
      await expect(amount).toHaveValue('4200')
      await expectNoHorizontalScroll(page)
    }
  })

  test('allowed renewal saves through idempotent request and reloads the new sale', async ({ page }) => {
    let client = buildClient({ behaviorKind: 'Term' })
    let requestBody: Record<string, unknown> | null = null
    let idempotencyKey: string | null = null
    await mockMembershipPricingApi(page, () => client, async ({ pathname, method, route }) => {
      if (pathname === '/api/clients/client-1/membership/renew' && method === 'POST') {
        requestBody = route.request().postDataJSON() as Record<string, unknown>
        idempotencyKey = route.request().headers()['idempotency-key'] ?? null
        client = buildClient({
          id: 'membership-renewed',
          saleId: 'sale-renewed',
          behaviorKind: 'Term',
          pricingMode: 'Catalog',
          purchaseDate: '2026-07-22',
          paymentDate: '2026-07-23',
          validFrom: '2026-07-22',
          expirationDate: '2026-08-20',
        })
        await fulfillJson(route, client)
        return true
      }
      return false
    })

    await page.goto('/clients/client-1')
    await page.getByRole('button', { name: 'Продлить' }).click()
    await page.getByRole('radio', { name: 'По каталожной цене' }).check()
    await selectOption(page, 'Вариант абонемента', /Месяц/)
    await page.getByRole('button', { name: 'Продлить абонемент' }).click()
    await page.getByRole('dialog', { name: 'Подтвердить новую продажу?' })
      .getByRole('button', { name: 'Подтвердить продажу' }).click()

    await expect.poll(() => requestBody).toEqual({
      MembershipCatalogItemId: 'catalog-1',
      PaymentDate: '2026-07-23',
    })
    await expect.poll(() => idempotencyKey).toEqual(expect.any(String))
    await expect(page.getByText('Ожидает оплаты')).toHaveCount(0)
    await expect(page.getByText('Оплачен')).toHaveCount(0)
    await expect(page.getByText('Не оплачен')).toHaveCount(0)
    await expect(page.getByText(/20.*авг.*2026|20\.08\.2026/).first()).toBeVisible()
  })

  test('payment-date correction reloads a fresh version and keeps mark-payment removed', async ({ page }) => {
    let client = buildClient({
      id: 'membership-before-correction',
      saleId: 'sale-1',
      behaviorKind: 'Term',
      purchaseDate: '2026-06-22',
      paymentDate: '2026-06-22',
      validFrom: '2026-06-22',
      expirationDate: '2026-07-21',
    })
    let correctionBody: Record<string, unknown> | null = null
    await mockMembershipPricingApi(page, () => client, async ({ pathname, method, route }) => {
      if (pathname === '/api/clients/client-1/membership/correct' && method === 'POST') {
        correctionBody = route.request().postDataJSON() as Record<string, unknown>
        client = buildClient({
          id: 'membership-after-correction',
          saleId: 'sale-1',
          behaviorKind: 'Term',
          purchaseDate: '2026-06-22',
          paymentDate: '2026-07-05',
          validFrom: '2026-07-05',
          expirationDate: '2026-08-04',
        })
        await fulfillJson(route, client)
        return true
      }
      return false
    })

    await page.goto('/clients/client-1')
    await page.getByRole('button', { name: 'Исправить' }).click()
    await page.getByLabel('Действует с').fill('2026-07-05')
    await page.getByLabel('Действует по').fill('2026-08-04')
    await page.getByLabel('Дата оплаты').fill('2026-07-05')
    await page.getByRole('button', { name: 'Сохранить исправление' }).click()
    await expect.poll(() => correctionBody).toEqual({
      SaleId: 'sale-1',
      ExpectedMembershipId: 'membership-before-correction',
      ValidFrom: '2026-07-05',
      ValidTo: '2026-08-04',
      PaymentDate: '2026-07-05',
    })

    await expect(page.getByRole('button', { name: 'Отметить оплату' })).toHaveCount(0)
    await expect(page.getByText('Оплачен')).toHaveCount(0)
    await expect(page.getByText('Не оплачен')).toHaveCount(0)
  })

  test('stale target conflict stays on the form without changing another membership', async ({ page }) => {
    let requestBody: Record<string, unknown> | null = null
    await mockMembershipPricingApi(
      page,
      buildClient({ behaviorKind: 'Term' }),
      async ({ pathname, method, route }) => {
        if (
          pathname === '/api/clients/client-1/membership/correct' &&
          method === 'POST'
        ) {
          requestBody = route.request().postDataJSON() as Record<string, unknown>
          await route.fulfill({
            status: 409,
            contentType: 'application/problem+json',
            body: JSON.stringify({
              detail: 'Абонемент уже изменен. Обновите карточку.',
              errors: {
                ExpectedMembershipId: ['Версия абонемента устарела.'],
              },
            }),
          })
          return true
        }
        return false
      },
    )

    await page.goto('/clients/client-1')
    await page.getByRole('button', { name: 'Исправить' }).click()
    await page.getByLabel('Действует с').fill('2026-07-05')
    await page.getByLabel('Действует по').fill('2026-08-04')
    await page.getByRole('button', { name: 'Сохранить исправление' }).click()

    await expect.poll(() => requestBody).toMatchObject({
      ExpectedMembershipId: 'membership-1',
    })
    await expect(page.getByText('Абонемент уже изменен. Обновите карточку.')).toBeVisible()
    await expect(page.getByLabel('Действует с')).toHaveValue('2026-07-05')
  })

  test('status-free current membership stays usable at 320px', async ({ page }) => {
    await mockMembershipPricingApi(page, buildClient({
      id: 'membership-current',
      saleId: 'sale-1',
      behaviorKind: 'Term',
    }))

    await page.setViewportSize({ width: 320, height: 844 })
    await page.goto('/clients/client-1')
    await expect(page.getByRole('button', { name: 'Отметить оплату' })).toHaveCount(0)
    await expect(page.getByText('Оплачен')).toHaveCount(0)
    await expect(page.getByText('Не оплачен')).toHaveCount(0)
    await expect(page.getByText('Дата оплаты', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Главный тренер', { exact: true }).first()).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})

type MembershipOverrides = {
  id?: string
  saleId?: string
  behaviorKind?: 'Term' | 'SingleVisit'
  pricingMode?: 'Catalog' | 'CatalogOverride' | 'AmountOnly'
  grossAmount?: number
  catalogPrice?: number | null
  purchaseDate?: string
  paymentDate?: string
  validFrom?: string
  expirationDate?: string | null
  singleVisitUsed?: boolean
}

function buildClient(membership?: MembershipOverrides) {
  const currentMembership = membership
    ? {
        id: membership.id ?? 'membership-1',
        saleId: membership.saleId ?? 'sale-1',
        membershipCatalogItemId:
          membership.pricingMode === 'AmountOnly' ? null : 'catalog-1',
        membershipName:
          membership.pricingMode === 'AmountOnly'
            ? 'Без варианта каталога'
            : 'Месяц',
        behaviorKind: membership.behaviorKind ?? 'Term',
        purchaseDate: membership.purchaseDate ?? '2026-06-22',
        paymentDate: membership.paymentDate ?? membership.purchaseDate ?? '2026-06-22',
        paymentRecordedByUserId: 'head-coach-1',
        paymentRecordedByUserName: 'Главный тренер',
        paymentRecordedAt: '2026-07-23T09:30:00Z',
        validFrom: membership.validFrom ?? membership.purchaseDate ?? '2026-06-22',
        expirationDate:
          membership.expirationDate === undefined
            ? '2026-07-21'
            : membership.expirationDate,
        pricingMode: membership.pricingMode ?? 'Catalog',
        grossAmount: membership.grossAmount ?? 3000,
        catalogPrice:
          membership.catalogPrice === undefined ? 3000 : membership.catalogPrice,
        singleVisitUsed: membership.singleVisitUsed ?? false,
        comment: null,
        commentLastChangedByName: null,
        commentLastChangedAt: null,
      }
    : null

  return {
    id: 'client-1',
    fullName: 'Иван Иванов',
    lastName: 'Иванов',
    firstName: 'Иван',
    middleName: '',
    phone: '+79990001122',
    branchId: 'branch-1',
    branchName: 'Основной',
    status: 'Active',
    contacts: [],
    groups: [],
    groupIds: [],
    notes: '',
    notesLastChangedByName: null,
    notesLastChangedAt: null,
    photo: null,
    businessDate: '2026-07-23',
    isProfessional: false,
    professionalComment: null,
    hasActiveMembership: Boolean(currentMembership),
    membershipWarning: false,
    currentMembership,
    currentMembershipSummary: currentMembership,
    hasCurrentMembership: Boolean(currentMembership),
    membershipState: currentMembership ? 'Active' : 'None',
    actionHints: [],
    membershipHistory: currentMembership ? [currentMembership] : [],
    attendanceHistory: [],
    attendanceHistoryLoaded: true,
    attendanceHistoryTotalCount: 0,
  }
}

async function mockMembershipPricingApi(
  page: Page,
  clientOrProvider:
    | ReturnType<typeof buildClient>
    | (() => ReturnType<typeof buildClient>),
  handleRequest?: MembershipPricingRequestHandler,
) {
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()

    if (!url.pathname.startsWith('/api/')) {
      return route.continue()
    }

    if (
      handleRequest &&
      (await handleRequest({ pathname: url.pathname, method, route }))
    ) {
      return
    }

    if (url.pathname === '/api/config' && method === 'GET') {
      return fulfillJson(route, { clubName: 'Клуб TASK-077' })
    }

    if (url.pathname === '/api/auth/session' && method === 'GET') {
      return fulfillJson(route, session)
    }

    if (url.pathname === '/api/clients/client-1' && method === 'GET') {
      return fulfillJson(
        route,
        typeof clientOrProvider === 'function'
          ? clientOrProvider()
          : clientOrProvider,
      )
    }

    if (url.pathname === '/api/membership-catalog/eligible' && method === 'GET') {
      return fulfillJson(route, [catalogItem])
    }

    if (url.pathname === '/api/branches' && method === 'GET') {
      return fulfillJson(route, [
        {
          id: 'branch-1',
          name: 'Основной',
          address: null,
          description: null,
          isArchived: false,
          hallCount: 1,
          groupCount: 0,
          clientCount: 1,
        },
        {
          id: 'branch-2',
          name: 'Северный',
          address: null,
          description: null,
          isArchived: false,
          hallCount: 1,
          groupCount: 0,
          clientCount: 0,
        },
      ])
    }

    if (url.pathname === '/api/groups' && method === 'GET') {
      return fulfillJson(route, { items: [], totalCount: 0, skip: 0, take: 100 })
    }

    return fulfillJson(route, {})
  })
}

type MembershipPricingRequestHandler = (context: {
  pathname: string
  method: string
  route: Route
}) => Promise<boolean>

async function selectOption(page: Page, label: string, option: RegExp) {
  await page.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: option }).click()
}

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function expectNoHorizontalScroll(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true)
}
