import assert from 'node:assert/strict'
import fs from 'node:fs'
import yaml from 'js-yaml'

const workflow = yaml.load(
  fs.readFileSync('.github/workflows/deploy-gh-pages.yml', 'utf8'),
) as any
const selection = workflow.jobs.select
assert.ok(selection, 'Pages 必须先筛选实际发布分支，再进入发布并发组')
assert.equal(
  workflow.concurrency,
  undefined,
  '跳过的分支不能进入全局发布并发组',
)
const script = selection.steps[0].with.script
const select = new Function('core', 'context', script)
const previous = process.env['NAV_PAGES_BRANCH']
try {
  for (const [source, target, event, expected] of [
    ['main', 'main', 'push', true],
    ['MAIN', 'main', 'push', false],
    ['preview-customer-42', 'main', 'push', false],
    ['release/v2.3', 'release/v2.3', 'push', true],
    ['　release　', '　release　', 'push', true],
    ['auto', 'auto', 'push', true],
    ['other', 'main', 'workflow_dispatch', true],
  ] as const) {
    process.env['NAV_PAGES_BRANCH'] = target
    let actual: unknown
    select(
      {
        setOutput(name: string, value: unknown) {
          assert.equal(name, 'publish')
          actual = value
        },
      },
      {
        ref: `refs/heads/${source}`,
        eventName: event,
        payload: { repository: { default_branch: 'default-branch' } },
      },
    )
    assert.equal(actual, expected, `${event} ${source} -> ${target}`)
  }
  delete process.env['NAV_PAGES_BRANCH']
  let published: unknown
  select(
    {
      setOutput(_: string, value: unknown) {
        published = value
      },
    },
    {
      ref: 'refs/heads/primary',
      eventName: 'push',
      payload: { repository: { default_branch: 'primary' } },
    },
  )
  assert.equal(published, true, '未配置时应使用实际仓库默认分支')
  select(
    {
      setOutput(_: string, value: unknown) {
        published = value
      },
    },
    {
      ref: 'refs/tags/v1',
      eventName: 'workflow_dispatch',
      payload: { repository: { default_branch: 'primary' } },
    },
  )
  assert.equal(published, false, '标签不能作为后台提交分支')
  assert.equal(workflow.jobs.build.needs, 'select')
  assert.ok(workflow.jobs.build.if.includes('needs.select.outputs.publish'))
  assert.equal(workflow.jobs.deploy.needs, 'build')
  assert.notEqual(
    workflow.jobs.build.concurrency.group,
    workflow.jobs.deploy.concurrency.group,
  )
} finally {
  if (previous === undefined) delete process.env['NAV_PAGES_BRANCH']
  else process.env['NAV_PAGES_BRANCH'] = previous
}
console.log(
  'PASS: Pages 任意分支精确筛选、默认分支、手动发布和跳过分支并发隔离',
)
