import { expect, test, type Locator, type Page } from '@playwright/test'

const clientViewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1200 },
]

export async function checkClientViewports(page: Page, check: () => Promise<void>) {
  if (test.info().project.name !== 'chromium') {
    await check()
    return
  }

  for (const viewport of clientViewports) {
    await test.step(`${viewport.width}×${viewport.height}`, async () => {
      await page.setViewportSize(viewport)
      await check()
    })
  }
}

export async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))

  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1)
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1)
}

export async function expectReachableActions(scope: Page | Locator, names: string[]) {
  const buttons = names.map(name => scope.getByRole('button', { name, exact: true }))
  for (const button of buttons) {
    await button.click({ trial: true })
  }
  const group = buttons.reduce((group, button) => group.or(button))
  await expectNoHorizontalOverflow(group.page())

  // Read every rectangle together after the final trial click has scrolled the page.
  const rects = await group.evaluateAll(elements => elements.map(element => {
    const { top, bottom, left, right } = element.getBoundingClientRect()
    return { name: element.textContent?.trim(), top, bottom, left, right }
  }))
  expect(rects).toHaveLength(names.length)
  for (const [index, a] of rects.entries()) {
    for (const b of rects.slice(index + 1)) {
      const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
      expect(overlap, `Перекрытие кнопок «${a.name}» и «${b.name}»`).toBe(false)
    }
  }
}
