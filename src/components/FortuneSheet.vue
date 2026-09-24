<script setup>
import { createElement, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { handleBorder } from '@fortune-sheet/core'
import { Workbook } from '@fortune-sheet/react'
import { nextTick, onBeforeUnmount, reactive, ref } from 'vue'
import { colLetter, fortuneToUniver, paintWorkbookThumb, univerToFortune, xlsxToUniver } from '../utils/workbook'
import {
  applyFeishuIcons,
  feishuIcon,
  BORDER_CARET,
  BORDER_CARET_SM,
  BORDER_DOUBLE,
  BORDER_GRID,
  BORDER_PEN,
  BORDER_PEN_BAR,
  BORDER_STYLES,
  CF_CARET,
  CF_HELP,
  FIND_CARET,
  FIND_CLOSE,
  FIND_EXPAND,
  FIND_NEXT,
  FIND_PREV,
  FIND_SEARCH,
  FEISHU_INSERT_PATHS,
  FEISHU_MENU_PATHS,
} from '../utils/feishu-icons'
import ColorPop from './ColorPop.vue'
import '@fortune-sheet/react/dist/index.css'

const props = defineProps({
  readonly: { type: Boolean, default: false },
})
const emit = defineEmits(['pivot'])

const TOOLBAR_ITEMS = [
  'undo', 'redo', 'format-painter', 'clear-format', '|',
  'font', 'font-size', 'font-color', 'background', 'border', 'bold', '|',
  'horizontal-align', 'freeze', 'merge-cell', 'format', '|',
  'currency-format', 'percentage-format', 'number-increase', 'number-decrease', '|',
  'image', 'filter', 'conditionFormat', '|',
  'search', 'comment', 'link',
]

const LABEL_MAP = {
  菜单: '菜单',
  插入: '插入',
  撤销: '撤销',
  重做: '重做',
  格式刷: '格式刷',
  清除格式: '清除格式',
  合并单元格: '合并单元格',
  格式: '常规',
  冻结: '冻结',
  排序和筛选: '筛选',
  条件格式: '条件格式',
  数据验证: '下拉列表',
  查找替换: '查找和替换',
  批注: '评论',
  文本颜色: '颜色',
  背景色: '填充',
  水平对齐: '对齐',
  边框设置: '边框',
  边框: '边框',
}

const hostRef = ref(null)
const fileRef = ref(null)
const instRef = createRef()
const folded = ref(true)
const pop = reactive({ show: false, kind: '', left: 0, top: 0 })
const freezeInfo = reactive({ row: 0, col: 0, letter: 'A' })
const colorPop = reactive({ show: false, kind: 'fc', origin: '#1f2329', left: 0, top: 0 })
const borderState = reactive({ type: 'border-all', color: '#1f2329', style: '1', styleOpen: false })
const cfState = reactive({
  fly: '',
  flyTop: 0,
  flyLeft: false,
  flyX: 0,
  flyY: 0,
  hasRules: false,
  hasSel: false,
  dlg: '',
  list: [],
})
let cfFlyTimer = 0
const findState = reactive({
  open: false,
  left: 0,
  top: 0,
  query: '',
  replace: '',
  scope: 'sheet',
  formula: false,
  hits: [],
  index: 0,
  scopeOpen: false,
  compact: false,
})
const FIND_SCOPES = [
  { id: 'sheet', label: '当前工作表' },
  { id: 'all', label: '所有工作表' },
]
const cfForm = reactive({
  value: '',
  value2: '',
  date: '',
  repeat: '0',
  project: '10',
  formula: '',
  textOn: true,
  textColor: '#9c0006',
  cellOn: true,
  cellColor: '#ffc7ce',
})
const CF_MENU = [
  { id: 'highlight', label: '突出显示单元格', caret: true },
  { id: 'item', label: '最前/最后/平均值', caret: true },
  { id: 'formula', label: '自定义公式' },
  { sep: true },
  { id: 'color', label: '色阶', caret: true },
  { id: 'bar', label: '数据条', caret: true },
  { id: 'icons', label: '图标集', caret: true },
  { sep: true },
  { id: 'new', label: '新建规则' },
  { id: 'manage', label: '管理规则' },
  { sep: true },
  { id: 'clearSel', label: '清除所选单元格的规则', disable: 'sel' },
  { id: 'clearSheet', label: '清除整张工作表的规则', disable: 'sheet' },
  { sep: true },
  { id: 'help', label: '功能介绍', help: true },
]
const CF_FLIES = {
  highlight: [
    { id: 'greaterThan', label: '大于' },
    { id: 'lessThan', label: '小于' },
    { id: 'between', label: '介于' },
    { id: 'equal', label: '等于' },
    { id: 'textContains', label: '文本包含' },
    { id: 'occurrenceDate', label: '发生日期' },
    { id: 'duplicateValue', label: '重复值' },
  ],
  item: [
    { id: 'top10', label: '前 10 项' },
    { id: 'top10_percent', label: '前 10%' },
    { id: 'last10', label: '后 10 项' },
    { id: 'last10_percent', label: '后 10%' },
    { id: 'aboveAverage', label: '高于平均值' },
    { id: 'belowAverage', label: '低于平均值' },
  ],
  color: [
    { id: 'cg1', type: 'colorGradation', format: ['rgb(99, 190, 123)', 'rgb(255, 235, 132)', 'rgb(248, 105, 107)'], label: '绿-黄-红' },
    { id: 'cg2', type: 'colorGradation', format: ['rgb(248, 105, 107)', 'rgb(255, 235, 132)', 'rgb(99, 190, 123)'], label: '红-黄-绿' },
    { id: 'cg3', type: 'colorGradation', format: ['rgb(99, 190, 123)', 'rgb(255, 255, 255)', 'rgb(248, 105, 107)'], label: '绿-白-红' },
    { id: 'cg4', type: 'colorGradation', format: ['rgb(90, 138, 198)', 'rgb(255, 255, 255)', 'rgb(248, 105, 107)'], label: '蓝-白-红' },
    { id: 'cg5', type: 'colorGradation', format: ['rgb(248, 105, 107)', 'rgb(255, 255, 255)'], label: '红-白' },
    { id: 'cg6', type: 'colorGradation', format: ['rgb(99, 190, 123)', 'rgb(255, 255, 255)'], label: '绿-白' },
  ],
  bar: [
    { id: 'db1', type: 'dataBar', format: ['#638ec6', '#ffffff'], label: '蓝-白渐变' },
    { id: 'db2', type: 'dataBar', format: ['#63c623', '#ffffff'], label: '绿-白渐变' },
    { id: 'db3', type: 'dataBar', format: ['#ff555a', '#ffffff'], label: '红-白渐变' },
    { id: 'db4', type: 'dataBar', format: ['#638ec6'], label: '蓝色' },
    { id: 'db5', type: 'dataBar', format: ['#63c623'], label: '绿色' },
    { id: 'db6', type: 'dataBar', format: ['#ff555a'], label: '红色' },
  ],
  icons: [
    { id: 'ic1', type: 'icons', label: '三色箭头' },
    { id: 'ic2', type: 'icons', label: '三色旗' },
    { id: 'ic3', type: 'icons', label: '三色信号灯' },
  ],
}
const CF_RULES = {
  greaterThan: { title: '条件格式——大于', hint: '为大于以下值的单元格设置格式', kind: 'value' },
  lessThan: { title: '条件格式——小于', hint: '为小于以下值的单元格设置格式', kind: 'value' },
  between: { title: '条件格式——介于', hint: '为介于以下值的单元格设置格式', kind: 'between' },
  equal: { title: '条件格式——等于', hint: '为等于以下值的单元格设置格式', kind: 'value' },
  textContains: { title: '条件格式——文本包含', hint: '为包含以下文本的单元格设置格式', kind: 'value' },
  occurrenceDate: { title: '条件格式——发生日期', hint: '为包含以下日期的单元格设置格式', kind: 'date' },
  duplicateValue: { title: '条件格式——重复值', hint: '为包含以下类型值的单元格设置格式', kind: 'dup' },
  top10: { title: '条件格式——前 10 项', hint: '为值最大的那些单元格设置格式', kind: 'top' },
  top10_percent: { title: '条件格式——前 10%', hint: '为值最大的那些单元格设置格式', kind: 'top%' },
  last10: { title: '条件格式——最后 10 项', hint: '为值最小的那些单元格设置格式', kind: 'last' },
  last10_percent: { title: '条件格式——最后 10%', hint: '为值最小的那些单元格设置格式', kind: 'last%' },
  aboveAverage: { title: '条件格式——高于平均值', hint: '为高于平均值的单元格设置格式', kind: 'none' },
  belowAverage: { title: '条件格式——低于平均值', hint: '为低于平均值的单元格设置格式', kind: 'none' },
  formula: { title: '条件格式——自定义公式', hint: '使用公式确定要设置格式的单元格', kind: 'formula' },
}
let root = null
let latest = []
let labelObs = null
let freezeClickBound = false

function shortLabel(tip) {
  if (!tip) return ''
  const hit = Object.keys(LABEL_MAP).find((k) => tip === k || tip.startsWith(k))
  return hit ? LABEL_MAP[hit] : tip.split(/[\s(]/)[0]
}

let stamping = false
function stampFeishuLabels() {
  if (stamping) return
  const box = hostRef.value
  if (!box) return
  stamping = true
  try { stampFeishuLabelsNow(box) }
  finally { stamping = false }
}

function stampFeishuLabelsNow(box) {
  box.querySelectorAll('.fortune-toolbar-button[data-tips]').forEach((el) => {
    el.setAttribute('data-label', shortLabel(el.getAttribute('data-tips')))
    const tip = el.getAttribute('data-tips')
    if ((tip === '菜单' || tip === '插入') && !el.querySelector('.fs-caret')) {
      const caret = document.createElement('i')
      caret.className = 'fs-caret'
      el.appendChild(caret)
    }
  })
  applyFeishuIcons(document)
  box.querySelectorAll('.fortune-toolbar svg[data-paint="#search"]').forEach((svg) => {
    const btn = svg.closest('.fortune-toolbar-button')
    if (!btn) return
    btn.setAttribute('data-tips', '查找替换')
    btn.setAttribute('data-label', '查找和替换')
  })
  box.querySelectorAll('.fortune-toolbar use').forEach((use) => {
    const href = use.getAttribute('href') || use.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || ''
    if (href === '#link') use.closest('.fortune-toolbar-item')?.classList.add('fs-hide')
  })
  box.querySelectorAll('.fortune-toolbar-combo-text').forEach((el) => {
    const raw = (el.textContent || '').trim()
    if (raw === '自动' || raw === 'General' || raw === '格式') el.textContent = '常规'
  })
  box.querySelectorAll('.fortune-toobar-combo-container').forEach((el) => {
    if (el.querySelector('.fortune-toolbar-combo-text')) {
      el.removeAttribute('data-label')
      return
    }
    const tip = el.querySelector('[data-tips]')?.getAttribute('data-tips')
      || el.querySelector('[aria-label]')?.getAttribute('aria-label')
    const label = shortLabel(tip)
    if (label) el.setAttribute('data-label', label)
  })
  markActiveTools()
}

function setOn(el, on) {
  if (!el) return
  el.classList.toggle('fs-on', !!on)
}

function markActiveTools() {
  const box = hostRef.value
  if (!box) return
  const sheets = instRef.current?.getAllSheets?.() || []
  const sheet = sheets.find((s) => s.status === 1) || sheets[0]
  const sel = instRef.current?.getSelection?.()?.[0]
  const r = sel?.row?.[0]
  const c = sel?.column?.[0]
  let cell = r != null && c != null ? sheet?.data?.[r]?.[c] : null
  if (!cell && sheet?.celldata && r != null && c != null) {
    cell = sheet.celldata.find((item) => item.r === r && item.c === c)?.v || null
  }
  const byLabel = (label) => box.querySelector(
    `.fortune-toolbar-button[data-label="${label}"], .fortune-toobar-combo-container[data-label="${label}"]`,
  )
  setOn(byLabel('冻结'), !!(sheet?.frozen && sheet.frozen.type && sheet.frozen.type !== 'cancel'))
  setOn(byLabel('筛选'), !!(sheet?.filter_select || sheet?.filter))
  setOn(byLabel('合并单元格'), !!(cell?.mc))
  setOn(byLabel('对齐'), cell?.ht === 0 || cell?.ht === 2)
  setOn(byLabel('边框'), pop.show && pop.kind === 'border')
  setOn(byLabel('条件格式'), pop.show && pop.kind === 'cf')
  setOn(byLabel('查找和替换'), findState.open)
  box.querySelectorAll('.fortune-toolbar svg use').forEach((use) => {
    const href = use.getAttribute('href') || use.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || ''
    const icon = feishuIcon(href.replace('#', ''))
    const svg = use.closest('svg')
    if (!icon || !svg || svg.dataset.paint === href) return
    svg.setAttribute('viewBox', icon.vb)
    svg.innerHTML = icon.html
    svg.dataset.paint = href
  })
  box.querySelectorAll('.fortune-toolbar svg[data-paint="#search"]').forEach((svg) => {
    const btn = svg.closest('.fortune-toolbar-button')
    if (!btn) return
    btn.setAttribute('data-tips', '查找替换')
    btn.setAttribute('data-label', '查找和替换')
  })
}

function watchToolbarLabels() {
  labelObs?.disconnect()
  const box = hostRef.value
  if (!box) return
  const attach = () => {
    stampFeishuLabels()
    const tb = box.querySelector('.fortune-toolbar')
    if (!tb) return false
    labelObs?.disconnect()
    labelObs = new MutationObserver(() => stampFeishuLabels())
    labelObs.observe(tb, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-tips', 'aria-label', 'style'] })
    if (!box.dataset.activeWatch) {
      box.dataset.activeWatch = '1'
      const refresh = () => requestAnimationFrame(() => stampFeishuLabels())
      box.addEventListener('mouseup', refresh)
      box.addEventListener('keyup', refresh)
    }
    return true
  }
  if (attach()) return
  labelObs = new MutationObserver(() => { attach() })
  labelObs.observe(box, { childList: true, subtree: true })
  ;[50, 150, 400].forEach((ms) => setTimeout(attach, ms))
}

function openPop(kind, el) {
  colorPop.show = false
  cfState.fly = ''
  findState.scopeOpen = false
  const r = el?.getBoundingClientRect?.()
  if (!r) return
  pop.kind = kind
  const need = kind === 'cf' ? 196 : 260
  pop.left = Math.min(r.left, window.innerWidth - need)
  pop.top = r.bottom + 4
  pop.show = true
}

function freezeAnchor() {
  try {
    const cur = instRef.current?.getSelection?.()?.[0]
    const row = cur?.row?.[1] ?? cur?.row?.[0] ?? 0
    const col = cur?.column?.[1] ?? cur?.column?.[0] ?? 0
    return { row, col }
  } catch {
    return { row: 0, col: 0 }
  }
}

function openFreezePop(el) {
  const a = freezeAnchor()
  freezeInfo.row = a.row
  freezeInfo.col = a.col
  freezeInfo.letter = colLetter(a.col)
  openPop('freeze', el)
}

function applyFreeze(type) {
  pop.show = false
  const api = instRef.current
  if (!api?.freeze) return
  api.freeze(type, { row: freezeInfo.row, column: freezeInfo.col })
}

function currentCell() {
  try {
    const sheets = instRef.current?.getAllSheets?.() || []
    const sheet = sheets.find((s) => s.status === 1) || sheets[0]
    const sel = instRef.current?.getSelection?.()?.[0]
    const r = sel?.row?.[0]
    const c = sel?.column?.[0]
    if (r == null || c == null) return null
    return sheet?.data?.[r]?.[c] || sheet?.celldata?.find((item) => item.r === r && item.c === c)?.v || null
  } catch {
    return null
  }
}

function openColorPicker(kind, el, keepPop) {
  if (!keepPop) pop.show = false
  borderState.styleOpen = false
  const r = el?.getBoundingClientRect?.()
  if (!r) return
  const cell = currentCell()
  colorPop.kind = kind
  colorPop.origin = kind === 'bd'
    ? borderState.color
    : (kind === 'fc' ? cell?.fc : cell?.bg) || (kind === 'fc' ? '#1f2329' : '#ffffff')
  const pw = 293
  const ph = 228
  let top = r.bottom + 6
  if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6)
  let left = r.left
  if (left + pw > window.innerWidth - 8) left = Math.max(8, r.right - pw)
  colorPop.left = left
  colorPop.top = top
  colorPop.show = true
}

function applyCellColor(color) {
  if (colorPop.kind === 'bd') {
    borderState.color = color || '#1f2329'
    if (borderState.type && borderState.type !== 'border-draw') applyBorder(borderState.type)
    return
  }
  const api = instRef.current
  const sel = api?.getSelection?.()?.[0]
  if (!api?.setCellFormatByRange || !sel) return
  const value = color || (colorPop.kind === 'fc' ? '#000000' : null)
  api.setCellFormatByRange(colorPop.kind, value, { row: sel.row, column: sel.column })
}

function openBorderPop(el) {
  colorPop.show = false
  borderState.styleOpen = false
  openPop('border', el)
  markActiveTools()
}

function currentStyle() {
  return BORDER_STYLES.find((s) => s.id === borderState.style) || BORDER_STYLES[0]
}

function applyBorder(type) {
  if (!type || type === 'border-draw') {
    borderState.type = type
    return
  }
  const api = instRef.current
  const live = api?.getSheet?.()
  if (!api?.applyOp || !live?.id) return
  const sel = (api.getSelection?.() || []).map((s) => ({
    row: [s.row?.[0] ?? 0, s.row?.[1] ?? s.row?.[0] ?? 0],
    column: [s.column?.[0] ?? 0, s.column?.[1] ?? s.column?.[0] ?? 0],
  }))
  const config = {
    ...(live.config || {}),
    borderInfo: [...(live.config?.borderInfo || [])],
  }
  const files = (api.getAllSheets?.() || []).map((s) => (
    s.id === live.id ? { ...s, config } : s
  ))
  handleBorder({
    luckysheetfile: files,
    currentSheetId: live.id,
    config,
    luckysheet_select_save: sel.length ? sel : [{ row: [0, 0], column: [0, 0] }],
    allowEdit: true,
  }, type, borderState.color, borderState.style)
  api.applyOp([
    { op: 'replace', id: live.id, path: ['config'], value: config },
    { op: 'replace', path: ['config'], value: config },
  ])
  borderState.type = type
}

function pickBorderStyle(id) {
  borderState.style = id
  borderState.styleOpen = false
  if (borderState.type && borderState.type !== 'border-draw') applyBorder(borderState.type)
}

function cfSheet() {
  try {
    return instRef.current?.getSheet?.() || null
  } catch {
    return null
  }
}

function cfRules() {
  return [...(cfSheet()?.luckysheet_conditionformat_save || [])]
}

function cfSelection() {
  const api = instRef.current
  const sel = (api?.getSelection?.() || []).map((s) => ({
    row: [s.row?.[0] ?? 0, s.row?.[1] ?? s.row?.[0] ?? 0],
    column: [s.column?.[0] ?? 0, s.column?.[1] ?? s.column?.[0] ?? 0],
  }))
  return sel.length ? sel : [{ row: [0, 0], column: [0, 0] }]
}

function rangesOverlap(a, b) {
  return a.row[0] <= b.row[1] && a.row[1] >= b.row[0]
    && a.column[0] <= b.column[1] && a.column[1] >= b.column[0]
}

function refreshCfFlags() {
  const rules = cfRules()
  const sel = cfSelection()
  cfState.list = rules
  cfState.hasRules = rules.length > 0
  cfState.hasSel = rules.some((rule) => (rule.cellrange || []).some((range) => sel.some((s) => rangesOverlap(range, s))))
}

function patchCf(next) {
  const api = instRef.current
  const live = api?.getSheet?.()
  if (!api?.applyOp || !live?.id) return
  api.applyOp([
    { op: 'replace', id: live.id, path: ['luckysheet_conditionformat_save'], value: next },
  ])
  refreshCfFlags()
}

function openCfPop(el) {
  colorPop.show = false
  cfState.dlg = ''
  refreshCfFlags()
  openPop('cf', el)
  cfState.flyLeft = pop.left + 188 + 180 > window.innerWidth - 8
  markActiveTools()
}

function showCfFly(id, e) {
  clearTimeout(cfFlyTimer)
  cfState.fly = id
  cfState.flyTop = e?.currentTarget?.offsetTop || cfState.flyTop || 0
  cfState.flyY = pop.top + cfState.flyTop
  cfState.flyX = cfState.flyLeft
    ? Math.max(8, pop.left - 180)
    : pop.left + 176
}

function hideCfFly(now) {
  clearTimeout(cfFlyTimer)
  if (now) {
    cfState.fly = ''
    return
  }
  cfFlyTimer = window.setTimeout(() => { cfState.fly = '' }, 120)
}

function cfDisabled(item) {
  if (item.disable === 'sheet') return !cfState.hasRules
  if (item.disable === 'sel') return !cfState.hasSel
  return false
}

function onCfItem(item, e) {
  if (cfDisabled(item)) return
  if (item.caret) {
    showCfFly(item.id, e)
    return
  }
  if (item.id === 'formula' || item.id === 'new') {
    openCfDialog(item.id === 'new' ? 'greaterThan' : 'formula')
    return
  }
  if (item.id === 'manage') {
    openCfDialog('manage')
    return
  }
  if (item.id === 'clearSel') {
    pop.show = false
    const sel = cfSelection()
    patchCf(cfRules().filter((rule) => !(rule.cellrange || []).some((range) => sel.some((s) => rangesOverlap(range, s)))))
    markActiveTools()
    return
  }
  if (item.id === 'clearSheet') {
    pop.show = false
    patchCf([])
    markActiveTools()
    return
  }
  if (item.id === 'help') {
    pop.show = false
    window.open('https://www.feishu.cn/hc/zh-CN/search?q=%E6%9D%A1%E4%BB%B6%E6%A0%BC%E5%BC%8F', '_blank', 'noopener')
    markActiveTools()
  }
}

function resetCfForm() {
  cfForm.value = ''
  cfForm.value2 = ''
  cfForm.date = ''
  cfForm.repeat = '0'
  cfForm.project = '10'
  cfForm.formula = ''
  cfForm.textOn = true
  cfForm.textColor = '#9c0006'
  cfForm.cellOn = true
  cfForm.cellColor = '#ffc7ce'
}

function openCfDialog(type) {
  pop.show = false
  resetCfForm()
  cfState.dlg = type
  markActiveTools()
}

function applyPreset(item) {
  pop.show = false
  cfState.fly = ''
  patchCf([...cfRules(), {
    type: item.type,
    cellrange: cfSelection(),
    format: item.format,
  }])
  markActiveTools()
}

function confirmCfDialog() {
  const type = cfState.dlg
  if (!type || type === 'manage') {
    cfState.dlg = ''
    return
  }
  const format = {
    textColor: cfForm.textOn ? cfForm.textColor : null,
    cellColor: cfForm.cellOn ? cfForm.cellColor : null,
  }
  let conditionValue = []
  if (type === 'between') conditionValue = [cfForm.value, cfForm.value2]
  else if (type === 'occurrenceDate') conditionValue = [cfForm.date]
  else if (type === 'duplicateValue') conditionValue = [cfForm.repeat]
  else if (type === 'top10' || type === 'top10_percent' || type === 'last10' || type === 'last10_percent') conditionValue = [cfForm.project]
  else if (type === 'formula') conditionValue = [cfForm.formula]
  else if (type === 'aboveAverage' || type === 'belowAverage') conditionValue = [type]
  else conditionValue = [cfForm.value]
  patchCf([...cfRules(), {
    type: 'default',
    cellrange: cfSelection(),
    format,
    conditionName: type === 'formula' ? 'formula' : type,
    conditionRange: [],
    conditionValue,
  }])
  cfState.dlg = ''
}

function cellText(cell, formula) {
  if (cell == null) return ''
  if (formula && cell.f) return String(cell.f)
  if (cell.m != null && cell.m !== '') return String(cell.m)
  if (cell.v != null) return String(cell.v)
  return ''
}

function collectFindHits() {
  const q = findState.query
  if (!q) return []
  const api = instRef.current
  const sheets = findState.scope === 'all'
    ? (api?.getAllSheets?.() || [])
    : [api?.getSheet?.()].filter(Boolean)
  const hits = []
  sheets.forEach((sheet) => {
    const data = sheet?.data || []
    for (let r = 0; r < data.length; r += 1) {
      const row = data[r] || []
      for (let c = 0; c < row.length; c += 1) {
        const text = cellText(row[c], findState.formula)
        if (text.includes(q)) hits.push({ id: sheet.id, r, c, value: text })
      }
    }
  })
  return hits
}

function refreshFindHits() {
  findState.hits = collectFindHits()
  if (!findState.hits.length) {
    findState.index = 0
    return
  }
  if (findState.index >= findState.hits.length) findState.index = 0
}

function activateHit(hit) {
  const api = instRef.current
  if (!api || !hit) return
  const live = api.getSheet?.()
  if (hit.id && live?.id && hit.id !== live.id) {
    api.activateSheet?.({ id: hit.id })
  }
  api.setSelection?.([{ row: [hit.r, hit.r], column: [hit.c, hit.c] }])
  api.scroll?.({ targetRow: hit.r, targetColumn: hit.c })
}

function openFindPop(el) {
  pop.show = false
  colorPop.show = false
  cfState.fly = ''
  cfState.dlg = ''
  const r = el?.getBoundingClientRect?.()
  findState.left = Math.min(Math.max(8, r?.left || 8), window.innerWidth - 525)
  findState.top = Math.min((r?.bottom || 80) + 6, window.innerHeight - 260)
  findState.open = true
  findState.scopeOpen = false
  findState.compact = false
  refreshFindHits()
  markActiveTools()
  nextTick(() => hostRef.value?.querySelector('.fs-find-box input')?.focus())
}

function closeFind() {
  findState.open = false
  findState.scopeOpen = false
  markActiveTools()
}

function goFind(dir) {
  refreshFindHits()
  if (!findState.hits.length) return
  const sel = instRef.current?.getSelection?.()?.[0]
  const cur = sel
    ? findState.hits.findIndex((h) => h.r === sel.row?.[0] && h.c === sel.column?.[0])
    : -1
  if (cur < 0) findState.index = dir < 0 ? findState.hits.length - 1 : 0
  else findState.index = (cur + dir + findState.hits.length) % findState.hits.length
  activateHit(findState.hits[findState.index])
}

function replaceOne() {
  refreshFindHits()
  const hit = findState.hits[findState.index]
  const api = instRef.current
  if (!hit || !api?.setCellValue || !findState.query) return
  const next = hit.value.replace(findState.query, findState.replace)
  api.setCellValue(hit.r, hit.c, next)
  refreshFindHits()
  if (findState.hits.length) activateHit(findState.hits[Math.min(findState.index, findState.hits.length - 1)])
}

function replaceAllHits() {
  refreshFindHits()
  const api = instRef.current
  if (!api?.setCellValue || !findState.query) return
  collectFindHits().forEach((hit) => {
    api.setCellValue(hit.r, hit.c, hit.value.replaceAll(findState.query, findState.replace))
  })
  refreshFindHits()
}

function onFreezeCapture(e) {
  const colorHit = e.target?.closest?.('.fortune-toobar-combo-container[data-label="颜色"], .fortune-toobar-combo-container[data-label="填充"]')
  if (colorHit && hostRef.value?.contains(colorHit)) {
    if (e.target.closest?.('.fortune-toolbar-combo-popup, .fortune-toolbar-select, .fortune-toolbar-color-picker')) return
    e.preventDefault()
    e.stopPropagation()
    const label = colorHit.getAttribute('data-label')
    openColorPicker(label === '填充' ? 'bg' : 'fc', colorHit)
    return
  }
  const borderHit = e.target?.closest?.('.fortune-toobar-combo-container[data-label="边框"], .fortune-toobar-combo-container[data-label="边框设置"]')
  if (borderHit && hostRef.value?.contains(borderHit)) {
    if (e.target.closest?.('.fortune-toolbar-combo-popup, .fortune-toolbar-select')) return
    e.preventDefault()
    e.stopPropagation()
    if (pop.show && pop.kind === 'border') {
      pop.show = false
      markActiveTools()
      return
    }
    openBorderPop(borderHit)
    return
  }
  const cfHit = e.target?.closest?.('.fortune-toobar-combo-container[data-label="条件格式"]')
  if (cfHit && hostRef.value?.contains(cfHit)) {
    if (e.target.closest?.('.fortune-toolbar-combo-popup, .fortune-toolbar-select')) return
    e.preventDefault()
    e.stopPropagation()
    if (pop.show && pop.kind === 'cf') {
      pop.show = false
      cfState.fly = ''
      markActiveTools()
      return
    }
    openCfPop(cfHit)
    return
  }
  const findBtn = e.target?.closest?.('.fortune-toolbar-button, .fortune-toobar-combo-container')
  if (findBtn && hostRef.value?.contains(findBtn)) {
    const paint = findBtn.querySelector('svg')?.dataset?.paint || ''
    const use = findBtn.querySelector('use')
    const href = use?.getAttribute('href') || use?.getAttributeNS?.('http://www.w3.org/1999/xlink', 'href') || ''
    const isSearch = paint === '#search' || href === '#search'
      || findBtn.getAttribute('data-label') === '查找和替换'
      || findBtn.getAttribute('data-tips') === '查找替换'
    if (isSearch) {
      e.preventDefault()
      e.stopPropagation()
      if (findState.open) {
        closeFind()
        return
      }
      openFindPop(findBtn)
      return
    }
  }
  const hit = e.target?.closest?.('.fortune-toobar-combo-container[data-label="冻结"], .fortune-toolbar-button[data-tips="冻结"]')
  if (!hit || !hostRef.value?.contains(hit)) return
  if (e.target.closest?.('.fortune-toolbar-combo-popup, .fortune-toolbar-select')) return
  e.preventDefault()
  e.stopPropagation()
  openFreezePop(hit.closest('.fortune-toobar-combo-container') || hit)
}

function bindFreezeClick() {
  const box = hostRef.value
  if (!box || freezeClickBound) return
  box.addEventListener('click', onFreezeCapture, true)
  freezeClickBound = true
}

function onWrapDown(e) {
  if (e.target.closest?.('.cp, .fs-pop, .fs-fold, .fs-cf-dlg, .fs-cf-fly, .fs-find')) return
  pop.show = false
  colorPop.show = false
  borderState.styleOpen = false
  cfState.fly = ''
  cfState.dlg = ''
  findState.scopeOpen = false
  markActiveTools()
}

function clickFortune(tip) {
  pop.show = false
  const el = hostRef.value?.querySelector(`.fortune-toolbar [data-tips="${tip}"]`)
  el?.click()
}

function toolIcon(paths) {
  const list = Array.isArray(paths) ? paths : [paths]
  return createElement('svg', {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
  }, ...list.map((d) => createElement('path', { d, fill: 'currentColor' })))
}

function renderBook(data) {
  latest = Array.isArray(data) && data.length
    ? data
    : [{ name: '数据', id: 'sheet-1', order: 0, status: 1, celldata: [], row: 40, column: 12 }]
  if (!hostRef.value) return
  if (root) {
    root.unmount()
    root = null
  }
  hostRef.value.innerHTML = ''
  const box = document.createElement('div')
  box.className = 'fortune-box'
  hostRef.value.appendChild(box)
  root = createRoot(box)
  root.render(createElement(Workbook, {
    ref: instRef,
    data: latest,
    lang: 'zh',
    allowEdit: !props.readonly,
    showToolbar: !props.readonly,
    showFormulaBar: true,
    showSheetTabs: true,
    toolbarItems: TOOLBAR_ITEMS,
    customToolbarItems: props.readonly ? [] : [
      {
        key: 'feishu-menu',
        tooltip: '菜单',
        icon: toolIcon(FEISHU_MENU_PATHS),
        onClick: (e) => openPop('menu', e?.currentTarget || hostRef.value?.querySelector('[data-tips="菜单"]')),
      },
      {
        key: 'feishu-insert',
        tooltip: '插入',
        icon: toolIcon(FEISHU_INSERT_PATHS),
        onClick: (e) => openPop('insert', e?.currentTarget || hostRef.value?.querySelector('[data-tips="插入"]')),
      },
    ],
    onChange: (next) => { latest = next || latest },
  }))
  requestAnimationFrame(() => {
    watchToolbarLabels()
    bindFreezeClick()
  })
}

function load(wb) {
  renderBook(univerToFortune(wb))
}

function liveSheets() {
  try {
    const all = instRef.current?.getAllSheets?.()
    if (all?.length) latest = all
  } catch { /* */ }
  return latest
}

function snapshot() {
  return fortuneToUniver(liveSheets())
}

function captureThumb() {
  return paintWorkbookThumb(snapshot())
}

function getActiveSheetName() {
  try {
    const sh = instRef.current?.getSheet?.()
    if (sh?.name) return sh.name
  } catch { /* */ }
  const on = latest.find((s) => s.status === 1)
  return on?.name || latest[0]?.name || '数据'
}

function getSelection() {
  try {
    const sel = instRef.current?.getSelection?.()
    const cur = sel?.[0]
    if (!cur) return null
    const r0 = cur.row?.[0]
    const r1 = cur.row?.[1] ?? r0
    const c0 = cur.column?.[0]
    const c1 = cur.column?.[1] ?? c0
    if (r0 == null || c0 == null) return null
    if (r0 === r1 && c0 === c1) return null
    return { startRow: r0, startColumn: c0, endRow: r1, endColumn: c1 }
  } catch {
    return null
  }
}

function addSheet(name) {
  const api = instRef.current
  if (!api?.addSheet) return null
  api.addSheet()
  if (name) {
    try { api.setSheetName(name) } catch { /* */ }
  }
  return true
}

function setActiveSheet(name) {
  const api = instRef.current
  const sh = liveSheets().find((s) => s.name === name)
  if (api && sh?.id) api.activateSheet({ id: sh.id })
}

function writeBlock(name, startRow, startCol, matrix, headerRows = 0) {
  const api = instRef.current
  if (!api || !matrix?.length || !matrix[0]?.length) return false
  if (name) setActiveSheet(name)
  const range = {
    row: [startRow, startRow + matrix.length - 1],
    column: [startCol, startCol + matrix[0].length - 1],
  }
  try {
    api.setCellValuesByRange(matrix, range)
    if (headerRows) {
      const head = {
        row: [startRow, startRow + headerRows - 1],
        column: [startCol, startCol + matrix[0].length - 1],
      }
      api.setCellFormatByRange('bl', 1, head)
      api.setCellFormatByRange('bg', '#E8F3FF', head)
    }
    return true
  } catch {
    return false
  }
}

async function onImport(ev) {
  const file = ev.target.files?.[0]
  ev.target.value = ''
  if (!file) return
  const buf = await file.arrayBuffer()
  const snap = await xlsxToUniver(buf, file.name.replace(/\.xlsx?$/i, ''))
  load(snap)
}

onBeforeUnmount(() => {
  labelObs?.disconnect()
  labelObs = null
  hostRef.value?.removeEventListener('click', onFreezeCapture, true)
  freezeClickBound = false
  if (root) {
    root.unmount()
    root = null
  }
})

defineExpose({
  load,
  snapshot,
  captureThumb,
  getActiveSheetName,
  getSelection,
  addSheet,
  setActiveSheet,
  writeBlock,
})
</script>

<template>
  <div class="fortune-wrap" :class="{ 'fs-open': !folded }" @mousedown="onWrapDown">
    <input ref="fileRef" type="file" accept=".xlsx,.xls" hidden @change="onImport">
    <div ref="hostRef" class="fortune-host"></div>
    <button
      type="button"
      class="fs-fold"
      :title="folded ? '展开工具栏' : '收起工具栏'"
      @mousedown.stop
      @click="folded = !folded"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M6.3 9.2a1 1 0 0 1 1.4 0L12 13.5l4.3-4.3a1 1 0 1 1 1.4 1.4l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 0 1 0-1.4Z" fill="currentColor" />
      </svg>
    </button>
    <div
      v-if="pop.show"
      class="fs-pop"
      :class="{ freeze: pop.kind === 'freeze', border: pop.kind === 'border', cf: pop.kind === 'cf' }"
      :style="{ left: `${pop.left}px`, top: `${pop.top}px` }"
      @mousedown.stop
    >
      <template v-if="pop.kind === 'menu'">
        <button type="button" @click="fileRef?.click(); pop.show = false">导入 Excel</button>
        <button type="button" @click="emit('pivot'); pop.show = false">数据透视表</button>
      </template>
      <template v-else-if="pop.kind === 'insert'">
        <button type="button" @click="clickFortune('插入图片')">插入图片</button>
        <button type="button" @click="clickFortune('插入链接')">插入链接</button>
      </template>
      <template v-else-if="pop.kind === 'freeze'">
        <button type="button" @click="applyFreeze('row')">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="2.25" y="2.25" width="11.5" height="11.5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.25 6.2h11.5" stroke="currentColor" stroke-width="1.6"/></svg>
          冻结至当前行（1-{{ freezeInfo.row + 1 }} 行）
        </button>
        <button type="button" @click="applyFreeze('column')">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="2.25" y="2.25" width="11.5" height="11.5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6.2 2.25v11.5" stroke="currentColor" stroke-width="1.6"/></svg>
          冻结至当前列（A-{{ freezeInfo.letter }} 列）
        </button>
        <button type="button" @click="applyFreeze('both')">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="2.25" y="2.25" width="11.5" height="11.5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.25 6.2h11.5M6.2 2.25v11.5" stroke="currentColor" stroke-width="1.6"/></svg>
          冻结至当前行列（{{ freezeInfo.row + 1 }} 行 {{ freezeInfo.letter }} 列）
        </button>
      </template>
      <template v-else-if="pop.kind === 'border'">
        <div class="fs-bd-grid">
          <div v-for="(row, ri) in BORDER_GRID" :key="ri" class="fs-bd-row">
            <button
              v-for="item in row"
              :key="item.id"
              type="button"
              :class="{ on: borderState.type === item.id }"
              :title="item.label"
              @click="applyBorder(item.id)"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path v-for="(d, pi) in item.paths" :key="pi" :d="d" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
        <div class="fs-bd-foot">
          <div class="fs-bd-line" />
          <div class="fs-bd-tools">
            <button
              type="button"
              class="fs-bd-color"
              title="边框颜色"
              @click="openColorPicker('bd', $event.currentTarget, true)"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path :d="BORDER_PEN" fill="currentColor" />
                <path :d="BORDER_PEN_BAR" :fill="borderState.color" />
              </svg>
              <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
                <path :d="BORDER_CARET" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              class="fs-bd-style"
              title="边框样式"
              @click="borderState.styleOpen = !borderState.styleOpen"
            >
              <svg width="104" height="22" viewBox="0 0 104 22" fill="none" aria-hidden="true">
                <path v-if="currentStyle().double" :d="BORDER_DOUBLE" :fill="borderState.color" />
                <line
                  v-else
                  x1="4"
                  y1="11"
                  x2="100"
                  y2="11"
                  :stroke="borderState.color"
                  :stroke-width="currentStyle().h"
                  :stroke-dasharray="currentStyle().dash || undefined"
                  stroke-linecap="butt"
                />
              </svg>
              <svg viewBox="0 0 24 24" width="8" height="8" aria-hidden="true">
                <path :d="BORDER_CARET_SM" fill="currentColor" />
              </svg>
            </button>
          </div>
          <div v-if="borderState.styleOpen" class="fs-bd-styles">
            <button
              v-for="st in BORDER_STYLES"
              :key="st.id"
              type="button"
              :class="{ on: borderState.style === st.id }"
              @click="pickBorderStyle(st.id)"
            >
              <svg width="104" height="22" viewBox="0 0 104 22" fill="none" aria-hidden="true">
                <path v-if="st.double" :d="BORDER_DOUBLE" :fill="borderState.color" />
                <line
                  v-else
                  x1="4"
                  y1="11"
                  x2="100"
                  y2="11"
                  :stroke="borderState.color"
                  :stroke-width="st.h"
                  :stroke-dasharray="st.dash || undefined"
                  stroke-linecap="butt"
                />
              </svg>
            </button>
          </div>
        </div>
      </template>
      <template v-else-if="pop.kind === 'cf'">
        <template v-for="(item, i) in CF_MENU" :key="item.sep ? `sep-${i}` : item.id">
          <div v-if="item.sep" class="fs-cf-sep" />
          <button
            v-else
            type="button"
            :class="{ on: cfState.fly === item.id }"
            :disabled="cfDisabled(item)"
            @mouseenter="item.caret ? showCfFly(item.id, $event) : hideCfFly(true)"
            @mouseleave="item.caret && hideCfFly()"
            @click="onCfItem(item, $event)"
          >
            <span class="fs-cf-lab">
              {{ item.label }}
              <svg v-if="item.help" class="fs-cf-help" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path :d="CF_HELP" fill="currentColor" />
              </svg>
            </span>
            <svg v-if="item.caret" class="fs-cf-caret" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path :d="CF_CARET" fill="currentColor" />
            </svg>
          </button>
        </template>
      </template>
    </div>
    <div
      v-if="pop.show && pop.kind === 'cf' && cfState.fly && CF_FLIES[cfState.fly]"
      class="fs-cf-fly"
      :style="{ top: `${cfState.flyY}px`, left: `${cfState.flyX}px` }"
      @mousedown.stop
      @mouseenter="showCfFly(cfState.fly)"
      @mouseleave="hideCfFly()"
    >
      <button
        v-for="sub in CF_FLIES[cfState.fly]"
        :key="sub.id"
        type="button"
        @click="sub.type ? applyPreset(sub) : openCfDialog(sub.id)"
      >
        <span
          v-if="sub.format"
          class="fs-cf-swatch"
          :style="{ background: sub.format.length > 1 ? `linear-gradient(90deg, ${sub.format.join(',')})` : sub.format[0] }"
        />
        {{ sub.label }}
      </button>
    </div>
    <div v-if="cfState.dlg" class="fs-cf-dlg" @mousedown.stop>
      <template v-if="cfState.dlg === 'manage'">
        <div class="fs-cf-dlg-title">管理规则</div>
        <div v-if="!cfState.list.length" class="fs-cf-empty">当前工作表没有条件格式规则</div>
        <button
          v-for="(rule, ri) in cfState.list"
          :key="ri"
          type="button"
          class="fs-cf-rule"
          @click="patchCf(cfState.list.filter((_, i) => i !== ri))"
        >
          {{ rule.conditionName || rule.type || '规则' }}
          <span>删除</span>
        </button>
        <div class="fs-cf-dlg-foot">
          <button type="button" class="fs-cf-cancel" @click="cfState.dlg = ''">关闭</button>
        </div>
      </template>
      <template v-else>
        <div class="fs-cf-dlg-title">{{ CF_RULES[cfState.dlg]?.title }}</div>
        <div class="fs-cf-hint">{{ CF_RULES[cfState.dlg]?.hint }}</div>
        <input
          v-if="CF_RULES[cfState.dlg]?.kind === 'value'"
          v-model="cfForm.value"
          class="fs-cf-input"
        >
        <input
          v-if="CF_RULES[cfState.dlg]?.kind === 'formula'"
          v-model="cfForm.formula"
          class="fs-cf-input"
          placeholder="=A1>10"
        >
        <div v-if="CF_RULES[cfState.dlg]?.kind === 'between'" class="fs-cf-row">
          <input v-model="cfForm.value" class="fs-cf-input">
          <span>到</span>
          <input v-model="cfForm.value2" class="fs-cf-input">
        </div>
        <input v-if="CF_RULES[cfState.dlg]?.kind === 'date'" v-model="cfForm.date" class="fs-cf-input" type="date">
        <select v-if="CF_RULES[cfState.dlg]?.kind === 'dup'" v-model="cfForm.repeat" class="fs-cf-input">
          <option value="0">重复值</option>
          <option value="1">唯一值</option>
        </select>
        <div v-if="['top','top%','last','last%'].includes(CF_RULES[cfState.dlg]?.kind)" class="fs-cf-row">
          <span>{{ CF_RULES[cfState.dlg]?.kind.startsWith('top') ? '前' : '后' }}</span>
          <input v-model="cfForm.project" class="fs-cf-input" type="number" min="1" max="1000">
          <span>{{ CF_RULES[cfState.dlg]?.kind.endsWith('%') ? '%' : '个' }}</span>
        </div>
        <div class="fs-cf-set">设置为：</div>
        <label class="fs-cf-check">
          <input v-model="cfForm.textOn" type="checkbox">
          文本颜色
          <input v-model="cfForm.textColor" type="color">
        </label>
        <label class="fs-cf-check">
          <input v-model="cfForm.cellOn" type="checkbox">
          单元格颜色
          <input v-model="cfForm.cellColor" type="color">
        </label>
        <div class="fs-cf-dlg-foot">
          <button type="button" class="fs-cf-ok" @click="confirmCfDialog">确定</button>
          <button type="button" class="fs-cf-cancel" @click="cfState.dlg = ''">取消</button>
        </div>
      </template>
    </div>
    <div
      v-if="findState.open"
      class="fs-find"
      :class="{ compact: findState.compact }"
      :style="{ left: `${findState.left}px`, top: `${findState.top}px` }"
      @mousedown.stop
    >
      <div class="fs-find-grid">
        <div class="fs-find-labs">
          <label>查找</label>
          <label v-if="!findState.compact">替换为</label>
          <label v-if="!findState.compact">范围</label>
        </div>
        <div class="fs-find-fields">
          <div class="fs-find-row">
            <label class="fs-find-box">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path :d="FIND_SEARCH" fill="currentColor" /></svg>
              <input
                v-model="findState.query"
                :placeholder="findState.scope === 'all' ? '在所有工作表中查找' : '在当前工作表中查找'"
                @input="refreshFindHits"
                @keydown.enter.prevent="goFind(1)"
              >
              <span v-if="findState.query" class="fs-find-nav">
                <button type="button" @click.stop="goFind(-1)">
                  <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path :d="FIND_PREV" fill="currentColor" /></svg>
                </button>
                <span>{{ findState.hits.length ? findState.index + 1 : 0 }} / {{ findState.hits.length }}</span>
                <button type="button" @click.stop="goFind(1)">
                  <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path :d="FIND_NEXT" fill="currentColor" /></svg>
                </button>
              </span>
            </label>
            <div class="fs-find-tools">
              <button type="button" class="fs-find-icon" title="展开" @click="findState.compact = !findState.compact">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path :d="FIND_EXPAND" fill="currentColor" /></svg>
              </button>
              <button type="button" class="fs-find-icon" title="关闭" @click="closeFind">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path :d="FIND_CLOSE" fill="currentColor" /></svg>
              </button>
            </div>
          </div>
          <template v-if="!findState.compact">
            <div class="fs-find-plain">
              <input v-model="findState.replace" placeholder="">
            </div>
            <div class="fs-find-scope">
              <button type="button" class="fs-find-select" @click="findState.scopeOpen = !findState.scopeOpen">
                {{ FIND_SCOPES.find((s) => s.id === findState.scope)?.label }}
                <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path :d="FIND_CARET" fill="currentColor" /></svg>
              </button>
              <div v-if="findState.scopeOpen" class="fs-find-opts">
                <button
                  v-for="item in FIND_SCOPES"
                  :key="item.id"
                  type="button"
                  :class="{ on: findState.scope === item.id }"
                  @click="findState.scope = item.id; findState.scopeOpen = false; refreshFindHits()"
                >{{ item.label }}</button>
              </div>
            </div>
            <label class="fs-find-check">
              <input v-model="findState.formula" type="checkbox" @change="refreshFindHits">
              <span>搜索范围包括公式</span>
            </label>
          </template>
        </div>
      </div>
      <div v-if="!findState.compact" class="fs-find-foot">
        <button type="button" :disabled="!findState.query" @click="replaceAllHits">全部替换</button>
        <button type="button" :disabled="!findState.query" @click="replaceOne">替换</button>
        <button type="button" :disabled="!findState.query" @click="goFind(1)">查找</button>
      </div>
    </div>
    <ColorPop
      :show="colorPop.show"
      :left="colorPop.left"
      :top="colorPop.top"
      :origin="colorPop.origin"
      @update:show="colorPop.show = $event"
      @pick="applyCellColor"
    />
  </div>
</template>
