// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xiejiahe. All rights reserved.
// See https://github.com/xjh22222228/nav

import { Component } from '@angular/core'
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
} from '@angular/forms'
import { CommonModule } from '@angular/common'
import { $t } from 'src/locale'
import { NzMessageService } from 'ng-zorro-antd/message'
import { NzNotificationService } from 'ng-zorro-antd/notification'
import { SETTING_PATH, COMPONENT_PATH } from 'src/constants'
import { CODE_SYMBOL } from 'src/constants/symbol'
import { updateFileContent, spiderWebs, getWebInfo } from 'src/api'
import { settings, component } from 'src/store'
import { isSelfDevelop, compilerTemplate } from 'src/utils/utils'
import { componentTitleMap } from '../component/types'
import { SafeHtmlPipe } from 'src/pipe/safeHtml.pipe'
import { NzButtonModule } from 'ng-zorro-antd/button'
import { NzFormModule } from 'ng-zorro-antd/form'
import { NzSliderModule } from 'ng-zorro-antd/slider'
import { NzInputModule } from 'ng-zorro-antd/input'
import { NzSwitchModule } from 'ng-zorro-antd/switch'
import { NzTableModule } from 'ng-zorro-antd/table'
import { NzRadioModule } from 'ng-zorro-antd/radio'
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox'
import { NzTabsModule } from 'ng-zorro-antd/tabs'
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm'
import { NzPopoverModule } from 'ng-zorro-antd/popover'
import { NzSelectModule } from 'ng-zorro-antd/select'
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker'
import SystemComponentComponent from '../component/index.component'
import {
  initializeWebInfoSettings,
  validateWebInfoSettings,
} from 'src/utils/web-info'
import { UploadImageComponent } from 'src/components/upload-image/index.component'
import { UploadFileComponent } from 'src/components/upload-file/index.component'
import { CardComponent } from 'src/components/card/index.component'
import { ActionType } from 'src/types'
import type {
  IComponentItemProps,
  IComponentProps,
  IWebProps,
  ThemeType,
} from 'src/types'
import event from 'src/utils/mitt'
import footTemplate from 'src/components/footer/template'
import { replaceJsdelivrCDN } from 'src/utils/pureUtils'
import {
  DAILY_TEXT_SOURCES,
  initializeDailyTextSettings,
  parseDailySources,
  sourceText,
  dailyTextLimit,
  dailyTextAlign,
} from 'src/utils/daily-text'

// 额外添加的字段，但不添加到配置中
const extraForm: Record<string, any> = {
  footTemplate: '',
  componentOptions: [],
}

