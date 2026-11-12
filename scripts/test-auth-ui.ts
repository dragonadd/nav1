import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import puppeteer from 'puppeteer'
import { authIdentity, encryptAuth, decryptAuth } from '../src/utils/admin-auth'

const root = path.resolve('dist/browser')
const index = fs.existsSync(path.join(root, 'index.html'))
  ? 'index.html'
  : 'main.html'
assert.ok(fs.existsSync(path.join(root, index)), '请先构建网站')
const config = JSON.parse(fs.readFileSync('nav.config.json', 'utf8'))
const token = 'UI_TEST_ONLY_TOKEN_12345',
  password = 'UiAuthTest2026'
const source = await encryptAuth({ token }, password, authIdentity(config))
let published: string | null = source
let file: { content: string; sha: string } | null = {
  content: source,
  sha: 'initial-sha',
}
let writable = true
const commits: { path: string; body: any; method: string }[] = []
const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://localhost')
  const relative = decodeURIComponent(url.pathname.replace(/^\/nav\//, '/'))
  if (relative === '/data/auth.json') {
    response.writeHead(published === null ? 404 : 200, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    })
    response.end(published || '')
    return
  }
  const target = path.resolve(root, '.' + relative)
  if (target !== root && !target.startsWith(root + path.sep)) {
    response.writeHead(403)
    response.end()
    return
  }
  const exists = fs.existsSync(target) && fs.statSync(target).isFile()
  const filename = exists ? target : path.join(root, index)
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
  const content = fs.readFileSync(filename)
  response.end(
    path.extname(filename) === '.html'
      ? content
          .toString()
          .replace(/<base href="[^"]*"\s*\/?\s*>/, '<base href="/nav/">')
      : content,
  )
})
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
assert.ok(address && typeof address !== 'string')
const base = `http://127.0.0.1:${address.port}/nav/`
const hash = process.env['NAV_TEST_HASH_MODE'] === '1'
const route = (name = 'system') => base + (hash ? '#/' : '') + name
const candidates = [
  process.env['NAV_TEST_BROWSER'],
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter((value): value is string => !!value)
const browser = await puppeteer.launch({
  headless: true,
  executablePath: candidates.find((value) => fs.existsSync(value)),
  args: ['--no-sandbox'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 })
  const previews = path.resolve('tmp/admin-preview')
  fs.mkdirSync(previews, { recursive: true })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.evaluateOnNewDocument((hashMode) => {
    localStorage.setItem('language', 'zh-CN')
    ;(window as any).__HASH_MODE__ = hashMode
  }, hash)
  await page.setRequestInterception(true)
  page.on('request', async (request) => {
    const url = new URL(request.url())
    if (url.origin === new URL(base).origin || url.protocol === 'data:') {
      await request.continue()
      return
    }
    if (url.hostname !== 'api.github.com') {
      await request.abort()
      return
    }
    const headers = {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
    }
    if (request.method() === 'OPTIONS') {
      await request.respond({
        status: 204,
        headers: {
          ...headers,
          'access-control-allow-methods': 'GET, PUT, POST, DELETE, OPTIONS',
          'access-control-allow-headers': 'authorization, content-type',
        },
      })
      return
    }
    let status = 200,
      data: any
    if (url.pathname === '/user')
      data = { login: 'collaborator', email: '', avatar_url: '' }
    else if (url.pathname.endsWith('/contents/data/auth.json')) {
      if (request.method() === 'GET') {
        status = file ? 200 : 404
        data = file
          ? {
              content: Buffer.from(file.content).toString('base64'),
              sha: file.sha,
              encoding: 'base64',
              type: 'file',
            }
          : { message: 'Not Found' }
      } else {
        const body = JSON.parse(request.postData() || '{}')
        assert.equal(body.branch, config.branch)
        assert.equal(body.sha, file?.sha)
        commits.push({ path: url.pathname, body, method: request.method() })
        file =
          request.method() === 'DELETE'
            ? null
            : {
                content: Buffer.from(body.content, 'base64').toString(),
                sha: `ui-sha-${commits.length}`,
              }
        data = { commit: { sha: 'test-commit' } }
      }
    } else if (url.pathname.startsWith('/repos/'))
      data = { archived: false, permissions: { push: writable } }
    else {
      status = 404
      data = { message: 'Not Found' }
    }
    await request.respond({ status, headers, body: JSON.stringify(data) })
  })
  async function enter(selector: string, value: string) {
    await page.waitForSelector(selector)
    await page.$eval(selector, (input) => {
      ;(input as HTMLInputElement).value = ''
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await page.type(selector, value)
  }
  async function submitLogin() {
    await page.click('.ant-modal-footer .ant-btn-primary')
  }
  async function hasSession() {
    return page.evaluate(() =>
      Object.keys(sessionStorage).some((key) =>
        key.startsWith('nav:session:v1:'),
      ),
    )
  }

  await page.goto(route(), { waitUntil: 'networkidle0' })
  await page.waitForSelector('.ant-modal')
  assert.ok(
    await page.$('#nav-login-password'),
    '有效凭证时必须默认显示密码登录表单',
  )
  await enter('#nav-login-password', 'WrongPassword123')
  await submitLogin()
  await page.waitForFunction(() =>
    document.querySelector('#nav-login-error')?.textContent?.includes('密码'),
  )
  assert.equal(await hasSession(), false)
  await page.$$eval('nz-radio-group label', (labels) =>
    (labels[1] as HTMLElement).click(),
  )
  writable = false
  await enter('#nav-login-token', token)
  await submitLogin()
  await page.waitForFunction(() =>
    document.querySelector('#nav-login-error')?.textContent?.includes('写权限'),
  )
  assert.equal(await hasSession(), false)
  writable = true
  await enter('#nav-login-token', token)
  await submitLogin()
  await page.waitForSelector('.system-layout')
  assert.ok(await page.$('.admin-page-heading'), '后台应提供清晰的页面标题区')
  await page.waitForSelector('.admin-page .ant-table')
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => undefined)),
    )
  })
  await page.screenshot({ path: path.join(previews, 'website-desktop.png') })
  await page.$eval('[data-admin-route="tag"]', (item) => {
    ;((item.querySelector('a') || item) as HTMLElement).focus()
  })
  await page.keyboard.press('Enter')
  await page.waitForFunction(
    () =>
      document.querySelector('.admin-page-heading h1')?.textContent?.trim() ===
      '标签设置',
    { timeout: 2000 },
  )
  assert.equal(
    await page.$eval('[data-admin-route="tag"]', (item) =>
      item.classList.contains('ant-menu-item-selected'),
    ),
    true,
  )
  assert.equal(
    await page.$eval('.admin-page-heading h1', (heading) =>
      heading.textContent?.trim(),
    ),
    '标签设置',
  )
  assert.equal(await hasSession(), true)
  assert.equal(await page.evaluate(() => localStorage.getItem('token')), null)
  await page.goto(route('system/setting'), { waitUntil: 'networkidle0' })
  await page.waitForSelector('#nav-new-login-password')
  await page.screenshot({ path: path.join(previews, 'settings-desktop.png') })
  await page.$$eval(
    'system-setting > form > nz-tabs .ant-tabs-tab-btn',
    (tabs) => (tabs[0] as HTMLElement).click(),
  )
  await page.$eval(
    'nz-radio-group[formcontrolname="lightCardStyle"]',
    (group) => (group.querySelectorAll('label')[2] as HTMLElement).click(),
  )
  await page.waitForSelector('app-card .column2 > .bottom-bar')
  const previewIsFixed = await page.$eval(
    'app-card .column2 > .bottom-bar',
    (footer) => getComputedStyle(footer).position === 'fixed',
  )
  await page.click('.menu-toggle')
  await page.waitForFunction(
    () =>
      (document.querySelector('.sidebar')?.getBoundingClientRect().width || 0) <
      1,
  )
  await page.reload({ waitUntil: 'networkidle0' })
  assert.ok(
    await page.$eval(
      '.sidebar',
      (sidebar) => sidebar.getBoundingClientRect().width < 1,
    ),
    '桌面折叠偏好应在刷新后保留',
  )
  await page.$eval('.sidebar a', (link) => (link as HTMLElement).focus())
  const collapsedMenuIsFocusable = await page.evaluate(
    () => !!document.activeElement?.closest('.sidebar'),
  )
  assert.deepEqual(
    { previewIsFixed, collapsedMenuIsFocusable },
    { previewIsFixed: false, collapsedMenuIsFocusable: false },
    '卡片预览不能使用固定保存条样式，收起的菜单不能接收键盘焦点',
  )
  await page.setViewport({ width: 390, height: 844 })
  await page.click('.menu-toggle')
  await page.waitForFunction(
    () =>
      (document.querySelector('.sidebar')?.getBoundingClientRect().width || 0) >
      200,
  )
  await page.screenshot({ path: path.join(previews, 'menu-mobile.png') })
  await page.click('[data-admin-route="tag"]')
  await page.waitForFunction(
    () =>
      document.querySelector('.admin-page-heading h1')?.textContent?.trim() ===
        '标签设置' &&
      (document.querySelector('.sidebar')?.getBoundingClientRect().width || 0) <
        1,
  )
  await page.setViewport({ width: 1440, height: 960 })
  await page.waitForFunction(
    () =>
      (document.querySelector('.sidebar')?.getBoundingClientRect().width || 0) <
      1,
  )
  await page.click('.menu-toggle')
  await page.waitForFunction(
    () =>
      (document.querySelector('.sidebar')?.getBoundingClientRect().width || 0) >
      200,
  )
  await page.goto(route('system/tag') + '?view=labels', {
    waitUntil: 'networkidle0',
  })
  assert.equal(
    await page.$eval('[data-admin-route="tag"]', (item) =>
      item.classList.contains('ant-menu-item-selected'),
    ),
    true,
  )
  await page.goto(route('system/setting'), { waitUntil: 'networkidle0' })
  await page.waitForSelector('#nav-new-login-password')
  await page.setViewport({ width: 390, height: 844 })
  await page.waitForFunction(
    () =>
      (document.querySelector('.sidebar')?.getBoundingClientRect().width || 0) <
      1,
  )
  await page.screenshot({ path: path.join(previews, 'settings-mobile.png') })
  const fitsMobile = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  )
  if (!fitsMobile)
    console.log(
      await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        links: [...document.querySelectorAll('.admin-page a')]
          .filter(
            (element) => element.getBoundingClientRect().right > innerWidth + 1,
          )
          .map((element) => ({
            text: element.textContent,
            href: element.getAttribute('href'),
            whiteSpace: getComputedStyle(element).whiteSpace,
            parent: element.parentElement?.className,
          })),
      })),
    )
  assert.equal(fitsMobile, true, '手机页面应只在表格内部横向滚动')
  assert.equal(
    await page.$eval('.settings-save-bar', (bar) => {
      const rect = bar.getBoundingClientRect()
      return (
        rect.left >= 8 && rect.right <= innerWidth && rect.bottom <= innerHeight
      )
    }),
    true,
    '手机保存条应完整显示在屏幕内',
  )
  await page.screenshot({ path: path.join(previews, 'settings-mobile.png') })
  await page.setViewport({ width: 1440, height: 960 })
  await enter('#nav-new-login-password', 'weak')
  await enter('#nav-confirm-login-password', 'weak')
  assert.equal(
    await page.$eval(
      '[data-auth-action="save"]',
      (button) => (button as HTMLButtonElement).disabled,
    ),
    true,
  )
  const changedPassword = 'UiNewPassword2026'
  await enter('#nav-new-login-password', changedPassword)
  await enter('#nav-confirm-login-password', 'mismatch')
  assert.equal(
    await page.$eval(
      '[data-auth-action="save"]',
      (button) => (button as HTMLButtonElement).disabled,
    ),
    true,
  )
  await enter('#nav-confirm-login-password', changedPassword)
  assert.ok(file)
  file = { ...file, sha: 'another-window-sha' }
  await page.click('[data-auth-action="save"]')
  await page.waitForFunction(() =>
    document
      .querySelector('#nav-auth-management-error')
      ?.textContent?.includes('修改'),
  )
  assert.equal(
    await page.$eval(
      '#nav-new-login-password',
      (input) => (input as HTMLInputElement).value,
    ),
    changedPassword,
  )
  assert.equal(commits.length, 0)
  await page.click('[data-auth-action="reload"]')
  await page.waitForFunction(
    () =>
      !(
        document.querySelector('[data-auth-action="save"]') as HTMLButtonElement
      )?.disabled,
  )
  await page.click('[data-auth-action="save"]')
  await page.waitForFunction(() =>
    document
      .querySelector('#nav-auth-deploy-message')
      ?.textContent?.includes('部署'),
  )
  assert.equal(commits.length, 1)
  assert.ok(file)
  assert.deepEqual(
    await decryptAuth(file.content, changedPassword, authIdentity(config)),
    { token },
  )
  published = file.content
  await page.evaluate(() => sessionStorage.clear())
  await page.reload({ waitUntil: 'networkidle0' })
  await enter('#nav-login-password', changedPassword)
  await submitLogin()
  await page.waitForSelector('.system-layout')
  await page.waitForSelector('[data-auth-action="remove"]')
  await page.click('[data-auth-action="remove"]')
  await page.waitForSelector('.ant-popover-buttons .ant-btn-primary')
  await page.click('.ant-popover-buttons .ant-btn-primary')
  await page.waitForFunction(() =>
    document
      .querySelector('#nav-auth-deploy-message')
      ?.textContent?.includes('部署'),
  )
  assert.equal(commits.length, 2)
  assert.equal(file, null)
  published = null
  await page.evaluate(() => sessionStorage.clear())
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('#nav-login-token')
  assert.equal(await page.$('#nav-login-password'), null)
  published = '<html>SPA fallback</html>'
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('#nav-auth-config-error')
  assert.ok(await page.$('#nav-login-token'))
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  published = source
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('#nav-login-password')
  const screenshot = path.join(
    os.tmpdir(),
    `nav-auth-login-${hash ? 'hash' : 'history'}.png`,
  )
  await page.screenshot({ path: screenshot, fullPage: true })
  await page.screenshot({ path: path.join(previews, 'login-mobile.png') })
  assert.deepEqual(errors, [], '页面不得出现 JavaScript 运行错误')
  console.log(
    `PASS: ${hash ? 'Hash' : 'History'} 子路径、密码 / Token 登录、权限拒绝、密码校验 / 冲突 / 删除与手机布局`,
  )
  console.log(`Screenshot: ${screenshot}`)
} finally {
  await browser.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
}
