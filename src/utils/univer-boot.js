import { normalizeWorkbook, previewFromMatrix, previewRows, valuesToCellData } from './workbook'

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

function tryCall(fn) {
  try { return fn() } catch { return null }
}

function sheetIdOf(sheet) {
  return tryCall(() => sheet.getSheetId?.()) || tryCall(() => sheet.getId?.()) || ''
}

function sheetNameOf(sheet) {
  return tryCall(() => sheet.getSheetName?.()) || tryCall(() => sheet.getName?.()) || ''
}

function readLiveSheet(sheet) {
  const range = tryCall(() => sheet.getDataRange?.())
  let values = range && (tryCall(() => range.getDisplayValues?.()) || tryCall(() => range.getValues?.()))
  let startRow = 0
  let startCol = 0
  if (range) {
    startRow = Number(tryCall(() => range.getRow?.()) ?? tryCall(() => range.getStartRow?.()) ?? 0) || 0
    startCol = Number(tryCall(() => range.getColumn?.()) ?? tryCall(() => range.getStartColumn?.()) ?? 0) || 0
  }
  if (!values?.length) {
    const lastR = Math.min(Number(tryCall(() => sheet.getLastRow?.()) ?? 40) + 1, 80)
    const lastC = Math.min(Number(tryCall(() => sheet.getLastColumn?.()) ?? 16) + 1, 24)
    const fallback = tryCall(() => sheet.getRange?.(0, 0, lastR, lastC))
    values = fallback && (tryCall(() => fallback.getDisplayValues?.()) || tryCall(() => fallback.getValues?.()))
    startRow = 0
    startCol = 0
  }
  if (!values?.length) return null
  return { startRow, startCol, values }
}

function overlayLiveSheets(api, snap) {
  const wb = api.getActiveWorkbook?.()
  if (!wb) return previewRows(snap)
  const sheets = tryCall(() => wb.getSheets?.()) || []
  if (!snap.sheets) snap.sheets = {}
  if (!Array.isArray(snap.sheetOrder)) snap.sheetOrder = []
  const active = tryCall(() => wb.getActiveSheet?.())
  const activeId = active ? sheetIdOf(active) : ''
  let activePreview = null
  sheets.forEach((sheet) => {
    const id = sheetIdOf(sheet)
    const name = sheetNameOf(sheet)
    if (!id) return
    if (!snap.sheetOrder.includes(id)) snap.sheetOrder.push(id)
    if (!snap.sheets[id]) snap.sheets[id] = { id, name, cellData: {}, rowCount: 40, columnCount: 12 }
    if (name) snap.sheets[id].name = name
    const live = readLiveSheet(sheet)
    if (!live) return
    const liveCells = valuesToCellData(live.values, live.startRow, live.startCol)
    const dest = snap.sheets[id].cellData && typeof snap.sheets[id].cellData === 'object' ? snap.sheets[id].cellData : {}
    Object.keys(liveCells).forEach((r) => {
      dest[r] = dest[r] && typeof dest[r] === 'object' ? dest[r] : {}
      Object.keys(liveCells[r]).forEach((c) => {
        const prev = dest[r][c]
        const next = liveCells[r][c]
        dest[r][c] = prev && typeof prev === 'object' ? { ...prev, v: next.v, t: next.t } : next
      })
    })
    snap.sheets[id].cellData = dest
    const fromTitle = tryCall(() => sheet.getRange?.(0, 0, 16, 10))
    const titleVals = fromTitle && (tryCall(() => fromTitle.getDisplayValues?.()) || tryCall(() => fromTitle.getValues?.()))
    const prev = previewFromMatrix(titleVals || live.values, 16, 10)
    if (id === activeId || !activePreview?.length) activePreview = prev
  })
  if (activeId) snap.activeSheetId = activeId
  return activePreview?.length ? activePreview : previewRows(snap)
}

export function scrollSheetToOrigin(api) {
  try {
    const sheet = api?.getActiveWorkbook?.()?.getActiveSheet?.()
    if (sheet?.scrollToCell) sheet.scrollToCell(0, 0)
    else if (sheet?.getRange) sheet.getRange(0, 0)?.activate?.()
  } catch { /* */ }
}

