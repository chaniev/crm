import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const requireFrontend = createRequire(new URL('../../../frontend/package.json', import.meta.url))
const { chromium, webkit, devices } = requireFrontend('playwright')
const url = pathToFileURL(resolve(process.argv[2])).href
const shots = process.argv[3]
if (shots) await mkdir(shots, { recursive: true })
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j/vsAAAAASUVORK5CYII=', 'base64')
const imageFile = { name: 'training.png', mimeType: 'image/png', buffer: png }

async function run(browser, width, height, mobile) {
  const page = await browser.newPage({
    ...(mobile ? devices['iPhone 15 Pro'] : {}), viewport: { width, height }, screen: { width, height },
    locale: 'ru-RU', reducedMotion: 'reduce',
  })
  page.setDefaultTimeout(4000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const requests = []
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()) })
  const main = page.getByRole('main')
  const button = name => main.getByRole('button', { name, exact: true })
  const checkExample = value => page.getByLabel('Пример данных').selectOption(value)
  const shot = async name => {
    if (!shots) return
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: resolve(shots, name + '.jpg'), quality: 88, scale: 'css', animations: 'disabled' })
  }
  const go = async (key, label) => {
    if (width <= 768) await page.getByLabel('Экран', { exact: true }).selectOption(key)
    else await page.getByRole('navigation').getByRole('button', { name: label, exact: true }).click()
  }
  const geometry = async () => {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'overflow ' + width)
  }
  try {
    await page.goto(url)
    await button('Редактировать').waitFor()
    await geometry()
    assert.equal(await main.getByText('Алексеев Алексей Дмитриевич', { exact:true }).count(), 1)
    assert.equal(await main.getByText('Активный', { exact:true }).count(), 1)
    assert.equal(await main.getByText('Клиент ещё не подключил Telegram.').count(), 1)
    if (width === 1440 || width === 390) await shot('detail-' + width)
    await go('preview','Краткая карточка')
    assert.equal(await main.getByText('Активный', {exact:true}).count(),1)
    assert.equal(await main.getByText('Контакты', {exact:true}).count(),0)
    await main.getByText('Абонемент просрочен').waitFor()
    await button('Открыть карточку').click()
    await button('К краткой карточке').click()
    assert.equal(await button('Открыть карточку').evaluate(el => el === document.activeElement), true)
    await button('Открыть карточку').click()

    await checkExample('long')
    await geometry()
    await main.getByText(/Александрова Ирина/).waitFor()
    await button('Редактировать').click()
    await main.getByLabel('Фамилия', {exact:true}).fill('Кузнецова')
    await button('Сохранить изменения').click()
    await main.getByRole('heading', { name: /Кузнецова/ }).waitFor()
    assert.equal(await button('Редактировать').evaluate(el => el === document.activeElement), true)

    await checkExample('photo')
    await button('Открыть фотографию').click()
    await page.getByRole('dialog').waitFor()
    await geometry()
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({state:'hidden'})
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Открыть фотографию')

    await checkExample('broken')
    await main.getByText('Не удалось показать сохранённое фото').waitFor()
    await button('Повторить просмотр').click()
    await button('Открыть фотографию').waitFor()

    await checkExample('upload')
    const input = main.locator('input[type=file]')
    await input.setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('bad')})
    await main.getByText('Допустимы только JPEG, PNG, WebP, HEIC и HEIF.').waitFor()
    const before = await main.locator('.thumbnail img').getAttribute('src')
    await input.setInputFiles(imageFile)
    await main.getByText(/Не удалось отправить файл/).waitFor()
    assert.equal(await main.locator('.thumbnail img').getAttribute('src'),before)
    await input.setInputFiles(imageFile)
    await main.getByText('Фотография обновлена.').waitFor()
    assert.notEqual(await main.locator('.thumbnail img').getAttribute('src'),before)

    await checkExample('save')
    await go('create','Новый клиент')
    assert.equal(await main.locator('input[type=file]').count(),0)
    await geometry()
    if (width === 1440 || width === 390) await shot('create-' + width)
    await button('Создать клиента').click()
    await main.locator('[data-error=true]').first().waitFor()
    await main.getByLabel('Фамилия', {exact:true}).fill('Смирнова')
    await main.getByLabel('Телефон', {exact:true}).fill('+7 900 555-03-14')
    await button('Добавить контакт').click()
    await main.getByLabel('Тип контакта').fill('Мать')
    await main.getByLabel('ФИО контактного лица').fill('Ирина Смирнова')
    await main.getByLabel('Телефон контакта').fill('+7 900 555-03-15')
    await button('Создать клиента').click()
    await main.getByText(/Не удалось сохранить карточку/).waitFor()
    assert.equal(await main.getByLabel('Фамилия', {exact:true}).inputValue(),'Смирнова')
    await button('Создать клиента').click()
    await main.getByRole('heading', {name:'Смирнова',exact:true}).waitFor()
    await main.getByText(/Ирина Смирнова/).waitFor()
    await button('Добавить фото').waitFor()
    await checkExample('coach')
    await main.getByText('Доступ тренера', {exact:true}).waitFor()
    await main.getByText(/История пока не загружена/).waitFor()
    assert.equal(await button('Редактировать').count(),0)
    assert.equal(await main.locator('input[type=file]').count(),0)
    assert.equal(await main.getByText('Телефон', {exact:true}).count(),0)
    await button('Открыть фотографию').click()
    await page.getByRole('button',{name:'Закрыть фотографию'}).click()
    await checkExample('professional')
    await main.getByText('Индивидуальный график подготовки к соревнованиям.').waitFor()
    await geometry()
    assert.deepEqual(errors,[])
    assert.deepEqual(requests,[])
    console.log('OK', browser.browserType().name(), width, height)
  } finally {
    await page.close()
  }
}
for (const [engine, sizes] of [[chromium, [[1440,900]]], [webkit, [[390,844],[420,912],[440,956],[912,420],[956,440]]]]) {
  const browser = await engine.launch()
  try {
    for (const [width,height] of sizes) await run(browser,width,height,engine === webkit)
  } finally {
    await browser.close()
  }
}
