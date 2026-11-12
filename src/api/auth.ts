import { decode, encode } from 'js-base64'
import config from '../../nav.config.json'
import http from 'src/utils/http'
import { AUTH_PATH, getRepositories, parseAuth } from 'src/utils/admin-auth'
import { requestActionUrl } from './index'

export interface AuthFile {
  content: string
  sha: string
  lastCommit?: string
}

function fileUrl() {
  const repo = getRepositories(config).main
  return repo.provider === 'gitlab'
    ? `/projects/${encodeURIComponent(repo.projectId)}/repository/files/${encodeURIComponent(AUTH_PATH)}`
    : `/repos/${repo.owner}/${repo.repo}/contents/${AUTH_PATH}`
}

export async function getAuthFile(): Promise<AuthFile | null> {
  const response = await http.get(fileUrl(), {
    params: { ref: config.branch, t: Date.now() },
    validateStatus: (status) =>
      status === 404 || (status >= 200 && status < 300),
  })
  if (response.status === 404) return null
  const data = response.data
  const sha =
    getRepositories(config).main.provider === 'gitlab'
      ? data?.blob_id
      : data?.sha
  if (
    !data ||
    Array.isArray(data) ||
    typeof data.content !== 'string' ||
    typeof sha !== 'string' ||
    !sha
  )
    throw new Error('无法读取登录凭证的文件版本，请刷新后重试')
  return {
    content: decode(data.content),
    sha,
    ...(data.last_commit_id ? { lastCommit: data.last_commit_id } : {}),
  }
}

export async function commitAuthFile(
  content: string | null,
  expected: AuthFile | null,
): Promise<void> {
  if (content !== null) parseAuth(content)
  const current = await getAuthFile()
  const repo = getRepositories(config).main
  if (
    (current?.sha ?? null) !== (expected?.sha ?? null) ||
    (repo.provider === 'gitlab' &&
      (current?.lastCommit ?? null) !== (expected?.lastCommit ?? null))
  )
    throw new Error(
      '登录凭证已被其他窗口修改，请重新读取后重试；当前输入已保留',
    )
  if (content === null && !current)
    throw new Error('登录密码已移除，请刷新状态')
  const message =
    content === null
      ? 'remove admin login password'
      : 'update admin login password'
  if (repo.provider === 'gitlab') {
    if (expected && !expected.lastCommit)
      throw new Error('无法获取 GitLab 文件提交版本，请重新读取后重试')
    await http.post(
      `/projects/${encodeURIComponent(repo.projectId)}/repository/commits`,
      {
        branch: repo.branch,
        commit_message: message,
        actions: [
          {
            action: content === null ? 'delete' : current ? 'update' : 'create',
            file_path: AUTH_PATH,
            ...(content !== null
              ? { content: encode(content), encoding: 'base64' }
              : {}),
            ...(expected?.lastCommit
              ? { last_commit_id: expected.lastCommit }
              : {}),
          },
        ],
      },
    )
  } else {
    const data = {
      branch: repo.branch,
      message,
      ...(expected ? { sha: expected.sha } : {}),
      ...(content !== null ? { content: encode(content) } : {}),
    }
    if (content === null) {
      await http.delete(
        fileUrl(),
        repo.provider === 'gitee' ? { params: data } : { data },
      )
    } else if (repo.provider === 'gitee' && !current) {
      await http.post(fileUrl(), data)
    } else {
      await http.put(fileUrl(), data)
    }
  }
  requestActionUrl()
}
