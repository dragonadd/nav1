import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import yaml from 'js-yaml'

const previousDirectory = process.cwd()
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nav-pages-config-'))
const keys = [
  'NAV_GITHUB_PAGES',
  'GITHUB_REPOSITORY',
  'GITHUB_REF_NAME',
  'GITHUB_REF_TYPE',
  'GITHUB_EVENT_NAME',
  'CF_PAGES_BRANCH',
  'BRANCH',
  'VERCEL_GIT_COMMIT_REF',
  'CI_COMMIT_BRANCH',
]
const previousEnvironment = Object.fromEntries(
  keys.map((key) => [key, process.env[key]]),
)
const config = {
  gitRepoUrl: 'https://github.com/alice/navigation',
  branch: 'main',
  imageRepoUrl: 'https://github.com/alice/pictures?branch=images',
  hashMode: false,
  address: '',
}
try {
  process.chdir(directory)
  fs.writeFileSync(
    'package.json',
    JSON.stringify({
      version: '17.0.0',
      dependencies: { 'ng-zorro-antd': '^20.4.4' },
    }),
  )
  const write = (patch = {}) =>
    fs.writeFileSync('nav.config.yaml', yaml.dump({ ...config, ...patch }))
  write()
  for (const key of keys) delete process.env[key]
  const { getConfig } = await import('./utils.ts')
  assert.equal(getConfig().hashMode, false, '普通部署应保留原路由配置')
  process.env['NAV_GITHUB_PAGES'] = 'true'
  process.env['GITHUB_REPOSITORY'] = 'alice/navigation'
  process.env['GITHUB_REF_NAME'] = 'main'
  process.env['GITHUB_REF_TYPE'] = 'branch'
  assert.equal(getConfig().hashMode, true, 'Pages 自动部署必须启用 Hash 路由')
  assert.equal(getConfig().gitRepoUrl, config.gitRepoUrl)
  assert.equal(getConfig().imageRepoUrl, config.imageRepoUrl)
  write({ branch: 'auto' })
  for (const branch of ['preview-customer-42', 'release/v2.3', '部署-演示']) {
    process.env['GITHUB_REF_NAME'] = branch
    assert.equal(
      getConfig().branch,
      branch,
      'Pages 自动配置必须跟随任意选定分支',
    )
  }
  process.env['GITHUB_REF_NAME'] = 'main'
  write()
  assert.equal(
    (yaml.load(fs.readFileSync('nav.config.yaml', 'utf8')) as any).hashMode,
    false,
    '构建不能改写 YAML',
  )
  write({ gitRepoUrl: 'https://github.com/another/navigation' })
  assert.throws(() => getConfig(), /gitRepoUrl/)
  write({ branch: 'test' })
  assert.throws(() => getConfig(), /branch/)
  const failedInit = spawnSync(
    process.execPath,
    [
      path.join(previousDirectory, 'node_modules/tsx/dist/cli.mjs'),
      '--tsconfig',
      path.join(previousDirectory, 'tsconfig.json'),
      path.join(previousDirectory, 'scripts/start.ts'),
    ],
    { encoding: 'utf8', env: process.env },
  )
  assert.match(failedInit.stderr, /branch.*部署分支/)
  assert.notEqual(failedInit.status, 0, '初始化配置错误必须中止构建')
  write({ address: 'https://api.example.test' })
  assert.throws(() => getConfig(), /address/)
  write()
  process.env['GITHUB_REF_TYPE'] = 'tag'
  assert.throws(() => getConfig(), /分支|branch/)
  process.env['GITHUB_REF_TYPE'] = 'branch'
  delete process.env['GITHUB_REPOSITORY']
  assert.throws(() => getConfig(), /GitHub/)
  delete process.env['NAV_GITHUB_PAGES']
  assert.equal(getConfig().hashMode, false)
} finally {
  process.chdir(previousDirectory)
  for (const key of keys) {
    if (previousEnvironment[key] === undefined) delete process.env[key]
    else process.env[key] = previousEnvironment[key]
  }
  assert.ok(directory.startsWith(path.join(os.tmpdir(), 'nav-pages-config-')))
  fs.rmSync(directory, { recursive: true, force: true })
}
console.log('PASS: Pages Hash 路由、仓库 / 分支 / 自有部署检查、普通部署隔离')
