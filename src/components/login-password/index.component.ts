import { Component, type OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NzButtonModule } from 'ng-zorro-antd/button'
import { NzInputModule } from 'ng-zorro-antd/input'
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm'
import config from '../../../nav.config.json'
import { AuthService } from 'src/services/auth'
import { validLoginPassword } from 'src/utils/admin-auth'
import { $t } from 'src/locale'

@Component({
  standalone: true,
  selector: 'app-login-password',
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzInputModule,
    NzPopconfirmModule,
  ],
  templateUrl: './index.component.html',
})
export class LoginPasswordComponent implements OnDestroy {
  readonly $t = $t
  readonly branch = config.branch
  newPassword = ''
  confirmPassword = ''
  status: 'unset' | 'set' | 'invalid' | undefined
  loading = false
  busy = false
  error = ''
  deployMessage = ''
  private alive = true

  constructor(private auth: AuthService) {
    void this.load()
  }

  get passwordError(): string {
    if (this.newPassword && !validLoginPassword(this.newPassword))
      return $t('_authPasswordRule')
    if (this.confirmPassword && this.confirmPassword !== this.newPassword)
      return $t('_authPasswordMismatch')
    return ''
  }

  get canSave(): boolean {
    return (
      this.status !== undefined &&
      !this.loading &&
      !this.busy &&
      validLoginPassword(this.newPassword) &&
      this.newPassword === this.confirmPassword
    )
  }

  async load(): Promise<void> {
    if (this.loading || this.busy) return
    this.loading = true
    this.status = undefined
    this.error = ''
    try {
      const status = await this.auth.loadManagement()
      if (this.alive) this.status = status
    } catch (error: any) {
      if (this.alive) this.error = error.message || $t('_authLoginFailed')
    } finally {
      if (this.alive) this.loading = false
    }
  }

  async save(): Promise<void> {
    if (!this.canSave) return
    this.busy = true
    this.error = this.deployMessage = ''
    try {
      await this.auth.setPassword(this.newPassword, this.confirmPassword)
      if (!this.alive) return
      this.newPassword = this.confirmPassword = ''
      this.deployMessage = $t('_authDeployMessage')
      this.busy = false
      await this.load()
    } catch (error: any) {
      if (this.alive) this.error = error.message || $t('_authLoginFailed')
    } finally {
      if (this.alive) this.busy = false
    }
  }

  async remove(): Promise<void> {
    if (this.busy || this.loading || !this.status || this.status === 'unset')
      return
    this.busy = true
    this.error = this.deployMessage = ''
    try {
      await this.auth.removePassword()
      if (!this.alive) return
      this.newPassword = this.confirmPassword = ''
      this.deployMessage = $t('_authDeployMessage')
      this.busy = false
      await this.load()
    } catch (error: any) {
      if (this.alive) this.error = error.message || $t('_authLoginFailed')
    } finally {
      if (this.alive) this.busy = false
    }
  }

  ngOnDestroy(): void {
    this.alive = false
    this.newPassword = this.confirmPassword = ''
  }
}
