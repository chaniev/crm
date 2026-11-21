import { expect, type Page } from '@playwright/test'

export async function checkMixedRosterFilter(page: Page, unmarkedId: string, presentId: string) {
  const filter = page.getByRole('group', { name: 'Показывать клиентов' })
  const unmarked = page.getByTestId(`attendance-client-card-${unmarkedId}`)
  const present = page.getByTestId(`attendance-client-card-${presentId}`)
  await expect(filter.getByRole('radio', { name: 'Не отмечено' })).toBeChecked()
  await expect(unmarked).toBeVisible()
  await expect(present).toHaveCount(0)

  await filter.getByText('Все', { exact: true }).click()
  await expect(filter.getByRole('radio', { name: 'Все' })).toBeChecked()
  await expect(unmarked.getByRole('radio', { name: 'Не отмечено' })).toBeChecked()
  await expect(present.getByRole('radio', { name: 'Был', exact: true })).toBeChecked()
  await filter.getByText('Не отмечено', { exact: true }).click()
  await expect(unmarked).toBeVisible()
  await expect(present).toHaveCount(0)
}
