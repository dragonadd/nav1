// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xiejiahe. All rights reserved.
// See https://github.com/xjh22222228/nav

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  type OnChanges,
  type OnDestroy,
  type SimpleChanges,
} from '@angular/core'
import { Router } from '@angular/router'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NzMessageService } from 'ng-zorro-antd/message'
import { createBranch, isStandaloneImage } from 'src/api'
import { removeWebsite } from 'src/utils/user'
import { $t } from 'src/locale'
import { isSelfDevelop } from 'src/utils/utils'
import { NzModalModule } from 'ng-zorro-antd/modal'
import { NzInputModule } from 'ng-zorro-antd/input'
import { NzRadioModule } from 'ng-zorro-antd/radio'
import { NzButtonModule } from 'ng-zorro-antd/button'
import { AuthService } from 'src/services/auth'
import { authIdentity, decryptAuth } from 'src/utils/admin-auth'
import config from '../../../nav.config.json'

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzModalModule,
    NzInputModule,
    NzRadioModule,
    NzButtonModule,
  ],
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnChanges, OnDestroy {
  @Input() visible = false
  @Output() onCancel = new EventEmitter<void>()
  @ViewChild('input', { static: false }) input!: ElementRef

  readonly $t = $t
  readonly isSelfDevelop = isSelfDevelop
  readonly config = config
  readonly tokenHelpUrl = config.gitRepoUrl.includes('gitee.com')
    ? 'https://gitee.com/profile/personal_access_tokens'
    : config.gitRepoUrl.includes('gitlab.com')
      ? 'https://gitlab.com/-/user_settings/personal_access_tokens'
      : 'https://github.com/settings/personal-access-tokens/new'
  token = ''
  password = ''
  imageToken = ''
  submitting = false
  checking = false
  authSource: string | null = null
  mode: 'password' | 'token' = 'token'
  configError = ''
  loginError = ''
  showImgToken = false
  private alive = true

  constructor(
    private readonly message: NzMessageService,
    private router: Router,
    private auth: AuthService,
  ) {
    if (!isSelfDevelop) {
      this.showImgToken = isStandaloneImage()
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue && !isSelfDevelop)
      void this.loadConfig()
  }

  get canSubmit(): boolean {
    return this.mode === 'password'
      ? !!this.password
      : !!this.token.trim() && (!this.showImgToken || !!this.imageToken.trim())
  }

  async loadConfig(): Promise<void> {
    if (this.checking || this.submitting) return
    this.checking = true
    this.configError = ''
    try {
      const source = await this.auth.loadPublic()
      if (!this.alive) return
      this.authSource = source
      this.selectMode(source ? 'password' : 'token')
    } catch (error: any) {
      if (!this.alive) return
      this.authSource = null
      this.selectMode('token')
      this.configError = error.message || $t('_authLoginFailed')
    } finally {
      if (this.alive) {
        this.checking = false
        this.inputFocus()
      }
    }
  }

  selectMode(mode: 'password' | 'token'): void {
    if (this.submitting) return
    this.mode = mode
    this.token = this.password = this.imageToken = ''
    this.loginError = ''
    this.inputFocus()
  }

  ngAfterViewInit(): void {
    this.inputFocus()
  }

  handleCancel(): void {
    this.onCancel.emit()
    this.router.navigate(['/'])
  }

  private inputFocus(): void {
    setTimeout(() => {
      this.input?.nativeElement?.focus()
    }, 500)
  }

  onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault()
      void this.login()
    }
  }

  async login(): Promise<void> {
    if (this.submitting || this.checking || !this.canSubmit) return
    const token = this.token,
      password = this.password,
      imageToken = this.imageToken,
      mode = this.mode
    this.token = this.password = this.imageToken = ''
    this.loginError = ''
    this.submitting = true
    try {
      const credentials =
        mode === 'password' && this.authSource
          ? await decryptAuth(this.authSource, password, authIdentity(config))
          : { token, ...(this.showImgToken ? { imageToken } : {}) }
      if (!this.alive) return
      await this.auth.login(credentials)
      if (!this.alive) return
      await createBranch('image').catch(() => undefined)
      await removeWebsite().catch(() => undefined)
      if (this.alive) {
        this.message.success($t('_authLoginSuccess'))
        window.location.reload()
      }
    } catch (error: any) {
      if (this.alive)
        this.loginError =
          mode === 'password' && error.response?.status === 401
            ? $t('_authTokenExpired', { branch: config.branch })
            : error.message || $t('_authLoginFailed')
    } finally {
      if (this.alive) this.submitting = false
    }
  }

  ngOnDestroy(): void {
    this.alive = false
    this.token = this.password = this.imageToken = ''
    this.auth.cancelPendingLogin()
  }
}
