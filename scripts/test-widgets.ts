import '@angular/compiler'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const listeners = new Set<EventListener>()
Object.assign(globalThis, {
  addEventListener: () => {},
  removeEventListener: () => {},
  localStorage: { getItem: () => null, removeItem: () => {} },
  document: {
    baseURI: 'https://navigation.test/',
    addEventListener: (_name: string, listener: EventListener) =>
      listeners.add(listener),
    removeEventListener: (_name: string, listener: EventListener) =>
      listeners.delete(listener),
  },
  location: new URL('https://navigation.test/'),
  window: globalThis,
})
await import('../src/store')
const { OffWorkComponent } =
  await import('../src/components/off-work/index.component')
const { OffWorkDrawerComponent } =
  await import('../src/components/off-work/drawer/index.component')
const { FormBuilder } = await import('@angular/forms')

test('下班组件在上班时刻自动结束休息，并在销毁时移除监听', (t) => {
  t.mock.timers.enable({
    apis: ['Date', 'setTimeout'],
    now: new Date(2026, 10, 14, 8, 59, 59).getTime(),
  })
  const widget = new OffWorkComponent()
  try {
    widget.data = {
      id: -2,
      type: 2,
      workTitle: '距离下班',
      restTitle: '休息',
      startDate: new Date(2018, 3, 26, 9).getTime(),
      date: new Date(2018, 3, 26, 18).getTime(),
    }
    widget.ngOnChanges()
    assert.equal(widget.isRest, true)
    t.mock.timers.tick(1000)
    assert.equal(widget.isRest, false)
    assert.ok(widget.countdownStr)
  } finally {
    widget.ngOnDestroy()
  }
  assert.equal(listeners.size, 0)
})

test('修改上班时间只比较钟点，不因日期不同拒绝有效时段', () => {
  const errors: string[] = []
  const drawer = new OffWorkDrawerComponent(new FormBuilder(), {
    error: (message: string) => errors.push(message),
  } as any)
  drawer.open(
    {
      startDate: new Date(2018, 3, 26, 9).getTime(),
      date: new Date(2018, 3, 26, 18).getTime(),
    },
    0,
  )
  drawer.validateForm.patchValue({ startDate: new Date(2026, 10, 14, 10) })
  let submitted = false
  drawer.ok.subscribe(() => {
    submitted = true
  })
  drawer.handleSubmit()
  assert.deepEqual(errors, [])
  assert.equal(submitted, true)
})
