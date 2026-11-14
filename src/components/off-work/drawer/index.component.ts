// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xiejiahe. All rights reserved.
// See https://github.com/xjh22222228/nav

import { Component, EventEmitter, Output } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { $t } from 'src/locale'
import { FormBuilder, FormGroup } from '@angular/forms'
import { NzMessageService } from 'ng-zorro-antd/message'
import { NzDrawerModule } from 'ng-zorro-antd/drawer'
import { NzFormModule } from 'ng-zorro-antd/form'
import { NzButtonModule } from 'ng-zorro-antd/button'
import { NzInputModule } from 'ng-zorro-antd/input'
import { NzTimePickerModule } from 'ng-zorro-antd/time-picker'

@Component({
  standalone: true,
  imports: [
    NzTimePickerModule,
    FormsModule,
    ReactiveFormsModule,
    NzDrawerModule,
    NzFormModule,
    NzButtonModule,
    NzInputModule,
  ],
  selector: 'offwork-drawer',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export class OffWorkDrawerComponent {
  @Output() ok = new EventEmitter<void>()

  $t = $t
  visible = false
  validateForm!: FormGroup
  index = 0

  constructor(
    private fb: FormBuilder,
    private message: NzMessageService,
  ) {
    this.validateForm = this.fb.group({
      workTitle: [''],
      restTitle: [''],
      startDate: [null],
      date: [null],
    })
  }

  open(data: any, idx: number) {
    this.index = idx
    for (const k in data) {
      this.validateForm
        .get(k)
        ?.setValue(
          k === 'startDate' || k === 'date' ? new Date(data[k]) : data[k],
        )
    }
    this.visible = true
  }

  handleClose() {
    this.visible = false
  }

  handleSubmit(): any {
    const values = this.validateForm.value
    const startDate = new Date(values.startDate).getTime()
    const date = new Date(values.date).getTime()
    const seconds = (value: number) => {
      const time = new Date(value)
      return time.getHours() * 3600 + time.getMinutes() * 60 + time.getSeconds()
    }
    if (
      !Number.isFinite(startDate) ||
      !Number.isFinite(date) ||
      values.startDate == null ||
      values.date == null ||
      seconds(startDate) >= seconds(date)
    ) {
      return this.message.error(
        '请填写有效的上班和下班时间，下班时间须晚于上班时间',
      )
    }
    this.ok.emit({
      ...values,
      startDate,
      date,
      index: this.index,
    })
    this.handleClose()
  }
}
