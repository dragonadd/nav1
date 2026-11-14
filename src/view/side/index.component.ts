import { Component, ElementRef, HostListener, ViewChild } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink } from '@angular/router'
import { NzIconModule } from 'ng-zorro-antd/icon'
import { CommonService } from 'src/services/common'
import { CardComponent } from 'src/components/card/index.component'
import { SearchComponent } from 'src/components/search/index.component'
import { FooterComponent } from 'src/components/footer/footer.component'
import { FixbarComponent } from 'src/components/fixbar/index.component'
import { NoDataComponent } from 'src/components/no-data/no-data.component'
import { ToolbarTitleWebComponent } from 'src/components/toolbar-title/index.component'
import { ComponentGroupComponent } from 'src/components/component-group/index.component'
import { LogoComponent } from 'src/components/logo/logo.component'
import { DailyTextComponent } from 'src/components/daily-text/index.component'
import { $t } from 'src/locale'

@Component({
  standalone: true,
  selector: 'app-side',
  imports: [
    CommonModule,
    RouterLink,
    NzIconModule,
    CardComponent,
    SearchComponent,
    FooterComponent,
    FixbarComponent,
    NoDataComponent,
    ToolbarTitleWebComponent,
    ComponentGroupComponent,
    LogoComponent,
    DailyTextComponent,
  ],
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export default class SideComponent {
  @ViewChild('menuButton') menuButton?: ElementRef<HTMLButtonElement>
  readonly $t = $t
  private readonly breakpoint = window.matchMedia('(max-width: 768px)')
  mobile = this.breakpoint.matches
  menuOpen = false
  private readonly onBreakpoint = () => {
    this.mobile = this.breakpoint.matches
    this.menuOpen = false
  }

  constructor(public commonService: CommonService) {
    this.breakpoint.addEventListener('change', this.onBreakpoint)
  }

  get bannerImage() {
    const image = this.commonService.settings().sideBanner
    return image ? `url(${JSON.stringify(image)})` : null
  }

  selectCategory(id: number) {
    this.commonService.handleClickClass(id)
    this.menuOpen = false
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  @HostListener('document:keydown.escape')
  closeMenu() {
    if (this.menuOpen) this.menuButton?.nativeElement.focus()
    this.menuOpen = false
  }

  ngOnDestroy() {
    this.breakpoint.removeEventListener('change', this.onBreakpoint)
  }
}