@Component({
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    NzSelectModule,
    NzDatePickerModule,
    SystemComponentComponent,
    NzPopoverModule,
    NzTabsModule,
    SafeHtmlPipe,
    NzButtonModule,
    NzFormModule,
    NzSliderModule,
    NzInputModule,
    NzSwitchModule,
    NzTableModule,
    NzRadioModule,
    NzCheckboxModule,
    NzPopconfirmModule,
    UploadImageComponent,
    UploadFileComponent,
    CardComponent,
  ],
  selector: 'system-setting',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export default class SystemSettingComponent {
  readonly $t = $t
  readonly isSelfDevelop = isSelfDevelop
  readonly textareaSize = { minRows: 3, maxRows: 20 }
  validateForm!: FormGroup
  submitting: boolean = false
  settings = settings()
  readonly dailySources = DAILY_TEXT_SOURCES
  tabActive = 0
  sectionActive = 0
  componentOptions: any[] = []
  widgetDraft: IComponentProps | null = null
  webInfoTestUrl = ''
  webInfoTestResult = ''
  testingWebInfo = false
  actionOptions = [
    {
      label: $t('_add'),
      value: ActionType.Create,
    },
    {
      label: $t('_edit'),
      value: ActionType.Edit,
    },
    {
      label: $t('_del'),
      value: ActionType.Delete,
    },
  ]
  webDemoData: IWebProps = {
    id: -1,
    name: '发现导航',
    desc: '发现导航是一个轻量级免费且强大的导航网站',
    url: 'https://nav3.cn',
    icon: replaceJsdelivrCDN(
      'https://gcore.jsdelivr.net/gh/xjh22222228/nav-image@image/logo.svg',
      settings(),
    ),
    img: replaceJsdelivrCDN(
      'https://gcore.jsdelivr.net/gh/xjh22222228/public@gh-pages/nav/4.png',
      settings(),
    ),
    tags: [],
    breadcrumb: [],
    rate: 5,
  }

  constructor(
    private fb: FormBuilder,
    private notification: NzNotificationService,
    private message: NzMessageService,
  ) {
    initializeDailyTextSettings(this.settings)
    initializeWebInfoSettings(this.settings)
    const themeMap: Record<ThemeType, number> = {
      Light: 0,
      Super: 1,
      Sim: 2,
      Side: 3,
      Shortcut: 4,
      App: 5,
    }
    this.tabActive = themeMap[this.settings.theme] || 0

    extraForm['componentOptions'] = []
    this.componentOptions = component().components.map((item) => {
      const data = this.settings.components.find(
        (c) => item.type === c.type && item.id === c.id,
      )
      if (data) {
        extraForm['componentOptions'].push(data.id)
      }
      return {
        label: componentTitleMap[item.type],
        value: item.id,
        type: item.type,
        id: item.id,
      }
    })
    const group: any = {
      ...extraForm,
      ...this.settings,
    }
    const groupPayload: any = {}
    for (const k in group) {
      groupPayload[k] = [group[k]]
    }
    groupPayload.runtime = [new Date(this.settings.runtime)]
    this.validateForm = this.fb.group(groupPayload)

    event.on('GITHUB_USER_INFO', (data: any) => {
      if (!this.validateForm.get('email')?.value) {
        this.validateForm.get('email')!.setValue(data.email)
      }
    })
  }

  get cdnUrl(): string {
    return this.validateForm.get('gitHubCDN')?.value
  }

  get footTemplate(): string {
    return compilerTemplate(this.validateForm.get('footerContent')?.value || '')
  }

  onFootTemplateChange(v: any) {
    this.validateForm
      .get('footerContent')!
      .setValue(footTemplate[v]?.trim?.() || '')
  }

  addDailySource(name: string) {
    const field = this.validateForm.get('hitokotoSources')!
    const lines = (field.value || '')
      .split('\n')
      .map((line: string) => line.trim())
      .filter(Boolean)
    if (!lines.includes(name)) field.setValue([...lines, name].join('\n'))
  }

  async testWebInfo() {
    if (this.testingWebInfo) return
    this.testingWebInfo = true
    this.webInfoTestResult = ''
    try {
      const url = new URL(this.webInfoTestUrl.trim())
      if (!['http:', 'https:'].includes(url.protocol))
        throw new Error($t('_webInfoInvalidUrl'))
      const result = await getWebInfo(url.href, this.validateForm.value)
      this.webInfoTestResult = JSON.stringify(result, null, 2)
    } catch (error) {
      this.webInfoTestResult =
        error instanceof Error ? error.message : $t('_error')
    } finally {
      this.testingWebInfo = false
    }
  }

  onLogoChange(data: any, key: string) {
    this.settings[key] = (data.cdn ?? data.target?.value ?? '').trim()
    this.validateForm.get(key)?.setValue(this.settings[key])
  }

  onBannerChange(data: any, key: string, idx: number) {
    this.settings[key][idx]['src'] = data.cdn
  }

  onChangeBannerUrl(e: any, key: string, idx: number) {
    const value = e.target.value.trim()
    this.settings[key][idx]['src'] = value
  }

  onChangeJumpUrl(e: any, key: string, idx: number) {
    const value = e.target.value.trim()
    this.settings[key][idx]['url'] = value
  }

  onDeleteBanner(key: string, idx: number) {
    this.settings[key].splice(idx, 1)
  }

  onAddBanner(key: string) {
    this.settings[key].push({
      src: '',
      url: '',
    })
  }

  onShortcutImgChange(e: any) {
    let url = e?.target?.value?.trim() || e.cdn || ''
    this.settings.shortcutThemeImages[0]['src'] = url
  }

  handleMoveUp(key: string, idx: number) {
    if (idx === 0) {
      return
    }
    const data = this.settings[key][idx]
    this.settings[key][idx] = this.settings[key][idx - 1]
    this.settings[key][idx - 1] = data
  }

  handleMoveDown(key: string, idx: number) {
    if (idx === this.settings[key].length - 1) {
      return
    }
    const data = this.settings[key][idx]
    this.settings[key][idx] = this.settings[key][idx + 1]
    this.settings[key][idx + 1] = data
  }

  async handleSpider() {
    await this.handleSubmit()
    this.submitting = true
    try {
      const res = await spiderWebs()
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message)
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            break
          }
          const chunk = JSON.parse(decoder.decode(value))
          if (Array.isArray(chunk)) {
            this.notification.info('Result', chunk.join('<div></div>'))
          } else {
            this.notification.success(`${chunk.time} s`, $t('_saveSuccess'), {
              nzDuration: 0,
            })
          }
        }
      }
    } catch (err: any) {
      this.notification.error('Error', err.message)
    }
    this.submitting = false
  }

  async handleSubmit() {
    if (this.submitting) {
      return
    }

    const daily = this.validateForm.value
    try {
      daily.hitokotoSources = sourceText(daily).trim()
      daily.hitokotoCustomText = (daily.hitokotoCustomText || '').trim()
      daily.hitokotoTitle =
        (daily.hitokotoTitle || '').trim() || $t('_dailyTitle')
      daily.hitokotoMaxLength = dailyTextLimit(daily.hitokotoMaxLength)
      daily.hitokotoAlign = dailyTextAlign(daily.hitokotoAlign)
      daily.runtime = new Date(daily.runtime).getTime()
      if (!Number.isFinite(daily.runtime))
        throw new Error($t('_widgetInvalidStart'))
      daily.webInfoApi = (daily.webInfoApi || '').trim()
      for (const key of [
        'webInfoTitlePath',
        'webInfoIconPath',
        'webInfoDescriptionPath',
      ])
        daily[key] = (daily[key] || '').trim()
      validateWebInfoSettings(daily)
      if (daily.hitokotoEnable !== false) {
        const sources = parseDailySources(daily.hitokotoSources)
        if (!sources.length && !daily.hitokotoCustomText)
          throw new Error($t('_dailyRequired'))
      }
    } catch (error: any) {
      this.message.error(error.message)
      return
    }

    return new Promise((resolve, reject) => {
      function filterImage(item: Record<string, any>) {
        return item['src'] || item['url'][0] === CODE_SYMBOL
      }
      const formValues = daily
      const values = {
        ...formValues,
        favicon: this.settings.favicon,
        simThemeImages: this.settings.simThemeImages.filter(filterImage),
        shortcutThemeImages:
          this.settings.shortcutThemeImages.filter(filterImage),
        sideThemeImages: this.settings.sideThemeImages.filter(filterImage),
        superImages: this.settings.superImages.filter(filterImage),
        lightImages: this.settings.lightImages.filter(filterImage),
        components: formValues.componentOptions
          .map((id: number) => {
            const data = component().components.find(
              (item: IComponentItemProps) => item.id === id,
            )
            return {
              id: data?.id,
              type: data?.type,
            }
          })
          .filter((item: any) => item.type),
      }
      for (const k in extraForm) {
        delete values[k]
      }

      this.submitting = true
      const widgetConfig = this.widgetDraft
      let widgetsSaved = false
      const saveWidgets = widgetConfig
        ? updateFileContent({
            message: 'update component',
            content: JSON.stringify(widgetConfig),
            path: COMPONENT_PATH,
          }).then(() => {
            component.set(widgetConfig)
            widgetsSaved = true
            if (this.widgetDraft === widgetConfig) this.widgetDraft = null
          })
        : Promise.resolve()
      saveWidgets
        .then(() =>
          updateFileContent({
            message: 'update settings',
            content: JSON.stringify(values),
            path: SETTING_PATH,
          }),
        )
        .finally(() => {
          this.submitting = false
        })
        .then(() => {
          if (!isSelfDevelop) {
            settings.set(values)
          }
          this.message.success($t('_syncSuccessTip'))
          resolve(null)
        })
        .catch((error) => {
          if (widgetsSaved) this.message.error($t('_widgetPartialSave'))
          reject(error)
        })
    })
  }
}
