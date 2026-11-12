import type { AuthConfig, AuthCredentials } from './admin-auth'

export function sessionKey(config: AuthConfig, baseURI: string): string {
  return `nav:session:v1:${new URL(baseURI).pathname}:${JSON.stringify([config.gitRepoUrl, config.branch, config.imageRepoUrl || '', config.address || ''])}`
}

export function readSession(key: string): AuthCredentials | null {
  try {
    const source = globalThis.sessionStorage.getItem(key)
    if (!source) return null
    const value = JSON.parse(source)
    if (
      !value ||
      typeof value.token !== 'string' ||
      !value.token.trim() ||
      Object.keys(value).some(
        (field) => field !== 'token' && field !== 'imageToken',
      ) ||
      (value.imageToken !== undefined && typeof value.imageToken !== 'string')
    )
      return null
    return value
  } catch {
    return null
  }
}

export function writeSession(key: string, value: AuthCredentials): void {
  if (!value.token.trim()) throw new Error('登录凭证无效')
  try {
    globalThis.sessionStorage.setItem(
      key,
      JSON.stringify({
        token: value.token,
        ...(value.imageToken ? { imageToken: value.imageToken } : {}),
      }),
    )
  } catch {
    throw new Error('无法保存当前标签页会话，请允许 sessionStorage 后重试')
  }
}

export function clearSession(key: string): void {
  try {
    globalThis.sessionStorage.removeItem(key)
  } catch {}
}
