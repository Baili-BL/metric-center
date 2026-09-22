const CSS = [
  '/vendor/univer/preset-sheets-core.css',
  '/vendor/univer/preset-sheets-data-validation.css',
  '/vendor/univer/preset-sheets-conditional-formatting.css',
  '/vendor/univer/preset-sheets-drawing.css',
  '/vendor/univer/preset-sheets-advanced.css',
]
const SCRIPTS = [
  '/vendor/react.production.min.js',
  '/vendor/react-dom.production.min.js',
  '/vendor/rxjs.umd.min.js',
  '/vendor/echarts.min.js',
  '/vendor/univer/presets.umd.js',
  '/vendor/univer/preset-sheets-core.umd.js',
  '/vendor/univer/preset-sheets-core.zh-CN.js',
  '/vendor/univer/preset-sheets-data-validation.umd.js',
  '/vendor/univer/preset-sheets-data-validation.zh-CN.js',
  '/vendor/univer/preset-sheets-conditional-formatting.umd.js',
  '/vendor/univer/preset-sheets-conditional-formatting.zh-CN.js',
  '/vendor/univer/preset-sheets-drawing.umd.js',
  '/vendor/univer/preset-sheets-drawing.zh-CN.js',
  '/vendor/univer/preset-sheets-advanced.umd.js',
  '/vendor/univer/preset-sheets-advanced.zh-CN.js',
]

let loaded = false
let loading = null

function loadCss(href) {
  if (document.querySelector(`link[data-univer="${href}"]`)) return
  const el = document.createElement('link')
  el.rel = 'stylesheet'
  el.href = href
  el.dataset.univer = href
  document.head.appendChild(el)
}
function loadScript(src) {
  if (document.querySelector(`script[data-univer="${src}"]`)) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.async = false
    el.dataset.univer = src
    el.onload = () => resolve()
    el.onerror = () => reject(new Error(`加载失败：${src}`))
    document.body.appendChild(el)
  })
}
export function ensureUniverAssets() {
  if (loaded) return Promise.resolve()
  if (loading) return loading
  CSS.forEach(loadCss)
  loading = SCRIPTS.reduce((p, src) => p.then(() => loadScript(src)), Promise.resolve())
    .then(() => { loaded = true })
    .catch((err) => { loading = null; throw err })
  return loading
}

function pickPreset(nsName, fnName) {
  const ns = window[nsName]
  return ns && ns[fnName] ? ns[fnName] : null
}
function collectLocales() {
  return [
    'UniverPresetSheetsCoreZhCN',
    'UniverPresetSheetsDataValidationZhCN',
    'UniverPresetSheetsConditionalFormattingZhCN',
    'UniverPresetSheetsDrawingZhCN',
    'UniverPresetSheetsAdvancedZhCN',
  ].map((k) => window[k]).filter(Boolean)
}

export async function bootUniver(container) {
  await ensureUniverAssets()
  if (!window.UniverPresets || !window.UniverCore || !window.UniverPresetSheetsCore) {
    throw new Error('表格引擎加载失败，请刷新后重试')
  }
  const { createUniver } = window.UniverPresets
  const { LocaleType, mergeLocales } = window.UniverCore
  const { UniverSheetsCorePreset } = window.UniverPresetSheetsCore
  const locale = LocaleType.ZH_CN || LocaleType.zhCN || 'zhCN'
  const packs = collectLocales()
  const locales = { [locale]: packs.length ? mergeLocales(...packs) : {} }
  const dvPreset = pickPreset('UniverPresetSheetsDataValidation', 'UniverSheetsDataValidationPreset')
  const cfPreset = pickPreset('UniverPresetSheetsConditionalFormatting', 'UniverSheetsConditionalFormattingPreset')
  const drawPreset = pickPreset('UniverPresetSheetsDrawing', 'UniverSheetsDrawingPreset')
  const advPreset = pickPreset('UniverPresetSheetsAdvanced', 'UniverSheetsAdvancedPreset')
  const presets = [
    UniverSheetsCorePreset({
      container,
      ribbonType: 'classic',
      menu: {
        'sheet.menu.data-validation': { hidden: true },
        'sheet.operation.open.conditional.formatting.panel': { hidden: true },
        'sheet.operation.open-pivot-table-range-selector-panel': { hidden: true },
      },
    }),
  ]
  if (dvPreset) presets.push(dvPreset())
  if (cfPreset) presets.push(cfPreset())
  if (drawPreset) presets.push(drawPreset())
  if (advPreset) presets.push(advPreset({ useWorker: false }))
  try {
    return createUniver({ locale, locales, presets }).univerAPI
  } catch {
    return createUniver({
      locale,
      locales,
      presets: [
        UniverSheetsCorePreset({ container, ribbonType: 'classic' }),
        dvPreset && dvPreset(),
        cfPreset && cfPreset(),
      ].filter(Boolean),
    }).univerAPI
  }
}

