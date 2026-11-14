import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import puppeteer, { KnownDevices } from 'puppeteer'
import { sessionKey } from '../src/utils/auth-session'

const root = path.resolve('dist/browser')
const config = JSON.parse(fs.readFileSync('nav.config.json', 'utf8'))
const settings = JSON.parse(fs.readFileSync('data/settings.json', 'utf8'))
const searchConfig = JSON.parse(fs.readFileSync('data/search.json', 'utf8'))
const navigation = JSON.parse(fs.readFileSync('data/db.json', 'utf8'))
const widgets = JSON.parse(fs.readFileSync('data/component.json', 'utf8'))
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
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().startsWith('ERROR'))
      errors.push(message.text())
  })
  const sessionScript = await page.evaluateOnNewDocument(
    (key, datetime) => {
      localStorage.setItem('language', 'zh-CN')
      localStorage.setItem('s_url', datetime)
      sessionStorage.setItem(
        key,
        JSON.stringify({ token: 'THEME_TEST_ONLY_TOKEN' }),
      )
    },
    sessionKey(config, base),
    config.datetime,
  )
  await page.setRequestInterception(true)
  let dailyRequests = 0
  let savedSettings = settings
  let settingsSha = 'settings-test-sha'
  let savedWidgets = widgets
  let widgetSha = 'widgets-test-sha'
  page.on('request', async (request) => {
    const url = new URL(request.url())
    if (url.origin === new URL(base).origin || url.protocol === 'data:') {
      await request.continue()
      return
    }
    if (url.hostname === 'v1.hitokoto.cn') {
      dailyRequests += 1
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
    if (url.hostname === 'metadata.test') {
      assert.equal(
        request.headers()['authorization'],
        undefined,
        '自定义网站接口不能接收仓库 Token',
      )
      await request.respond({
        status: 200,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
        },
        body: JSON.stringify({
          data: {
            name: '接口示例网站',
            icon: '/custom-icon.png',
            summary: '接口示例描述',
          },
        }),
      })
      return
    }
    if (url.hostname === 'api.github.com') {
      let body: unknown =
        url.pathname === '/user'
          ? { login: 'collaborator' }
          : { archived: false, permissions: { push: true } }
      if (url.pathname.endsWith('/contents/data/settings.json')) {
        if (request.method() === 'GET')
          body = {
            sha: settingsSha,
            content: Buffer.from(JSON.stringify(savedSettings)).toString(
              'base64',
            ),
            encoding: 'base64',
          }
        else if (request.method() === 'PUT') {
          const payload = JSON.parse(request.postData()!)
          assert.equal(payload.branch, config.branch)
          assert.equal(payload.sha, settingsSha)
          savedSettings = JSON.parse(
            Buffer.from(payload.content, 'base64').toString(),
          )
          settingsSha += '-saved'
          body = { content: { sha: settingsSha }, commit: { sha: settingsSha } }
        }
      }
      if (url.pathname.endsWith('/contents/data/component.json')) {
        if (request.method() === 'GET')
          body = {
            sha: widgetSha,
            content: Buffer.from(JSON.stringify(savedWidgets)).toString(
              'base64',
            ),
            encoding: 'base64',
          }
        else if (request.method() === 'PUT') {
          const payload = JSON.parse(request.postData()!)
          assert.equal(payload.branch, config.branch)
          assert.equal(payload.sha, widgetSha)
          savedWidgets = JSON.parse(
            Buffer.from(payload.content, 'base64').toString(),
          )
          widgetSha += '-saved'
          body = { content: { sha: widgetSha }, commit: { sha: widgetSha } }
        }
      }
      await request.respond({
        status: request.method() === 'OPTIONS' ? 204 : 200,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'authorization, content-type',
          'access-control-allow-methods': 'GET, PUT, OPTIONS',
        },
        body: request.method() === 'OPTIONS' ? '' : JSON.stringify(body),
      })
    } else await request.abort()
  })
  const previews =
    process.env['NAV_TEST_OUTPUT_DIR'] ||
    path.join(os.tmpdir(), 'nav-theme-preview')
  fs.mkdirSync(previews, { recursive: true })
  await page.goto(
    base + '?id=' + navigation[0].nav[0].id + '&q=ROOT_ROUTE_TEST&keep=1',
    { waitUntil: 'networkidle0' },
  )
  assert.equal(
    new URL(page.url()).pathname,
    '/' + settings.theme.toLowerCase(),
    '首页应跳转到包含主题名的地址',
  )
  assert.equal(
    new URL(page.url()).searchParams.get('id'),
    String(navigation[0].nav[0].id),
  )
  assert.equal(new URL(page.url()).searchParams.get('q'), 'ROOT_ROUTE_TEST')
  assert.equal(new URL(page.url()).searchParams.get('keep'), '1')
  await page.emulate(KnownDevices['iPhone 13'])
  await page.goto(
    base + '?id=' + navigation[0].nav[0].id + '&q=MOBILE_ROUTE_TEST&keep=1',
    { waitUntil: 'networkidle0' },
  )
  const mobileTheme =
    settings.appTheme === 'Current' ? settings.theme : settings.appTheme
  assert.equal(
    new URL(page.url()).pathname,
    '/' + mobileTheme.toLowerCase(),
    '手机首页应跳转到配置的主题地址',
  )
  assert.equal(
    new URL(page.url()).searchParams.get('id'),
    String(navigation[0].nav[0].id),
  )
  assert.equal(new URL(page.url()).searchParams.get('q'), 'MOBILE_ROUTE_TEST')
  assert.equal(
    new URL(page.url()).searchParams.get('keep'),
    '1',
    '手机主题跳转也应保留额外参数',
  )
  await page.setUserAgent(await browser.userAgent())
  for (const theme of ['light', 'super', 'sim', 'side', 'shortcut', 'app']) {
    await page.setViewport({ width: 1440, height: 960 })
    await page.goto(base + theme, { waitUntil: 'networkidle0' })
    const daily = 'app-daily-text section'
    if (settings.hitokotoEnable === false) {
      assert.equal(
        await page.$(daily),
        null,
        `${theme} 关闭每日文字后不显示卡片`,
      )
      assert.equal(
        await page.$eval('app-daily-text', (element) => {
          const style = getComputedStyle(element)
          return style.display === 'none'
            ? 0
            : element.getBoundingClientRect().height +
                parseFloat(style.marginTop) +
                parseFloat(style.marginBottom)
        }),
        0,
        `${theme} 关闭每日文字后不应留下空白`,
      )
      continue
    }
    assert.equal(
      (await page.$$(daily)).length,
      1,
      `${theme} 应显示一张每日文字卡片`,
    )
    await page.waitForSelector(daily + '[aria-busy="false"]')
    if (settings.hitokotoSources === 'hitokoto')
      assert.ok(
        await page.$eval(daily, (element) =>
          element.textContent?.includes('保持好奇，认真生活。'),
        ),
        `${theme} 应显示每日文字的正文`,
      )
    assert.equal(
      Boolean(await page.$(daily + ' h2')),
      settings.hitokotoShowTitle !== false,
      `${theme} 应遵循每日文字标题开关`,
    )
    assert.equal(
      await page.$eval(daily, (element) => getComputedStyle(element).textAlign),
      settings.hitokotoAlign || 'center',
      `${theme} 应遵循每日文字的对齐设置`,
    )
    const decoration = await page.$eval(daily, (element) => {
      const style = getComputedStyle(element)
      return [style.backgroundColor, style.borderTopWidth, style.boxShadow]
    })
    assert.deepEqual(
      decoration,
      ['rgba(0, 0, 0, 0)', '0px', 'none'],
      `${theme} 每日文字只显示文字，不覆盖主题底色`,
    )
    const panel = {
      light: '.light-box',
      super: '.main-box',
      sim: '.sim .wrapper',
      app: '.app-page .wrapper',
    }[theme]
    if (panel) {
      assert.ok(
        await page.evaluate((selector) => {
          const content = document
            .querySelector(selector)!
            .getBoundingClientRect()
          const text = document
            .querySelector('app-daily-text')!
            .getBoundingClientRect()
          const footer = document
            .querySelector('app-footer')!
            .getBoundingClientRect()
          return text.top >= content.bottom - 1 && text.bottom <= footer.top + 1
        }, panel),
        `${theme} 每日文字应位于网站内容下方、页脚上方`,
      )
      await page.$eval(daily, (element) =>
        element.scrollIntoView({ block: 'end', behavior: 'instant' }),
      )
      assert.ok(
        await page.$eval(daily, (element) => {
          const bounds = element.getBoundingClientRect()
          const visible = document.elementFromPoint(
            bounds.left + bounds.width / 2,
            bounds.top + bounds.height / 2,
          )
          return (
            bounds.top >= 0 &&
            bounds.bottom <= innerHeight + 1 &&
            element.contains(visible)
          )
        }),
        `${theme} 底部每日文字应能完整滚动查看，不能被容器裁掉`,
      )
    }
    if (theme === 'side') {
      assert.equal(
        await page.$eval(
          '.side-sidebar',
          (element) => element.getBoundingClientRect().width,
        ),
        220,
        'Side 分类栏应缩窄到 220px',
      )
      assert.equal(
        await page.$('.count-badge, .content-heading'),
        null,
        'Side 不显示额外的网站统计',
      )
      assert.equal(
        await page.$('.side-hero > h1'),
        null,
        'Side 横幅不重复显示站点标题',
      )
      assert.equal(
        await page.$('.content-heading h2, .section-caption'),
        null,
        'Side 内容区不重复显示分类标题',
      )
    }
    await page.screenshot({ path: path.join(previews, `daily-${theme}.png`) })
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    assert.equal(
      await page.$eval(
        daily,
        (element) => getComputedStyle(element).backgroundColor,
      ),
      'rgba(0, 0, 0, 0)',
      `${theme} 每日文字在暗色模式下也应透明`,
    )
    await page.evaluate(() => document.documentElement.classList.remove('dark'))
    await page.setViewport({ width: 390, height: 844 })
    assert.ok(
      await page.$eval(daily, (element) => {
        const bounds = element.getBoundingClientRect()
        return (
          bounds.width > 0 && bounds.left >= 0 && bounds.right <= innerWidth
        )
      }),
      `${theme} 每日文字在手机上不能横向溢出`,
    )
    await page.screenshot({
      path: path.join(previews, `daily-${theme}-mobile.png`),
    })
  }
  if (settings.hitokotoEnable === false)
    assert.equal(dailyRequests, 0, '关闭每日文字后所有主题均不能请求接口')
  else if (settings.hitokotoSources === 'hitokoto')
    assert.equal(dailyRequests, 1, '切换主题应复用同一天的每日文字缓存')
  assert.deepEqual(errors, [], '各主题的每日文字不能出现运行错误')
  console.log('PASS: 六种主题的每日文字、标题开关、暗色模式和手机布局')
  await page.setViewport({ width: 1440, height: 960 })
  await page.goto(base + 'shortcut', { waitUntil: 'networkidle0' })
  const background = await page.$eval(
    '.shortcut',
    (element) => getComputedStyle(element).backgroundImage,
  )
  assert.equal(
    decodeURI(background.replace(/^url\("?|"?\)$/g, '')),
    'https://gcore.jsdelivr.net/gh/dragonadd/picx-images-hosting@master/blog/桐谷直叶—狙击枪.png',
  )
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
      '主题菜单只列出可用主题',
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
    console.log('PASS: 主题菜单与 Side 切换可用')
  }
  if (process.env['NAV_TEST_SHORTCUT_ONLY'] === '1') process.exitCode = 0
  else {
    await page.goto(base + 'side', { waitUntil: 'networkidle0' })
    await page.waitForSelector('app-side app-card')
    assert.equal(
      await page.$('app-side .admin-link'),
      null,
      'Side 侧栏不显示管理入口',
    )
    assert.equal(
      await page.$('app-side .hero-description'),
      null,
      'Side 横幅不显示副标题',
    )
    assert.equal(
      await page.$('app-side .root-tabs'),
      null,
      '横幅不重复显示分类导航',
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
      const title = await category.evaluate((element) =>
        element.textContent?.trim(),
      )
      await category.click()
      await page.waitForFunction(
        (name) =>
          document
            .querySelector('app-side .category-link.active')
            ?.textContent?.trim() === name,
        {},
        title,
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
    await page.goto(base + 'side?q=NO_MATCH_NAV_TEST', {
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
    await page.type('#nav-web-search', 'NO_MATCH_NAV_ADMIN')
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
    const description = 'THEME_TEST_DESCRIPTION'
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
      ;(input as HTMLTextAreaElement).value = 'DESCRIPTION_CHANGED_NAV_TEST'
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
    await page.evaluate(() =>
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'instant',
      }),
    )
    assert.equal(
      await page.$eval(
        '.sheader',
        (element) => element.getBoundingClientRect().top,
      ),
      0,
      'Super 页头应在滚动后保持可见',
    )
    assert.ok(
      await page.evaluate(
        () =>
          document.querySelector('.main-box .left')!.getBoundingClientRect()
            .top >=
          document.querySelector('.sheader')!.getBoundingClientRect().bottom,
      ),
      'Super 分类栏滚到列表底部仍应停在页头下方',
    )
    let position: { x: number; y: number; width: number } | undefined
    for (const alignment of ['left', 'center', 'right', 'justify']) {
      await page.goto(base + 'system/setting', { waitUntil: 'networkidle0' })
      await page.$$eval(
        'system-setting .settings-sections > nz-tabs-nav .ant-tabs-tab-btn',
        (tabs) => {
          ;(
            tabs.find(
              (tab) => tab.textContent?.trim() === '每日文字',
            ) as HTMLElement
          ).click()
        },
      )
      await page.click(
        '[formcontrolname="hitokotoAlign"] [nzvalue="' + alignment + '"]',
      )
      const saved = page.waitForResponse(
        (response) =>
          response.url().includes('/contents/data/settings.json') &&
          response.request().method() === 'PUT',
      )
      await page.click('.settings-save-bar button')
      await saved
      await page.waitForFunction(
        () =>
          !document
            .querySelector('.settings-save-bar button')
            ?.classList.contains('ant-btn-loading'),
      )
      assert.equal(
        savedSettings.hitokotoAlign,
        alignment,
        '保存应提交选中的文字对齐方式',
      )
      assert.equal(savedSettings.hitokotoSources, settings.hitokotoSources)
      assert.equal(
        savedSettings.hitokotoCustomText,
        settings.hitokotoCustomText,
      )
      await page.click('.header-actions button[aria-label="返回主页"]')
      await page.waitForSelector('app-daily-text section[aria-busy="false"]')
      await page.waitForFunction(
        (value) =>
          getComputedStyle(document.querySelector('app-daily-text section')!)
            .textAlign === value,
        {},
        alignment,
      )
      const bounds = await page.$eval('app-daily-text', (element) => {
        const rect = element.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width }
      })
      if (position)
        assert.deepEqual(
          bounds,
          position,
          '更改文字对齐不能移动每日文字所在区域',
        )
      else position = bounds
    }
    assert.deepEqual(errors, [], '每日文字对齐设置不能出现运行错误')
    console.log('PASS: 四种对齐设置保存、文字显示和区域位置保持一致')
    await page.goto(base + 'system/setting', { waitUntil: 'networkidle0' })
    await page.$$eval(
      'system-setting .settings-sections > nz-tabs-nav .ant-tabs-tab-btn',
      (tabs) => {
        ;(
          tabs.find(
            (tab) => tab.textContent?.trim() === '外观与交互',
          ) as HTMLElement
        ).click()
      },
    )
    assert.equal(
      (await page.$$('.widget-details')).length,
      widgets.components.length,
      '外观与交互应展开全部组件的参数说明',
    )
    const editWidget = async (type: number) => {
      const index = widgets.components.findIndex(
        (item: { type: number }) => item.type === type,
      )
      assert.ok(index >= 0)
      const selector = '.widget-details:nth-of-type(' + (index + 1) + ')'
      const open = await page.$eval(
        selector,
        (element) => (element as HTMLDetailsElement).open,
      )
      if (!open) await page.click(selector + ' summary')
      await page.$eval(selector + ' button', (element) =>
        element.scrollIntoView({ block: 'center', behavior: 'instant' }),
      )
      await page.click(selector + ' button')
      await page.waitForSelector('.ant-drawer-open .ant-drawer-body', {
        visible: true,
      })
      await page.waitForFunction(() => {
        const drawer = document.querySelector(
          '.ant-drawer-open .ant-drawer-content-wrapper',
        )
        if (!drawer) return false
        const rect = drawer.getBoundingClientRect()
        return rect.left >= 0 && rect.right <= innerWidth + 1
      })
    }
    const setInput = async (selector: string, value: string) => {
      await page.$eval(
        selector,
        (element, content) => {
          ;(element as HTMLInputElement).value = content
          element.dispatchEvent(new Event('input', { bubbles: true }))
        },
        value,
      )
    }
    await editWidget(2)
    await page.waitForSelector(
      '.ant-drawer-open input[formcontrolname="workTitle"]',
    )
    await setInput(
      '.ant-drawer-open input[formcontrolname="workTitle"]',
      '工作时间测试',
    )
    await page.click(
      '.ant-drawer-open .ant-drawer-footer button.ant-btn-primary',
    )
    await page.waitForSelector('.ant-drawer-open', { hidden: true })
    await page.waitForSelector('.ant-drawer-mask', { hidden: true })
    const widgetSave = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().endsWith('/contents/data/component.json'),
    )
    const settingsSave = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().endsWith('/contents/data/settings.json'),
    )
    await page.click('.settings-save-bar button')
    await Promise.all([widgetSave, settingsSave])
    assert.equal(
      savedWidgets.components.find((item: { type: number }) => item.type === 2)
        .workTitle,
      '工作时间测试',
    )
    assert.equal(
      typeof savedSettings.runtime,
      'number',
      '站点起始时间应保存为有效时间戳',
    )
    assert.ok(Number.isFinite(savedSettings.runtime))
    await page.waitForFunction(
      () =>
        !document
          .querySelector('.settings-save-bar button')
          ?.classList.contains('ant-btn-loading'),
    )
    for (const type of [1, 3, 4, 5, 6, 7, 8, 9]) {
      await editWidget(type)
      await page.click('.ant-drawer-open .ant-drawer-footer button:first-child')
      await page.waitForSelector('.ant-drawer-mask', { hidden: true })
    }
    await setInput(
      '[formcontrolname="webInfoApi"]',
      'https://metadata.test/info',
    )
    await page.click('[formcontrolname="webInfoMethod"] [nzvalue="GET"]')
    await setInput('[formcontrolname="webInfoTitlePath"]', 'data.name')
    await setInput('[formcontrolname="webInfoIconPath"]', 'data.icon')
    await setInput('[formcontrolname="webInfoDescriptionPath"]', 'data.summary')
    await setInput(
      '.web-info-settings input[placeholder="https://example.com/"]',
      'https://example.com/',
    )
    await page.click('.web-info-settings button')
    await page.waitForFunction(() =>
      document
        .querySelector('.web-info-result')
        ?.textContent?.includes('接口示例网站'),
    )
    assert.ok(
      await page.$eval('.web-info-result', (element) =>
        element.textContent?.includes('https://example.com/custom-icon.png'),
      ),
    )
    const apiSave = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().endsWith('/contents/data/settings.json'),
    )
    await page.click('.settings-save-bar button')
    await apiSave
    assert.equal(savedSettings.webInfoTitlePath, 'data.name')
    await page.waitForFunction(
      () =>
        !document
          .querySelector('.settings-save-bar button')
          ?.classList.contains('ant-btn-loading'),
    )
    await page.click('.sidebar a[href="/system/web"]')
    await page.waitForSelector('app-web #nav-web-first')
    await selectFirstCategory('#nav-web-first')
    await selectFirstCategory('#nav-web-second')
    await selectFirstCategory('#nav-web-third')
    await page.$$eval('app-web button', (buttons) => {
      ;(
        buttons.find(
          (button) => button.textContent?.trim() === '添加网站',
        ) as HTMLElement
      ).click()
    })
    await page.waitForSelector('.ant-modal input[formcontrolname="title"]')
    await setInput('.ant-modal input[formcontrolname="title"]', '手工名称')
    await setInput(
      '.ant-modal input[formcontrolname="url"]',
      'https://example.com/new-page',
    )
    await page.$eval('.ant-modal input[formcontrolname="url"]', (element) =>
      element.dispatchEvent(new FocusEvent('blur')),
    )
    await page.waitForFunction(
      () =>
        (
          document.querySelector(
            '.ant-modal input[formcontrolname="icon"]',
          ) as HTMLInputElement
        )?.value === 'https://example.com/custom-icon.png',
    )
    assert.equal(
      await page.$eval(
        '.ant-modal input[formcontrolname="title"]',
        (element) => (element as HTMLInputElement).value,
      ),
      '手工名称',
      '自定义接口不能覆盖已填写的名称',
    )
    assert.equal(
      await page.$eval(
        '.ant-modal textarea[formcontrolname="desc"]',
        (element) => (element as HTMLTextAreaElement).value,
      ),
      '接口示例描述',
    )
    await page.click('.ant-modal-close')
    assert.deepEqual(errors, [], '组件编辑和网站信息接口配置不能出现运行错误')
    console.log(
      'PASS: 小组件参数编辑与保存、自定义接口测试与保存、新增网站自动填写及手工内容保护',
    )
  }
} finally {
  await browser.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
}
