import { expect, test, type Locator, type Page } from '@playwright/test'

const frozenNow = Date.parse('2026-08-29T12:00:00.000Z')

type VisualCase = {
  content: 'standard' | 'long'
  focus: (page: Page) => Locator
  name: string
  project: 'catalog-390' | 'catalog-420' | 'catalog-440' | 'catalog-1440'
  target: (page: Page) => Locator
  theme: 'default-green-v1' | 'test-blue-coral-v1'
}

const cases: readonly VisualCase[] = [
  {
    content: 'standard',
    focus: (page) => page.getByRole('textbox', { name: 'Логин' }),
    name: 'auth-green-standard-390',
    project: 'catalog-390',
    target: (page) => page.getByTestId('catalog-reference-auth'),
    theme: 'default-green-v1',
  },
  {
    content: 'long',
    focus: (page) => page.getByRole('textbox', { name: 'Найти клиента' }),
    name: 'locator-coral-long-390',
    project: 'catalog-390',
    target: (page) => page.getByTestId('catalog-reference-locator'),
    theme: 'test-blue-coral-v1',
  },
  {
    content: 'long',
    focus: (page) => page.getByRole('button', { name: 'Открыть клиента Александра Долгополова' }),
    name: 'operational-green-long-440',
    project: 'catalog-440',
    target: (page) => page.getByTestId('catalog-reference-operational'),
    theme: 'default-green-v1',
  },
  {
    content: 'long',
    focus: (page) => page.getByRole('button', { name: 'Открыть клиента Александра Долгополова' }),
    name: 'operational-green-long-420',
    project: 'catalog-420',
    target: (page) => page.getByTestId('catalog-reference-operational'),
    theme: 'default-green-v1',
  },
  {
    content: 'standard',
    focus: (page) => page.getByRole('textbox', { name: 'Имя клиента' }),
    name: 'form-coral-standard-420',
    project: 'catalog-420',
    target: (page) => page.getByTestId('catalog-reference-form'),
    theme: 'test-blue-coral-v1',
  },
  {
    content: 'standard',
    focus: (page) => page.getByRole('button', { name: 'Удалить запись' }),
    name: 'temporary-surface-coral-standard-440',
    project: 'catalog-440',
    target: (page) => page.getByRole('dialog', { name: 'Удалить запись?' }),
    theme: 'test-blue-coral-v1',
  },
  {
    content: 'long',
    focus: (page) => page.getByRole('button', { name: 'Клиенты' }).first(),
    name: 'shell-green-long-1440',
    project: 'catalog-1440',
    target: (page) => page.getByTestId('catalog-reference-shell'),
    theme: 'default-green-v1',
  },
  {
    content: 'standard',
    focus: (page) => page.getByRole('textbox', { name: 'Имя клиента' }),
    name: 'form-coral-standard-1440',
    project: 'catalog-1440',
    target: (page) => page.getByTestId('catalog-reference-form'),
    theme: 'test-blue-coral-v1',
  },
]

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript((timestamp) => {
    const NativeDate = Date
    class FrozenDate extends NativeDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        super(...(args.length === 0 ? [timestamp] : args))
      }

      static now() {
        return timestamp
      }
    }
    window.Date = FrozenDate as DateConstructor
  }, frozenNow)
})

for (const visualCase of cases) {
  test(`${visualCase.name} visual contract`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== visualCase.project, 'pairwise matrix owns one width')

    await page.goto(
      `/catalog.html?theme=${visualCase.theme}&viewport=${visualCase.project.slice(8)}&motion=reduced&content=${visualCase.content}`,
    )
    await page.evaluate(() => document.fonts.ready)

    const preview = page.getByTestId('catalog-preview')
    await expect(preview).toHaveAttribute('data-theme', visualCase.theme)
    await expect(preview).toHaveAttribute('data-motion', 'reduced')
    await expect(preview).toHaveAttribute('data-content', visualCase.content)
    expect(await page.evaluate(() => document.fonts.check('16px Onest'))).toBe(true)
    expect(await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )).toBe(true)

    await expect(page.getByRole('heading', { level: 1, name: 'Каталог дизайн-системы' }))
      .toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Логин' })).toBeEnabled()
    await expect(page.getByRole('alert').first()).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Обновляем клиентов' })).toBeVisible()

    if (visualCase.name.startsWith('temporary-surface')) {
      await page.getByRole('button', { name: 'Открыть подтверждение' }).click()
      await expect(page.getByRole('dialog', { name: 'Удалить запись?' })).toBeVisible()
    }

    const focusTarget = visualCase.name.startsWith('temporary-surface')
      ? page.locator(':focus-visible')
      : visualCase.focus(page)
    if (visualCase.name.startsWith('temporary-surface')) {
      await page.keyboard.press('Tab')
    } else {
      await focusTarget.focus()
    }
    await expect(focusTarget).toBeFocused()
    expect(await focusTarget.evaluate((element) => element.matches(':focus-visible'))).toBe(true)

    const skeletonAnimationSeconds = await page.locator('.skeleton-row').first().evaluate(
      (element) => Number.parseFloat(getComputedStyle(element).animationDuration),
    )
    expect(skeletonAnimationSeconds).toBeLessThanOrEqual(0.000001)

    await expect(visualCase.target(page)).toHaveScreenshot(`${visualCase.name}.png`)
  })
}