export function snapshotWorkbook(api) {
  if (!api) return null
  const wb = api.getActiveWorkbook?.()
  if (!wb) return null
  try { return wb.getSnapshot ? wb.getSnapshot() : (wb.save ? wb.save() : null) } catch { return null }
}

export function setWorkbookReadonly(api) {
  if (!api) return
  try {
    const wb = api.getActiveWorkbook?.()
    if (wb?.setEditable) wb.setEditable(false)
  } catch { /* */ }
  try {
    const unit = api.getActiveWorkbook?.()
    const perms = unit?.getPermission?.()
    if (perms?.setWorkbookEditPermission) perms.setWorkbookEditPermission(false)
  } catch { /* */ }
}

export async function openWorkbook(api, data) {
  if (!api || !data) return
  try {
    const cur = api.getActiveWorkbook?.()
    if (cur && api.disposeUnit) api.disposeUnit(cur.getId())
    else if (cur?.dispose) cur.dispose()
  } catch { /* */ }
  api.createWorkbook(JSON.parse(JSON.stringify(data)))
}

function appendMenuTo(menu, paths) {
  if (!menu?.appendTo) return
  for (let i = 0; i < paths.length; i++) {
    try { menu.appendTo(paths[i]); return } catch { /* */ }
  }
}

export function runSheetCmd(api, id) {
  try {
    if (api?.executeCommand) { api.executeCommand(id); return true }
    const cmd = api?.getCommandService?.()
    if (cmd?.executeCommand) { cmd.executeCommand(id); return true }
  } catch { /* */ }
  return false
}

export function registerRibbonExtras(api, hooks = {}) {
  if (!api?.createMenu) return
  const toast = hooks.toast || (() => {})
  const menu = (id, title, action) => api.createMenu({ id, title, tooltip: title, action })
  const submenu = (id, title) => (api.createSubmenu ? api.createSubmenu({ id, title, tooltip: title }) : null)

  const dv = submenu('ailab-dv', '有效性')
  if (dv?.addSubmenu) {
    dv.addSubmenu(menu('ailab-dv-add', '设置有效性', () => {
      if (!runSheetCmd(api, 'data-validation.command.addRuleAndOpen')) toast('有效性功能未就绪')
    }))
    dv.addSubmenu(menu('ailab-dv-manage', '有效性管理', () => {
      if (!runSheetCmd(api, 'data-validation.operation.open-validation-panel')) toast('有效性功能未就绪')
    }))
    appendMenuTo(dv, ['ribbon.data.rules', 'ribbon.data.others', 'ribbon.data'])
  } else {
    appendMenuTo(menu('ailab-dv-add', '有效性', () => {
      if (!runSheetCmd(api, 'data-validation.command.addRuleAndOpen') && !runSheetCmd(api, 'data-validation.operation.open-validation-panel')) toast('有效性功能未就绪')
    }), ['ribbon.data.rules', 'ribbon.data.others', 'ribbon.data'])
  }

  appendMenuTo(menu('ailab-pivot', '数据透视表', () => hooks.onPivot?.()), ['ribbon.data.organization', 'ribbon.data.others', 'ribbon.data'])
  appendMenuTo(menu('ailab-cf', '条件格式', () => {
    if (!runSheetCmd(api, 'sheet.operation.open.conditional.formatting.panel')) toast('条件格式功能未就绪')
  }), ['ribbon.start.format', 'ribbon.start.others', 'ribbon.start'])

  const freeze = submenu('ailab-freeze', '冻结窗格')
  const freezeSel = () => {
    if (runSheetCmd(api, 'sheet.command.set-selection-frozen')) return
    toast('冻结功能未就绪')
  }
  if (freeze?.addSubmenu) {
    freeze.addSubmenu(menu('ailab-freeze-sel', '冻结窗格', freezeSel))
    freeze.addSubmenu(menu('ailab-freeze-row', '冻结首行', () => runSheetCmd(api, 'sheet.command.set-first-row-frozen') || freezeSel()))
    freeze.addSubmenu(menu('ailab-freeze-col', '冻结首列', () => runSheetCmd(api, 'sheet.command.set-first-col-frozen') || freezeSel()))
    freeze.addSubmenu(menu('ailab-freeze-off', '取消冻结', () => runSheetCmd(api, 'sheet.command.cancel-frozen')))
    appendMenuTo(freeze, ['ribbon.view.display', 'ribbon.view.Visibility', 'ribbon.view.others', 'ribbon.view'])
  } else {
    appendMenuTo(menu('ailab-freeze-sel', '冻结窗格', freezeSel), ['ribbon.view.display', 'ribbon.view.others', 'ribbon.view'])
  }
}