function waitFrames(n = 2) {
  return new Promise((resolve) => {
    const step = () => {
      n -= 1
      if (n <= 0) resolve()
      else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

function findSheetRoot(root) {
  const sels = [
    '.univer-workbench-container-content',
    '.univer-sheet-container',
    '[class*="sheet-container"]',
    '[class*="render-canvas"]',
  ]
  for (const s of sels) {
    const el = root.querySelector(s)
    if (el?.querySelector?.('canvas')) return el
  }
  const canvas = [...root.querySelectorAll('canvas')].sort((a, b) => {
    const ar = a.getBoundingClientRect()
    const br = b.getBoundingClientRect()
    return br.width * br.height - ar.width * ar.height
  })[0]
  return canvas?.parentElement || root
}

function canvasLayers(root) {
  return [...root.querySelectorAll('canvas')]
    .map((c) => {
      const r = c.getBoundingClientRect()
      const z = Number(getComputedStyle(c).zIndex) || 0
      return { c, r, z, area: r.width * r.height }
    })
    .filter((x) => x.r.width > 8 && x.r.height > 8 && x.c.width > 0 && x.c.height > 0)
    .sort((a, b) => a.z - b.z || a.area - b.area)
}

function cropPicture(src, pad = 6) {
  const ctx = src.getContext('2d')
  if (!ctx) return src
  const w = src.width
  const h = src.height
  if (!w || !h) return src
  let data
  try { data = ctx.getImageData(0, 0, w, h).data } catch { return src }
  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const a = data[i + 3]
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const blank = a < 10
        || (r > 250 && g > 250 && b > 250)
        || (Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && r > 198 && r < 248)
      if (blank) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX < minX) return src
  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(w - 1, maxX + pad)
  maxY = Math.min(h - 1, maxY + pad)
  const cw = maxX - minX + 1
  const ch = maxY - minY + 1
  if (cw >= w - 2 && ch >= h - 2) return src
  const out = document.createElement('canvas')
  out.width = cw
  out.height = ch
  out.getContext('2d').drawImage(src, minX, minY, cw, ch, 0, 0, cw, ch)
  return out
}

function usedRange(api) {
  const fallback = { rows: 8, cols: 4, r0: 0, c0: 0 }
  try {
    const sheet = api?.getActiveWorkbook?.()?.getActiveSheet?.()
    if (!sheet) return fallback
    let rows = 0
    let cols = 0
    const live = readLiveSheet(sheet)
    if (live?.values?.length) {
      live.values.forEach((row, r) => {
        if (!Array.isArray(row)) return
        row.forEach((cell, c) => {
          if (cell === null || cell === undefined || String(cell).trim() === '') return
          rows = Math.max(rows, live.startRow + r + 1)
          cols = Math.max(cols, live.startCol + c + 1)
        })
      })
    }
    if (rows < 2 || cols < 2) {
      const range = tryCall(() => sheet.getDataRange?.())
      if (range) {
        const r0 = Number(tryCall(() => range.getRow?.()) ?? 0) || 0
        const c0 = Number(tryCall(() => range.getColumn?.()) ?? 0) || 0
        const lastR = Number(tryCall(() => range.getLastRow?.()) ?? r0)
        const lastC = Number(tryCall(() => range.getLastColumn?.()) ?? c0)
        rows = Math.max(rows, lastR - r0 + 1)
        cols = Math.max(cols, lastC - c0 + 1)
      }
    }
    return {
      rows: Math.min(Math.max(rows, 4), 16),
      cols: Math.min(Math.max(cols, 3), 10),
      r0: 0,
      c0: 0,
    }
  } catch {
    return fallback
  }
}

function fitCanvas(src, tw, th) {
  const sw = Math.max(1, src.width)
  const sh = Math.max(1, src.height)
  const scale = Math.min(tw / sw, th / sh)
  const dw = Math.max(1, Math.round(sw * scale))
  const dh = Math.max(1, Math.round(sh * scale))
  const out = document.createElement('canvas')
  out.width = tw
  out.height = th
  const ctx = out.getContext('2d', { alpha: false })
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, tw, th)
  if (scale < 0.999) {
    const pre = downsampleCanvas(src, dw, dh)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(pre, 0, 0)
  } else {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src, 0, 0, sw, sh, 0, 0, dw, dh)
  }
  return out
}

function downsampleCanvas(src, tw, th) {
  let cur = src
  let w = src.width
  let h = src.height
  if (w <= tw && h <= th) return src
  const opts = { alpha: false }
  while (w / 2 >= tw && h / 2 >= th) {
    const next = document.createElement('canvas')
    next.width = Math.max(1, Math.round(w / 2))
    next.height = Math.max(1, Math.round(h / 2))
    const ctx = next.getContext('2d', opts)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(cur, 0, 0, w, h, 0, 0, next.width, next.height)
    cur = next
    w = next.width
    h = next.height
  }
  if (w === tw && h === th) return cur
  const out = document.createElement('canvas')
  out.width = tw
  out.height = th
  const ctx = out.getContext('2d', opts)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, tw, th)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(cur, 0, 0, w, h, 0, 0, tw, th)
  return out
}

