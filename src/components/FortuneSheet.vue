<script setup>
import { createElement, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { handleBorder } from '@fortune-sheet/core'
import { Workbook } from '@fortune-sheet/react'
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
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
  'font', 'font-size', '|',
  'font-color', 'background', 'border', 'bold', 'italic', 'underline', 'strike-through', '|',
  'horizontal-align', 'merge-cell', 'text-wrap', 'vertical-align', '|',
  'format', 'currency-format', 'percentage-format', 'number-decrease', 'number-increase', '|',
  'freeze', 'filter', 'conditionFormat', 'dataVerification', 'quick-formula', '|',
  'image', 'link', 'comment', 'search',
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
  自动求和: '公式',
  求和: '公式',
  更多函数: '公式',
  文本颜色: '颜色',
  背景色: '填充',
  水平对齐: '对齐',
  边框设置: '边框',
  边框: '边框',
}

const hostRef = ref(null)
const fileRef = ref(null)
const toolbarEl = ref(null)
const instRef = createRef()
const folded = ref(true)
const fsTip = reactive({ show: false, text: '', left: 0, top: 0 })
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
  side: false,
  panel: 'edit',
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
const cfPopup = { popupStyle: { zIndex: 5200 } }
const sizePopup = {
  popupStyle: { zIndex: 5200, width: '136px' },
  position: 'bl',
  autoFitPopupWidth: false,
  contentClass: 'fs-arco-drop',
}
const fontPopup = {
  popupStyle: { zIndex: 5200, minWidth: '160px' },
  position: 'bl',
  autoFitPopupWidth: false,
  contentClass: 'fs-arco-drop',
}
const FONT_NAMES = [
  { id: '微软雅黑', label: '默认字体' },
  { id: '宋体', label: '宋体' },
  { id: '黑体', label: '黑体' },
  { id: '楷体', label: '楷体' },
  { id: '仿宋', label: '仿宋' },
  { id: 'Arial', label: 'Arial' },
  { id: 'Tahoma', label: 'Tahoma' },
  { id: 'Verdana', label: 'Verdana' },
  { id: 'Times New Roman', label: 'Times New Roman' },
]
const FONT_SIZES = [9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]
const fontBar = reactive({
  show: false,
  name: '微软雅黑',
  size: 10,
  left: 0,
  top: 0,
  bl: 0,
  it: 0,
  un: 0,
  cl: 0,
  fc: '#1f2329',
  bg: '#fff258',
})
const alignBar = reactive({
  show: false,
  left: 0,
  top: 0,
  ht: 1,
  vt: 2,
  tb: 0,
  merge: false,
})
const fmtBar = reactive({
  left: 0,
  top: 0,
})
const dataBar = reactive({
  left: 0,
  top: 0,
  freeze: false,
  filter: false,
  cf: false,
})
const filterHidden = new Map()
const filterPop = reactive({
  show: false,
  left: 0,
  top: 0,
  tab: 'value',
  query: '',
  onlyMine: false,
  col: 0,
  r0: 1,
  r1: 1,
  items: [],
  cond: 'contains',
  condValue: '',
})
let findMark = null
const numFmt = reactive({ id: 'general' })
const NUM_FMTS = [
  { id: 'general', short: '常规', label: '常规', sample: '', fa: 'General', t: 'g' },
  { id: 'text', short: '纯文本', label: '纯文本', sample: '', fa: '@', t: 's' },
  { id: 'num', short: '数字', label: '数字', sample: '1024', fa: '0', t: 'n' },
  { id: 'num-comma', short: '数字', label: '数字（千分位）', sample: '1,024', fa: '#,##0', t: 'n' },
  { id: 'num-comma-dec', short: '数字', label: '数字（千分位，小数点）', sample: '1,024.56', fa: '#,##0.00', t: 'n' },
  { id: 'pct', short: '百分比', label: '百分比', sample: '10%', fa: '0%', t: 'n' },
  { id: 'pct-dec', short: '百分比', label: '百分比（小数点）', sample: '10.24%', fa: '0.00%', t: 'n' },
  { id: 'sci', short: '科学记数', label: '科学记数', sample: '1.02E+03', fa: '0.00E+00', t: 'n' },
  { id: 'cny', short: '人民币', label: '人民币', sample: '¥1,024', fa: '"¥"#,##0', t: 'n' },
  { id: 'cny-dec', short: '人民币', label: '人民币（小数点）', sample: '¥1,024.56', fa: '"¥"#,##0.00', t: 'n' },
  { id: 'usd', short: '美元', label: '美元', sample: '$1,024', fa: '"$"#,##0', t: 'n' },
  { id: 'usd-dec', short: '美元', label: '美元（小数点）', sample: '$1,024.56', fa: '"$"#,##0.00', t: 'n' },
  { id: 'date-slash', short: '日期', label: '日期', sample: '2017/08/01', fa: 'yyyy/MM/dd', t: 'd' },
  { id: 'date-dash', short: '日期', label: '日期', sample: '2017-08-01', fa: 'yyyy-MM-dd', t: 'd' },
  { id: 'time', short: '时间', label: '时间', sample: '23:24:25', fa: 'hh:mm:ss', t: 'd' },
  { id: 'datetime', short: '日期时间', label: '日期时间', sample: '2017/08/01 23:24:25', fa: 'yyyy/MM/dd hh:mm:ss', t: 'd' },
]
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
  range: 'A1',
  group: 'value',
  style: 0,
})
const CF_TYPES = [
  { id: 'highlight', label: '突出显示单元格' },
  { id: 'item', label: '最前/最后/平均值' },
]
const CF_GROUPS = [
  { id: 'value', label: '限定值范围' },
  { id: 'text', label: '包含以下内容' },
  { id: 'date', label: '日期为' },
]
const CF_OPS = {
  value: [
    { id: 'greaterThan', label: '大于' },
    { id: 'lessThan', label: '小于' },
    { id: 'between', label: '介于' },
    { id: 'equal', label: '等于' },
  ],
  text: [{ id: 'textContains', label: '包含' }],
  date: [{ id: 'occurrenceDate', label: '日期' }],
}
const CF_RANKS = [
  { id: 'top', label: '最前' },
  { id: 'last', label: '最后' },
  { id: 'above', label: '高于平均值' },
  { id: 'below', label: '低于平均值' },
]
const CF_STYLES = [
  { text: '#9c0006', cell: '#ffc7ce', name: '浅红' },
  { text: '#006100', cell: '#c6efce', name: '浅绿' },
  { text: '#9c5700', cell: '#ffeb9c', name: '浅黄' },
  { text: '#1f4e79', cell: '#bdd7ee', name: '浅蓝' },
]
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
    { id: 'other', label: '其他规则' },
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
    { id: 'cg4', type: 'colorGradation', format: ['rgb(248, 105, 107)', 'rgb(255, 255, 255)', 'rgb(99, 190, 123)'], label: '红-白-绿' },
    { id: 'cg5', type: 'colorGradation', format: ['rgb(90, 138, 198)', 'rgb(255, 255, 255)', 'rgb(248, 105, 107)'], label: '蓝-白-红' },
    { id: 'cg6', type: 'colorGradation', format: ['rgb(248, 105, 107)', 'rgb(255, 255, 255)', 'rgb(90, 138, 198)'], label: '红-白-蓝' },
    { id: 'cg7', type: 'colorGradation', format: ['rgb(90, 138, 198)', 'rgb(255, 255, 255)', 'rgb(99, 190, 123)'], label: '蓝-白-绿' },
    { id: 'cg8', type: 'colorGradation', format: ['rgb(99, 190, 123)', 'rgb(255, 255, 255)', 'rgb(90, 138, 198)'], label: '绿-白-蓝' },
    { id: 'cg9', type: 'colorGradation', format: ['rgb(248, 105, 107)', 'rgb(255, 255, 255)'], label: '红-白' },
    { id: 'cg10', type: 'colorGradation', format: ['rgb(255, 255, 255)', 'rgb(248, 105, 107)'], label: '白-红' },
    { id: 'cg11', type: 'colorGradation', format: ['rgb(99, 190, 123)', 'rgb(255, 255, 255)'], label: '绿-白' },
    { id: 'cg12', type: 'colorGradation', format: ['rgb(255, 255, 255)', 'rgb(99, 190, 123)'], label: '白-绿' },
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
let stampQueued = false
function stampFeishuLabels() {
  if (stamping || stampQueued) return
  stampQueued = true
  requestAnimationFrame(() => {
    stampQueued = false
    const box = hostRef.value
    if (!box || stamping) return
    stamping = true
    labelObs?.disconnect()
    try { stampFeishuLabelsNow(box) }
    finally {
      stamping = false
      const tb = box.querySelector('.fortune-toolbar')
      if (tb && labelObs) labelObs.observe(tb, { childList: true, subtree: true })
    }
  })
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
    if (href === '#link' || href === '#image') use.closest('.fortune-toolbar-item')?.classList.add('fs-hide')
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
  paintToolbarIcons(box)
  ;['清除格式', '插入', '粗体 (Ctrl+B)', '合并单元格', '减少小数位数'].forEach((tip) => {
    const el = box.querySelector(`.fortune-toolbar [data-tips="${tip}"]`)?.closest('.fortune-toolbar-button, .fortune-toobar-combo-container')
      || box.querySelector(`.fortune-toolbar [data-tips="${tip}"]`)
    if (!el) return
    el.setAttribute('data-split', '1')
    if (!el.querySelector(':scope > .fs-split')) {
      const mark = document.createElement('i')
      mark.className = 'fs-split'
      el.appendChild(mark)
    }
  })
  const formula = box.querySelector('.fortune-toolbar [data-label="公式"]')
  if (formula) {
    formula.setAttribute('data-split', '1')
    if (!formula.querySelector(':scope > .fs-split')) {
      const mark = document.createElement('i')
      mark.className = 'fs-split'
      formula.appendChild(mark)
    }
  }
  placeFontBar(box)
  placeAlignBar(box)
}

function overlayPos(wrap, el, height) {
  const bar = wrap.querySelector('.fortune-toolbar')
  toolbarEl.value = bar
  const base = (bar || wrap).getBoundingClientRect()
  const r = el.getBoundingClientRect()
  const open = wrap.classList.contains('fs-open')
  return {
    left: Math.round(r.left - base.left),
    top: open
      ? Math.max(0, Math.round((base.height - (height || r.height)) / 2))
      : Math.round((base.height - 24) / 2),
  }
}

function placeFontBar(box) {
  if (!box?.querySelector) return
  const wrap = box.closest?.('.fortune-wrap') || hostRef.value?.closest('.fortune-wrap')
  const fontEl = box.querySelector('[data-tips="字体"]')?.closest('.fortune-toobar-combo-container')
  if (!fontEl || !wrap) {
    fontBar.show = false
    return
  }
  const open = wrap.classList.contains('fs-open')
  fontEl.style.width = open ? '204px' : '88px'
  fontEl.style.minWidth = open ? '204px' : '88px'
  fontEl.style.height = open ? '44px' : '24px'
  const put = () => {
    const pos = overlayPos(wrap, fontEl, open ? 52 : 0)
    fontBar.left = pos.left
    fontBar.top = pos.top
    fontBar.show = fontEl.getBoundingClientRect().width > 0
  }
  put()
  requestAnimationFrame(put)
  placeAlignBar(box)
  placeFmtBar(box)
  placeDataBar(box)
}

