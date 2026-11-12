// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xiejiahe. All rights reserved.
// See https://github.com/xjh22222228/nav

import { Component, type OnDestroy } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { CommonModule } from '@angular/common'
import {
  RouterOutlet,
  RouterLink,
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
} from '@angular/router'
import { $t } from 'src/locale'
import { isLogin, userLogout, getAuthCode } from 'src/utils/user'
import { VERSION } from 'src/constants'
import { isSelfDevelop, removeDark } from 'src/utils/utils'
import { NzLayoutModule } from 'ng-zorro-antd/layout'
import { NzMenuModule } from 'ng-zorro-antd/menu'
import { NzButtonModule } from 'ng-zorro-antd/button'
import { NzSpinModule } from 'ng-zorro-antd/spin'
import { NzIconModule } from 'ng-zorro-antd/icon'
import { LoginComponent } from 'src/components/login/login.component'
import { STORAGE_KEY_MAP } from 'src/constants'
import navConfig from '../../../nav.config.json'

@Component({
  standalone: true,
  imports: [
    CommonModule,
    NzLayoutModule,
    NzMenuModule,
    NzButtonModule,
    LoginComponent,
    RouterOutlet,
    RouterLink,
    NzSpinModule,
    NzIconModule,
  ],
  selector: 'app-system',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export default class SystemComponent implements OnDestroy {
  readonly isSelfDevelop = isSelfDevelop
  readonly $t = $t
  readonly isLogin: boolean = isLogin
  readonly version = VERSION
  readonly branch = navConfig.branch
  showLoginModal: boolean = !isLogin
  isAuthz = !!getAuthCode()
  pageLoading = false
  private readonly mobile = window.matchMedia('(max-width: 991px)')
  isCollapsed =
    this.mobile.matches ||
    !!Number(localStorage.getItem(STORAGE_KEY_MAP.SYSTEM_COLLAPSED))
  readonly menuGroups = [
    { key: 'content', title: '_adminContentGroup' },
    { key: 'tools', title: '_adminToolsGroup' },
    { key: 'settings', title: '_adminSettingsGroup' },
  ]
  readonly menuItems = [
    {
      path: 'web',
      title: '_websiteMang',
      description: '_adminWebDescription',
      icon: 'appstore',
      group: 'content',
      visible: true,
    },
    {
      path: 'tag',
      title: '_tagSettings',
      description: '_adminTagDescription',
      icon: 'tags',
      group: 'content',
      visible: true,
    },
    {
      path: 'search',
      title: '_searchEngines',
      description: '_adminSearchDescription',
      icon: 'search',
      group: 'content',
      visible: true,
    },
    {
      path: 'component',
      title: '_components',
      description: '_adminComponentDescription',
      icon: 'layout',
      group: 'content',
      visible: this.isAuthz || isSelfDevelop,
    },
    {
      path: 'bookmark',
      title: '_bookmarkImport',
      description: '_adminImportDescription',
      icon: 'import',
      group: 'tools',
      visible: true,
    },
    {
      path: 'bookmarkExport',
      title: '_bookmarkExport',
      description: '_adminExportDescription',
      icon: 'export',
      group: 'tools',
      visible: this.isAuthz,
    },
    {
      path: 'collect',
      title: '_userCollect',
      description: '_adminCollectDescription',
      icon: 'inbox',
      group: 'tools',
      visible: this.isAuthz || isSelfDevelop,
    },
    {
      path: 'setting',
      title: '_systemSet',
      description: '_adminSettingsDescription',
      icon: 'setting',
      group: 'settings',
      visible: true,
    },
    {
      path: 'auth',
      title: '_vipAuth',
      description: '_adminAuthDescription',
      icon: 'safety-certificate',
      group: 'settings',
      visible: true,
    },
    {
      path: 'config',
      title: '_confInfo',
      description: '_adminConfigDescription',
      icon: 'database',
      group: 'settings',
      visible: isSelfDevelop,
    },
    {
      path: 'info',
      title: '_webInfo',
      description: '_adminInfoDescription',
      icon: 'info-circle',
      group: 'settings',
      visible: !isSelfDevelop,
    },
  ]
  private readonly onBreakpointChange = () => {
    this.isCollapsed =
      this.mobile.matches ||
      !!Number(localStorage.getItem(STORAGE_KEY_MAP.SYSTEM_COLLAPSED))
  }

  get currentMenu(): string {
    return (
      this.router
        .parseUrl(this.router.url)
        .root.children['primary']?.segments.at(-1)?.path || 'web'
    )
  }

  get currentPage() {
    return (
      this.menuItems.find((item) => item.path === this.currentMenu) ||
      this.menuItems[0]
    )
  }

  constructor(private router: Router) {
    // 解决暗黑模式部分样式不正确问题，后台没有暗黑
    removeDark()

    this.mobile.addEventListener('change', this.onBreakpointChange)
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event: any) => {
      if (event instanceof NavigationStart) {
        this.pageLoading = true
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.pageLoading = false
      }
    })
  }

  ngOnDestroy(): void {
    this.mobile.removeEventListener('change', this.onBreakpointChange)
  }

  toggleCollapsed() {
    this.isCollapsed = !this.isCollapsed
    if (!this.mobile.matches)
      localStorage.setItem(
        STORAGE_KEY_MAP.SYSTEM_COLLAPSED,
        String(Number(this.isCollapsed)),
      )
  }

  goBack() {
    this.router.navigate(['/'], {
      queryParams: {
        _: Date.now(),
      },
    })
  }

  closeMobileMenu() {
    if (this.mobile.matches) this.isCollapsed = true
  }

  logout() {
    userLogout()
    this.router.navigate(['/'])
    setTimeout(() => {
      location.reload()
    }, 26)
  }
}