function exportThumb(canvas, quality) {
  try {
    const png = canvas.toDataURL('image/png')
    if (png.length && png.length < 420000) return png
    return canvas.toDataURL('image/jpeg', quality ?? 0.96)
  } catch {
    return ''
  }
}

export async function captureSheetThumb(host, opt = {}) {
  const root = typeof host === 'string' ? document.getElementById(host) : host
  if (!root) return ''
  await waitFrames(3)
  const box = findSheetRoot(root)
  const layers = canvasLayers(box)
  if (!layers.length) return ''
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  layers.forEach(({ r }) => {
    minX = Math.min(minX, r.left)
    minY = Math.min(minY, r.top)
    maxX = Math.max(maxX, r.right)
    maxY = Math.max(maxY, r.bottom)
  })
  const fullW = Math.max(1, maxX - minX)
  const fullH = Math.max(1, maxY - minY)
  const dpr = Math.max(
    window.devicePixelRatio || 1,
    ...layers.map((x) => x.c.width / Math.max(1, x.r.width)),
  )
  const raw = document.createElement('canvas')
  raw.width = Math.round(fullW * dpr)
  raw.height = Math.round(fullH * dpr)
  const ctx = raw.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, raw.width, raw.height)
  ctx.imageSmoothingEnabled = false
  layers.forEach(({ c, r }) => {
    const dx = (r.left - minX) * dpr
    const dy = (r.top - minY) * dpr
    const dw = r.width * dpr
    const dh = r.height * dpr
    try { ctx.drawImage(c, 0, 0, c.width, c.height, dx, dy, dw, dh) } catch { /* */ }
  })
  const main = [...layers].sort((a, b) => b.area - a.area)[0]
  const colHead = layers.find((x) => x.r.height < 40 && x.r.width > 120)
  const rowHead = layers.find((x) => x.r.width < 80 && x.r.height > 80)
  const used = usedRange(opt.api)
  const headerH = colHead ? colHead.r.height : 27
  const headerW = rowHead ? rowHead.r.width : 46
  const visRows = Math.max(8, Math.round(main.r.height / 24))
  const visCols = Math.max(6, Math.round(main.r.width / 73))
  const rowPx = main.r.height / visRows
  const colPx = main.r.width / visCols
  const endRow = used.r0 + used.rows
  const endCol = used.c0 + used.cols
  const ox = Math.round(headerW * dpr)
  const oy = Math.round(headerH * dpr)
  const rangeW = Math.round(endCol * colPx * dpr + 8 * dpr)
  const rangeH = Math.round(endRow * rowPx * dpr + 8 * dpr)
  let srcW = Math.min(raw.width - ox, Math.max(80, rangeW))
  let srcH = Math.min(raw.height - oy, Math.max(48, rangeH))
  const slot = document.querySelector('.tbl-card .tc-preview')
  const cssW = opt.thumbW || slot?.clientWidth || 180
  const cssH = opt.thumbH || slot?.clientHeight || 244
  const crop = document.createElement('canvas')
  crop.width = srcW
  crop.height = srcH
  const cctx = crop.getContext('2d', { alpha: false })
  cctx.fillStyle = '#fff'
  cctx.fillRect(0, 0, srcW, srcH)
  cctx.imageSmoothingEnabled = false
  cctx.drawImage(raw, ox, oy, srcW, srcH, 0, 0, srcW, srcH)
  const outScale = Math.max(2, Math.round(dpr))
  const thumbW = Math.round(cssW * outScale)
  const thumbH = Math.round(cssH * outScale)
  const pic = fitCanvas(crop, thumbW, thumbH)
  return exportThumb(pic, opt.quality)
}

export function snapshotWorkbook(api) {
  if (!api) return null
  const wb = api.getActiveWorkbook?.()
  if (!wb) return null
  try {
    if (api.executeCommand) api.executeCommand('sheet.operation.set-cell-edit-visible', { visible: false })
  } catch { /* */ }
  let snap = null
  try { snap = wb.save ? wb.save() : null } catch { /* */ }
  if (!snap) {
    try { snap = wb.getSnapshot ? wb.getSnapshot() : null } catch { /* */ }
  }
  if (!snap) snap = { id: tryCall(() => wb.getId?.()) || '', name: '', sheetOrder: [], sheets: {} }
  let cloned = normalizeWorkbook(snap)
  try { cloned = JSON.parse(JSON.stringify(cloned)) } catch { /* keep cloned */ }
  if (!cloned || typeof cloned !== 'object') return null
  const preview = overlayLiveSheets(api, cloned)
  cloned.__preview = preview
  return cloned
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
