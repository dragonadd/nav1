// 后台凭证加密参考 NavBlog，使用独立格式，不与博客凭证互通。
export const AUTH_PATH = 'data/auth.json'
export const AUTH_MAX_LENGTH = 8192
const ITERATIONS = 600_000
const FORMAT = 'nav-auth'

export interface AuthCredentials {
  token: string
  imageToken?: string
}

export interface AuthConfig {
  gitRepoUrl: string
  imageRepoUrl?: string
  branch: string
  address?: string
}

export interface GitRepository {
  provider: 'github' | 'gitee' | 'gitlab'
  host: string
  owner: string
  repo: string
  branch: string
  projectId: string
}

interface AuthPayload {
  format: 'nav-auth'
  version: 1
  cipher: 'AES-GCM'
  kdf: 'PBKDF2-SHA-256'
  iterations: number
  salt: string
  iv: string
  ciphertext: string
}

function repository(source: string, branch: string): GitRepository {
  const url = new URL(source)
  const providers = {
    'github.com': 'github',
    'gitee.com': 'gitee',
    'gitlab.com': 'gitlab',
  } as const
  const provider = providers[url.hostname as keyof typeof providers]
  const parts = url.pathname
    .replace(/\/$/, '')
    .replace(/\.git$/, '')
    .split('/')
    .filter(Boolean)
  const projectId = url.searchParams.get('projectId') || ''
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    !provider ||
    parts.length < 2 ||
    !branch ||
    (provider !== 'gitlab' && parts.length !== 2) ||
    (provider === 'gitlab' && !projectId)
  )
    throw new Error('请配置正确的 Git 仓库、分支；GitLab 还需要 projectId')
  return {
    provider,
    host: url.hostname,
    owner: parts.slice(0, -1).join('/'),
    repo: parts.at(-1)!,
    branch,
    projectId,
  }
}

export function getRepositories(config: AuthConfig) {
  const main = repository(config.gitRepoUrl, config.branch)
  const image = config.imageRepoUrl
    ? repository(
        config.imageRepoUrl,
        new URL(config.imageRepoUrl).searchParams.get('branch') || 'image',
      )
    : { ...main, branch: 'image' }
  return { main, image }
}

export function authIdentity(config: AuthConfig): string {
  const { main, image } = getRepositories(config)
  return JSON.stringify(
    [main, image].map((repo) => [
      repo.provider,
      repo.host,
      repo.owner,
      repo.repo,
      repo.branch,
      repo.projectId,
    ]),
  )
}

export function validLoginPassword(value: string): boolean {
  return (
    Array.from(value).length >= 8 && /[a-z]/i.test(value) && /[0-9]/.test(value)
  )
}

export function validateTokenText(value: string): string {
  const token = value.trim()
  // eslint-disable-next-line no-control-regex -- Git 凭证必须拒绝控制字符。
  if (!token || token.length > 2048 || /[\s\u0000-\u001f\u007f]/.test(token))
    throw new Error('Token 格式无效')
  return token
}

function credentials(value: AuthCredentials): AuthCredentials {
  if (
    !value ||
    typeof value.token !== 'string' ||
    Object.keys(value).some((key) => key !== 'token' && key !== 'imageToken') ||
    (value.imageToken !== undefined && typeof value.imageToken !== 'string')
  )
    throw new Error('登录凭证内容无效')
  return {
    token: validateTokenText(value.token),
    ...(value.imageToken !== undefined
      ? { imageToken: validateTokenText(value.imageToken) }
      : {}),
  }
}

function base64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(binary)
}

function unbase64(value: unknown): Uint8Array<ArrayBuffer> {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  )
    throw new Error('加密数据损坏')
  const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
  if (base64(bytes) !== value) throw new Error('加密数据损坏')
  return bytes
}

export function parseAuth(source: string): AuthPayload {
  try {
    if (source.length > AUTH_MAX_LENGTH) throw new Error()
    const payload = JSON.parse(source)
    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload) ||
      Object.keys(payload).sort().join(',') !==
        'cipher,ciphertext,format,iterations,iv,kdf,salt,version' ||
      payload.format !== FORMAT ||
      payload.version !== 1 ||
      payload.cipher !== 'AES-GCM' ||
      payload.kdf !== 'PBKDF2-SHA-256' ||
      payload.iterations !== ITERATIONS ||
      unbase64(payload.salt).length !== 16 ||
      unbase64(payload.iv).length !== 12 ||
      unbase64(payload.ciphertext).length < 16
    )
      throw new Error()
    return payload
  } catch {
    throw new Error('登录凭证损坏或版本不支持，请使用 Token 登录并重新设置密码')
  }
}

function cryptoApi(): Crypto {
  if (!globalThis.crypto?.subtle)
    throw new Error('当前环境不支持加密，请使用 HTTPS 或 localhost')
  return globalThis.crypto
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  usage: 'encrypt' | 'decrypt',
) {
  const crypto = cryptoApi()
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  )
}

export async function encryptAuth(
  value: AuthCredentials,
  password: string,
  identity: string,
): Promise<string> {
  if (!validLoginPassword(password))
    throw new Error('密码至少 8 个字符，且必须包含字母和数字')
  const text = JSON.stringify(credentials(value))
  const crypto = cryptoApi(),
    salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: new TextEncoder().encode(`${FORMAT}:v1:${identity}`),
      tagLength: 128,
    },
    await deriveKey(password, salt, 'encrypt'),
    new TextEncoder().encode(text),
  )
  const source = JSON.stringify(
    {
      format: FORMAT,
      version: 1,
      cipher: 'AES-GCM',
      kdf: 'PBKDF2-SHA-256',
      iterations: ITERATIONS,
      salt: base64(salt),
      iv: base64(iv),
      ciphertext: base64(new Uint8Array(encrypted)),
    },
    null,
    2,
  )
  parseAuth(source)
  return source
}

export async function decryptAuth(
  source: string,
  password: string,
  identity: string,
): Promise<AuthCredentials> {
  const payload = parseAuth(source),
    crypto = cryptoApi()
  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: unbase64(payload.iv),
        additionalData: new TextEncoder().encode(`${FORMAT}:v1:${identity}`),
        tagLength: 128,
      },
      await deriveKey(password, unbase64(payload.salt), 'decrypt'),
      unbase64(payload.ciphertext),
    )
    return credentials(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decrypted)),
    )
  } catch {
    throw new Error('密码错误，或凭证与当前仓库 / 分支 / 图床不匹配')
  }
}

export async function loadPublicAuth(baseURI: string): Promise<string | null> {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 8000)
  try {
    const url = new URL(AUTH_PATH, baseURI)
    url.searchParams.set('t', String(Date.now()))
    url.searchParams.set('ngsw-bypass', 'true')
    const response = await fetch(url.href, {
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    })
    if (response.status === 404 || response.status === 204) return null
    if (!response.ok)
      throw new Error(
        `登录配置读取失败（${response.status}），可使用 Token 登录`,
      )
    if (Number(response.headers.get('content-length')) > AUTH_MAX_LENGTH)
      throw new Error('登录配置过大')
    const source = await response.text()
    if (!source.trim()) return null
    if (
      /^\s*</.test(source) ||
      /text\/html/i.test(response.headers.get('content-type') || '')
    )
      throw new Error('登录配置返回了 HTML，请检查部署；可使用 Token 登录')
    parseAuth(source)
    return source
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error('登录配置读取超时，可重试或使用 Token 登录')
    throw error
  } finally {
    clearTimeout(timer)
  }
}
