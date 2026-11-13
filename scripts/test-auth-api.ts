import '@angular/compiler'
import assert from 'node:assert/strict'
import { AxiosError } from 'axios'
import NProgress from 'nprogress'
import { authIdentity, decryptAuth } from '../src/utils/admin-auth'

function storage(initial: [string, string][] = []) {
  const memory = new Map(initial)
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
    key: (index: number) => [...memory.keys()][index] ?? null,
    get length() {
      return memory.size
    },
  }
}
const local = storage([
  ['token', 'LEGACY_TEST_TOKEN'],
  ['IMAGE_TOKEN', 'LEGACY_TEST_IMAGE_TOKEN'],
])
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: local,
})
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: storage(),
})
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: { baseURI: 'https://site.test/nav/', hidden: false },
})
Object.defineProperty(globalThis, 'location', {
  configurable: true,
  value: new URL('https://site.test/nav/'),
})
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: globalThis,
})
NProgress.start = () => NProgress
NProgress.done = () => NProgress

const { default: config } = await import('../nav.config.json')
const expectedBranch = config.branch
assert.ok(
  typeof expectedBranch === 'string' && expectedBranch.length > 0,
  'API 必须使用初始化生成的实际部署分支',
)
const originalConfig = { ...config }
const { default: http } = await import('../src/utils/http.ts')
const api = await import('../src/api/index.ts')
const user = await import('../src/utils/user.ts')
const { settings } = await import('../src/store/index.ts')
settings.update((value) => ({ ...value, actionUrl: '' }))
assert.equal(local.getItem('token'), null, '升级必须清除旧的明文主 Token')
assert.equal(
  local.getItem('IMAGE_TOKEN'),
  null,
  '升级必须清除旧的明文图床 Token',
)

let writable = true,
  archived = false,
  imageDenied = false
let file: { content: string; sha: string; lastCommit?: string } | null = null
let writes: { method: string; url: string; body: any; params: any }[] = []
let blockedRequest: Promise<void> | null = null
let onRequest: (() => void) | null = null
http.defaults.adapter = async (request) => {
  if (blockedRequest) {
    onRequest?.()
    await blockedRequest
  }
  const url = request.url || '',
    method = request.method || 'get'
  const body =
    typeof request.data === 'string' ? JSON.parse(request.data) : request.data
  let status = 200,
    data: any
  if (url === '/user')
    data = {
      login: 'collaborator',
      username: 'collaborator',
      email: 'test@example.test',
      avatar_url: '',
    }
  else if (url.endsWith('/contents/data/settings.json')) {
    if (method === 'get') {
      assert.equal(
        request.params.ref,
        expectedBranch,
        '普通设置读取必须使用部署分支',
      )
      data = { sha: 'settings-sha' }
    } else {
      writes.push({ method, url, body, params: request.params })
      data = { commit: { sha: 'test-settings-commit' } }
    }
  } else if (
    /\/contents\/data\/auth\.json$|\/repository\/files\/data%2Fauth\.json$/.test(
      url,
    ) &&
    method === 'get'
  ) {
    assert.equal(request.params.ref, config.branch)
    if (!file) {
      status = 404
      data = { message: 'Not Found' }
    } else
      data = {
        type: 'file',
        encoding: 'base64',
        content: btoa(file.content),
        sha: file.sha,
        blob_id: file.sha,
        last_commit_id: file.lastCommit,
      }
  } else if (
    (url.includes('/contents/data/auth.json') ||
      url.endsWith('/repository/commits')) &&
    method !== 'get'
  ) {
    writes.push({ method, url, body, params: request.params })
    const action = body?.actions?.[0]
    const removed = method === 'delete' || action?.action === 'delete'
    file = removed
      ? null
      : {
          content: atob(action?.content || body.content),
          sha: 'new-sha',
          lastCommit: 'new-commit',
        }
    data = { commit: { sha: 'test-commit' } }
  } else if (/^\/repos\/|^\/projects\//.test(url)) {
    const allowed =
      writable && !(imageDenied && request.baseURL?.includes('gitee.com'))
    data = {
      archived,
      permissions: {
        push: allowed,
        project_access: { access_level: allowed ? 30 : 20 },
        group_access: { access_level: 0 },
      },
    }
  } else throw new Error(`Unexpected test API route: ${method} ${url}`)
  const response = {
    data,
    status,
    statusText: status === 404 ? 'Not Found' : 'OK',
    headers: {},
    config: request,
  }
  if (request.validateStatus && !request.validateStatus(status))
    throw new AxiosError(
      'Test API rejected request',
      'ERR_BAD_REQUEST',
      request,
      undefined,
      response,
    )
  return response
}

const token = 'AUTH_API_TEST_ONLY_TOKEN_12345',
  password = 'AuthApiTest2026'
