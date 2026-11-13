export function migrateSideSettings(settings: Record<string, any>): void {
  if (settings.theme === 'Index') settings.theme = 'Side'
  if (settings.appTheme === 'Index') settings.appTheme = 'Side'
  for (const [oldKey, newKey] of [
    ['indexTitle', 'sideTitle'],
    ['indexDescription', 'sideDescription'],
    ['indexDocTitle', 'sideDocTitle'],
    ['indexFooterHTML', 'sideFooterHTML'],
  ]) {
    settings[newKey] = settings[oldKey] || settings[newKey] || ''
    delete settings[oldKey]
  }
  settings.sideBanner ??=
    settings.indexBanner ??
    settings.sideThemeImages?.[0]?.src ??
    'assets/img/side-banner.svg'
  if (settings.sideBanner === 'assets/img/index-banner.svg')
    settings.sideBanner = 'assets/img/side-banner.svg'
  delete settings.indexBanner
}
