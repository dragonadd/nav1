// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xiejiahe. All rights reserved.
// See https://github.com/xjh22222228/nav

import { Component } from '@angular/core'
import { CommonModule } from '@angular/common'
import { $t } from 'src/locale'
import { getToken } from 'src/utils/user'
import { VERSION } from 'src/constants'
import { isSelfDevelop } from 'src/utils/utils'
import { getRepositories } from 'src/utils/admin-auth'
import config from '../../../../nav.config.json'

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'system-info',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export default class SystemInfoComponent {
  readonly $t = $t
  readonly isSelfDevelop = isSelfDevelop
  readonly token = getToken() ? '••••••••' : ''
  readonly config = config
  readonly date = config.datetime
  readonly version = VERSION
  readonly repository = getRepositories(config).main
  readonly versionUrl = `https://${this.repository.host}/${this.repository.owner}/${this.repository.repo}/${this.repository.provider === 'gitlab' ? '-/tree' : 'tree'}/${encodeURIComponent(this.repository.branch)}`

  constructor() {}
}
