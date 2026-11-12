import fs from 'node:fs'
import path from 'node:path'
import { AUTH_PATH, AUTH_MAX_LENGTH, parseAuth } from '../src/utils/admin-auth'

export function prepareAuth(root = process.cwd()): void {
  const source = path.join(root, AUTH_PATH)
  const directory = path.join(root, 'src/generated/auth')
  const target = path.join(directory, 'auth.json')
  fs.mkdirSync(directory, { recursive: true })
  // 先移除旧输出，避免无效或已删除的凭证被下一次构建发布。
  fs.rmSync(target, { force: true })
  if (!fs.existsSync(source)) return
  if (fs.statSync(source).size > AUTH_MAX_LENGTH)
    throw new Error('登录凭证文件过大，停止构建')
  const content = fs.readFileSync(source, 'utf8')
  if (!content.trim()) return
  parseAuth(content)
  fs.writeFileSync(target, content)
}
