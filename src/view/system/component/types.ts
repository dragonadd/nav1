// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xiejiahe. All rights reserved.
// See https://github.com/xjh22222228/nav

import { ComponentType } from 'src/types'
import { $t } from 'src/locale'

export const componentTitleMap: Record<string, string> = {
  [ComponentType.Calendar]: $t('_calendar'),
  [ComponentType.OffWork]: $t('_offWork'),
  [ComponentType.Runtime]: $t('_runtime'),
  [ComponentType.Image]: $t('_image'),
  [ComponentType.Countdown]: $t('_countdown'),
  [ComponentType.HTML]: 'HTML',
  [ComponentType.Holiday]: $t('_holiday'),
  [ComponentType.News]: $t('_news'),
  [ComponentType.Carousel]: $t('_carousel'),
}

export const componentHelpMap: Record<number, string> = {
  [ComponentType.Calendar]: $t('_widgetCalendarHelp'),
  [ComponentType.OffWork]: $t('_widgetOffWorkHelp'),
  [ComponentType.Runtime]: $t('_widgetRuntimeHelp'),
  [ComponentType.Image]: $t('_widgetImageHelp'),
  [ComponentType.Countdown]: $t('_widgetCountdownHelp'),
  [ComponentType.HTML]: $t('_widgetHtmlHelp'),
  [ComponentType.Holiday]: $t('_widgetHolidayHelp'),
  [ComponentType.News]: $t('_widgetNewsHelp'),
  [ComponentType.Carousel]: $t('_widgetCarouselHelp'),
}
