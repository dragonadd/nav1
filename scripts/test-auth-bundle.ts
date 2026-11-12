import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { encryptAuth } from '../src/utils/admin-auth'

const generated = path.resolve('src/generated/auth/auth.json')
const output = path.resolve('dist/browser/data/auth.json')
assert.ok(fs.existsSync('src/index.html'), '请先运行 pnpm run build')
const original = fs.existsSync(generated) ? fs.readFileSync(generated) : null
const token = 'BUNDLE_TEST_ONLY_TOKEN_12345',
  password = 'BundleTestPassword2026'
const encrypted = await encryptAuth(
  { token },
  password,
  'bundle-test-repository',
)
function build() {
  const result = spawnSync(
    process.execPath,
    [
      path.resolve('node_modules/@angular/cli/bin/ng.js'),
      'build',
      '--index',
      'src/index.html',
    ],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
  )
  assert.equal(result.status, 0, (result.stdout + result.stderr).slice(-4000))
}
function check(directory: string) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) check(filename)
    else if (/\.(html|js|json)$/.test(filename)) {
      const text = fs.readFileSync(filename, 'utf8')
      assert.ok(
        !text.includes(token),
        `公开产物包含测试明文 Token: ${filename}`,
      )
      assert.ok(
        !text.includes(password),
        `公开产物包含测试明文密码: ${filename}`,
      )
    }
  }
}
try {
  fs.mkdirSync(path.dirname(generated), { recursive: true })
  fs.writeFileSync(generated, encrypted)
  build()
  assert.equal(fs.readFileSync(output, 'utf8'), encrypted)
  check(path.resolve('dist/browser'))
} finally {
  if (original) fs.writeFileSync(generated, original)
  else fs.rmSync(generated, { force: true })
  build()
}
if (original) assert.deepEqual(fs.readFileSync(output), original)
else assert.ok(!fs.existsSync(output), '恢复构建必须清理测试凭证')
console.log('PASS: 真实生产产物单独发布密文、不包含明文凭证，并清理测试资源')
