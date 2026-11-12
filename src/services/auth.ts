import { Injectable } from '@angular/core'
import config from '../../nav.config.json'
import { isStandaloneImage, verifyToken } from 'src/api'
import { commitAuthFile, getAuthFile, type AuthFile } from 'src/api/auth'
import { getToken, getImageToken, setLoginCredentials } from 'src/utils/user'
import { isSelfDevelop } from 'src/utils/utils'
import {
  authIdentity,
  encryptAuth,
  loadPublicAuth,
  parseAuth,
  validLoginPassword,
  validateTokenText,
  type AuthCredentials,
} from 'src/utils/admin-auth'

@Injectable({ providedIn: 'root' })
export class AuthService {
  private file: AuthFile | null | undefined
  private loginVersion = 0

  loadPublic() {
    return loadPublicAuth(document.baseURI)
  }

  private async validate(value: AuthCredentials): Promise<AuthCredentials> {
    const token = isSelfDevelop
      ? value.token.trim()
      : validateTokenText(value.token)
    if (!token) throw new Error('请输入登录凭证')
    await verifyToken(token)
    if (!isSelfDevelop && config.imageRepoUrl) {
      const imageToken = isStandaloneImage()
        ? validateTokenText(value.imageToken || '')
        : token
      await verifyToken(imageToken, config.imageRepoUrl)
      if (isStandaloneImage()) return { token, imageToken }
    }
    return { token }
  }

  async login(value: AuthCredentials): Promise<void> {
    const version = ++this.loginVersion
    const credentials = await this.validate(value)
    if (version !== this.loginVersion) throw new Error('登录已取消')
    setLoginCredentials(credentials)
  }

  cancelPendingLogin(): void {
    ++this.loginVersion
  }

  async loadManagement(): Promise<'unset' | 'set' | 'invalid'> {
    this.assertStaticLogin()
    this.file = undefined
    this.file = await getAuthFile()
    if (!this.file?.content.trim()) return 'unset'
    try {
      parseAuth(this.file.content)
      return 'set'
    } catch {
      return 'invalid'
    }
  }

  private assertStaticLogin(): void {
    if (isSelfDevelop) throw new Error('自有部署请在服务器配置中管理登录密码')
    if (!getToken()) throw new Error('请先登录后台')
  }

  private managedFile() {
    this.assertStaticLogin()
    if (this.file === undefined) throw new Error('请先重新读取登录密码状态')
    return this.file
  }

  private async currentCredentials(): Promise<AuthCredentials> {
    const value = {
      token: getToken(),
      ...(isStandaloneImage() ? { imageToken: getImageToken() } : {}),
    }
    const checked = await this.validate(value)
    if (
      getToken() !== value.token ||
      (value.imageToken !== undefined && getImageToken() !== value.imageToken)
    )
      throw new Error('登录状态已变化，请重新登录')
    return checked
  }

  async setPassword(password: string, confirm: string): Promise<void> {
    const file = this.managedFile()
    if (!validLoginPassword(password))
      throw new Error('密码至少 8 个字符，且必须包含字母和数字')
    if (password !== confirm) throw new Error('两次密码不一致')
    const value = await this.currentCredentials()
    const content = await encryptAuth(value, password, authIdentity(config))
    if (
      getToken() !== value.token ||
      (value.imageToken !== undefined && getImageToken() !== value.imageToken)
    )
      throw new Error('登录状态已变化，请重新登录')
    await commitAuthFile(content, file)
    this.file = undefined
  }

  async removePassword(): Promise<void> {
    const file = this.managedFile()
    if (!file) throw new Error('尚未设置登录密码')
    await this.currentCredentials()
    await commitAuthFile(null, file)
    this.file = undefined
  }
}
