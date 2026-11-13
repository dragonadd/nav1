import assert from 'node:assert/strict'
import { migrateSideSettings } from '../src/utils/side-settings'

const original = {
  theme: 'Side',
  appTheme: 'App',
  sideTitle: '我的导航',
  sideThemeImages: [{ src: 'https://example.com/banner.png', url: '' }],
  shortcutTitle: '保留',
}
const legacy: Record<string, any> = structuredClone(original)
migrateSideSettings(legacy)
assert.equal(legacy.sideTitle, original.sideTitle)
assert.equal(legacy.sideBanner, original.sideThemeImages[0].src)
assert.deepEqual(legacy.sideThemeImages, original.sideThemeImages)
assert.equal(legacy.shortcutTitle, original.shortcutTitle)
const index: Record<string, any> = {
  theme: 'Index',
  appTheme: 'Index',
  indexTitle: '新标题',
  indexDescription: '介绍',
  indexDocTitle: '浏览器标题',
  indexFooterHTML: '<p>页脚</p>',
  indexBanner: 'assets/img/index-banner.svg',
}
migrateSideSettings(index)
assert.deepEqual(index, {
  theme: 'Side',
  appTheme: 'Side',
  sideTitle: '新标题',
  sideDescription: '介绍',
  sideDocTitle: '浏览器标题',
  sideFooterHTML: '<p>页脚</p>',
  sideBanner: 'assets/img/side-banner.svg',
})
const blank: Record<string, any> = {
  sideBanner: '',
  sideTitle: '旧标题',
  indexTitle: '',
}
migrateSideSettings(blank)
assert.equal(blank.sideBanner, '')
assert.equal(blank.sideTitle, '旧标题')
const once = structuredClone(index)
migrateSideSettings(index)
assert.deepEqual(index, once)
console.log('PASS: Side 配置兼容迁移、Index 合并、其他主题保留和重复初始化')
