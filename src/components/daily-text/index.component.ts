import { Component, computed, effect, inject, signal } from '@angular/core'
import { settings } from 'src/store'
import { DailyTextService, type DailyPart } from 'src/services/daily-text'
import {
  dailyTextLimit,
  limitDailyText,
  renderDailyTemplate,
} from 'src/utils/daily-text'
import { $t } from 'src/locale'

@Component({
  standalone: true,
  selector: 'app-daily-text',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export class DailyTextComponent {
  private readonly dailyText = inject(DailyTextService)
  readonly $t = $t
  readonly enabled = computed(() => settings().hitokotoEnable !== false)
  readonly showTitle = computed(() => settings().hitokotoShowTitle !== false)
  readonly title = computed(
    () => settings().hitokotoTitle?.trim() || $t('_dailyTitle'),
  )
  private readonly fetchedParts = signal<DailyPart[]>([])
  private readonly now = signal(new Date())
  readonly parts = computed(() =>
    this.fetchedParts().map((part) =>
      part.template
        ? {
            ...part,
            text: limitDailyText(
              renderDailyTemplate(part.template, this.now()),
              dailyTextLimit(settings().hitokotoMaxLength),
            ),
          }
        : part,
    ),
  )
  readonly loading = signal(true)
  readonly failures = signal<string[]>([])
  retry = () => {}

  constructor() {
    effect((onCleanup) => {
      const config = settings()
      let active = true
      let requestVersion = 0
      let timer: ReturnType<typeof setTimeout>
      this.fetchedParts.set([])
      this.failures.set([])
      if (config.hitokotoEnable === false) {
        this.loading.set(false)
        return
      }
      const tick = () => this.now.set(new Date())
      tick()
      const clockTimer = config.hitokotoCustomText?.includes('{time}')
        ? setInterval(tick, 1000)
        : undefined
      const load = async () => {
        const version = ++requestVersion
        this.loading.set(true)
        this.failures.set([])
        try {
          const content = await this.dailyText.getDaily(config)
          if (active && version === requestVersion) {
            this.fetchedParts.set(content.parts)
            tick()
            this.failures.set(content.failures)
          }
        } catch (error) {
          if (active && version === requestVersion)
            this.failures.set([
              error instanceof Error ? error.message : $t('_error'),
            ])
        } finally {
          if (active && version === requestVersion) this.loading.set(false)
        }
      }
      const scheduleMidnight = () => {
        const now = new Date()
        const midnight = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1,
        )
        timer = setTimeout(
          () => {
            void load()
            scheduleMidnight()
          },
          midnight.getTime() - now.getTime() + 100,
        )
      }
      const onVisible = () => {
        if (document.visibilityState === 'visible') {
          tick()
          void load()
        }
      }
      this.retry = () => {
        void load()
      }
      void load()
      scheduleMidnight()
      document.addEventListener('visibilitychange', onVisible)
      onCleanup(() => {
        active = false
        clearTimeout(timer)
        if (clockTimer !== undefined) clearInterval(clockTimer)
        document.removeEventListener('visibilitychange', onVisible)
      })
    })
  }
}
