import '@angular/compiler'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import NProgress from 'nprogress'

const storage = () => {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  }
}
Object.assign(globalThis, {
  localStorage: storage(),
  sessionStorage: storage(),
  document: { baseURI: 'https://navigation.test/', hidden: false },
  location: new URL('https://navigation.test/'),
  window: globalThis,
})
NProgress.start = () => NProgress
NProgress.done = () => NProgress
const { settings } = await import('../src/store')
const { httpNav } = await import('../src/utils/http')
const { getWebInfo } = await import('../src/api')
httpNav.defaults.adapter = async (config) => ({
  config,
  data: {
    title: '默认名称',
    url: 'https://target.test/favicon.ico',
    description: '默认描述',
  },
  status: 200,
  statusText: 'OK',
  headers: {},
})

test('自定义网站接口使用字段映射并只发送网址，不发送凭证', async (t) => {
  settings.update((value) => ({
    ...value,
    webInfoApi: 'https://metadata.test/lookup',
    webInfoMethod: 'POST',
    webInfoTitlePath: 'data.name',
    webInfoIconPath: 'data.icon',
    webInfoDescriptionPath: 'data.summary',
  }))
  const fetch = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options?.method, 'POST')
    assert.equal(options?.credentials, 'omit')
    assert.equal(new Headers(options?.headers).has('Authorization'), false)
    assert.deepEqual(JSON.parse(options?.body as string), {
      url: 'https://target.test/page?a=1&b=2',
    })
    return Response.json({
      data: { name: '自定义名称', icon: '/icon.png', summary: '自定义描述' },
    })
  })
  assert.deepEqual(await getWebInfo('https://target.test/page?a=1&b=2'), {
    title: '自定义名称',
    url: 'https://target.test/icon.png',
    description: '自定义描述',
  })
  assert.equal(fetch.mock.callCount(), 1)
})

test('GET 接口编码网址参数，支持自定义参数名与数组字段', async (t) => {
  settings.update((value) => ({
    ...value,
    webInfoApi: 'https://metadata.test/lookup?target={url}',
    webInfoMethod: 'GET',
    webInfoTitlePath: 'items.0.title',
    webInfoIconPath: '',
    webInfoDescriptionPath: '',
  }))
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    assert.equal(
      new URL(String(input)).searchParams.get('target'),
      'https://target.test/?a=1&b=中文',
    )
    assert.equal(options?.body, undefined)
    return Response.json({ items: [{ title: '数组标题' }] })
  })
  assert.deepEqual(await getWebInfo('https://target.test/?a=1&b=中文'), {
    title: '数组标题',
  })
})

test('接口留空仍使用默认取数流程', async (t) => {
  settings.update((value) => ({ ...value, webInfoApi: '' }))
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('不应调用')
  })
  assert.deepEqual(await getWebInfo('https://target.test/'), {
    title: '默认名称',
    url: 'https://target.test/favicon.ico',
    description: '默认描述',
  })
  assert.equal(fetch.mock.callCount(), 0)
})

test('自定义接口拒绝危险地址和非法路径，不发请求', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({}),
  )
  for (const webInfoApi of [
    'javascript:alert(1)',
    'file:///tmp/api',
    'https://user:pass@metadata.test/api',
    'http://metadata.test/api',
  ]) {
    await assert.rejects(
      getWebInfo('https://target.test/', {
        webInfoApi,
        webInfoMethod: 'GET',
        webInfoTitlePath: 'title',
      }),
    )
  }
  await assert.rejects(
    getWebInfo('https://target.test/', {
      webInfoApi: 'https://metadata.test/api',
      webInfoMethod: 'GET',
      webInfoTitlePath: '__proto__.title',
    }),
  )
  assert.equal(fetch.mock.callCount(), 0)
})

test('GET 默认追加 url 参数，忽略非文本字段和危险图标地址', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input) => {
    assert.equal(
      new URL(String(input)).searchParams.get('url'),
      'https://target.test/',
    )
    return Response.json({
      title: '  有效名称  ',
      icon: 'javascript:alert(1)',
      description: { text: '不是文本' },
    })
  })
  assert.deepEqual(
    await getWebInfo('https://target.test/', {
      webInfoApi: 'https://metadata.test/api',
      webInfoMethod: 'GET',
      webInfoTitlePath: 'title',
      webInfoIconPath: 'icon',
      webInfoDescriptionPath: 'description',
    }),
    { title: '有效名称' },
  )
})

test('接口错误、无匹配字段和超时会结束请求并反馈失败', async (t) => {
  const options = {
    webInfoApi: 'https://metadata.test/api',
    webInfoMethod: 'GET' as const,
    webInfoTitlePath: 'title',
  }
  const fetch = t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('', { status: 503 }),
  )
  await assert.rejects(getWebInfo('https://target.test/', options), /503/)
  fetch.mock.mockImplementation(async () => Response.json({ data: '缺少字段' }))
  await assert.rejects(getWebInfo('https://target.test/', options), /字段映射/)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  fetch.mock.mockImplementation(
    async (_url, init) =>
      new Promise((_resolve, reject) => {
        init!.signal!.addEventListener(
          'abort',
          () => reject(new Error('Aborted')),
          { once: true },
        )
      }),
  )
  const pending = assert.rejects(
    getWebInfo('https://target.test/', options),
    /Aborted/,
  )
  t.mock.timers.tick(15000)
  await pending
})
