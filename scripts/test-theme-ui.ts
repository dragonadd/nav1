import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import puppeteer from 'puppeteer'
import { sessionKey } from '../src/utils/auth-session'

const root = path.resolve('dist/browser')
const config = JSON.parse(fs.readFileSync('nav.config.json', 'utf8'))
const settings = JSON.parse(fs.readFileSync('data/settings.json', 'utf8'))
const searchConfig = JSON.parse(fs.readFileSync('data/search.json', 'utf8'))
const navigation = JSON.parse(fs.readFileSync('data/db.json', 'utf8'))
const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://localhost')
  const target = path.resolve(root, '.' + decodeURIComponent(url.pathname))
  if (!target.startsWith(root + path.sep) && target !== root) {
    response.writeHead(403)
    response.end()
    return
  }
  const filename =
    fs.existsSync(target) && fs.statSync(target).isFile()
      ? target
      : path.join(root, 'index.html')
  const types: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
  }
  response.setHeader(
    'content-type',
    types[path.extname(filename)] || 'application/octet-stream',
  )
  response.end(fs.readFileSync(filename))
})
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
assert.ok(address && typeof address !== 'string')
const base = `http://127.0.0.1:${address.port}/`
const executablePath = [
  process.env['NAV_TEST_BROWSER'],
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((file) => file && fs.existsSync(file))
const browser = await puppeteer.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 960 })
  const sessionScript = await page.evaluateOnNewDocument(
    (key) => {
      localStorage.setItem('language', 'zh-CN')
      sessionStorage.setItem(
        key,
        JSON.stringify({ token: 'THEME_TEST_ONLY_TOKEN' }),
      )
    },
    sessionKey(config, base),
  )
  await page.setRequestInterception(true)
  page.on('request', async (request) => {
    const url = new URL(request.url())
    if (url.origin === new URL(base).origin || url.protocol === 'data:') {
      await request.continue()
      return
    }
    if (url.hostname === 'v1.hitokoto.cn') {
      await request.respond({
        status: 200,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
        },
        body: JSON.stringify({
          hitokoto: '保持好奇，认真生活。',
          from: '回归测试',
          from_who: '作者',
        }),
      })
      return
    }
    if (url.hostname === 'api.github.com') {
      await request.respond({
        status: 200,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'authorization, content-type',
        },
        body: JSON.stringify(
          url.pathname === '/user'
            ? { login: 'collaborator' }
            : { archived: false, permissions: { push: true } },
        ),
      })
    } else await request.abort()
  })
  await page.goto(base + 'shortcut', { waitUntil: 'networkidle0' })
  const background = await page.$eval(
    '.shortcut',
    (element) => getComputedStyle(element).backgroundImage,
  )
  assert.equal(
    decodeURI(background.replace(/^url\("?|"?\)$/g, '')),
    'https://gcore.jsdelivr.net/gh/dragonadd/picx-images-hosting@master/blog/桐谷直叶—狙击枪.png',
  )
  const previews =
    process.env['NAV_TEST_OUTPUT_DIR'] ||
    path.join(os.tmpdir(), 'nav-theme-preview')
  fs.mkdirSync(previews, { recursive: true })
  await page.screenshot({ path: path.join(previews, 'shortcut.png') })
  console.log('PASS: Shortcut 页面使用指定背景图')
  if (settings.showThemeToggle) {
    await page.evaluate(() => localStorage.setItem('FIXBAR_OPEN', 'true'))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.hover('app-fixbar img[src="assets/img/theme.svg"]')
    const menu =
      '.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item'
    await page.waitForSelector(menu, { visible: true })
    const choices = await page.$$eval(menu, (items) =>
      items.map((item) => item.textContent?.trim()),
    )
    assert.ok(
      choices.every((choice) => !choice?.endsWith(' Index')),
      '主题切换不能保留已合并的 Index',
    )
    assert.ok(
      choices.some((choice) => choice?.endsWith(' Side')),
      '主题切换应保留 Side',
    )
    await page.$$eval(menu, (items) => {
      ;(
        items.find((item) =>
          item.textContent?.trim().endsWith(' Side'),
        ) as HTMLElement
      ).click()
    })
    await page.waitForSelector('app-side .side-grid')
    console.log('PASS: 主题菜单移除 Index，切换 Side 可用')
  }
  if (process.env['NAV_TEST_SHORTCUT_ONLY'] === '1') process.exitCode = 0
  else {
    await page.goto(base + 'side', { waitUntil: 'networkidle0' })
    await page.waitForSelector('app-side app-card')
    assert.equal(
      await page.$('app-side .admin-link'),
      null,
      'Side 侧栏不再显示管理入口',
    )
    assert.equal(
      await page.$('app-side .hero-description'),
      null,
      'Side 横幅不再显示副标题',
    )
    assert.equal(
      await page.$('app-side .root-tabs'),
      null,
      '横幅分类按钮已由每日文字替换',
    )
    if (settings.hitokotoEnable !== false) {
      assert.ok(
        await page.$('app-side app-daily-text section'),
        'Side 应显示每日文字',
      )
      if (
        !settings.hitokotoSources ||
        settings.hitokotoSources === 'hitokoto'
      ) {
        await page.waitForFunction(() =>
          document
            .querySelector('app-daily-text blockquote')
            ?.textContent?.includes('保持好奇，认真生活。'),
        )
      }
    } else
      assert.equal(
        await page.$('app-side app-daily-text section'),
        null,
        '关闭每日文字后不显示卡片',
      )
    assert.ok(
      await page.$('app-side app-card .quick-edit'),
      'Side 主题卡片应提供明确的编辑入口',
    )
    const tabs = await browser.pages()
    await page.click('app-side app-card .quick-edit')
    await page.waitForSelector('.ant-modal input[formcontrolname="title"]')
    assert.equal(
      (await browser.pages()).length,
      tabs.length,
      '编辑按钮不能冒泡触发网站跳转',
    )
    const originalName = await page.$eval(
      '.ant-modal input[formcontrolname="title"]',
      (input) => (input as HTMLInputElement).value,
    )
    assert.ok(originalName)
    await page.screenshot({ path: path.join(previews, 'side-edit.png') })
    const updatedName = originalName + ' 编辑验证'
    await page.$eval(
      '.ant-modal input[formcontrolname="title"]',
      (input, value) => {
        ;(input as HTMLInputElement).value = value
        input.dispatchEvent(new Event('input', { bubbles: true }))
      },
      updatedName,
    )
    await page.click('.ant-modal-footer button.ant-btn-primary:last-child')
    await page.waitForSelector('.ant-modal', { hidden: true })
    await page.waitForFunction(
      (name) =>
        Array.from(document.querySelectorAll('app-side app-card .title')).some(
          (element) => element.textContent?.includes(name),
        ),
      {},
      updatedName,
    )
    await page.setViewport({ width: 390, height: 844 })
    await page.waitForFunction(() => {
      const sidebar = document.querySelector('app-sidebar nz-sider')
      return !sidebar || sidebar.getBoundingClientRect().right <= 1
    })
    await page.screenshot({ path: path.join(previews, 'side-mobile.png') })
    await page.removeScriptToEvaluateOnNewDocument(sessionScript.identifier)
    await page.evaluate(() => sessionStorage.clear())
    await page.reload({ waitUntil: 'networkidle0' })
    if (!settings.userActions.includes(2))
      assert.equal(
        await page.$('app-side app-card .quick-edit'),
        null,
        '访客未获编辑权限不能显示入口',
      )
    console.log('PASS: Side 编辑入口、修改生效、跳转隔离及访客权限')
    await page.setViewport({ width: 1440, height: 960 })
    await page.goto(base + 'side', { waitUntil: 'networkidle0' })
    await page.waitForSelector('app-side .side-grid', { timeout: 3000 })
    await page.goto(base + 'index', { waitUntil: 'networkidle0' })
    assert.ok(
      new URL(page.url()).pathname.endsWith('/side'),
      '旧 Index 地址应兼容跳转 Side',
    )
    assert.ok(await page.$('app-side .side-sidebar'), 'Side 应提供分类侧栏')
    assert.ok(await page.$('app-side .side-hero app-search'), 'Side 应复用搜索')
    if (settings.openSearch)
      assert.ok(
        await page.$('app-side #search-engine-input'),
        '所有外部搜索引擎关闭时，仍应提供站内搜索',
      )
    assert.ok(await page.$('app-side .side-card a'), '网站链接应可用键盘访问')
    if (!settings.userActions.includes(2))
      assert.equal(
        await page.$('app-side .quick-edit'),
        null,
        '访客权限保持一致',
      )
    await page.screenshot({ path: path.join(previews, 'side-desktop.png') })
    const category = await page.$('app-side .category-link:not(.active)')
    if (category) {
      await category.click()
      await page.waitForFunction(
        () =>
          document
            .querySelector('app-side .category-link.active')
            ?.textContent?.trim() ===
          document
            .querySelector('app-side .content-heading h2')
            ?.textContent?.trim(),
      )
      assert.equal(
        new URL(page.url()).searchParams.has('_'),
        false,
        '分类地址不应包含时间戳',
      )
      const categoryUrl = page.url()
      const historyLength = await page.evaluate(() => history.length)
      await page.click('app-side .category-link.active')
      await page.evaluate(
        () => new Promise((resolve) => setTimeout(resolve, 150)),
      )
      assert.equal(page.url(), categoryUrl, '重复点击分类应保留固定地址')
      assert.equal(
        await page.evaluate(() => history.length),
        historyLength,
        '重复点击分类不应添加浏览历史',
      )
    }
    await page.goto(base + 'side?q=NO_MATCH_NAV_TEST_20261113', {
      waitUntil: 'networkidle0',
    })
    assert.ok(await page.$('app-side app-no-data'), '空搜索结果应有提示')
    await page.goto(base + 'side', { waitUntil: 'networkidle0' })
    const name = await page.$eval(
      'app-side .side-card .title',
      (el) => el.textContent?.trim() || '',
    )
    if (
      settings.openSearch &&
      searchConfig.list.every((engine: { blocked: boolean }) => engine.blocked)
    ) {
      await page.type('app-side #search-engine-input', name)
      await page.keyboard.press('Enter')
      await page.waitForFunction(
        (value) => new URL(location.href).searchParams.get('q') === value,
        {},
        name,
      )
      assert.ok(await page.$('app-side .side-card'), '站内兜底搜索应真正生效')
      assert.equal(
        new URL(page.url()).searchParams.has('_'),
        false,
        '站内搜索地址不应包含时间戳',
      )
    }
    await page.goto(base + 'side?q=' + encodeURIComponent(name), {
      waitUntil: 'networkidle0',
    })
    assert.ok(await page.$('app-side .side-card'), '站内搜索应返回匹配网站')
    await page.goto(base + 'side', { waitUntil: 'networkidle0' })
    await page.click('app-side .fixbar .icondark')
    await page.waitForFunction(() =>
      document.documentElement.classList.contains('dark'),
    )
    assert.equal(
      await page.$eval('.side-shell', (el) =>
        getComputedStyle(el).getPropertyValue('--side-bg').trim(),
      ),
      '#111827',
    )
    await page.screenshot({ path: path.join(previews, 'side-dark.png') })
    await page.click('app-side .fixbar .icondark')
    await page.setViewport({ width: 390, height: 844 })
    await page.reload({ waitUntil: 'networkidle0' })
    assert.ok(
      await page.$('app-side .side-sidebar[inert]'),
      '手机菜单默认不可聚焦',
    )
    await page.click('app-side .mobile-header .menu-toggle')
    await page.waitForSelector('app-side .side-sidebar.is-open:not([inert])')
    await page.keyboard.press('Escape')
    await page.waitForSelector('app-side .side-sidebar[inert]')
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
      '手机页面不能横向溢出',
    )
    await page.screenshot({ path: path.join(previews, 'side-mobile.png') })
    await page.evaluate(
      (key) =>
        sessionStorage.setItem(
          key,
          JSON.stringify({ token: 'THEME_TEST_ONLY_TOKEN' }),
        ),
      sessionKey(config, base),
    )
    await page.goto(base + 'side', { waitUntil: 'networkidle0' })
    assert.ok(await page.$('app-side .quick-edit'), '管理员应显示编辑入口')
    await page.click('app-side .quick-edit')
    await page.waitForSelector('.ant-modal input[formcontrolname="title"]')
    await page.click('.ant-modal-close')
    await page.goto(base + 'system/setting', { waitUntil: 'networkidle0' })
    await page.$$eval(
      'system-setting .settings-sections > nz-tabs-nav .ant-tabs-tab-btn',
      (tabs) => {
        ;(
          tabs.find(
            (tab) => tab.textContent?.trim() === '主题设置',
          ) as HTMLElement
        ).click()
      },
    )
    assert.ok(
      await page.$('[formcontrolname="theme"] [nzvalue="Side"]'),
      '后台应提供 Side 默认主题选项',
    )
    assert.ok(
      await page.$('[formcontrolname="appTheme"] [nzvalue="Side"]'),
      '手机主题也应可选 Side',
    )
    console.log(
      'PASS: Side 分类、搜索、空状态、编辑权限、暗黑、手机菜单和后台主题选择',
    )
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(String(error)))
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().startsWith('ERROR'))
        errors.push(message.text())
    })
    await page.setViewport({ width: 1440, height: 960 })
    await page.goto(base + 'system/web', { waitUntil: 'networkidle0' })
    const rows =
      'app-web .ant-tabs-tabpane-active .ant-table-tbody > tr.ant-table-row:not(.ant-table-placeholder)'
    const allWebs = navigation.flatMap((one: any) =>
      one.nav.flatMap((two: any) => two.nav.flatMap((three: any) => three.nav)),
    )
    assert.equal(
      (await page.$$(rows)).length,
      allWebs.length,
      '进入网站管理应直接显示全部网站',
    )
    await page.screenshot({ path: path.join(previews, 'website-desktop.png') })
    const firstRow = (await page.$$(rows))[0]
    const firstCheckbox = await firstRow.$('.ant-checkbox-input')
    assert.ok(firstCheckbox)
    await firstCheckbox.click()
    await page.type('#nav-web-search', 'NO_MATCH_NAV_ADMIN_20261113')
    await page.waitForFunction(
      (selector) => document.querySelectorAll(selector).length === 0,
      {},
      rows,
    )
    assert.ok(
      await page.$('.web-batch-delete:disabled'),
      '筛选变化必须清除旧选择，避免删除已经隐藏的网站',
    )
    const enterSearch = async (value: string) =>
      page.$eval(
        '#nav-web-search',
        (input, text) => {
          ;(input as HTMLInputElement).value = text
          input.dispatchEvent(new Event('input', { bubbles: true }))
        },
        value,
      )
    await enterSearch(updatedName)
    await page.waitForFunction(
      (selector) => document.querySelectorAll(selector).length === 1,
      {},
      rows,
    )
    assert.equal(
      await page.$('.web-sort-actions'),
      null,
      '搜索结果不能用筛选后的行号调整原始排序',
    )
    await page.click('.web-edit')
    await page.waitForSelector('.ant-modal input[formcontrolname="title"]')
    assert.equal(
      await page.$eval(
        '.ant-modal input[formcontrolname="title"]',
        (input) => (input as HTMLInputElement).value,
      ),
      updatedName,
      '跨分类搜索结果应能编辑正确的网站',
    )
    const targetUrl = await page.$eval(
      '.ant-modal input[formcontrolname="url"]',
      (input) => (input as HTMLInputElement).value,
    )
    const description = 'THEME_TEST_DESCRIPTION_20261113'
    await page.$eval(
      '.ant-modal textarea[formcontrolname="desc"]',
      (input, value) => {
        ;(input as HTMLTextAreaElement).value = value
        input.dispatchEvent(new Event('input', { bubbles: true }))
      },
      description,
    )
    await page.click('.ant-modal-footer button.ant-btn-primary:last-child')
    await page.waitForSelector('.ant-modal', { hidden: true })
    await enterSearch(description.toLowerCase())
    await page.waitForFunction(
      (selector) => document.querySelectorAll(selector).length === 1,
      {},
      rows,
    )
    assert.ok(
      await page.$eval(
        '.web-name',
        (link, name) => link.textContent?.includes(name),
        updatedName,
      ),
    )
    const matchingRow = (await page.$$(rows))[0]
    const matchingCheckbox = await matchingRow.$('.ant-checkbox-input')
    assert.ok(matchingCheckbox)
    await matchingCheckbox.click()
    await page.click('.web-edit')
    await page.waitForSelector('.ant-modal textarea[formcontrolname="desc"]')
    await page.$eval('.ant-modal textarea[formcontrolname="desc"]', (input) => {
      ;(input as HTMLTextAreaElement).value =
        'DESCRIPTION_CHANGED_NAV_TEST_20261113'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await page.click('.ant-modal-footer button.ant-btn-primary:last-child')
    await page.waitForSelector('.ant-modal', { hidden: true })
    await page.waitForFunction(
      (selector) => document.querySelectorAll(selector).length === 0,
      {},
      rows,
    )
    assert.ok(
      await page.$('.web-batch-delete:disabled'),
      '修改后移出搜索结果的网站不能仍被批量删除',
    )
    await page.$eval('.web-batch-delete', async (button) => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      )
    })
    assert.equal(
      await page.$$eval(
        '.ant-modal',
        (modals) =>
          modals.filter((modal) => modal.getBoundingClientRect().height > 0)
            .length,
      ),
      0,
      '过期的点击事件也不能打开隐藏项目的删除确认',
    )
    await enterSearch('  ' + targetUrl.toUpperCase() + '  ')
    await page.waitForFunction(
      (name) =>
        [...document.querySelectorAll('.web-name')].some((link) =>
          link.textContent?.includes(name),
        ),
      {},
      updatedName,
    )
    await enterSearch('')
    await page.click('.web-errors-toggle')
    await page.waitForFunction(
      (selector, count) => document.querySelectorAll(selector).length === count,
      {},
      rows,
      allWebs.filter((web: any) => web.ok === false).length,
    )
    assert.equal(
      (await page.$$(rows)).length,
      allWebs.filter((web: any) => web.ok === false).length,
      '异常筛选应只显示标记异常的网站',
    )
    await page.click('.web-errors-toggle')
    const selectFirstCategory = async (selector: string) => {
      await page.click(selector)
      await page.waitForSelector('.cdk-overlay-pane .ant-select-item-option')
      await page.$$eval(
        '.cdk-overlay-pane .ant-select-item-option',
        (options) => (options[1] as HTMLElement).click(),
      )
      await page.waitForSelector('.cdk-overlay-pane .ant-select-item-option', {
        hidden: true,
      })
    }
    await selectFirstCategory('#nav-web-first')
    await selectFirstCategory('#nav-web-second')
    await selectFirstCategory('#nav-web-third')
    assert.equal(
      (await page.$$(rows)).length,
      navigation[0].nav[0].nav[0].nav.length,
      '三级筛选应显示选定分类的网站',
    )
    assert.ok(await page.$('.web-sort-actions'), '完整分类内应保留排序')
    const categoryRows = await page.$$(rows)
    assert.ok(await categoryRows[0].$('.web-sort-up:disabled'))
    assert.ok(await categoryRows.at(-1)!.$('.web-sort-down:disabled'))
    await page.screenshot({ path: path.join(previews, 'website-filtered.png') })
    await page.setViewport({ width: 390, height: 844 })
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('.system-layout .sidebar[inert]')
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
      '手机管理页面不能横向溢出',
    )
    await page.screenshot({ path: path.join(previews, 'website-mobile.png') })
    await page.setViewport({ width: 1440, height: 960 })
    await page.$$eval('app-web .ant-tabs-tab-btn', (tabs) =>
      (tabs[0] as HTMLElement).click(),
    )
    const rootRows = (await page.$$(rows)).length
    await page.$$eval(
      rows + ':last-child a, ' + rows + ':last-child button',
      (controls) =>
        (
          controls.find(
            (control) => control.textContent?.trim() === '下移',
          ) as HTMLElement
        )?.click(),
    )
    assert.equal(
      (await page.$$(rows)).length,
      rootRows,
      '末尾分类下移不能增加空分类',
    )
    assert.deepEqual(errors, [], '网站管理不能出现运行错误')
    console.log(
      'PASS: 全部网站、跨分类搜索、选择隔离、异常与三级筛选、编辑、排序边界和手机布局',
    )
    await page.$$eval('app-web .ant-tabs-tab-btn', (tabs) =>
      (tabs[1] as HTMLElement).click(),
    )
    await page.click('app-web .ant-tabs-tabpane-active nz-select')
    await page.waitForSelector('.cdk-overlay-pane .ant-select-item-option')
    await page.$$eval('.cdk-overlay-pane .ant-select-item-option', (options) =>
      (options[0] as HTMLElement).click(),
    )
    await page.$$eval(rows + ':first-child a', (links) =>
      (
        links.find((link) => link.textContent?.trim() === '编辑') as HTMLElement
      ).click(),
    )
    await page.waitForSelector('.ant-modal input[formcontrolname="icon"]')
    await page.$eval('.ant-modal input[formcontrolname="icon"]', (input) => {
      ;(input as HTMLInputElement).value = 'fas fa-film'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await page.click('.ant-modal-footer .ant-btn-primary')
    await page.waitForSelector('.ant-modal', { hidden: true })
    await page.goto(base + 'super?id=' + navigation[0].nav[0].id, {
      waitUntil: 'networkidle0',
    })
    const superIcon = await page.$('.super-xjh .left .sideicon i.fas.fa-film')
    assert.ok(superIcon, 'Super 分类应渲染 Font Awesome 类名')
    assert.ok(
      await superIcon.evaluate((element) =>
        getComputedStyle(element).fontFamily.includes('Font Awesome'),
      ),
    )
    assert.equal(
      await page.$('.super-xjh img[src="fas fa-film"]'),
      null,
      '字体图标不能作为图片请求',
    )
    await page.screenshot({ path: path.join(previews, 'super-font-icon.png') })
    assert.deepEqual(errors, [], '主题导航不能出现运行错误')
    console.log('PASS: Super 分类字体图标和固定导航地址')
  }
} finally {
  await browser.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
}
