import { expect, test } from '@playwright/test'
import { sharedComponentInventory } from '../../src/catalog/componentInventory'

function projectViewport(projectName: string) {
  if (projectName.endsWith('390')) return '390'
  if (projectName.endsWith('440')) return '440'
  return '1440'
}

test('renders the audited catalog without accessibility smoke regressions', async ({ page }, testInfo) => {
  const viewport = projectViewport(testInfo.project.name)
  const runtimeErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })
  page.on('pageerror', (error) => runtimeErrors.push(error.message))

  await page.goto(
    `/catalog.html?theme=default-green-v1&viewport=${viewport}&motion=reduced&content=long`,
  )

  await expect(page.getByRole('heading', { level: 1, name: 'Каталог дизайн-системы' }))
    .toBeVisible()
  await expect(page.getByTestId('catalog-preview')).toHaveAttribute('data-viewport', viewport)
  await expect(page.getByTestId('catalog-preview')).toHaveAttribute('data-motion', 'reduced')
  await expect(page.locator('[data-catalog-component]')).toHaveCount(sharedComponentInventory.length)
  await expect(page.getByRole('alert').first()).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Обновляем клиентов' })).toBeVisible()

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasOverflow).toBe(false)

  const skeletonAnimation = await page.locator('.skeleton-row').first().evaluate(
    (element) => getComputedStyle(element).animationDuration,
  )
  expect(Number.parseFloat(skeletonAnimation)).toBeLessThanOrEqual(0.000001)
  expect(runtimeErrors).toEqual([])
})

test('keeps canonical controls and representative interactions keyboard-operable', async ({ page }, testInfo) => {
  const viewport = projectViewport(testInfo.project.name)
  await page.goto(
    `/catalog.html?theme=test-blue-coral-v1&viewport=${viewport}&motion=system&content=standard`,
  )

  const search = page.getByRole('textbox', { name: 'Найти клиента' })
  await search.fill('Очень длинное имя клиента для проверки')
  await page.getByRole('button', { name: 'Сбросить поисковый запрос' }).click()
  await expect(search).toBeFocused()
  await expect(search).toHaveValue('')

  const confirmTrigger = page.getByRole('button', { name: 'Открыть подтверждение' })
  await confirmTrigger.click()
  await expect(page.getByRole('dialog', { name: 'Удалить запись?' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Удалить запись?' })).toBeHidden()
  await expect(confirmTrigger).toBeFocused()

  const taskItem = page.getByRole('button', { name: 'Открыть клиента Александра Долгополова' })
  await taskItem.focus()
  await page.keyboard.press('Enter')
  await expect(taskItem).toHaveAttribute('aria-pressed', 'true')

  const alternateTheme = page.getByRole('link', { name: 'default-green-v1' })
  await expect(alternateTheme).toHaveAttribute(
    'href',
    `?theme=default-green-v1&viewport=${viewport}&motion=system&content=standard`,
  )
})
