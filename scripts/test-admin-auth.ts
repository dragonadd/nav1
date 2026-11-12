import assert from 'node:assert/strict'

const modulePath = '../src/utils/admin-auth.ts'
const auth = await import(modulePath).catch(() => ({}))
assert.equal(typeof auth.encryptAuth, 'function', '后台凭证加密能力尚未实现')

const config = {
  gitRepoUrl: 'https://github.com/dragonadd/nav1',
  imageRepoUrl: 'https://github.com/dragonadd/nav1?branch=images',
  branch: 'main',
  address: '',
}
const identity = auth.authIdentity(config)
assert.equal(
  identity,
  '[["github","github.com","dragonadd","nav1","main",""],["github","github.com","dragonadd","nav1","images",""]]',
)
for (const [password, valid] of [
  ['', false],
  ['abc1234', false],
  ['abcdefgh', false],
  ['12345678', false],
  ['abcd1234', true],
  ['中文密码Ab12', true],
] as const)
  assert.equal(auth.validLoginPassword(password), valid)
assert.throws(() =>
  auth.getRepositories({
    ...config,
    gitRepoUrl: 'https://github.evil.test/a/b',
  }),
)
assert.throws(() => auth.getRepositories({ ...config, branch: '' }))
assert.throws(() => auth.validateTokenText('a b'))
assert.throws(() => auth.validateTokenText('a\nb'))
assert.equal(auth.validateTokenText('  token\n'), 'token')
assert.throws(() => auth.validateTokenText('x'.repeat(2049)))

const credentials = {
  token: 'ghp_NAV_AUTH_TEST_ONLY_12345',
  imageToken: 'img_TEST_ONLY_67890',
}
const password = 'NavAuthTest_2026'
const encrypted = await auth.encryptAuth(credentials, password, identity)
const second = await auth.encryptAuth(credentials, password, identity)
const payload = auth.parseAuth(encrypted)
assert.equal(payload.format, 'nav-auth')
assert.equal(payload.iterations, 600000)
assert.notEqual(payload.salt, auth.parseAuth(second).salt)
assert.notEqual(payload.iv, auth.parseAuth(second).iv)
for (const secret of [...Object.values(credentials), password])
  assert.ok(!encrypted.includes(secret))
assert.deepEqual(
  await auth.decryptAuth(encrypted, password, identity),
  credentials,
)
await assert.rejects(auth.decryptAuth(encrypted, 'WrongPassword1', identity))
await assert.rejects(
  auth.decryptAuth(
    encrypted,
    password,
    auth.authIdentity({ ...config, branch: 'test' }),
  ),
)
await assert.rejects(
  auth.decryptAuth(
    encrypted,
    password,
    auth.authIdentity({
      ...config,
      imageRepoUrl: 'https://github.com/dragonadd/other?branch=images',
    }),
  ),
)
await assert.rejects(auth.encryptAuth(credentials, 'weak', identity))
await assert.rejects(auth.encryptAuth({ token: 'a b' }, password, identity))
for (const changed of [
  { ...payload, password },
  { ...payload, format: 'navblog-auth' },
  { ...payload, iterations: 1 },
  { ...payload, iv: '!!!!' },
  { ...payload, salt: btoa('short') },
])
  assert.throws(() => auth.parseAuth(JSON.stringify(changed)))
assert.throws(() => auth.parseAuth(' '.repeat(8193)))

const originalFetch = globalThis.fetch
let requested: { url: string; options: RequestInit } | undefined
try {
  globalThis.fetch = (async (url, options) => {
    requested = { url: String(url), options: options || {} }
    return new Response(encrypted, {
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
  assert.equal(
    await auth.loadPublicAuth('https://example.test/nav1/'),
    encrypted,
  )
  const url = new URL(requested!.url)
  assert.equal(url.pathname, '/nav1/data/auth.json')
  assert.ok(url.searchParams.has('t'))
  assert.equal(url.searchParams.get('ngsw-bypass'), 'true')
  assert.equal(requested!.options.cache, 'no-store')
  assert.equal(requested!.options.credentials, 'omit')
  for (const response of [
    new Response(null, { status: 404 }),
    new Response(null, { status: 204 }),
    new Response('  '),
  ]) {
    globalThis.fetch = (async () => response) as typeof fetch
    assert.equal(await auth.loadPublicAuth('https://example.test/'), null)
  }
  for (const response of [
    new Response('<html>SPA fallback</html>', {
      headers: { 'content-type': 'text/html' },
    }),
    new Response('{"token":"plaintext"}'),
    new Response('failed', { status: 500 }),
    new Response(encrypted, { headers: { 'content-length': '999999' } }),
  ]) {
    globalThis.fetch = (async () => response) as typeof fetch
    await assert.rejects(auth.loadPublicAuth('https://example.test/'))
  }
  globalThis.fetch = (async () => {
    throw new TypeError('offline')
  }) as typeof fetch
  await assert.rejects(auth.loadPublicAuth('https://example.test/'))
} finally {
  globalThis.fetch = originalFetch
}

const sessionModule = '../src/utils/auth-session.ts'
const session = await import(sessionModule).catch(() => ({}))
assert.equal(typeof session.writeSession, 'function', '标签页凭证存储尚未实现')
const memory = new Map<string, string>()
const storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value)
  },
  removeItem: (key: string) => {
    memory.delete(key)
  },
}
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: storage,
})
const key = session.sessionKey(config, 'https://example.test/nav1/')
session.writeSession(key, credentials)
assert.deepEqual(session.readSession(key), credentials)
assert.equal(
  session.readSession(
    session.sessionKey(
      { ...config, branch: 'test' },
      'https://example.test/nav1/',
    ),
  ),
  null,
)
assert.equal(
  session.readSession(
    session.sessionKey(config, 'https://example.test/other/'),
  ),
  null,
)
session.clearSession(key)
assert.equal(session.readSession(key), null)
memory.set(key, '{"password":"must not become a session"}')
assert.equal(session.readSession(key), null)
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  get() {
    throw new Error('blocked')
  },
})
assert.equal(session.readSession(key), null)
assert.throws(() => session.writeSession(key, credentials), /sessionStorage/)
assert.doesNotThrow(() => session.clearSession(key))

console.log('PASS: 密码规则、真实加解密 / 身份隔离、公开配置异常和标签页会话')
