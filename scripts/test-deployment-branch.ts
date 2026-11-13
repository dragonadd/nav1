import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import yaml from 'js-yaml'

const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'nav-deployment-branch-'),
)
const previousDirectory = process.cwd()
const keys = [
  'CF_PAGES_BRANCH',
  'GITHUB_REF_NAME',
  'GITHUB_REF_TYPE',
  'GITHUB_EVENT_NAME',
  'BRANCH',
  'VERCEL_GIT_COMMIT_REF',
  'CI_COMMIT_BRANCH',
  'NAV_GITHUB_PAGES',
]
const previousEnvironment = Object.fromEntries(
  keys.map((key) => [key, process.env[key]]),
)
try {
  process.chdir(directory)
  for (const key of keys) delete process.env[key]
  fs.writeFileSync(
    'package.json',
    JSON.stringify({
      version: '17.0.0',
      dependencies: { 'ng-zorro-antd': '^20.4.4' },
    }),
  )
  const source = yaml.dump({
    gitRepoUrl: 'https://github.com/dragonadd/nav1',
    branch: 'auto',
    imageRepoUrl: 'https://github.com/dragonadd/nav1?branch=images',
    address: '',
    hashMode: false,
  })
  fs.writeFileSync('nav.config.yaml', source)
  const { getConfig } = await import('./utils.ts')
  for (const branch of [
    'test',
    'preview-customer-42',
    'release/v2.3',
    'team/preview+42',
    '部署-演示',
    '部署　演示',
    '　release　',
    'auto',
  ]) {
    process.env['CF_PAGES_BRANCH'] = branch
    assert.equal(getConfig().branch, branch, '任意合法部署分支必须保持原名')
  }
  assert.equal(
    getConfig().imageRepoUrl,
    'https://github.com/dragonadd/nav1?branch=images',
  )
  assert.equal(
    fs.readFileSync('nav.config.yaml', 'utf8'),
    source,
    '构建不能改写源 YAML',
  )
  const generated = getConfig()
  assert.equal(
    generated.branch,
    'auto',
    'auto 也可以是平台提供的合法实际分支名',
  )

  const { resolveDeploymentBranch } = await import('./deployment-branch.ts')
  for (const [environment, expected] of [
    [{ CF_PAGES_BRANCH: 'preview-customer-42' }, 'preview-customer-42'],
    [{ CF_PAGES_BRANCH: 'preview', GITHUB_REF_NAME: 'main' }, 'preview'],
    [
      { GITHUB_REF_NAME: 'feature/test', GITHUB_REF_TYPE: 'branch' },
      'feature/test',
    ],
    [{ BRANCH: 'review/abc-123' }, 'review/abc-123'],
    [{ VERCEL_GIT_COMMIT_REF: 'release' }, 'release'],
    [{ CI_COMMIT_BRANCH: 'develop' }, 'develop'],
  ] as const)
    assert.equal(resolveDeploymentBranch('auto', environment, 'main'), expected)
  assert.equal(
    resolveDeploymentBranch('main', { CF_PAGES_BRANCH: 'test' }, 'test'),
    'main',
    '显式分支用于有意固定目标',
  )
  assert.equal(resolveDeploymentBranch('auto', {}, 'test'), 'test')
  assert.throws(
    () => resolveDeploymentBranch('auto', {}, ''),
    /无法识别部署分支/,
  )
  assert.throws(
    () =>
      resolveDeploymentBranch(
        'auto',
        { GITHUB_REF_NAME: 'v1', GITHUB_REF_TYPE: 'tag' },
        '',
      ),
    /无法识别部署分支/,
  )
  assert.throws(
    () =>
      resolveDeploymentBranch(
        'auto',
        { GITHUB_REF_NAME: '123/merge', GITHUB_EVENT_NAME: 'pull_request' },
        '',
      ),
    /无法识别部署分支/,
  )
  for (const value of [
    'HEAD',
    '../main',
    'bad branch',
    'bad~ref',
    'branch.lock',
    'foo/.bar',
    '-test',
    'test/',
    'a@{b',
    'feature..test',
    'branch.',
  ])
    assert.throws(() => resolveDeploymentBranch(value, {}, ''), /分支/)
  delete process.env['CF_PAGES_BRANCH']
  assert.throws(() => getConfig(), /无法识别部署分支/)
  execFileSync('git', ['init', '--initial-branch=test'], {
    stdio: 'ignore',
    windowsHide: true,
  })
  assert.equal(getConfig().branch, 'test', '本地初始化跟随当前 Git 分支')
  execFileSync('git', ['symbolic-ref', 'HEAD', 'refs/heads/　release　'], {
    stdio: 'ignore',
    windowsHide: true,
  })
  assert.equal(
    getConfig().branch,
    '　release　',
    '本地 Git 分支不能裁剪合法的 Unicode 空格',
  )
  fs.mkdirSync('data')
  for (const name of [
    'db',
    'settings',
    'tag',
    'internal',
    'search',
    'component',
  ])
    fs.writeFileSync(`data/${name}.json`, name === 'tag' ? '[]' : '{}')
  fs.writeFileSync('data/db.json', '[]')
  fs.writeFileSync(
    'data/component.json',
    JSON.stringify({ zoom: 1, components: [] }),
  )
  for (const [variable, branch] of [
    ['CF_PAGES_BRANCH', 'preview-customer-42'],
    ['GITHUB_REF_NAME', 'release/v2.3'],
    ['BRANCH', 'review/abc-123'],
    ['VERCEL_GIT_COMMIT_REF', 'team/preview+42'],
    ['CI_COMMIT_BRANCH', '部署-演示'],
    ['CF_PAGES_BRANCH', '部署　演示'],
    ['CF_PAGES_BRANCH', '　release　'],
    ['CF_PAGES_BRANCH', 'auto'],
  ]) {
    for (const key of keys) delete process.env[key]
    process.env[variable] = branch
    if (variable === 'GITHUB_REF_NAME')
      process.env['GITHUB_REF_TYPE'] = 'branch'
    const result = spawnSync(
      process.execPath,
      [
        path.join(previousDirectory, 'node_modules/tsx/dist/cli.mjs'),
        '--tsconfig',
        path.join(previousDirectory, 'tsconfig.json'),
        path.join(previousDirectory, 'scripts/start.ts'),
      ],
      { encoding: 'utf8', env: process.env, windowsHide: true },
    )
    assert.equal(result.status, 0, result.stderr)
    assert.equal(
      JSON.parse(fs.readFileSync('nav.config.json', 'utf8')).branch,
      branch,
      '真实初始化必须保持托管平台的分支原名',
    )
  }
  assert.equal(fs.readFileSync('nav.config.yaml', 'utf8'), source)
} finally {
  process.chdir(previousDirectory)
  for (const key of keys) {
    if (previousEnvironment[key] === undefined) delete process.env[key]
    else process.env[key] = previousEnvironment[key]
  }
  assert.ok(
    directory.startsWith(path.join(os.tmpdir(), 'nav-deployment-branch-')),
  )
  fs.rmSync(directory, { recursive: true, force: true })
}
console.log('PASS: 任意部署分支、多平台真实初始化、显式配置和非法引用拒绝')
