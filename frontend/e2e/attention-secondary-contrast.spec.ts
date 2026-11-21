import { expect, test, type Locator } from '@playwright/test'
import { contrastRatio, parseColor } from '../src/theme/contrast'
import { attentionCard, fulfillJson, mockAttentionApi } from './support/attention'

const lastCheck = '[data-testid="memberships-last-check"]'
const emptyDescription = '.empty-state__description'

async function expectReadableText(text: Locator, selector: string, name: string) {
  await expect(text).toBeVisible()
  await text.scrollIntoViewIfNeeded()
  await text.evaluate(() => document.fonts.ready.then(() => undefined))
  await test.info().attach(name, { body: await text.screenshot(), contentType: 'image/png' })

  const { color, opacity } = await text.evaluate(element => {
    let opacity = 1
    for (let node: Element | null = element; node; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity)
    }
    return { color: getComputedStyle(element).color, opacity }
  })
  const foreground = parseColor(color)
  foreground.a *= opacity

  // Capture what is actually painted behind the glyphs, including translucent surfaces.
  const background = await text.screenshot({ style: selector + ' { color: transparent !important; }' })
  const backgroundColors = await text.page().evaluate(async encoded => {
    const image = new Image()
    image.src = 'data:image/png;base64,' + encoded
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    const colors = new Set<string>()
    for (let i = 0; i < pixels.length; i += 4) {
      colors.add('rgb(' + pixels[i] + ',' + pixels[i + 1] + ',' + pixels[i + 2] + ')')
    }
    return Array.from(colors)
  }, background.toString('base64'))

  const measurements = backgroundColors.map(bg => ({ bg, ratio: contrastRatio(foreground, bg) }))
  const worst = measurements.reduce((left, right) => left.ratio < right.ratio ? left : right)
  const measurement = { color, opacity, background: worst.bg, ratio: worst.ratio }
  await test.info().attach(name + '-contrast', { body: JSON.stringify(measurement), contentType: 'application/json' })
  expect.soft(worst.ratio, name + ' ' + JSON.stringify(measurement)).toBeGreaterThanOrEqual(4.5)
}

for (const themeId of ['default-green-v1', 'test-blue-coral-v1']) {
  test('secondary text on rendered surfaces in ' + themeId, async ({ page }) => {
    let clients: ReturnType<typeof attentionCard>[] = []
    await mockAttentionApi(page, { themeId, onAttentionItems: route => fulfillJson(route, 200, clients) })
    await page.goto('/attention')
    await expectReadableText(page.locator(lastCheck), lastCheck, 'checked-empty')
    await expectReadableText(page.locator(emptyDescription), emptyDescription, 'attention-empty')

    clients = [attentionCard()]
    await page.getByRole('button', { name: 'Обновить', exact: true }).click()
    await expect(page.getByTestId('attention-list')).toBeVisible()
    await expectReadableText(page.locator(lastCheck), lastCheck, 'checked-populated')

    await page.route('**/api/attendance/lessons/today', route => fulfillJson(route, 200, { today: '2026-07-12', items: [] }))
    await page.goto('/attendance')
    await expect(page.getByText('На сегодня всё отмечено')).toBeVisible()
    await expectReadableText(page.locator(emptyDescription), emptyDescription, 'attendance-empty')
  })
}