writable = false
await assert.rejects(
  api.verifyToken(token),
  /写权限|归档/,
  '只读 Token 不能通过后台认证',
)
writable = true
archived = true
await assert.rejects(api.verifyToken(token), /写权限|归档/)
archived = false
assert.equal(
  (await api.verifyToken(token)).data.login,
  'collaborator',
  '有写权限的协作者可以管理仓库',
)

const servicePath = '../src/services/auth.ts'
const { AuthService } = await import(servicePath)
const fileApiPath = '../src/api/auth.ts'
const { getAuthFile, commitAuthFile } = await import(fileApiPath)
const auth = new AuthService()
await auth.login({ token })
assert.equal(user.getToken(), token)
assert.equal(local.getItem('token'), null)
await api.updateFileContent({
  path: 'data/settings.json',
  content: '{}',
  message: 'deployment branch settings save',
})
assert.equal(
  writes.at(-1)?.body.branch,
  expectedBranch,
  '普通后台保存必须提交当前部署分支',
)
user.removeToken()

config.imageRepoUrl = 'https://gitee.com/dragonadd/images?branch=main'
imageDenied = true
await assert.rejects(
  auth.login({ token, imageToken: 'IMAGE_API_TEST_ONLY_12345' }),
  /写权限|归档/,
)
assert.equal(user.getToken(), '', '图床校验失败不能保存主 Token')
assert.equal(user.getImageToken(), '', '图床校验失败不能保存图床 Token')
imageDenied = false
Object.assign(config, originalConfig)

let release!: () => void, entered!: () => void
blockedRequest = new Promise<void>((resolve) => {
  release = resolve
})
const started = new Promise<void>((resolve) => {
  entered = resolve
})
onRequest = entered
const pending = auth.login({ token })
await started
auth.cancelPendingLogin()
release()
await assert.rejects(pending, /取消/)
assert.equal(user.getToken(), '')
blockedRequest = null
onRequest = null

const realSession = globalThis.sessionStorage
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  get() {
    throw new Error('blocked')
  },
})
await assert.rejects(auth.login({ token }), /sessionStorage/)
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: realSession,
})
assert.equal(user.getToken(), '')
await auth.login({ token })

try {
  for (const git of [
    {
      gitRepoUrl: 'https://github.com/dragonadd/nav1',
      imageRepoUrl: 'https://github.com/dragonadd/nav1?branch=images',
    },
    {
      gitRepoUrl: 'https://gitee.com/dragonadd/nav1',
      imageRepoUrl: 'https://gitee.com/dragonadd/nav1?branch=images',
    },
    {
      gitRepoUrl: 'https://gitlab.com/team/nav1?projectId=1001',
      imageRepoUrl: 'https://gitlab.com/team/nav1?projectId=1001&branch=images',
    },
  ]) {
    Object.assign(config, git)
    await auth.login({ token })
    file = null
    writes = []
    assert.equal(await auth.loadManagement(), 'unset')
    await assert.rejects(auth.setPassword('weak', 'weak'))
    await assert.rejects(auth.setPassword(password, 'mismatch'))
    await auth.setPassword(password, password)
    assert.equal(writes.length, 1)
    assert.equal(
      writes[0].body.branch,
      expectedBranch,
      '密码管理必须提交当前部署分支',
    )
    const saved = file as {
      content: string
      sha: string
      lastCommit?: string
    } | null
    assert.ok(saved)
    assert.deepEqual(
      await decryptAuth(saved.content, password, authIdentity(config)),
      { token },
    )
    assert.ok(!saved.content.includes(password))
    assert.ok(!saved.content.includes(token))
    assert.equal(await auth.loadManagement(), 'set')
    file = {
      ...saved,
      sha: 'other-window-sha',
      lastCommit: 'other-window-commit',
    }
    await assert.rejects(auth.setPassword(password, password), /修改|冲突/)
    assert.equal(writes.length, 1, '旧版本不能覆盖另一窗口修改')
    await auth.loadManagement()
    await auth.removePassword()
    assert.equal(file, null)
    const removed = writes[1]
    if (config.gitRepoUrl.includes('gitlab.com')) {
      assert.equal(removed.body.actions[0].action, 'delete')
      assert.equal(
        removed.body.actions[0].last_commit_id,
        'other-window-commit',
      )
    } else
      assert.equal((removed.body || removed.params).sha, 'other-window-sha')
    assert.equal(await getAuthFile(), null)
    await assert.rejects(commitAuthFile('{"token":"plaintext"}', null))
  }
} finally {
  Object.assign(config, originalConfig)
  user.removeToken()
}

console.log(
  'PASS: 仓库权限、协作者、图床失败、登录取消 / 存储失败、三平台凭证提交与冲突保护',
)
