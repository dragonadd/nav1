import { pickByPath } from './daily-text'

export interface WebInfoSettings {
  webInfoApi?: string
  webInfoMethod?: 'GET' | 'POST'
  webInfoTitlePath?: string
  webInfoIconPath?: string
  webInfoDescriptionPath?: string
}
export interface WebInfo {
  title?: string
  url?: string
  description?: string
}

export function initializeWebInfoSettings(settings: WebInfoSettings): void {
  settings.webInfoApi ??= ''
  settings.webInfoMethod ??= 'POST'
  settings.webInfoTitlePath ??= 'title'
  settings.webInfoIconPath ??= 'url'
  settings.webInfoDescriptionPath ??= 'description'
}

export function validateWebInfoSettings(settings: WebInfoSettings): void {
  if (!settings.webInfoApi?.trim()) return
  const endpoint = new URL(
    settings.webInfoApi.replaceAll('{url}', 'https%3A%2F%2Fexample.com'),
  )
  if (
    !['http:', 'https:'].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password
  )
    throw new Error('网站信息接口需使用 HTTP(S) 地址，不能包含登录凭证')
  if (
    globalThis.location?.protocol === 'https:' &&
    endpoint.protocol !== 'https:'
  )
    throw new Error('HTTPS 网站需要使用 HTTPS 接口')
  if (settings.webInfoMethod !== 'GET' && settings.webInfoMethod !== 'POST')
    throw new Error('接口请求方式必须是 GET 或 POST')
  const paths = [
    settings.webInfoTitlePath,
    settings.webInfoIconPath,
    settings.webInfoDescriptionPath,
  ]
  if (!paths.some((path) => path?.trim()))
    throw new Error('至少填写一个返回字段路径')
  for (const path of paths) {
    if (
      path &&
      (!/^[\w$-]+(?:\.[\w$-]+)*$/.test(path) ||
        path.length > 200 ||
        path
          .split('.')
          .some((part) =>
            ['__proto__', 'constructor', 'prototype'].includes(part),
          ))
    )
      throw new Error('字段路径使用 data.title 这样的点号格式；可留空跳过字段')
  }
}

export async function requestCustomWebInfo(
  target: string,
  settings: WebInfoSettings,
): Promise<WebInfo> {
  validateWebInfoSettings(settings)
  const website = new URL(target)
  if (
    !['http:', 'https:'].includes(website.protocol) ||
    website.username ||
    website.password
  )
    throw new Error('请输入有效的 HTTP(S) 网站链接')
  const template = settings.webInfoApi!.trim()
  const endpoint = new URL(
    template.replaceAll('{url}', encodeURIComponent(target)),
  )
  if (settings.webInfoMethod === 'GET' && !template.includes('{url}'))
    endpoint.searchParams.set('url', target)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(endpoint.href, {
      method: settings.webInfoMethod,
      credentials: 'omit',
      signal: controller.signal,
      headers:
        settings.webInfoMethod === 'POST'
          ? { 'Content-Type': 'application/json', Accept: 'application/json' }
          : { Accept: 'application/json' },
      body:
        settings.webInfoMethod === 'POST'
          ? JSON.stringify({ url: target })
          : undefined,
    })
    if (!response.ok) throw new Error(`网站信息接口返回 ${response.status}`)
    const data: unknown = await response.json()
    const result: WebInfo = {}
    for (const [key, path] of [
      ['title', settings.webInfoTitlePath],
      ['url', settings.webInfoIconPath],
      ['description', settings.webInfoDescriptionPath],
    ] as const) {
      const value = path ? pickByPath(data, path) : undefined
      if (typeof value !== 'string' || !value.trim()) continue
      if (key === 'url') {
        try {
          const icon = new URL(value.trim(), website)
          if (
            ['http:', 'https:'].includes(icon.protocol) &&
            !icon.username &&
            !icon.password
          )
            result.url = icon.href
        } catch {}
      } else result[key] = value.trim()
    }
    if (!Object.keys(result).length)
      throw new Error('未获取到网站信息，请检查返回内容和字段映射')
    return result
  } finally {
    clearTimeout(timer)
  }
}