function placeAlignBar(box) {
  if (!box?.querySelector) return
  const wrap = box.closest?.('.fortune-wrap') || hostRef.value?.closest('.fortune-wrap')
  const el = box.querySelector('.fortune-toobar-combo-container[data-label="对齐"]')
    || box.querySelector('[data-tips="水平对齐"]')?.closest('.fortune-toobar-combo-container')
  if (!el || !wrap) {
    alignBar.show = false
    return
  }
  const open = wrap.classList.contains('fs-open')
  if (!open || !el) {
    el && (el.style.width = el.style.minWidth = el.style.height = '')
    alignBar.show = false
    return
  }
  el.style.width = '168px'
  el.style.minWidth = '168px'
  el.style.height = '44px'
  alignBar.show = true
  const put = () => {
    const pos = overlayPos(wrap, el, 52)
    alignBar.left = pos.left
    alignBar.top = pos.top
  }
  put()
  requestAnimationFrame(put)
}

function placeFmtBar(box) {
  if (!box?.querySelector) return
  const wrap = box.closest?.('.fortune-wrap') || hostRef.value?.closest('.fortune-wrap')
  const el = box.querySelector('[data-tips="格式"]')?.closest('.fortune-toobar-combo-container')
  if (!el || !wrap) return
  const open = wrap.classList.contains('fs-open')
  if (!open) {
    el.style.width = ''
    el.style.minWidth = ''
    el.style.height = ''
    return
  }
  el.style.width = '108px'
  el.style.minWidth = '108px'
  el.style.height = '44px'
  const put = () => {
    const pos = overlayPos(wrap, el, 52)
    fmtBar.left = pos.left
    fmtBar.top = pos.top
  }
  put()
  requestAnimationFrame(put)
}

function placeDataBar(box) {
  if (!box?.querySelector) return
  const wrap = box.closest?.('.fortune-wrap') || hostRef.value?.closest('.fortune-wrap')
  const el = box.querySelector('.fortune-toobar-combo-container[data-label="冻结"]')
    || box.querySelector('[data-tips="冻结"]')?.closest('.fortune-toobar-combo-container, .fortune-toolbar-button')
  if (!el || !wrap) return
  const open = wrap.classList.contains('fs-open')
  if (!open) {
    el.style.width = ''
    el.style.minWidth = ''
    el.style.height = ''
    return
  }
  el.style.width = '292px'
  el.style.minWidth = '292px'
  el.style.height = '44px'
  const put = () => {
    const pos = overlayPos(wrap, el, 44)
    dataBar.left = pos.left
    dataBar.top = pos.top
  }
  put()
  requestAnimationFrame(put)
}

function clickPaint(id) {
  hostRef.value?.querySelector(`svg[data-paint="#${id}"]`)?.closest('button, .fortune-toolbar-item')?.click()
}

function applyAlign(attr, value) {
  alignBar[attr] = value
  const api = instRef.current
  const sel = api?.getSelection?.()?.[0]
  if (!api?.setCellFormatByRange || !sel) return
  api.setCellFormatByRange(attr, value, { row: sel.row, column: sel.column })
}

function clickMerge() {
  const api = instRef.current
  const sheet = api?.getSheet?.()
  const sel = api?.getSelection?.()?.[0]
  if (!api?.mergeCells || !sheet?.id || !sel?.row || !sel?.column) return
  const r0 = sel.row[0] ?? 0
  const r1 = sel.row[1] ?? r0
  const c0 = sel.column[0] ?? 0
  const c1 = sel.column[1] ?? c0
  const cell = sheet.data?.[r0]?.[c0]
  const mc = cell?.mc
  const merged = !!(mc && ((mc.rs || 1) > 1 || (mc.cs || 1) > 1 || mc.r !== r0 || mc.c !== c0))
  if (merged) {
    const top = mc.r ?? r0
    const left = mc.c ?? c0
    api.cancelMerge([{
      row: [top, top + (mc.rs || 1) - 1],
      column: [left, left + (mc.cs || 1) - 1],
    }], { id: sheet.id })
  } else if (r0 !== r1 || c0 !== c1) {
    api.mergeCells([{ row: [r0, r1], column: [c0, c1] }], 'merge-all', { id: sheet.id })
  } else {
    return
  }
  markActiveTools()
}

function cellLabel(cell) {
  if (cell == null || cell === '') return ''
  if (typeof cell !== 'object') return String(cell)
  if (cell.m != null && cell.m !== '') return String(cell.m)
  if (cell.v != null && cell.v !== '') return String(cell.v)
  return ''
}

