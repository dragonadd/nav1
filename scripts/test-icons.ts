import assert from 'node:assert/strict'
import { getFontAwesomeClass } from '../src/utils/pureUtils'

for (const [input, expected] of [
  ['fas fa-film', 'fas fa-film'],
  ['fab fa-github', 'fab fa-github'],
  ['fa-solid   fa-book fa-fw', 'fa-solid fa-book fa-fw'],
  ['  far fa-star  ', 'far fa-star'],
  ['assets/img/icon.svg', ''],
  ['https://example.com/fa-github.png', ''],
  ['fa-solid fa-film" onclick="alert(1)', ''],
  ['<i class="fas fa-film"></i>', ''],
  ['fas fa-film arbitrary-class', ''],
  ['', ''],
])
  assert.equal(getFontAwesomeClass(input), expected, `图标类名解析：${input}`)
console.log('PASS: Font Awesome 类名、空格规范化、图片地址兼容和非法类名拒绝')
