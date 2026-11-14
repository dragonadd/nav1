// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xiejiahe. All rights reserved.
// See https://github.com/xjh22222228/nav

import {
  Component,
  ViewChild,
  Input,
  Output,
  EventEmitter,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NgSwitch, NgSwitchCase } from '@angular/common'
import { $t } from 'src/locale'
import { NzMessageService } from 'ng-zorro-antd/message'
import { NzModalService } from 'ng-zorro-antd/modal'
import { updateFileContent } from 'src/api'
import { COMPONENT_PATH } from 'src/constants'
import { component } from 'src/store'
import { ComponentType } from 'src/types'
import type { IComponentItemProps, IComponentProps } from 'src/types'
import { CalendarDrawerComponent } from 'src/components/calendar/drawer/index.component'
import { RuntimeDrawerComponent } from 'src/components/runtime/drawer/index.component'
import { OffWorkDrawerComponent } from 'src/components/off-work/drawer/index.component'
import { ImageDrawerComponent } from 'src/components/image/drawer/index.component'
import { CountdownDrawerComponent } from 'src/components/countdown/drawer/index.component'
import { HTMLDrawerComponent } from 'src/components/html/drawer/index.component'
import { HolidayDrawerComponent } from 'src/components/holiday/drawer/index.component'
import { NewsDrawerComponent } from 'src/components/news/drawer/index.component'
import { componentTitleMap, componentHelpMap } from './types'
import { newsTypeMap } from 'src/components/news/types'
import dayjs from 'dayjs'
import { NzButtonModule } from 'ng-zorro-antd/button'
import { NzSliderModule } from 'ng-zorro-antd/slider'
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm'
import { CalendarComponent } from 'src/components/calendar/index.component'
import { RuntimeComponent } from 'src/components/runtime/index.component'
import { OffWorkComponent } from 'src/components/off-work/index.component'
import { ImageComponent } from 'src/components/image/index.component'
import { CountdownComponent } from 'src/components/countdown/index.component'
import { HTMLComponent } from 'src/components/html/index.component'
import { HolidayComponent } from 'src/components/holiday/index.component'
import { NewsComponent } from 'src/components/news/index.component'
import { CarouselComponent } from 'src/components/carousel/index.component'
import { CarouselDrawerComponent } from 'src/components/carousel/drawer/index.component'
import event from 'src/utils/mitt'