function openFilter(el) {
  const sheet = instRef.current?.getSheet?.()
  const sel = instRef.current?.getSelection?.()?.[0]
  if (!sheet) return
  const c0 = sel?.column?.[0] ?? 0
  let head = sel?.row?.[0] ?? 0
  let end = sel?.row?.[1] ?? head
  if (head === end) {
    head = 0
    end = 0
    ;(sheet.data || []).forEach((row, r) => {
      if ((row || []).some((cell) => cellLabel(cell))) end = r
    })
  }
  const counts = new Map()
  for (let r = head + 1; r <= end; r += 1) {
    const label = cellLabel(sheet.data?.[r]?.[c0]) || '(空白)'
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  filterPop.col = c0
  filterPop.r0 = head + 1
  filterPop.r1 = end
  filterPop.query = ''
  filterPop.tab = 'value'
  filterPop.items = [...counts.entries()].map(([label, count]) => ({ label, count, checked: true }))
  const box = el?.getBoundingClientRect?.()
  filterPop.left = Math.min(box?.left || 80, window.innerWidth - 340)
  filterPop.top = (box?.bottom || 80) + 4
  filterPop.show = true
  pop.show = false
}

const filterView = computed(() => {
  const words = filterPop.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return filterPop.items.filter((item) => !words.length || words.every((word) => item.label.toLowerCase().includes(word)))
})
const filterAllOn = computed(() => filterView.value.length > 0 && filterView.value.every((item) => item.checked))
const filterCheckedCount = computed(() => filterPop.items.filter((item) => item.checked).reduce((sum, item) => sum + item.count, 0))

function toggleFilterAll() {
  const on = !filterAllOn.value
  const labels = new Set(filterView.value.map((item) => item.label))
  filterPop.items.forEach((item) => {
    if (labels.has(item.label)) item.checked = on
  })
}

function rowKept(label) {
  if (filterPop.tab === 'cond') {
    const raw = label === '(空白)' ? '' : label
    const n = Number(raw)
    const cv = filterPop.condValue
    const cn = Number(cv)
    if (filterPop.cond === 'empty') return raw === ''
    if (filterPop.cond === 'notEmpty') return raw !== ''
    if (filterPop.cond === 'eq') return raw === cv
    if (filterPop.cond === 'ne') return raw !== cv
    if (filterPop.cond === 'gt') return Number.isFinite(n) && Number.isFinite(cn) && n > cn
    if (filterPop.cond === 'lt') return Number.isFinite(n) && Number.isFinite(cn) && n < cn
    return raw.toLowerCase().includes(String(cv).toLowerCase())
  }
  return filterPop.items.find((item) => item.label === label)?.checked !== false
}

function applyFilter() {
  const api = instRef.current
  const sheet = api?.getSheet?.()
  if (!api?.hideRowOrColumn || !sheet) {
    filterPop.show = false
    return
  }
  const hide = []
  const show = []
  for (let r = filterPop.r0; r <= filterPop.r1; r += 1) {
    const label = cellLabel(sheet.data?.[r]?.[filterPop.col]) || '(空白)'
    if (rowKept(label)) show.push(r)
    else hide.push(r)
  }
  if (show.length) api.showRowOrColumn(show, 'row')
  if (hide.length) api.hideRowOrColumn(hide, 'row')
  filterHidden.set(sheet.id, { rows: hide })
  filterPop.show = false
  markActiveTools()
}

function clearFilter() {
  const api = instRef.current
  const sheet = api?.getSheet?.()
  const saved = sheet && filterHidden.get(sheet.id)
  if (api?.showRowOrColumn && saved?.rows?.length) api.showRowOrColumn(saved.rows, 'row')
  if (sheet) filterHidden.delete(sheet.id)
  filterPop.items.forEach((item) => { item.checked = true })
  filterPop.show = false
  markActiveTools()
}

function sortFromFilter(asc) {
  filterPop.show = false
  const api = instRef.current
  const sheet = api?.getSheet?.()
  if (!api?.setCellValue || !sheet) return
  const rows = []
  let maxC = filterPop.col
  for (let r = filterPop.r0; r <= filterPop.r1; r += 1) {
    const line = sheet.data?.[r] || []
    maxC = Math.max(maxC, line.length - 1)
    rows.push(line.slice())
  }
  const keyOf = (cell) => {
    const v = cell?.m ?? cell?.v ?? ''
    const n = Number(v)
    return v !== '' && v != null && Number.isFinite(n) ? n : String(v ?? '')
  }
  rows.sort((a, b) => {
    const av = keyOf(a[filterPop.col])
    const bv = keyOf(b[filterPop.col])
    if (av < bv) return asc ? -1 : 1
    if (av > bv) return asc ? 1 : -1
    return 0
  })
  rows.forEach((line, i) => {
    for (let c = 0; c <= maxC; c += 1) {
      const cell = line[c]
      api.setCellValue(filterPop.r0 + i, c, cell == null ? '' : { ...cell }, { id: sheet.id })
    }
  })
}

function clickData(label) {
  if (label === '筛选') {
    const el = hostRef.value?.querySelector('[data-label="筛选"], [data-tips="筛选"]')
    openFilter(el)
    return
  }
  const box = hostRef.value
  const el = box?.querySelector(`[data-label="${label}"] .fortune-toolbar-combo-button, [data-label="${label}"], [data-tips="${label}"]`)
  el?.click()
}

function applySort(asc) {
  pop.show = false
  const api = instRef.current
  const sel = api?.getSelection?.()?.[0]
  const sheet = api?.getSheet?.()
  if (!api?.setCellValue || !sel || !sheet) return
  const r0 = sel.row?.[0] ?? 0
  const r1 = sel.row?.[1] ?? r0
  const c0 = sel.column?.[0] ?? 0
  const c1 = sel.column?.[1] ?? c0
  const rows = []
  for (let r = r0; r <= r1; r++) {
    const cells = []
    for (let c = c0; c <= c1; c++) cells.push(sheet.data?.[r]?.[c] ?? null)
    rows.push(cells)
  }
  const keyOf = (cell) => {
    const v = cell?.m ?? cell?.v ?? ''
    const n = Number(v)
    return v !== '' && v != null && Number.isFinite(n) ? n : String(v ?? '')
  }
  rows.sort((a, b) => {
    const av = keyOf(a[0])
    const bv = keyOf(b[0])
    if (av < bv) return asc ? -1 : 1
    if (av > bv) return asc ? 1 : -1
    return 0
  })
  rows.forEach((cells, i) => {
    cells.forEach((cell, j) => {
      api.setCellValue(r0 + i, c0 + j, cell == null ? '' : { ...cell }, { id: sheet.id })
    })
  })
}

function applyFontName(name) {
  const api = instRef.current
  const sheet = api?.getSheet?.()
  const sel = api?.getSelection?.()?.[0]
  if (!api?.setCellFormatByRange || !sheet?.id || !sel?.row || !sel?.column) return
  api.setCellFormatByRange('ff', name, { row: sel.row, column: sel.column }, { id: sheet.id })
  fontBar.name = name
}

function applyFontSize(size) {
  const n = Number(size)
  const api = instRef.current
  const sheet = api?.getSheet?.()
  const sel = api?.getSelection?.()?.[0]
  if (!api?.setCellFormatByRange || !sheet?.id || !sel?.row || !sel?.column) return
  api.setCellFormatByRange('fs', n, { row: sel.row, column: sel.column }, { id: sheet.id })
  fontBar.size = n
}

function toggleStyle(attr) {
  const next = fontBar[attr] ? 0 : 1
  fontBar[attr] = next
  const api = instRef.current
  const sel = api?.getSelection?.()?.[0]
  if (!api?.setCellFormatByRange || !sel) return
  api.setCellFormatByRange(attr, next, { row: sel.row, column: sel.column })
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
  const byTip = (tip) => box.querySelector(`.fortune-toolbar [data-tips="${tip}"]`)?.closest('.fortune-toolbar-button, .fortune-toobar-combo-container')
  const frozen = !!(sheet?.frozen && sheet.frozen.type && sheet.frozen.type !== 'cancel')
  const filtered = !!(sheet?.filter_select || sheet?.filter)
  setOn(byLabel('冻结'), frozen)
  setOn(byLabel('筛选'), filtered || filterHidden.has(sheet?.id))
  setOn(byLabel('合并单元格'), !!(cell?.mc))
  setOn(byLabel('对齐'), cell?.ht === 0 || cell?.ht === 2)
  setOn(byLabel('垂直对齐'), cell?.vt === 1 || cell?.vt === 2)
  setOn(byLabel('文本换行'), cell?.tb === 2)
  setOn(byTip('粗体 (Ctrl+B)'), !!cell?.bl)
  setOn(byTip('斜体 (Ctrl+I)'), !!cell?.it)
  setOn(byTip('下划线'), !!cell?.un)
  setOn(byTip('删除线 (Alt+Shift+5)'), !!cell?.cl)
  setOn(byLabel('边框'), pop.show && pop.kind === 'border')
  setOn(byLabel('条件格式'), pop.show && pop.kind === 'cf')
  setOn(byLabel('查找和替换'), findState.open)
  setOn(box.querySelector('.fs-fold-find'), findState.open)
  dataBar.freeze = !!(sheet?.frozen && sheet.frozen.type && sheet.frozen.type !== 'cancel')
  dataBar.filter = !!(sheet?.filter_select || sheet?.filter) || filterHidden.has(sheet?.id)
  dataBar.cf = pop.show && pop.kind === 'cf'
  fontBar.bl = cell?.bl ? 1 : 0
  fontBar.it = cell?.it ? 1 : 0
  fontBar.un = cell?.un ? 1 : 0
  fontBar.cl = cell?.cl ? 1 : 0
  fontBar.fc = cell?.fc || '#1f2329'
  fontBar.bg = cell?.bg || '#fff258'
  fontBar.name = cell?.ff || '微软雅黑'
  fontBar.size = Number(cell?.fs) || 10
  alignBar.ht = cell?.ht ?? 1
  alignBar.vt = cell?.vt ?? 0
  alignBar.tb = cell?.tb ?? 0
  alignBar.merge = !!(cell?.mc)
  const fa = cell?.ct?.fa
  const hit = NUM_FMTS.find((item) => item.fa === fa)
  if (hit) numFmt.id = hit.id
  else if (!fa || fa === 'General') numFmt.id = 'general'
  paintToolbarIcons(box)
  syncCorner()
}

function syncCorner() {
  const corner = hostRef.value?.querySelector('.fortune-left-top')
  const sheet = instRef.current?.getSheet?.()
  const sel = instRef.current?.getSelection?.()?.[0]
  if (!corner) return
  const rows = sheet?.data?.length || sheet?.row || 0
  const cols = sheet?.data?.[0]?.length || sheet?.column || 0
  const all = !!sel && rows > 0 && cols > 0
    && sel.row?.[0] === 0
    && sel.column?.[0] === 0
    && (sel.row?.[1] ?? 0) >= rows - 1
    && (sel.column?.[1] ?? 0) >= cols - 1
  corner.classList.toggle('is-on', all)
}

function selectWholeSheet() {
  const api = instRef.current
  const sheet = api?.getSheet?.()
  if (!api?.setSelection || !sheet?.id) return
  const rows = Math.max((sheet.data?.length || sheet.row || 1) - 1, 0)
  const cols = Math.max((sheet.data?.[0]?.length || sheet.column || 1) - 1, 0)
  api.setSelection([{ row: [0, rows], column: [0, cols] }], { id: sheet.id })
  syncCorner()
  markActiveTools()
}

function paintToolbarIcons(box) {
  box.querySelectorAll('.fortune-toolbar svg use').forEach((use) => {
    const href = use.getAttribute('href') || use.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || ''
    const icon = feishuIcon(href.replace('#', ''))
    const svg = use.closest('svg')
    if (!icon || !svg || svg.dataset.paint === href) return
    svg.setAttribute('viewBox', icon.vb)
    svg.innerHTML = icon.html
    svg.dataset.paint = href
  })
  box.querySelectorAll('.fortune-toolbar svg[data-paint="#font-color"]').forEach((svg) => {
    const bar = svg.querySelector('path:last-child')
    const color = bar?.getAttribute('fill') || '#1f2329'
    if (svg.dataset.aligned === color) return
    svg.setAttribute('viewBox', '0 0 16 16')
    svg.innerHTML = `<path fill="currentColor" d="M8 1.2 3.2 12h1.7l.9-2.2h4.4l.9 2.2h1.7L8 1.2Zm0 3.3 1.6 4H6.4L8 4.5Z"/><path fill="${color}" d="M3.2 13.1h9.6v1.8H3.2z"/>`
    svg.dataset.aligned = color
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
    labelObs = new MutationObserver(() => {
      if (stamping) return
      stampFeishuLabels()
    })
    labelObs.observe(tb, { childList: true, subtree: true })
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
    : kind === 'cf-fc'
      ? cfForm.textColor
      : kind === 'cf-bg'
        ? cfForm.cellColor
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
  if (colorPop.kind === 'cf-fc') {
    cfForm.textColor = color || '#1f2329'
    cfForm.textOn = true
    return
  }
  if (colorPop.kind === 'cf-bg') {
    cfForm.cellColor = color || '#c6efce'
    cfForm.cellOn = true
    return
  }
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

function applyNumFmt(item) {
  if (!item.fa) {
    pop.show = false
    return
  }
  numFmt.id = item.id
  const api = instRef.current
  const sel = api?.getSelection?.()?.[0]
  if (api?.setCellFormatByRange && sel) {
    api.setCellFormatByRange('ct', { fa: item.fa, t: item.t }, { row: sel.row, column: sel.column })
  }
  const box = hostRef.value?.querySelector('[data-tips="格式"]')?.closest('.fortune-toobar-combo-container')
  const label = box?.querySelector('.fortune-toolbar-combo-text')
  if (label) label.textContent = item.short
  pop.show = false
  markActiveTools()
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
  const flyW = id === 'color' ? 240 : 180
  cfState.flyX = pop.left + 176 + flyW > window.innerWidth - 8
    ? Math.max(8, pop.left - flyW)
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
    openCfRules()
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

function openCfRules() {
  pop.show = false
  cfState.fly = ''
  refreshCfFlags()
  cfState.side = true
  cfState.panel = 'rules'
  cfState.dlg = 'rules'
  markActiveTools()
}

function backCf() {
  refreshCfFlags()
  cfState.panel = 'rules'
  cfState.dlg = 'rules'
}

function cfRuleText(rule) {
  const names = {
    greaterThan: '大于', lessThan: '小于', between: '介于', equal: '等于',
    textContains: '包含', occurrenceDate: '日期为', duplicateValue: '重复',
    top10: '最前', top10_percent: '最前', last10: '最后', last10_percent: '最后',
    aboveAverage: '高于平均值', belowAverage: '低于平均值',
  }
  const name = names[rule.conditionName] || '规则'
  const val = (rule.conditionValue || []).filter((v) => v != null && v !== '').join(' 和 ')
  if (rule.conditionName === 'aboveAverage' || rule.conditionName === 'belowAverage') return name
  return val ? `值${name} ${val}` : name
}

function cfRuleRange(rule) {
  const range = rule.cellrange?.[0]
  if (!range) return ''
  const a = `${colLetter(range.column[0])}${range.row[0] + 1}`
  const b = `${colLetter(range.column[1])}${range.row[1] + 1}`
  return a === b ? a : `${a}:${b}`
}

function openCfDialog(type, side = false) {
  pop.show = false
  resetCfForm()
  cfState.dlg = type
  cfState.panel = 'edit'
  cfState.side = side && !!CF_RULES[type]
  if (cfState.side) {
    const sel = cfSelection()[0]
    const a = `${colLetter(sel.column[0])}${sel.row[0] + 1}`
    const b = `${colLetter(sel.column[1])}${sel.row[1] + 1}`
    cfForm.range = a === b ? a : `${a}:${b}`
    const group = Object.keys(CF_OPS).find((id) => CF_OPS[id].some((op) => op.id === type)) || 'value'
    cfForm.group = group
    cfForm.kind = ['top10', 'top10_percent', 'last10', 'last10_percent', 'aboveAverage', 'belowAverage'].includes(type) ? 'item' : 'highlight'
    cfForm.percent = type.endsWith('_percent')
    cfForm.rank = type.startsWith('last') ? 'last' : type === 'aboveAverage' ? 'above' : type === 'belowAverage' ? 'below' : 'top'
    if (type.startsWith('top') || type.startsWith('last')) cfForm.project = '10'
    cfForm.cellColor = '#c6efce'
    cfForm.textColor = '#1f2329'
    cfForm.bl = false
    cfForm.it = false
    cfForm.un = false
    cfForm.cl = false
  }
  markActiveTools()
}

function pickCfStyle(index) {
  const style = CF_STYLES[index] || CF_STYLES[0]
  cfForm.style = index
  cfForm.textOn = true
  cfForm.cellOn = true
  cfForm.textColor = style.text
  cfForm.cellColor = style.cell
}

function onCfGroup(id) {
  cfForm.group = id
  const next = CF_OPS[id]?.[0]?.id
  if (next) cfState.dlg = next
}

function onCfKind(id) {
  cfForm.kind = id
  if (id === 'item') {
    cfForm.rank = 'top'
    cfForm.percent = false
    cfForm.project = '10'
    cfState.dlg = 'top10'
    return
  }
  cfForm.group = 'value'
  cfState.dlg = 'greaterThan'
}

function syncRankType() {
  if (cfForm.rank === 'above') cfState.dlg = 'aboveAverage'
  else if (cfForm.rank === 'below') cfState.dlg = 'belowAverage'
  else if (cfForm.rank === 'last') cfState.dlg = cfForm.percent ? 'last10_percent' : 'last10'
  else cfState.dlg = cfForm.percent ? 'top10_percent' : 'top10'
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
  if (cfForm.bl) format.bl = 1
  if (cfForm.it) format.it = 1
  if (cfForm.un) format.un = 1
  if (cfForm.cl) format.cl = 1
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
  cfState.side = false
}

function cellText(cell, formula) {
  if (cell == null || cell === '') return ''
  if (typeof cell !== 'object') return String(cell)
  if (formula && cell.f) return String(cell.f)
  if (cell.m != null && cell.m !== '') return String(cell.m)
  if (cell.v != null && typeof cell.v === 'object') return cellText(cell.v, formula)
  if (cell.v != null) return String(cell.v)
  return ''
}

function cellBg(cell) {
  if (!cell || typeof cell !== 'object') return null
  if (cell.bg) return cell.bg
  if (cell.v && typeof cell.v === 'object' && cell.v.bg) return cell.v.bg
  return null
}

function clearFindMark() {
  if (!findMark) return
  const mark = findMark
  findMark = null
  const api = instRef.current
  api?.setCellFormatByRange?.('bg', mark.bg, {
    row: [mark.r, mark.r],
    column: [mark.c, mark.c],
  }, { id: mark.id })
}

function paintFindMark() {
  clearFindMark()
  const hit = findState.hits[findState.index]
  const api = instRef.current
  if (!hit || !findState.query || !api?.setCellFormatByRange) return
  findMark = { id: hit.id, r: hit.r, c: hit.c, bg: hit.bg ?? null }
  api.setCellFormatByRange('bg', '#ffe58f', {
    row: [hit.r, hit.r],
    column: [hit.c, hit.c],
  }, { id: hit.id })
}

function collectFindHits() {
  const q = findState.query
  if (!q) return []
  const api = instRef.current
  const sheets = findState.scope === 'all'
    ? (api?.getAllSheets?.() || latest || [])
    : [api?.getSheet?.() || latest.find((s) => s.status === 1) || latest[0]].filter(Boolean)
  const hits = []
  sheets.forEach((sheet) => {
    const cells = new Map()
    ;(sheet.celldata || []).forEach((item) => {
      if (item) cells.set(`${item.r},${item.c}`, item.v)
    })
    ;(sheet.data || []).forEach((row, r) => {
      ;(row || []).forEach((cell, c) => {
        if (cell != null && cell !== '') cells.set(`${r},${c}`, cell)
      })
    })
    cells.forEach((cell, key) => {
      const text = cellText(cell, findState.formula)
      if (!text.includes(q)) return
      const [r, c] = key.split(',').map(Number)
      hits.push({ id: sheet.id, r, c, value: text, bg: cellBg(cell) })
    })
  })
  return hits
}

function refreshFindHits() {
  clearFindMark()
  findState.hits = collectFindHits()
  if (!findState.hits.length) {
    findState.index = 0
    return
  }
  if (findState.index >= findState.hits.length) findState.index = 0
  paintFindMark()
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
  clearFindMark()
  findState.open = false
  findState.scopeOpen = false
  markActiveTools()
}

function goFind(dir) {
  refreshFindHits()
  if (!findState.hits.length) return
  findState.index = (findState.index + dir + findState.hits.length) % findState.hits.length
  paintFindMark()
}

function replaceOne() {
  refreshFindHits()
  const hit = findState.hits[findState.index]
  const api = instRef.current
  if (!hit || !api?.setCellValue || !findState.query) return
  const next = hit.value.replace(findState.query, findState.replace)
  api.setCellValue(hit.r, hit.c, next, { id: hit.id })
  refreshFindHits()
}

function replaceAllHits() {
  refreshFindHits()
  const api = instRef.current
  if (!api?.setCellValue || !findState.query) return
  collectFindHits().forEach((hit) => {
    api.setCellValue(hit.r, hit.c, hit.value.replaceAll(findState.query, findState.replace), { id: hit.id })
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
  const fmtBox = e.target?.closest?.('.fortune-toobar-combo-container')
  if (fmtBox && hostRef.value?.contains(fmtBox) && fmtBox.querySelector('[data-tips="格式"]')) {
    if (e.target.closest?.('.fortune-toolbar-combo-popup, .fortune-toolbar-select')) return
    e.preventDefault()
    e.stopPropagation()
    if (pop.show && pop.kind === 'numfmt') {
      pop.show = false
      return
    }
    openPop('numfmt', fmtBox)
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
  const filterHit = e.target?.closest?.('.fortune-toobar-combo-container[data-label="筛选"], .fortune-toolbar-button[data-tips="筛选"]')
  if (filterHit && hostRef.value?.contains(filterHit)) {
    e.preventDefault()
    e.stopPropagation()
    if (filterPop.show) {
      filterPop.show = false
      return
    }
    openFilter(filterHit)
    return
  }
  const findBtn = e.target?.closest?.('.fortune-toolbar-button, .fortune-toobar-combo-container')
  if (findBtn && hostRef.value?.contains(findBtn)) {
    const paint = findBtn.querySelector('svg')?.getAttribute('data-paint') || ''
    const path = findBtn.querySelector('path')?.getAttribute('d') || ''
    const use = findBtn.querySelector('use')
    const href = use?.getAttribute('href') || use?.getAttributeNS?.('http://www.w3.org/1999/xlink', 'href') || ''
    const tip = `${findBtn.getAttribute('data-tips') || ''}${findBtn.getAttribute('data-label') || ''}`
    const isSearch = paint.includes('search') || href.includes('search')
      || path.startsWith('M2 4a1 1 0 0 1 1-1h18')
      || tip.includes('查找')
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

const ctxMenu = reactive({ show: false, x: 0, y: 0, fly: '' })
const CTX_ICONS = {
  copy: 'M4 2.5h6.2A1.3 1.3 0 0 1 11.5 3.8V11a1.3 1.3 0 0 1-1.3 1.3H4A1.3 1.3 0 0 1 2.7 11V3.8A1.3 1.3 0 0 1 4 2.5Zm0 1.2a.1.1 0 0 0-.1.1V11c0 .06.04.1.1.1h6.2a.1.1 0 0 0 .1-.1V3.8a.1.1 0 0 0-.1-.1H4Zm2.2 10h4.6A1.3 1.3 0 0 0 12.1 12.4V5.2h1.2v7.2A2.5 2.5 0 0 1 10.8 14.9H6.2V13.7Z',
  image: 'M2.5 3.2h11a1.3 1.3 0 0 1 1.3 1.3v7a1.3 1.3 0 0 1-1.3 1.3h-11A1.3 1.3 0 0 1 1.2 11.5v-7A1.3 1.3 0 0 1 2.5 3.2Zm0 1.2v7h11v-7h-11Zm1.6 5.2 1.7-1.8 1.4 1.5 2.2-2.4 2.3 2.7H4.1Zm1.3-3.2a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z',
  cut: 'M5.2 6.4a1.7 1.7 0 1 1-1.4-1.6l2.2 2.2-2.2 2.2a1.7 1.7 0 1 1 .4 1.1l2.4-2.4 5.2 5.2 1.1-1.1-5.2-5.2 5.2-5.2-1.1-1.1-5.2 5.2-1.4-1.4Zm-1.5-2.2a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4Zm0 6.2a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4Z',
  paste: 'M5.2 1.8h3.2a1.6 1.6 0 0 1 3.1.8H6.2v1.2h5.6v1.1H4.2V2.6h1Zm-.2 2.2h8.2A1.3 1.3 0 0 1 14.5 5.3v8.2a1.3 1.3 0 0 1-1.3 1.3H5A1.3 1.3 0 0 1 3.7 13.5V5.3A1.3 1.3 0 0 1 5 4Zm0 1.2v8.3h8.2V5.2H5Z',
  detail: 'M8 3.1a5.4 5.4 0 0 1 5.2 3.6A5.4 5.4 0 0 1 8 10.3 5.4 5.4 0 0 1 2.8 6.7 5.4 5.4 0 0 1 8 3.1Zm0 1.2A4.2 4.2 0 0 0 4 6.7 4.2 4.2 0 0 0 8 9.1a4.2 4.2 0 0 0 4-2.4A4.2 4.2 0 0 0 8 4.3Zm0 1.1a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z',
  link: 'M6.6 9.4a2.6 2.6 0 0 1 0-3.7l1.6-1.6a2.6 2.6 0 0 1 3.7 3.7L10.7 9l-.9-.9 1.2-1.2a1.4 1.4 0 0 0-2-2L7.4 6.5a1.4 1.4 0 0 0 0 2l.4.4-.9.9-.3-.4Zm2.8-2.8.9.9-.4.4a1.4 1.4 0 0 1 0 2l-1.6 1.6a1.4 1.4 0 0 1-2-2L7.5 8.3l-.9.9L5.4 10.4a2.6 2.6 0 0 0 3.7 3.7l1.6-1.6a2.6 2.6 0 0 0 0-3.7l-1.3-1.2Z',
  shield: 'M8 1.6 13 3.4v4.2c0 2.7-1.8 4.8-5 6.2-3.2-1.4-5-3.5-5-6.2V3.4L8 1.6Zm0 1.4L4.2 4.3v3.3c0 2 .1 3.6 3.8 4.9 2.1-1.2 3.8-2.7 3.8-4.9V4.3L8 3Z',
  comment: 'M2.4 3.2h11.2A1.2 1.2 0 0 1 14.8 4.4v6.2a1.2 1.2 0 0 1-1.2 1.2H6.2L3.2 14.2V4.4a1.2 1.2 0 0 1 1.2-1.2Zm0 1.2v8.1l1.8-1.5h9.4V4.4H2.4Z',
  note: 'M3.2 2.4h7.1L13.6 5.7v7.9a1.2 1.2 0 0 1-1.2 1.2H3.2A1.2 1.2 0 0 1 2 13.6V3.6a1.2 1.2 0 0 1 1.2-1.2Zm6.6 1.2H3.2v10h9.2V6.2H9.8V3.6Z',
  validation: 'M2.6 3.4h10.8v1.2H2.6V3.4Zm0 3.6h7.4v1.2H2.6V7Zm0 3.6h10.8v1.2H2.6v-1.2Zm9.2-4.2 1.5 1.6-1.5 1.6V6.4Z',
}
const CTX_ITEMS = [
  { id: 'copy', label: '复制', shortcut: 'Ctrl+C', icon: 'copy' },
  { id: 'copyImage', label: '复制为图片', icon: 'image' },
  { id: 'cut', label: '剪切', shortcut: 'Ctrl+X', icon: 'cut' },
  { id: 'paste', label: '粘贴', shortcut: 'Ctrl+V', icon: 'paste' },
  { id: 'pasteSpecial', label: '选择性粘贴', caret: true, children: [
    { id: 'pasteValue', label: '仅粘贴值' },
    { id: 'pasteFormat', label: '仅粘贴格式' },
    { id: 'pasteFormula', label: '仅粘贴公式' },
  ] },
  { sep: true },
  { id: 'insert', label: '插入', caret: true, children: [
    { id: 'insertRowAbove', label: '向上插入行' },
    { id: 'insertRowBelow', label: '向下插入行' },
    { id: 'insertColLeft', label: '向左插入列' },
    { id: 'insertColRight', label: '向右插入列' },
  ] },
  { id: 'remove', label: '删除', caret: true, children: [
    { id: 'deleteRow', label: '删除行' },
    { id: 'deleteCol', label: '删除列' },
    { sep: true },
    { id: 'deleteShiftUp', label: '删除单元格，下方单元格上移' },
    { id: 'deleteShiftLeft', label: '删除单元格，右侧单元格左移' },
  ] },
  { id: 'clear', label: '清除', caret: true, children: [
    { id: 'clearValue', label: '清除内容' },
    { id: 'clearFormat', label: '清除格式' },
    { id: 'clearAll', label: '全部清除' },
  ] },
  { sep: true },
  { id: 'detail', label: '查看单元格详情', icon: 'detail' },
  { id: 'numfmt', label: '设置单元格数字格式' },
  { sep: true },
  { id: 'sort', label: '排序', caret: true, children: [
    { id: 'sortAsc', label: '升序' },
    { id: 'sortDesc', label: '降序' },
  ] },
  { id: 'link', label: '复制选区链接', icon: 'link' },
  { sep: true },
  { id: 'split', label: '拆分单元格' },
  { id: 'protectOn', label: '设置保护范围', icon: 'shield' },
  { sep: true },
  { id: 'comment', label: '添加评论', shortcut: 'Ctrl+Alt+M', icon: 'comment' },
  { id: 'note', label: '添加备注', shortcut: 'Shift+F2', icon: 'note', badge: 'New' },
  { sep: true },
  { id: 'validation', label: '数据验证', icon: 'validation' },
  { id: 'dedupe', label: '删除重复项' },
  { sep: true },
  { id: 'history', label: '单元格历史记录' },
]
let copiedCells = null
const cellLog = new Map()
const ctxDlg = reactive({ show: false, title: '', text: '', mode: '', lines: [] })

function selectionBox() {
  const api = instRef.current
  const sel = api?.getSelection?.()?.[0]
  const sheet = api?.getSheet?.()
  if (!sel || !sheet) return null
  const r0 = sel.row?.[0] ?? 0
  const r1 = sel.row?.[1] ?? r0
  const c0 = sel.column?.[0] ?? 0
  const c1 = sel.column?.[1] ?? c0
  return { r0, r1, c0, c1, id: sheet.id, sheet }
}

function readSelectionCells() {
  const box = selectionBox()
  if (!box) return []
  const rows = []
  for (let r = box.r0; r <= box.r1; r += 1) {
    const line = []
    for (let c = box.c0; c <= box.c1; c += 1) {
      const cell = box.sheet.data?.[r]?.[c]
      line.push(cell && typeof cell === 'object' ? { ...cell } : { v: cell ?? '' })
    }
    rows.push(line)
  }
  return rows
}

function logCell(r, c, value) {
  const key = `${r},${c}`
  const list = cellLog.get(key) || []
  list.push({ time: new Date().toLocaleString(), value: String(value ?? '') })
  cellLog.set(key, list.slice(-8))
}

function writeCells(rows, mode) {
  const api = instRef.current
  const box = selectionBox()
  if (!api || !box || !rows?.length) return
  rows.forEach((line, ri) => {
    line.forEach((cell, ci) => {
      const r = box.r0 + ri
      const c = box.c0 + ci
      const range = { row: [r, r], column: [c, c] }
      if (mode !== 'format') {
        const value = mode === 'formula' && cell.f ? cell.f : (cell.v ?? cell.m ?? '')
        api.setCellValue?.(r, c, value, { id: box.id })
        logCell(r, c, value)
      }
      if (mode === 'value') return
      ;['bg', 'fc', 'bl', 'it', 'un', 'cl', 'fs', 'ff', 'ht', 'vt'].forEach((key) => {
        if (cell[key] != null) api.setCellFormatByRange?.(key, cell[key], range, { id: box.id })
      })
    })
  })
}

function clearSelection(mode) {
  const api = instRef.current
  const box = selectionBox()
  if (!api || !box) return
  for (let r = box.r0; r <= box.r1; r += 1) {
    for (let c = box.c0; c <= box.c1; c += 1) {
      const range = { row: [r, r], column: [c, c] }
      if (mode !== 'format') {
        api.setCellValue?.(r, c, '', { id: box.id })
        logCell(r, c, '')
      }
      if (mode !== 'value') {
        ;['bg', 'fc', 'bl', 'it', 'un', 'cl', 'fs', 'ff', 'ht', 'vt', 'ct'].forEach((key) => {
          api.setCellFormatByRange?.(key, null, range, { id: box.id })
        })
      }
    }
  }
}

function insertAxis(type, direction) {
  const box = selectionBox()
  const api = instRef.current
  if (!box || !api?.applyOp) return
  api.applyOp([{
    op: 'insertRowCol',
    value: {
      type,
      index: type === 'row' ? box.r0 : box.c0,
      count: 1,
      direction,
      id: box.id,
    },
  }])
}

function deleteAxis(type) {
  const box = selectionBox()
  const api = instRef.current
  if (!box || !api?.applyOp) return
  api.applyOp([{
    op: 'deleteRowCol',
    value: {
      type,
      start: type === 'row' ? box.r0 : box.c0,
      end: type === 'row' ? box.r1 : box.c1,
      id: box.id,
    },
  }])
}

function cellPlain(cell) {
  if (cell == null || cell === '') return ''
  if (typeof cell !== 'object') return String(cell)
  return String(cell.m ?? cell.v ?? cell.f ?? '')
}

function selectionText() {
  return readSelectionCells().map((line) => line.map(cellPlain).join('\t')).join('\n')
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text) } catch { /* */ }
}

async function copySelectionImage() {
  const rows = readSelectionCells()
  if (!rows.length) return
  const canvas = document.createElement('canvas')
  const colW = 88
  const rowH = 28
  canvas.width = rows[0].length * colW
  canvas.height = rows.length * rowH
  const g = canvas.getContext('2d')
  g.fillStyle = '#fff'
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.font = '12px "微软雅黑", "Microsoft YaHei", sans-serif'
  g.fillStyle = '#1f2329'
  g.textBaseline = 'middle'
  rows.forEach((line, r) => {
    line.forEach((cell, c) => {
      if (cell.bg) {
        g.fillStyle = cell.bg
        g.fillRect(c * colW, r * rowH, colW, rowH)
      }
      g.strokeStyle = '#dee0e3'
      g.strokeRect(c * colW + 0.5, r * rowH + 0.5, colW - 1, rowH - 1)
      g.fillStyle = cell.fc || '#1f2329'
      g.fillText(cellPlain(cell), c * colW + 6, r * rowH + rowH / 2)
    })
  })
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  } catch {
    await copyText(selectionText())
  }
}

async function pasteFromClipboard(mode) {
  if (copiedCells?.length && mode !== 'clip') {
    writeCells(copiedCells, mode)
    return
  }
  let text = ''
  try { text = await navigator.clipboard.readText() } catch { /* */ }
  if (!text) {
    if (copiedCells?.length) writeCells(copiedCells, mode === 'clip' ? 'all' : mode)
    return
  }
  const rows = text.replace(/\r/g, '').split('\n').filter((line, i, arr) => line || i < arr.length - 1).map((line) => (
    line.split('\t').map((v) => ({ v }))
  ))
  writeCells(rows, mode === 'clip' ? 'value' : mode)
}

function openCtxDlg(mode, title, text = '', lines = []) {
  ctxDlg.mode = mode
  ctxDlg.title = title
  ctxDlg.text = text
  ctxDlg.lines = lines
  ctxDlg.show = true
}

function confirmCtxDlg() {
  const box = selectionBox()
  const api = instRef.current
  const text = ctxDlg.text.trim()
  if (box && api) {
    const range = { row: [box.r0, box.r0], column: [box.c0, box.c0] }
    if (ctxDlg.mode === 'comment' || ctxDlg.mode === 'note') {
      api.setCellFormatByRange?.('ps', text ? { value: text, isshow: ctxDlg.mode === 'comment' } : null, range, { id: box.id })
    } else if (ctxDlg.mode === 'validation' && text) {
      const sheet = api.getSheet?.() || box.sheet
      const dv = { ...(sheet.dataVerification || {}) }
      for (let r = box.r0; r <= box.r1; r += 1) {
        for (let c = box.c0; c <= box.c1; c += 1) {
          dv[`${r}_${c}`] = { type: 'dropdown', type2: false, value1: text, prohibitInput: false, hintShow: false, hintText: '' }
        }
      }
      api.applyOp?.([{ id: box.id, op: 'replace', path: ['dataVerification'], value: dv }])
    }
  }
  ctxDlg.show = false
}

function removeDuplicates() {
  const rows = readSelectionCells()
  const box = selectionBox()
  if (!box || rows.length < 2) return
  const seen = new Set()
  rows.forEach((line, ri) => {
    const key = line.map(cellPlain).join('\t')
    if (seen.has(key)) {
      for (let c = box.c0; c <= box.c1; c += 1) {
        instRef.current?.setCellValue?.(box.r0 + ri, c, '', { id: box.id })
      }
    } else if (key.trim()) seen.add(key)
  })
}

async function onCtxAction(id) {
  const box = selectionBox()
  const api = instRef.current
  ctxMenu.show = false
  ctxMenu.fly = ''
  if (id === 'copy') {
    copiedCells = readSelectionCells()
    await copyText(selectionText())
    return
  }
  if (id === 'copyImage') {
    await copySelectionImage()
    return
  }
  if (id === 'cut') {
    copiedCells = readSelectionCells()
    await copyText(selectionText())
    clearSelection('all')
    return
  }
  if (id === 'paste') {
    await pasteFromClipboard('clip')
    return
  }
  if (id === 'pasteValue') writeCells(copiedCells, 'value')
  else if (id === 'pasteFormat') writeCells(copiedCells, 'format')
  else if (id === 'pasteFormula') writeCells(copiedCells, 'formula')
  else if (id === 'insertRowAbove') insertAxis('row', 'lefttop')
  else if (id === 'insertRowBelow') insertAxis('row', 'rightbottom')
  else if (id === 'insertColLeft') insertAxis('column', 'lefttop')
  else if (id === 'insertColRight') insertAxis('column', 'rightbottom')
  else if (id === 'deleteRow') deleteAxis('row')
  else if (id === 'deleteCol') deleteAxis('column')
  else if (id === 'deleteShiftUp') shiftCells('up')
  else if (id === 'deleteShiftLeft') shiftCells('left')
  else if (id === 'sortAsc') applySort(true)
  else if (id === 'sortDesc') applySort(false)
  else if (id === 'split') clickMerge()
  else if (id === 'clearValue') clearSelection('value')
  else if (id === 'clearFormat') clearSelection('format')
  else if (id === 'clearAll') clearSelection('all')
  else if (id === 'detail' && box) {
    const cell = box.sheet.data?.[box.r0]?.[box.c0]
    const addr = `${colLetter(box.c0)}${box.r0 + 1}`
    openCtxDlg('detail', '单元格详情', '', [
      `位置 ${addr}`,
      `内容 ${cellPlain(cell) || '（空）'}`,
      `公式 ${cell?.f || '无'}`,
      `数字格式 ${cell?.ct?.fa || '常规'}`,
    ])
  } else if (id === 'numfmt') {
    const el = hostRef.value?.querySelector('[data-tips="格式"]')?.closest('.fortune-toobar-combo-container')
    if (el) openPop('numfmt', el)
  } else if (id === 'link' && box) {
    await copyText(`${location.origin}${location.pathname}?range=${colLetter(box.c0)}${box.r0 + 1}:${colLetter(box.c1)}${box.r1 + 1}`)
  } else if (id === 'protectOn' && box) {
    api?.setCellFormatByRange?.('lo', 1, { row: [box.r0, box.r1], column: [box.c0, box.c1] }, { id: box.id })
  } else if (id === 'protectOff' && box) {
    api?.setCellFormatByRange?.('lo', 0, { row: [box.r0, box.r1], column: [box.c0, box.c1] }, { id: box.id })
  } else if (id === 'comment') {
    openCtxDlg('comment', '添加批注', box?.sheet.data?.[box.r0]?.[box.c0]?.ps?.value || '')
  } else if (id === 'note') {
    openCtxDlg('note', '添加评论', box?.sheet.data?.[box.r0]?.[box.c0]?.ps?.value || '')
  } else if (id === 'validation') {
    openCtxDlg('validation', '数据验证', '选项1,选项2,选项3')
  } else if (id === 'dedupe') removeDuplicates()
  else if (id === 'history' && box) {
    const lines = cellLog.get(`${box.r0},${box.c0}`) || []
    openCtxDlg('history', '单元格历史记录', '', lines.length ? lines.map((item) => `${item.time}  ${item.value || '（空）'}`) : ['还没有通过菜单改过这个单元格'])
  }
}

function shiftCells(dir) {
  const box = selectionBox()
  const api = instRef.current
  if (!box || !api?.setCellValue) return
  const sheet = box.sheet
  const data = sheet.data || []
  if (dir === 'up') {
    for (let c = box.c0; c <= box.c1; c += 1) {
      const span = box.r1 - box.r0 + 1
      for (let r = box.r0; r < (data.length || box.r1 + span + 1); r += 1) {
        const src = data[r + span]?.[c]
        api.setCellValue(r, c, cellPlain(src), { id: box.id })
      }
    }
    return
  }
  for (let r = box.r0; r <= box.r1; r += 1) {
    const span = box.c1 - box.c0 + 1
    const width = data[r]?.length || box.c1 + span + 1
    for (let c = box.c0; c < width; c += 1) {
      api.setCellValue(r, c, cellPlain(data[r]?.[c + span]), { id: box.id })
    }
  }
}

function onSheetContext(e) {
  if (!hostRef.value?.contains(e.target)) return
  const grid = e.target?.closest?.('.fortune-cell-area, .fortune-row-header, .fortune-col-header, canvas')
  if (!grid) return
  e.preventDefault()
  e.stopPropagation()
  const box = selectionBox()
  const remove = CTX_ITEMS.find((item) => item.id === 'remove')
  if (remove && box) {
    const a = box.r0 + 1
    const b = box.r1 + 1
    remove.children[0].label = a === b ? `删除第 ${a} 行` : `删除第 ${a} - ${b} 行`
    remove.children[1].label = box.c0 === box.c1 ? '删除列' : `删除 ${colLetter(box.c0)} - ${colLetter(box.c1)} 列`
  }
  const menuW = 260
  const menuH = 520
  ctxMenu.x = Math.min(e.clientX, window.innerWidth - menuW - 8)
  ctxMenu.y = Math.min(e.clientY, window.innerHeight - Math.min(menuH, window.innerHeight - 16))
  ctxMenu.fly = ''
  ctxMenu.show = true
}

function bindFreezeClick() {
  const box = hostRef.value
  if (!box || freezeClickBound) return
  box.addEventListener('click', onFreezeCapture, true)
  box.addEventListener('click', (e) => {
    if (e.target?.closest?.('.fortune-left-top')) selectWholeSheet()
    else requestAnimationFrame(syncCorner)
  }, true)
  box.addEventListener('contextmenu', onSheetContext, true)
  freezeClickBound = true
}

function tipFor(el) {
  if (!el) return ''
  if (el.classList.contains('fs-arco-font') || el.closest?.('.fs-arco-font')) return '字体'
  if (el.classList.contains('fs-arco-size') || el.closest?.('.fs-arco-size')) return '字号'
  const named = el.getAttribute('data-tip')
  if (named) return named
  const tips = el.getAttribute('data-tips') || el.querySelector?.('[data-tips]')?.getAttribute('data-tips')
  if (tips) return shortLabel(tips)
  const label = el.getAttribute('data-label')
  if (label) return label
  return ''
}

function onTipOver(e) {
  const t = e.target
  if (!t?.closest) {
    fsTip.show = false
    return
  }
  if (t.closest('.fs-fold') || !t.closest('.fortune-toolbar')) {
    fsTip.show = false
    return
  }
  if (t.closest('.fs-pop, .fs-hide, .cp, .arco-trigger-popup, .fortune-toolbar-combo-popup')) {
    fsTip.show = false
    return
  }
  const hit = t.closest('[data-tip], .fs-arco-font, .fs-arco-size, .fortune-toolbar-button[data-tips], .fortune-toobar-combo-container[data-label]')
  if (!hit) {
    fsTip.show = false
    return
  }
  const cs = getComputedStyle(hit)
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') {
    fsTip.show = false
    return
  }
  const text = tipFor(hit)
  if (!text) {
    fsTip.show = false
    return
  }
  const r = hit.getBoundingClientRect()
  fsTip.text = text
  fsTip.left = Math.round(Math.min(Math.max(r.left + r.width / 2, 36), window.innerWidth - 36))
  fsTip.top = Math.round(r.bottom + 6)
  fsTip.show = true
}

function onTipLeave() {
  fsTip.show = false
}

function onWrapDown(e) {
  fsTip.show = false
  if (e.button === 2) return
  if (e.target.closest?.('.cp, .fs-pop, .fs-fold, .fs-cf-dlg, .fs-cf-fly, .fs-find, .fs-ctx, .fs-ctx-dlg, .fs-filter, .fs-style-cluster, .fs-align-cluster, .fs-fmt-cluster, .fs-data-cluster')) return
  pop.show = false
  filterPop.show = false
  colorPop.show = false
  borderState.styleOpen = false
  cfState.fly = ''
  if (!cfState.side) cfState.dlg = ''
  findState.scopeOpen = false
  ctxMenu.show = false
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
    defaultFontSize: 10,
    defaultRowHeight: 24,
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
    onChange: (next) => { latest = next || latest; markActiveTools() },
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
  clearFindMark()
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

watch(folded, () => {
  nextTick(() => requestAnimationFrame(() => {
    placeFontBar(hostRef.value)
    placeAlignBar(hostRef.value)
    placeFmtBar(hostRef.value)
    placeDataBar(hostRef.value)
  }))
})

onBeforeUnmount(() => {
  labelObs?.disconnect()
  labelObs = null
  hostRef.value?.removeEventListener('click', onFreezeCapture, true)
  hostRef.value?.removeEventListener('contextmenu', onSheetContext, true)
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
  <div class="fortune-wrap" :class="{ 'fs-open': !folded, 'cf-side': cfState.side && cfState.dlg }" @mousedown="onWrapDown" @mouseover="onTipOver" @mouseleave="onTipLeave">
    <input ref="fileRef" type="file" accept=".xlsx,.xls" hidden @change="onImport">
    <div ref="hostRef" class="fortune-host"></div>
    <Teleport v-if="toolbarEl" :to="toolbarEl">
    <div
      v-if="fontBar.show"
      class="fs-style-cluster"
      :style="{ left: `${fontBar.left}px`, top: `${fontBar.top}px` }"
      @mousedown.stop
    >
      <div class="fs-style-top">
        <a-select
          class="fs-arco-font"
          data-tip="字体"
          :model-value="fontBar.name"
          size="mini"
          popup-container="body"
          :trigger-props="fontPopup"
          @change="applyFontName"
        >
          <a-option v-for="name in FONT_NAMES" :key="name.id" :value="name.id">{{ name.label }}</a-option>
        </a-select>
        <a-select
          class="fs-arco-size"
          data-tip="字号"
          :model-value="fontBar.size"
          size="mini"
          popup-container="body"
          :trigger-props="sizePopup"
          @change="applyFontSize"
        >
          <a-option v-for="size in FONT_SIZES" :key="size" :value="size">{{ size }}</a-option>
        </a-select>
      </div>
      <div class="fs-style-bot">
        <button type="button" class="fs-style-btn b" :class="{ on: fontBar.bl }" data-tip="粗体" @click="toggleStyle('bl')">B</button>
        <button type="button" class="fs-style-btn s" :class="{ on: fontBar.cl }" data-tip="删除线" @click="toggleStyle('cl')">S</button>
        <button type="button" class="fs-style-btn i" :class="{ on: fontBar.it }" data-tip="斜体" @click="toggleStyle('it')">I</button>
        <button type="button" class="fs-style-btn u" :class="{ on: fontBar.un }" data-tip="下划线" @click="toggleStyle('un')">U</button>
        <button type="button" class="fs-style-tint" data-tip="颜色" @click="openColorPicker('fc', $event.currentTarget)">
          <span class="fs-style-letter">
            A
            <i class="fs-style-bar" :style="{ background: fontBar.fc }" />
          </span>
          <i class="fs-caret" />
        </button>
        <button type="button" class="fs-style-tint" data-tip="填充" @click="openColorPicker('bg', $event.currentTarget)">
          <span class="fs-style-fill">
            <svg viewBox="0 0 19 18" width="16" height="16" aria-hidden="true">
              <path d="M8.651 0.495a.4.4 0 0 0-.424 0L7.59 1.131a.4.4 0 0 0 0 .424L8.085 2.05 3.136 7a.5.5 0 0 0 0 .707l4.95 4.95a.5.5 0 0 0 .707 0L14.45 7a.5.5 0 0 0 0-.707L8.651.495ZM9.146 3.11 12.682 6.646 12.328 7H5.257L9.146 3.11Z" fill="currentColor" />
              <path d="M15.146 12.965c.586-.647.586-1.696 0-2.343l-1.06-1.172-1.061 1.172c-.586.647-.586 1.696 0 2.343.586.647 1.536.647 2.121 0Z" fill="currentColor" />
            </svg>
            <i class="fs-style-bar" :style="{ background: fontBar.bg }" />
          </span>
          <i class="fs-caret" />
        </button>
      </div>
      <button type="button" class="fs-style-border" data-tip="边框" @click="openBorderPop($event.currentTarget)">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M2 4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Zm11 0v7h7V4h-7Zm-2 0H4v7h7V4Zm-7 9v7h7v-7H4Zm9 7h7v-7h-7v7Z" fill="currentColor"/></svg>
      </button>
    </div>
    <div
      v-if="!folded"
      class="fs-align-cluster"
      :style="{ left: `${alignBar.left}px`, top: `${alignBar.top}px` }"
      @mousedown.stop
    >
      <div class="fs-align-grid">
        <button type="button" class="fs-align-btn" :class="{ on: alignBar.tb === 0 }" data-tip="溢出" @click="applyAlign('tb', 0)">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2 3.2h8.2v1.4H2V3.2Zm0 4.1h6.2v1.4H2V7.3Zm0 4.1h12v1.4H2v-1.4Z" fill="currentColor"/><path d="M11.1 3.1 15 5.5l-3.9 2.4V3.1Z" fill="currentColor"/></svg>
        </button>
        <button type="button" class="fs-align-btn" :class="{ on: alignBar.tb === 2 }" data-tip="自动换行" @click="applyAlign('tb', 2)">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4.2 4.2h7.6v7.6H4.2V4.2Zm1.2 1.2v5.2h5.2V5.4H5.4Z" fill="currentColor"/><path d="M2.2 2.2h2.2v1.3H3.5v1.1H2.2V2.2Zm9.4 0h2.2v2.4h-1.3V3.5h-1.1V2.2ZM2.2 11.4h1.3v1.1h1.1v1.3H2.2v-2.4Zm10.3 1.1h1.1v-1.1h1.3v2.4h-2.4v-1.3Z" fill="currentColor"/></svg>
        </button>
        <button type="button" class="fs-align-btn" :class="{ on: alignBar.vt === 2 }" data-tip="底部对齐" @click="applyAlign('vt', 2)">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 12.4h10v1.4H3v-1.4ZM8 2.2v8.2" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M5.3 8.2 8 11l2.7-2.8" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button type="button" class="fs-align-btn" :class="{ on: alignBar.ht === 1 }" data-tip="左对齐" @click="applyAlign('ht', 1)">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2 3.2h12v1.4H2V3.2Zm0 4.1h8v1.4H2V7.3Zm0 4.1h12v1.4H2v-1.4Z" fill="currentColor"/></svg>
        </button>
        <button type="button" class="fs-align-btn" :class="{ on: alignBar.ht === 0 }" data-tip="居中对齐" @click="applyAlign('ht', 0)">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2 3.2h12v1.4H2V3.2Zm2.2 4.1h7.6v1.4H4.2V7.3ZM2 11.4h12v1.4H2v-1.4Z" fill="currentColor"/></svg>
        </button>
        <button type="button" class="fs-align-btn" :class="{ on: alignBar.ht === 2 }" data-tip="右对齐" @click="applyAlign('ht', 2)">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2 3.2h12v1.4H2V3.2Zm4 4.1h8v1.4H6V7.3ZM2 11.4h12v1.4H2v-1.4Z" fill="currentColor"/></svg>
        </button>
      </div>
      <button type="button" class="fs-align-merge" :class="{ on: alignBar.merge }" data-tip="合并单元格" @click="clickMerge">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2.2 3.2h3v1.3h-1.7v7h1.7v1.3h-3V3.2Zm8.6 0h3v10.9h-3v-1.3h1.7v-7h-1.7V3.2ZM6.1 7.1H2.8v1.8h3.3v1.2l2.2-2.1-2.2-2.1v1.2Zm3.8 1.8h3.3V7.1H9.9V5.9L7.7 8l2.2 2.1V8.9Z" fill="currentColor"/></svg>
        <span>合并单元格</span>
      </button>
    </div>
    <div
      v-if="!folded"
      class="fs-fmt-cluster"
      :style="{ left: `${fmtBar.left}px`, top: `${fmtBar.top}px` }"
      @mousedown.stop
    >
      <button type="button" class="fs-fmt-select" data-tip="格式" @click="openPop('numfmt', $event.currentTarget)">
        <span>{{ NUM_FMTS.find((item) => item.id === numFmt.id)?.short || '常规' }}</span>
        <i class="fs-caret" />
      </button>
      <div class="fs-fmt-bot">
        <button type="button" class="fs-fmt-btn" :class="{ on: numFmt.id === 'cny' || numFmt.id === 'cny-dec' }" data-tip="货币" @click="applyNumFmt(NUM_FMTS.find((item) => item.id === 'cny'))">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5.268 3.018a1 1 0 0 1 1.732-1l5 8.66 5-8.66a1 1 0 1 1 1.732 1l-4.52 7.83H17.5a1 1 0 0 1 0 2H13v2h4.5a1 1 0 0 1 0 2H13v5a1 1 0 0 1-2 0v-5H6.5a1 1 0 1 1 0-2H11v-2H6.5a1 1 0 1 1 0-2h3.289l-4.521-7.83Z" fill="currentColor"/></svg>
        </button>
        <button type="button" class="fs-fmt-btn" :class="{ on: numFmt.id === 'pct' || numFmt.id === 'pct-dec' }" data-tip="百分比" @click="applyNumFmt(NUM_FMTS.find((item) => item.id === 'pct'))">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M17.841 2.799a1 1 0 0 1 1.598 1.203l-13.24 17.57a1 1 0 0 1-1.597-1.203l13.24-17.57ZM7.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-2a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM21 17.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-2 0a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z" fill="currentColor"/></svg>
        </button>
        <button type="button" class="fs-fmt-btn" data-tip="增加小数位数" @click="clickPaint('number-increase')">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 5a4 4 0 1 1 8 0v4a4 4 0 0 1-8 0V5Zm6 0a2 2 0 1 0-4 0v4a2 2 0 1 0 4 0V5Zm10.665 13.349a.8.8 0 0 1 0 1.302l-4.824 3.445a.8.8 0 0 1-1.265-.65V20h-7a1 1 0 1 1 0-2h7v-2.445a.8.8 0 0 1 1.265-.652l4.824 3.446ZM19 1a4 4 0 0 0-4 4v4a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Zm2 8a2 2 0 1 1-4 0V5a2 2 0 1 1 4 0v4ZM3.5 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" fill="currentColor"/></svg>
        </button>
        <button type="button" class="fs-fmt-btn" data-tip="减少小数位数" @click="clickPaint('number-decrease')">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M10 1a4 4 0 0 0-4 4v4a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Zm2 8a2 2 0 1 1-4 0V5a2 2 0 1 1 4 0v4ZM8.911 19.651a.8.8 0 0 1 0-1.302l4.824-3.446a.8.8 0 0 1 1.265.652V18h7a1 1 0 1 1 0 2h-7v2.445a.8.8 0 0 1-1.265.651l-4.824-3.445ZM3.5 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" fill="currentColor"/></svg>
        </button>
      </div>
    </div>
    <div
      v-if="!folded"
      class="fs-data-cluster"
      :style="{ left: `${dataBar.left}px`, top: `${dataBar.top}px` }"
      @mousedown.stop
    >
      <button type="button" class="fs-data-item" :class="{ on: dataBar.freeze }" data-tip="冻结" @click="openFreezePop($event.currentTarget)">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M11 1a1 1 0 1 1 2 0v7h-2V1ZM1 3a1 1 0 0 1 2 0v18a1 1 0 1 1-2 0V3Zm12 20v-7h-2v7a1 1 0 1 0 2 0ZM5 12a1 1 0 0 1 1-1h11V8.555a.8.8 0 0 1 1.265-.651l4.824 3.445a.8.8 0 0 1 0 1.302l-4.824 3.445a.8.8 0 0 1-1.265-.65V13H6a1 1 0 0 1-1-1Z" fill="currentColor"/></svg>
        <span>冻结</span>
      </button>
      <button type="button" class="fs-data-item" :class="{ on: dataBar.filter }" data-tip="筛选" @click="clickData('筛选')">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M16 11.431V21a1 1 0 1 1-2 0V11c0-.147.032-.287.089-.412a.96.96 0 0 1 .4-.467L20 6.83V4H4v2.866l5.345 3.195A1 1 0 0 1 10 11v6.5a1 1 0 1 1-2 0v-6.035c-.477-.285-3.369-1.867-4.957-2.735A2 2 0 0 1 2 6.975V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2.945a2 2 0 0 1-1.035 1.752L16 11.43Z" fill="currentColor"/></svg>
        <span>筛选</span>
      </button>
      <button type="button" class="fs-data-item" data-tip="排序" @click="openPop('sort', $event.currentTarget)">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4.2 2.2h1.6l2.6 6.4H7.1l-.5-1.3H3.8l-.5 1.3H2Zm1.4 1.6L4.4 6.4h2.4L5.6 3.8Zm5.4-.2h1.3v7.3h2.1L11.3 14 8.2 10.9h2.8V3.6Z" fill="currentColor"/></svg>
        <span>排序</span>
      </button>
      <button type="button" class="fs-data-item" :class="{ on: dataBar.cf }" data-tip="条件格式" @click="openCfPop($event.currentTarget)">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 4v7h3V4H4Zm5 1.972L10.972 4H9v1.972ZM9 8.8v2.121l6-6V4h-1.2L9 8.8ZM17 4v7h3V4h-3Zm-2 5.871V7.75L11.75 11h2.121L15 9.871ZM15 13h-.3L9 18.7V20h.82L15 14.82V13Zm0 4.65L12.65 20H15v-2.35ZM17 20h3v-7h-3v7Zm-5.129-7H9.75l-.75.75v2.121L11.871 13ZM4 13v7h3v-7H4ZM2 4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Z" fill="currentColor"/></svg>
        <span>条件格式</span>
      </button>
      <button type="button" class="fs-data-item" data-tip="下拉列表" @click="clickData('下拉列表')">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 3.2h10v1.4H3V3.2Zm0 4.1h7.2v1.4H3V7.3Zm0 4.1h10v1.4H3v-1.4Zm9.2-4.8 1.8 2-1.8 2V6.6Z" fill="currentColor"/></svg>
        <span>下拉列表</span>
      </button>
      <button type="button" class="fs-data-item" data-tip="公式" @click="clickData('公式')">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.2 3.2h9.6v1.5H6.6L9.9 8 6.6 11.3h6.2v1.5H3.2v-1.2L7.3 8 3.2 4.4V3.2Z" fill="currentColor"/></svg>
        <span>公式</span>
      </button>
    </div>
    <button v-if="folded" type="button" class="fs-fold-sort" data-tip="排序" @mousedown.stop @click="openPop('sort', $event.currentTarget)">
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4.2 2.2h1.6l2.6 6.4H7.1l-.5-1.3H3.8l-.5 1.3H2Zm1.4 1.6L4.4 6.4h2.4L5.6 3.8Zm5.4-.2h1.3v7.3h2.1L11.3 14 8.2 10.9h2.8V3.6Z" fill="currentColor"/></svg>
    </button>
    <button v-if="folded" type="button" class="fs-fold-sort fs-fold-end fs-fold-comment" data-tip="评论" data-split="1" @mousedown.stop @click="openCtxDlg('comment', '添加批注', '')">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2h11A2.5 2.5 0 0 1 20 4.5v9A2.5 2.5 0 0 1 17.5 16H9.2L5 19.4V4.5Zm2.5-.5a.5.5 0 0 0-.5.5v11.2L9.8 14h7.7a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-11Z" fill="currentColor"/></svg>
      <i class="fs-split"></i>
    </button>
    <button v-if="folded" type="button" class="fs-fold-sort fs-fold-end fs-fold-find" data-tip="查找和替换" @mousedown.stop @click="openFindPop($event.currentTarget)">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.05l4.24 4.25-1.4 1.4-4.25-4.24A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" fill="currentColor"/></svg>
    </button>
    </Teleport>
    <button
      type="button"
      class="fs-fold"
      @mousedown.stop
      @click="folded = !folded; nextTick(() => requestAnimationFrame(() => { placeFontBar(hostRef.value); placeAlignBar(hostRef.value); placeFmtBar(hostRef.value); placeDataBar(hostRef.value) }))"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M6.3 9.2a1 1 0 0 1 1.4 0L12 13.5l4.3-4.3a1 1 0 1 1 1.4 1.4l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 0 1 0-1.4Z" fill="currentColor" />
      </svg>
    </button>
    <div
      v-if="filterPop.show"
      class="fs-filter"
      :style="{ left: `${filterPop.left}px`, top: `${filterPop.top}px` }"
      @mousedown.stop
    >
      <div class="fs-filter-sort">
        <button type="button" @click="sortFromFilter(true)">升序</button>
        <button type="button" @click="sortFromFilter(false)">降序</button>
      </div>
      <div class="fs-filter-tabs">
        <button type="button" :class="{ on: filterPop.tab === 'value' }" @click="filterPop.tab = 'value'">按值筛选</button>
        <button type="button" :class="{ on: filterPop.tab === 'cond' }" @click="filterPop.tab = 'cond'">按条件筛选</button>
      </div>
      <template v-if="filterPop.tab === 'value'">
        <label class="fs-filter-search">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M7 1.6a5.4 5.4 0 0 1 4.28 8.66l2.7 2.7-1 1-2.7-2.7A5.4 5.4 0 1 1 7 1.6Zm0 1.4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" fill="currentColor"/></svg>
          <input v-model="filterPop.query" placeholder="可使用空格分隔多个关键词">
        </label>
        <label class="fs-filter-all">
          <input type="checkbox" :checked="filterAllOn" @change="toggleFilterAll">
          <span>全选</span>
          <em>{{ filterCheckedCount }}</em>
        </label>
        <div class="fs-filter-list">
          <label v-for="item in filterView" :key="item.label" class="fs-filter-item">
            <input v-model="item.checked" type="checkbox">
            <span>{{ item.label }}</span>
            <em>{{ item.count }}</em>
          </label>
          <div v-if="!filterView.length" class="fs-filter-empty">没有可筛选的内容</div>
        </div>
      </template>
      <div v-else class="fs-filter-cond">
        <select v-model="filterPop.cond">
          <option value="contains">包含</option>
          <option value="eq">等于</option>
          <option value="ne">不等于</option>
          <option value="gt">大于</option>
          <option value="lt">小于</option>
          <option value="empty">为空</option>
          <option value="notEmpty">不为空</option>
        </select>
        <input v-if="filterPop.cond !== 'empty' && filterPop.cond !== 'notEmpty'" v-model="filterPop.condValue" placeholder="输入条件">
      </div>
      <div class="fs-filter-mine">
        <span>筛选结果仅我可见</span>
        <button type="button" class="fs-filter-switch" :class="{ on: filterPop.onlyMine }" @click="filterPop.onlyMine = !filterPop.onlyMine" />
      </div>
      <div class="fs-filter-foot">
        <button type="button" class="fs-filter-clear" @click="clearFilter">清除筛选</button>
        <button type="button" class="fs-filter-cancel" @click="filterPop.show = false">取消</button>
        <button type="button" class="fs-filter-ok" @click="applyFilter">确认</button>
      </div>
    </div>
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
      <template v-else-if="pop.kind === 'sort'">
        <button type="button" @click="applySort(true)">升序</button>
        <button type="button" @click="applySort(false)">降序</button>
      </template>
      <template v-else-if="pop.kind === 'numfmt'">
        <button
          v-for="item in NUM_FMTS"
          :key="item.id"
          type="button"
          class="fs-num"
          :class="{ on: numFmt.id === item.id }"
          @click="applyNumFmt(item)"
        >
          <span>{{ item.label }}</span>
          <em v-if="item.sample">{{ item.sample }}</em>
        </button>
        <button type="button" class="fs-num more" @click="pop.show = false">更多格式</button>
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
      :class="{ scale: cfState.fly === 'color' }"
      :style="{ top: `${cfState.flyY}px`, left: `${cfState.flyX}px` }"
      @mousedown.stop
      @mouseenter="showCfFly(cfState.fly)"
      @mouseleave="hideCfFly()"
    >
      <div v-if="cfState.fly === 'color'" class="fs-cf-scales">
        <button
          v-for="sub in CF_FLIES.color"
          :key="sub.id"
          type="button"
          :title="sub.label"
          @click="applyPreset(sub)"
        >
          <span class="fs-cf-scale" :style="{ background: `linear-gradient(90deg, ${sub.format.join(',')})` }" />
        </button>
      </div>
      <button
        v-for="sub in (cfState.fly === 'color' ? [] : CF_FLIES[cfState.fly])"
        :key="sub.id"
        type="button"
        @click="sub.id === 'other' ? openCfDialog('textContains', true) : sub.type ? applyPreset(sub) : openCfDialog(sub.id, cfState.fly === 'highlight' || cfState.fly === 'item')"
      >
        <span
          v-if="sub.format"
          class="fs-cf-swatch"
          :style="{ background: sub.format.length > 1 ? `linear-gradient(90deg, ${sub.format.join(',')})` : sub.format[0] }"
        />
        {{ sub.label }}
      </button>
    </div>
    <aside v-if="cfState.side && cfState.dlg" class="fs-cf-side" @mousedown.stop>
        <div class="fs-cf-side-head">
          <button v-if="cfState.panel === 'edit'" type="button" title="返回" @click="backCf">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
          <span>{{ cfState.panel === 'rules' ? '条件格式' : '条件格式设置' }}</span>
          <svg class="fs-cf-help" viewBox="0 0 24 24" width="16" height="16"><path :d="CF_HELP" fill="currentColor" /></svg>
          <button type="button" title="关闭" @click="cfState.dlg = ''; cfState.side = false">
            <svg viewBox="0 0 24 24" width="16" height="16"><path :d="FIND_CLOSE" fill="currentColor" /></svg>
          </button>
        </div>
        <div v-if="cfState.panel === 'rules'" class="fs-cf-side-body">
          <div class="fs-cf-manage">管理
            <span class="fs-cf-select">整张工作表</span>
            的规则
          </div>
          <button
            v-for="(rule, ri) in cfState.list"
            :key="ri"
            type="button"
            class="fs-cf-rule"
          >
            <span>
              <b>{{ cfRuleText(rule) }}</b>
              <em>{{ cfRuleRange(rule) }}</em>
            </span>
            <i :style="{ color: rule.format?.textColor || '#1f2329', background: rule.format?.cellColor || '#ffc7ce' }">123</i>
          </button>
          <button type="button" class="fs-cf-add" @click="openCfDialog('greaterThan', true)">+ 添加新的规则</button>
        </div>
        <div v-else class="fs-cf-side-body">
          <label class="fs-cf-field">应用范围
            <a-input v-model="cfForm.range" class="fs-cf-range">
              <template #suffix>
                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" fill="currentColor" /></svg>
              </template>
            </a-input>
          </label>
          <label class="fs-cf-field">样式类型
            <a-select :model-value="cfForm.kind" popup-container="body" :trigger-props="cfPopup" @change="onCfKind">
              <a-option v-for="item in CF_TYPES" :key="item.id" :value="item.id">{{ item.label }}</a-option>
            </a-select>
          </label>
          <div v-if="cfForm.kind === 'highlight'" class="fs-cf-field">符合以下条件时
            <a-select :model-value="cfForm.group" popup-container="body" :trigger-props="cfPopup" @change="onCfGroup">
              <a-option v-for="group in CF_GROUPS" :key="group.id" :value="group.id">{{ group.label }}</a-option>
            </a-select>
            <a-select v-if="CF_OPS[cfForm.group]?.length" :model-value="cfState.dlg" popup-container="body" :trigger-props="cfPopup" @change="cfState.dlg = $event">
              <a-option v-for="op in CF_OPS[cfForm.group]" :key="op.id" :value="op.id">{{ op.label }}</a-option>
            </a-select>
            <a-input v-if="cfForm.group === 'value' && cfState.dlg !== 'between'" v-model="cfForm.value" placeholder="请输入值" />
            <div v-if="cfState.dlg === 'between'" class="fs-cf-row">
              <a-input v-model="cfForm.value" placeholder="请输入值" />
              <span>到</span>
              <a-input v-model="cfForm.value2" placeholder="请输入值" />
            </div>
            <a-input v-if="cfForm.group === 'text'" v-model="cfForm.value" placeholder="请输入文本" />
            <a-date-picker v-if="cfForm.group === 'date'" v-model="cfForm.date" popup-container="body" :trigger-props="cfPopup" />
          </div>
          <div v-else class="fs-cf-field">样式规则
            <a-select :model-value="cfForm.rank" popup-container="body" :trigger-props="cfPopup" @change="(id) => { cfForm.rank = id; syncRankType() }">
              <a-option v-for="item in CF_RANKS" :key="item.id" :value="item.id">{{ item.label }}</a-option>
            </a-select>
            <div v-if="cfForm.rank === 'top' || cfForm.rank === 'last'" class="fs-cf-rank">
              <a-input v-model="cfForm.project" @change="syncRankType" />
              <a-checkbox v-model="cfForm.percent" @change="syncRankType">百分比</a-checkbox>
            </div>
          </div>
          <div class="fs-cf-field">格式样式
            <div
              class="fs-cf-preview"
              :style="{
                color: cfForm.textColor,
                background: cfForm.cellColor,
                fontWeight: cfForm.bl ? 700 : 400,
                fontStyle: cfForm.it ? 'italic' : 'normal',
                textDecoration: [cfForm.un ? 'underline' : '', cfForm.cl ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
              }"
            >样式预览</div>
            <div class="fs-cf-fmt">
              <button type="button" :class="{ on: cfForm.bl }" @click="cfForm.bl = !cfForm.bl"><b>B</b></button>
              <button type="button" :class="{ on: cfForm.it }" @click="cfForm.it = !cfForm.it"><i>I</i></button>
              <button type="button" :class="{ on: cfForm.un }" @click="cfForm.un = !cfForm.un"><u>U</u></button>
              <button type="button" :class="{ on: cfForm.cl }" @click="cfForm.cl = !cfForm.cl"><s>S</s></button>
              <button type="button" class="fs-cf-ink" title="字体颜色" @click="openColorPicker('cf-fc', $event.currentTarget, true)">
                A
                <i :style="{ background: cfForm.textColor }" />
              </button>
              <button type="button" class="fs-cf-fill" title="填充颜色" @click="openColorPicker('cf-bg', $event.currentTarget, true)">
                <i :style="{ background: cfForm.cellColor }" />
              </button>
            </div>
          </div>
        </div>
        <div v-if="cfState.panel !== 'rules'" class="fs-cf-side-foot">
          <a-button @click="cfState.dlg = ''; cfState.side = false">取消</a-button>
          <a-button type="primary" @click="confirmCfDialog">完成</a-button>
        </div>
    </aside>
    <div v-else-if="cfState.dlg" class="fs-cf-dlg" @mousedown.stop>
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
        <a-input v-if="CF_RULES[cfState.dlg]?.kind === 'value'" v-model="cfForm.value" />
        <a-input v-if="CF_RULES[cfState.dlg]?.kind === 'formula'" v-model="cfForm.formula" placeholder="=A1>10" />
        <div v-if="CF_RULES[cfState.dlg]?.kind === 'between'" class="fs-cf-row">
          <a-input v-model="cfForm.value" />
          <span>到</span>
          <a-input v-model="cfForm.value2" />
        </div>
        <a-date-picker v-if="CF_RULES[cfState.dlg]?.kind === 'date'" v-model="cfForm.date" popup-container="body" :trigger-props="cfPopup" />
        <a-select v-if="CF_RULES[cfState.dlg]?.kind === 'dup'" v-model="cfForm.repeat" popup-container="body" :trigger-props="cfPopup">
          <a-option value="0">重复值</a-option>
          <a-option value="1">唯一值</a-option>
        </a-select>
        <div v-if="['top','top%','last','last%'].includes(CF_RULES[cfState.dlg]?.kind)" class="fs-cf-row">
          <span>{{ CF_RULES[cfState.dlg]?.kind.startsWith('top') ? '前' : '后' }}</span>
          <a-input v-model="cfForm.project" />
          <span>{{ CF_RULES[cfState.dlg]?.kind.endsWith('%') ? '%' : '个' }}</span>
        </div>
        <div class="fs-cf-set">设置为：</div>
        <label class="fs-cf-check">
          <a-checkbox v-model="cfForm.textOn">文本颜色</a-checkbox>
          <button type="button" class="fs-cf-ink" title="字体颜色" @click="openColorPicker('cf-fc', $event.currentTarget, true)">
            <i :style="{ background: cfForm.textColor }" />
          </button>
        </label>
        <label class="fs-cf-check">
          <a-checkbox v-model="cfForm.cellOn">单元格颜色</a-checkbox>
          <button type="button" class="fs-cf-fill" title="填充颜色" @click="openColorPicker('cf-bg', $event.currentTarget, true)">
            <i :style="{ background: cfForm.cellColor }" />
          </button>
        </label>
        <div class="fs-cf-dlg-foot">
          <a-button type="primary" @click="confirmCfDialog">确定</a-button>
          <a-button @click="cfState.dlg = ''">取消</a-button>
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
    <div
      v-if="ctxMenu.show"
      class="fs-ctx"
      :style="{ left: `${ctxMenu.x}px`, top: `${ctxMenu.y}px` }"
      @mousedown.stop
      @contextmenu.prevent
    >
      <template v-for="(item, i) in CTX_ITEMS" :key="item.sep ? `sep-${i}` : item.id">
        <div v-if="item.sep" class="fs-ctx-sep" />
        <button
          v-else
          type="button"
          class="fs-ctx-item"
          @mouseenter="ctxMenu.fly = item.caret ? item.id : ''"
          @click="item.caret ? null : onCtxAction(item.id)"
        >
          <svg v-if="item.icon" class="fs-ctx-ico" viewBox="0 0 16 16" aria-hidden="true"><path :d="CTX_ICONS[item.icon]" fill="currentColor" /></svg>
          <span v-else class="fs-ctx-gap" />
          <span>{{ item.label }}</span>
          <b v-if="item.badge" class="fs-ctx-new">{{ item.badge }}</b>
          <em v-if="item.shortcut">{{ item.shortcut }}</em>
          <i v-else-if="item.caret">›</i>
          <div v-if="item.caret && ctxMenu.fly === item.id" class="fs-ctx-sub" @mousedown.stop>
            <template v-for="(sub, si) in item.children" :key="sub.sep ? `subsep-${si}` : sub.id">
              <div v-if="sub.sep" class="fs-ctx-sep" />
              <button v-else type="button" @click="onCtxAction(sub.id)">{{ sub.label }}</button>
            </template>
          </div>
        </button>
      </template>
    </div>
    <div v-if="ctxDlg.show" class="fs-ctx-dlg" @mousedown.stop>
      <div class="fs-ctx-dlg-title">{{ ctxDlg.title }}</div>
      <div v-if="ctxDlg.lines.length" class="fs-ctx-dlg-lines">
        <div v-for="(line, i) in ctxDlg.lines" :key="i">{{ line }}</div>
      </div>
      <a-input v-else-if="ctxDlg.mode !== 'detail'" v-model="ctxDlg.text" @keydown.enter="confirmCtxDlg" />
      <div class="fs-ctx-dlg-foot">
        <a-button v-if="ctxDlg.mode === 'detail' || ctxDlg.mode === 'history'" type="primary" @click="ctxDlg.show = false">关闭</a-button>
        <template v-else>
          <a-button @click="ctxDlg.show = false">取消</a-button>
          <a-button type="primary" @click="confirmCtxDlg">确定</a-button>
        </template>
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
    <Teleport to="body">
      <div
        v-if="fsTip.show"
        class="fs-tip"
        :style="{ left: `${fsTip.left}px`, top: `${fsTip.top}px` }"
      >{{ fsTip.text }}</div>
    </Teleport>
  </div>
</template>
