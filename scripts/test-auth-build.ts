import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const modulePath = './prepare-auth.ts'
const build = await import(modulePath).catch(() => ({}))
assert.equal(typeof build.prepareAuth, 'function', '静态凭证构建尚未实现')
const { encryptAuth } = await import('../src/utils/admin-auth.ts')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nav-auth-build-'))
const source = path.join(root, 'data/auth.json')
const generated = path.join(root, 'src/generated/auth/auth.json')
try {
  fs.mkdirSync(path.dirname(source), { recursive: true })
  build.prepareAuth(root)
  assert.ok(!fs.existsSync(generated))
  const password = 'AuthBuildTest2026'
  const token = 'TEST_ONLY_BUILD_TOKEN_12345'
  const ciphertext = await encryptAuth({ token }, password, 'test-repository')
  fs.writeFileSync(source, ciphertext)
  build.prepareAuth(root)
  assert.equal(fs.readFileSync(generated, 'utf8'), ciphertext)
  assert.ok(!fs.readFileSync(generated, 'utf8').includes(token))
  assert.ok(!fs.readFileSync(generated, 'utf8').includes(password))
  fs.writeFileSync(source, '{"token":"plaintext","password":"plaintext"}')
  assert.throws(() => build.prepareAuth(root))
  assert.ok(!fs.existsSync(generated), '无效输入不能留下旧凭证输出')
  fs.writeFileSync(source, ciphertext)
  build.prepareAuth(root)
  fs.writeFileSync(source, '   ')
  build.prepareAuth(root)
  assert.ok(!fs.existsSync(generated))
  fs.writeFileSync(source, ciphertext)
  build.prepareAuth(root)
  fs.unlinkSync(source)
  build.prepareAuth(root)
  assert.ok(!fs.existsSync(generated))
} finally {
  assert.ok(root.startsWith(path.join(os.tmpdir(), 'nav-auth-build-')))
  fs.rmSync(root, { recursive: true, force: true })
}
console.log('PASS: 凭证资源生成、明文拒绝、空白 / 删除清理')
