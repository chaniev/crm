import { expect, test, type Locator, type Page } from '@playwright/test'

type TypographyMetrics = {
  fontSize: number
  fontWeight: number
  lineHeightRatio: number
}

function role(page: Page, name: string): Locator {
  return page.locator(`[data-catalog-type-role="${name}"]`)
}

async function metrics(locator: Locator): Promise<TypographyMetrics> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element)
    const fontSize = Number.parseFloat(style.fontSize)

    return {
      fontSize,
      fontWeight: Number.parseInt(style.fontWeight, 10),
      lineHeightRatio: Number.parseFloat(style.lineHeight) / fontSize,
    }
  })
}

for (const width of [360, 390, 420, 440, 768]) {
  test(`uses the compact semantic type scale at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 956 })
    await page.goto('/catalog.html?theme=default-green-v1&viewport=fluid&motion=reduced&content=long')
    await page.evaluate(() => document.fonts.ready)

    const heading1 = await metrics(role(page, 'heading1'))
    const heading2 = await metrics(role(page, 'heading2'))
    const heading3 = await metrics(role(page, 'heading3'))
    const bodyCompact = await metrics(role(page, 'bodyCompact'))
    const display = await metrics(role(page, 'display'))
    const formControl = await metrics(role(page, 'formControl'))
    const label = await metrics(role(page, 'label'))
    const numeric = await metrics(role(page, 'numeric'))

    expect(heading1.fontSize).toBeLessThanOrEqual(22)
    expect(heading1.fontWeight).toBeLessThanOrEqual(700)
    expect(heading2.fontSize).toBeLessThanOrEqual(18)
    expect(heading2.fontWeight).toBeLessThanOrEqual(700)
    expect(heading3.fontSize).toBe(16)
    expect(heading3.fontWeight).toBeLessThanOrEqual(700)
    expect(bodyCompact.lineHeightRatio).toBeGreaterThanOrEqual(1.3)
    expect(display.fontSize).toBeGreaterThanOrEqual(36)
    expect(display.fontWeight).toBe(800)
    expect(formControl.fontSize).toBe(16)
    expect(formControl.fontWeight).toBe(600)
    expect(label.fontWeight).toBe(700)
    expect(numeric.fontWeight).toBe(700)
  })
}

for (const expected of [
  { width: 769, heading1Size: 28, heading2Size: 23.2 },
  { width: 1440, heading1Size: 37.6, heading2Size: 32 },
]) {
  test(`preserves the desktop semantic type scale at ${expected.width}px`, async ({ page }) => {
    await page.setViewportSize({ width: expected.width, height: 1200 })
    await page.goto('/catalog.html?theme=default-green-v1&viewport=fluid&motion=reduced&content=standard')
    await page.evaluate(() => document.fonts.ready)

    const heading1 = await metrics(role(page, 'heading1'))
    const heading2 = await metrics(role(page, 'heading2'))
    const bodyCompact = await metrics(role(page, 'bodyCompact'))

    expect(heading1.fontSize).toBeCloseTo(expected.heading1Size, 1)
    expect(heading1.fontWeight).toBe(800)
    expect(heading2.fontSize).toBeCloseTo(expected.heading2Size, 1)
    expect(heading2.fontWeight).toBe(800)
    expect(bodyCompact.lineHeightRatio).toBeCloseTo(1.25, 2)
    expect((await metrics(role(page, 'label'))).fontWeight).toBe(800)
    expect((await metrics(role(page, 'numeric'))).fontWeight).toBe(800)
  })
}