@Component({
  standalone: true,
  imports: [
    CommonModule,
    NgSwitch,
    NgSwitchCase,
    FormsModule,
    NzButtonModule,
    NzSliderModule,
    CalendarComponent,
    RuntimeComponent,
    OffWorkComponent,
    ImageComponent,
    CountdownComponent,
    HTMLComponent,
    HolidayComponent,
    NzPopconfirmModule,
    CalendarDrawerComponent,
    RuntimeDrawerComponent,
    OffWorkDrawerComponent,
    ImageDrawerComponent,
    CountdownDrawerComponent,
    HTMLDrawerComponent,
    HolidayDrawerComponent,
    NewsDrawerComponent,
    NewsComponent,
    CarouselComponent,
    CarouselDrawerComponent,
  ],
  providers: [NzMessageService, NzModalService],
  selector: 'system-component',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export default class SystemComponentComponent {
  @Input() embedded = false
  @Input() enabledIds: number[] = []
  @Output() configChange = new EventEmitter<IComponentProps>()
  @ViewChild('calendar') calendarChild!: CalendarDrawerComponent
  @ViewChild('runtime') runtimeChild!: RuntimeDrawerComponent
  @ViewChild('offwork') offworkChild!: OffWorkDrawerComponent
  @ViewChild('image') imageChild!: ImageDrawerComponent
  @ViewChild('countdown') countdownChild!: CountdownDrawerComponent
  @ViewChild('html') htmlChild!: HTMLDrawerComponent
  @ViewChild('holiday') holidayChild!: HolidayDrawerComponent
  @ViewChild('news') newsChild!: NewsDrawerComponent
  @ViewChild('carousel') carouselChild!: CarouselDrawerComponent

  readonly $t = $t
  readonly componentTitleMap = componentTitleMap
  readonly componentHelpMap = componentHelpMap
  readonly ComponentType = ComponentType
  components = structuredClone(component().components)
  compoentZoom = component().zoom
  submitting: boolean = false

  constructor(
    private message: NzMessageService,
    private modal: NzModalService,
  ) {}

  ngOnInit() {}

  private changed() {
    this.configChange.emit(
      structuredClone({ zoom: this.compoentZoom, components: this.components }),
    )
  }

  parameterRows(
    item: IComponentItemProps,
  ): { label: string; value: unknown }[] {
    const rows: Record<number, [string, unknown][]> = {
      [ComponentType.Calendar]: [
        ['_topColor', item.topColor],
        ['_bgColor', item.bgColor],
      ],
      [ComponentType.OffWork]: [
        ['_workHours', dayjs(item.startDate).format('HH:mm')],
        ['_breakTime', dayjs(item.date).format('HH:mm')],
        ['_workTitle', item.workTitle],
        ['_restTitle', item.restTitle],
      ],
      [ComponentType.Runtime]: [['_runtimeTitle', item.title]],
      [ComponentType.Image]: [
        ['_widgetImageUrl', item.url],
        ['_text', item.text],
        ['_jumpAddr', item.go],
      ],
      [ComponentType.Countdown]: [
        ['_title', item.title],
        ['_widgetTargetDate', item.date],
        ['_widgetImageUrl', item.url],
      ],
      [ComponentType.HTML]: [
        ['_widgetWidth', item.width],
        ['_bgColor', item.bgColor],
        ['HTML', item.html],
      ],
      [ComponentType.Holiday]: [
        [
          '_holiday',
          (item['items'] || [])
            .map(
              (entry: any) =>
                `${entry.title} · ${entry.date} · ${entry.day || 0} ${$t('_day')}`,
            )
            .join('\n'),
        ],
      ],
      [ComponentType.News]: [
        [
          '_widgetNewsSources',
          (item.types || []).map((type) => newsTypeMap[type]).join('、'),
        ],
        ['_widgetNewsCount', item.count],
        ['_bgColor', item.bgColor],
      ],
      [ComponentType.Carousel]: [
        ['_widgetWidth', item.width],
        ['_widgetFit', item.fit],
        [
          '_widgetImageUrl',
          (item.imgs || []).map((image) => image.src).join('\n'),
        ],
      ],
    }
    return (rows[item.type] || []).map(([label, value]) => ({
      label: $t(label),
      value: value === '' || value == null ? '—' : value,
    }))
  }

  // 上移
  moveUp(index: number): void {
    if (index === 0) {
      return
    }
    const current = this.components[index]
    const prevData = this.components[index - 1]
    this.components[index - 1] = current
    this.components[index] = prevData
    this.changed()
  }

  // 下移
  moveDown(index: number): void {
    if (index === this.components.length - 1) {
      return
    }
    const current = this.components[index]
    const next = this.components[index + 1]
    this.components[index + 1] = current
    this.components[index] = next
    this.changed()
  }

  handleEdit(data: any, idx: number) {
    const type = data.type
    const types: Record<string, any> = {
      [ComponentType.Calendar]: this.calendarChild,
      [ComponentType.OffWork]: this.offworkChild,
      [ComponentType.Runtime]: this.runtimeChild,
      [ComponentType.Image]: this.imageChild,
      [ComponentType.Countdown]: this.countdownChild,
      [ComponentType.HTML]: this.htmlChild,
      [ComponentType.Holiday]: this.holidayChild,
      [ComponentType.News]: this.newsChild,
      [ComponentType.Carousel]: this.carouselChild,
    }
    types[type]?.open(data, idx)
  }

  onAdd(data: IComponentItemProps) {
    let max = Math.max(...this.components.map((item) => item.id))
    max = max <= 0 ? 1 : max + 1
    this.components.push({
      ...data,
      id: max,
    })
    this.changed()
  }

  onDelete(idx: number) {
    this.components.splice(idx, 1)
    this.changed()
  }

  handleZoomChange(value: number) {
    if (!this.embedded) component.update((prev) => ({ ...prev, zoom: value }))
    this.changed()
  }

  handleOk(data: any) {
    const { index, ...values } = data
    this.components[index] = {
      ...this.components[index],
      ...values,
    }
    event.emit('COMPONENT_OK')
    this.changed()
  }

  handleSubmit() {
    if (this.submitting) {
      return
    }

    this.modal.info({
      nzTitle: $t('_syncDataOut'),
      nzOkText: $t('_confirmSync'),
      nzContent: $t('_confirmSyncTip'),
      nzOnOk: () => {
        const params: IComponentProps = {
          zoom: this.compoentZoom,
          components: this.components,
        }
        this.submitting = true
        updateFileContent({
          message: 'update component',
          content: JSON.stringify(params),
          path: COMPONENT_PATH,
        })
          .then(() => {
            component.set(params)
            this.message.success($t('_saveSuccess'))
          })
          .finally(() => {
            this.submitting = false
          })
      },
    })
  }

  trackByItem(i: number, item: any) {
    return item.id
  }
}
