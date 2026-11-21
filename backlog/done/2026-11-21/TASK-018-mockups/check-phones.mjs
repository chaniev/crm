import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const requireFrontend = createRequire(new URL('../../../../frontend/package.json', import.meta.url))
const { chromium, webkit, devices } = requireFrontend('playwright')
const file = pathToFileURL(resolve(process.argv[2]))
file.searchParams.set('phone', 'both')
const screenshots = process.argv[3]
const errors = []
const viewportSizes = [[360,780],[390,844],[420,912],[440,956]]

async function capture(page, label) {
  if (!screenshots) return
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path:resolve(screenshots, 'phone-' + label + '.jpg'), scale:'css', quality:90, animations:'disabled' })
}
function observe(page) {
  page.setDefaultTimeout(5000)
  page.on('pageerror',error => errors.push(error.message))
}
const desktop = await chromium.launch()
try {
  const page = await desktop.newPage({viewport:{width:1440,height:1060}, reducedMotion:'reduce',locale:'ru-RU'})
  observe(page)
  await page.goto(file.href)
  for (const [width,height] of viewportSizes) {
    await page.getByLabel('Размер экрана').selectOption(String(width))
    for (const name of ['Первый прототип','С типом абонемента']) {
      const frame = page.frameLocator('iframe[title="' + name + '"]')
      await frame.getByRole('button',{name:'Открыть карточку'}).waitFor()
      const bounds = await frame.locator('html').evaluate(() => [innerWidth,innerHeight,document.documentElement.scrollWidth])
      assert.deepEqual(bounds,[width,height,width])
      assert.equal(await frame.getByText('На срок',{exact:true}).count(),name === 'Первый прототип' ? 0 : 1)
    }
    if(width === 390) await capture(page,'both-390')
  }
  await page.getByLabel('Пример данных').selectOption('long')
  for (const frame of page.frames().slice(1)) {
    await frame.getByRole('heading',{name:/Александрова-Рождественская/}).waitFor()
    await frame.getByRole('button',{name:'Открыть карточку'}).click()
    await frame.getByRole('button',{name:'К краткой карточке'}).click()
    await frame.getByRole('button',{name:'Открыть карточку'}).waitFor()
  }
  console.log('OK desktop · two independent phone viewports at all four sizes')
} finally { await desktop.close() }

const mobile = await webkit.launch()
try {
  for (const [width,height] of [...viewportSizes,[912,420],[956,440]]) {
    const page = await mobile.newPage({...devices['iPhone 15 Pro'], viewport:{width,height},screen:{width,height},locale:'ru-RU',reducedMotion:'reduce'})
    observe(page)
    await page.goto(file.href)
    assert.equal(page.frames().length, 1)
    for(const [variant,label] of [['first','Первый прототип'],['new','С типом абонемента']]) {
      const toggle = page.getByRole('button',{name:label,exact:true})
      await toggle.click()
      assert.equal(await toggle.getAttribute('aria-pressed'),'true')
      assert.equal(await page.getByText('На срок',{exact:true}).count(),variant === 'new' ? 1 : 0)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true)
      if(width === 390) await capture(page,variant + '-390')
      for(const button of await page.locator('article .actions button').all()){
        const rect=await button.boundingBox()
        assert.ok(rect.height>=44 && rect.width>=44)
      }
      await page.getByRole('button',{name:'Открыть карточку'}).click()
      await page.getByRole('button',{name:'К краткой карточке'}).click()
      assert.equal(await toggle.getAttribute('aria-pressed'),'true')
    }
    await page.getByLabel('Пример данных').selectOption('long')
    await page.getByRole('button',{name:'Первый прототип',exact:true}).click()
    await page.getByRole('heading',{name:/Александрова-Рождественская/}).waitFor()
    await page.getByLabel('Пример данных').selectOption('coach')
    await page.getByText('Доступ тренера',{exact:true}).last().waitFor()
    assert.equal(await page.getByRole('button',{name:'Оформить абонемент'}).count(),0)
    console.log('OK WebKit',width,height)
    await page.close()
  }
} finally { await mobile.close() }
assert.deepEqual(errors,[])
