<script setup>
import { createElement, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { handleBorder, handleFormulaInput } from '@fortune-sheet/core'
import { Workbook } from '@fortune-sheet/react'
import { Message, Modal } from '@arco-design/web-vue'
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { colLetter, fortuneToUniver, paintWorkbookThumb, univerToFortune, xlsxToUniver } from '../utils/workbook'
import { formatByCode } from '../utils/numfmt'
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
import {
  CF_ICON_DARK,
  CF_ICON_GRAY,
  CF_ICON_GREEN,
  CF_ICON_RED,
  CF_ICON_STAR,
  CF_ICON_YELLOW,
  cfIconGlyphHtml,
  cfIconGlyphs,
  cfIconSvg,
  cfPieSvg,
  cfSignalSvg,
} from '../utils/cf-icons'
import ColorPop from './ColorPop.vue'
import '@fortune-sheet/react/dist/index.css'

const props = defineProps({
  readonly: { type: Boolean, default: false },
  tableType: { type: String, default: '' },
  // 混合表：屏蔽 fortune 原生单元格右键菜单，改由父组件渲染自定义菜单（cellcontext 事件）
  suppressCellMenu: { type: Boolean, default: false },
})
const emit = defineEmits(['pivot', 'chart', 'cellhover', 'cellclick', 'celldblclick', 'cellcontext', 'mx-insert', 'pivot-config'])

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
  垂直对齐: '垂直对齐',
  文本换行: '文本换行',
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
const linkPop = reactive({
  show: false,
  left: 0,
  top: 0,
  text: '',
  address: '',
  type: 'webpage',
  sheetsOpen: false,
  picking: false,
  row: 0,
  col: 0,
  sheetId: '',
})
const linkBar = reactive({
  show: false,
  left: 0,
  top: 0,
  r: -1,
  c: -1,
  sheetId: '',
  type: 'webpage',
  address: '',
})
let linkBarTimer = 0
let linkArmed = ''
let locationLinkApplied = false
const freezeInfo = reactive({ row: 0, col: 0, letter: 'A' })
const colorPop = reactive({ show: false, kind: 'fc', key: '', origin: '#1f2329', left: 0, top: 0 })
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
  scaleOpen: false,
  scaleX: 0,
  scaleY: 0,
  scaleW: 292,
  kindOpen: false,
  kindX: 0,
  kindY: 0,
  kindW: 292,
  pickingRange: false,
  ruleScope: 'sel',
  scopeOpen: false,
  scopeX: 0,
  scopeY: 0,
  scopeW: 160,
})
const CF_RULE_SCOPES = [
  { id: 'sel', label: '所选单元格' },
  { id: 'sheet', label: '整张工作表' },
]
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
const FONT_NAMES = [
  { key: 'default', id: '微软雅黑', label: '默认字体', family: '"微软雅黑", "Microsoft YaHei", sans-serif' },
  { key: 'harmony', id: 'HarmonyOS Sans SC', label: '华为鸿蒙字体', family: '"HarmonyOS Sans SC", "华为鸿蒙字体", sans-serif' },
  { key: 'alibaba', id: '阿里巴巴普惠体', label: '阿里巴巴普惠体', family: '"阿里巴巴普惠体", sans-serif' },
  { key: 'pingfang', id: 'PingFang SC', label: '苹方（简体）', family: '"PingFang SC", "苹方-简", "Microsoft YaHei", sans-serif' },
  { key: 'arial', id: 'Arial', label: 'Arial', family: 'Arial, Helvetica, sans-serif' },
  { key: 'arial-black', id: 'Arial Black', label: 'Arial Black', family: '"Arial Black", Gadget, sans-serif' },
  { key: 'arial-narrow', id: 'Arial Narrow', label: 'Arial Narrow', family: '"Arial Narrow", Arial, sans-serif' },
  { key: 'courier', id: 'Courier New', label: 'Courier New', family: '"Courier New", Courier, monospace' },
  { key: 'comic', id: 'Comic Sans MS', label: 'Comic Sans MS', family: '"Comic Sans MS", "Comic Sans", cursive' },
  { key: 'georgia', id: 'Georgia', label: 'Georgia', family: 'Georgia, serif' },
  { key: 'impact', id: 'Impact', label: 'Impact', family: 'Impact, Charcoal, sans-serif' },
  { key: 'tahoma', id: 'Tahoma', label: 'Tahoma', family: 'Tahoma, Geneva, sans-serif' },
  { key: 'times', id: 'Times New Roman', label: 'Times New Roman', family: '"Times New Roman", Times, serif' },
  { key: 'verdana', id: 'Verdana', label: 'Verdana', family: 'Verdana, Geneva, sans-serif' },
  { key: 'calibri', id: 'Calibri', label: 'Calibri', family: 'Calibri, Candara, Segoe, sans-serif' },
  { key: 'cambria', id: 'Cambria', label: 'Cambria', family: 'Cambria, Georgia, serif' },
  { key: 'consolas', id: 'Consolas', label: 'Consolas', family: 'Consolas, "Courier New", monospace' },
  { key: 'dengxian', id: '等线', label: '等线', family: 'DengXian, "Microsoft YaHei", sans-serif' },
  { key: 'yahei', id: '微软雅黑', label: '微软雅黑', family: '"微软雅黑", "Microsoft YaHei", sans-serif' },
  { key: 'fangsong', id: '仿宋', label: '仿宋', family: 'FangSong, "STFangsong", serif' },
  { key: 'kaiti', id: '楷体', label: '楷体', family: 'KaiTi, "STKaiti", serif' },
  { key: 'simsun', id: '宋体', label: '宋体', family: 'SimSun, "Songti SC", serif' },
  { key: 'simhei', id: '黑体', label: '黑体', family: 'SimHei, "Heiti SC", sans-serif' },
]
const FONT_SIZES = [9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]
const fontMenu = reactive({
  open: false,
  query: '',
  left: 0,
  top: 0,
})
const fontBar = reactive({
  show: false,
  name: '微软雅黑',
  key: 'default',
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
const fontLabel = computed(() => {
  const hit = FONT_NAMES.find((f) => f.key === fontBar.key)
    || FONT_NAMES.find((f) => f.id === fontBar.name)
  return hit?.label || fontBar.name || '默认字体'
})
const fontFamilyPreview = computed(() => {
  const hit = FONT_NAMES.find((f) => f.key === fontBar.key)
    || FONT_NAMES.find((f) => f.id === fontBar.name)
  return hit?.family || '"微软雅黑", "Microsoft YaHei", sans-serif'
})
const filteredFonts = computed(() => {
  const q = fontMenu.query.trim().toLowerCase()
  if (!q) return FONT_NAMES
  return FONT_NAMES.filter((f) => f.label.toLowerCase().includes(q) || f.id.toLowerCase().includes(q))
})
const alignBar = reactive({
  show: false,
  left: 0,
  top: 0,
  ht: 1,
  vt: 0,
  tb: 1,
  merge: false,
})
const alignPop = reactive({ show: false, left: 0, top: 0 })
const wrapPop = reactive({ show: false, left: 0, top: 0 })
const vtPop = reactive({ show: false, left: 0, top: 0 })
const stylePop = reactive({ show: false, left: 0, top: 0 })
const STYLE_OPTS = [
  { attr: 'bl', label: '加粗', cls: 'b', letter: 'B' },
  { attr: 'un', label: '下划线', cls: 'u', letter: 'U' },
  { attr: 'it', label: '斜体', cls: 'i', letter: 'I' },
  { attr: 'cl', label: '删除线', cls: 's', letter: 'S' },
]
const HT_OPTS = [
  {
    id: 1,
    label: '向左对齐',
    path: 'M2 3.2h12v1.4H2V3.2Zm0 4.1h8v1.4H2V7.3Zm0 4.1h12v1.4H2v-1.4Z',
  },
  {
    id: 0,
    label: '居中对齐',
    path: 'M2 3.2h12v1.4H2V3.2Zm2.2 4.1h7.6v1.4H4.2V7.3ZM2 11.4h12v1.4H2v-1.4Z',
  },
  {
    id: 2,
    label: '向右对齐',
    path: 'M2 3.2h12v1.4H2V3.2Zm4 4.1h8v1.4H6V7.3ZM2 11.4h12v1.4H2v-1.4Z',
  },
]
const TB_OPTS = [
  {
    id: 1,
    label: '溢出',
    path: 'M2 3.2h7v1.4H2V3.2Zm0 4.1h6v1.4H2V7.3Zm0 4.1h12v1.4H2v-1.4ZM9.2 2.5h1.2v6.2H9.2V2.5Zm1.6 1.5 3.6 1.6-3.6 1.6V4Z',
  },
  {
    id: 0,
    label: '截断',
    path: 'M2 3.2h7v1.4H2V3.2Zm0 4.1h7v1.4H2V7.3Zm0 4.1h5.2v1.4H2v-1.4ZM9.8 2.5h1.2v11H9.8V2.5Z',
  },
  {
    id: 2,
    label: '自动换行',
    path: 'M2 3.2h7.5v1.4H2V3.2Zm0 4.1h5v1.4H2V7.3ZM8.8 2.5h1.3v7.2c0 1.2.9 2.1 2.1 2.1H14v1.3h-1.8a3.4 3.4 0 0 1-3.4-3.4V2.5Zm3.6 7.6 2.2 2.2-2.2 2.2V10.1Z',
  },
]
const VT_OPTS = [
  {
    id: 1,
    label: '顶部对齐',
    path: 'M3 2.4h10v1.4H3V2.4ZM7.3 5.2h1.4v7.8H7.3V5.2Zm-2.5 3.2 3.2-3.2 3.2 3.2H4.8Z',
  },
  {
    id: 0,
    label: '垂直居中',
    path: 'M4.2 6.5h7.6v1.3H4.2V6.5Zm0 1.7h7.6v1.3H4.2V8.2ZM7.3 2.4h1.4v3.2H7.3V2.4Zm0 8h1.4v3.2H7.3V10.4ZM5.2 4.8 8 2.6l2.8 2.2H5.2Zm0 6.4h5.6L8 13.4 5.2 11.2Z',
  },
  {
    id: 2,
    label: '底部对齐',
    path: 'M3 12.2h10v1.4H3v-1.4ZM7.3 2.6h1.4v7.8H7.3V2.6Zm-2.5 4.6h5.6L8 10.4 4.8 7.2Z',
  },
]
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
const filterRules = new Map()
const filterMenu = reactive({ show: false, left: 0, top: 0 })
const FILTER_NUM_OPS = [
  ['eq', '等于'],
  ['ne', '不等于'],
  ['gt', '大于'],
  ['gte', '大于或等于'],
  ['lt', '小于'],
  ['lte', '小于或等于'],
  ['between', '介于'],
  ['empty', '为空'],
  ['notEmpty', '不为空'],
]
const FILTER_TEXT_OPS = [
  ['eq', '等于'],
  ['ne', '不等于'],
  ['starts', '开头是'],
  ['ends', '结尾是'],
  ['contains', '包含'],
  ['notContains', '不包含'],
  ['empty', '为空'],
  ['notEmpty', '不为空'],
]
const FILTER_DATE_OPS = [
  ['eq', '等于'],
  ['before', '早于'],
  ['after', '晚于'],
  ['between', '介于'],
  ['empty', '为空'],
  ['notEmpty', '不为空'],
]
const filterPop = reactive({
  show: false,
  left: 0,
  top: 0,
  tab: 'value',
  query: '',
  addTo: false,
  onlyMine: false,
  col: 0,
  header: 0,
  c0: 0,
  c1: 0,
  r0: 1,
  r1: 1,
  items: [],
  kind: 'text',
  cond: 'contains',
  condValue: '',
  condValue2: '',
  bgColors: [],
  fcColors: [],
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
const FMT_CATS = [
  { id: 'general', label: '常规', hint: '常规单元格格式不包含任何特定的数字格式。' },
  { id: 'number', label: '数值', hint: '数值格式用于一般数字的表示。' },
  { id: 'currency', label: '货币', hint: '货币格式用于表示一般货币数值。' },
  { id: 'accounting', label: '会计专用', hint: '会计格式可对一列数值进行货币符号和小数点对齐。' },
  { id: 'date', label: '日期', hint: '日期格式将日期和时间序列数显示为日期值。' },
  { id: 'time', label: '时间', hint: '时间格式将日期和时间序列数显示为时间值。' },
  { id: 'percent', label: '百分比', hint: '百分比格式将单元格中的数值乘以 100，并以百分数形式显示。' },
  { id: 'fraction', label: '分数', hint: '分数格式以分数形式显示数字。' },
  { id: 'sci', label: '科学记数', hint: '科学记数格式以指数形式显示数字。' },
  { id: 'text', label: '文本', hint: '在文本格式中，单元格内容按文本处理，输入的内容与显示的内容一致。' },
  { id: 'special', label: '特殊', hint: '特殊格式可用于跟踪数据列表及数据库的值。' },
  { id: 'custom', label: '自定义', hint: '以现有格式为基础，生成自定义的数字格式。' },
]
const FMT_PREVIEW_AT = new Date(2017, 7, 1, 13, 14, 25)
const FMT_DATES = [
  'yyyy-MM-dd',
  'yyyy/MM/dd',
  'yyyy年m月d日',
  'yyyy年m月d日 aaaa',
  'MM-dd',
  'm月d日',
  'aaaa',
  'aaa',
]
const FMT_TIMES = [
  'hh:mm:ss',
  'h:mm',
  'yyyy-MM-dd hh:mm:ss',
  'h:mm 上午/下午',
  'hh:mm AM/PM',
]
const FMT_CUSTOM = [
  'G/通用格式',
  '0.00',
  '#,##0.00',
  '0.00%',
  '0.00E+00',
  '0"."0,"万元"',
  '0!.0000,"万元"',
  '0,,.00"百万"',
  'yyyy-MM-dd',
  'yyyy年m月d日 aaaa',
  'h:mm 上午/下午',
  '000-0000-0000',
  '@"部门"',
  '# "个"',
  '"🔺"#;"🔻"#',
]
const fmtDlg = reactive({
  show: false,
  tab: 'number',
  cat: 'general',
  decimals: 2,
  thousand: true,
  symbol: '¥',
  dateFa: 'yyyy-MM-dd',
  timeFa: 'hh:mm:ss',
  custom: 'General',
  raw: '',
  ht: '1',
  vt: '0',
  wrap: false,
  font: '默认字体',
  size: 10,
  bold: false,
  color: '#1f2329',
  border: '',
  fill: '',
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
  range: 'A1',
  group: 'value',
  kind: 'highlight',
  rank: 'top',
  percent: false,
  bl: false,
  it: false,
  un: false,
  cl: false,
  style: 0,
  presetId: '',
  scaleStops: [],
})
const CF_SCALE_GREEN = 'rgb(108, 191, 99)'
const CF_SCALE_YELLOW = 'rgb(250, 234, 97)'
const CF_SCALE_RED = 'rgb(237, 123, 119)'
const CF_SCALE_WHITE = 'rgb(255, 255, 255)'
const CF_SCALE_STOP_TYPES = [
  { id: 'min', label: '最低值' },
  { id: 'max', label: '最高值' },
  { id: 'num', label: '数字' },
  { id: 'percent', label: '百分比' },
  { id: 'percentile', label: '百分点值' },
]
const CF_TYPES = [
  { id: 'highlight', label: '突出显示单元格' },
  { id: 'item', label: '最前、最后、平均值' },
  { id: 'formula', label: '自定义公式为' },
  { id: 'color', label: '色阶' },
  { id: 'bar', label: '数据条' },
  { id: 'icons', label: '图标集' },
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
  { id: 'item', label: '最前、最后、平均值', caret: true },
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
  // format：低→高；label / 预览按高→低（与飞书一致）
  color: [
    { id: 'cg-gw', group: 'two', type: 'colorGradation', format: [CF_SCALE_WHITE, CF_SCALE_GREEN], label: '绿 - 白' },
    { id: 'cg-wg', group: 'two', type: 'colorGradation', format: [CF_SCALE_GREEN, CF_SCALE_WHITE], label: '白 - 绿' },
    { id: 'cg-rw', group: 'two', type: 'colorGradation', format: [CF_SCALE_WHITE, CF_SCALE_RED], label: '红 - 白' },
    { id: 'cg-wr', group: 'two', type: 'colorGradation', format: [CF_SCALE_RED, CF_SCALE_WHITE], label: '白 - 红' },
    { id: 'cg-yw', group: 'two', type: 'colorGradation', format: [CF_SCALE_WHITE, CF_SCALE_YELLOW], label: '黄 - 白' },
    { id: 'cg-wy', group: 'two', type: 'colorGradation', format: [CF_SCALE_YELLOW, CF_SCALE_WHITE], label: '白 - 黄' },
    { id: 'cg-gy', group: 'two', type: 'colorGradation', format: [CF_SCALE_YELLOW, CF_SCALE_GREEN], label: '绿 - 黄' },
    { id: 'cg-yg', group: 'two', type: 'colorGradation', format: [CF_SCALE_GREEN, CF_SCALE_YELLOW], label: '黄 - 绿' },
    { id: 'cg-gwr', group: 'three', type: 'colorGradation', format: [CF_SCALE_RED, CF_SCALE_WHITE, CF_SCALE_GREEN], label: '绿 - 白 - 红' },
    { id: 'cg-rwg', group: 'three', type: 'colorGradation', format: [CF_SCALE_GREEN, CF_SCALE_WHITE, CF_SCALE_RED], label: '红 - 白 - 绿' },
    { id: 'cg-gyr', group: 'three', type: 'colorGradation', format: [CF_SCALE_RED, CF_SCALE_YELLOW, CF_SCALE_GREEN], label: '绿 - 黄 - 红' },
    { id: 'cg-ryg', group: 'three', type: 'colorGradation', format: [CF_SCALE_GREEN, CF_SCALE_YELLOW, CF_SCALE_RED], label: '红 - 黄 - 绿' },
  ],
  bar: [
    { id: 'dbg1', type: 'dataBar', format: ['#638ec6', '#ffffff'], label: '蓝色数据条', group: 'gradient' },
    { id: 'dbg2', type: 'dataBar', format: ['#63c384', '#ffffff'], label: '绿色数据条', group: 'gradient' },
    { id: 'dbg3', type: 'dataBar', format: ['#ff555a', '#ffffff'], label: '红色数据条', group: 'gradient' },
    { id: 'dbg4', type: 'dataBar', format: ['#ffb628', '#ffffff'], label: '橙色数据条', group: 'gradient' },
    { id: 'dbg5', type: 'dataBar', format: ['#00b0f0', '#ffffff'], label: '浅蓝色数据条', group: 'gradient' },
    { id: 'dbg6', type: 'dataBar', format: ['#d60093', '#ffffff'], label: '紫色数据条', group: 'gradient' },
    { id: 'dbs1', type: 'dataBar', format: ['#638ec6'], label: '蓝色数据条', group: 'solid' },
    { id: 'dbs2', type: 'dataBar', format: ['#63c384'], label: '绿色数据条', group: 'solid' },
    { id: 'dbs3', type: 'dataBar', format: ['#ff555a'], label: '红色数据条', group: 'solid' },
    { id: 'dbs4', type: 'dataBar', format: ['#ffb628'], label: '橙色数据条', group: 'solid' },
    { id: 'dbs5', type: 'dataBar', format: ['#00b0f0'], label: '浅蓝色数据条', group: 'solid' },
    { id: 'dbs6', type: 'dataBar', format: ['#d60093'], label: '紫色数据条', group: 'solid' },
  ],
  icons: [
    // 预览顺序对齐飞书（低→高从左到右）；marks/format 仍按高→低供单元格着色
    {
      id: 'ic-a3', type: 'icons', group: '方向', label: '三向箭头（彩色）',
      marks: ['↑', '→', '↓'], format: [CF_ICON_GREEN, CF_ICON_YELLOW, CF_ICON_RED],
      preview: [
        { kind: 'arrowDown', color: CF_ICON_RED },
        { kind: 'arrowRight', color: CF_ICON_YELLOW },
        { kind: 'arrowUp', color: CF_ICON_GREEN },
      ],
    },
    {
      id: 'ic-a3g', type: 'icons', group: '方向', label: '三向箭头（灰色）',
      marks: ['↑', '→', '↓'], format: [CF_ICON_GRAY, CF_ICON_GRAY, CF_ICON_GRAY],
      preview: [
        { kind: 'arrowUp', color: CF_ICON_GRAY },
        { kind: 'arrowRight', color: CF_ICON_GRAY },
        { kind: 'arrowDown', color: CF_ICON_GRAY },
      ],
    },
    {
      id: 'ic-t3', type: 'icons', group: '方向', label: '三角旗',
      marks: ['▲', '▬', '▼'], format: [CF_ICON_GREEN, CF_ICON_YELLOW, CF_ICON_RED],
      preview: [
        { kind: 'triDown', color: CF_ICON_RED },
        { kind: 'bar', color: CF_ICON_YELLOW },
        { kind: 'triUp', color: CF_ICON_GREEN },
      ],
    },
    {
      id: 'ic-a4g', type: 'icons', group: '方向', label: '四向箭头（灰色）',
      marks: ['↑', '↗', '↘', '↓'], format: [CF_ICON_GRAY, CF_ICON_GRAY, CF_ICON_GRAY, CF_ICON_GRAY],
      preview: [
        { kind: 'arrowUp', color: CF_ICON_GRAY },
        { kind: 'arrowUpRight', color: CF_ICON_GRAY },
        { kind: 'arrowDownRight', color: CF_ICON_GRAY },
        { kind: 'arrowDown', color: CF_ICON_GRAY },
      ],
    },
    {
      id: 'ic-a4', type: 'icons', group: '方向', label: '四向箭头（彩色）',
      marks: ['↑', '↗', '↘', '↓'], format: [CF_ICON_GREEN, CF_ICON_YELLOW, CF_ICON_YELLOW, CF_ICON_RED],
      preview: [
        { kind: 'arrowDown', color: CF_ICON_RED },
        { kind: 'arrowDownRight', color: CF_ICON_YELLOW },
        { kind: 'arrowUpRight', color: CF_ICON_YELLOW },
        { kind: 'arrowUp', color: CF_ICON_GREEN },
      ],
    },
    {
      id: 'ic-a5g', type: 'icons', group: '方向', label: '五向箭头（灰色）',
      marks: ['↑', '↗', '→', '↘', '↓'], format: [CF_ICON_GRAY, CF_ICON_GRAY, CF_ICON_GRAY, CF_ICON_GRAY, CF_ICON_GRAY],
      preview: [
        { kind: 'arrowUp', color: CF_ICON_GRAY },
        { kind: 'arrowUpRight', color: CF_ICON_GRAY },
        { kind: 'arrowRight', color: CF_ICON_GRAY },
        { kind: 'arrowDownRight', color: CF_ICON_GRAY },
        { kind: 'arrowDown', color: CF_ICON_GRAY },
      ],
    },
    {
      id: 'ic-a5', type: 'icons', group: '方向', label: '五向箭头（彩色）', alone: true,
      marks: ['↑', '↗', '→', '↘', '↓'], format: [CF_ICON_GREEN, CF_ICON_YELLOW, CF_ICON_YELLOW, CF_ICON_YELLOW, CF_ICON_RED],
      preview: [
        { kind: 'arrowDown', color: CF_ICON_RED },
        { kind: 'arrowDownRight', color: CF_ICON_YELLOW },
        { kind: 'arrowRight', color: CF_ICON_YELLOW },
        { kind: 'arrowUpRight', color: CF_ICON_YELLOW },
        { kind: 'arrowUp', color: CF_ICON_GREEN },
      ],
    },
    {
      id: 'ic-c3', type: 'icons', group: '形状', label: '三色交通灯（无框）',
      marks: ['●', '●', '●'], format: [CF_ICON_GREEN, CF_ICON_YELLOW, CF_ICON_RED],
      preview: [
        { kind: 'circle', color: CF_ICON_RED },
        { kind: 'circle', color: CF_ICON_YELLOW },
        { kind: 'circle', color: CF_ICON_GREEN },
      ],
    },
    {
      id: 'ic-c3b', type: 'icons', group: '形状', label: '三色交通灯（有框）',
      marks: ['⬤', '⬤', '⬤'], format: [CF_ICON_GREEN, CF_ICON_YELLOW, CF_ICON_RED],
      preview: [
        { kind: 'circleRim', color: CF_ICON_RED },
        { kind: 'circleRim', color: CF_ICON_YELLOW },
        { kind: 'circleRim', color: CF_ICON_GREEN },
      ],
    },
    {
      id: 'ic-c4', type: 'icons', group: '形状', label: '四色交通灯',
      marks: ['●', '●', '●', '●'], format: [CF_ICON_GREEN, CF_ICON_YELLOW, CF_ICON_RED, CF_ICON_GRAY],
      preview: [
        { kind: 'circle', color: CF_ICON_GRAY },
        { kind: 'circle', color: CF_ICON_RED },
        { kind: 'circle', color: CF_ICON_YELLOW },
        { kind: 'circle', color: CF_ICON_GREEN },
      ],
    },
    {
      id: 'ic-c5', type: 'icons', group: '形状', label: '五色交通灯',
      marks: ['●', '●', '●', '●', '●'], format: [CF_ICON_GREEN, CF_ICON_YELLOW, CF_ICON_RED, CF_ICON_GRAY, CF_ICON_DARK],
      preview: [
        { kind: 'circle', color: CF_ICON_DARK },
        { kind: 'circle', color: CF_ICON_GRAY },
        { kind: 'circle', color: CF_ICON_RED },
        { kind: 'circle', color: CF_ICON_YELLOW },
        { kind: 'circle', color: CF_ICON_GREEN },
      ],
    },
    {
      id: 'ic-x2', type: 'icons', group: '标记', label: '对错',
      marks: ['✓', '✕'], format: [CF_ICON_GREEN, CF_ICON_RED],
      preview: [
        { kind: 'cross', color: CF_ICON_RED },
        { kind: 'check', color: CF_ICON_GREEN },
      ],
    },
    {
      id: 'ic-m3c', type: 'icons', group: '标记', label: '三符号（有圆圈）',
      marks: ['✓', '!', '✕'], format: [CF_ICON_GREEN, CF_ICON_YELLOW, CF_ICON_RED],
      preview: [
        { kind: 'cross', color: CF_ICON_RED },
        { kind: 'bang', color: CF_ICON_YELLOW },
        { kind: 'check', color: CF_ICON_GREEN },
      ],
    },
    {
      id: 'ic-f2', type: 'icons', group: '标记', label: '双色旗',
      marks: ['⚑', '⚑'], format: [CF_ICON_GREEN, CF_ICON_RED],
      preview: [
        { kind: 'flag', color: CF_ICON_RED },
        { kind: 'flag', color: CF_ICON_GREEN },
      ],
    },
    {
      id: 'ic-f3', type: 'icons', group: '标记', label: '三色旗',
      marks: ['⚑', '⚑', '⚑'], format: [CF_ICON_GREEN, CF_ICON_YELLOW, CF_ICON_RED],
      preview: [
        { kind: 'flag', color: CF_ICON_RED },
        { kind: 'flag', color: CF_ICON_YELLOW },
        { kind: 'flag', color: CF_ICON_GREEN },
      ],
    },
    {
      id: 'ic-st3', type: 'icons', group: '等级', label: '三星',
      marks: ['★', '★', '☆'], format: [CF_ICON_STAR, CF_ICON_STAR, '#d9d9d9'],
      preview: [
        { kind: 'starEmpty', color: CF_ICON_GRAY },
        { kind: 'starEmpty', color: CF_ICON_GRAY },
        { kind: 'star', color: CF_ICON_STAR },
      ],
    },
    {
      id: 'ic-b3', type: 'icons', group: '等级', label: '三格信号',
      marks: ['▂', '▃', '█'], format: ['#3370ff', '#3370ff', CF_ICON_RED],
      preview: 'signal3',
    },
    {
      id: 'ic-h3', type: 'icons', group: '等级', label: '三象限图',
      marks: ['●', '◑', '○'], format: [CF_ICON_DARK, CF_ICON_DARK, CF_ICON_DARK],
      preview: 'pie3',
    },
    {
      id: 'ic-h5', type: 'icons', group: '等级', label: '五象限图',
      marks: ['●', '◕', '◑', '◔', '○'], format: [CF_ICON_DARK, CF_ICON_DARK, CF_ICON_DARK, CF_ICON_DARK, CF_ICON_DARK],
      preview: 'pie5',
    },
  ],
}
const CF_ICON_GROUPS = ['方向', '形状', '标记', '等级']

function iconPreviewHtml(sub) {
  if (sub.preview === 'signal3') {
    return [1, 2, 3].map((n) => cfSignalSvg(n, 3)).join('')
  }
  if (sub.preview === 'pie3') {
    return [0, 2, 4].map((n) => cfPieSvg(n)).join('')
  }
  if (sub.preview === 'pie5') {
    return [0, 1, 2, 3, 4].map((n) => cfPieSvg(n)).join('')
  }
  if (Array.isArray(sub.preview)) {
    return sub.preview.map((item) => cfIconSvg(item.kind, item.color)).join('')
  }
  return (sub.marks || []).map((mark, i) => {
    const color = sub.format?.[i] || sub.format?.[0] || '#1f2329'
    return `<i style="color:${color}">${mark}</i>`
  }).join('')
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
let filterIconObs = null
let filterIconFrame = 0
let freezeClickBound = false
const dataBarStore = new Map()
let barDrawTimer = 0
let barHideBusy = false

function sheetBarKey(sheet) {
  return String(sheet?.id || sheet?.name || 'sheet-1')
}
function barRulesOf(sheet) {
  // 活 sheet 上的权威值优先（撤销/重做会整体回滚 config），本地 Map 仅作兜底
  const cfg = sheet?.config?.fs_data_bars
  if (Array.isArray(cfg)) return cfg
  const root = sheet?.fs_data_bars
  if (Array.isArray(root)) return root
  const key = sheetBarKey(sheet)
  if (dataBarStore.has(key)) return dataBarStore.get(key) || []
  return []
}

// ---- 撤销桥 -------------------------------------------------------------
// fortune-sheet 的 api.applyOp 内部走 noHistory，改动不进撤销栈（边框、
// 条件格式、数据条、下拉列表、sheet 标签操作等全部撤不了）。这里在调用
// 前算出「反向补丁」，调用后把 {patches, inversePatches} 推进 Workbook
// 内部的 undoList，结构与包内 setContextWithProduce 生成的历史条目一致，
// 从而让 Cmd+Z / 工具栏撤销按钮 / 重做全链路生效。
function reactStateBy(matcher) {
  const box = hostRef.value?.querySelector?.('.fortune-box')
  if (!box) return null
  try {
    const key = Object.keys(box).find((k) => k.startsWith('__reactContainer'))
    if (!key) return null
    const seen = new Set()
    const stack = [box[key]]
    while (stack.length) {
      const f = stack.pop()
      if (!f || seen.has(f)) continue
      seen.add(f)
      let hook = f.memoizedState
      for (let i = 0; i < 60 && hook; i += 1) {
        // useState 的值在 memoizedState 上；useRef 的值包在 .current 里
        const st = hook.memoizedState?.current ?? hook.memoizedState
        if (st && typeof st === 'object' && matcher(st)) return st
        hook = hook.next
      }
      if (f.child) stack.push(f.child)
      if (f.sibling) stack.push(f.sibling)
    }
  } catch { /* */ }
  return null
}

function buildUndoStep(ctx, ops) {
  const deep = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)))
  const patches = []
  const inversePatches = []
  for (const op of ops || []) {
    if (!op || !['add', 'remove', 'replace'].includes(op.op)) continue
    // hide / filter_select 在包内 applyOp 里有切表等副作用，不并入撤销
    if (op.path?.[0] === 'hide' || op.path?.[0] === 'filter_select') continue
    let root = ctx
    let path = null
    if (op.id != null) {
      const idx = ctx.luckysheetfile.findIndex((s) => s.id === op.id)
      if (idx < 0) continue
      root = ctx.luckysheetfile[idx]
      path = ['luckysheetfile', idx, ...op.path]
    } else {
      path = [...op.path]
    }
    let cur = root
    let exists = true
    for (const seg of op.path) {
      if (cur == null || typeof cur !== 'object' || !(seg in cur)) {
        exists = false
        cur = undefined
        break
      }
      cur = cur[seg]
    }
    if (op.op === 'remove') {
      patches.push({ op: 'remove', path })
      if (exists) inversePatches.push({ op: 'add', path, value: deep(cur) })
    } else {
      patches.push({ op: op.op, path, value: deep(op.value) })
      inversePatches.push(exists
        ? { op: 'replace', path, value: deep(cur) }
        : { op: 'remove', path })
    }
  }
  return { patches, inversePatches, options: {} }
}

function applyOpUndoable(ops) {
  const api = instRef.current
  if (!api?.applyOp) return false
  const cache = reactStateBy((st) => Array.isArray(st.undoList) && Array.isArray(st.redoList))
  const ctx = cache ? reactStateBy((st) => Array.isArray(st.luckysheetfile)) : null
  let step = null
  if (ctx) {
    try { step = buildUndoStep(ctx, ops) } catch { step = null }
  }
  try {
    api.applyOp(ops)
  } catch {
    return false
  }
  if (cache && step && (step.patches.length || step.inversePatches.length)) {
    cache.undoList.push(step)
    cache.redoList.length = 0
  }
  return true
}

/** onChange 后同步数据条缓存：撤销/重做会整体回滚 sheet 上的规则 */
function syncBarStore() {
  const sheet = (() => {
    try { return instRef.current?.getSheet?.() } catch { return null }
  })()
  if (!sheet?.id) return
  const key = sheetBarKey(sheet)
  const cfg = sheet.config?.fs_data_bars
  const root = sheet.fs_data_bars
  const next = Array.isArray(cfg) ? cfg : (Array.isArray(root) ? root : null)
  if (next) dataBarStore.set(key, next)
  else dataBarStore.delete(key)
}

function toggleFold() {
  folded.value = !folded.value
  nextTick(() => requestAnimationFrame(() => {
    placeFontBar(hostRef.value)
    placeAlignBar(hostRef.value)
    placeFmtBar(hostRef.value)
    placeDataBar(hostRef.value)
  }))
}

function scheduleDataBars() {
  clearTimeout(barDrawTimer)
  barDrawTimer = window.setTimeout(() => {
    drawDataBars()
    drawIconSets()
    drawCrosshair()
  }, 16)
}

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
  labelObs?.disconnect()
  try { stampFeishuLabelsNow(box) }
  finally {
    stamping = false
    const tb = box.querySelector('.fortune-toolbar')
    if (tb && labelObs) labelObs.observe(tb, { childList: true, subtree: true })
  }
}

function stampFeishuLabelsNow(box) {
  box.querySelectorAll('.fortune-toolbar-button[data-tips]').forEach((el) => {
    el.setAttribute('data-label', shortLabel(el.getAttribute('data-tips')))
    const tip = el.getAttribute('data-tips')
    if ((tip === '菜单' || tip === '插入' || tip === '美化表格') && !el.querySelector('.fs-caret')) {
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
  // 颜色/填充强制打标，保证自定义色板拦截与样式生效
  box.querySelectorAll('.fortune-toobar-combo-container:has([data-tips="文本颜色"])').forEach((el) => {
    el.setAttribute('data-label', '颜色')
  })
  box.querySelectorAll('.fortune-toobar-combo-container:has([data-tips="背景色"])').forEach((el) => {
    el.setAttribute('data-label', '填充')
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
  ensurePivotDesignHost(box)
}

function ensurePivotDesignHost(box) {
  const tb = box.querySelector('.fortune-toolbar')
  const work = tb?.closest('.fortune-workarea')
  const anchor = tb?.parentElement
  if (!work || !anchor) return
  let host = work.querySelector(':scope > #pv-design-host')
  if (!host) {
    host = document.createElement('div')
    host.id = 'pv-design-host'
    anchor.after(host)
    pivotBarReady.value = false
    nextTick(() => {
      if (host.isConnected) pivotBarReady.value = true
    })
    return
  }
  if (host.previousElementSibling !== anchor) anchor.after(host)
  if (!pivotBarReady.value) pivotBarReady.value = true
}

function overlayPos(wrap, el, height) {
  const bar = wrap.querySelector('.fortune-toolbar')
  toolbarEl.value = bar
  const base = (bar || wrap).getBoundingClientRect()
  const r = el.getBoundingClientRect()
  const open = wrap.classList.contains('fs-open')
  const clusterH = height || r.height
  return {
    left: Math.round(r.left - base.left),
    top: open
      ? Math.max(0, Math.round(r.top - base.top + (r.height - clusterH) / 2))
      : Math.round((base.height - 24) / 2),
  }
}

function fitPlaceholder(el, selector) {
  const cluster = document.querySelector(selector)
  if (!el || !cluster) return
  const w = Math.ceil(cluster.getBoundingClientRect().width)
  if (w < 8) return
  el.style.width = `${w}px`
  el.style.minWidth = `${w}px`
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
  if (open) fitPlaceholder(fontEl, '.fs-style-cluster')
  const put = () => {
    if (open) fitPlaceholder(fontEl, '.fs-style-cluster')
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
  el.style.height = '44px'
  alignBar.show = true
  const put = () => {
    fitPlaceholder(el, '.fs-align-cluster')
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
  el.style.height = '44px'
  const put = () => {
    fitPlaceholder(el, '.fs-fmt-cluster')
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
  el.style.height = '44px'
  const put = () => {
    fitPlaceholder(el, '.fs-data-cluster')
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
  if (attr === 'ht') {
    alignPop.show = false
    syncFoldAlignIcon()
  }
  if (attr === 'tb') {
    wrapPop.show = false
    syncFoldWrapIcon()
  }
  if (attr === 'vt') {
    vtPop.show = false
    syncFoldVtIcon()
  }
  markActiveTools()
}

function openFoldAlignPop(el) {
  if (!folded.value) return
  const r = el?.getBoundingClientRect?.()
  if (!r) return
  pop.show = false
  colorPop.show = false
  wrapPop.show = false
  vtPop.show = false
  stylePop.show = false
  cfState.fly = ''
  alignPop.left = Math.min(r.left, window.innerWidth - 180)
  alignPop.top = r.bottom + 4
  alignPop.show = !alignPop.show
  markActiveTools()
}

function openFoldWrapPop(el) {
  if (!folded.value) return
  const r = el?.getBoundingClientRect?.()
  if (!r) return
  pop.show = false
  colorPop.show = false
  alignPop.show = false
  vtPop.show = false
  stylePop.show = false
  cfState.fly = ''
  wrapPop.left = Math.min(r.left, window.innerWidth - 180)
  wrapPop.top = r.bottom + 4
  wrapPop.show = !wrapPop.show
  markActiveTools()
}

function openFoldVtPop(el) {
  if (!folded.value) return
  const r = el?.getBoundingClientRect?.()
  if (!r) return
  pop.show = false
  colorPop.show = false
  alignPop.show = false
  wrapPop.show = false
  stylePop.show = false
  cfState.fly = ''
  vtPop.left = Math.min(r.left, window.innerWidth - 180)
  vtPop.top = r.bottom + 4
  vtPop.show = !vtPop.show
  markActiveTools()
}

function syncFoldAlignIcon() {
  if (!folded.value) return
  const box = hostRef.value
  const btn = box?.querySelector('[data-tips="水平对齐"]')?.closest('.fortune-toolbar-button, .fortune-toobar-combo-container')
    || box?.querySelector('.fortune-toobar-combo-container[data-label="对齐"]')
  const svg = btn?.querySelector('svg')
  if (!svg) return
  const opt = HT_OPTS.find((x) => x.id === Number(alignBar.ht)) || HT_OPTS[0]
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.innerHTML = `<path fill="currentColor" d="${opt.path}" />`
  svg.dataset.paint = `#align-ht-${alignBar.ht}`
}

function syncFoldWrapIcon() {
  if (!folded.value) return
  const box = hostRef.value
  const btn = box?.querySelector('[data-tips="文本换行"]')?.closest('.fortune-toolbar-button, .fortune-toobar-combo-container')
    || box?.querySelector('.fortune-toobar-combo-container[data-label="文本换行"]')
  const svg = btn?.querySelector('svg')
  if (!svg) return
  const opt = TB_OPTS.find((x) => x.id === Number(alignBar.tb)) || TB_OPTS[0]
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.innerHTML = `<path fill="currentColor" d="${opt.path}" />`
  svg.dataset.paint = `#align-tb-${alignBar.tb}`
}

function syncFoldVtIcon() {
  if (!folded.value) return
  const box = hostRef.value
  const btn = box?.querySelector('[data-tips="垂直对齐"]')?.closest('.fortune-toolbar-button, .fortune-toobar-combo-container')
    || box?.querySelector('.fortune-toobar-combo-container[data-label="垂直对齐"]')
  const svg = btn?.querySelector('svg')
  if (!svg) return
  const opt = VT_OPTS.find((x) => x.id === Number(alignBar.vt)) || VT_OPTS[1]
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.innerHTML = `<path fill="currentColor" d="${opt.path}" />`
  svg.dataset.paint = `#align-vt-${alignBar.vt}`
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

function normColor(color) {
  if (!color) return ''
  let c = String(color).trim().toLowerCase()
  if (c.startsWith('rgb')) {
    const parts = c.match(/[\d.]+/g)
    if (!parts || parts.length < 3) return c
    const hex = (n) => Math.round(Number(n)).toString(16).padStart(2, '0')
    return `#${hex(parts[0])}${hex(parts[1])}${hex(parts[2])}`
  }
  if (/^#[0-9a-f]{3}$/.test(c)) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`
  return c
}

function rulesOf(sheet) {
  let bag = filterRules.get(sheet.id)
  if (!bag && sheet.fs_filter) {
    bag = sheet.fs_filter
    if (!bag.cols) bag.cols = {}
    filterRules.set(sheet.id, bag)
  }
  if (!bag) {
    bag = { onlyMine: false, cols: {} }
    filterRules.set(sheet.id, bag)
  }
  if (!bag.cols) bag.cols = {}
  return bag
}

function filterBoxOf(sheet, sel) {
  const r0 = sel?.row?.[0] ?? 0
  const r1 = sel?.row?.[1] ?? r0
  const c0 = sel?.column?.[0] ?? 0
  const c1 = sel?.column?.[1] ?? c0
  const expanded = expandSortBox(sheet, { r0, r1, c0, c1 })
  return trimSortBox(sheet, expanded) || expanded
}

/** 筛选建立之后又改过、补过的行也要算进去，否则新值不会出现在列表里。 */
function grownFilterRange(sheet, range) {
  if (!range?.row || !range?.column) return null
  let r0 = range.row[0]
  let r1 = range.row[1]
  const c0 = range.column[0]
  const c1 = range.column[1]
  const rowCount = sheet.data?.length || 0
  while (r0 > 0 && rowHasLabel(sheet, r0 - 1, c0, c1)) r0 -= 1
  while (r1 + 1 < rowCount && rowHasLabel(sheet, r1 + 1, c0, c1)) r1 += 1
  return { row: [r0, r1], column: [c0, c1] }
}

function excelSerialToMs(n) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 20000 || n > 80000) return NaN
  return (n - 25569) * 86400000
}

function parseFilterDate(v) {
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'number') return excelSerialToMs(v)
  const s = String(v ?? '').trim()
  if (!s) return NaN
  if (/^\d+(\.\d+)?$/.test(s)) {
    const ms = excelSerialToMs(Number(s))
    if (Number.isFinite(ms)) return ms
  }
  const m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/)
  if (!m) return NaN
  return new Date(+m[1], +m[2] - 1, +m[3]).getTime()
}

function startOfDay(ms) {
  if (!Number.isFinite(ms)) return NaN
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function cellFillColor(cell) {
  return normColor(cell?.bg) || '#ffffff'
}

/** 整格字体色，以及富文本每一段自己的颜色。没设过的按默认字色。 */
function cellFontColors(cell) {
  const found = []
  const push = (color) => {
    const next = normColor(color)
    if (next && !found.includes(next)) found.push(next)
  }
  push(cell?.fc)
  const runs = cell?.ct?.s
  if (Array.isArray(runs)) runs.forEach((run) => push(run?.fc))
  if (!found.length) found.push('#1f2329')
  return found
}

function columnRejects(cell, rule) {
  if (!rule) return false
  if (rule.mode === 'value') {
    const label = cellLabel(cell) || '(空白)'
    return (rule.unchecked || []).includes(label)
  }
  if (rule.kind === 'bg' || rule.kind === 'fc' || rule.kind === 'color') {
    const bgKeep = rule.kind === 'bg' ? (rule.colors || []) : (rule.bg || null)
    const fcKeep = rule.kind === 'fc' ? (rule.colors || []) : (rule.fc || null)
    if (bgKeep?.length && !bgKeep.includes(cellFillColor(cell))) return true
    if (fcKeep?.length && !cellFontColors(cell).some((color) => fcKeep.includes(color))) return true
    return false
  }
  if (rule.kind === 'date') {
    const text = cellLabel(cell).trim()
    if (rule.cond === 'empty') return text !== ''
    if (rule.cond === 'notEmpty') return text === ''
    const day = startOfDay(parseFilterDate(cell?.v != null && cell.v !== '' ? cell.v : text))
    const left = startOfDay(parseFilterDate(rule.condValue))
    const right = startOfDay(parseFilterDate(rule.condValue2))
    if (!Number.isFinite(day) || !Number.isFinite(left)) return true
    if (rule.cond === 'eq') return day !== left
    if (rule.cond === 'before') return !(day < left)
    if (rule.cond === 'after') return !(day > left)
    if (rule.cond === 'between') {
      if (!Number.isFinite(right)) return true
      const lo = Math.min(left, right)
      const hi = Math.max(left, right)
      return day < lo || day > hi
    }
    return false
  }
  const raw = cellLabel(cell).trim()
  const cv = String(rule.condValue ?? '')
  const low = raw.toLowerCase()
  const q = cv.toLowerCase()
  if (rule.cond === 'empty') return raw !== ''
  if (rule.cond === 'notEmpty') return raw === ''
  if (rule.kind === 'num' || ['gt', 'gte', 'lt', 'lte', 'between'].includes(rule.cond)) {
    const n = filterNumber(cell)
    const cn = parseLooseNumber(cv)
    const cn2 = parseLooseNumber(rule.condValue2)
    if (rule.cond === 'eq') return !(Number.isFinite(n) && Number.isFinite(cn) && n === cn)
    if (rule.cond === 'ne') return !(Number.isFinite(n) && Number.isFinite(cn) && n !== cn)
    if (rule.cond === 'gt') return !(Number.isFinite(n) && Number.isFinite(cn) && n > cn)
    if (rule.cond === 'gte') return !(Number.isFinite(n) && Number.isFinite(cn) && n >= cn)
    if (rule.cond === 'lt') return !(Number.isFinite(n) && Number.isFinite(cn) && n < cn)
    if (rule.cond === 'lte') return !(Number.isFinite(n) && Number.isFinite(cn) && n <= cn)
    if (rule.cond === 'between') {
      if (!Number.isFinite(n) || !Number.isFinite(cn) || !Number.isFinite(cn2)) return true
      const a = Math.min(cn, cn2)
      const b = Math.max(cn, cn2)
      return n < a || n > b
    }
  }
  if (rule.cond === 'eq') return raw !== cv
  if (rule.cond === 'ne') return raw === cv
  if (rule.cond === 'starts') return !low.startsWith(q)
  if (rule.cond === 'ends') return !low.endsWith(q)
  if (rule.cond === 'notContains') return q ? low.includes(q) : false
  return q ? !low.includes(q) : false
}

function rejectedByOthers(sheet, rules, row, col) {
  return Object.entries(rules.cols || {}).some(([key, rule]) => {
    if (Number(key) === col) return false
    return columnRejects(sheet.data?.[row]?.[Number(key)], rule)
  })
}

/** 去掉千分位、货币符号和百分号，得到屏幕上那个数。33.57% → 33.57 */
function parseLooseNumber(text) {
  let s = String(text ?? '').trim().replace(/,/g, '').replace(/\s/g, '')
  if (!s) return NaN
  s = s.replace(/^[¥$€£]/, '')
  if (s.endsWith('%')) s = s.slice(0, -1).trim()
  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return NaN
  return Number(s)
}

function filterNumber(cell) {
  if (cell == null || cell === '') return NaN
  if (typeof cell !== 'object') return parseLooseNumber(cell)
  const label = cellLabel(cell).trim()
  const fa = String(cell.ct?.fa || '')
  if (fa.includes('%') || label.endsWith('%')) {
    if (label.endsWith('%')) {
      const shown = parseLooseNumber(label)
      if (Number.isFinite(shown)) return shown
    }
    if (typeof cell.v === 'number' && Number.isFinite(cell.v)) return cell.v * 100
  }
  if (typeof cell.v === 'number' && Number.isFinite(cell.v)) return cell.v
  return parseLooseNumber(label)
}

/**
 * 显示行和隐藏行必须同一次写完。分成两次调用时，后一次会把前一次冲掉，
 * 筛选确认后行又全部出现。
 */
function commitFilterRows(sheetId, body, hide) {
  const paint = () => {
    const dispatch = sheetContextDispatch()
    if (!dispatch) return
    dispatch((ctx) => {
      if (!ctx?.luckysheetfile) return ctx
      const idx = ctx.luckysheetfile.findIndex((s) => s.id === sheetId)
      if (idx < 0) return ctx
      const sheet = ctx.luckysheetfile[idx]
      const rowhidden = { ...(sheet.config?.rowhidden || {}) }
      body.forEach((r) => { delete rowhidden[r] })
      hide.forEach((r) => { rowhidden[r] = 0 })
      const config = { ...(sheet.config || {}), rowhidden }
      const files = ctx.luckysheetfile.slice()
      files[idx] = { ...sheet, config }
      const next = { ...ctx, luckysheetfile: files }
      if (ctx.currentSheetId === sheetId) next.config = config
      return next
    })
  }
  setTimeout(paint, 0)
}

function writeFilterState(sheet, rules) {
  const range = grownFilterRange(sheet, sheet.filter_select)
  if (!range) return
  const [r0, r1] = range.row
  const [c0, c1] = range.column
  const hide = []
  const body = []
  for (let r = r0 + 1; r <= r1; r += 1) {
    body.push(r)
    const rejected = Object.entries(rules.cols || {}).some(([key, rule]) => columnRejects(sheet.data?.[r]?.[Number(key)], rule))
    if (rejected) hide.push(r)
  }
  commitFilterRows(sheet.id, body, hide)
  const filter = {}
  Object.entries(rules.cols || {}).forEach(([key, rule]) => {
    const col = Number(key)
    const rowhidden = {}
    for (let r = r0 + 1; r <= r1; r += 1) {
      if (columnRejects(sheet.data?.[r]?.[col], rule)) rowhidden[r] = 0
    }
    filter[col - c0] = {
      rowhidden,
      optionstate: true,
      cindex: col,
      stc: c0,
      edc: c1,
      str: r0,
      edr: r1,
      caljs: null,
    }
  })
  const ops = [{ op: 'replace', path: ['filter'], value: filter }]
  const stored = { onlyMine: !!rules.onlyMine, cols: rules.cols }
  ops.push({
    op: Object.prototype.hasOwnProperty.call(sheet, 'filter') ? 'replace' : 'add',
    id: sheet.id,
    path: ['filter'],
    value: filter,
  })
  ops.push({
    op: Object.prototype.hasOwnProperty.call(sheet, 'fs_filter') ? 'replace' : 'add',
    id: sheet.id,
    path: ['fs_filter'],
    value: stored || { onlyMine: true, cols: rules.cols },
  })
  const prev = sheet.filter_select
  if (!prev || prev.row[0] !== range.row[0] || prev.row[1] !== range.row[1] || prev.column[0] !== range.column[0] || prev.column[1] !== range.column[1]) {
    ops.push({ op: 'replace', id: sheet.id, path: ['filter_select'], value: range })
  }
  applyOpUndoable(ops)
  filterRules.set(sheet.id, rules)
}

function enableFilter() {
  filterMenu.show = false
  filterPop.show = false
  const api = instRef.current
  const sheet = api?.getSheet?.()
  const sel = api?.getSelection?.()?.[0]
  if (!sheet?.id) return
  if (sheet.filter_select?.row) {
    cancelFilter()
    return
  }
  const box = filterBoxOf(sheet, sel)
  if (!box || box.r1 <= box.r0) {
    Message.warning('请选择至少包含表头和一行数据的区域')
    return
  }
  const rules = { onlyMine: false, cols: {} }
  filterRules.set(sheet.id, rules)
  applyOpUndoable([{
    op: Object.prototype.hasOwnProperty.call(sheet, 'filter_select') ? 'replace' : 'add',
    id: sheet.id,
    path: ['filter_select'],
    value: { row: [box.r0, box.r1], column: [box.c0, box.c1] },
  }])
  dataBar.filter = true
  markActiveTools()
  scheduleFilterIcons()
}

function cancelFilter() {
  const api = instRef.current
  const sheet = api?.getSheet?.()
  filterMenu.show = false
  filterPop.show = false
  if (!sheet?.id) return
  const range = sheet.filter_select
  if (range?.row) {
    const body = []
    for (let r = range.row[0] + 1; r <= range.row[1]; r += 1) body.push(r)
    if (body.length) commitFilterRows(sheet.id, body, [])
  }
  filterRules.delete(sheet.id)
  const ops = [{ op: 'replace', path: ['filter'], value: {} }]
  if (Object.prototype.hasOwnProperty.call(sheet, 'filter_select')) ops.unshift({ op: 'remove', id: sheet.id, path: ['filter_select'] })
  if (Object.prototype.hasOwnProperty.call(sheet, 'filter')) ops.push({ op: 'remove', id: sheet.id, path: ['filter'] })
  if (Object.prototype.hasOwnProperty.call(sheet, 'fs_filter')) ops.push({ op: 'remove', id: sheet.id, path: ['fs_filter'] })
  if (ops.length) applyOpUndoable(ops)
  dataBar.filter = false
  markActiveTools()
}

function toggleFilterMenu(anchor) {
  if (filterMenu.show) {
    filterMenu.show = false
    return
  }
  const rect = anchor?.getBoundingClientRect?.()
  if (!rect) return
  filterMenu.left = rect.left
  filterMenu.top = rect.bottom + 4
  filterMenu.show = true
  filterPop.show = false
}

function openColumnFilter(btn) {
  const sheet = instRef.current?.getSheet?.()
  const range = grownFilterRange(sheet, sheet?.filter_select)
  if (!sheet || !range?.row) return
  const buttons = [...(hostRef.value?.querySelectorAll('.luckysheet-filter-options') || [])]
  const index = buttons.indexOf(btn)
  if (index < 0) return
  const col = range.column[0] + index
  const r0 = range.row[0]
  const r1 = range.row[1]
  const rules = rulesOf(sheet)
  const rule = rules.cols[col] || rules.cols[String(col)]
  const counts = new Map()
  const bgMap = new Map()
  const fcMap = new Map()
  for (let r = r0 + 1; r <= r1; r += 1) {
    if (rejectedByOthers(sheet, rules, r, col)) continue
    const cell = sheet.data?.[r]?.[col]
    const label = cellLabel(cell) || '(空白)'
    counts.set(label, (counts.get(label) || 0) + 1)
    const bg = cellFillColor(cell)
    if (!bgMap.has(bg)) bgMap.set(bg, 0)
    bgMap.set(bg, bgMap.get(bg) + 1)
    if (label !== '(空白)') {
      cellFontColors(cell).forEach((fc) => {
        if (!fcMap.has(fc)) fcMap.set(fc, 0)
        fcMap.set(fc, fcMap.get(fc) + 1)
      })
    }
  }
  const unchecked = new Set(rule?.mode === 'value' ? (rule.unchecked || []) : [])
  filterPop.col = col
  filterPop.header = r0
  filterPop.c0 = range.column[0]
  filterPop.c1 = range.column[1]
  filterPop.r0 = r0 + 1
  filterPop.r1 = r1
  filterPop.query = ''
  filterPop.addTo = false
  filterPop.onlyMine = !!rules.onlyMine
  if (rule?.kind === 'bg' || rule?.kind === 'fc' || rule?.kind === 'color') filterPop.tab = 'color'
  else if (rule?.mode === 'cond') filterPop.tab = 'cond'
  else filterPop.tab = 'value'
  filterPop.kind = rule?.kind === 'bg' || rule?.kind === 'fc' || rule?.kind === 'color' ? 'text' : (rule?.kind || 'text')
  filterPop.cond = rule?.cond || (filterPop.kind === 'num' ? 'gt' : filterPop.kind === 'date' ? 'before' : 'contains')
  filterPop.condValue = rule?.condValue || ''
  filterPop.condValue2 = rule?.condValue2 || ''
  filterPop.items = [...counts.entries()].map(([label, count]) => ({ label, count, checked: !unchecked.has(label) }))
  const keptBg = rule?.kind === 'bg' ? rule.colors : rule?.kind === 'color' ? rule.bg : null
  const keptFc = rule?.kind === 'fc' ? rule.colors : rule?.kind === 'color' ? rule.fc : null
  filterPop.bgColors = [...bgMap.entries()].map(([color, count]) => ({ color, count, checked: keptBg ? keptBg.includes(color) : true }))
  filterPop.fcColors = [...fcMap.entries()].map(([color, count]) => ({ color, count, checked: keptFc ? keptFc.includes(color) : true }))
  const rect = btn.getBoundingClientRect()
  filterPop.left = Math.max(8, Math.min(rect.left, window.innerWidth - 340))
  filterPop.top = rect.bottom + 360 > window.innerHeight ? Math.max(8, rect.top - 360) : rect.bottom + 4
  filterPop.show = true
  filterMenu.show = false
}

let filterCondFocusTimer = 0
function focusFilterCondInput() {
  clearTimeout(filterCondFocusTimer)
  // 下拉框的 change 之后浏览器还会把焦点交回 select，放到下一拍再抢回来
  filterCondFocusTimer = setTimeout(() => {
    if (!filterPop.show || filterPop.tab !== 'cond') return
    if (filterPop.cond === 'empty' || filterPop.cond === 'notEmpty') return
    const el = document.querySelector('.fs-filter-cond input')
    if (!el) return
    document.getElementById('luckysheet-rich-text-editor')?.blur()
    el.focus()
  }, 0)
}

function onFilterKind() {
  if (filterPop.kind === 'num') filterPop.cond = 'gt'
  else if (filterPop.kind === 'date') filterPop.cond = 'before'
  else filterPop.cond = 'contains'
  focusFilterCondInput()
}

/** 选完「数字 / 大于」后焦点仍在 select 上，数字键会被下拉框吞掉。可打印字符直接写入条件框。 */
function onFilterSelectKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.key.length !== 1) return
  if (filterPop.cond === 'empty' || filterPop.cond === 'notEmpty') return
  if (filterPop.kind === 'date') return
  if (filterPop.kind === 'num' && !/^[0-9.\-]$/.test(e.key)) return
  e.preventDefault()
  e.stopPropagation()
  filterPop.condValue = `${filterPop.condValue || ''}${e.key}`
  focusFilterCondInput()
}

function openFilterTab(tab) {
  filterPop.tab = tab
  if (tab === 'cond' && (filterPop.kind === 'bg' || filterPop.kind === 'fc')) {
    filterPop.kind = 'text'
    filterPop.cond = 'contains'
  }
  if (tab === 'cond') focusFilterCondInput()
}

const filterCondOps = computed(() => {
  if (filterPop.kind === 'num') return FILTER_NUM_OPS
  if (filterPop.kind === 'date') return FILTER_DATE_OPS
  return FILTER_TEXT_OPS
})

function scheduleFilterIcons() {
  cancelAnimationFrame(filterIconFrame)
  filterIconFrame = requestAnimationFrame(() => {
    filterIconFrame = requestAnimationFrame(syncFilterIcons)
  })
}

/** Univer 把 16px 筛选按钮贴在表头单元格右下角：未筛选三道横线，已筛选实心漏斗 */
function syncFilterIcons() {
  const host = hostRef.value
  const sheet = instRef.current?.getSheet?.()
  const range = sheet?.filter_select
  const buttons = [...(host?.querySelectorAll('.luckysheet-filter-options') || [])]
  if (!buttons.length || !range?.row) return
  const row = range.row[0]
  const zoom = Number(sheet.zoomRatio) || 1
  const rowPx = (Number(sheet.config?.rowlen?.[row] || sheet.defaultRowHeight) || 24) * zoom
  buttons.forEach((btn) => {
    const topNow = btn.style.top
    const leftNow = btn.style.left
    if (btn.dataset.fsAppliedTop == null || Math.abs(parseFloat(topNow) - parseFloat(btn.dataset.fsAppliedTop)) > 0.6) {
      btn.dataset.fsBaseTop = topNow
    }
    if (btn.dataset.fsAppliedLeft == null || Math.abs(parseFloat(leftNow) - parseFloat(btn.dataset.fsAppliedLeft)) > 0.6) {
      btn.dataset.fsBaseLeft = leftNow
    }
    const top = parseFloat(btn.dataset.fsBaseTop) + Math.max(0, rowPx - 17)
    const left = parseFloat(btn.dataset.fsBaseLeft) + 3
    btn.dataset.fsAppliedTop = String(top)
    btn.dataset.fsAppliedLeft = String(left)
    btn.style.top = `${top}px`
    btn.style.left = `${left}px`
  })
}

function openFilter() {
  enableFilter()
}

function ruleFromPanel() {
  if (filterPop.tab === 'value') {
    if (filterPop.query.trim() && !filterPop.addTo) {
      const visible = new Set(filterView.value.map((item) => item.label))
      filterPop.items.forEach((item) => {
        if (!visible.has(item.label)) item.checked = false
      })
    }
    const unchecked = filterPop.items.filter((item) => !item.checked).map((item) => item.label)
    if (!unchecked.length) return null
    return { mode: 'value', unchecked }
  }
  if (filterPop.tab === 'color') {
    const fills = filterPop.bgColors
    const fonts = filterPop.fcColors
    const fillOn = fills.filter((item) => item.checked)
    const fontOn = fonts.filter((item) => item.checked)
    const bg = fills.length && fillOn.length && fillOn.length < fills.length ? fillOn.map((item) => item.color) : null
    const fc = fonts.length && fontOn.length && fontOn.length < fonts.length ? fontOn.map((item) => item.color) : null
    if (bg && fc) return { mode: 'cond', kind: 'color', bg, fc }
    if (bg) return { mode: 'cond', kind: 'bg', colors: bg }
    if (fc) return { mode: 'cond', kind: 'fc', colors: fc }
    return null
  }
  const needsValue = !['empty', 'notEmpty'].includes(filterPop.cond)
  if (needsValue && !String(filterPop.condValue).trim()) return null
  if (filterPop.cond === 'between' && !String(filterPop.condValue2).trim()) return null
  return {
    mode: 'cond',
    kind: filterPop.kind,
    cond: filterPop.cond,
    condValue: filterPop.condValue,
    condValue2: filterPop.condValue2,
  }
}

/** 颜色都勾着时，第一次点某一色表示「只看这一色」，而不是把它取消。 */
function toggleFilterColor(group, item) {
  const list = group === 'fc' ? filterPop.fcColors : filterPop.bgColors
  if (list.length && list.every((row) => row.checked)) {
    list.forEach((row) => { row.checked = row === item })
    return
  }
  item.checked = !item.checked
  if (list.length && list.every((row) => !row.checked)) list.forEach((row) => { row.checked = true })
}

function applyFilter() {
  const sheet = instRef.current?.getSheet?.()
  if (!sheet?.filter_select) {
    filterPop.show = false
    return
  }
  const rules = rulesOf(sheet)
  rules.onlyMine = filterPop.onlyMine
  const next = ruleFromPanel()
  if (next) rules.cols[filterPop.col] = next
  else delete rules.cols[filterPop.col]
  writeFilterState(sheet, rules)
  filterPop.show = false
  markActiveTools()
  scheduleFilterIcons()
}

function clearFilter() {
  const sheet = instRef.current?.getSheet?.()
  if (!sheet?.filter_select) {
    filterPop.show = false
    return
  }
  const rules = rulesOf(sheet)
  delete rules.cols[filterPop.col]
  delete rules.cols[String(filterPop.col)]
  writeFilterState(sheet, rules)
  filterPop.show = false
  markActiveTools()
  scheduleFilterIcons()
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

function sortKeyOf(cell) {
  const text = cellLabel(cell).trim()
  if (!text) return { empty: true, value: '' }
  const n = Number(text)
  if (Number.isFinite(n) && text !== '') return { empty: false, value: n }
  return { empty: false, value: text }
}

function compareSortKey(a, b, asc) {
  if (a.empty && b.empty) return 0
  if (a.empty) return 1
  if (b.empty) return -1
  const an = typeof a.value === 'number'
  const bn = typeof b.value === 'number'
  if (an && bn) return asc ? a.value - b.value : b.value - a.value
  if (an !== bn) return an ? (asc ? -1 : 1) : (asc ? 1 : -1)
  const cmp = String(a.value).localeCompare(String(b.value), 'zh')
  return asc ? cmp : -cmp
}

function rowHasLabel(sheet, r, c0, c1) {
  for (let c = c0; c <= c1; c += 1) if (cellLabel(sheet.data?.[r]?.[c])) return true
  return false
}

function colHasLabel(sheet, c, r0, r1) {
  for (let r = r0; r <= r1; r += 1) if (cellLabel(sheet.data?.[r]?.[c])) return true
  return false
}

function trimSortBox(sheet, box) {
  let { r0, r1, c0, c1 } = box
  while (r0 <= r1 && !rowHasLabel(sheet, r0, c0, c1)) r0 += 1
  while (r1 >= r0 && !rowHasLabel(sheet, r1, c0, c1)) r1 -= 1
  while (c0 <= c1 && !colHasLabel(sheet, c0, r0, r1)) c0 += 1
  while (c1 >= c0 && !colHasLabel(sheet, c1, r0, r1)) c1 -= 1
  if (r0 > r1 || c0 > c1) return null
  return { r0, r1, c0, c1 }
}

/** 从当前列向外扩到紧挨着的整张表，让排序按行联动 */
function expandSortBox(sheet, box) {
  let { r0, r1, c0, c1 } = box
  const rowCount = sheet.data?.length || 0
  let maxC = c1
  for (let r = 0; r < rowCount; r += 1) maxC = Math.max(maxC, (sheet.data[r]?.length || 1) - 1)
  for (let guard = 0; guard < 400; guard += 1) {
    let changed = false
    if (r0 > 0 && rowHasLabel(sheet, r0 - 1, c0, c1)) { r0 -= 1; changed = true }
    if (r1 + 1 < rowCount && rowHasLabel(sheet, r1 + 1, c0, c1)) { r1 += 1; changed = true }
    if (c0 > 0 && colHasLabel(sheet, c0 - 1, r0, r1)) { c0 -= 1; changed = true }
    if (c1 < maxC && colHasLabel(sheet, c1 + 1, r0, r1)) { c1 += 1; changed = true }
    if (!changed) break
  }
  return { r0, r1, c0, c1 }
}

function isSortHeader(sheet, box) {
  if (box.r1 <= box.r0) return false
  let filled = 0
  let labels = 0
  for (let c = box.c0; c <= box.c1; c += 1) {
    const text = cellLabel(sheet.data?.[box.r0]?.[c]).trim()
    if (!text) continue
    filled += 1
    if (!Number.isFinite(Number(text)) && !/^\d/.test(text)) labels += 1
  }
  return filled > 0 && labels === filled
}

function sortLinked(sheet, box, keyCol, asc) {
  const trimmed = trimSortBox(sheet, box)
  if (!trimmed) {
    Message.warning('当前没有可排序的内容')
    return
  }
  const area = expandSortBox(sheet, trimmed)
  const key = Math.min(Math.max(keyCol, area.c0), area.c1)
  let r0 = area.r0
  if (isSortHeader(sheet, area)) r0 += 1
  if (r0 >= area.r1) return
  for (let r = r0; r <= area.r1; r += 1) {
    for (let c = area.c0; c <= area.c1; c += 1) {
      if (sheet.data?.[r]?.[c]?.mc) {
        Message.warning('合并单元格不能按列联动排序')
        return
      }
    }
  }
  const records = []
  for (let r = r0; r <= area.r1; r += 1) {
    const line = []
    for (let c = area.c0; c <= area.c1; c += 1) line.push(sheet.data?.[r]?.[c] ?? null)
    records.push({ line, key: sortKeyOf(line[key - area.c0]), idx: r })
  }
  records.sort((a, b) => compareSortKey(a.key, b.key, asc) || a.idx - b.idx)
  const ops = []
  records.forEach((row, i) => {
    const r = r0 + i
    const src = sheet.data?.[r]
    const clone = (cell) => (cell && typeof cell === 'object' ? { ...cell } : cell ?? null)
    if (!Array.isArray(src) || src.length <= area.c1) {
      const next = Array.isArray(src) ? src.slice() : []
      while (next.length <= area.c1) next.push(null)
      for (let c = area.c0; c <= area.c1; c += 1) next[c] = clone(row.line[c - area.c0])
      ops.push({ op: 'replace', id: sheet.id, path: ['data', r], value: next })
    } else {
      for (let c = area.c0; c <= area.c1; c += 1) {
        ops.push({ op: 'replace', id: sheet.id, path: ['data', r, c], value: clone(row.line[c - area.c0]) })
      }
    }
  })
  if (sheet.hyperlink) {
    const next = { ...sheet.hyperlink }
    const moved = []
    records.forEach((row, i) => {
      for (let c = area.c0; c <= area.c1; c += 1) {
        const item = sheet.hyperlink[`${row.idx}_${c}`]
        if (item) moved.push([`${r0 + i}_${c}`, item])
      }
    })
    for (let r = r0; r <= area.r1; r += 1) {
      for (let c = area.c0; c <= area.c1; c += 1) delete next[`${r}_${c}`]
    }
    moved.forEach(([key, item]) => { next[key] = item })
    ops.push({ op: 'replace', id: sheet.id, path: ['hyperlink'], value: next })
  }
  if (!ops.length) return
  applyOpUndoable(ops)
  scheduleDataBars()
}

function sortFromFilter(asc) {
  filterPop.show = false
  const sheet = instRef.current?.getSheet?.()
  if (!sheet?.id) return
  sortLinked(sheet, {
    r0: filterPop.header,
    r1: filterPop.r1,
    c0: filterPop.c0,
    c1: filterPop.c1,
  }, filterPop.col, asc)
  const rules = rulesOf(sheet)
  if (Object.keys(rules.cols || {}).length) writeFilterState(sheet, rules)
}

function clickData(label) {
  if (label === '筛选') {
    enableFilter()
    return
  }
  if (label === '下拉列表') {
    openValidation()
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
  if (!sel || !sheet?.id) return
  const r0 = sel.row?.[0] ?? 0
  const r1 = sel.row?.[1] ?? r0
  const c0 = sel.column?.[0] ?? 0
  const c1 = sel.column?.[1] ?? c0
  const focus = sel.column_focus
  const keyCol = focus != null && focus >= c0 && focus <= c1 ? focus : c0
  sortLinked(sheet, { r0, r1, c0, c1 }, keyCol, asc)
}

function applyFontName(name, key) {
  const api = instRef.current
  const sheet = api?.getSheet?.()
  const sel = api?.getSelection?.()?.[0]
  if (!api?.setCellFormatByRange || !sheet?.id || !sel?.row || !sel?.column) return
  api.setCellFormatByRange('ff', name, { row: sel.row, column: sel.column }, { id: sheet.id })
  fontBar.name = name
  fontBar.key = key || FONT_NAMES.find((f) => f.id === name)?.key || 'default'
  fontMenu.open = false
  fontMenu.query = ''
}

function openFontMenu(el) {
  const anchor = el?.closest?.('.fs-arco-font') || el
  const r = anchor?.getBoundingClientRect?.()
  if (!r) return
  fontMenu.left = Math.round(r.left)
  fontMenu.top = Math.round(r.bottom + 4)
  fontMenu.query = ''
  fontMenu.open = true
}

function toggleFontMenu(e) {
  e?.stopPropagation?.()
  if (fontMenu.open) {
    fontMenu.open = false
    return
  }
  openFontMenu(e?.currentTarget)
}

function isFontSelected(item) {
  if (fontBar.key) return fontBar.key === item.key
  return item.id === fontBar.name && item.key === (FONT_NAMES.find((f) => f.id === fontBar.name)?.key)
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
  markActiveTools()
}

function openFoldStylePop(el) {
  if (!folded.value) return
  const r = el?.getBoundingClientRect?.()
  if (!r) return
  pop.show = false
  colorPop.show = false
  alignPop.show = false
  wrapPop.show = false
  vtPop.show = false
  cfState.fly = ''
  stylePop.left = Math.min(r.left, window.innerWidth - 180)
  stylePop.top = r.bottom + 4
  stylePop.show = !stylePop.show
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
  const byTip = (tip) => box.querySelector(`.fortune-toolbar [data-tips="${tip}"]`)?.closest('.fortune-toolbar-button, .fortune-toobar-combo-container')
  const frozen = !!(sheet?.frozen && sheet.frozen.type && sheet.frozen.type !== 'cancel')
  const filtered = !!sheet?.filter_select?.row
  setOn(byLabel('冻结'), frozen)
  setOn(byLabel('筛选'), filtered)
  setOn(byLabel('合并单元格'), !!(cell?.mc))
  setOn(byLabel('对齐'), alignPop.show || cell?.ht === 0 || cell?.ht === 2)
  setOn(byLabel('垂直对齐'), vtPop.show || Number(cell?.vt) === 1 || Number(cell?.vt) === 2)
  setOn(byLabel('文本换行'), wrapPop.show || Number(cell?.tb) === 2)
  setOn(byTip('粗体 (Ctrl+B)'), stylePop.show || !!cell?.bl)
  setOn(byTip('斜体 (Ctrl+I)'), !!cell?.it)
  setOn(byTip('下划线'), !!cell?.un)
  setOn(byTip('删除线 (Alt+Shift+5)'), !!cell?.cl)
  setOn(byLabel('边框'), pop.show && pop.kind === 'border')
  setOn(byLabel('条件格式'), pop.show && pop.kind === 'cf')
  setOn(byLabel('查找和替换'), findState.open)
  setOn(byTip('查找替换'), findState.open)
  setOn(byLabel('评论'), false)
  dataBar.freeze = !!(sheet?.frozen && sheet.frozen.type && sheet.frozen.type !== 'cancel')
  dataBar.filter = !!sheet?.filter_select?.row
  dataBar.cf = pop.show && pop.kind === 'cf'
  fontBar.bl = cell?.bl ? 1 : 0
  fontBar.it = cell?.it ? 1 : 0
  fontBar.un = cell?.un ? 1 : 0
  fontBar.cl = cell?.cl ? 1 : 0
  fontBar.fc = cell?.fc || '#1f2329'
  fontBar.bg = cell?.bg || '#fff258'
  fontBar.name = cell?.ff || '微软雅黑'
  fontBar.key = FONT_NAMES.find((f) => f.id === fontBar.name)?.key || 'default'
  fontBar.size = Number(cell?.fs) || 10
  alignBar.ht = cell?.ht == null ? 1 : Number(cell.ht)
  alignBar.vt = cell?.vt == null ? 0 : Number(cell.vt)
  alignBar.tb = cell?.tb == null || cell?.tb === '' ? 1 : Number(cell.tb)
  alignBar.merge = !!(cell?.mc)
  syncFoldAlignIcon()
  syncFoldWrapIcon()
  syncFoldVtIcon()
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

// fortune 挂载竞态：sheet 数据未就绪时会写入 row/column 含 NaN 的残缺选区，
// 名称框随之显示 A1:NaN 并滞留到用户手动点击。检测到非有限选区则重置为 A1；
// 用户真实选区恒为有限值，重试不会误伤。
function fixInitialSelection() {
  try {
    const api = instRef.current
    if (!api?.setSelection) return
    const sel = api.getSelection?.()?.[0]
    const bad = !sel
      || !Number.isFinite(sel.row?.[0]) || !Number.isFinite(sel.row?.[1])
      || !Number.isFinite(sel.column?.[0]) || !Number.isFinite(sel.column?.[1])
    if (!bad) return
    const sheet = api.getSheet?.()
    api.setSelection([{ row: [0, 0], column: [0, 0] }], sheet?.id ? { id: sheet.id } : undefined)
  } catch { /* 表格未就绪时静默跳过 */ }
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

function linkSheetNames() {
  return liveSheets().map((sheet) => sheet.name).filter(Boolean)
}

function placeLinkPop() {
  const box = hostRef.value?.querySelector('#luckysheet-cell-selected')
  const rect = box?.getBoundingClientRect?.()
  const width = 440
  if (!rect || rect.width < 2) {
    linkPop.left = 72
    linkPop.top = 96
    return
  }
  let left = rect.left
  let top = rect.bottom + 6
  if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8)
  if (top + 168 > window.innerHeight - 8) top = Math.max(8, rect.top - 168)
  linkPop.left = left
  linkPop.top = top
}

function openLinkPop() {
  pop.show = false
  const cell = activeCell()
  const sheet = cfSheet()
  if (!cell || !sheet) {
    Message.warning('请先选中一个单元格')
    return
  }
  const raw = sheet.data?.[cell.row]?.[cell.col]
  const saved = sheet.hyperlink?.[`${cell.row}_${cell.col}`]
  linkPop.row = cell.row
  linkPop.col = cell.col
  linkPop.sheetId = sheet.id
  linkPop.text = raw && typeof raw === 'object' ? String(raw.m ?? raw.v ?? '') : (raw == null ? '' : String(raw))
  linkPop.address = saved?.linkAddress || ''
  linkPop.type = saved?.linkType || 'webpage'
  linkPop.sheetsOpen = false
  linkPop.picking = false
  linkPop.show = true
  nextTick(() => placeLinkPop())
}

function startSheetLink() {
  linkPop.sheetsOpen = !linkPop.sheetsOpen
}

function pickSheetLink(name) {
  linkPop.type = 'sheet'
  linkPop.address = name
  linkPop.text = name
  linkPop.sheetsOpen = false
}

function startCellLink() {
  linkPop.picking = true
  linkPop.sheetsOpen = false
  linkPop.show = false
  linkBar.show = false
}

function quoteSheetName(name) {
  const s = String(name || '')
  if (!s) return s
  if (/^[A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*$/.test(s)) return s
  return `'${s.replace(/'/g, "''")}'`
}

function parseRangeAddress(address) {
  const raw = String(address || '').trim()
  if (!raw) return null
  let sheet = ''
  let body = raw
  const quoted = raw.match(/^'((?:[^']|'')*)'!(\$?[A-Za-z]+\$?\d+(?::\$?[A-Za-z]+\$?\d+)?)$/)
  if (quoted) {
    sheet = quoted[1].replace(/''/g, "'")
    body = quoted[2]
  } else {
    const plain = raw.match(/^(.+)!(\$?[A-Za-z]+\$?\d+(?::\$?[A-Za-z]+\$?\d+)?)$/)
    if (plain) {
      sheet = plain[1]
      body = plain[2]
    }
  }
  const m = body.replace(/\$/g, '').match(/^([A-Za-z]+)(\d+)(?::([A-Za-z]+)(\d+))?$/)
  if (!m) return null
  const r0 = Number(m[2]) - 1
  const c0 = colIndexFromLetters(m[1])
  const r1 = m[4] ? Number(m[4]) - 1 : r0
  const c1 = m[3] ? colIndexFromLetters(m[3]) : c0
  if ([r0, c0, r1, c1].some((n) => !Number.isFinite(n) || n < 0)) return null
  const a = `${colLetter(Math.min(c0, c1))}${Math.min(r0, r1) + 1}`
  const b = `${colLetter(Math.max(c0, c1))}${Math.max(r0, r1) + 1}`
  const span = a === b ? a : `${a}:${b}`
  return {
    sheet,
    r0: Math.min(r0, r1),
    r1: Math.max(r0, r1),
    c0: Math.min(c0, c1),
    c1: Math.max(c0, c1),
    address: sheet ? `${quoteSheetName(sheet)}!${span}` : span,
  }
}

function linkFromUrl(text) {
  let url
  try { url = new URL(text, location.origin) } catch { return null }
  const range = url.searchParams.get('range')
  if (!range || !parseRangeAddress(range)) return null
  const same = url.origin === location.origin && url.pathname === location.pathname
  if (!same) return { type: 'webpage', address: url.toString() }
  const sheet = url.searchParams.get('sheet') || ''
  const address = sheet ? `${quoteSheetName(sheet)}!${range.replace(/\$/g, '')}` : range.replace(/\$/g, '')
  return { type: 'cellrange', address }
}

function finishCellLinkPick() {
  if (!linkPop.picking) return
  const sel = instRef.current?.getSelection?.()?.[0]
  const r0 = sel?.row?.[0]
  const c0 = sel?.column?.[0]
  if (r0 == null || c0 == null) return
  const r1 = sel.row?.[1] ?? r0
  const c1 = sel.column?.[1] ?? c0
  const a = `${colLetter(Math.min(c0, c1))}${Math.min(r0, r1) + 1}`
  const b = `${colLetter(Math.max(c0, c1))}${Math.max(r0, r1) + 1}`
  const addr = `${quoteSheetName(getActiveSheetName())}!${a === b ? a : `${a}:${b}`}`
  linkPop.address = addr
  linkPop.type = 'cellrange'
  if (!linkPop.text.trim()) linkPop.text = addr
  linkPop.picking = false
  linkPop.show = true
  nextTick(() => placeLinkPop())
}

function resolveLink(address) {
  const text = address.trim()
  if (/^https?:\/\//i.test(text) || /[?&]range=/.test(text)) {
    const fromUrl = linkFromUrl(text)
    if (fromUrl) return fromUrl
  }
  const range = parseRangeAddress(text)
  if (range && (text.includes('!') || range.address === text.replace(/\$/g, ''))) {
    return { type: 'cellrange', address: range.address }
  }
  if (linkSheetNames().includes(text)) return { type: 'sheet', address: text }
  const href = /^https?:\/\//i.test(text) || /^mailto:/i.test(text) ? text : `https://${text}`
  return { type: 'webpage', address: href }
}

function followCellRange(address) {
  const box = parseRangeAddress(address)
  if (!box) return false
  if (box.sheet && !linkSheetNames().includes(box.sheet)) {
    Message.warning(`找不到工作表「${box.sheet}」`)
    return false
  }
  if (box.sheet) setActiveSheet(box.sheet)
  instRef.current?.setSelection?.([{ row: [box.r0, box.r1], column: [box.c0, box.c1] }])
  return true
}

function followLink(item) {
  if (!item?.linkAddress) return
  linkBar.show = false
  if (item.linkType === 'sheet') {
    if (!linkSheetNames().includes(item.linkAddress)) {
      Message.warning(`找不到工作表「${item.linkAddress}」`)
      return
    }
    setActiveSheet(item.linkAddress)
    return
  }
  if (item.linkType === 'cellrange') {
    followCellRange(item.linkAddress)
    return
  }
  const internal = linkFromUrl(item.linkAddress)
  if (internal?.type === 'cellrange') {
    followCellRange(internal.address)
    return
  }
  window.open(item.linkAddress, '_blank', 'noopener')
}

function removeLinkAt(row, col, sheetId) {
  const sheet = (sheetId && liveSheets().find((s) => s.id === sheetId)) || cfSheet()
  if (!sheet?.id) return
  const prev = sheet.data?.[row]?.[col]
  const next = prev && typeof prev === 'object' ? { ...prev } : { v: prev ?? '', m: prev == null ? '' : String(prev) }
  if (String(next.fc || '').toLowerCase() === '#3370ff') delete next.fc
  if (next.un) delete next.un
  const ops = [{ op: 'replace', id: sheet.id, path: ['data', row, col], value: next }]
  const key = `${row}_${col}`
  if (sheet.hyperlink?.[key]) {
    if (Object.keys(sheet.hyperlink).length === 1) ops.push({ op: 'remove', id: sheet.id, path: ['hyperlink'] })
    else ops.push({ op: 'remove', id: sheet.id, path: ['hyperlink', key] })
  }
  applyOpUndoable(ops)
  linkBar.show = false
}

function editLinkFromBar() {
  const sheet = liveSheets().find((s) => s.id === linkBar.sheetId) || cfSheet()
  if (!sheet) return
  if (sheet.name) setActiveSheet(sheet.name)
  instRef.current?.setSelection?.([{ row: [linkBar.r, linkBar.r], column: [linkBar.c, linkBar.c] }])
  const raw = sheet.data?.[linkBar.r]?.[linkBar.c]
  const saved = sheet.hyperlink?.[`${linkBar.r}_${linkBar.c}`]
  linkPop.row = linkBar.r
  linkPop.col = linkBar.c
  linkPop.sheetId = sheet.id
  linkPop.text = raw && typeof raw === 'object' ? String(raw.m ?? raw.v ?? '') : (raw == null ? '' : String(raw))
  linkPop.address = saved?.linkAddress || ''
  linkPop.type = saved?.linkType || 'webpage'
  linkPop.sheetsOpen = false
  linkPop.picking = false
  linkPop.show = true
  linkBar.show = false
  nextTick(() => placeLinkPop())
}

function keepLinkBar() {
  if (linkBarTimer) {
    clearTimeout(linkBarTimer)
    linkBarTimer = 0
  }
}

function scheduleHideLinkBar() {
  if (linkBarTimer) return
  linkBarTimer = setTimeout(() => {
    linkBarTimer = 0
    linkBar.show = false
  }, 180)
}

function syncLinkBar(g) {
  if (!g || linkPop.show || linkPop.picking) {
    scheduleHideLinkBar()
    return
  }
  const sheet = instRef.current?.getSheet?.()
  const item = sheet?.hyperlink?.[`${g.r}_${g.c}`]
  if (!item?.linkAddress) {
    scheduleHideLinkBar()
    return
  }
  keepLinkBar()
  const width = 280
  let left = g.vx
  let top = g.vy - 40
  if (left < 8) left = 8
  if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8)
  if (top < 48) top = g.vy + g.vh + 4
  linkBar.show = true
  linkBar.left = left
  linkBar.top = top
  linkBar.r = g.r
  linkBar.c = g.c
  linkBar.sheetId = sheet.id
  linkBar.type = item.linkType || 'webpage'
  linkBar.address = item.linkAddress
}

function applyLocationLink() {
  if (locationLinkApplied) return
  const params = new URLSearchParams(location.search)
  const range = params.get('range')
  if (!range) return
  const sheet = params.get('sheet') || ''
  const address = sheet ? `${quoteSheetName(sheet)}!${range}` : range
  if (!parseRangeAddress(address)) return
  locationLinkApplied = true
  followCellRange(address)
}

function confirmLink() {
  const address = linkPop.address.trim()
  if (!address) return
  const sheet = cfSheet()
  if (!sheet || sheet.id !== linkPop.sheetId) {
    Message.warning('请回到原来的单元格再确定')
    return
  }
  const resolved = resolveLink(address)
  const text = linkPop.text.trim() || address
  const prev = sheet.data?.[linkPop.row]?.[linkPop.col]
  const base = prev && typeof prev === 'object' ? { ...prev } : {}
  delete base.f
  const next = {
    ...base,
    v: text,
    m: text,
    fc: '#3370ff',
    un: 1,
    ct: { fa: '@', t: 's' },
  }
  const item = { linkType: resolved.type, linkAddress: resolved.address }
  const key = `${linkPop.row}_${linkPop.col}`
  const ops = [
    { op: 'replace', id: sheet.id, path: ['data', linkPop.row, linkPop.col], value: next },
  ]
  if (sheet.hyperlink?.[key]) ops.push({ op: 'replace', id: sheet.id, path: ['hyperlink', key], value: item })
  else if (sheet.hyperlink) ops.push({ op: 'add', id: sheet.id, path: ['hyperlink', key], value: item })
  else ops.push({ op: 'add', id: sheet.id, path: ['hyperlink'], value: { [key]: item } })
  applyOpUndoable(ops)
  linkPop.show = false
  linkPop.sheetsOpen = false
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

function findColorCombo(target) {
  if (!target?.closest) return null
  const byTip = target.closest('[data-tips="文本颜色"], [data-tips="背景色"]')
    ?.closest('.fortune-toobar-combo-container')
  if (byTip) return byTip
  const byLabel = target.closest(
    '.fortune-toobar-combo-container[data-label="颜色"], .fortune-toobar-combo-container[data-label="填充"]',
  )
  if (byLabel) return byLabel
  const painted = target.closest('svg[data-paint="#font-color"], svg[data-paint="#background"]')
  return painted?.closest('.fortune-toobar-combo-container') || null
}

function colorKindOf(el) {
  const tip = el?.querySelector?.('[data-tips]')?.getAttribute('data-tips') || ''
  const label = el?.getAttribute?.('data-label') || ''
  if (label === '填充' || tip === '背景色') return 'bg'
  if (el?.querySelector?.('svg[data-paint="#background"]')) return 'bg'
  return 'fc'
}

function openColorPicker(kind, el, keepPop) {
  if (!keepPop) pop.show = false
  borderState.styleOpen = false
  alignPop.show = false
  wrapPop.show = false
  vtPop.show = false
  stylePop.show = false
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
        : kind === 'cf-scale'
          ? (cfForm.scaleStops.find((s) => s.key === colorPop.key)?.color || '#ffffff')
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
  if (colorPop.kind === 'cf-scale') {
    const stop = cfForm.scaleStops.find((s) => s.key === colorPop.key)
    if (stop) stop.color = color || '#ffffff'
    return
  }
  if (colorPop.kind === 'bd') {
    borderState.color = color || '#1f2329'
    if (borderState.type && borderState.type !== 'border-draw') applyBorder(borderState.type)
    return
  }
  if (colorPop.kind === 'dv') {
    if (colorPop.key) dvDlg.colors[colorPop.key] = color || '#3370ff'
    return
  }
  if (colorPop.kind === 'fmt-fc') {
    fmtDlg.color = color || '#1f2329'
    return
  }
  if (colorPop.kind === 'fmt-bg') {
    fmtDlg.fill = color || '#fff3e0'
    return
  }
  if (colorPop.kind === 'sheet-tab') {
    setSheetTabColor(color || '')
    return
  }
  const api = instRef.current
  const sel = api?.getSelection?.()?.[0]
  if (!api?.setCellFormatByRange || !sel) return
  const value = color || (colorPop.kind === 'fc' ? '#000000' : null)
  api.setCellFormatByRange(colorPop.kind, value, { row: sel.row, column: sel.column })
  scheduleDataBars()
}

let paintingFmt = false
function paintCellFormat(r, c) {
  const api = instRef.current
  const sheet = api?.getSheet?.()
  const cell = sheet?.data?.[r]?.[c]
  if (!cell || typeof cell !== 'object') return
  const fa = cell.ct?.fa
  if (!fa || fa === 'General' || fa === '@') return
  const raw = cell.v != null && cell.v !== '' ? cell.v : ''
  if (raw === '') return
  const shown = formatByCode(raw, fa)
  if (shown === String(cell.m ?? '')) return
  api.applyOp?.([{ op: 'replace', id: sheet.id, path: ['data', r, c, 'm'], value: shown }])
}

/** 公式原文（去掉开头的 =） */
function formulaBody(f) {
  const s = String(f || '').trim()
  return s.startsWith('=') ? s.slice(1).trim() : s
}
function generalLabel(v) {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const n = Math.round(v * 1e10) / 1e10
    return String(n)
  }
  if (v == null) return ''
  return String(v)
}
/**
 * 首格录入后，Fortune 若发现 f 已经等于正在提交的公式，会直接 return，
 * 格子上就一直画着 “D2*100”。下拉填充的新格子没有旧公式，会正常算出 34、36。
 * 显示文本仍是公式本身时，按当前表重算并写回结果，公式栏继续保留 f。
 */
let fixingFormulas = false
let formulaFixTimer = 0
function scheduleFormulaFix() {
  if (fixingFormulas) return
  clearTimeout(formulaFixTimer)
  formulaFixTimer = setTimeout(() => {
    formulaFixTimer = 0
    fixUncalculatedFormulas()
  }, 40)
}
function fixUncalculatedFormulas() {
  if (fixingFormulas) return
  const api = instRef.current
  const ctx = reactStateBy((st) => st?.formulaCache?.parser && Array.isArray(st.luckysheetfile))
  const sheet = api?.getSheet?.()
  if (!api?.applyOp || !ctx || !sheet?.data) return
  if (ctx.luckysheetCellUpdate?.length) return
  const parser = ctx.formulaCache.parser
  const ops = []
  sheet.data.forEach((row, r) => {
    ;(row || []).forEach((cell, c) => {
      if (!cell?.f) return
      const body = formulaBody(cell.f)
      if (!body) return
      const shown = String(cell.m ?? cell.v ?? '').trim()
      if (shown !== body && shown !== `=${body}` && shown !== String(cell.f).trim()) return
      let parsed
      try {
        parser.context = ctx
        parsed = parser.parse(body, { sheetId: sheet.id })
      } catch {
        return
      }
      if (!parsed || parsed.error != null || parsed.result == null || typeof parsed.result === 'object') return
      const fa = cell.ct?.fa
      const label = !fa || fa === 'General' || fa === '@' ? generalLabel(parsed.result) : formatByCode(parsed.result, fa)
      if (!label || label === shown) return
      ops.push({
        op: 'replace',
        id: sheet.id,
        path: ['data', r, c],
        value: { ...cell, v: parsed.result, m: label, f: cell.f.startsWith('=') ? cell.f : `=${cell.f}` },
      })
    })
  })
  if (!ops.length) return
  fixingFormulas = true
  try { api.applyOp(ops) }
  finally { fixingFormulas = false }
}
function paintSelectionFormat(sel) {
  if (!sel?.row || !sel?.column) return
  paintingFmt = true
  const [r0, r1] = sel.row
  const [c0, c1] = sel.column
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) paintCellFormat(r, c)
  }
  setTimeout(() => { paintingFmt = false }, 80)
}
function applyNumFmt(item) {
  if (!item?.fa) {
    pop.show = false
    return
  }
  numFmt.id = item.id
  const api = instRef.current
  const sel = api?.getSelection?.()?.[0]
  if (api?.setCellFormatByRange && sel?.row && sel?.column) {
    // 单次整块调用：一次调用 = 一步撤销（此前逐格循环会产生 N 步）
    api.setCellFormatByRange('ct', { fa: item.fa, t: item.t }, { row: sel.row, column: sel.column })
    setTimeout(() => paintSelectionFormat(sel), 40)
  }
  const box = hostRef.value?.querySelector('[data-tips="格式"]')?.closest('.fortune-toobar-combo-container')
  const label = box?.querySelector('.fortune-toolbar-combo-text')
  if (label) label.textContent = item.short
  pop.show = false
  markActiveTools()
}

function fmtFa() {
  const d = Math.max(0, Math.min(6, Number(fmtDlg.decimals) || 0))
  const dec = d ? `.${'0'.repeat(d)}` : ''
  const thou = fmtDlg.thousand ? '#,##0' : '0'
  if (fmtDlg.cat === 'general') return { fa: 'General', t: 'g', short: '常规' }
  if (fmtDlg.cat === 'number') return { fa: `${thou}${dec}`, t: 'n', short: '数值' }
  if (fmtDlg.cat === 'currency') return { fa: `"${fmtDlg.symbol}"${thou}${dec}`, t: 'n', short: '货币' }
  if (fmtDlg.cat === 'accounting') return { fa: `"${fmtDlg.symbol}"${thou}${dec}`, t: 'n', short: '会计' }
  if (fmtDlg.cat === 'date') return { fa: fmtDlg.dateFa, t: 'd', short: '日期' }
  if (fmtDlg.cat === 'time') return { fa: fmtDlg.timeFa, t: 'd', short: '时间' }
  if (fmtDlg.cat === 'percent') return { fa: `0${dec}%`, t: 'n', short: '百分比' }
  if (fmtDlg.cat === 'fraction') return { fa: '# ?/?', t: 'n', short: '分数' }
  if (fmtDlg.cat === 'sci') return { fa: `0${dec}E+00`, t: 'n', short: '科学记数' }
  if (fmtDlg.cat === 'text') return { fa: '@', t: 's', short: '文本' }
  if (fmtDlg.cat === 'special') return { fa: '000000', t: 'n', short: '特殊' }
  return { fa: fmtDlg.custom || 'General', t: 'g', short: '自定义' }
}
function fmtSampleRaw() {
  if (fmtDlg.raw !== '' && fmtDlg.raw != null) return fmtDlg.raw
  if (fmtDlg.cat === 'date' || fmtDlg.cat === 'time') return FMT_PREVIEW_AT
  if (fmtDlg.cat === 'text' || (fmtDlg.cat === 'custom' && fmtDlg.custom.includes('@') && !/[0#]/.test(fmtDlg.custom))) return '人事'
  if (fmtDlg.cat === 'percent') return 0.12
  return 12345
}
function fmtPreview() {
  const item = fmtFa()
  return formatByCode(fmtSampleRaw(), item.fa)
}
function fmtDateLabel(fa) {
  return formatByCode(FMT_PREVIEW_AT, fa)
}
function openFmtDlg() {
  pop.show = false
  const api = instRef.current
  const sheet = api?.getSheet?.()
  const sel = api?.getSelection?.()?.[0]
  const cell = sheet?.data?.[sel?.row?.[0] ?? 0]?.[sel?.column?.[0] ?? 0]
  const fa = cell?.ct?.fa || 'General'
  fmtDlg.raw = cell?.v != null && cell.v !== '' ? cell.v : ''
  fmtDlg.tab = 'number'
  fmtDlg.cat = 'general'
  if (fa === '@') fmtDlg.cat = 'text'
  else if (fa.includes('%')) fmtDlg.cat = 'percent'
  else if (fa.includes('E+')) fmtDlg.cat = 'sci'
  else if (/y|M|d/.test(fa) && fa.includes(':')) fmtDlg.cat = 'time'
  else if (/y|M|d/.test(fa)) { fmtDlg.cat = 'date'; fmtDlg.dateFa = fa }
  else if (fa.includes('¥') || fa.includes('$')) fmtDlg.cat = 'currency'
  else if (fa !== 'General') fmtDlg.cat = 'number'
  fmtDlg.custom = fa
  fmtDlg.ht = String(cell?.ht ?? 1)
  fmtDlg.vt = String(cell?.vt ?? 0)
  fmtDlg.wrap = cell?.tb === 2
  fmtDlg.bold = !!cell?.bl
  fmtDlg.color = cell?.fc || '#1f2329'
  fmtDlg.fill = cell?.bg || ''
  fmtDlg.border = ''
  fmtDlg.show = true
}
function openFmtColor(kind, e) {
  const r = e.currentTarget.getBoundingClientRect()
  colorPop.kind = kind
  colorPop.origin = kind === 'fmt-bg' ? (fmtDlg.fill || '#fff3e0') : fmtDlg.color
  colorPop.left = Math.min(r.left, window.innerWidth - 292)
  colorPop.top = Math.min(r.bottom + 6, window.innerHeight - 420)
  colorPop.show = true
}
function confirmFmtDlg() {
  const api = instRef.current
  const sel = api?.getSelection?.()?.[0]
  if (api?.setCellFormatByRange && sel?.row && sel?.column) {
    const range = { row: sel.row, column: sel.column }
    const item = fmtFa()
    applyNumFmt({ ...item, id: item.short })
    api.setCellFormatByRange('ht', Number(fmtDlg.ht), range)
    api.setCellFormatByRange('vt', Number(fmtDlg.vt), range)
    api.setCellFormatByRange('tb', fmtDlg.wrap ? 2 : 0, range)
    api.setCellFormatByRange('bl', fmtDlg.bold ? 1 : 0, range)
    api.setCellFormatByRange('fs', Number(fmtDlg.size) || 10, range)
    if (fmtDlg.font && fmtDlg.font !== '默认字体') api.setCellFormatByRange('ff', fmtDlg.font, range)
    api.setCellFormatByRange('fc', fmtDlg.color || '#1f2329', range)
    if (fmtDlg.fill) api.setCellFormatByRange('bg', fmtDlg.fill, range)
  }
  if (fmtDlg.border) applyBorder(fmtDlg.border)
  fmtDlg.show = false
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
  if (!live?.id) return
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
  applyOpUndoable([
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
  const fromApi = (api?.getSelection?.() || []).map((s) => ({
    row: [s.row?.[0] ?? 0, s.row?.[1] ?? s.row?.[0] ?? 0],
    column: [s.column?.[0] ?? 0, s.column?.[1] ?? s.column?.[0] ?? 0],
  }))
  if (fromApi.length) return fromApi
  const sheet = cfSheet()
  const fromSheet = (sheet?.luckysheet_select_save || []).map((s) => ({
    row: [s.row?.[0] ?? 0, s.row?.[1] ?? s.row?.[0] ?? 0],
    column: [s.column?.[0] ?? 0, s.column?.[1] ?? s.column?.[0] ?? 0],
  }))
  return fromSheet.length ? fromSheet : [{ row: [0, 0], column: [0, 0] }]
}

function rangesOverlap(a, b) {
  return a.row[0] <= b.row[1] && a.row[1] >= b.row[0]
    && a.column[0] <= b.column[1] && a.column[1] >= b.column[0]
}

function allManageRules() {
  const sheet = cfSheet()
  const fromCf = cfRules().map((r, i) => ({ ...r, _src: 'cf', _idx: i }))
  const fromBar = barRulesOf(sheet).map((r, i) => ({
    type: 'dataBar',
    format: r.format,
    cellrange: r.cellrange,
    _src: 'bar',
    _idx: i,
  }))
  return [...fromCf.filter((r) => r.type !== 'dataBar'), ...fromBar]
}

function refreshCfFlags() {
  const all = allManageRules()
  const sel = cfSelection()
  cfState.list = cfState.ruleScope === 'sel'
    ? all.filter((rule) => (rule.cellrange || []).some((range) => sel.some((s) => rangesOverlap(range, s))))
    : all
  cfState.hasRules = all.length > 0
  cfState.hasSel = all.some((rule) => (rule.cellrange || []).some((range) => sel.some((s) => rangesOverlap(range, s))))
}

function patchCf(next, undoable = true) {
  const api = instRef.current
  const live = api?.getSheet?.()
  if (!api?.applyOp || !live?.id) return
  const ops = [
    { op: 'replace', id: live.id, path: ['luckysheet_conditionformat_save'], value: next },
  ]
  if (undoable) applyOpUndoable(ops)
  else api.applyOp(ops)
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
  const flyW = id === 'color' ? 248 : id === 'bar' ? 220 : id === 'icons' ? 274 : 180
  const flyH = id === 'bar' ? 330 : id === 'icons' ? 460 : id === 'color' ? 260 : 220
  let top = pop.top + cfState.flyTop
  if (top + flyH > window.innerHeight - 8) top = Math.max(8, window.innerHeight - flyH - 8)
  cfState.flyY = top
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
    openCfDialog(item.id === 'new' ? 'greaterThan' : 'formula', true)
    return
  }
  if (item.id === 'manage') {
    openCfRules()
    return
  }
  if (item.id === 'clearSel') {
    pop.show = false
    const sel = cfSelection()
    const covered = (rule) => (rule.cellrange || []).some((range) => sel.some((s) => rangesOverlap(range, s)))
    const removedNative = cfRules().filter(covered)
    const sheet = cfSheet()
    const removedBars = sheet ? barRulesOf(sheet).filter(covered) : []
    removeCfRulesUndoable(
      cfRules().filter((rule) => !removedNative.includes(rule)),
      sheet ? barRulesOf(sheet).filter((rule) => !removedBars.includes(rule)) : null,
      [...removedNative.filter(isCfVisualRule), ...removedBars],
    )
    markActiveTools()
    return
  }
  if (item.id === 'clearSheet') {
    pop.show = false
    const sheet = cfSheet()
    removeCfRulesUndoable(
      [],
      sheet ? [] : null,
      [...cfRules().filter(isCfVisualRule), ...(sheet ? barRulesOf(sheet) : [])],
    )
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
  cfForm.kind = 'highlight'
  cfForm.rank = 'top'
  cfForm.percent = false
  cfForm.group = 'value'
  cfForm.presetId = ''
  cfForm.scaleStops = []
  cfForm.bl = false
  cfForm.it = false
  cfForm.un = false
  cfForm.cl = false
  cfForm.style = 0
  cfState.scaleOpen = false
  cfState.kindOpen = false
  cfState.pickingRange = false
}

function rgbToCssHex(color) {
  const m = String(color || '').match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!m) {
    const h = String(color || '').trim()
    if (/^#[0-9a-fA-F]{6}$/.test(h)) return h.toLowerCase()
    return '#ffffff'
  }
  return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`
}

function currentColorPreset() {
  return CF_FLIES.color.find((x) => x.id === cfForm.presetId) || CF_FLIES.color.find((x) => x.id === 'cg-gyr') || CF_FLIES.color[0]
}

function scalePreviewCss(format) {
  const colors = [...(format || [])].reverse()
  if (!colors.length) return '#fff'
  if (colors.length === 1) return colors[0]
  const stops = colors.map((c, i) => `${c} ${(i / (colors.length - 1)) * 100}%`).join(', ')
  return `linear-gradient(180deg, ${stops})`
}

function syncScaleStops(item) {
  const fmt = item?.format || []
  if (fmt.length >= 3) {
    cfForm.scaleStops = [
      { key: 'min', label: '最小值', type: 'min', value: '', color: rgbToCssHex(fmt[0]) },
      { key: 'mid', label: '中间值', type: 'percentile', value: '50', color: rgbToCssHex(fmt[1]) },
      { key: 'max', label: '最大值', type: 'max', value: '', color: rgbToCssHex(fmt[2]) },
    ]
    return
  }
  cfForm.scaleStops = [
    { key: 'min', label: '最小值', type: 'min', value: '', color: rgbToCssHex(fmt[0] || CF_SCALE_RED) },
    { key: 'max', label: '最大值', type: 'max', value: '', color: rgbToCssHex(fmt[1] || CF_SCALE_GREEN) },
  ]
}

function scaleStopDisabled(stop) {
  return stop.type === 'min' || stop.type === 'max'
}

function scaleFormatFromStops() {
  return cfForm.scaleStops.map((s) => {
    const hex = String(s.color || '#ffffff').replace('#', '')
    if (hex.length !== 6) return s.color
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `rgb(${r}, ${g}, ${b})`
  })
}

function toggleScaleGallery(e) {
  cfState.kindOpen = false
  if (cfState.scaleOpen) {
    cfState.scaleOpen = false
    return
  }
  const el = e?.currentTarget
  const r = el?.getBoundingClientRect?.()
  if (r) {
    const h = 268
    let top = r.bottom + 4
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4)
    cfState.scaleY = top
    cfState.scaleX = Math.min(r.left, window.innerWidth - 304)
    cfState.scaleW = Math.max(292, r.width)
  }
  cfState.scaleOpen = true
}

function toggleKindMenu(e) {
  cfState.scaleOpen = false
  if (cfState.kindOpen) {
    cfState.kindOpen = false
    return
  }
  const el = e?.currentTarget
  const r = el?.getBoundingClientRect?.()
  if (r) {
    const h = 260
    let top = r.bottom + 4
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4)
    cfState.kindY = top
    cfState.kindX = Math.min(r.left, window.innerWidth - 304)
    cfState.kindW = Math.max(292, r.width)
  }
  cfState.kindOpen = true
}

function pickCfKind(id) {
  cfState.kindOpen = false
  onCfKind(id)
}

function onDocScaleDown(e) {
  if (cfState.scaleOpen && !e.target.closest?.('.fs-cf-scale-gallery, .fs-cf-scale-select')) {
    cfState.scaleOpen = false
  }
  if (cfState.kindOpen && !e.target.closest?.('.fs-cf-kind-menu, .fs-cf-kind-select')) {
    cfState.kindOpen = false
  }
  if (cfState.scopeOpen && !e.target.closest?.('.fs-cf-scope-menu, .fs-cf-scope')) {
    cfState.scopeOpen = false
  }
}

function pickScalePreset(item) {
  cfForm.presetId = item.id
  syncScaleStops(item)
  cfState.scaleOpen = false
}

function openScaleStopColor(stop, el) {
  colorPop.key = stop.key
  openColorPicker('cf-scale', el, true)
}

function colIndexFromLetters(letters) {
  let n = 0
  const s = String(letters || '').toUpperCase()
  for (let i = 0; i < s.length; i += 1) n = n * 26 + (s.charCodeAt(i) - 64)
  return Math.max(0, n - 1)
}

function parseCfRangeText(text) {
  const raw = String(text || '').trim().toUpperCase().replace(/\$/g, '')
  const m = raw.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/)
  if (!m) return cfSelection()
  const c1 = colIndexFromLetters(m[1])
  const r1 = Math.max(0, Number(m[2]) - 1)
  const c2 = m[3] ? colIndexFromLetters(m[3]) : c1
  const r2 = m[4] ? Math.max(0, Number(m[4]) - 1) : r1
  return [{
    row: [Math.min(r1, r2), Math.max(r1, r2)],
    column: [Math.min(c1, c2), Math.max(c1, c2)],
  }]
}

function selectionToA1(sel) {
  if (!sel) return 'A1'
  const r0 = sel.row?.[0] ?? 0
  const r1 = sel.row?.[1] ?? r0
  const c0 = sel.column?.[0] ?? 0
  const c1 = sel.column?.[1] ?? c0
  const a = `${colLetter(c0)}${r0 + 1}`
  const b = `${colLetter(c1)}${r1 + 1}`
  return a === b ? a : `${a}:${b}`
}

function syncCfRangeFromSelection(sel) {
  if (!cfState.pickingRange || !cfState.side || cfState.panel === 'rules') return
  const text = selectionToA1(sel || cfSelection()[0])
  if (text) cfForm.range = text
}

function toggleCfRangePick() {
  cfState.kindOpen = false
  cfState.scaleOpen = false
  cfState.pickingRange = !cfState.pickingRange
  if (cfState.pickingRange) syncCfRangeFromSelection()
}

function beginCfRangePick() {
  cfState.kindOpen = false
  cfState.scaleOpen = false
  cfState.pickingRange = true
  syncCfRangeFromSelection()
}

function onCfRangeFocus() {
  beginCfRangePick()
}

function closeCfSide() {
  cfState.dlg = ''
  cfState.side = false
  cfState.pickingRange = false
  cfState.kindOpen = false
  cfState.scaleOpen = false
  cfState.scopeOpen = false
}

function cfTargetRange() {
  if (cfState.side && cfForm.range) return parseCfRangeText(cfForm.range)
  return cfSelection()
}

function openCfRules() {
  pop.show = false
  cfState.fly = ''
  cfState.ruleScope = 'sel'
  cfState.scopeOpen = false
  refreshCfFlags()
  beauty.show = false
  cfState.side = true
  cfState.panel = 'rules'
  cfState.dlg = 'rules'
  markActiveTools()
}

function backCf() {
  cfState.ruleScope = 'sel'
  cfState.scopeOpen = false
  refreshCfFlags()
  cfState.panel = 'rules'
  cfState.dlg = 'rules'
}

function focusCfRule(rule) {
  const range = rule?.cellrange?.[0]
  const api = instRef.current
  if (!range || !api?.setSelection) return
  api.setSelection([{
    row: [range.row[0], range.row[1]],
    column: [range.column[0], range.column[1]],
  }])
  scheduleDataBars()
}

function cfRuleText(rule) {
  if (rule.type === 'colorGradation') return '色阶'
  if (rule.type === 'dataBar') return '数据条'
  if (rule.type === 'icons') return '图标集'
  if (rule.conditionName === 'formula' || rule.type === 'formula') return '自定义公式'
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

function cfRulePreviewStyle(rule) {
  if (rule.type === 'colorGradation' && rule.format?.length) {
    return { background: `linear-gradient(90deg, ${[...rule.format].reverse().join(',')})`, color: 'transparent' }
  }
  if (rule.type === 'dataBar' && rule.format?.length) {
    const c0 = rule.format[0]
    const c1 = rule.format[1] || '#ffffff'
    return { background: `linear-gradient(90deg, ${c0} 0%, ${c0} 55%, ${c1} 55%, ${c1} 100%)`, color: 'transparent' }
  }
  if (rule.type === 'icons') {
    return { background: '#f5f6f7', color: '#1f2329' }
  }
  return {
    color: rule.format?.textColor || '#1f2329',
    background: rule.format?.cellColor || '#ffc7ce',
  }
}

function cfRulePreviewText(rule) {
  if (rule.type === 'colorGradation' || rule.type === 'dataBar') return ''
  if (rule.type === 'icons') return '▲'
  return '123'
}

function removeCfRule(rule) {
  if (!rule) return
  const ranges = rule.cellrange || []
  const sheet = cfSheet()
  if (rule._src === 'bar') {
    if (sheet) {
      removeCfRulesUndoable(null, barRulesOf(sheet).filter((_, i) => i !== rule._idx), [rule])
    }
  } else {
    const nextNative = cfRules().filter((_, i) => i !== rule._idx)
    const wipe = isCfVisualRule(rule) ? [rule] : []
    const nextBars = sheet && rule.type === 'icons'
      ? barRulesOf(sheet).filter((r) => !(r.cellrange || []).some((range) => ranges.some((s) => rangesOverlap(range, s))))
      : null
    removeCfRulesUndoable(nextNative, nextBars, wipe)
  }
  markActiveTools()
}

function toggleCfScopeMenu(e) {
  cfState.kindOpen = false
  cfState.scaleOpen = false
  if (cfState.scopeOpen) {
    cfState.scopeOpen = false
    return
  }
  const el = e?.currentTarget
  const r = el?.getBoundingClientRect?.()
  if (r) {
    cfState.scopeY = r.bottom + 4
    cfState.scopeX = r.left
    cfState.scopeW = Math.max(160, r.width + 24)
  }
  cfState.scopeOpen = true
}

function pickCfScope(id) {
  cfState.ruleScope = id
  cfState.scopeOpen = false
  refreshCfFlags()
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
  const presetKinds = ['color', 'bar', 'icons']
  cfState.side = side && (!!CF_RULES[type] || presetKinds.includes(type))
  if (cfState.side) {
    const sel = cfSelection()[0]
    const a = `${colLetter(sel.column[0])}${sel.row[0] + 1}`
    const b = `${colLetter(sel.column[1])}${sel.row[1] + 1}`
    cfForm.range = a === b ? a : `${a}:${b}`
    if (presetKinds.includes(type)) {
      cfForm.kind = type
      if (type === 'color') {
        const preset = CF_FLIES.color.find((x) => x.id === 'cg-gyr') || CF_FLIES.color[0]
        cfForm.presetId = preset?.id || ''
        syncScaleStops(preset)
      } else {
        cfForm.presetId = CF_FLIES[type][0]?.id || ''
      }
      cfState.dlg = type
      cfState.scaleOpen = false
      cfState.kindOpen = false
    } else if (type === 'formula') {
      cfForm.kind = 'formula'
      cfForm.cellColor = '#c6efce'
      cfForm.textColor = '#1f2329'
    } else if (['top10', 'top10_percent', 'last10', 'last10_percent', 'aboveAverage', 'belowAverage'].includes(type)) {
      cfForm.kind = 'item'
      cfForm.percent = type.endsWith('_percent')
      cfForm.rank = type.startsWith('last') ? 'last' : type === 'aboveAverage' ? 'above' : type === 'belowAverage' ? 'below' : 'top'
      if (type.startsWith('top') || type.startsWith('last')) cfForm.project = '10'
      cfForm.cellColor = '#c6efce'
      cfForm.textColor = '#1f2329'
    } else {
      const group = Object.keys(CF_OPS).find((id) => CF_OPS[id].some((op) => op.id === type)) || 'value'
      cfForm.group = group
      cfForm.kind = 'highlight'
      cfForm.cellColor = '#c6efce'
      cfForm.textColor = '#1f2329'
    }
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
  cfForm.presetId = ''
  cfState.kindOpen = false
  if (id === 'item') {
    cfForm.rank = 'top'
    cfForm.percent = false
    cfForm.project = '10'
    cfState.dlg = 'top10'
    return
  }
  if (id === 'formula') {
    cfState.dlg = 'formula'
    cfForm.formula = cfForm.formula || ''
    return
  }
  if (id === 'color') {
    const preset = CF_FLIES.color.find((x) => x.id === 'cg-gyr') || CF_FLIES.color[0]
    cfForm.presetId = preset?.id || ''
    syncScaleStops(preset)
    cfState.dlg = 'color'
    cfState.scaleOpen = false
    return
  }
  if (id === 'bar') {
    cfForm.presetId = CF_FLIES.bar[0]?.id || ''
    cfState.dlg = 'bar'
    return
  }
  if (id === 'icons') {
    cfForm.presetId = CF_FLIES.icons[0]?.id || ''
    cfState.dlg = 'icons'
    return
  }
  cfForm.group = 'value'
  cfState.dlg = 'greaterThan'
}

function pickCfPreset(item) {
  cfForm.presetId = item.id
  if (item.type === 'colorGradation') syncScaleStops(item)
}

function confirmSidePreset() {
  const list = cfForm.kind === 'color'
    ? CF_FLIES.color
    : cfForm.kind === 'bar'
      ? CF_FLIES.bar
      : CF_FLIES.icons
  const item = list.find((x) => x.id === cfForm.presetId) || list[0]
  if (!item) return
  if (cfForm.kind === 'color') {
    applyPreset({ ...item, format: scaleFormatFromStops() }, cfTargetRange())
  } else {
    applyPreset(item, cfTargetRange())
  }
  cfState.dlg = ''
  cfState.side = false
  cfState.scaleOpen = false
  cfState.kindOpen = false
  cfState.pickingRange = false
}

function syncRankType() {
  if (cfForm.rank === 'above') cfState.dlg = 'aboveAverage'
  else if (cfForm.rank === 'below') cfState.dlg = 'belowAverage'
  else if (cfForm.rank === 'last') cfState.dlg = cfForm.percent ? 'last10_percent' : 'last10'
  else cfState.dlg = cfForm.percent ? 'top10_percent' : 'top10'
}

function parseRgb(color) {
  const m = String(color).match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (m) return [+m[1], +m[2], +m[3]]
  return [255, 255, 255]
}
function mixRgb(a, b, t) {
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(', ')})`
}
function scaleColor(format, t) {
  const cols = format.map(parseRgb)
  if (cols.length < 2) return format[0]
  if (cols.length === 2) return mixRgb(cols[0], cols[1], t)
  if (t <= 0.5) return mixRgb(cols[0], cols[1], t * 2)
  return mixRgb(cols[1], cols[2], (t - 0.5) * 2)
}
function cfNumericCells(ranges) {
  const api = instRef.current
  const sheet = api?.getSheet?.()
  if (!api?.setCellValue || !sheet) return null
  const cells = []
  ;(ranges || cfSelection()).forEach((range) => {
    for (let r = range.row[0]; r <= range.row[1]; r += 1) {
      for (let c = range.column[0]; c <= range.column[1]; c += 1) {
        const cell = sheet.data?.[r]?.[c]
        const raw = cell && typeof cell === 'object' ? (cell.v ?? cell.m) : cell
        const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/,/g, ''))
        if (Number.isFinite(n)) cells.push({ r, c, n, cell })
      }
    }
  })
  if (!cells.length) return null
  return { api, sheet, cells }
}
function cfPlainText(prev, n) {
  return String(prev?.m ?? n)
    .replace(/[↑→↓↗↘▲▼▬●⬤◆✓✕!⚑★☆▂▃▄█▁◕◑◔○▣□\s]/g, '')
    .replace(/,/g, '')
    || String(n)
}
/** 计算数据条规则的批量 ops：sel 范围内互斥替换，add 为新增规则；同时同步本地缓存 */
function barRuleOpsOf(sheet, sel, add) {
  const kept = barRulesOf(sheet).filter((rule) => !(rule.cellrange || []).some((range) => sel.some((s) => rangesOverlap(range, s))))
  const next = add ? [...kept, { format: add.format, cellrange: sel }] : kept
  if (sheet) dataBarStore.set(sheetBarKey(sheet), next)
  return {
    rules: next,
    ops: sheet ? [
      { op: 'replace', id: sheet.id, path: ['config', 'fs_data_bars'], value: next },
      { op: 'replace', id: sheet.id, path: ['fs_data_bars'], value: next },
    ] : [],
  }
}

/** 与 clearCfVisual 相同的清除语义，返回清除后的单元格（不落盘） */
function clearedCellOf(cell, n) {
  const prev = cell && typeof cell === 'object' ? cell : { v: n, m: String(n) }
  const text = cfPlainText(prev, n)
  const num = Number(text)
  const value = Number.isFinite(num) ? num : n
  return {
    ...prev,
    v: value,
    m: String(value),
    bg: null,
    fsBarColor: undefined,
    fc: prev.fsBarColor || (isWhiteFont(prev.fc) ? '#1f2329' : prev.fc),
    ht: prev.ht === 2 ? 1 : prev.ht,
    ct: { fa: prev.ct?.fa && prev.ct.fa !== 'General' ? prev.ct.fa : 'General', t: 'n' },
  }
}

/** 格子里是否带有条件格式画上的视觉痕迹（色阶 bg / 数据条 fsBarColor / 图标字符） */
function cfCellHasVisual(cell) {
  if (!cell || typeof cell !== 'object') return false
  if (cell.fsBarColor != null || cell.bg != null) return true
  if (cell.ct?.t === 'inlineStr') return true
  return typeof cell.m === 'string' && /[↑→↓↗↘▲▼▬●⬤◆✓✕!⚑★☆▂▃▄█▁◕◑◔○▣□]/.test(cell.m)
}

/** 会往单元格写视觉痕迹的规则类型（其余类型由 fortune 原生渲染，删规则即消失） */
function isCfVisualRule(rule) {
  return rule?.type === 'colorGradation' || rule?.type === 'dataBar' || rule?.type === 'icons'
}

/** 删除规则时同时还原被画过的单元格；规则与单元格合并为一步可撤销操作（wipeRules 为被删的规则） */
function removeCfRulesUndoable(nextNative, nextBars, wipeRules) {
  const api = instRef.current
  const sheet = api?.getSheet?.()
  if (!api?.applyOp || !sheet?.id) return
  const ops = []
  if (nextNative) ops.push({ op: 'replace', id: sheet.id, path: ['luckysheet_conditionformat_save'], value: nextNative })
  if (nextBars) {
    dataBarStore.set(sheetBarKey(sheet), nextBars)
    ops.push(
      { op: 'replace', id: sheet.id, path: ['config', 'fs_data_bars'], value: nextBars },
      { op: 'replace', id: sheet.id, path: ['fs_data_bars'], value: nextBars },
    )
  }
  const wipeRanges = (wipeRules || []).flatMap((rule) => rule?.cellrange || [])
  if (wipeRanges.length) {
    const hadIcon = (wipeRules || []).some((rule) => rule?.type === 'icons')
    const seen = new Set()
    const pack = cfNumericCells(wipeRanges)
    pack?.cells.forEach(({ r, c, n, cell }) => {
      const key = `${r}_${c}`
      const visual = cfCellHasVisual(cell) || (hadIcon && cell && typeof cell === 'object' && cell.ht === 2)
      if (seen.has(key) || !visual) return
      seen.add(key)
      ops.push({ op: 'replace', id: sheet.id, path: ['data', r, c], value: clearedCellOf(cell, n) })
    })
  }
  if (ops.length) applyOpUndoable(ops)
  refreshCfFlags()
  scheduleDataBars()
}

/** 色阶：清除旧视觉 + 上色的单元格补丁（配合 applyOpUndoable 一次撤销） */
function buildColorScaleOps(format, sel) {  const pack = cfNumericCells(sel)
  if (!pack || !format?.length) return null
  const { sheet, cells } = pack
  const cleared = cells
    .filter(({ r }) => Array.isArray(sheet.data?.[r]))
    .map(({ r, c, n, cell }) => ({ r, c, cl: clearedCellOf(cell, n) }))
  if (!cleared.length) return null
  const ns = cleared.map(({ cl }) => (Number.isFinite(cl.v) ? cl.v : 0))
  const min = Math.min(...ns)
  const max = Math.max(...ns)
  return cleared.map(({ r, c, cl }, i) => {
    const t = max === min ? 0.5 : (ns[i] - min) / (max - min)
    return {
      op: 'replace', id: sheet.id, path: ['data', r, c],
      value: { ...cl, bg: scaleColor(format, t) },
    }
  })
}

function barColor(color, alpha) {
  const hex = String(color || '#638ec6').trim()
  const m = hex.match(/^#([0-9a-f]{6})$/i)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
function sizeList(api, sheet, count, kind) {
  const idx = Array.from({ length: count }, (_, i) => i)
  const conf = kind === 'c' ? sheet.config?.columnlen : sheet.config?.rowlen
  try {
    const got = kind === 'c'
      ? api.getColumnWidth?.(idx, { id: sheet.id })
      : api.getRowHeight?.(idx, { id: sheet.id })
    if (got && typeof got === 'object') {
      return idx.map((i) => {
        const n = Number(got[i] ?? got[String(i)])
        if (Number.isFinite(n) && n > 0) return n
        const fallback = Number(conf?.[i] ?? conf?.[String(i)])
        return Number.isFinite(fallback) && fallback > 0 ? fallback : (kind === 'c' ? 73 : 24)
      })
    }
  } catch { /* 用配置或默认尺寸 */ }
  return idx.map((i) => {
    const fallback = Number(conf?.[i] ?? conf?.[String(i)])
    return Number.isFinite(fallback) && fallback > 0 ? fallback : (kind === 'c' ? 73 : 24)
  })
}
function restoreBarText(api, sheet) {
  const rules = barRulesOf(sheet)
  rules.forEach((rule) => {
    ;(rule.cellrange || []).forEach((range) => {
      for (let r = range.row[0]; r <= range.row[1]; r += 1) {
        for (let c = range.column[0]; c <= range.column[1]; c += 1) {
          const cell = sheet.data?.[r]?.[c]
          if (!cell || typeof cell !== 'object') continue
          if (!/[█░]/.test(String(cell.m || ''))) continue
          const n = Number(cfPlainText(cell, cell.v))
          if (!Number.isFinite(n)) continue
          api.setCellValue(r, c, { v: n, m: String(n), ct: { fa: 'General', t: 'n' } }, { id: sheet.id })
        }
      }
    })
  })
}
function isWhiteFont(color) {
  const hex = String(color || '').replace('#', '').toLowerCase()
  return hex === 'fff' || hex === 'ffffff'
}
function barTextColor(cell) {
  if (cell?.fsBarColor && !isWhiteFont(cell.fsBarColor)) return cell.fsBarColor
  if (cell?.fc && !isWhiteFont(cell.fc)) return cell.fc
  return '#1f2329'
}
function cellBgColor(cell) {
  const bg = cell?.bg
  if (!bg || bg === 'null' || bg === 'undefined') return '#ffffff'
  const hex = String(bg).trim()
  if (!hex || hex === 'transparent') return '#ffffff'
  return hex
}
function barDisplayText(cell, n) {
  if (cell && typeof cell === 'object') {
    if (cell.m != null && String(cell.m).trim() !== '') return String(cell.m)
    if (cell.ct?.s?.length) {
      return cell.ct.s.map((p) => p?.v ?? '').join('')
    }
  }
  return Number.isFinite(n) ? String(n) : ''
}
function hideBarCanvasText(api, sheet, cells) {
  if (!api?.setCellFormatByRange || !sheet || !cells?.length) return
  cells.forEach(({ r, c, cell }) => {
    if (!cell || typeof cell !== 'object') return
    const real = barTextColor(cell)
    const hide = cellBgColor(cell)
    if (isWhiteFont(cell.fc) && cell.fsBarColor) return
    if (String(cell.fc).toLowerCase() === String(hide).toLowerCase() && cell.fsBarColor) return
    api.setCellValue(r, c, {
      ...cell,
      v: cell.v,
      m: cell.m,
      ct: cell.ct,
      fsBarColor: real,
      fc: hide,
    }, { id: sheet.id })
  })
}
function drawDataBars() {
  const api = instRef.current
  const sheet = api?.getSheet?.()
  const area = hostRef.value?.querySelector('.fortune-cell-area')
  if (!api || !sheet || !area) return
  let layer = area.querySelector('.fs-databar-layer')
  if (!layer) {
    layer = document.createElement('div')
    layer.className = 'fs-databar-layer'
    area.appendChild(layer)
  } else if (layer.parentElement === area && area.lastElementChild !== layer) {
    area.appendChild(layer)
  }
  layer.innerHTML = ''
  const rules = barRulesOf(sheet)
  if (!rules.length) {
    // 无数据条时把藏起来的画布字还原
    if (!barHideBusy) {
      const tagged = []
      const data = sheet.data || []
      for (let r = 0; r < data.length; r += 1) {
        const row = data[r] || []
        for (let c = 0; c < row.length; c += 1) {
          const cell = row[c]
          if (cell?.fsBarColor) tagged.push({ r, c, cell })
        }
      }
      if (tagged.length) {
        barHideBusy = true
        tagged.forEach(({ r, c, cell }) => {
          api.setCellValue(r, c, {
            ...cell,
            v: cell.v,
            m: cell.m,
            ct: cell.ct,
            fc: cell.fsBarColor,
            fsBarColor: undefined,
          }, { id: sheet.id })
        })
        requestAnimationFrame(() => { barHideBusy = false })
      }
    }
    return
  }
  const rows = sheet.data?.length || sheet.row || 0
  const cols = sheet.data?.[0]?.length || sheet.column || 0
  const widths = sizeList(api, sheet, cols, 'c')
  const heights = sizeList(api, sheet, rows, 'r')
  const scrollX = Number(sheet.scrollLeft) || 0
  const scrollY = Number(sheet.scrollTop) || 0
  const colPitch = widths.map((w) => w + 1)
  const rowPitch = heights.map((h) => h + 1)
  const colPos = [0]
  const rowPos = [0]
  colPitch.forEach((w) => colPos.push(colPos[colPos.length - 1] + w))
  rowPitch.forEach((h) => rowPos.push(rowPos[rowPos.length - 1] + h))
  const hideCells = []
  rules.forEach((rule) => {
    const cells = []
    ;(rule.cellrange || []).forEach((range) => {
      for (let r = range.row[0]; r <= range.row[1]; r += 1) {
        for (let c = range.column[0]; c <= range.column[1]; c += 1) {
          const cell = sheet.data?.[r]?.[c]
          const raw = cell && typeof cell === 'object' ? (cell.v ?? cell.m) : cell
          const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/[↑→↓⚑●█░,%\s]/g, ''))
          if (Number.isFinite(n)) cells.push({ r, c, n, cell })
        }
      }
    })
    if (!cells.length) return
    const min = Math.min(...cells.map((x) => x.n))
    const max = Math.max(...cells.map((x) => x.n))
    const color = rule.format?.[0] || '#638ec6'
    const gradient = (rule.format || []).length > 1
    cells.forEach(({ r, c, n, cell }) => {
      hideCells.push({ r, c, cell })
      const left = (colPos[c] || 0) - scrollX
      const top = (rowPos[r] || 0) - scrollY
      const cellW = widths[c] || 73
      const cellH = heights[r] || 24
      const padX = 2
      const padY = Math.max(3, Math.round(cellH * 0.18))
      const innerW = Math.max(cellW - padX * 2, 1)
      const barH = Math.max(cellH - padY * 2, 1)
      let origin = 0
      let t = 1
      if (min >= 0) {
        t = max === 0 ? 0 : n / max
      } else if (max <= 0) {
        t = min === 0 ? 0 : Math.abs(n) / Math.abs(min)
        origin = 1 - t
      } else {
        const axis = Math.abs(min) / (max - min)
        if (n >= 0) {
          t = max === 0 ? 0 : (n / max) * (1 - axis)
          origin = axis
        } else {
          t = min === 0 ? 0 : (Math.abs(n) / Math.abs(min)) * axis
          origin = axis - t
        }
      }
      const barW = Math.min(innerW, Math.max(n === 0 ? 0 : 2, Math.round(innerW * t)))
      const el = document.createElement('i')
      el.className = 'fs-databar'
      el.style.left = `${left + padX + Math.round(innerW * origin)}px`
      el.style.top = `${top + padY}px`
      el.style.width = `${barW}px`
      el.style.height = `${barH}px`
      el.style.maxWidth = `${innerW}px`
      el.style.background = gradient ? `linear-gradient(90deg, ${color}, #ffffff)` : color
      layer.appendChild(el)
      // 数字盖在数据条上方，避免被条遮住
      const label = document.createElement('span')
      label.className = 'fs-databar-num'
      label.textContent = barDisplayText(cell, n)
      label.style.left = `${left}px`
      label.style.top = `${top}px`
      label.style.width = `${cellW}px`
      label.style.height = `${cellH}px`
      label.style.lineHeight = `${cellH}px`
      label.style.color = barTextColor(cell)
      label.style.textAlign = cell?.ht === 0 ? 'center' : cell?.ht === 1 ? 'left' : 'right'
      if (cell?.bl) label.style.fontWeight = '700'
      if (cell?.it) label.style.fontStyle = 'italic'
      if (cell?.fs) label.style.fontSize = `${cell.fs}px`
      layer.appendChild(label)
    })
  })
  // 藏掉画布字，只留上层 label，保证每个格子只有一个可见值
  if (!barHideBusy && hideCells.length) {
    barHideBusy = true
    hideBarCanvasText(api, sheet, hideCells)
    requestAnimationFrame(() => { barHideBusy = false })
  }
}
/** 数据条：清除旧视觉 + 写入条样式的单元格补丁（一次撤销） */
function buildDataBarOps(format, sel) {
  const pack = cfNumericCells(sel)
  if (!pack) return null
  const { sheet, cells } = pack
  const cleared = cells
    .filter(({ r }) => Array.isArray(sheet.data?.[r]))
    .map(({ r, c, n, cell }) => ({ r, c, cl: clearedCellOf(cell, n) }))
  if (!cleared.length) return null
  return cleared.map(({ r, c, cl }) => ({
    op: 'replace', id: sheet.id, path: ['data', r, c],
    value: {
      ...cl,
      m: cl.m != null && cl.m !== '' ? cl.m : String(cl.v),
      bg: cl.bg ?? null,
      ht: cl.ht ?? 2,
      fsBarColor: barTextColor(cl),
      fc: cellBgColor(cl),
      ct: cl.ct ? { ...cl.ct } : { fa: 'General', t: 'n' },
    },
  }))
}
/** 图标集：清除旧字形 + 右对齐的单元格补丁（一次撤销） */
function buildIconOps(item, sel) {
  const pack = cfNumericCells(sel)
  if (!pack) return null
  const { sheet, cells } = pack
  const ops = []
  cells.forEach(({ r, c, n, cell }) => {
    if (!Array.isArray(sheet.data?.[r])) return
    if (!cell || typeof cell !== 'object') {
      if (Number.isFinite(n)) {
        ops.push({ op: 'replace', id: sheet.id, path: ['data', r, c], value: { v: n, m: String(n), ht: 2, ct: { fa: 'General', t: 'n' } } })
      }
      return
    }
    const m = String(cell.m ?? '')
    const hasGlyph = cell.ct?.t === 'inlineStr' || /[↑→↓↗↘▲▼▬●⬤◆✓✕!⚑★☆▂▃▄█▁◕◑◔○▣□]/.test(m)
    const fa = (!hasGlyph && cell.ct?.fa) ? cell.ct.fa : (cell.ct?.fa && cell.ct.t !== 'inlineStr' ? cell.ct.fa : 'General')
    ops.push({
      op: 'replace', id: sheet.id, path: ['data', r, c],
      value: {
        ...cell,
        v: cell.v ?? n,
        m: hasGlyph
          ? (fa.includes('%') && Number.isFinite(n) ? `${Math.round(n * 1000) / 10}%`.replace(/\.0%/, '%') : String(n))
          : (cell.m ?? String(n)),
        ht: 2,
        bg: cell.bg ?? null,
        ct: cell.ct && cell.ct.t !== 'inlineStr' ? { ...cell.ct } : { fa, t: 'n' },
      },
    })
  })
  return ops.length ? ops : null
}
function iconRules() {
  return cfRules().filter((rule) => rule.type === 'icons')
}
function drawIconSets() {
  const api = instRef.current
  const sheet = api?.getSheet?.()
  const area = hostRef.value?.querySelector('.fortune-cell-area')
  if (!api || !sheet || !area) return
  let layer = area.querySelector('.fs-iconset-layer')
  if (!layer) {
    layer = document.createElement('div')
    layer.className = 'fs-iconset-layer'
    area.appendChild(layer)
  } else if (area.lastElementChild !== layer && area.querySelector('.fs-databar-layer')) {
    // 保持在数据条层之上或并列
    area.appendChild(layer)
  }
  layer.innerHTML = ''
  const rules = iconRules()
  if (!rules.length) return
  const rows = sheet.data?.length || sheet.row || 0
  const cols = sheet.data?.[0]?.length || sheet.column || 0
  const widths = sizeList(api, sheet, cols, 'c')
  const heights = sizeList(api, sheet, rows, 'r')
  const scrollX = Number(sheet.scrollLeft) || 0
  const scrollY = Number(sheet.scrollTop) || 0
  const colPitch = widths.map((w) => w + 1)
  const rowPitch = heights.map((h) => h + 1)
  const colPos = [0]
  const rowPos = [0]
  colPitch.forEach((w) => colPos.push(colPos[colPos.length - 1] + w))
  rowPitch.forEach((h) => rowPos.push(rowPos[rowPos.length - 1] + h))
  rules.forEach((rule) => {
    const glyphs = rule.glyphs || cfIconGlyphs(rule)
    const count = Math.max(1, glyphs.length || rule.marks?.length || 3)
    const cells = []
    ;(rule.cellrange || []).forEach((range) => {
      for (let r = range.row[0]; r <= range.row[1]; r += 1) {
        for (let c = range.column[0]; c <= range.column[1]; c += 1) {
          const cell = sheet.data?.[r]?.[c]
          const raw = cell && typeof cell === 'object' ? (cell.v ?? cell.m) : cell
          const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/[↑→↓↗↘▲▼▬●⬤◆✓✕!⚑★☆▂▃▄█▁◕◑◔○▣□,%\s]/g, ''))
          if (Number.isFinite(n)) cells.push({ r, c, n, cell })
        }
      }
    })
    if (!cells.length) return
    const min = Math.min(...cells.map((x) => x.n))
    const max = Math.max(...cells.map((x) => x.n))
    cells.forEach(({ r, c, n }) => {
      const t = max === min ? 1 : (n - min) / (max - min)
      // 高值 → glyphs[0]
      const bucket = Math.min(count - 1, Math.max(0, Math.floor((1 - t) * count)))
      const glyph = glyphs[bucket] || glyphs[0]
      const left = (colPos[c] || 0) - scrollX
      const top = (rowPos[r] || 0) - scrollY
      const cellW = widths[c] || 73
      const cellH = heights[r] || 24
      const icon = document.createElement('span')
      icon.className = 'fs-iconset-mark'
      icon.style.left = `${left + 4}px`
      icon.style.top = `${top + Math.max(0, (cellH - 16) / 2)}px`
      icon.style.width = '16px'
      icon.style.height = '16px'
      icon.innerHTML = cfIconGlyphHtml(glyph, 16)
      layer.appendChild(icon)
    })
  })
}
function applyPreset(item, ranges) {
  pop.show = false
  cfState.fly = ''
  const cellrange = ranges || cfSelection()
  const sheet = cfSheet()
  // 高亮规则类：仍走 patchCf（规则本身就是单步可撤销）
  if (item.type !== 'colorGradation' && item.type !== 'dataBar' && item.type !== 'icons') {
    patchCf([
      ...cfRules().filter((rule) => rule.type !== 'dataBar' && rule.type !== 'colorGradation' && rule.type !== 'icons'),
      {
        type: item.type,
        cellrange,
        format: item.format,
        ...(item.marks ? { marks: item.marks } : {}),
      },
    ])
    markActiveTools()
    return
  }
  // 色阶 / 数据条 / 图标集：单元格补丁 + 规则补丁合并为一次 applyOpUndoable
  let cellOps = null
  let ruleAdd = null
  let cfValue = null
  if (item.type === 'colorGradation') {
    cellOps = buildColorScaleOps(item.format, cellrange)
    cfValue = [
      ...cfRules().filter((rule) => rule.type !== 'dataBar' && rule.type !== 'colorGradation' && rule.type !== 'icons'),
      { type: item.type, cellrange, format: item.format, ...(item.marks ? { marks: item.marks } : {}) },
    ]
  } else if (item.type === 'dataBar') {
    cellOps = buildDataBarOps(item.format, cellrange)
    ruleAdd = item
    // 数据条与色阶/图标集互斥：顺带清掉旧规则
    const native = cfRules().filter((rule) => rule.type !== 'dataBar' && rule.type !== 'colorGradation' && rule.type !== 'icons')
    if (native.length !== cfRules().length) cfValue = native
  } else if (item.type === 'icons') {
    cellOps = buildIconOps(item, cellrange)
    cfValue = [
      ...cfRules().filter((rule) => rule.type !== 'dataBar' && rule.type !== 'colorGradation' && rule.type !== 'icons'),
      {
        type: 'icons',
        cellrange,
        format: item.format,
        marks: item.marks,
        preview: item.preview,
        glyphs: cfIconGlyphs(item),
        iconId: item.id,
      },
    ]
  }
  if (!cellOps) { markActiveTools(); return }
  const { ops: barOps } = barRuleOpsOf(sheet, cellrange, ruleAdd)
  let ops = [...cellOps, ...barOps]
  if (cfValue && sheet) {
    ops = [...ops, { op: 'replace', id: sheet.id, path: ['luckysheet_conditionformat_save'], value: cfValue }]
  }
  applyOpUndoable(ops)
  scheduleDataBars()
  refreshCfFlags()
  markActiveTools()
}

function confirmCfDialog() {
  const type = cfState.dlg
  if (!type || type === 'manage') {
    cfState.dlg = ''
    return
  }
  if (cfForm.kind === 'color' || cfForm.kind === 'bar' || cfForm.kind === 'icons') {
    confirmSidePreset()
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
  const rule = {
    type: 'default',
    cellrange: cfTargetRange(),
    format,
    conditionName: type === 'formula' ? 'formula' : type,
    conditionRange: [],
    conditionValue: normalizeCfConditionValue(type, conditionValue),
  }
  patchCf([...cfRules(), rule])
  paintHighlightRule(rule)
  cfState.dlg = ''
  cfState.side = false
  cfState.pickingRange = false
  cfState.kindOpen = false
  cfState.scaleOpen = false
}

function normalizeCfConditionValue(type, values) {
  if (!['greaterThan', 'lessThan', 'equal', 'between'].includes(type)) return values
  const api = instRef.current
  const sheet = api?.getSheet?.()
  const sel = cfSelection()?.[0]
  const sample = sheet?.data?.[sel?.row?.[0]]?.[sel?.column?.[0]]
  const fa = sample?.ct?.fa || ''
  if (!fa.includes('%')) return values
  return values.map((raw) => {
    if (raw == null || raw === '') return raw
    const text = String(raw).trim()
    if (text.endsWith('%')) return String(Number(text.slice(0, -1)) / 100)
    const n = Number(text.replace(/,/g, ''))
    if (!Number.isFinite(n)) return raw
    // 百分比单元格里用户常输入 50 表示 50%，Fortune 比较用的是内部小数
    if (Math.abs(n) >= 1) return String(n / 100)
    return String(n)
  })
}

function cfCellNumber(cell) {
  if (cell == null || cell === '') return NaN
  if (typeof cell === 'number') return cell
  if (typeof cell !== 'object') return Number(String(cell).replace(/,/g, ''))
  const raw = cell.v ?? cell.m
  if (typeof raw === 'number') return raw
  const text = String(raw ?? '').replace(/,/g, '').trim()
  if (!text) return NaN
  if (text.endsWith('%')) {
    const n = Number(text.slice(0, -1))
    return Number.isFinite(n) ? n / 100 : NaN
  }
  return Number(text)
}
function cfCompareValue(raw, sampleCell) {
  if (raw == null || raw === '') return NaN
  const text = String(raw).trim()
  if (!text) return NaN
  if (text.endsWith('%')) {
    const n = Number(text.slice(0, -1))
    return Number.isFinite(n) ? n / 100 : NaN
  }
  const n = Number(text.replace(/,/g, ''))
  if (!Number.isFinite(n)) return NaN
  const fa = sampleCell?.ct?.fa || ''
  if (fa.includes('%') && Math.abs(n) >= 1) return n / 100
  return n
}
function paintHighlightRule(rule) {
  const api = instRef.current
  const sheet = api?.getSheet?.()
  if (!api?.setCellFormatByRange || !sheet || !rule) return
  const format = rule.format || {}
  // 颜色由 Fortune 条件格式 overlay 绘制；这里只补加粗/斜体等，绝不改 ct/v/m
  const styleAttrs = []
  if (format.bl) styleAttrs.push(['bl', 1])
  if (format.it) styleAttrs.push(['it', 1])
  if (format.un) styleAttrs.push(['un', format.un === 1 ? 1 : format.un])
  if (format.cl) styleAttrs.push(['cl', 1])
  if (!styleAttrs.length) return
  const name = rule.conditionName || ''
  const values = rule.conditionValue || []
  const cells = []
  ;(rule.cellrange || []).forEach((range) => {
    for (let r = range.row[0]; r <= range.row[1]; r += 1) {
      for (let c = range.column[0]; c <= range.column[1]; c += 1) {
        const cell = sheet.data?.[r]?.[c]
        cells.push({ r, c, cell, n: cfCellNumber(cell) })
      }
    }
  })
  if (!cells.length) return
  const nums = cells.map((x) => x.n).filter((n) => Number.isFinite(n))
  const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
  const sortedAsc = [...nums].sort((a, b) => a - b)
  const sortedDesc = [...nums].sort((a, b) => b - a)
  const rankN = Math.max(1, Number(values[0]) || 10)
  const sample = cells.find((x) => Number.isFinite(x.n))?.cell
  const threshold = cfCompareValue(values[0], sample)
  const threshold2 = cfCompareValue(values[1], sample)
  const dupMode = String(values[0] ?? '0')
  const textNeedle = String(values[0] ?? '')
  const counts = {}
  cells.forEach(({ cell }) => {
    const key = cellText(cell)
    counts[key] = (counts[key] || 0) + 1
  })
  cells.forEach(({ r, c, cell, n }) => {
    let hit = false
    if (name === 'greaterThan') hit = Number.isFinite(n) && Number.isFinite(threshold) && n > threshold
    else if (name === 'lessThan') hit = Number.isFinite(n) && Number.isFinite(threshold) && n < threshold
    else if (name === 'equal') hit = Number.isFinite(n) && Number.isFinite(threshold) ? n === threshold : cellText(cell) === String(values[0] ?? '')
    else if (name === 'between') {
      const lo = Math.min(threshold, threshold2)
      const hi = Math.max(threshold, threshold2)
      hit = Number.isFinite(n) && Number.isFinite(lo) && Number.isFinite(hi) && n >= lo && n <= hi
    } else if (name === 'textContains') hit = cellText(cell).includes(textNeedle)
    else if (name === 'duplicateValue') {
      const key = cellText(cell)
      hit = dupMode === '1' ? counts[key] === 1 : counts[key] > 1
    } else if (name === 'aboveAverage') hit = Number.isFinite(n) && n > avg
    else if (name === 'belowAverage') hit = Number.isFinite(n) && n < avg
    else if (name === 'top10') hit = Number.isFinite(n) && sortedDesc.indexOf(n) < rankN
    else if (name === 'last10') hit = Number.isFinite(n) && sortedAsc.indexOf(n) < rankN
    else if (name === 'top10_percent') {
      const cut = sortedDesc[Math.max(0, Math.ceil(sortedDesc.length * rankN / 100) - 1)]
      hit = Number.isFinite(n) && Number.isFinite(cut) && n >= cut
    } else if (name === 'last10_percent') {
      const cut = sortedAsc[Math.max(0, Math.ceil(sortedAsc.length * rankN / 100) - 1)]
      hit = Number.isFinite(n) && Number.isFinite(cut) && n <= cut
    }
    if (!hit) return
    const range = { row: [r, r], column: [c, c] }
    styleAttrs.forEach(([attr, value]) => {
      api.setCellFormatByRange(attr, value, range, { id: sheet.id })
    })
  })
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

function onColorToolbarCapture(e) {
  const colorHit = findColorCombo(e.target)
  if (!colorHit || !hostRef.value?.contains(colorHit)) return
  if (e.target.closest?.('.fortune-toolbar-combo-popup, .fortune-toolbar-select, .fortune-toolbar-color-picker, .cp')) return
  e.preventDefault()
  e.stopPropagation()
  // mousedown 负责开关；click 只拦截原生色板
  if (e.type !== 'mousedown') return
  const kind = colorKindOf(colorHit)
  if (colorPop.show && colorPop.kind === kind) {
    colorPop.show = false
    return
  }
  openColorPicker(kind, colorHit)
}

function onFreezeCapture(e) {
  const currencyHit = e.target?.closest?.(
    '.fortune-toolbar-button[data-tips="货币格式"], .fortune-toolbar-button:has(svg[data-paint="#currency-format"])',
  )
  if (currencyHit && hostRef.value?.contains(currencyHit)) {
    e.preventDefault()
    e.stopPropagation()
    applyNumFmt(NUM_FMTS.find((item) => item.id === 'cny'))
    return
  }
  const percentHit = e.target?.closest?.(
    '.fortune-toolbar-button[data-tips="百分比格式"], .fortune-toolbar-button:has(svg[data-paint="#percentage-format"])',
  )
  if (percentHit && hostRef.value?.contains(percentHit)) {
    e.preventDefault()
    e.stopPropagation()
    applyNumFmt(NUM_FMTS.find((item) => item.id === 'pct'))
    return
  }
  const styleHit = e.target?.closest?.('.fortune-toolbar-button[data-tips="粗体 (Ctrl+B)"]')
  if (styleHit && folded.value && hostRef.value?.contains(styleHit)) {
    if (e.target.closest?.('.fs-ht-menu')) return
    e.preventDefault()
    e.stopPropagation()
    openFoldStylePop(styleHit)
    return
  }
  const alignHit = e.target?.closest?.('.fortune-toobar-combo-container[data-label="对齐"], [data-tips="水平对齐"]')
  if (alignHit && folded.value && hostRef.value?.contains(alignHit)) {
    if (e.target.closest?.('.fortune-toolbar-combo-popup, .fortune-toolbar-select, .fs-ht-menu')) return
    e.preventDefault()
    e.stopPropagation()
    openFoldAlignPop(alignHit.closest('.fortune-toobar-combo-container') || alignHit)
    return
  }
  const wrapHit = e.target?.closest?.('.fortune-toobar-combo-container[data-label="文本换行"], [data-tips="文本换行"]')
  if (wrapHit && folded.value && hostRef.value?.contains(wrapHit)) {
    if (e.target.closest?.('.fortune-toolbar-combo-popup, .fortune-toolbar-select, .fs-ht-menu')) return
    e.preventDefault()
    e.stopPropagation()
    openFoldWrapPop(wrapHit.closest('.fortune-toobar-combo-container') || wrapHit)
    return
  }
  const vtHit = e.target?.closest?.('.fortune-toobar-combo-container[data-label="垂直对齐"], [data-tips="垂直对齐"]')
  if (vtHit && folded.value && hostRef.value?.contains(vtHit)) {
    if (e.target.closest?.('.fortune-toolbar-combo-popup, .fortune-toolbar-select, .fs-ht-menu')) return
    e.preventDefault()
    e.stopPropagation()
    openFoldVtPop(vtHit.closest('.fortune-toobar-combo-container') || vtHit)
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
    openFmtDlg()
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
  const dvHit = e.target?.closest?.('[data-label="下拉列表"], [data-tips="下拉列表"]')
  if (dvHit && hostRef.value?.contains(dvHit)) {
    e.preventDefault()
    e.stopPropagation()
    openValidation()
    return
  }
  const filterHit = e.target?.closest?.('.fortune-toobar-combo-container[data-label="筛选"], .fortune-toolbar-button[data-tips="筛选"]')
  if (filterHit && hostRef.value?.contains(filterHit)) {
    e.preventDefault()
    e.stopPropagation()
    if (e.target.closest?.('.fortune-toolbar-combo-arrow')) toggleFilterMenu(filterHit)
    else enableFilter()
    return
  }
  const commentHit = e.target?.closest?.(
    '.fortune-toolbar-button[data-label="评论"], .fortune-toolbar-button[data-tips="批注"], .fortune-toolbar-button:has(svg[data-paint="#comment"])',
  )
  if (commentHit && hostRef.value?.contains(commentHit)) {
    e.preventDefault()
    e.stopPropagation()
    const api = instRef.current
    const sheet = api?.getSheet?.()
    const sel = api?.getSelection?.()?.[0]
    const r = sel?.row?.[0] ?? 0
    const c = sel?.column?.[0] ?? 0
    const existing = sheet?.data?.[r]?.[c]?.ps?.value || ''
    openCtxDlg('comment', '添加批注', existing)
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

const ctxMenu = reactive({ show: false, x: 0, y: 0, fly: '', fly2: '', subLeft: false })
let ctxTarget = null
const ctxMenuRef = ref(null)
const ctxItems = computed(() => {
  if (props.tableType !== 'mixed') return CTX_ITEMS
  const out = []
  CTX_ITEMS.forEach((item) => {
    out.push(item)
    if (item.id === 'insert') {
      out.push({
        id: 'insertData',
        label: '插入数据',
        caret: true,
        children: MX_INSERT_ITEMS,
      })
      out.push({ id: 'mx-clear', label: '清除该格关联', danger: true })
    }
  })
  return out
})
function onCtxItemEnter(item) {
  ctxMenu.fly = item.caret ? item.id : ''
  ctxMenu.fly2 = ''
}
function onCtxSubEnter(sub) {
  ctxMenu.fly2 = sub.caret ? sub.id : ''
}
const sheetTabMenu = reactive({
  show: false,
  x: 0,
  y: 0,
  fly: '',
  sheetId: '',
  sheetName: '',
  tabEl: null,
})
const sheetListPop = reactive({
  open: false,
  query: '',
  left: 0,
  top: 0,
  activeId: '',
  rev: 0,
})
const sheetMore = reactive({ show: false, left: 0, top: 0 })
let sheetTabFrame = 0
let sheetTabObs = null
const sheetDrag = reactive({
  id: '',
  overId: '',
  moved: false,
})
const filteredSheetList = computed(() => {
  sheetListPop.rev
  const sheets = (instRef.current?.getAllSheets?.() || liveSheets() || [])
    .slice()
    .sort((a, b) => Number(a.order) - Number(b.order))
  const q = sheetListPop.query.trim().toLowerCase()
  if (!q) return sheets
  return sheets.filter((s) => String(s.name || '').toLowerCase().includes(q))
})
const sheetListCanDrag = computed(() => !sheetListPop.query.trim())

function isSheetHidden(sheet) {
  return Number(sheet?.hide) === 1 || sheet?.hide === true
}
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
const MX_INSERT_ITEMS = [
  { id: 'mx-value', label: '根据日期选择指标值' },
  { id: 'mx-date', label: '导入日期' },
  { id: 'mx-diff', label: '日期计算' },
  { id: 'mx-calc', label: '指标计算' },
  { id: 'mx-tpl', label: '生成指标对比模板' },
]
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
let copiedPack = null
let copyMarkOn = false
let copyMarkRaf = 0
const copyMark = reactive({ show: false, left: 0, top: 0, width: 0, height: 0, same: false })
const cellLog = new Map()
const ctxDlg = reactive({ show: false, title: '', text: '', mode: '', lines: [] })
const DV_CONDS = ['单选', '多选', '数字', '日期', '文本', '复选框', '手机号', '邮箱']
const DV_NUM_OPS = [
  ['between', '介于'],
  ['notBetween', '不介于'],
  ['eq', '等于'],
  ['ne', '不等于'],
  ['gt', '大于'],
  ['gte', '大于或等于'],
  ['lt', '小于'],
  ['lte', '小于或等于'],
]
const DV_TEXT_OPS = [
  ['contains', '包含'],
  ['notContains', '不包含'],
  ['eq', '等于'],
  ['starts', '开头是'],
  ['ends', '结尾是'],
  ['lenEq', '长度等于'],
  ['lenGt', '长度大于'],
  ['lenLt', '长度小于'],
]
const dvDlg = reactive({
  show: false,
  tab: 'set',
  cond: '单选',
  op: 'between',
  v1: '',
  v2: '',
  source: 'custom',
  text: '',
  refText: '',
  optionColor: true,
  showArrow: true,
  colors: {},
  colorEdit: false,
  hintOn: false,
  hintTitle: '',
  hintText: '',
  warnOn: true,
  warnStyle: 'stop',
  warnTitle: '',
  warnText: '',
})
const dvArrow = reactive({ show: false, left: 0, top: 0, r: 0, c: 0 })
const dvList = reactive({ show: false, left: 0, top: 0, options: [], multi: false, r: 0, c: 0, colors: {}, picked: [] })
const dvHint = reactive({ show: false, left: 0, top: 0, title: '', text: '' })
const dvCheck = reactive({ show: false, left: 0, top: 0, on: false, r: 0, c: 0 })

function selectionBox() {
  const api = instRef.current
  const sheet = api?.getSheet?.()
  const sel = api?.getSelection?.()?.[0]
    || ctxState()?.luckysheet_select_save?.[0]
  if (!sel || !sheet) return null
  const ra = sel.row?.[0] ?? 0
  const rb = sel.row?.[1] ?? ra
  const ca = sel.column?.[0] ?? 0
  const cb = sel.column?.[1] ?? ca
  return {
    r0: Math.min(ra, rb),
    r1: Math.max(ra, rb),
    c0: Math.min(ca, cb),
    c1: Math.max(ca, cb),
    id: sheet.id,
    sheet,
  }
}

function cloneCell(cell) {
  if (cell && typeof cell === 'object') {
    try { return JSON.parse(JSON.stringify(cell)) } catch { return { ...cell } }
  }
  return { v: cell ?? '' }
}

function readSelectionCells() {
  const box = selectionBox()
  if (!box) return []
  const rows = []
  for (let r = box.r0; r <= box.r1; r += 1) {
    const line = []
    for (let c = box.c0; c <= box.c1; c += 1) {
      line.push(cloneCell(box.sheet.data?.[r]?.[c]))
    }
    rows.push(line)
  }
  return rows
}

function rememberCopy() {
  const box = selectionBox()
  const rows = readSelectionCells()
  const text = rows.map((line) => line.map(cellPlain).join('\t')).join('\n')
  copiedPack = box ? {
    rows, r0: box.r0, r1: box.r1, c0: box.c0, c1: box.c1, sheetId: box.id, text,
  } : null
  if (copiedPack) showCopyMark()
  else hideCopyMark()
  return copiedPack
}

function hideCopyMark() {
  copyMarkOn = false
  copyMark.show = false
  copyMark.same = false
  if (copyMarkRaf) cancelAnimationFrame(copyMarkRaf)
  copyMarkRaf = 0
}

function copyRangeBox(ctx, pack) {
  const cols = ctx.visibledatacolumn
  const rows = ctx.visibledatarow
  if (!cols?.[pack.c1] || !rows?.[pack.r1]) return null
  const left = pack.c0 <= 0 ? 0 : cols[pack.c0 - 1]
  const top = pack.r0 <= 0 ? 0 : rows[pack.r0 - 1]
  const right = cols[pack.c1]
  const bottom = rows[pack.r1]
  return {
    left,
    top,
    width: Math.max(0, right - left - 1),
    height: Math.max(0, bottom - top - 1),
  }
}

function syncCopyMark() {
  const pack = copiedPack
  if (!copyMarkOn || !pack || !Number.isInteger(pack.r0)) {
    copyMark.show = false
    copyMark.same = false
    return
  }
  const ctx = reactStateBy((st) => Array.isArray(st.visibledatarow) && Array.isArray(st.visibledatacolumn)) || ctxState() || {}
  const sheet = instRef.current?.getSheet?.()
  if (sheet?.id && pack.sheetId && sheet.id !== pack.sheetId) {
    copyMark.show = false
    copyMark.same = false
    return
  }
  const sel = ctx.luckysheet_select_save?.[0]
  copyMark.same = !!(sel
    && sel.row?.[0] === pack.r0 && sel.row?.[1] === pack.r1
    && sel.column?.[0] === pack.c0 && sel.column?.[1] === pack.c1)
  if (copyMark.same) {
    const selected = hostRef.value?.querySelector('#luckysheet-cell-selected')
    const selectedBox = selected?.getBoundingClientRect()
    if (selectedBox && selectedBox.width > 1 && selectedBox.height > 1) {
      if (!copyMarkOn) {
        copyMark.show = false
        copyMark.same = false
        return
      }
      copyMark.show = true
      copyMark.left = selectedBox.left
      copyMark.top = selectedBox.top
      copyMark.width = selectedBox.width
      copyMark.height = selectedBox.height
      return
    }
  }
  const area = hostRef.value?.querySelector('.fortune-cell-area')
  const box = copyRangeBox(ctx, pack)
  if (!area || !box) {
    copyMark.show = false
    return
  }
  const areaBox = area.getBoundingClientRect()
  const scrollX = Number(ctx.scrollLeft) || 0
  const scrollY = Number(ctx.scrollTop) || 0
  let left = areaBox.left + box.left - scrollX - 1
  let top = areaBox.top + box.top - scrollY - 1
  let right = left + box.width + 2
  let bottom = top + box.height + 2
  if (right <= areaBox.left || bottom <= areaBox.top || left >= areaBox.right || top >= areaBox.bottom) {
    copyMark.show = false
    return
  }
  left = Math.max(left, areaBox.left)
  top = Math.max(top, areaBox.top)
  right = Math.min(right, areaBox.right)
  bottom = Math.min(bottom, areaBox.bottom)
  copyMark.show = right - left > 1 && bottom - top > 1
  copyMark.left = left
  copyMark.top = top
  copyMark.width = Math.max(0, right - left)
  copyMark.height = Math.max(0, bottom - top)
}

function showCopyMark() {
  copyMarkOn = true
  syncCopyMark()
  if (copyMarkRaf) return
  const tick = () => {
    if (!copyMarkOn) {
      copyMarkRaf = 0
      copyMark.show = false
      copyMark.same = false
      return
    }
    syncCopyMark()
    copyMarkRaf = requestAnimationFrame(tick)
  }
  copyMarkRaf = requestAnimationFrame(tick)
}

function logCell(r, c, value) {
  const key = `${r},${c}`
  const list = cellLog.get(key) || []
  list.push({ time: new Date().toLocaleString(), value: String(value ?? '') })
  cellLog.set(key, list.slice(-8))
}

const PASTE_FMT = ['bg', 'fc', 'bl', 'it', 'un', 'cl', 'fs', 'ff', 'ht', 'vt', 'tb', 'ct']

function pastedValue(cell) {
  if (cell == null || cell === '') return ''
  if (typeof cell !== 'object') return cell
  if (cell.f) {
    const body = formulaBody(cell.f)
    const isFormulaText = (x) => {
      const s = String(x ?? '').trim()
      return s === body || s === `=${body}` || s === String(cell.f).trim()
    }
    if (cell.v != null && cell.v !== '' && !isFormulaText(cell.v)) return cell.v
    if (cell.m != null && cell.m !== '' && !isFormulaText(cell.m)) return cell.m
  }
  if (cell.v != null && cell.v !== '') return cell.v
  if (cell.m != null) return cell.m
  return ''
}

function shiftedFormula(cell, dr, dc) {
  if (!cell?.f) return ''
  let f = String(cell.f).trim()
  if (!f) return ''
  if (!f.startsWith('=')) f = `=${f}`
  if (dr || dc) f = shiftFormula(f, dr, dc)
  return f
}

function writeCells(pack, mode) {
  const api = instRef.current
  const box = selectionBox()
  const rows = pack?.rows
  if (!api || !box || !rows?.length) return false
  const kind = mode === 'clip' || !mode ? 'all' : mode
  const canShift = Number.isInteger(pack.r0) && Number.isInteger(pack.c0)
  rows.forEach((line, ri) => {
    line.forEach((cell, ci) => {
      const r = box.r0 + ri
      const c = box.c0 + ci
      const range = { row: [r, r], column: [c, c] }
      const dr = canShift ? r - (pack.r0 + ri) : 0
      const dc = canShift ? c - (pack.c0 + ci) : 0
      if (kind !== 'format') {
        const formula = kind === 'value' ? '' : shiftedFormula(cell, dr, dc)
        const value = formula || pastedValue(cell)
        api.setCellValue?.(r, c, value, { id: box.id })
        logCell(r, c, value)
      }
      if (kind === 'all' || kind === 'format') {
        PASTE_FMT.forEach((key) => {
          if (cell?.[key] != null) api.setCellFormatByRange?.(key, cell[key], range, { id: box.id })
        })
      }
    })
  })
  return true
}

function clearSelection(mode) {
  const api = instRef.current
  const box = selectionBox()
  if (!api || !box) return
  const data = box.sheet?.data
  if (!Array.isArray(data)) return
  // 旧实现逐格调用 setCellValue/setCellFormatByRange：清格式每格 11 次 API，
  // 大选区直接卡死主线程，且每次调用各推一条撤销记录（撤销要按格按次按）。
  // 改为收集单元格补丁 op，一次 applyOpUndoable 提交：单次渲染 + 整块一次撤销。
  const FMT_KEYS = ['bg', 'fc', 'bl', 'it', 'un', 'cl', 'fs', 'ff', 'ht', 'vt', 'ct']
  const ops = []
  for (let r = box.r0; r <= box.r1; r += 1) {
    for (let c = box.c0; c <= box.c1; c += 1) {
      const cell = data[r]?.[c]
      if (!cell || typeof cell !== 'object' || Object.keys(cell).length === 0) continue
      if (mode === 'all') {
        // 全部清除：内容+格式一起，与原生 Delete 同形（空对象）
        ops.push({ op: 'replace', id: box.id, path: ['data', r, c], value: {} })
        logCell(r, c, '')
      } else if (mode === 'value') {
        // 清内容：只剥值/公式字段（v/m/f/si），保留样式（bg/bl/ct…）——对齐 Excel 清除内容
        const next = { ...cell }
        ;['v', 'm', 'f', 'si'].forEach((k) => { delete next[k] })
        ops.push({ op: 'replace', id: box.id, path: ['data', r, c], value: next })
        logCell(r, c, '')
      } else {
        // 清格式：剥掉样式键，保留 v/m/f 等内容字段
        if (!FMT_KEYS.some((k) => cell[k] != null)) continue
        const next = { ...cell }
        FMT_KEYS.forEach((k) => { delete next[k] })
        ops.push({ op: 'replace', id: box.id, path: ['data', r, c], value: next })
      }
    }
  }
  if (ops.length) {
    applyOpUndoable(ops)
    // 菜单点击后焦点落在 body，Cmd/Ctrl+Z 的监听在 .fortune-container 上收不到——
    // 把焦点还给 fortune 的输入元素（正常点格子后 fortune 也是 focus 在这里）
    requestAnimationFrame(() => {
      const el = document.getElementById('luckysheet-rich-text-editor')
        || document.getElementById('luckysheet-functionbox-cell')
      el?.focus?.()
    })
  }
}

function insertAxis(type, direction) {
  const box = selectionBox()
  const api = instRef.current
  if (!box || !api?.applyOp) return false
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
  return true
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

function captureSelectionImage() {
  const box = selectionBox()
  if (!box) return null
  const state = ctxState() || {}
  const a = geomByRC(state, box.r0, box.c0)
  const b = geomByRC(state, box.r1, box.c1)
  const canvases = [...(hostRef.value?.querySelectorAll('.fortune-sheet-container canvas, canvas') || [])]
  if (!a || !b || !canvases.length) return null
  const rect = canvases[0].getBoundingClientRect()
  const x = a.vx - rect.left
  const y = a.vy - rect.top
  const w = Math.max(1, b.vx + b.vw - a.vx)
  const h = Math.max(1, b.vy + b.vh - a.vy)
  if (w < 2 || h < 2) return null
  const out = document.createElement('canvas')
  out.width = Math.round(w)
  out.height = Math.round(h)
  const g = out.getContext('2d')
  if (!g) return null
  g.fillStyle = '#fff'
  g.fillRect(0, 0, out.width, out.height)
  canvases.forEach((cv) => {
    try {
      const box = cv.getBoundingClientRect()
      const scaleX = cv.width / (box.width || w)
      const scaleY = cv.height / (box.height || h)
      g.drawImage(cv, x * scaleX, y * scaleY, w * scaleX, h * scaleY, 0, 0, out.width, out.height)
    } catch { /* 某一层画布尺寸不一致时跳过 */ }
  })
  return { src: out.toDataURL('image/png'), width: out.width, height: out.height }
}

async function copySelectionImage() {
  const pack = rememberCopy()
  const image = captureSelectionImage()
  if (!pack || !image) {
    Message.warning('请先选中要复制的区域')
    return
  }
  pack.asImage = true
  pack.image = image
  pack.text = ''
  try {
    const blob = await (await fetch(image.src)).blob()
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  } catch { /* 剪贴板不可用时，表内粘贴仍使用刚记下的图片 */ }
  Message.success('已复制为图片')
}

function pasteCopiedImage() {
  const image = copiedPack?.image
  const box = selectionBox()
  if (!copiedPack?.asImage || !image?.src || !box) return false
  const dispatch = sheetContextDispatch()
  if (!dispatch) return false
  dispatch((ctx) => {
    if (!ctx?.luckysheetfile) return ctx
    const idx = ctx.luckysheetfile.findIndex((item) => item.id === box.id)
    if (idx < 0) return ctx
    const sheet = ctx.luckysheetfile[idx]
    const left = box.c0 === 0 ? 0 : (ctx.visibledatacolumn?.[box.c0 - 1] ?? 0)
    const top = box.r0 === 0 ? 0 : (ctx.visibledatarow?.[box.r0 - 1] ?? 0)
    const img = {
      id: `img_${Date.now().toString(36)}`,
      src: image.src,
      left,
      top,
      width: image.width,
      height: image.height,
      originWidth: image.width,
      originHeight: image.height,
    }
    const images = [...(sheet.images || []), img]
    const files = ctx.luckysheetfile.slice()
    files[idx] = { ...sheet, images }
    return { ...ctx, luckysheetfile: files, insertedImgs: images }
  })
  return true
}

function sameClip(a, b) {
  const norm = (s) => String(s || '').replace(/\r/g, '').replace(/\n$/, '')
  return norm(a) === norm(b)
}

async function pasteFromClipboard(mode) {
  const kind = mode === 'clip' || !mode ? 'all' : mode
  if (kind === 'all' && copiedPack?.asImage) {
    if (pasteCopiedImage()) hideCopyMark()
    else Message.warning('图片粘贴失败')
    return
  }
  if (kind !== 'all') {
    if (!copiedPack?.rows?.length) {
      Message.warning('请先复制单元格')
      return
    }
    if (writeCells(copiedPack, kind)) hideCopyMark()
    return
  }
  let text = ''
  try { text = await navigator.clipboard.readText() } catch { /* */ }
  if (copiedPack?.rows?.length && (!text || sameClip(text, copiedPack.text))) {
    if (writeCells(copiedPack, 'all')) hideCopyMark()
    return
  }
  if (!text) return
  const rows = text.replace(/\r/g, '').split('\n').filter((line, i, arr) => line || i < arr.length - 1).map((line) => (
    line.split('\t').map((v) => ({ v }))
  ))
  if (writeCells({ rows }, 'value')) hideCopyMark()
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
    }
  }
  ctxDlg.show = false
}

function dvOptionList() {
  return dvDlg.text.split(/[\n,，]/).map((s) => s.trim()).filter(Boolean)
}
function onDvCond() {
  if (dvDlg.cond === '文本' && !DV_TEXT_OPS.some(([k]) => k === dvDlg.op)) dvDlg.op = 'contains'
  if ((dvDlg.cond === '数字' || dvDlg.cond === '日期') && !DV_NUM_OPS.some(([k]) => k === dvDlg.op)) dvDlg.op = 'between'
}
function openValidation() {
  const box = selectionBox()
  const rule = box?.sheet?.dataVerification?.[`${box.r0}_${box.c0}`]
  const condByType = { dropdown: '单选', number: '数字', date: '日期', text: '文本', checkbox: '复选框', phone: '手机号', email: '邮箱' }
  dvDlg.tab = 'set'
  dvDlg.colorEdit = false
  dvDlg.cond = '单选'
  dvDlg.op = 'between'
  dvDlg.v1 = ''
  dvDlg.v2 = ''
  dvDlg.source = 'custom'
  dvDlg.text = ''
  dvDlg.refText = ''
  dvDlg.optionColor = true
  dvDlg.showArrow = true
  dvDlg.colors = {}
  dvDlg.hintOn = false
  dvDlg.hintTitle = ''
  dvDlg.hintText = ''
  dvDlg.warnOn = true
  dvDlg.warnStyle = 'stop'
  dvDlg.warnTitle = ''
  dvDlg.warnText = ''
  if (rule) {
    dvDlg.cond = rule.type === 'dropdown' && rule.type2 ? '多选' : (condByType[rule.type] || '单选')
    dvDlg.op = rule.op || (dvDlg.cond === '文本' ? 'contains' : 'between')
    dvDlg.v1 = rule.type === 'dropdown' ? '' : String(rule.value1 || '')
    dvDlg.v2 = String(rule.value2 || '')
    if (rule.type === 'dropdown') {
      const value = String(rule.value1 || '')
      const isRef = rule.source === 'ref' || /^\$?[A-Z]+\d+:\$?[A-Z]+\d+$/i.test(value)
      dvDlg.source = isRef ? 'ref' : 'custom'
      if (isRef) dvDlg.refText = value
      else dvDlg.text = value.split(',').join('\n')
    }
    dvDlg.optionColor = !!rule.optionColor
    dvDlg.showArrow = rule.showArrow !== false
    dvDlg.colors = { ...(rule.colors || {}) }
    dvDlg.hintOn = !!rule.hintShow
    dvDlg.hintTitle = rule.hintTitle || ''
    dvDlg.hintText = rule.hintText || ''
    dvDlg.warnOn = rule.prohibitInput !== false
    dvDlg.warnStyle = rule.warnStyle || (rule.prohibitInput === false ? 'warn' : 'stop')
    dvDlg.warnText = rule.warnText || ''
    dvDlg.warnTitle = rule.warnTitle || ''
  }
  dvDlg.show = true
}
function openDvColor(opt, e) {
  const r = e.currentTarget.getBoundingClientRect()
  colorPop.kind = 'dv'
  colorPop.key = opt
  colorPop.origin = dvDlg.colors[opt] || '#3370ff'
  colorPop.left = Math.min(r.left, window.innerWidth - 292)
  colorPop.top = Math.min(r.bottom + 6, window.innerHeight - 420)
  colorPop.show = true
}
function confirmValidation() {
  const box = selectionBox()
  const api = instRef.current
  if (!box || !api?.applyOp) {
    dvDlg.show = false
    return
  }
  const typeMap = { 单选: 'dropdown', 多选: 'dropdown', 数字: 'number', 日期: 'date', 文本: 'text', 复选框: 'checkbox', 手机号: 'phone', 邮箱: 'email' }
  const list = dvDlg.cond === '单选' || dvDlg.cond === '多选'
  const value1 = list
    ? (dvDlg.source === 'ref' ? dvDlg.refText.trim() : dvOptionList().join(','))
    : String(dvDlg.v1 || '').trim()
  const rule = {
    type: typeMap[dvDlg.cond] || 'dropdown',
    type2: dvDlg.cond === '多选',
    op: dvDlg.op,
    value1,
    value2: String(dvDlg.v2 || '').trim(),
    source: list ? dvDlg.source : '',
    prohibitInput: dvDlg.warnStyle === 'stop',
    warnStyle: dvDlg.warnStyle,
    hintShow: dvDlg.hintOn,
    hintTitle: dvDlg.hintTitle,
    hintText: dvDlg.hintText,
    warnTitle: dvDlg.warnTitle,
    warnText: dvDlg.warnText,
    optionColor: dvDlg.optionColor,
    showArrow: dvDlg.showArrow,
    colors: { ...dvDlg.colors },
  }
  const dv = { ...(box.sheet.dataVerification || {}) }
  for (let r = box.r0; r <= box.r1; r += 1) {
    for (let c = box.c0; c <= box.c1; c += 1) dv[`${r}_${c}`] = { ...rule }
  }
  applyOpUndoable([{ id: box.id, op: 'replace', path: ['dataVerification'], value: dv }])
  dvDlg.show = false
  setTimeout(syncDvChrome, 40)
}
function clearValidation() {
  const box = selectionBox()
  const api = instRef.current
  if (box && api?.applyOp) {
    const dv = { ...(box.sheet.dataVerification || {}) }
    for (let r = box.r0; r <= box.r1; r += 1) {
      for (let c = box.c0; c <= box.c1; c += 1) delete dv[`${r}_${c}`]
    }
    applyOpUndoable([{ id: box.id, op: 'replace', path: ['dataVerification'], value: dv }])
  }
  dvDlg.show = false
  dvList.show = false
  setTimeout(syncDvChrome, 40)
}

function dvRefOptions(ref) {
  const raw = String(ref || '').trim()
  const m = raw.match(/^(?:(?:'([^']+)'|([^!]+))!)?\$?([A-Za-z]+)\$?(\d+)(?::\$?([A-Za-z]+)\$?(\d+))?$/)
  if (!m) return []
  const api = instRef.current
  const name = m[1] || m[2] || ''
  const sheet = name
    ? (api?.getAllSheets?.() || []).find((s) => s.name === name)
    : api?.getSheet?.()
  if (!sheet) return []
  const c0 = colIndexFromName(m[3])
  const r0 = Number(m[4]) - 1
  const c1 = m[5] ? colIndexFromName(m[5]) : c0
  const r1 = m[6] ? Number(m[6]) - 1 : r0
  const out = []
  for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r += 1) {
    for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c += 1) {
      const text = cellLabel(sheet.data?.[r]?.[c])
      if (text) out.push(text)
    }
  }
  return out
}
function dvRuleOptions(rule) {
  if (!rule) return []
  if (rule.source === 'ref' || /[A-Za-z]+\d+:[A-Za-z]+\d+/.test(String(rule.value1 || ''))) return dvRefOptions(rule.value1)
  return String(rule.value1 || '').split(',').map((s) => s.trim()).filter(Boolean)
}
function dvDateNum(text) {
  const s = String(text ?? '').trim()
  if (!s) return NaN
  const n = Number(s)
  if (Number.isFinite(n) && n > 20000 && n < 80000) return n
  const t = Date.parse(s.replace(/[年.]/g, '-').replace(/月/g, '-').replace(/日/g, ''))
  return Number.isFinite(t) ? t / 86400000 : NaN
}
function dvCompare(op, left, a, b) {
  if (!Number.isFinite(left) || !Number.isFinite(a)) return false
  if (op === 'between' || op === 'notBetween') {
    if (!Number.isFinite(b)) return false
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    const inside = left >= lo && left <= hi
    return op === 'between' ? inside : !inside
  }
  if (op === 'eq') return left === a
  if (op === 'ne') return left !== a
  if (op === 'gt') return left > a
  if (op === 'gte') return left >= a
  if (op === 'lt') return left < a
  if (op === 'lte') return left <= a
  return true
}
function dvTextOk(op, text, raw) {
  const s = String(text)
  const p = String(raw ?? '')
  if (op === 'contains') return s.includes(p)
  if (op === 'notContains') return !s.includes(p)
  if (op === 'eq') return s === p
  if (op === 'starts') return s.startsWith(p)
  if (op === 'ends') return s.endsWith(p)
  if (op === 'lenEq') return s.length === Number(p)
  if (op === 'lenGt') return s.length > Number(p)
  if (op === 'lenLt') return s.length < Number(p)
  return true
}
function dvIncoming(value) {
  if (value == null) return ''
  if (typeof value === 'object') return cellLabel(value)
  return String(value)
}
function dvAccept(r, c, value) {
  const sheet = instRef.current?.getSheet?.()
  const rule = sheet?.dataVerification?.[`${r}_${c}`]
  if (!rule) return true
  const text = dvIncoming(value).trim()
  if (!text || text.startsWith('=')) return true
  let ok = true
  if (rule.type === 'dropdown') {
    const options = dvRuleOptions(rule)
    const parts = rule.type2 ? text.split(/[,，]/).map((s) => s.trim()).filter(Boolean) : [text]
    ok = parts.length > 0 && parts.every((part) => options.includes(part))
  } else if (rule.type === 'number') {
    ok = dvCompare(rule.op || 'between', parseLooseNumber(text), parseLooseNumber(rule.value1), parseLooseNumber(rule.value2))
  } else if (rule.type === 'date') {
    ok = dvCompare(rule.op || 'between', dvDateNum(text), dvDateNum(rule.value1), dvDateNum(rule.value2))
  } else if (rule.type === 'text') {
    ok = dvTextOk(rule.op || 'contains', text, rule.value1)
  } else if (rule.type === 'phone') {
    ok = /^1\d{10}$/.test(text)
  } else if (rule.type === 'email') {
    ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
  } else if (rule.type === 'checkbox') {
    ok = ['✓', '✔', 'true', 'false', '是', '否', '1', '0'].includes(text)
  }
  if (ok) return true
  const title = rule.warnTitle || '数据验证'
  const body = rule.warnText || rule.hintText || '输入的内容不符合数据验证条件'
  const style = rule.warnStyle || (rule.prohibitInput === false ? 'warn' : 'stop')
  if (style === 'stop') {
    Message.error(`${title}：${body}`)
    return false
  }
  if (style === 'info') Message.info(`${title}：${body}`)
  else Message.warning(`${title}：${body}`)
  return true
}
function hideDvChrome() {
  dvArrow.show = false
  dvList.show = false
  dvHint.show = false
  dvCheck.show = false
}
function syncDvChrome() {
  const api = instRef.current
  const sel = api?.getSelection?.()?.[0]
  const sheet = api?.getSheet?.()
  const box = hostRef.value?.querySelector('.luckysheet-cell-selected')
  if (!sel || !sheet || !box) {
    hideDvChrome()
    return
  }
  const r0 = sel.row?.[0] ?? 0
  const r1 = sel.row?.[1] ?? r0
  const c0 = sel.column?.[0] ?? 0
  const c1 = sel.column?.[1] ?? c0
  if (r0 !== r1 || c0 !== c1) {
    hideDvChrome()
    return
  }
  const rule = sheet.dataVerification?.[`${r0}_${c0}`]
  if (dvList.show && (dvList.r !== r0 || dvList.c !== c0)) dvList.show = false
  if (!rule) {
    dvArrow.show = false
    dvHint.show = false
    dvCheck.show = false
    dvList.show = false
    return
  }
  const rect = box.getBoundingClientRect()
  if (rule.hintShow && (rule.hintText || rule.hintTitle)) {
    dvHint.show = true
    dvHint.left = rect.left
    dvHint.top = Math.min(rect.bottom + 4, window.innerHeight - 72)
    dvHint.title = rule.hintTitle || ''
    dvHint.text = rule.hintText || ''
  } else dvHint.show = false
  if (rule.type === 'checkbox') {
    dvArrow.show = false
    dvList.show = false
    dvCheck.show = true
    dvCheck.left = rect.left + 4
    dvCheck.top = rect.top + Math.max(2, (rect.height - 16) / 2)
    dvCheck.r = r0
    dvCheck.c = c0
    const label = cellLabel(sheet.data?.[r0]?.[c0])
    dvCheck.on = label === '✓' || label === '✔' || label === 'true' || label === '是' || label === '1'
    return
  }
  dvCheck.show = false
  if (rule.type === 'dropdown' && rule.showArrow !== false) {
    dvArrow.show = true
    dvArrow.left = rect.right - 20
    dvArrow.top = rect.top + Math.max(0, (rect.height - 16) / 2)
    dvArrow.r = r0
    dvArrow.c = c0
  } else {
    dvArrow.show = false
    dvList.show = false
  }
}
function openDvList() {
  const sheet = instRef.current?.getSheet?.()
  const rule = sheet?.dataVerification?.[`${dvArrow.r}_${dvArrow.c}`]
  if (!rule) return
  dvList.options = dvRuleOptions(rule)
  dvList.multi = !!rule.type2
  dvList.r = dvArrow.r
  dvList.c = dvArrow.c
  dvList.colors = rule.optionColor ? (rule.colors || {}) : {}
  const current = cellLabel(sheet.data?.[dvArrow.r]?.[dvArrow.c])
  dvList.picked = current ? current.split(/[,，]/).map((s) => s.trim()).filter(Boolean) : []
  dvList.left = Math.min(dvArrow.left - 8, window.innerWidth - 180)
  dvList.top = Math.min(dvArrow.top + 20, window.innerHeight - 180)
  dvList.show = true
}
function pickDvOption(opt) {
  const api = instRef.current
  if (dvList.multi) {
    const set = new Set(dvList.picked)
    if (set.has(opt)) set.delete(opt)
    else set.add(opt)
    dvList.picked = [...set]
    api?.setCellValue?.(dvList.r, dvList.c, dvList.picked.join(','))
    return
  }
  api?.setCellValue?.(dvList.r, dvList.c, opt)
  dvList.show = false
  setTimeout(syncDvChrome, 40)
}
function toggleDvCheck() {
  const next = dvCheck.on ? '' : '✓'
  instRef.current?.setCellValue?.(dvCheck.r, dvCheck.c, next)
  dvCheck.on = !dvCheck.on
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
  ctxMenu.fly2 = ''
  if (id.startsWith('mx-')) {
    const kind = id.slice(3)
    emit('mx-insert', { kind: kind === 'tpl' ? 'tpl' : kind, cell: ctxTarget })
    return
  }
  if (id === 'copy') {
    const pack = rememberCopy()
    await copyText(pack?.text || '')
    return
  }
  if (id === 'copyImage') {
    await copySelectionImage()
    return
  }
  if (id === 'cut') {
    const pack = rememberCopy()
    await copyText(pack?.text || '')
    clearSelection('all')
    return
  }
  if (id === 'paste' || id === 'pasteValue' || id === 'pasteFormat' || id === 'pasteFormula') {
    const kind = id === 'pasteValue' ? 'value' : id === 'pasteFormat' ? 'format' : id === 'pasteFormula' ? 'formula' : 'all'
    await pasteFromClipboard(kind)
    return
  }
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
    openFmtDlg()
  } else if (id === 'link' && box) {
    const a = `${colLetter(box.c0)}${box.r0 + 1}`
    const b = `${colLetter(box.c1)}${box.r1 + 1}`
    const url = new URL(location.href)
    url.searchParams.set('sheet', box.sheet?.name || getActiveSheetName())
    url.searchParams.set('range', a === b ? a : `${a}:${b}`)
    await copyText(url.toString())
    Message.success('已复制选区链接')
  } else if (id === 'protectOn' && box) {
    api?.setCellFormatByRange?.('lo', 1, { row: [box.r0, box.r1], column: [box.c0, box.c1] }, { id: box.id })
  } else if (id === 'protectOff' && box) {
    api?.setCellFormatByRange?.('lo', 0, { row: [box.r0, box.r1], column: [box.c0, box.c1] }, { id: box.id })
  } else if (id === 'comment') {
    openCtxDlg('comment', '添加批注', box?.sheet.data?.[box.r0]?.[box.c0]?.ps?.value || '')
  } else if (id === 'note') {
    openCtxDlg('note', '添加评论', box?.sheet.data?.[box.r0]?.[box.c0]?.ps?.value || '')
  } else if (id === 'validation') {
    openValidation()
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

function closeSheetTabMenu() {
  sheetTabMenu.show = false
  sheetTabMenu.fly = ''
  sheetTabMenu.sheetId = ''
  sheetTabMenu.sheetName = ''
  sheetTabMenu.tabEl = null
}

function closeSheetListPop() {
  sheetListPop.open = false
  sheetListPop.query = ''
}

function openSheetListPop(anchor) {
  const el = anchor?.closest?.('.sheet-list-container, .fortune-sheettab-button, .fs-sheet-more') || anchor
  const r = el?.getBoundingClientRect?.()
  if (!r) return
  closeSheetTabMenu()
  sheetListPop.query = ''
  try { sheetListPop.activeId = instRef.current?.getSheet?.()?.id || '' }
  catch { sheetListPop.activeId = '' }
  const popW = 220
  let left = r.left
  if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8
  sheetListPop.left = Math.max(8, Math.round(left))
  sheetListPop.top = Math.round(r.top - 8)
  sheetListPop.open = true
  nextTick(() => {
    const pop = document.querySelector('.fs-sheet-list')
    if (!pop) return
    const h = pop.getBoundingClientRect().height
    sheetListPop.top = Math.max(8, Math.round(r.top - h - 4))
    pop.querySelector('input')?.focus()
  })
}

function toggleSheetMore() {
  if (sheetListPop.open) closeSheetListPop()
  else openSheetListPop(document.querySelector('.fs-sheet-more'))
}

function scheduleSheetTabs() {
  cancelAnimationFrame(sheetTabFrame)
  sheetTabFrame = requestAnimationFrame(layoutSheetTabs)
}

/** 底栏放不下全部工作表时，标签保持原名，末尾露出「...」 */
function layoutSheetTabs() {
  const content = hostRef.value?.querySelector('#luckysheet-sheet-content')
  const wrap = content?.querySelector('.fortune-sheettab-container')
  const box = content?.querySelector('#fortune-sheettab-container-c')
  if (!content || !wrap || !box) {
    sheetMore.show = false
    return
  }
  // 标签容器的 max-width / margin 在样式表里是 !important，这里用 important 才能让出「...」的空位。
  wrap.style.removeProperty('max-width')
  const gap = 36
  const held = parseFloat(wrap.style.marginRight) || 0
  const overflow = box.scrollWidth > box.clientWidth + held + 1
  if (overflow) wrap.style.setProperty('margin-right', `${gap}px`, 'important')
  else wrap.style.removeProperty('margin-right')
  sheetMore.show = overflow
  if (overflow) {
    const r = wrap.getBoundingClientRect()
    sheetMore.left = Math.round(r.right + 4)
    sheetMore.top = Math.round(r.top + 2)
    const active = box.querySelector('.luckysheet-sheets-item-active')
    if (active) {
      const left = active.offsetLeft
      const right = left + active.offsetWidth
      const view = box.clientWidth
      if (left < box.scrollLeft) box.scrollLeft = left
      else if (right > box.scrollLeft + view) box.scrollLeft = right - view
    }
  }
}

function bindSheetTabLayout() {
  scheduleSheetTabs()
  const content = hostRef.value?.querySelector('#luckysheet-sheet-content')
  if (!content || sheetTabObs) return
  sheetTabObs = new ResizeObserver(() => scheduleSheetTabs())
  sheetTabObs.observe(content)
  window.addEventListener('resize', scheduleSheetTabs)
}

function onSheetListBtnClick(e) {
  if (!hostRef.value?.contains(e.target)) return
  const btn = e.target?.closest?.('#all-sheets, .sheet-list-container')
  if (!btn) return
  e.preventDefault()
  e.stopPropagation()
  if (sheetListPop.open) {
    closeSheetListPop()
    return
  }
  openSheetListPop(btn)
}

function activateFromSheetList(sheet) {
  if (sheetDrag.moved) {
    sheetDrag.moved = false
    return
  }
  if (!sheet?.id) return
  try {
    if (isSheetHidden(sheet)) {
      instRef.current?.applyOp?.([
        { op: 'replace', id: sheet.id, path: ['hide'], value: 0 },
      ])
      sheetListPop.rev += 1
    }
    instRef.current?.activateSheet?.({ id: sheet.id })
    sheetListPop.activeId = sheet.id
    setTimeout(scheduleSheetTabs, 60)
  } catch { /* */ }
  closeSheetListPop()
}

function onSheetListDragStart(e, sheet) {
  if (!sheetListCanDrag.value || !sheet?.id) {
    e.preventDefault()
    return
  }
  sheetDrag.id = sheet.id
  sheetDrag.overId = ''
  sheetDrag.moved = false
  try {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/sheet-id', sheet.id)
    e.dataTransfer.setData('text/plain', sheet.id)
    const row = e.currentTarget?.closest?.('.fs-sheet-list-li')
    if (row) e.dataTransfer.setDragImage(row, 24, 16)
  } catch { /* */ }
}

function onSheetListDragOver(e, sheet) {
  if (!sheetDrag.id || !sheet?.id || sheetDrag.id === sheet.id) return
  e.preventDefault()
  try { e.dataTransfer.dropEffect = 'move' } catch { /* */ }
  sheetDrag.overId = sheet.id
}

function onSheetListDragLeave(sheet) {
  if (sheetDrag.overId === sheet?.id) sheetDrag.overId = ''
}

function onSheetListDrop(e, sheet) {
  e.preventDefault()
  const fromId = sheetDrag.id || e.dataTransfer?.getData?.('text/sheet-id') || e.dataTransfer?.getData?.('text/plain')
  const toId = sheet?.id
  sheetDrag.overId = ''
  if (!fromId || !toId || fromId === toId) {
    sheetDrag.id = ''
    return
  }
  reorderSheetTabs(fromId, toId)
  sheetDrag.moved = true
  sheetDrag.id = ''
}

function onSheetListDragEnd() {
  sheetDrag.id = ''
  sheetDrag.overId = ''
}

/** 把 fromId 工作表移动到 toId 的位置（插入到目标前） */
function reorderSheetTabs(fromId, toId) {
  const api = instRef.current
  if (!api?.applyOp) return
  const sheets = (api.getAllSheets?.() || [])
    .slice()
    .sort((a, b) => Number(a.order) - Number(b.order))
  const fromIdx = sheets.findIndex((s) => s.id === fromId)
  const toIdx = sheets.findIndex((s) => s.id === toId)
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return
  const next = sheets.slice()
  const [item] = next.splice(fromIdx, 1)
  next.splice(toIdx, 0, item)
  try {
    applyOpUndoable(next.map((s, i) => ({
      op: 'replace',
      id: s.id,
      path: ['order'],
      value: i,
    })))
    sheetListPop.rev += 1
  } catch {
    Message.error('移动失败')
  }
}

function resolveSheetFromTab(tab) {
  if (!tab) return null
  const name = tab.querySelector?.('.luckysheet-sheets-item-name')?.textContent?.trim()
  const sheets = (instRef.current?.getAllSheets?.() || liveSheets() || [])
    .filter((s) => !isSheetHidden(s))
    .sort((a, b) => Number(a.order) - Number(b.order))
  if (name) {
    const byName = sheets.find((s) => s.name === name)
    if (byName) return byName
  }
  const items = [...(hostRef.value?.querySelectorAll('.luckysheet-sheets-item') || [])]
    .filter((el) => el.style.display !== 'none')
  const idx = items.indexOf(tab)
  return idx >= 0 ? sheets[idx] || null : null
}

function openSheetTabMenu(e, tab) {
  const sheet = resolveSheetFromTab(tab)
  if (!sheet) return
  ctxMenu.show = false
  try {
    if (sheet.id) instRef.current?.activateSheet?.({ id: sheet.id })
  } catch { /* */ }
  const menuW = 220
  const menuH = 320
  sheetTabMenu.sheetId = sheet.id || ''
  sheetTabMenu.sheetName = sheet.name || ''
  sheetTabMenu.tabEl = tab
  sheetTabMenu.fly = ''
  sheetTabMenu.x = Math.min(e.clientX, window.innerWidth - menuW - 8)
  sheetTabMenu.y = Math.min(e.clientY, window.innerHeight - Math.min(menuH, window.innerHeight - 16))
  sheetTabMenu.show = true
}

function onSheetTabContext(e) {
  if (!hostRef.value?.contains(e.target)) return
  const tab = e.target?.closest?.('.luckysheet-sheets-item')
  if (!tab || tab.style.display === 'none') return
  e.preventDefault()
  e.stopPropagation()
  openSheetTabMenu(e, tab)
}

function onSheetTabFuncClick(e) {
  if (!hostRef.value?.contains(e.target)) return
  const btn = e.target?.closest?.('.luckysheet-sheets-item-function')
  if (!btn) return
  e.preventDefault()
  e.stopPropagation()
  const tab = btn.closest('.luckysheet-sheets-item')
  if (tab) openSheetTabMenu(e, tab)
}

function currentSheetTab() {
  const id = sheetTabMenu.sheetId
  const sheets = instRef.current?.getAllSheets?.() || liveSheets() || []
  return sheets.find((s) => s.id === id) || sheets.find((s) => s.name === sheetTabMenu.sheetName) || null
}

function uniqueSheetCopyName(base) {
  const names = new Set((instRef.current?.getAllSheets?.() || []).map((s) => s.name))
  let name = `${base} 的副本`
  let n = 2
  while (names.has(name)) {
    name = `${base} 的副本 ${n}`
    n += 1
  }
  return name
}

function setSheetTabColor(color) {
  const api = instRef.current
  const sheet = currentSheetTab()
  if (!api?.applyOp || !sheet?.id) return
  try {
    applyOpUndoable([{ op: 'replace', id: sheet.id, path: ['color'], value: color || undefined }])
  } catch { /* */ }
}

function openSheetTabColorPicker() {
  const sheet = currentSheetTab()
  if (!sheet?.id) return
  const item = document.querySelector('.fs-sheet-ctx .fs-sheet-color-item')
  const r = item?.getBoundingClientRect?.()
  const pw = 293
  const ph = 340
  let left = r ? Math.round(r.right + 6) : sheetTabMenu.x + 220
  let top = r ? Math.round(r.top) : sheetTabMenu.y + 56
  if (left + pw > window.innerWidth - 8) {
    left = Math.max(8, Math.round((r?.left || sheetTabMenu.x) - pw - 6))
  }
  if (top + ph > window.innerHeight - 8) {
    top = Math.max(8, window.innerHeight - ph - 8)
  }
  const keepId = sheetTabMenu.sheetId
  const keepName = sheetTabMenu.sheetName
  sheetTabMenu.show = false
  sheetTabMenu.fly = ''
  sheetTabMenu.tabEl = null
  sheetTabMenu.sheetId = keepId
  sheetTabMenu.sheetName = keepName
  colorPop.kind = 'sheet-tab'
  colorPop.origin = sheet.color || ''
  colorPop.left = left
  colorPop.top = top
  colorPop.show = true
}

function renameSheetTab() {
  const tab = sheetTabMenu.tabEl
  closeSheetTabMenu()
  const nameEl = tab?.querySelector?.('.luckysheet-sheets-item-name')
  if (!nameEl) return
  nextTick(() => {
    nameEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
  })
}

function deleteSheetTab() {
  const api = instRef.current
  const sheet = currentSheetTab()
  closeSheetTabMenu()
  if (!api?.deleteSheet || !sheet?.id) return
  const shown = (api.getAllSheets?.() || []).filter((s) => !isSheetHidden(s))
  if (shown.length <= 1) {
    Message.warning('至少保留一个工作表')
    return
  }
  Modal.confirm({
    title: '删除工作表',
    content: `确定删除「${sheet.name}」吗？删除后不可恢复。`,
    okText: '删除',
    okButtonProps: { status: 'danger' },
    cancelText: '取消',
    onOk: () => {
      try { api.deleteSheet({ id: sheet.id }) }
      catch { Message.error('删除失败') }
    },
  })
}

function insertSheetTab() {
  closeSheetTabMenu()
  try { instRef.current?.addSheet?.() }
  catch { Message.error('插入失败') }
}

function copySheetTab() {
  const api = instRef.current
  const sheet = currentSheetTab()
  closeSheetTabMenu()
  if (!api?.addSheet || !sheet) return
  try {
    const name = uniqueSheetCopyName(sheet.name || 'Sheet')
    const data = sheet.data
      || (typeof api.celldataToData === 'function' ? api.celldataToData(sheet.celldata || []) : null)
    api.addSheet()
    const cur = api.getSheet?.()
    if (!cur?.id) return
    api.setSheetName?.(name)
    if (data) {
      api.updateSheet?.([{
        id: cur.id,
        name,
        data,
        row: sheet.row,
        column: sheet.column,
        config: JSON.parse(JSON.stringify(sheet.config || {})),
        color: sheet.color,
      }])
    }
  } catch {
    Message.error('复制失败')
  }
}

function hideSheetTab() {
  const api = instRef.current
  const sheet = currentSheetTab()
  closeSheetTabMenu()
  if (!api?.applyOp || !sheet?.id) return
  const shown = (api.getAllSheets?.() || []).filter((s) => !isSheetHidden(s))
  if (shown.length <= 1) {
    Message.warning('至少保留一个工作表')
    return
  }
  try {
    // path[0]==='hide' 时 applyOp 会切到下一张可见表（hide 的副作用不进撤销）
    applyOpUndoable([
      { op: 'replace', id: sheet.id, path: ['hide'], value: 1 },
      { op: 'replace', id: sheet.id, path: ['status'], value: 0 },
    ])
    sheetListPop.rev += 1
  } catch {
    Message.error('隐藏失败')
  }
}

function protectSheetTab() {
  const api = instRef.current
  const sheet = currentSheetTab()
  closeSheetTabMenu()
  if (!api?.applyOp || !sheet?.id) return
  const config = { ...(sheet.config || {}) }
  const on = !(config.authority?.sheet === 1)
  config.authority = on
    ? { ...(config.authority || {}), sheet: 1, hintText: '此工作表已受保护' }
    : { ...(config.authority || {}), sheet: 0 }
  try {
    applyOpUndoable([{ op: 'replace', id: sheet.id, path: ['config'], value: config }])
    Message.success(on ? '已开启工作表保护' : '已取消工作表保护')
  } catch {
    Message.error('设置失败')
  }
}

function exportSheetTabImage() {
  const sheet = currentSheetTab()
  closeSheetTabMenu()
  try {
    const url = paintWorkbookThumb(fortuneToUniver([sheet || liveSheets()[0]].filter(Boolean)))
    if (!url) {
      Message.warning('暂无法导出图片')
      return
    }
    const a = document.createElement('a')
    a.href = url
    a.download = `${sheet?.name || 'sheet'}.png`
    a.click()
  } catch {
    Message.error('导出失败')
  }
}

function onSheetTabAction(key) {
  if (key === 'color') {
    openSheetTabColorPicker()
    return
  }
  if (key === 'delete') deleteSheetTab()
  else if (key === 'rename') renameSheetTab()
  else if (key === 'insert') insertSheetTab()
  else if (key === 'copy') copySheetTab()
  else if (key === 'hide') hideSheetTab()
  else if (key === 'protect') protectSheetTab()
  else if (key === 'export') exportSheetTabImage()
}

function onSheetContext(e) {
  if (!hostRef.value?.contains(e.target)) return
  if (e.target?.closest?.('.luckysheet-sheets-item, .luckysheet-sheet-area')) {
    onSheetTabContext(e)
    return
  }
  const grid = e.target?.closest?.('.fortune-cell-area, .fortune-row-header, .fortune-col-header, canvas')
  if (!grid) return
  e.preventDefault()
  e.stopPropagation()
  closeSheetTabMenu()
  const box = selectionBox()
  const remove = CTX_ITEMS.find((item) => item.id === 'remove')
  if (remove && box) {
    const a = box.r0 + 1
    const b = box.r1 + 1
    remove.children[0].label = a === b ? `删除第 ${a} 行` : `删除第 ${a} - ${b} 行`
    remove.children[1].label = box.c0 === box.c1 ? '删除列' : `删除 ${colLetter(box.c0)} - ${colLetter(box.c1)} 列`
  }
  const g = geomFromPoint(ctxState() || {}, e.clientX, e.clientY)
  ctxTarget = g ? { row: g.r, col: g.c } : null
  ctxMenu.x = e.clientX
  ctxMenu.y = e.clientY
  ctxMenu.fly = ''
  ctxMenu.fly2 = ''
  ctxMenu.subLeft = false
  ctxMenu.show = true
  nextTick(() => {
    const el = ctxMenuRef.value
    if (!el) return
    const r = el.getBoundingClientRect()
    const pad = 8
    const subW = 240
    let x = e.clientX
    let y = e.clientY
    if (x + r.width > window.innerWidth - pad) x = Math.max(pad, window.innerWidth - r.width - pad)
    if (y + r.height > window.innerHeight - pad) y = Math.max(pad, window.innerHeight - r.height - pad)
    ctxMenu.x = x
    ctxMenu.y = y
    ctxMenu.subLeft = x + r.width + subW > window.innerWidth - pad
  })
}

function bindFreezeClick() {
  const box = hostRef.value
  if (!box || freezeClickBound) return
  box.addEventListener('mousedown', onColorToolbarCapture, true)
  box.addEventListener('click', onColorToolbarCapture, true)
  box.addEventListener('click', onFreezeCapture, true)
  box.addEventListener('click', onSheetTabFuncClick, true)
  box.addEventListener('mousedown', onSheetListBtnClick, true)
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
  if (e.target.closest?.('.cp, .fs-pop, .fs-link, .fs-link-bar, .fs-link-pick, .fs-fold, .fs-beauty, .fs-view-tools, .fs-filter, .fs-filter-menu, .fs-cf-dlg, .fs-cf-fly, .fs-find, .fs-ctx, .fs-ctx-dlg, .fs-style-cluster, .fs-align-cluster, .fs-fmt-cluster, .fs-data-cluster, .fs-ht-menu, .fs-sheet-ctx, .fs-sheet-list, .fs-font-menu, .sheet-list-container, #all-sheets, .arco-trigger-popup')) return
  // 颜色按钮由 onFreezeCapture 负责开关，避免 mousedown 先关掉、click 再打开时被冲掉
  if (findColorCombo(e.target)) return
  pop.show = false
  viewState.menu = false
  filterMenu.show = false
  if (!linkPop.picking) {
    linkPop.show = false
    linkPop.sheetsOpen = false
  }
  filterPop.show = false
  colorPop.show = false
  borderState.styleOpen = false
  alignPop.show = false
  wrapPop.show = false
  vtPop.show = false
  stylePop.show = false
  fontMenu.open = false
  closeSheetListPop()
  cfState.fly = ''
  cfState.scaleOpen = false
  cfState.kindOpen = false
  if (!cfState.side) cfState.dlg = ''
  findState.scopeOpen = false
  ctxMenu.show = false
  closeSheetTabMenu()
  markActiveTools()
}

function onCfSideDown(e) {
  if (!e.target.closest?.('.fs-cf-scale-select-wrap, .fs-cf-kind-wrap, .fs-cf-range, .fs-cf-range-pick, .fs-cf-scope')) {
    cfState.scaleOpen = false
    cfState.kindOpen = false
    cfState.scopeOpen = false
    if (!e.target.closest?.('.fs-cf-range, .fs-cf-range-pick')) cfState.pickingRange = false
  }
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
  zoomReady.value = false
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
    sheetTabContextMenu: [],
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
      {
        key: 'feishu-beauty',
        tooltip: '美化表格',
        icon: toolIcon([
          'M12 2.2 13.55 7.7 19.2 9.15 13.55 10.6 12 16.1 10.45 10.6 4.8 9.15 10.45 7.7Z',
          'M18.4 13.6 19.15 16.05 21.6 16.8 19.15 17.55 18.4 20 17.65 17.55 15.2 16.8 17.65 16.05Z',
        ]),
        onClick: () => openBeauty(),
      },
    ],
    hooks: {
      beforeUpdateCell: (r, c, value) => dvAccept(r, c, value),
      afterUpdateCell: (r, c) => {
        setTimeout(() => {
          if (!paintingFmt) paintCellFormat(r, c)
          syncDvChrome()
        }, 30)
      },
      afterSelectionChange: (_id, sel) => {
        syncCfRangeFromSelection(sel)
        scheduleDataBars()
        refreshSheetStat(sel)
        scheduleFormulaFix()
        if (cfState.side && cfState.panel === 'rules') refreshCfFlags()
        requestAnimationFrame(syncDvChrome)
      },
    },
    onChange: (next) => {
      latest = next || latest
      markActiveTools()
      scheduleDataBars()
      refreshSheetStat()
      scheduleSheetTabs()
      scheduleFormulaFix()
      syncBarStore()
      const on = instRef.current?.getSheet?.()?.showGridLines !== false
      viewState.grid = on
      beauty.grid = on
    },
  }))
  requestAnimationFrame(() => {
    watchToolbarLabels()
    bindFreezeClick()
    fixInitialSelection()
    ;[120, 400, 1000].forEach((d) => setTimeout(() => {
      fixInitialSelection()
      zoomReady.value = !!hostRef.value?.querySelector('.fortune-zoom-container')
      drawCrosshair()
      refreshSheetStat()
      applyLocationLink()
      scheduleSheetTabs()
      scheduleFormulaFix()
    }, d))
    const native = cfRules().filter((rule) => rule.type !== 'dataBar')
    if (native.length !== cfRules().length) patchCf(native, false)
    const sheet = instRef.current?.getSheet?.()
    if (sheet) {
      const fromSheet = sheet.config?.fs_data_bars || sheet.fs_data_bars
      if (fromSheet?.length && !dataBarStore.has(sheetBarKey(sheet))) dataBarStore.set(sheetBarKey(sheet), fromSheet)
    }
    drawDataBars()
    drawIconSets()
    viewState.grid = sheet?.showGridLines !== false
    zoomReady.value = !!hostRef.value?.querySelector('.fortune-zoom-container')
    drawCrosshair()
    bindSheetTabLayout()
  })
  const redrawBars = () => {
    scheduleDataBars()
    syncDvChrome()
  }
  filterIconObs?.disconnect()
  filterIconObs = new MutationObserver(() => {
    if (dataBar.filter) scheduleFilterIcons()
  })
  filterIconObs.observe(box, { childList: true, subtree: true })
  box.addEventListener('click', (e) => {
    const caret = e.target.closest?.('.luckysheet-filter-options')
    if (caret) {
      e.preventDefault()
      e.stopPropagation()
      openColumnFilter(caret)
      return
    }
    if (!e.target.closest?.('.fs-dv-list, .fs-dv-arrow')) dvList.show = false
    if (e.target.closest?.('.fortune-zoom-button')) setTimeout(drawCrosshair, 60)
  }, true)
  box.addEventListener('wheel', redrawBars, { passive: true })
  box.addEventListener('scroll', redrawBars, { passive: true, capture: true })
  box.addEventListener('mouseup', redrawBars)
  box.addEventListener('pointerup', redrawBars)
  box.addEventListener('touchend', redrawBars, { passive: true })
}

function load(wb) {
  dataBarStore.clear()
  ;(wb?.sheetOrder || Object.keys(wb?.sheets || {})).forEach((id) => {
    const sh = wb?.sheets?.[id]
    const bars = sh?.fortune?.dataBars || sh?.config?.fs_data_bars
    if (bars?.length) dataBarStore.set(String(sh.id || id), bars)
  })
  renderBook(univerToFortune(wb))
}

function liveSheets() {
  try {
    const all = instRef.current?.getAllSheets?.()
    if (all?.length) {
      latest = all.map((sh) => {
        const bars = barRulesOf(sh)
        if (!bars.length) return sh
        return {
          ...sh,
          fs_data_bars: bars,
          config: { ...(sh.config || {}), fs_data_bars: bars },
        }
      })
    }
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

function cellDisplay(row, col) {
  try {
    const sh = instRef.current?.getSheet?.()
    if (!sh || row < 0 || col < 0) return ''
    let cell = sh.data?.[row]?.[col]
    if (!cell && Array.isArray(sh.celldata)) {
      cell = sh.celldata.find((it) => Number(it.r) === row && Number(it.c) === col)?.v
    }
    if (cell == null || cell === '') return ''
    if (typeof cell === 'string' || typeof cell === 'number') return String(cell)
    if (cell.m != null && cell.m !== '') return String(cell.m)
    if (cell.v != null && typeof cell.v !== 'object' && cell.v !== '') return String(cell.v)
    return ''
  } catch {
    return ''
  }
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
    const ra = cur.row?.[0]
    const rb = cur.row?.[1] ?? ra
    const ca = cur.column?.[0]
    const cb = cur.column?.[1] ?? ca
    if (ra == null || ca == null) return null
    const startRow = Math.min(ra, rb)
    const endRow = Math.max(ra, rb)
    const startColumn = Math.min(ca, cb)
    const endColumn = Math.max(ca, cb)
    if (startRow === endRow && startColumn === endColumn) return null
    return { startRow, startColumn, endRow, endColumn }
  } catch {
    return null
  }
}

// 当前活动单元格（单格位置，供混合表等外部插入使用）
function activeCell() {
  try {
    const sel = instRef.current?.getSelection?.()
    const cur = sel?.[0]
    const r = cur?.row?.[0]
    const c = cur?.column?.[0]
    if (r == null || c == null) return null
    return { row: r, col: c }
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

const PIVOT_TOTAL_BG = '#DCE6F1'

function paintPivotSummary(startRow, startCol, layout) {
  const api = instRef.current
  if (!api?.setCellFormatByRange || !layout?.rows || !layout?.cols) return
  const paint = (r, c0, c1) => {
    const range = { row: [r, r], column: [c0, c1] }
    api.setCellFormatByRange('bg', PIVOT_TOTAL_BG, range)
    api.setCellFormatByRange('bl', 1, range)
  }
  layout.rows.forEach((meta, ri) => {
    if (meta?.type !== 'total' && meta?.type !== 'sub') return
    paint(startRow + ri, startCol, startCol + layout.cols.length - 1)
  })
  const totalCols = []
  layout.cols.forEach((col, ci) => { if (col?.type === 'total') totalCols.push(ci) })
  if (!totalCols.length) return
  layout.rows.forEach((meta, ri) => {
    if (!meta || meta.type === 'head' || meta.type === 'total' || meta.type === 'sub') return
    totalCols.forEach((ci) => paint(startRow + ri, startCol + ci, startCol + ci))
  })
}

function ensureSheetSpan(api, endRow, endCol) {
  const sheet = api.getSheet?.()
  const data = sheet?.data
  if (!sheet?.id || !Array.isArray(data) || !data[0]) return
  const rows = data.length
  const cols = data[0]?.length || sheet.column || 0
  const needRows = Math.max(rows, endRow + 1)
  const needCols = Math.max(cols, endCol + 1)
  if (needRows === rows && needCols === cols) return
  api.updateSheet?.([{
    ...sheet,
    data,
    row: needRows,
    column: needCols,
  }])
}

function fitColumns(startCol, matrix) {
  const api = instRef.current
  if (!api?.setColumnWidth || !matrix?.[0]?.length) return
  const info = {}
  for (let i = 0; i < matrix[0].length; i += 1) {
    let units = 4
    matrix.forEach((row) => {
      const cell = row?.[i]
      const text = cell && typeof cell === 'object' ? (cell.v ?? cell.m ?? '') : (cell ?? '')
      units = Math.max(units, textUnits(String(text)))
    })
    info[startCol + i] = Math.min(220, Math.max(64, units * 7 + 28))
  }
  try { api.setColumnWidth(info) } catch { /* 列宽接口不可用时保持默认宽度 */ }
}

function writeBlock(name, startRow, startCol, matrix, headerRows = 0, layout = null) {
  const api = instRef.current
  if (!api || !matrix?.length || !matrix[0]?.length) return false
  if (name) setActiveSheet(name)
  ensureSheetSpan(api, startRow + matrix.length - 1, startCol + matrix[0].length - 1)
  const range = {
    row: [startRow, startRow + matrix.length - 1],
    column: [startCol, startCol + matrix[0].length - 1],
  }
  try {
    api.setCellValuesByRange(matrix, range)
    matrix.forEach((line, r) => {
      line.forEach((val, c) => {
        if (typeof val === 'string' && /%$/.test(val.trim())) {
          api.setCellFormatByRange('ct', { fa: '0.00%', t: 'n' }, {
            row: [startRow + r, startRow + r],
            column: [startCol + c, startCol + c],
          })
        }
      })
    })
    if (headerRows) {
      const head = {
        row: [startRow, startRow + headerRows - 1],
        column: [startCol, startCol + matrix[0].length - 1],
      }
      api.setCellFormatByRange('bl', 1, head)
      api.setCellFormatByRange('bg', '#E8F3FF', head)
    }
    paintPivotSummary(startRow, startCol, layout)
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
  emit('pivot-config', snap.pivotConfig || null)
}

/** 中文输入法会把 = + ( ) , 等打成全角，fortune 只认半角公式。IME 插入的文本不经过 fortune 的 keydown 缓冲，
 * 会在下次按键时被冲掉，所以 =' 开头的输入期修复靠不住；改为记录「出现过全角等号」，在 Enter 捕获阶段
 * （fortune 处理前）把编辑器 DOM 补成完整公式——commit 会兜底读 DOM，此时已无按键重建，公式可正常求值 */
const FW_CHAR_MAP = { '＝': '=', '＋': '+', '－': '-', '＊': '*', '／': '/', '（': '(', '）': ')', '，': ',', '：': ':', '“': '"', '”': '"', '％': '%' }
const FW_CHAR_RE = /[＝＋－＊／（），“”：％]/g
function fwFixed(text) {
  return text.replace(FW_CHAR_RE, (ch) => FW_CHAR_MAP[ch] ?? ch)
}
let fwSawFullwidthEquals = false
function normalizeFormulaTyping() {
  const editor = document.getElementById('luckysheet-rich-text-editor')
  if (!editor) return
  const text = editor.innerText || ''
  if (!text) {
    fwSawFullwidthEquals = false
    return
  }
  if (text.startsWith('＝')) {
    fwSawFullwidthEquals = true
    return
  }
  // '=' 开头（公式模式已建立）：内部全角字符做等长替换即可，光标不位移；普通中文内容不受影响
  if (!text.startsWith('=')) {
    if (text.startsWith('=') || text.length === 0) fwSawFullwidthEquals = false
    return
  }
  if (!FW_CHAR_RE.test(text)) return
  FW_CHAR_RE.lastIndex = 0
  const sel = window.getSelection()
  const anchor = sel?.anchorNode
  const offset = sel?.anchorOffset
  const inEditor = !!(anchor && editor.contains(anchor))
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  let changed = false
  nodes.forEach((node) => {
    const v = node.nodeValue
    if (v && FW_CHAR_RE.test(v)) {
      FW_CHAR_RE.lastIndex = 0
      node.nodeValue = v.replace(FW_CHAR_RE, (ch) => FW_CHAR_MAP[ch])
      changed = true
    }
  })
  if (changed && inEditor) {
    try { sel.collapse(anchor, offset) } catch { /* 光标节点被重建时忽略 */ }
  }
}
function sheetContextDispatch() {
  const box = hostRef.value?.querySelector?.('.fortune-box')
  if (!box) return null
  try {
    const key = Object.keys(box).find((k) => k.startsWith('__reactContainer'))
    if (!key) return null
    const seen = new Set()
    const stack = [box[key]]
    while (stack.length) {
      const fiber = stack.pop()
      if (!fiber || seen.has(fiber)) continue
      seen.add(fiber)
      let hook = fiber.memoizedState
      for (let i = 0; i < 80 && hook; i += 1) {
        const st = hook.memoizedState
        if (st && typeof st === 'object' && Array.isArray(st.luckysheetfile) && Array.isArray(st.luckysheetCellUpdate) && hook.queue?.dispatch) {
          return hook.queue.dispatch
        }
        hook = hook.next
      }
      if (fiber.child) stack.push(fiber.child)
      if (fiber.sibling) stack.push(fiber.sibling)
    }
  } catch { /* */ }
  return null
}

function exitCellEdit() {
  hideFuncTip()
  hideFuncSug()
  const dispatch = sheetContextDispatch()
  if (dispatch) {
    dispatch((ctx) => {
      if (!ctx?.luckysheetCellUpdate?.length) return ctx
      return { ...ctx, luckysheetCellUpdate: [], formulaRangeHighlight: [] }
    })
  }
  const ed = document.getElementById('luckysheet-rich-text-editor')
  const fx = document.getElementById('luckysheet-functionbox-cell')
  if (ed) ed.innerHTML = ''
  if (fx) fx.innerHTML = ''
  ed?.blur()
  fx?.blur()
  const focusEl = hostRef.value?.querySelector('.luckysheet-cell-input, .fortune-container')
  if (focusEl && focusEl !== ed) focusEl.focus()
}

function colIndexFromName(letters) {
  let n = 0
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function colNameFromIndex(index) {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** Excel 填充：相对引用随目标单元格偏移，$ 锁定的行列不动 */
function shiftFormula(formula, dr, dc) {
  if ((!dr && !dc) || !formula || formula[0] !== '=') return formula
  let out = ''
  let i = 0
  while (i < formula.length) {
    if (formula[i] === '"') {
      let j = i + 1
      while (j < formula.length) {
        if (formula[j] === '"') {
          j += 1
          if (formula[j] === '"') { j += 1; continue }
          break
        }
        j += 1
      }
      out += formula.slice(i, j)
      i = j
      continue
    }
    const prev = i > 0 ? formula[i - 1] : ''
    const rest = formula.slice(i)
    const m = rest.match(/^(?:(?:'(?:[^']|'')+'|[A-Za-z_\u4e00-\u9fff][\w.\u4e00-\u9fff]*)!)?(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})(?!\d)/)
    if (!m || rest[m[0].length] === '(' || (prev && /[\w\u4e00-\u9fff]/.test(prev))) {
      out += formula[i]
      i += 1
      continue
    }
    const colAbs = m[1]
    const col = m[2]
    const rowAbs = m[3]
    const row = m[4]
    const prefix = m[0].slice(0, m[0].length - (colAbs.length + col.length + rowAbs.length + row.length))
    let ci = colIndexFromName(col)
    let ri = Number(row) - 1
    if (!colAbs) ci += dc
    if (!rowAbs) ri += dr
    if (ci < 0 || ri < 0 || ci > 16383 || ri > 1048575) out += `${prefix}#REF!`
    else out += `${prefix}${colAbs}${colNameFromIndex(ci)}${rowAbs}${ri + 1}`
    i += m[0].length
  }
  return out
}

function sheetHasFocus(e) {
  if (!hostRef.value || e.isComposing || e.keyCode === 229) return false
  const el = document.activeElement
  const tag = el?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false
  if (el?.closest?.('.pv-panel, .pv-design, .pv-pop') && selectionBox()) return true
  if (el?.closest?.('.fs-filter, .fs-sheet-list, .pv-panel, .pv-pop, .arco-modal, .arco-trigger-popup')) return false
  if (el?.isContentEditable && !el.closest?.('#luckysheet-rich-text-editor, #luckysheet-functionbox-cell')) return false
  if (hostRef.value.contains(el) || hostRef.value.contains(e.target)) return true
  const ctx = reactStateBy((st) => Array.isArray(st.luckysheetfile))
  return !!ctx?.sheetFocused
}

function editingInputText() {
  const ed = document.getElementById('luckysheet-rich-text-editor')
  const fx = document.getElementById('luckysheet-functionbox-cell')
  const active = document.activeElement
  const fromFx = !!(fx && (active === fx || fx.contains(active)))
  const fromEd = !!(ed && (active === ed || ed.contains(active)))
  const ctx = reactStateBy((st) => Array.isArray(st.luckysheetfile) && Array.isArray(st.luckysheetCellUpdate))
  if (!fromFx && !fromEd && !(ctx?.luckysheetCellUpdate?.length)) return null
  const node = fromFx ? fx : ed
  if (!node) return null
  let text = (node.innerText || '').replace(/\u00a0/g, ' ')
  if (text.endsWith('\n')) text = text.slice(0, -1)
  return { text: fwFixed(text), ctx }
}

/** Ctrl+Enter：把正在输入的内容填进整个选区，相对公式随单元格偏移，选区不移动 */
function fillSelectionFromEdit(text, ctx) {
  const api = instRef.current
  const sheet = api?.getSheet?.()
  if (!api?.setCellValuesByRange || !sheet) return false
  const ranges = (ctx?.luckysheet_select_save?.length ? ctx.luckysheet_select_save : api.getSelection?.()) || []
  if (!ranges.length) return false
  const origin = ctx?.luckysheetCellUpdate?.length >= 2
    ? { r: ctx.luckysheetCellUpdate[0], c: ctx.luckysheetCellUpdate[1] }
    : {
      r: ranges[0].row_focus ?? ranges[0].row?.[0] ?? 0,
      c: ranges[0].column_focus ?? ranges[0].column?.[0] ?? 0,
    }
  const formula = text.startsWith('=')
  let count = 0
  const boxes = ranges.map((sel) => {
    const r0 = Math.min(sel.row[0], sel.row[1] ?? sel.row[0])
    const r1 = Math.max(sel.row[0], sel.row[1] ?? sel.row[0])
    const c0 = Math.min(sel.column[0], sel.column[1] ?? sel.column[0])
    const c1 = Math.max(sel.column[0], sel.column[1] ?? sel.column[0])
    count += (r1 - r0 + 1) * (c1 - c0 + 1)
    return { r0, r1, c0, c1 }
  })
  if (count > 8000) {
    Message.warning('选区过大，无法一次填充')
    return false
  }
  boxes.forEach((box) => {
    const matrix = []
    for (let r = box.r0; r <= box.r1; r += 1) {
      const line = []
      for (let c = box.c0; c <= box.c1; c += 1) {
        line.push(formula ? shiftFormula(text, r - origin.r, c - origin.c) : text)
      }
      matrix.push(line)
    }
    api.setCellValuesByRange(matrix, { row: [box.r0, box.r1], column: [box.c0, box.c1] }, { id: sheet.id })
  })
  exitCellEdit()
  return true
}

/** Excel：Ctrl+Shift+L 开关筛选；Ctrl+Enter 把输入填充到选区 */
function onSheetHotkey(e) {
  if (e.repeat || !sheetHasFocus(e)) return false
  const key = String(e.key || '')
  const ctrl = e.ctrlKey || e.metaKey
  if (key === 'Escape' && copyMarkOn && !editingInputText()) {
    hideCopyMark()
    e.preventDefault()
    e.stopPropagation()
    return true
  }
  if (ctrl && !e.shiftKey && !e.altKey && (e.code === 'KeyC' || key.toLowerCase() === 'c')) {
    if (editingInputText()) return false
    e.preventDefault()
    e.stopPropagation()
    const pack = rememberCopy()
    copyText(pack?.text || '')
    return true
  }
  if (ctrl && !e.shiftKey && !e.altKey && (e.code === 'KeyX' || key.toLowerCase() === 'x')) {
    if (editingInputText()) return false
    e.preventDefault()
    e.stopPropagation()
    const pack = rememberCopy()
    copyText(pack?.text || '')
    clearSelection('all')
    return true
  }
  if (ctrl && !e.shiftKey && !e.altKey && (e.code === 'KeyV' || key.toLowerCase() === 'v')) {
    if (editingInputText()) return false
    e.preventDefault()
    e.stopPropagation()
    pasteFromClipboard('all')
    return true
  }
  if (ctrl && e.shiftKey && !e.altKey && (e.code === 'KeyL' || key.toLowerCase() === 'l')) {
    e.preventDefault()
    e.stopPropagation()
    exitCellEdit()
    enableFilter()
    return true
  }
  if (key === 'Enter' && ctrl && !e.shiftKey && !e.altKey) {
    const editing = editingInputText()
    if (!editing) return false
    e.preventDefault()
    e.stopPropagation()
    fillSelectionFromEdit(editing.text, editing.ctx)
    return true
  }
  return false
}

/** Enter 捕获阶段：出现过全角等号且 DOM 里已丢失 '=' 时，补回完整公式再交给 fortune 提交 */
function onDocFormulaKeydown(e) {
  if (onSheetHotkey(e)) return
  if (e.key === 'Escape' && (linkPop.picking || linkPop.show)) {
    e.preventDefault()
    e.stopPropagation()
    if (linkPop.picking) {
      linkPop.picking = false
      linkPop.show = true
      nextTick(() => placeLinkPop())
    } else {
      linkPop.show = false
      linkPop.sheetsOpen = false
    }
    return
  }
  // 补全列表打开时接管导航/确认/关闭键
  if (funcSug.visible && funcSug.items.length) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const d = e.key === 'ArrowDown' ? 1 : -1
      funcSug.index = (funcSug.index + d + funcSug.items.length) % funcSug.items.length
      e.preventDefault(); e.stopPropagation(); return
    }
    if ((e.key === 'Enter' || e.key === 'Tab') && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault(); e.stopPropagation()
      acceptFuncSug(funcSug.index)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation()
      hideFuncSug()
      return
    }
  }
  // 签名卡显示时 Escape 只关卡片，不放行给 fortune（否则整个公式会被取消）
  if (e.key === 'Escape' && funcTip.visible) {
    e.preventDefault(); e.stopPropagation()
    hideFuncTip()
    return
  }
  if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
  hideFuncTip()
  hideFuncSug()
  // 公式处于「空参数」位置（光标前是 ( 或 ,）时 Enter 不提交——
  // 防止手滑把 =SUM( / =SUM(A1, 提交成 =SUM() / =SUM(A1, )，Excel 同样会拦
  {
    const act = activeFormulaEditor()
    if (act && act.box.offsetParent !== null) {
      const text = (act.ed.innerText || '').trim()
      if (text.startsWith('=')) {
        const off = funcCaretOffset(act.ed)
        const prev = off > 0 ? (act.ed.innerText || '').slice(0, off).replace(/\s+$/, '').slice(-1) : ''
        if (prev === '(' || prev === ',') {
          e.preventDefault(); e.stopPropagation()
          return
        }
      }
    }
  }
  if (!fwSawFullwidthEquals) return
  const editor = document.getElementById('luckysheet-rich-text-editor')
  if (!editor) return
  const text = (editor.innerText || '').trim()
  fwSawFullwidthEquals = false
  if (!text || text.startsWith('=')) return
  editor.innerText = fwFixed(`=${text}`)
}
function onDocFormulaInput(e) {
  const t = e.target
  if (t && (t.id === 'luckysheet-rich-text-editor' || (t.closest && t.closest('#luckysheet-rich-text-editor')))) {
    normalizeFormulaTyping()
    updateFuncTip()
  }
}
document.addEventListener('input', onDocFormulaInput, true)
document.addEventListener('compositionend', onDocFormulaInput, true)
document.addEventListener('keydown', onDocFormulaKeydown, true)

/* ---------------- 函数语法提示（飞书表格样式） ----------------
 * fortune 1.0.4 无任何函数提示能力。编辑公式时解析光标所在的最内层函数，
 * 在编辑格下方浮出签名卡：当前参数高亮；可展开看示例/摘要/参数说明。 */
const FUNC_DOCS = {
  SUM: { p: ['值1', '[数值2, ...]'], ex: 'SUM(A2:A100, 101)', s: '返回一组数值和/或单元格的总和。', d: ['要相加的第一个数值或范围。', '要与“值1”相加的其他数值或范围。'] },
  AVERAGE: { p: ['值1', '[值2, ...]'], ex: 'AVERAGE(A2:A100, 101)', s: '返回一组数值的算术平均值。', d: ['要计算平均值的第一个数值或范围。', '要计算平均值的其他数值或范围。'] },
  COUNT: { p: ['值1', '[值2, ...]'], ex: 'COUNT(A2:A100)', s: '统计一组数值中数字的个数。', d: ['要检查的第一个值或范围。', '要检查的其他值或范围。'] },
  COUNTA: { p: ['值1', '[值2, ...]'], ex: 'COUNTA(A2:A100)', s: '统计一组数据中非空单元格的个数。', d: ['要检查的第一个值或范围。', '要检查的其他值或范围。'] },
  COUNTBLANK: { p: ['范围'], ex: 'COUNTBLANK(A2:A100)', s: '统计给定范围内空单元格的个数。', d: ['要检查空值的范围。'] },
  COUNTIF: { p: ['范围', '条件'], ex: 'COUNTIF(A1:A10, ">20")', s: '统计满足给定条件的单元格个数。', d: ['要检查的范围。', '要应用的条件，如 ">20"、"苹果"。'] },
  COUNTIFS: { p: ['范围1', '条件1', '[范围2, 条件2, ...]'], ex: 'COUNTIFS(A1:A10, ">20", B1:B10, "是")', s: '统计同时满足多个条件的单元格个数。', d: ['要检查的第一个范围。', '要应用于范围1的条件。', '其他范围及对应条件。'] },
  SUMIF: { p: ['范围', '条件', '[求和范围]'], ex: 'SUMIF(A1:A10, ">20", B1:B10)', s: '对满足条件的单元格求和。', d: ['要按条件检查的范围。', '要应用的条件。', '实际求和的范围；缺省时对“范围”本身求和。'] },
  SUMIFS: { p: ['求和范围', '范围1', '条件1', '[范围2, 条件2, ...]'], ex: 'SUMIFS(C1:C10, A1:A10, ">20", B1:B10, "是")', s: '对同时满足多个条件的单元格求和。', d: ['实际求和的范围。', '要检查的第一个范围。', '要应用于范围1的条件。', '其他范围及对应条件。'] },
  SUMPRODUCT: { p: ['范围1', '[范围2, ...]'], ex: 'SUMPRODUCT(A1:A10, B1:B10)', s: '将给定数组间对应元素相乘并返回乘积之和。', d: ['第一个数组或范围。', '其他数组或范围，尺寸须与第一个一致。'] },
  AVERAGEIF: { p: ['范围', '条件', '[求平均范围]'], ex: 'AVERAGEIF(A1:A10, ">20", B1:B10)', s: '对满足条件的单元格求算术平均值。', d: ['要按条件检查的范围。', '要应用的条件。', '实际求平均的范围；缺省时对“范围”本身求平均。'] },
  MAX: { p: ['值1', '[值2, ...]'], ex: 'MAX(A2:A100, 5)', s: '返回一组数值中的最大值。', d: ['要比较的第一个数值或范围。', '要比较的其他数值或范围。'] },
  MIN: { p: ['值1', '[值2, ...]'], ex: 'MIN(A2:A100, 5)', s: '返回一组数值中的最小值。', d: ['要比较的第一个数值或范围。', '要比较的其他数值或范围。'] },
  LARGE: { p: ['数据', 'n'], ex: 'LARGE(A2:A100, 3)', s: '返回数据集中第 n 大的值。', d: ['数据范围。', '要返回的名次（第几大）。'] },
  SMALL: { p: ['数据', 'n'], ex: 'SMALL(A2:A100, 3)', s: '返回数据集中第 n 小的值。', d: ['数据范围。', '要返回的名次（第几小）。'] },
  RANK: { p: ['值', '数据', '[是否升序]'], ex: 'RANK(A2, A2:A100)', s: '返回某值在一组数据中的排名。', d: ['要排名的值。', '数据范围。', '0 或省略为降序排名，1 为升序。'] },
  MEDIAN: { p: ['值1', '[值2, ...]'], ex: 'MEDIAN(A2:A100)', s: '返回一组数值的中位数。', d: ['要计算中位数的数值或范围。', '其他数值或范围。'] },
  ROUND: { p: ['值', '位数'], ex: 'ROUND(99.44, 1) → 99.4', s: '按指定位数对数值四舍五入。', d: ['要四舍五入的数值。', '保留的小数位数。'] },
  ROUNDUP: { p: ['值', '位数'], ex: 'ROUNDUP(99.11, 1) → 99.2', s: '按指定位数向上舍入数值（远离零）。', d: ['要向上舍入的数值。', '保留的小数位数。'] },
  ROUNDDOWN: { p: ['值', '位数'], ex: 'ROUNDDOWN(99.99, 1) → 99.9', s: '按指定位数向下舍入数值（趋近零）。', d: ['要向下舍入的数值。', '保留的小数位数。'] },
  INT: { p: ['值'], ex: 'INT(99.99) → 99', s: '将数值向下取整为最接近的整数。', d: ['要取整的数值。'] },
  MOD: { p: ['被除数', '除数'], ex: 'MOD(10, 3) → 1', s: '返回两数相除的余数，结果符号与除数相同。', d: ['要被除的数值。', '用来除的数值。'] },
  ABS: { p: ['值'], ex: 'ABS(-2) → 2', s: '返回数值的绝对值。', d: ['要求绝对值的数值。'] },
  POWER: { p: ['底数', '指数'], ex: 'POWER(2, 10) → 1024', s: '返回底数的指定次幂。', d: ['底数。', '指数。'] },
  SQRT: { p: ['值'], ex: 'SQRT(9) → 3', s: '返回数值的正平方根。', d: ['要求平方根的非负数值。'] },
  PRODUCT: { p: ['值1', '[值2, ...]'], ex: 'PRODUCT(A2:A100)', s: '返回一组数值的乘积。', d: ['要相乘的第一个数值或范围。', '要相乘的其他数值或范围。'] },
  IF: { p: ['条件', '为真值', '[为假值]'], ex: 'IF(A2 > 90, "优秀", "合格")', s: '条件为真时返回一个值，否则返回另一个值。', d: ['要判断的条件表达式。', '条件为真时返回的值。', '条件为假时返回的值；省略则为 FALSE。'] },
  IFS: { p: ['条件1', '值1', '[条件2, 值2, ...]'], ex: 'IFS(A2 > 90, "A", A2 > 80, "B")', s: '按顺序检查多个条件，返回第一个为真的条件对应的值。', d: ['第一个条件。', '条件1为真时返回的值。', '后续条件及对应返回值。'] },
  IFERROR: { p: ['值', '备用值'], ex: 'IFERROR(A2/B2, "除数不能为0")', s: '若表达式出错则返回备用值，否则返回表达式本身的结果。', d: ['要计算的表达式。', '表达式出错时返回的值。'] },
  AND: { p: ['逻辑1', '[逻辑2, ...]'], ex: 'AND(A2 > 1, A2 < 10)', s: '所有参数均为真时返回 TRUE。', d: ['要检查的第一个逻辑表达式。', '要检查的其他逻辑表达式。'] },
  OR: { p: ['逻辑1', '[逻辑2, ...]'], ex: 'OR(A2 > 1, A2 < 10)', s: '任一参数为真即返回 TRUE。', d: ['要检查的第一个逻辑表达式。', '要检查的其他逻辑表达式。'] },
  NOT: { p: ['逻辑值'], ex: 'NOT(A2 > 1)', s: '对逻辑值取反：TRUE 变 FALSE，FALSE 变 TRUE。', d: ['要取反的逻辑表达式。'] },
  VLOOKUP: { p: ['查找值', '范围', '列序号', '[是否近似匹配]'], ex: 'VLOOKUP("苹果", A2:C10, 3, FALSE)', s: '在范围首列查找指定值，返回该值所在行指定列的内容。', d: ['要在首列中查找的值。', '查找的范围，首列为匹配列。', '要返回的范围内的列号（首列为 1）。', 'FALSE 为精确匹配（推荐），TRUE 或省略为近似匹配。'] },
  HLOOKUP: { p: ['查找值', '范围', '行序号', '[是否近似匹配]'], ex: 'HLOOKUP("Q1", A1:F10, 3, FALSE)', s: '在范围首行查找指定值，返回该值所在列指定行的内容。', d: ['要在首行中查找的值。', '查找的范围，首行为匹配行。', '要返回的范围内的行号（首行为 1）。', 'FALSE 为精确匹配（推荐），TRUE 或省略为近似匹配。'] },
  INDEX: { p: ['范围', '行号', '[列号]'], ex: 'INDEX(A2:C10, 2, 3)', s: '返回范围中指定行列交叉处的值。', d: ['要取值的范围。', '要返回的行号。', '要返回的列号；单列范围可省略。'] },
  MATCH: { p: ['查找值', '范围', '[匹配类型]'], ex: 'MATCH("苹果", A2:A10, 0)', s: '返回指定值在范围中的相对位置。', d: ['要查找的值。', '要搜索的单行或单列范围。', '0 为精确匹配（推荐），1 为小于查找值的最大值，-1 为大于查找值的最小值。'] },
  LOOKUP: { p: ['查找值', '搜索范围', '[结果范围]'], ex: 'LOOKUP("苹果", A2:A10, B2:B10)', s: '在单行或单列中查找值，返回另一行/列中相同位置的值（要求升序）。', d: ['要查找的值。', '要搜索的单行或单列范围。', '要返回结果的单行或单列范围。'] },
  OFFSET: { p: ['参照', '行偏移', '列偏移', '[高度]', '[宽度]'], ex: 'OFFSET(A1, 2, 1)', s: '返回从指定参照偏移后的单元格或区域引用。', d: ['偏移的起始参照。', '向下偏移的行数。', '向右偏移的列数。', '返回区域的高度，缺省同参照。', '返回区域的宽度，缺省同参照。'] },
  ROW: { p: ['[引用]'], ex: 'ROW(B3) → 3', s: '返回引用的行号；省略参数则返回公式所在单元格的行号。', d: ['要取行号的单元格或范围。'] },
  COLUMN: { p: ['[引用]'], ex: 'COLUMN(C2) → 3', s: '返回引用的列号；省略参数则返回公式所在单元格的列号。', d: ['要取列号的单元格或范围。'] },
  ROWS: { p: ['范围'], ex: 'ROWS(A2:A100) → 99', s: '返回范围包含的行数。', d: ['要统计的范围。'] },
  COLUMNS: { p: ['范围'], ex: 'COLUMNS(A2:C100) → 3', s: '返回范围包含的列数。', d: ['要统计的范围。'] },
  TODAY: { p: [], ex: 'TODAY()', s: '返回当前日期。', d: [] },
  NOW: { p: [], ex: 'NOW()', s: '返回当前日期和时间。', d: [] },
  YEAR: { p: ['日期'], ex: 'YEAR(DATE(2026, 9, 29)) → 2026', s: '返回日期中的年份。', d: ['要提取年份的日期。'] },
  MONTH: { p: ['日期'], ex: 'MONTH(DATE(2026, 9, 29)) → 9', s: '返回日期中的月份（1–12）。', d: ['要提取月份的日期。'] },
  DAY: { p: ['日期'], ex: 'DAY(DATE(2026, 9, 29)) → 29', s: '返回日期中的日（1–31）。', d: ['要提取“日”的日期。'] },
  DATE: { p: ['年', '月', '日'], ex: 'DATE(2026, 9, 29)', s: '将年、月、日组合为日期。', d: ['年份。', '月份。', '日。'] },
  DATEDIF: { p: ['开始日期', '结束日期', '单位'], ex: 'DATEDIF(A2, TODAY(), "M")', s: '返回两个日期之间的间隔数。', d: ['开始日期。', '结束日期。', '单位："Y"整年、"M"整月、"D"天数。'] },
  WEEKDAY: { p: ['日期', '[类型]'], ex: 'WEEKDAY(TODAY())', s: '返回日期是星期几（数字表示）。', d: ['要检查的日期。', '1 或省略：周日=1；2：周一=1；3：周一=0。'] },
  TEXT: { p: ['值', '格式'], ex: 'TEXT(1234.5, "0.00") → 1234.50', s: '按指定格式将数值转为文本。', d: ['要格式化的数值或日期。', '格式代码，如 "0.00"、"yyyy-mm-dd"。'] },
  VALUE: { p: ['文本'], ex: 'VALUE("123") → 123', s: '将数字文本转为数值。', d: ['要转换的文本。'] },
  LEN: { p: ['文本'], ex: 'LEN("北京") → 2', s: '返回文本的字符个数。', d: ['要计算长度的文本。'] },
  LEFT: { p: ['文本', '[字符数]'], ex: 'LEFT("ABC123", 3) → "ABC"', s: '从文本左侧起返回指定个数的字符。', d: ['要截取的文本。', '要返回的字符数，缺省为 1。'] },
  RIGHT: { p: ['文本', '[字符数]'], ex: 'RIGHT("ABC123", 3) → "123"', s: '从文本右侧起返回指定个数的字符。', d: ['要截取的文本。', '要返回的字符数，缺省为 1。'] },
  MID: { p: ['文本', '起始位置', '字符数'], ex: 'MID("ABC123", 2, 3) → "BC1"', s: '从文本指定位置起返回指定个数的字符。', d: ['要截取的文本。', '起始位置（从 1 计）。', '要返回的字符数。'] },
  FIND: { p: ['查找文本', '被查文本', '[起始位置]'], ex: 'FIND("B", "ABC") → 2', s: '返回一段文本在另一段文本中的位置（区分大小写）。', d: ['要查找的文本。', '被查找的文本。', '开始查找的位置，缺省为 1。'] },
  SEARCH: { p: ['查找文本', '被查文本', '[起始位置]'], ex: 'SEARCH("b", "ABC") → 2', s: '返回一段文本在另一段文本中的位置（不区分大小写，支持通配符）。', d: ['要查找的文本。', '被查找的文本。', '开始查找的位置，缺省为 1。'] },
  SUBSTITUTE: { p: ['文本', '旧文本', '新文本', '[替换第几处]'], ex: 'SUBSTITUTE("a-b-c", "-", "+")', s: '将文本中的指定内容替换为新内容。', d: ['要处理的文本。', '要被替换的内容。', '替换成的内容。', '只替换第几处；省略则替换全部。'] },
  TRIM: { p: ['文本'], ex: 'TRIM(" A B ") → "A B"', s: '去掉文本首尾空格，并把中间连续空格缩为一个。', d: ['要清理的文本。'] },
  UPPER: { p: ['文本'], ex: 'UPPER("abc") → "ABC"', s: '将文本转为全大写。', d: ['要转换的文本。'] },
  LOWER: { p: ['文本'], ex: 'LOWER("ABC") → "abc"', s: '将文本转为全小写。', d: ['要转换的文本。'] },
  CONCATENATE: { p: ['文本1', '[文本2, ...]'], ex: 'CONCATENATE(A2, " ", B2)', s: '将多个文本连接为一个文本。', d: ['要连接的第一段文本。', '要连接的其他文本。'] },
  TEXTJOIN: { p: ['分隔符', '是否忽略空值', '文本1', '[文本2, ...]'], ex: 'TEXTJOIN("-", TRUE, A2:A10)', s: '用指定分隔符连接多个文本。', d: ['连接用的分隔符。', 'TRUE 忽略空单元格。', '要连接的第一段文本或范围。', '要连接的其他文本或范围。'] },
  EXACT: { p: ['文本1', '文本2'], ex: 'EXACT(A2, B2)', s: '比较两段文本是否完全相同（区分大小写）。', d: ['第一段文本。', '第二段文本。'] },
  STDEV: { p: ['值1', '[值2, ...]'], ex: 'STDEV(A2:A100)', s: '基于样本估算标准差。', d: ['样本的第一个数值或范围。', '样本的其他数值或范围。'] },
  VAR: { p: ['值1', '[值2, ...]'], ex: 'VAR(A2:A100)', s: '基于样本估算方差。', d: ['样本的第一个数值或范围。', '样本的其他数值或范围。'] },
  RANDBETWEEN: { p: ['下限', '上限'], ex: 'RANDBETWEEN(1, 100)', s: '返回两数之间的随机整数。', d: ['随机数下限。', '随机数上限。'] },
  RAND: { p: [], ex: 'RAND()', s: '返回 0 到 1 之间的随机数。', d: [] },
}
const FUNC_TIP_GENERIC = { p: ['参数1', '[参数2, ...]'], ex: '', s: '', d: [] }

const funcTip = reactive({
  visible: false, name: '', parts: [], argIndex: -1, expanded: false,
  docs: null, x: 0, y: 0, above: false, dismissed: false, lastKey: '',
})

/** 光标前文本 → 最内层函数 { name, argIndex }；不在任何函数括号内时返回 null */
function parseFuncContext(text) {
  const stack = []
  const re = /([A-Za-z][A-Za-z0-9_.]*)\s*\(|[(),]/g
  let m
  while ((m = re.exec(text))) {
    const t = m[0]
    if (m[1]) stack.push({ name: m[1].toUpperCase(), arg: 0 })
    else if (t === '(') stack.push(null)
    else if (t === ',') {
      const top = stack[stack.length - 1]
      if (top && top.name) top.arg++
    } else {
      while (stack.length && stack[stack.length - 1] === null) stack.pop()
      if (stack.length) stack.pop()
    }
  }
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i]) return stack[i]
  return null
}
function funcCaretOffset(ed) {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return -1
  const r = sel.getRangeAt(0)
  const pre = document.createRange()
  pre.selectNodeContents(ed)
  try { pre.setEnd(r.endContainer, r.endOffset) } catch { return -1 }
  return pre.toString().length
}
/** 当前公式编辑的活跃编辑器：选区锚在 fx 公式栏 → 用 fx，否则用单元格编辑器。
 *  fortune 在 fx 编辑态点格子原生就能插引用（光标前一字符是 ( , = 运算符时），选区插入无需自研。 */
function activeFormulaEditor() {
  const sel = window.getSelection()
  const fx = document.getElementById('luckysheet-functionbox-cell')
  if (fx && sel?.anchorNode && fx.contains(sel.anchorNode)) {
    return { ed: fx, box: fx.closest('.luckysheet-input-box') || fx, isFx: true }
  }
  const ed = document.getElementById('luckysheet-rich-text-editor')
  const box = ed ? (ed.closest('.luckysheet-input-box') || ed.parentElement) : null
  return ed && box ? { ed, box, isFx: false } : null
}
function updateFuncTip() {
  const act = activeFormulaEditor()
  if (!act || act.box.offsetParent === null) { hideFuncTip(); hideFuncSug(); return }
  const text = (act.ed.innerText || '').trim()
  if (!text.startsWith('=')) { hideFuncTip(); hideFuncSug(); return }
  const off = funcCaretOffset(act.ed)
  if (off < 0) { hideFuncTip(); hideFuncSug(); return }
  const r = act.box.getBoundingClientRect()
  // —— 状态一：函数名补全 —— 光标前是正在输入的名字（前随 = ( , 或运算符），名字后没有 '('
  const sug = detectFuncSuggest(text.slice(0, off), text, off)
  if (sug.items.length) {
    const q = sug.query
    if (funcSug.query !== q || !funcSug.visible) {
      funcSug.index = 0
      funcSug.query = q
    }
    if (funcSug.index >= sug.items.length) funcSug.index = 0
    funcSug.items = sug.items
    funcSug.partial = sug.partial
    funcSug.x = r.left
    funcSug.above = r.bottom + 320 > window.innerHeight && r.top > 320
    funcSug.y = funcSug.above ? r.top - 6 : r.bottom + 6
    funcSug.visible = true
    hideFuncTip()
    return
  }
  hideFuncSug()
  // —— 状态二：签名卡 ——
  let ctx = parseFuncContext(text.slice(0, off))
  if (!ctx) {
    // 光标不在任何函数括号内（如回显后停在末尾）→ 显示最外层函数，不高亮参数
    const m = /([A-Za-z][A-Za-z0-9_.]*)\s*\(/.exec(text)
    if (m) ctx = { name: m[1].toUpperCase(), arg: -1 }
  }
  if (!ctx) { hideFuncTip(); return }
  if (funcTip.lastKey !== ctx.name) { funcTip.lastKey = ctx.name; funcTip.dismissed = false }
  if (funcTip.dismissed) { hideFuncTip(); return }
  const docs = FUNC_DOCS[ctx.name] || FUNC_TIP_GENERIC
  funcTip.name = ctx.name
  funcTip.parts = docs.p
  funcTip.argIndex = Math.min(ctx.arg, docs.p.length - 1)
  funcTip.docs = docs
  funcTip.x = r.left
  funcTip.above = r.bottom + 240 > window.innerHeight && r.top > 240
  funcTip.y = funcTip.above ? r.top - 6 : r.bottom + 6
  funcTip.visible = true
}
function hideFuncTip() {
  if (funcTip.visible) funcTip.visible = false
}
function dismissFuncTip() {
  funcTip.dismissed = true
  funcTip.visible = false
}

/* —— 函数名自动补全 —— */
const FUNC_COMMON = ['SUM', 'IF', 'AVERAGE', 'COUNT', 'COUNTIF', 'SUMIF', 'VLOOKUP', 'MAX', 'MIN', 'ROUND', 'IFERROR', 'COUNTIFS', 'SUMIFS']
const funcSug = reactive({
  visible: false, items: [], index: 0, partial: '', query: '', x: 0, y: 0, above: false,
})
function detectFuncSuggest(before, text, off) {
  const m = /([A-Za-z][A-Za-z0-9_.]*)$/.exec(before)
  if (!m) return { items: [], query: '', partial: '' }
  const partial = m[1]
  const prev = before.charAt(before.length - partial.length - 1)
  // 名字必须紧跟 = ( , 或运算符之后；且名字后面没打 '('
  if (!/[=(,+\-*/<>&^%]/.test(prev)) return { items: [], query: '', partial: '' }
  if (text.charAt(off) === '(') return { items: [], query: '', partial: '' }
  if (partial.length > 12 || /^[A-Za-z]{1,3}[0-9]+$/.test(partial)) return { items: [], query: '', partial: '' }
  const q = partial.toUpperCase()
  const rank = (k) => { const i = FUNC_COMMON.indexOf(k); return i === -1 ? 99 : i }
  const items = Object.keys(FUNC_DOCS)
    .filter((k) => k.startsWith(q))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .slice(0, 12)
    .map((k) => ({ name: k, desc: FUNC_DOCS[k].s }))
  return { items, query: q, partial }
}
function hideFuncSug() {
  if (funcSug.visible) funcSug.visible = false
}
function acceptFuncSug(i) {
  const item = funcSug.items[i]
  hideFuncSug()
  if (!item) return
  const act = activeFormulaEditor()
  if (!act) return
  act.ed.focus()
  const sel = window.getSelection()
  if (sel && sel.modify) {
    for (let k = 0; k < funcSug.partial.length; k++) sel.modify('extend', 'backward', 'character')
  }
  // fortune 的 onChange 只在真实 keydown 之后才会处理公式输入（lastKeyDownEventRef 门槛），
  // execCommand 插入对它不可见 → 编辑器停留纯文本、公式选区判定（israngeseleciton）不成立，
  // 随后点/拖格子会被 fortune 当普通点击提交公式，表现为编辑器「自动关闭」成 =SUM()。
  // 先派发一个普通字符 keydown 把 fortune 的输入管线唤醒，再插入 NAME( ，
  // 让 fortune 在自己的 immer draft 里完整重建彩色 span + 引用高亮，光标落回 '(' 后，
  // 选区判定成立，点/拖格子即可正常插入引用。
  const wake = new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true, cancelable: true })
  Object.defineProperty(wake, 'keyCode', { get: () => 65 })
  act.ed.dispatchEvent(wake)
  document.execCommand('insertText', false, item.name + '(')
  // 兜底：若唤醒路径未生效（DOM 仍是纯文本、无彩色 span），手动补跑 handleFormulaInput。
  // 此时 ctx 是 frozen 快照，fortune 内部个别状态写回会抛错，但不影响 DOM 重建这一核心目标。
  if (!act.ed.querySelector('span')) {
    try {
      const ctx = reactStateBy((st) => Array.isArray(st.luckysheetfile))
      const cell = document.getElementById('luckysheet-rich-text-editor')
      const fx = document.getElementById('luckysheet-functionbox-cell')
      const $editor = act.isFx ? fx : cell
      const $copyTo = act.isFx ? cell : fx
      if (ctx && $editor) handleFormulaInput(ctx, $copyTo, $editor, 65, ' ')
    } catch { /* 兜底失败不阻断 */ }
  }
  updateFuncTip()
}
function onDocFuncSelChange() {
  if (!funcTip.visible && !funcSug.visible) {
    const act = activeFormulaEditor()
    if (!act || !(act.ed.innerText || '').trim().startsWith('=')) return
  }
  updateFuncTip()
}
function onDocFuncScroll() {
  if (funcTip.visible) updateFuncTip()
}
document.addEventListener('selectionchange', onDocFuncSelChange, true)
document.addEventListener('scroll', onDocFuncScroll, true)

/** fortune 双击进编辑态的回显链路依赖几个「一次性」全局状态，异常退出会把它们弄脏：
 *  - selection 残留锚在隐藏编辑器里 → 包内 israngeseleciton 把下次双击误判成公式选区点击，
 *    handleCellAreaDoubleClick / handleCellAreaMouseDown 开头直接 return，双击失效；
 *  - doNotUpdateCell / overwriteCell / ignoreWriteCell 残留 → 回显 populate 被跳过或写空，
 *    编辑器显示上一次的残留文本（看起来就是「只有公式前面几个字母」）。
 * 非编辑态下按下鼠标时把这些残留清掉，让每次双击都从干净状态开始。编辑态中不动，
 * 否则会破坏「编辑公式时点格子加引用」的合法操作。 */
function cleanEditResidue() {
  if (cfState.pickingRange) return
  const ctx = reactStateBy((st) => Array.isArray(st.luckysheetfile))
  if (!ctx) return
  if (ctx.luckysheetCellUpdate?.length) return
  hideFuncTip()
  hideFuncSug()
  const fc = ctx.formulaCache
  if (fc) {
    fc.rangestart = false
    fc.rangedrag_column_start = false
    fc.rangedrag_row_start = false
  }
  const cache = reactStateBy((st) => Array.isArray(st.undoList) && Array.isArray(st.redoList))
  if (cache) {
    delete cache.doNotUpdateCell
    delete cache.overwriteCell
    delete cache.ignoreWriteCell
    delete cache.doNotFocus
  }
  const sel = window.getSelection()
  const anchor = sel?.anchorNode
  if (anchor) {
    const el = anchor.nodeType === 1 ? anchor : anchor.parentElement
    if (el?.closest?.('#luckysheet-rich-text-editor, #luckysheet-functionbox-cell')) sel.removeAllRanges()
  }
  const ed = document.getElementById('luckysheet-rich-text-editor')
  if (ed?.innerHTML) ed.innerHTML = ''
}
function onDocEditResidueDown(e) {
  if (!hostRef.value?.contains(e.target)) return
  // 补全列表打开时点格子：先接受当前高亮函数（插入 NAME( ），再放行事件给 fortune——
  // 接受后光标停在 '(' 后，fortune 原生判定为选区插入，本次点击/拖选的格子直接成为第一个引用。
  // （旧逻辑只是拦截提交、列表保持，用户点格子无任何反馈，误以为无法选区域）
  if (funcSug.visible && funcSug.items.length) {
    const act = activeFormulaEditor()
    if (act && act.box.offsetParent !== null && e.target.closest?.('.fortune-cell-area')) {
      acceptFuncSug(funcSug.index)
      return
    }
  }
  cleanEditResidue()
}
document.addEventListener('mousedown', onDocEditResidueDown, true)

/* —— fx 公式栏拖选扩展 ——
   fortune 在 fx 编辑态点格子能原生插首个引用（mousedown），但拖选扩展不会改写 fx 文本
   （原生缺陷，拖完整片区域 fx 里仍只有左上角一个格，回车后公式残缺）。
   注意：fx 编辑态拖选时 fortune 不更新 luckysheet_select_save（停留在编辑前的选区），
   所以不能读选区状态，只能按鼠标坐标 + 列宽/行高配置自己算当前格。 */
const fxDrag = { armed: false, anchor: null, lastWritten: '', frame: 0 }
function colName(c) {
  let s = ''
  c += 1
  while (c > 0) {
    const m = (c - 1) % 26
    s = String.fromCharCode(65 + m) + s
    c = Math.floor((c - 1) / 26)
  }
  return s
}
function cellFromPoint(ctx, clientX, clientY) {
  const g = geomFromPoint(ctx, clientX, clientY)
  return g ? { r: g.r, c: g.c } : null
}
function cellAt(clientX, clientY) {
  return cellFromPoint(ctxState() || {}, clientX, clientY)
}

// 完整几何信息：单元格 (r,c) + 其在视口中的矩形（虚线框/悬浮提示定位用）
function geomFromPoint(ctx, clientX, clientY) {
  const cv = document.querySelector('.fortune-cell-area canvas') || hostRef.value?.querySelector('canvas')
  if (!cv) return null
  const rect = cv.getBoundingClientRect()
  const x = clientX - rect.left - (ctx.rowHeaderWidth || 0) + (ctx.scrollLeft || 0)
  const y = clientY - rect.top - (ctx.columnHeaderHeight || 0) + (ctx.scrollTop || 0)
  if (x < 0 || y < 0) return null
  const cw = (c) => (ctx.config?.columnlen?.[c] ?? ctx.defaultcollen ?? 73)
  const rh = (r) => (ctx.config?.rowlen?.[r] ?? ctx.defaultrowlen ?? 24)
  let c = 0
  let colX = 0
  while (x >= colX + cw(c)) { colX += cw(c); c += 1; if (c > 9999) return null }
  let r = 0
  let rowY = 0
  while (y >= rowY + rh(r)) { rowY += rh(r); r += 1; if (r > 99999) return null }
  return {
    r, c,
    vx: rect.left + (ctx.rowHeaderWidth || 0) + colX - (ctx.scrollLeft || 0),
    vy: rect.top + (ctx.columnHeaderHeight || 0) + rowY - (ctx.scrollTop || 0),
    vw: cw(c), vh: rh(r),
  }
}
// 由行列号反查视口矩形（无需鼠标位置）
function geomByRC(ctx, row, col) {
  const cv = document.querySelector('.fortune-cell-area canvas') || hostRef.value?.querySelector('canvas')
  if (!cv || row < 0 || col < 0 || row > 99999 || col > 9999) return null
  const rect = cv.getBoundingClientRect()
  const cw = (c) => (ctx.config?.columnlen?.[c] ?? ctx.defaultcollen ?? 73)
  const rh = (r) => (ctx.config?.rowlen?.[r] ?? ctx.defaultrowlen ?? 24)
  let colX = 0
  for (let c = 0; c < col; c++) colX += cw(c)
  let rowY = 0
  for (let r = 0; r < row; r++) rowY += rh(r)
  return {
    r: row, c: col,
    vx: rect.left + (ctx.rowHeaderWidth || 0) + colX - (ctx.scrollLeft || 0),
    vy: rect.top + (ctx.columnHeaderHeight || 0) + rowY - (ctx.scrollTop || 0),
    vw: cw(col), vh: rh(row),
  }
}
const ctxState = () => reactStateBy((st) => Array.isArray(st.luckysheetfile))
const inCellArea = (e) => !!e.target?.closest?.('.fortune-cell-area')

/* —— 混合表：单元格级 hover / click / 右键事件转发 —— */
const mxHover = { r: -1, c: -1, frame: 0 }
function onMxMouseMove(e) {
  if (!inCellArea(e)) return
  if (mxHover.frame) return
  const { clientX, clientY } = e
  mxHover.frame = requestAnimationFrame(() => {
    mxHover.frame = 0
    const g = geomFromPoint(ctxState() || {}, clientX, clientY)
    if (!g) {
      if (mxHover.r !== -1) { mxHover.r = -1; mxHover.c = -1; emit('cellhover', null) }
      scheduleHideLinkBar()
      return
    }
    syncLinkBar(g)
    if (g.r === mxHover.r && g.c === mxHover.c) return
    mxHover.r = g.r
    mxHover.c = g.c
    emit('cellhover', { ...g, clientX, clientY })
  })
}
function onMxMouseOut(e) {
  if (!e.relatedTarget && mxHover.r !== -1) {
    mxHover.r = -1
    mxHover.c = -1
    emit('cellhover', null)
  }
}
function onLinkArmDown(e) {
  linkArmed = ''
  if (e.button !== 0 || !inCellArea(e) || linkPop.picking || e.shiftKey || e.ctrlKey || e.metaKey) return
  const g = geomFromPoint(ctxState() || {}, e.clientX, e.clientY)
  const cur = activeCell()
  if (!g || !cur || cur.row !== g.r || cur.col !== g.c) return
  const item = instRef.current?.getSheet?.()?.hyperlink?.[`${g.r}_${g.c}`]
  if (item?.linkAddress) linkArmed = `${g.r}_${g.c}`
}
function onLinkPickUp(e) {
  if (!linkPop.picking || !e.target?.closest?.('.fortune-cell-area')) return
  setTimeout(() => finishCellLinkPick(), 0)
}
function onMxClick(e) {
  if (!inCellArea(e)) return
  const g = geomFromPoint(ctxState() || {}, e.clientX, e.clientY)
  if (g && linkArmed && linkArmed === `${g.r}_${g.c}` && !linkPop.picking && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    const item = instRef.current?.getSheet?.()?.hyperlink?.[`${g.r}_${g.c}`]
    if (item?.linkAddress) followLink(item)
  }
  linkArmed = ''
  if (g) emit('cellclick', { ...g, clientX: e.clientX, clientY: e.clientY })
}
function onMxDblClick(e) {
  if (!inCellArea(e)) return
  const g = geomFromPoint(ctxState() || {}, e.clientX, e.clientY)
  if (g) emit('celldblclick', { ...g, clientX: e.clientX, clientY: e.clientY })
}
function onMxContext(e) {
  if (!props.suppressCellMenu || !inCellArea(e)) return
  const g = geomFromPoint(ctxState() || {}, e.clientX, e.clientY)
  if (!g) return
  e.preventDefault()
  e.stopPropagation()
  emit('cellcontext', { ...g, clientX: e.clientX, clientY: e.clientY })
}
document.addEventListener('mousemove', onMxMouseMove, true)
document.addEventListener('mouseout', onMxMouseOut, true)
document.addEventListener('mousedown', onLinkArmDown, true)
document.addEventListener('mouseup', onLinkPickUp, true)
document.addEventListener('click', onMxClick, true)
document.addEventListener('dblclick', onMxDblClick, true)
document.addEventListener('contextmenu', onMxContext, true)
function rangeText(a, b) {
  const r1 = Math.min(a.r, b.r)
  const r2 = Math.max(a.r, b.r)
  const c1 = Math.min(a.c, b.c)
  const c2 = Math.max(a.c, b.c)
  return c1 === c2 && r1 === r2
    ? colName(c1) + (r1 + 1)
    : colName(c1) + (r1 + 1) + ':' + colName(c2) + (r2 + 1)
}
function onDocFxRangeDown(e) {
  fxDrag.armed = false
  fxDrag.anchor = null
  if (!hostRef.value?.contains(e.target)) return
  if (!e.target.closest?.('.fortune-cell-area')) return
  const act = activeFormulaEditor()
  if (!act || !act.isFx || act.box.offsetParent === null) return
  if (!(act.ed.innerText || '').trim().startsWith('=')) return
  const ctx = reactStateBy((st) => Array.isArray(st.luckysheetfile))
  if (!ctx) return
  fxDrag.anchor = cellFromPoint(ctx, e.clientX, e.clientY)
  fxDrag.armed = true
  fxDrag.lastWritten = ''
}
function onDocFxRangeMove(e) {
  if (!fxDrag.armed || !fxDrag.anchor || fxDrag.frame) return
  const { clientX, clientY } = e
  fxDrag.frame = requestAnimationFrame(() => {
    fxDrag.frame = 0
    if (!fxDrag.armed || !fxDrag.anchor) return
    const ctx = reactStateBy((st) => Array.isArray(st.luckysheetfile))
    if (!ctx) return
    const cur = cellFromPoint(ctx, clientX, clientY)
    if (!cur) return
    const range = rangeText(fxDrag.anchor, cur)
    if (range === fxDrag.lastWritten) return
    const fx = document.getElementById('luckysheet-functionbox-cell')
    const sel = window.getSelection()
    if (!fx || !sel || !sel.rangeCount || !fx.contains(sel.anchorNode)) return
    let back = 0
    if (fxDrag.lastWritten) {
      back = fxDrag.lastWritten.length
    } else {
      // 首次扩展：fortune 刚插进来的是单个引用（如 B3），从光标前把它选回来
      const off = funcCaretOffset(fx)
      const m = /[A-Za-z]{1,3}\d+$/.exec((fx.innerText || '').slice(0, off))
      if (!m) return
      back = m[0].length
    }
    for (let k = 0; k < back; k++) sel.modify('extend', 'backward', 'character')
    document.execCommand('insertText', false, range)
    fxDrag.lastWritten = range
    updateFuncTip()
  })
}
function onDocFxRangeUp() {
  fxDrag.armed = false
  if (fxDrag.frame) { cancelAnimationFrame(fxDrag.frame); fxDrag.frame = 0 }
}
document.addEventListener('mousedown', onDocFxRangeDown, true)
document.addEventListener('mousemove', onDocFxRangeMove, true)
document.addEventListener('mouseup', onDocFxRangeUp, true)

watch(folded, () => {
  alignPop.show = false
  wrapPop.show = false
  vtPop.show = false
  stylePop.show = false
  nextTick(() => requestAnimationFrame(() => {
    placeFontBar(hostRef.value)
    placeAlignBar(hostRef.value)
    placeFmtBar(hostRef.value)
    placeDataBar(hostRef.value)
    syncFoldAlignIcon()
    syncFoldWrapIcon()
    syncFoldVtIcon()
  }))
})

watch(() => cfState.scaleOpen || cfState.kindOpen || cfState.scopeOpen, (open) => {
  if (open) document.addEventListener('mousedown', onDocScaleDown, true)
  else document.removeEventListener('mousedown', onDocScaleDown, true)
})

onBeforeUnmount(() => {
  hideCopyMark()
  document.removeEventListener('mousedown', onDocScaleDown, true)
  document.removeEventListener('input', onDocFormulaInput, true)
  document.removeEventListener('compositionend', onDocFormulaInput, true)
  document.removeEventListener('keydown', onDocFormulaKeydown, true)
  document.removeEventListener('mousedown', onDocEditResidueDown, true)
  document.removeEventListener('mousedown', onDocFxRangeDown, true)
  document.removeEventListener('mousemove', onDocFxRangeMove, true)
  document.removeEventListener('mouseup', onDocFxRangeUp, true)
  document.removeEventListener('mousedown', onLinkArmDown, true)
  document.removeEventListener('mouseup', onLinkPickUp, true)
  document.removeEventListener('selectionchange', onDocFuncSelChange, true)
  document.removeEventListener('scroll', onDocFuncScroll, true)
  labelObs?.disconnect()
  labelObs = null
  filterIconObs?.disconnect()
  filterIconObs = null
  sheetTabObs?.disconnect()
  sheetTabObs = null
  window.removeEventListener('resize', scheduleSheetTabs)
  if (sheetTabFrame) cancelAnimationFrame(sheetTabFrame)
  if (filterIconFrame) cancelAnimationFrame(filterIconFrame)
  hostRef.value?.removeEventListener('mousedown', onColorToolbarCapture, true)
  hostRef.value?.removeEventListener('click', onColorToolbarCapture, true)
  hostRef.value?.removeEventListener('click', onFreezeCapture, true)
  hostRef.value?.removeEventListener('click', onSheetTabFuncClick, true)
  hostRef.value?.removeEventListener('mousedown', onSheetListBtnClick, true)
  hostRef.value?.removeEventListener('contextmenu', onSheetContext, true)
  document.removeEventListener('mousemove', onMxMouseMove, true)
  document.removeEventListener('mouseout', onMxMouseOut, true)
  document.removeEventListener('click', onMxClick, true)
  document.removeEventListener('dblclick', onMxDblClick, true)
  document.removeEventListener('contextmenu', onMxContext, true)
  if (mxHover.frame) { cancelAnimationFrame(mxHover.frame); mxHover.frame = 0 }
  freezeClickBound = false
  if (root) {
    root.unmount()
    root = null
  }
})

const BEAUTY_COLORS = [
  { id: 'black', color: '#1f2329' },
  { id: 'blue', color: '#3370ff' },
  { id: 'red', color: '#f54a45' },
  { id: 'green', color: '#34c724' },
  { id: 'purple', color: '#7b61ff' },
  { id: 'cyan', color: '#14c0ff' },
  { id: 'orange', color: '#ff8800' },
]
const BEAUTY_LAYOUTS = [
  { id: 'medium', label: '适中', row: 24 },
  { id: 'compact', label: '紧凑', row: 20 },
  { id: 'loose', label: '宽松', row: 32 },
  { id: 'fit', label: '适屏', row: 24 },
]
const BEAUTY_FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'header', label: '表头' },
  { id: 'band', label: '条纹' },
  { id: 'fill', label: '填充' },
  { id: 'border', label: '边框' },
]
const BEAUTY_STYLES = [
  { id: 'h-line', group: 'header', header: 'solid', band: 0, first: '', body: '', border: 'horizontal' },
  { id: 'h-split', group: 'header', header: 'solid', band: 0, first: 'soft', body: '', border: 'horizontal' },
  { id: 'plain', group: 'header', header: 'none', band: 0, first: '', body: '', border: 'horizontal' },
  { id: 'h-white', group: 'header', header: 'solid', band: 0, first: '', body: '', border: 'none' },
  { id: 'h-tint', group: 'header', header: 'solid', band: 0, first: '', body: 'tint', border: 'none' },
  { id: 'col', group: 'header', header: 'none', band: 0, first: 'solid', body: '', border: 'horizontal' },
  { id: 'soft', group: 'band', header: 'soft', band: 0.9, first: '', body: '', border: 'none' },
  { id: 'stripe', group: 'band', header: 'none', band: 0.9, first: '', body: '', border: 'none' },
  { id: 'h-band', group: 'band', header: 'solid', band: 0.86, first: '', body: '', border: 'none' },
  { id: 'h-band-col', group: 'band', header: 'solid', band: 0.88, first: 'soft', body: '', border: 'horizontal' },
  { id: 'fill', group: 'fill', header: 'solid', band: 0, first: 'solid', body: 'mid', border: 'all', borderInk: 'white' },
  { id: 'fill-band', group: 'fill', header: 'solid', band: 0.22, first: '', body: 'mid', border: 'none' },
  { id: 'fill-soft', group: 'fill', header: 'solid', band: 0, first: '', body: 'tint', border: 'all' },
  { id: 'grid', group: 'border', header: 'solid', band: 0, first: '', body: '', border: 'all' },
  { id: 'bottom', group: 'border', header: 'none', band: 0, first: '', body: '', border: 'bottom' },
  { id: 'outside', group: 'border', header: 'soft', band: 0, first: '', body: '', border: 'outside' },
  { id: 'dotted', group: 'border', header: 'none', band: 0, first: '', body: '', border: 'dotted' },
]
const zoomReady = ref(false)
const pivotBarReady = ref(false)
const viewState = reactive({
  grid: true,
  cross: false,
  menu: false,
  left: 0,
  top: 0,
})
const sheetStat = reactive({ show: false, count: 0, sum: '0', avg: '0' })
const beauty = reactive({
  show: false,
  layout: 'medium',
  grid: true,
  color: '#3370ff',
  filter: 'all',
  filterOpen: false,
})
const beautyColorRef = ref(null)
const beautyStyles = computed(() => (
  beauty.filter === 'all' ? BEAUTY_STYLES : BEAUTY_STYLES.filter((item) => item.group === beauty.filter)
))

function beautyMix(hex, t) {
  const n = String(hex || '#3370ff').replace('#', '')
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  if ([r, g, b].some((v) => Number.isNaN(v))) return '#3370ff'
  const m = (c) => Math.round(c + (255 - c) * t).toString(16).padStart(2, '0')
  return `#${m(r)}${m(g)}${m(b)}`
}

function beautyInk(hex) {
  const n = String(hex || '#3370ff').replace('#', '')
  const y = (parseInt(n.slice(0, 2), 16) * 299 + parseInt(n.slice(2, 4), 16) * 587 + parseInt(n.slice(4, 6), 16) * 114) / 1000
  return y > 170 ? '#1f2329' : '#ffffff'
}

function beautyPaint(style, color, r, c) {
  const header = r === 0
  let bg = '#ffffff'
  if (!header && style.body === 'mid') bg = beautyMix(color, 0.42)
  if (!header && style.body === 'tint') bg = beautyMix(color, 0.86)
  if (!header && style.band && r % 2 === 1) bg = beautyMix(color, style.band)
  if (header && style.header === 'solid') bg = color
  else if (header && style.header === 'soft') bg = beautyMix(color, 0.82)
  if (!header && c === 0 && style.first === 'soft') bg = beautyMix(color, 0.9)
  if (!header && c === 0 && style.first === 'solid') bg = color
  let fc = beautyInk(bg)
  if (header && style.header === 'soft') fc = color
  if (!header && c === 0 && style.first === 'soft') fc = '#1f2329'
  return { bg, fc, bl: (header && style.header !== 'none') || (!header && c === 0 && style.first === 'solid') }
}

function beautyCells(style) {
  const cells = []
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      const paint = beautyPaint(style, beauty.color, r, c)
      const line = paint.fc === '#ffffff' ? 'rgba(255,255,255,.78)' : 'rgba(31,35,41,.32)'
      cells.push({
        backgroundColor: paint.bg,
        backgroundImage: `linear-gradient(${line}, ${line})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundSize: r === 0 ? '68% 2px' : '56% 2px',
      })
    }
  }
  return cells
}

function beautyBorderTone(style) {
  if (style.borderInk === 'white') return '#ffffff'
  if (style.border === 'horizontal') return '#dee0e3'
  return beauty.color
}

function beautyDots() {
  const list = BEAUTY_COLORS.map((item) => ({ ...item }))
  if (!list.some((item) => item.color.toLowerCase() === beauty.color.toLowerCase())) {
    list.push({ id: 'custom', color: beauty.color })
  }
  return list
}

function onBeautyDown(e) {
  if (!e.target.closest?.('.fs-beauty-filter')) beauty.filterOpen = false
}

function openBeauty() {
  pop.show = false
  if (!linkPop.picking) {
    linkPop.show = false
    linkPop.sheetsOpen = false
  }
  cfState.fly = ''
  if (beauty.show) {
    beauty.show = false
    beauty.filterOpen = false
    return
  }
  cfState.side = false
  cfState.dlg = ''
  const sheet = cfSheet()
  beauty.grid = sheet?.showGridLines !== false
  viewState.grid = beauty.grid
  const h = sheet?.config?.rowlen?.[0]
  if (h == null || (h >= 23 && h <= 26)) beauty.layout = 'medium'
  else if (h <= 22) beauty.layout = 'compact'
  else beauty.layout = 'loose'
  beauty.filterOpen = false
  beauty.show = true
}

function beautyRange(sheet) {
  const sel = getSelection()
  if (sel) return { r0: sel.startRow, r1: sel.endRow, c0: sel.startColumn, c1: sel.endColumn }
  let r0 = Infinity
  let r1 = -1
  let c0 = Infinity
  let c1 = -1
  ;(sheet?.data || []).forEach((row, r) => {
    ;(row || []).forEach((cell, c) => {
      if (!cellPlain(cell).trim()) return
      r0 = Math.min(r0, r)
      r1 = Math.max(r1, r)
      c0 = Math.min(c0, c)
      c1 = Math.max(c1, c)
    })
  })
  if (r1 < 0) return null
  return { r0, r1, c0, c1 }
}

function beautyCell(cell, paint) {
  const base = cell && typeof cell === 'object'
    ? { ...cell }
    : (cell != null && cell !== '' ? { v: cell, m: String(cell) } : {})
  base.bg = paint.bg
  base.fc = paint.fc
  base.bl = paint.bl ? 1 : 0
  delete base.bd
  return base
}

function beautyBorderHits(info, box) {
  const ranges = Array.isArray(info?.range) ? info.range : []
  return ranges.some((rg) => {
    const a0 = rg?.row?.[0]
    const a1 = rg?.row?.[1] ?? a0
    const b0 = rg?.column?.[0]
    const b1 = rg?.column?.[1] ?? b0
    if (a0 == null || b0 == null) return false
    return !(a1 < box.r0 || a0 > box.r1 || b1 < box.c0 || b0 > box.c1)
  })
}

function beautyBorderItem(type, color, style, box, row, column) {
  return {
    rangeType: 'range',
    borderType: type,
    color,
    style,
    range: [{ row: row || [box.r0, box.r1], column: column || [box.c0, box.c1] }],
  }
}

function beautyBorders(style, color, box) {
  const items = []
  if (style.border === 'none') items.push(beautyBorderItem('border-none', '#dee0e3', '1', box))
  else if (style.border === 'horizontal') items.push(beautyBorderItem('border-horizontal', '#dee0e3', '1', box))
  else if (style.border === 'all') items.push(beautyBorderItem('border-all', style.borderInk === 'white' ? '#ffffff' : color, '1', box))
  else if (style.border === 'outside') items.push(beautyBorderItem('border-outside', color, '1', box))
  else if (style.border === 'bottom') {
    items.push(beautyBorderItem('border-none', '#dee0e3', '1', box))
    items.push(beautyBorderItem('border-bottom', color, '8', box, [box.r0, box.r0], [box.c0, box.c1]))
  } else if (style.border === 'dotted') items.push(beautyBorderItem('border-all', color, '3', box))
  if (style.header === 'solid' && style.border !== 'all' && style.border !== 'dotted' && style.border !== 'bottom') {
    items.push(beautyBorderItem('border-bottom', color, '1', box, [box.r0, box.r0], [box.c0, box.c1]))
  }
  return items
}

function applyBeautyConfig(live, config) {
  applyOpUndoable([
    { op: 'replace', id: live.id, path: ['config'], value: config },
    { op: 'replace', path: ['config'], value: config },
  ])
  scheduleDataBars()
}

function clearCrosshair() {
  hostRef.value?.querySelectorAll('.fs-cross-layer, .fs-cross-rowhead, .fs-cross-colhead').forEach((el) => el.remove())
}

function drawCrosshair() {
  const root = hostRef.value
  if (!root) return
  if (!viewState.cross) {
    clearCrosshair()
    return
  }
  const area = root.querySelector('.fortune-cell-area')
  const focus = area?.querySelector('.luckysheet-cell-selected-focus')
    || area?.querySelector('.luckysheet-cell-selected')
  if (!area || !focus || focus.offsetWidth <= 0 || focus.offsetHeight <= 0) {
    clearCrosshair()
    return
  }
  const top = focus.offsetTop
  const left = focus.offsetLeft
  const width = focus.offsetWidth
  const height = focus.offsetHeight
  let layer = area.querySelector(':scope > .fs-cross-layer')
  if (!layer) {
    layer = document.createElement('div')
    layer.className = 'fs-cross-layer'
    area.appendChild(layer)
  }
  layer.innerHTML = ''
  const col = document.createElement('i')
  col.className = 'fs-cross-col'
  col.style.left = `${left}px`
  col.style.width = `${width}px`
  const row = document.createElement('i')
  row.className = 'fs-cross-row'
  row.style.top = `${top}px`
  row.style.height = `${height}px`
  layer.appendChild(col)
  layer.appendChild(row)
  const rowMark = root.querySelector('.fortune-row-header-selected')
  const colMark = root.querySelector('.fortune-col-header-selected')
  const rowHead = root.querySelector('.fortune-row-header')
  const colHead = root.querySelector('.fortune-col-header')
  if (rowHead && rowMark) {
    let band = rowHead.querySelector(':scope > .fs-cross-rowhead')
    if (!band) {
      band = document.createElement('i')
      band.className = 'fs-cross-rowhead'
      rowHead.appendChild(band)
    }
    band.style.top = `${rowMark.offsetTop}px`
    band.style.height = `${rowMark.offsetHeight}px`
  }
  if (colHead && colMark) {
    let band = colHead.querySelector(':scope > .fs-cross-colhead')
    if (!band) {
      band = document.createElement('i')
      band.className = 'fs-cross-colhead'
      colHead.appendChild(band)
    }
    band.style.left = `${colMark.offsetLeft}px`
    band.style.width = `${colMark.offsetWidth}px`
  }
}

function toggleViewMenu(e) {
  if (viewState.menu) {
    viewState.menu = false
    return
  }
  const anchor = e.currentTarget?.closest?.('.fs-view-tools') || e.currentTarget
  const rect = anchor?.getBoundingClientRect?.()
  if (!rect) return
  viewState.left = rect.left
  viewState.top = rect.top - 6
  viewState.menu = true
}

function toggleViewGrid() {
  beauty.grid = !viewState.grid
  viewState.grid = beauty.grid
  applyBeautyGrid()
}

function toggleCrosshair() {
  viewState.cross = !viewState.cross
  drawCrosshair()
}

function applyBeautyGrid() {
  viewState.grid = beauty.grid
  const sheet = cfSheet()
  if (!sheet?.id) return
  const has = Object.prototype.hasOwnProperty.call(sheet, 'showGridLines')
  const value = beauty.grid
  applyOpUndoable([
    {
      op: has ? 'replace' : 'add',
      id: sheet.id,
      path: ['showGridLines'],
      value,
    },
    { op: 'replace', path: ['showGridLines'], value },
  ])
  scheduleDataBars()
}

function textUnits(text) {
  let n = 0
  for (const ch of String(text || '')) n += ch.charCodeAt(0) > 255 ? 2 : 1
  return n
}

function applyBeautyLayout(id) {
  const live = cfSheet()
  if (!live?.id) return
  const box = beautyRange(live)
  if (!box) {
    Message.warning('当前工作表没有可排版的内容')
    return
  }
  const spec = BEAUTY_LAYOUTS.find((item) => item.id === id) || BEAUTY_LAYOUTS[0]
  beauty.layout = id
  const config = {
    ...(live.config || {}),
    rowlen: { ...(live.config?.rowlen || {}) },
  }
  for (let r = box.r0; r <= box.r1; r += 1) config.rowlen[r] = spec.row
  if (id === 'fit') {
    const cols = box.c1 - box.c0 + 1
    const widths = []
    for (let c = box.c0; c <= box.c1; c += 1) {
      let units = 4
      for (let r = box.r0; r <= box.r1; r += 1) units = Math.max(units, textUnits(cellPlain(live.data?.[r]?.[c])))
      widths.push(Math.min(240, Math.max(72, units * 7 + 20)))
    }
    const avail = Math.max(240, (hostRef.value?.clientWidth || 800) - 56)
    const sum = widths.reduce((a, b) => a + b, 0)
    const next = sum < avail
      ? widths.map((w) => w + (avail - sum) / cols)
      : widths.map((w) => Math.max(56, (w * avail) / sum))
    config.columnlen = { ...(live.config?.columnlen || {}) }
    next.forEach((w, i) => { config.columnlen[box.c0 + i] = Math.round(w) })
  }
  applyBeautyConfig(live, config)
}

function applyBeautyStyle(style) {
  const live = cfSheet()
  if (!live?.id) return
  const box = beautyRange(live)
  if (!box) {
    Message.warning('当前工作表没有可美化的内容')
    return
  }
  const count = (box.r1 - box.r0 + 1) * (box.c1 - box.c0 + 1)
  if (count > 5000) {
    Message.warning('范围太大，请先选中要美化的区域')
    return
  }
  const ops = []
  for (let r = box.r0; r <= box.r1; r += 1) {
    const src = live.data?.[r]
    if (!Array.isArray(src)) continue
    const paintAt = (c) => beautyCell(src[c], beautyPaint(style, beauty.color, r - box.r0, c - box.c0))
    if (src.length <= box.c1) {
      const row = src.slice()
      while (row.length <= box.c1) row.push(null)
      for (let c = box.c0; c <= box.c1; c += 1) row[c] = beautyCell(row[c], beautyPaint(style, beauty.color, r - box.r0, c - box.c0))
      ops.push({ op: 'replace', id: live.id, path: ['data', r], value: row })
    } else {
      for (let c = box.c0; c <= box.c1; c += 1) {
        ops.push({ op: 'replace', id: live.id, path: ['data', r, c], value: paintAt(c) })
      }
    }
  }
  if (!ops.length) {
    Message.warning('当前工作表没有可美化的内容')
    return
  }
  const config = {
    ...(live.config || {}),
    borderInfo: [...(live.config?.borderInfo || [])].filter((info) => !beautyBorderHits(info, box)),
  }
  beautyBorders(style, beauty.color, box).forEach((info) => config.borderInfo.push(info))
  ops.push({ op: 'replace', id: live.id, path: ['config'], value: config })
  ops.push({ op: 'replace', path: ['config'], value: config })
  applyOpUndoable(ops)
  scheduleDataBars()
}

function formatStat(n) {
  if (!Number.isFinite(n) || n === 0) return '0'
  const nearest = Math.round(n)
  if (Math.abs(n - nearest) <= Math.abs(n) * 1e-10) return String(nearest)
  const s = n.toPrecision(15)
  if (/e/i.test(s)) return s
  return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

function isDateCell(cell) {
  if (cell?.ct?.t === 'd') return true
  const fa = String(cell?.ct?.fa || '')
  if (!fa || fa === 'General') return false
  return /[yYdhHsS]/.test(fa)
}

function cellHasValue(cell) {
  if (!cell) return false
  const v = cell.v
  const m = cell.m
  return !((v == null || v === '') && (m == null || m === ''))
}

function numericValue(cell) {
  if (!cellHasValue(cell) || isDateCell(cell)) return null
  const v = cell.v
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (cell.ct?.t === 'n') {
    const n = parseFloat(String(v ?? cell.m ?? '').replace(/,/g, ''))
    if (Number.isFinite(n)) return n
  }
  const text = String(cell.m ?? v ?? '').trim().replace(/,/g, '')
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text)
  return null
}

function selectionBoxes(sel) {
  const list = Array.isArray(sel) ? sel : (sel ? [sel] : (instRef.current?.getSelection?.() || []))
  const boxes = []
  for (const cur of list) {
    const r0 = cur?.row?.[0]
    const c0 = cur?.column?.[0]
    if (r0 == null || c0 == null) continue
    const r1 = cur.row?.[1] ?? r0
    const c1 = cur.column?.[1] ?? c0
    boxes.push({
      r0: Math.min(r0, r1),
      r1: Math.max(r0, r1),
      c0: Math.min(c0, c1),
      c1: Math.max(c0, c1),
    })
  }
  return boxes
}

function refreshSheetStat(sel) {
  const sheet = instRef.current?.getSheet?.()
  const boxes = selectionBoxes(sel)
  if (!sheet || !boxes.length) {
    sheetStat.show = false
    return
  }
  const hiddenR = sheet.rowhidden || {}
  const hiddenC = sheet.colhidden || {}
  const seen = new Set()
  let count = 0
  let text = 0
  let sum = 0
  for (const box of boxes) {
    for (let r = box.r0; r <= box.r1; r += 1) {
      if (hiddenR[r] != null) continue
      const row = sheet.data?.[r]
      for (let c = box.c0; c <= box.c1; c += 1) {
        if (hiddenC[c] != null) continue
        const key = `${r}:${c}`
        if (seen.has(key)) continue
        seen.add(key)
        const cell = row?.[c]
        const n = numericValue(cell)
        if (n != null) {
          count += 1
          sum += n
        } else if (cellHasValue(cell)) {
          count += 1
          text += 1
        }
      }
    }
  }
  if (!count) {
    sheetStat.show = false
    return
  }
  const numeric = text === 0
  sheetStat.show = true
  sheetStat.count = count
  sheetStat.sum = numeric ? formatStat(sum) : '0'
  sheetStat.avg = numeric ? formatStat(sum / count) : '0'
}

defineExpose({
  load,
  snapshot,
  captureThumb,
  getActiveSheetName,
  cellDisplay,
  getSelection,
  activeCell,
  addSheet,
  setActiveSheet,
  writeBlock,
  fitColumns,
  cellGeomByRC: (row, col) => geomByRC(ctxState() || {}, row, col),
  cellAt,
  insertAxis,
})
</script>

<template>
  <div class="fortune-wrap" :class="{ 'fs-open': !folded, 'cf-side': cfState.side && cfState.dlg, 'beauty-side': beauty.show, 'cf-picking': cfState.pickingRange, 'fs-sheet-list-open': sheetListPop.open, 'fs-copy-same': copyMark.same }" @mousedown="onWrapDown" @mouseover="onTipOver" @mouseleave="onTipLeave">
    <input ref="fileRef" type="file" accept=".xlsx,.xls" hidden @change="onImport">
    <div ref="hostRef" class="fortune-host"></div>
    <button
      v-show="sheetMore.show"
      type="button"
      class="fs-sheet-more"
      title="更多工作表"
      :style="{ left: `${sheetMore.left}px`, top: `${sheetMore.top}px` }"
      @mousedown.stop
      @click.stop="toggleSheetMore"
    >...</button>
    <div v-show="sheetStat.show" class="fs-sheet-stat" @mousedown.stop>
      <span>计数值: {{ sheetStat.count }}</span>
      <span>求和: {{ sheetStat.sum }}</span>
      <span>平均值: {{ sheetStat.avg }}</span>
    </div>
    <Teleport v-if="pivotBarReady" to="#pv-design-host">
      <slot name="pivot-design" />
    </Teleport>
    <Teleport v-if="zoomReady" to=".fortune-zoom-container">
      <div class="fs-view-tools" :class="{ on: viewState.cross }" @mousedown.stop>
        <button type="button" class="fs-view-main" title="高亮所在行列" @click="toggleCrosshair">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="1.6" y="1.6" width="12.8" height="12.8" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M1.6 6.2h12.8M1.6 10.5h12.8M6.2 1.6v12.8M10.5 1.6v12.8" stroke="currentColor" stroke-width="1"/></svg>
        </button>
        <button type="button" class="fs-view-caret" title="视图" @click="toggleViewMenu">
          <i />
        </button>
        <div v-if="viewState.menu" class="fs-view-menu" :style="{ left: `${viewState.left}px`, top: `${viewState.top}px` }">
          <button type="button" @click="toggleViewGrid">
            <svg v-if="viewState.grid" viewBox="0 0 16 16" width="16" height="16"><path d="M3.2 8.1 6.4 11.2 12.8 4.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <i v-else />
            网格线
          </button>
          <button type="button" @click="toggleCrosshair">
            <svg v-if="viewState.cross" viewBox="0 0 16 16" width="16" height="16"><path d="M3.2 8.1 6.4 11.2 12.8 4.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <i v-else />
            高亮所在行列
          </button>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div
        v-show="funcTip.visible"
        class="fs-func-tip"
        :class="{ above: funcTip.above }"
        :style="{ left: `${funcTip.x}px`, top: `${funcTip.y}px` }"
        @mousedown.prevent
      >
        <div class="fs-func-head">
          <div class="fs-func-sig">
            <span class="fs-func-name">{{ funcTip.name }}</span><span>(</span><template v-for="(p, i) in funcTip.parts" :key="i"><span v-if="i" class="fs-func-comma">, </span><span :class="{ hl: i === funcTip.argIndex }">{{ p }}</span></template><span>)</span>
          </div>
          <button
            v-if="funcTip.docs && (funcTip.docs.s || funcTip.docs.ex)"
            type="button"
            class="fs-func-toggle"
            :class="{ open: funcTip.expanded }"
            data-tip="示例与说明"
            @click="funcTip.expanded = !funcTip.expanded"
          ><i class="fs-caret" /></button>
          <button type="button" class="fs-func-toggle" data-tip="关闭" @click="dismissFuncTip"><span class="fs-func-close">×</span></button>
        </div>
        <div v-if="funcTip.expanded && funcTip.docs" class="fs-func-body">
          <div v-if="funcTip.docs.ex" class="fs-func-row">
            <div class="fs-func-label">示例</div>
            <div class="fs-func-text">{{ funcTip.docs.ex }}</div>
          </div>
          <div v-if="funcTip.docs.s" class="fs-func-row">
            <div class="fs-func-label">摘要</div>
            <div class="fs-func-text">{{ funcTip.docs.s }}</div>
          </div>
          <div v-for="(pd, i) in funcTip.docs.d" :key="'d' + i" class="fs-func-row" :class="{ cur: i === funcTip.argIndex }">
            <div class="fs-func-label">{{ funcTip.parts[i] }}</div>
            <div class="fs-func-text">{{ pd }}</div>
          </div>
        </div>
      </div>
      <div
        v-show="funcSug.visible"
        class="fs-func-sug"
        :class="{ above: funcSug.above }"
        :style="{ left: `${funcSug.x}px`, top: `${funcSug.y}px` }"
        @mousedown.prevent
      >
        <div
          v-for="(s, i) in funcSug.items"
          :key="s.name"
          class="fs-func-sug-item"
          :class="{ cur: i === funcSug.index }"
          @mouseenter="funcSug.index = i"
          @click="acceptFuncSug(i)"
        >
          <div class="fs-func-sug-name">{{ s.name }}</div>
          <div v-if="i === funcSug.index && s.desc" class="fs-func-sug-desc">{{ s.desc }}</div>
        </div>
      </div>
    </Teleport>
    <Teleport v-if="toolbarEl" :to="toolbarEl">
    <div
      v-if="fontBar.show"
      class="fs-style-cluster"
      :style="{ left: `${fontBar.left}px`, top: `${fontBar.top}px` }"
      @mousedown.stop
    >
      <div class="fs-style-top">
        <button
          type="button"
          class="fs-arco-font"
          data-tip="字体"
          :class="{ open: fontMenu.open }"
          @click.stop="toggleFontMenu"
        >
          <span class="fs-font-value" :style="{ fontFamily: fontFamilyPreview }">{{ fontLabel }}</span>
          <i class="fs-caret" />
        </button>
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
    <Teleport to="body">
      <div
        v-if="fontMenu.open"
        class="fs-font-menu"
        :style="{ left: `${fontMenu.left}px`, top: `${fontMenu.top}px` }"
        @mousedown.stop
      >
        <div class="fs-font-search">
          <icon-search class="fs-font-search-ico" />
          <input
            v-model="fontMenu.query"
            type="text"
            placeholder="所有字体"
            @keydown.esc.stop="fontMenu.open = false"
          >
        </div>
        <div class="fs-font-list" role="menu">
          <button
            v-for="item in filteredFonts"
            :key="item.key"
            type="button"
            class="fs-font-item"
            :class="{ on: isFontSelected(item) }"
            :style="{ fontFamily: item.family }"
            role="menuitem"
            @click="applyFontName(item.id, item.key)"
          >
            <span>{{ item.label }}</span>
            <icon-check v-if="isFontSelected(item)" class="fs-font-check" />
          </button>
          <div v-if="!filteredFonts.length" class="fs-font-empty">无匹配字体</div>
        </div>
      </div>
    </Teleport>
    <div
      v-if="stylePop.show && folded"
      class="fs-ht-menu"
      :style="{ left: `${stylePop.left}px`, top: `${stylePop.top}px` }"
      @mousedown.stop
    >
      <button
        v-for="item in STYLE_OPTS"
        :key="item.attr"
        type="button"
        class="fs-ht-item"
        :class="{ on: !!fontBar[item.attr] }"
        @click="toggleStyle(item.attr)"
      >
        <i class="fs-style-ico" :class="item.cls">{{ item.letter }}</i>
        <span>{{ item.label }}</span>
      </button>
    </div>
    <div
      v-if="alignPop.show && folded"
      class="fs-ht-menu"
      :style="{ left: `${alignPop.left}px`, top: `${alignPop.top}px` }"
      @mousedown.stop
    >
      <button
        v-for="item in HT_OPTS"
        :key="item.id"
        type="button"
        class="fs-ht-item"
        :class="{ on: Number(alignBar.ht) === item.id }"
        @click="applyAlign('ht', item.id)"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path :d="item.path" fill="currentColor" /></svg>
        <span>{{ item.label }}</span>
        <svg v-if="Number(alignBar.ht) === item.id" class="fs-ht-check" viewBox="0 0 24 24" width="16" height="16"><path d="M9.4 16.6 4.8 12l-1.4 1.4 6 6 12-12-1.4-1.4z" fill="currentColor" /></svg>
      </button>
    </div>
    <div
      v-if="wrapPop.show && folded"
      class="fs-ht-menu"
      :style="{ left: `${wrapPop.left}px`, top: `${wrapPop.top}px` }"
      @mousedown.stop
    >
      <button
        v-for="item in TB_OPTS"
        :key="item.id"
        type="button"
        class="fs-ht-item"
        :class="{ on: Number(alignBar.tb) === item.id }"
        @click="applyAlign('tb', item.id)"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path :d="item.path" fill="currentColor" /></svg>
        <span>{{ item.label }}</span>
        <svg v-if="Number(alignBar.tb) === item.id" class="fs-ht-check" viewBox="0 0 24 24" width="16" height="16"><path d="M9.4 16.6 4.8 12l-1.4 1.4 6 6 12-12-1.4-1.4z" fill="currentColor" /></svg>
      </button>
    </div>
    <div
      v-if="vtPop.show && folded"
      class="fs-ht-menu"
      :style="{ left: `${vtPop.left}px`, top: `${vtPop.top}px` }"
      @mousedown.stop
    >
      <button
        v-for="item in VT_OPTS"
        :key="item.id"
        type="button"
        class="fs-ht-item"
        :class="{ on: Number(alignBar.vt) === item.id }"
        @click="applyAlign('vt', item.id)"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path :d="item.path" fill="currentColor" /></svg>
        <span>{{ item.label }}</span>
        <svg v-if="Number(alignBar.vt) === item.id" class="fs-ht-check" viewBox="0 0 24 24" width="16" height="16"><path d="M9.4 16.6 4.8 12l-1.4 1.4 6 6 12-12-1.4-1.4z" fill="currentColor" /></svg>
      </button>
    </div>
    <div
      v-if="!folded"
      class="fs-align-cluster"
      :style="{ left: `${alignBar.left}px`, top: `${alignBar.top}px` }"
      @mousedown.stop
    >
      <div class="fs-align-grid">
        <button type="button" class="fs-align-btn" :class="{ on: Number(alignBar.tb) === 1 }" data-tip="溢出" @click="applyAlign('tb', 1)">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2 3.2h7v1.4H2V3.2Zm0 4.1h6v1.4H2V7.3Zm0 4.1h12v1.4H2v-1.4ZM9.2 2.5h1.2v6.2H9.2V2.5Zm1.6 1.5 3.6 1.6-3.6 1.6V4Z" fill="currentColor"/></svg>
        </button>
        <button type="button" class="fs-align-btn" :class="{ on: Number(alignBar.tb) === 2 }" data-tip="自动换行" @click="applyAlign('tb', 2)">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2 3.2h7.5v1.4H2V3.2Zm0 4.1h5v1.4H2V7.3ZM8.8 2.5h1.3v7.2c0 1.2.9 2.1 2.1 2.1H14v1.3h-1.8a3.4 3.4 0 0 1-3.4-3.4V2.5Zm3.6 7.6 2.2 2.2-2.2 2.2V10.1Z" fill="currentColor"/></svg>
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
      <button type="button" class="fs-data-item" :class="{ on: dataBar.filter }" data-tip="筛选（Ctrl+Shift+L）" @click="enableFilter">
        <svg viewBox="0 0 17 16" width="16" height="16" aria-hidden="true"><path fill-rule="evenodd" d="M3.322 2.61a.48.48 0 0 0-.306.658l3.842 4.557a.7.7 0 0 1 .141.387v4.522c0 .164.1.312.253.372l1.486.587a.48.48 0 0 0 .547-.372V8.211a.7.7 0 0 1 .141-.386l3.842-4.558a.48.48 0 0 0-.306-.657H3.322Zm-1.223 1.43C1.221 3 1.961 1.41 3.322 1.41h9.641c1.361 0 2.1 1.591 1.223 2.632L10.485 8.43v4.89c0 1.129-1.138 1.903-2.188 1.488l-1.486-.587a1.6 1.6 0 0 1-1.012-1.488V8.43L2.099 4.04Z" fill="currentColor"/></svg>
        <span>筛选</span>
        <i class="fs-data-filter-caret" title="筛选菜单" @click.stop="toggleFilterMenu($event.currentTarget)" />
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
    </Teleport>
    <button
      type="button"
      class="fs-fold"
      @mousedown.stop
      @click="toggleFold"
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
      @keydown.stop
    >
      <div class="fs-filter-sort">
        <button type="button" @click="sortFromFilter(true)">升序</button>
        <button type="button" @click="sortFromFilter(false)">降序</button>
      </div>
      <div class="fs-filter-tabs">
        <button type="button" :class="{ on: filterPop.tab === 'value' }" @click="openFilterTab('value')">按值</button>
        <button type="button" :class="{ on: filterPop.tab === 'color' }" @click="openFilterTab('color')">按颜色</button>
        <button type="button" :class="{ on: filterPop.tab === 'cond' }" @click="openFilterTab('cond')">按条件</button>
      </div>
      <template v-if="filterPop.tab === 'value'">
        <label class="fs-filter-search">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M7 1.6a5.4 5.4 0 0 1 4.28 8.66l2.7 2.7-1 1-2.7-2.7A5.4 5.4 0 1 1 7 1.6Zm0 1.4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" fill="currentColor"/></svg>
          <input v-model="filterPop.query" placeholder="可使用空格分隔多个关键词">
        </label>
        <label v-if="filterPop.query.trim()" class="fs-filter-add">
          <input v-model="filterPop.addTo" type="checkbox">
          <span>添加到已有筛选条件</span>
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
      <div v-else-if="filterPop.tab === 'color'" class="fs-filter-colors">
        <div class="fs-filter-color-title">单元格颜色</div>
        <label v-for="item in filterPop.bgColors" :key="`bg-${item.color}`" class="fs-filter-item" @click.prevent="toggleFilterColor('bg', item)">
          <input type="checkbox" :checked="item.checked" tabindex="-1">
          <i :style="{ background: item.color }" />
          <span>{{ item.color === '#ffffff' ? '无填充' : item.color }}</span>
          <em>{{ item.count }}</em>
        </label>
        <div v-if="!filterPop.bgColors.length" class="fs-filter-empty">这一列没有可筛选的填充色</div>
        <div class="fs-filter-color-title">字体颜色</div>
        <label v-for="item in filterPop.fcColors" :key="`fc-${item.color}`" class="fs-filter-item" @click.prevent="toggleFilterColor('fc', item)">
          <input type="checkbox" :checked="item.checked" tabindex="-1">
          <i :style="{ background: item.color }" />
          <span>{{ item.color }}</span>
          <em>{{ item.count }}</em>
        </label>
        <div v-if="!filterPop.fcColors.length" class="fs-filter-empty">这一列没有可筛选的字体颜色</div>
      </div>
      <div v-else class="fs-filter-cond">
        <select v-model="filterPop.kind" @change="onFilterKind" @keydown="onFilterSelectKey">
          <option value="text">文本</option>
          <option value="num">数字</option>
          <option value="date">日期</option>
        </select>
        <select v-model="filterPop.cond" @change="focusFilterCondInput" @keydown="onFilterSelectKey">
          <option v-for="[id, label] in filterCondOps" :key="id" :value="id">{{ label }}</option>
        </select>
        <input v-if="filterPop.cond !== 'empty' && filterPop.cond !== 'notEmpty'" v-model="filterPop.condValue" :type="filterPop.kind === 'date' ? 'date' : 'text'" :inputmode="filterPop.kind === 'num' ? 'decimal' : 'text'" autocomplete="off" :placeholder="filterPop.cond === 'between' ? '开始' : '输入条件'" @keydown.stop>
        <input v-if="filterPop.cond === 'between'" v-model="filterPop.condValue2" :type="filterPop.kind === 'date' ? 'date' : 'text'" :inputmode="filterPop.kind === 'num' ? 'decimal' : 'text'" autocomplete="off" placeholder="结束" @keydown.stop>
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
      v-if="filterMenu.show"
      class="fs-filter-menu"
      :style="{ left: `${filterMenu.left}px`, top: `${filterMenu.top}px` }"
      @mousedown.stop
    >
      <button type="button" :disabled="!dataBar.filter" @click="cancelFilter">取消筛选</button>
    </div>
    <div v-if="linkPop.picking" class="fs-link-pick">框选要链接的单元格或单元格范围</div>
    <div
      v-if="linkBar.show"
      class="fs-link-bar"
      :style="{ left: `${linkBar.left}px`, top: `${linkBar.top}px` }"
      @mousedown.stop
      @mouseenter="keepLinkBar"
      @mouseleave="scheduleHideLinkBar"
    >
      <button type="button" class="fs-link-bar-addr" :title="linkBar.address" @click="followLink({ linkType: linkBar.type, linkAddress: linkBar.address })">{{ linkBar.address }}</button>
      <button type="button" @click="editLinkFromBar">编辑链接</button>
      <button type="button" @click="removeLinkAt(linkBar.r, linkBar.c, linkBar.sheetId)">删除链接</button>
    </div>
    <div
      v-if="linkPop.show"
      class="fs-link"
      :style="{ left: `${linkPop.left}px`, top: `${linkPop.top}px` }"
      @mousedown.stop
    >
      <label class="fs-link-row">
        <span>文本</span>
        <input v-model="linkPop.text" class="fs-link-input" placeholder="输入文本" spellcheck="false">
      </label>
      <div class="fs-link-row">
        <span>链接</span>
        <input
          v-model="linkPop.address"
          class="fs-link-input focus"
          placeholder="插入链接"
          spellcheck="false"
          @keydown.enter.prevent="confirmLink"
        >
        <button type="button" class="fs-link-ok" :disabled="!linkPop.address.trim()" @click="confirmLink">确定</button>
      </div>
      <div class="fs-link-menu">
        <button type="button" class="fs-link-item" @click="startSheetLink">
          <i class="fs-link-caret" :class="{ open: linkPop.sheetsOpen }" />
          链接到工作表
        </button>
        <div v-if="linkPop.sheetsOpen" class="fs-link-sheets">
          <button
            v-for="name in linkSheetNames()"
            :key="name"
            type="button"
            class="fs-link-item sub"
            @click="pickSheetLink(name)"
          >{{ name }}</button>
          <div v-if="!linkSheetNames().length" class="fs-link-empty">没有工作表</div>
        </div>
        <button type="button" class="fs-link-item" @click="startCellLink">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2 6.2h12M2 10.2h12M6.2 2v12M10.2 2v12" stroke="currentColor" stroke-width="1"/></svg>
          链接到单元格
        </button>
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
      </template>
      <template v-else-if="pop.kind === 'insert'">
        <button type="button" @click="clickFortune('插入图片')">插入图片</button>
        <button type="button" @click="emit('chart'); pop.show = false">图表</button>
        <button type="button" @click="emit('pivot'); pop.show = false">插入透视表</button>
        <button type="button" @click="openLinkPop()">插入链接</button>
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
        <button type="button" class="fs-num more" @click="openFmtDlg">更多格式</button>
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
      :class="{ scale: cfState.fly === 'color', bars: cfState.fly === 'bar', icons: cfState.fly === 'icons' }"
      :style="{ top: `${cfState.flyY}px`, left: `${cfState.flyX}px` }"
      @mousedown.stop
      @mouseenter="showCfFly(cfState.fly)"
      @mouseleave="hideCfFly()"
    >
      <template v-if="cfState.fly === 'color'">
        <div class="fs-cf-scale-sec">双色色阶</div>
        <div class="fs-cf-scales">
          <button
            v-for="sub in CF_FLIES.color.filter((x) => x.group === 'two')"
            :key="sub.id"
            type="button"
            :title="sub.label"
            @click="applyPreset(sub)"
          >
            <span class="fs-cf-scale-preview" :style="{ background: scalePreviewCss(sub.format) }">
              <i /><i /><i /><i /><i />
            </span>
          </button>
        </div>
        <div class="fs-cf-scale-sec">三色色阶</div>
        <div class="fs-cf-scales">
          <button
            v-for="sub in CF_FLIES.color.filter((x) => x.group === 'three')"
            :key="sub.id"
            type="button"
            :title="sub.label"
            @click="applyPreset(sub)"
          >
            <span class="fs-cf-scale-preview" :style="{ background: scalePreviewCss(sub.format) }">
              <i /><i /><i /><i /><i />
            </span>
          </button>
        </div>
        <button type="button" class="fs-cf-bar-more" @click="openCfDialog('color', true)">其他规则(M)...</button>
      </template>
      <template v-else-if="cfState.fly === 'bar'">
        <div class="fs-cf-bar-sec">渐变填充</div>
        <div class="fs-cf-bar-grid">
          <button
            v-for="sub in CF_FLIES.bar.filter((x) => x.group === 'gradient')"
            :key="sub.id"
            type="button"
            :title="sub.label"
            @click="applyPreset(sub)"
          >
            <span class="fs-cf-bar-preview gradient" :style="{ '--bar': sub.format[0] }">
              <i /><i /><i /><i /><i />
            </span>
          </button>
        </div>
        <div class="fs-cf-bar-sec">实心填充</div>
        <div class="fs-cf-bar-grid">
          <button
            v-for="sub in CF_FLIES.bar.filter((x) => x.group === 'solid')"
            :key="sub.id"
            type="button"
            :title="sub.label"
            @click="applyPreset(sub)"
          >
            <span class="fs-cf-bar-preview" :style="{ '--bar': sub.format[0] }">
              <i /><i /><i /><i /><i />
            </span>
          </button>
        </div>
        <button type="button" class="fs-cf-bar-more" @click="openCfDialog('bar', true)">其他规则(M)...</button>
      </template>
      <template v-else-if="cfState.fly === 'icons'">
        <template v-for="(group, gi) in CF_ICON_GROUPS" :key="group">
          <div class="fs-cf-icon-sec">{{ group }}</div>
          <div class="fs-cf-icon-wrap">
            <button
              v-for="sub in CF_FLIES.icons.filter((x) => x.group === group)"
              :key="sub.id"
              type="button"
              class="fs-cf-icon-item"
              :class="{ alone: sub.alone }"
              :title="sub.label"
              @click="applyPreset(sub)"
            >
              <span class="fs-cf-icon-preview" v-html="iconPreviewHtml(sub)" />
            </button>
          </div>
          <div v-if="gi < CF_ICON_GROUPS.length - 1" class="fs-cf-icon-sep" />
        </template>
        <div class="fs-cf-icon-sep last" />
        <button type="button" class="fs-cf-icon-more" @click="openCfDialog('icons', true)">自定义规则</button>
      </template>
      <button
        v-for="sub in (cfState.fly === 'color' || cfState.fly === 'bar' || cfState.fly === 'icons' ? [] : CF_FLIES[cfState.fly])"
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
    <aside v-if="beauty.show" class="fs-beauty" @mousedown.stop="onBeautyDown">
      <header class="fs-beauty-head">
        <span>美化助手</span>
        <button type="button" aria-label="关闭" @click="beauty.show = false">×</button>
      </header>
      <div class="fs-beauty-body">
        <div class="fs-beauty-sec-head">
          <span>表格排版方式</span>
          <label class="fs-beauty-check">
            <input v-model="beauty.grid" type="checkbox" @change="applyBeautyGrid">
            <span>网格线</span>
          </label>
        </div>
        <div class="fs-beauty-layouts">
          <button
            v-for="item in BEAUTY_LAYOUTS"
            :key="item.id"
            type="button"
            class="fs-beauty-layout"
            :class="{ on: beauty.layout === item.id }"
            @click="applyBeautyLayout(item.id)"
          >
            <i class="ico">
              <svg v-if="item.id === 'medium'" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M4 5h16v1.6H4zm0 4.1h16v1.6H4zm0 4.1h16v1.6H4zm0 4.2h16V19H4z"/></svg>
              <svg v-else-if="item.id === 'compact'" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M4 4h16v1.3H4zm0 3h16v1.3H4zm0 3h16v1.3H4zm0 3h16v1.3H4zm0 3h16v1.3H4z"/></svg>
              <svg v-else-if="item.id === 'loose'" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M4 4.5h16v2H4zm0 6.5h16v2H4zm0 6.5h16v2H4z"/></svg>
              <svg v-else viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M4 9V4h5v1.8H5.8V9H4zm11 0V5.8H13.2V4H18v5h-3zM4 15h1.8v3.2H9V20H4v-5zm10.2 5v-1.8H18V15h1.8v5H14.2z"/></svg>
            </i>
            <span>{{ item.label }}</span>
          </button>
        </div>
        <div class="fs-beauty-filter" :class="{ open: beauty.filterOpen }">
          <button type="button" @click="beauty.filterOpen = !beauty.filterOpen">
            <svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2 3.2h12l-4.4 5.1v4.2l-3.2-1.5V8.3L2 3.2z"/></svg>
            筛选
            <i />
          </button>
          <div v-if="beauty.filterOpen" class="fs-beauty-filter-menu">
            <button
              v-for="item in BEAUTY_FILTERS"
              :key="item.id"
              type="button"
              :class="{ on: beauty.filter === item.id }"
              @click="beauty.filter = item.id; beauty.filterOpen = false"
            >{{ item.label }}</button>
          </div>
        </div>
        <div class="fs-beauty-colors">
          <button
            v-for="item in beautyDots()"
            :key="item.id + item.color"
            type="button"
            class="fs-beauty-dot"
            :class="{ on: beauty.color.toLowerCase() === item.color.toLowerCase() }"
            :style="{ background: item.color }"
            @click="beauty.color = item.color"
          >
            <svg v-if="beauty.color.toLowerCase() === item.color.toLowerCase()" viewBox="0 0 16 16" width="12" height="12">
              <path d="M3.2 8.1 6.5 11.3 12.8 4.8" fill="none" :stroke="beautyInk(item.color)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button type="button" class="fs-beauty-plus" aria-label="自定义颜色" @click="beautyColorRef?.click()">+</button>
          <input ref="beautyColorRef" class="fs-beauty-color-input" type="color" :value="beauty.color" @input="beauty.color = $event.target.value">
        </div>
        <div class="fs-beauty-grid">
          <button
            v-for="style in beautyStyles"
            :key="style.id"
            type="button"
            class="fs-beauty-card"
            @click="applyBeautyStyle(style)"
          >
            <span class="fs-beauty-thumb" :class="`b-${style.border}`" :style="{ color: beautyBorderTone(style) }">
              <i v-for="(cell, i) in beautyCells(style)" :key="i" :style="cell" />
            </span>
            <em>立即使用</em>
          </button>
        </div>
      </div>
    </aside>
    <aside v-if="cfState.side && cfState.dlg" class="fs-cf-side" @mousedown.stop="onCfSideDown">
        <div class="fs-cf-side-head">
          <button v-if="cfState.panel === 'edit'" type="button" title="返回" @click="backCf">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
          <span>{{ cfState.panel === 'rules' ? '条件格式' : '条件格式设置' }}</span>
          <svg class="fs-cf-help" viewBox="0 0 24 24" width="16" height="16"><path :d="CF_HELP" fill="currentColor" /></svg>
          <button type="button" title="关闭" @click="closeCfSide">
            <svg viewBox="0 0 24 24" width="16" height="16"><path :d="FIND_CLOSE" fill="currentColor" /></svg>
          </button>
        </div>
        <div v-if="cfState.panel === 'rules'" class="fs-cf-side-body">
          <div class="fs-cf-manage">
            管理
            <button type="button" class="fs-cf-scope" :class="{ open: cfState.scopeOpen }" @click.stop="toggleCfScopeMenu">
              {{ CF_RULE_SCOPES.find((s) => s.id === cfState.ruleScope)?.label || '整张工作表' }}
              <svg viewBox="0 0 24 24" width="12" height="12"><path d="m3.414 7.086-.707.707a1 1 0 0 0 0 1.414l7.778 7.778a2 2 0 0 0 2.829 0l7.778-7.778a1 1 0 0 0 0-1.414l-.707-.707a1 1 0 0 0-1.415 0l-7.07 7.07-7.072-7.07a1 1 0 0 0-1.414 0Z" fill="currentColor" /></svg>
            </button>
            的规则
          </div>
          <Teleport to="body">
            <div
              v-if="cfState.scopeOpen"
              class="fs-cf-scope-menu"
              :style="{ top: `${cfState.scopeY}px`, left: `${cfState.scopeX}px`, width: `${cfState.scopeW}px` }"
              @mousedown.stop
            >
              <button
                v-for="item in CF_RULE_SCOPES"
                :key="item.id"
                type="button"
                :class="{ on: cfState.ruleScope === item.id }"
                @click="pickCfScope(item.id)"
              >
                <span>{{ item.label }}</span>
                <svg v-if="cfState.ruleScope === item.id" viewBox="0 0 24 24" width="16" height="16"><path d="M9.4 16.6 4.8 12l-1.4 1.4 6 6 12-12-1.4-1.4z" fill="currentColor" /></svg>
              </button>
            </div>
          </Teleport>
          <div v-if="!cfState.list.length" class="fs-cf-empty">{{ cfState.ruleScope === 'sel' ? '所选单元格没有条件格式规则' : '当前工作表没有条件格式规则' }}</div>
          <div
            v-for="(rule, ri) in cfState.list"
            :key="`${rule._src}-${rule._idx}-${ri}`"
            class="fs-cf-rule-card"
            @click="focusCfRule(rule)"
          >
            <div class="fs-cf-rule-main">
              <span>
                <b>{{ cfRuleText(rule) }}</b>
                <em>{{ cfRuleRange(rule) }}</em>
              </span>
              <div class="fs-cf-rule-right">
                <button type="button" class="fs-cf-rule-del" title="删除规则" @click.stop="removeCfRule(rule)">
                  <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 7h12v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7Zm3-4h6l1 2h4v2H4V5h4l1-2Zm1 6v9h2v-9H10Zm4 0v9h2v-9h-2Z" fill="currentColor" /></svg>
                </button>
                <i class="fs-cf-rule-preview" :style="cfRulePreviewStyle(rule)">{{ cfRulePreviewText(rule) }}</i>
              </div>
            </div>
          </div>
          <button type="button" class="fs-cf-add" @click="openCfDialog('greaterThan', true)">+ 添加新的规则</button>
        </div>
        <div v-else class="fs-cf-side-body">
          <div class="fs-cf-field">应用范围
            <a-input
              v-model="cfForm.range"
              class="fs-cf-range"
              :class="{ picking: cfState.pickingRange }"
              placeholder="例如 A1:B10"
              @focus="onCfRangeFocus"
            >
              <template #suffix>
                <button
                  type="button"
                  class="fs-cf-range-pick"
                  :class="{ on: cfState.pickingRange }"
                  title="在表格中选择范围"
                  @mousedown.stop
                  @click.stop="toggleCfRangePick"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" fill="currentColor" /></svg>
                </button>
              </template>
            </a-input>
            <div v-if="cfState.pickingRange" class="fs-cf-range-tip">在表格中拖选单元格，范围会自动填入</div>
          </div>
          <div class="fs-cf-field">样式类型
            <div class="fs-cf-kind-wrap">
              <button
                type="button"
                class="fs-cf-kind-select"
                :class="{ open: cfState.kindOpen }"
                @click.stop="toggleKindMenu"
              >
                <span>{{ CF_TYPES.find((x) => x.id === cfForm.kind)?.label || '突出显示单元格' }}</span>
                <svg viewBox="0 0 24 24" width="12" height="12"><path d="m3.414 7.086-.707.707a1 1 0 0 0 0 1.414l7.778 7.778a2 2 0 0 0 2.829 0l7.778-7.778a1 1 0 0 0 0-1.414l-.707-.707a1 1 0 0 0-1.415 0l-7.07 7.07-7.072-7.07a1 1 0 0 0-1.414 0Z" fill="currentColor" /></svg>
              </button>
            </div>
            <Teleport to="body">
              <div
                v-if="cfState.kindOpen"
                class="fs-cf-kind-menu"
                :style="{ top: `${cfState.kindY}px`, left: `${cfState.kindX}px`, width: `${cfState.kindW}px` }"
                @mousedown.stop
              >
                <button
                  v-for="item in CF_TYPES"
                  :key="item.id"
                  type="button"
                  :class="{ on: cfForm.kind === item.id }"
                  @click="pickCfKind(item.id)"
                >
                  <span>{{ item.label }}</span>
                  <svg v-if="cfForm.kind === item.id" viewBox="0 0 24 24" width="16" height="16"><path d="M9.4 16.6 4.8 12l-1.4 1.4 6 6 12-12-1.4-1.4z" fill="currentColor" /></svg>
                </button>
              </div>
            </Teleport>
          </div>
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
          <div v-else-if="cfForm.kind === 'item'" class="fs-cf-field">样式规则
            <a-select :model-value="cfForm.rank" popup-container="body" :trigger-props="cfPopup" @change="(id) => { cfForm.rank = id; syncRankType() }">
              <a-option v-for="item in CF_RANKS" :key="item.id" :value="item.id">{{ item.label }}</a-option>
            </a-select>
            <div v-if="cfForm.rank === 'top' || cfForm.rank === 'last'" class="fs-cf-rank">
              <a-input v-model="cfForm.project" @change="syncRankType" />
              <a-checkbox v-model="cfForm.percent" @change="syncRankType">百分比</a-checkbox>
            </div>
          </div>
          <div v-else-if="cfForm.kind === 'formula'" class="fs-cf-field">公式
            <a-input v-model="cfForm.formula" placeholder="=A1>10" />
          </div>
          <div v-else-if="cfForm.kind === 'color'" class="fs-cf-field">样式设置
            <div class="fs-cf-scale-select-wrap">
              <button type="button" class="fs-cf-scale-select" :class="{ open: cfState.scaleOpen }" @click.stop="toggleScaleGallery">
                <span class="fs-cf-scale-thumb" :style="{ background: scalePreviewCss(currentColorPreset()?.format) }" />
                <span class="fs-cf-scale-name">{{ currentColorPreset()?.label || '绿 - 黄 - 红' }}</span>
                <svg viewBox="0 0 24 24" width="12" height="12"><path d="m3.414 7.086-.707.707a1 1 0 0 0 0 1.414l7.778 7.778a2 2 0 0 0 2.829 0l7.778-7.778a1 1 0 0 0 0-1.414l-.707-.707a1 1 0 0 0-1.415 0l-7.07 7.07-7.072-7.07a1 1 0 0 0-1.414 0Z" fill="currentColor" /></svg>
              </button>
            </div>
            <Teleport to="body">
              <div
                v-if="cfState.scaleOpen"
                class="fs-cf-scale-gallery"
                :style="{ top: `${cfState.scaleY}px`, left: `${cfState.scaleX}px`, width: `${cfState.scaleW}px` }"
                @mousedown.stop
              >
                <div class="fs-cf-scale-sec">双色色阶</div>
                <div class="fs-cf-scale-grid">
                  <button
                    v-for="sub in CF_FLIES.color.filter((x) => x.group === 'two')"
                    :key="sub.id"
                    type="button"
                    :class="{ on: cfForm.presetId === sub.id }"
                    :title="sub.label"
                    @click="pickScalePreset(sub)"
                  >
                    <span class="fs-cf-scale-preview" :style="{ background: scalePreviewCss(sub.format) }">
                      <i /><i /><i /><i /><i />
                    </span>
                  </button>
                </div>
                <div class="fs-cf-scale-sec">三色色阶</div>
                <div class="fs-cf-scale-grid three">
                  <button
                    v-for="sub in CF_FLIES.color.filter((x) => x.group === 'three')"
                    :key="sub.id"
                    type="button"
                    :class="{ on: cfForm.presetId === sub.id }"
                    :title="sub.label"
                    @click="pickScalePreset(sub)"
                  >
                    <span class="fs-cf-scale-preview" :style="{ background: scalePreviewCss(sub.format) }">
                      <i /><i /><i /><i /><i />
                    </span>
                  </button>
                </div>
              </div>
            </Teleport>
            <div v-for="stop in cfForm.scaleStops" :key="stop.key" class="fs-cf-scale-stop">
              <div class="fs-cf-scale-stop-label">{{ stop.label }}</div>
              <div class="fs-cf-scale-stop-row">
                <a-select v-model="stop.type" popup-container="body" :trigger-props="cfPopup" class="fs-cf-scale-type">
                  <a-option v-for="opt in CF_SCALE_STOP_TYPES" :key="opt.id" :value="opt.id">{{ opt.label }}</a-option>
                </a-select>
                <a-input
                  v-model="stop.value"
                  class="fs-cf-scale-value"
                  :disabled="scaleStopDisabled(stop)"
                  :placeholder="scaleStopDisabled(stop) ? '' : '请输入'"
                />
                <button type="button" class="fs-cf-scale-color" title="填充颜色" @click="openScaleStopColor(stop, $event.currentTarget)">
                  <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 20h16v-2.2H4V20Zm2.2-4.6 5.3-9.2c.3-.5 1-.5 1.3 0l5.3 9.2c.3.6-.1 1.3-.8 1.3H7c-.7 0-1.1-.7-.8-1.3Z" fill="currentColor" /></svg>
                  <i :style="{ background: stop.color }" />
                </button>
              </div>
            </div>
          </div>
          <div v-else-if="cfForm.kind === 'bar'" class="fs-cf-field">数据条样式
            <div class="fs-cf-bar-sec">渐变填充</div>
            <div class="fs-cf-bar-grid fs-cf-side-presets">
              <button
                v-for="sub in CF_FLIES.bar.filter((x) => x.group === 'gradient')"
                :key="sub.id"
                type="button"
                :class="{ on: cfForm.presetId === sub.id }"
                :title="sub.label"
                @click="pickCfPreset(sub)"
              >
                <span class="fs-cf-bar-preview gradient" :style="{ '--bar': sub.format[0] }">
                  <i /><i /><i /><i /><i />
                </span>
              </button>
            </div>
            <div class="fs-cf-bar-sec">实心填充</div>
            <div class="fs-cf-bar-grid fs-cf-side-presets">
              <button
                v-for="sub in CF_FLIES.bar.filter((x) => x.group === 'solid')"
                :key="sub.id"
                type="button"
                :class="{ on: cfForm.presetId === sub.id }"
                :title="sub.label"
                @click="pickCfPreset(sub)"
              >
                <span class="fs-cf-bar-preview" :style="{ '--bar': sub.format[0] }">
                  <i /><i /><i /><i /><i />
                </span>
              </button>
            </div>
          </div>
          <div v-else-if="cfForm.kind === 'icons'" class="fs-cf-field">图标集样式
            <template v-for="(group, gi) in CF_ICON_GROUPS" :key="group">
              <div class="fs-cf-icon-sec">{{ group }}</div>
              <div class="fs-cf-icon-wrap fs-cf-side-icons">
                <button
                  v-for="sub in CF_FLIES.icons.filter((x) => x.group === group)"
                  :key="sub.id"
                  type="button"
                  class="fs-cf-icon-item"
                  :class="{ alone: sub.alone, on: cfForm.presetId === sub.id }"
                  :title="sub.label"
                  @click="pickCfPreset(sub)"
                >
                  <span class="fs-cf-icon-preview" v-html="iconPreviewHtml(sub)" />
                </button>
              </div>
              <div v-if="gi < CF_ICON_GROUPS.length - 1" class="fs-cf-icon-sep" />
            </template>
          </div>
          <div v-if="cfForm.kind === 'highlight' || cfForm.kind === 'item' || cfForm.kind === 'formula'" class="fs-cf-field">格式样式
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
          <a-button @click="closeCfSide">取消</a-button>
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
          @click="removeCfRule({ ...rule, _src: 'cf', _idx: ri })"
        >
          {{ cfRuleText(rule) }}
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
    <Teleport to="body">
    <div
      v-if="ctxMenu.show"
      ref="ctxMenuRef"
      class="fs-ctx"
      :class="{ 'sub-left': ctxMenu.subLeft }"
      :style="{ left: `${ctxMenu.x}px`, top: `${ctxMenu.y}px` }"
      @mousedown.stop
      @contextmenu.prevent
    >
      <template v-for="(item, i) in ctxItems" :key="item.sep ? `sep-${i}` : item.id">
        <div v-if="item.sep" class="fs-ctx-sep" />
        <button
          v-else
          type="button"
          class="fs-ctx-item"
          :class="{ danger: item.danger }"
          @mouseenter="onCtxItemEnter(item)"
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
              <button
                v-else
                type="button"
                class="fs-ctx-sub-item"
                :class="{ on: ctxMenu.fly2 === sub.id }"
                @mouseenter="onCtxSubEnter(sub)"
                @click="sub.caret ? null : onCtxAction(sub.id)"
              >
                <span>{{ sub.label }}</span>
                <i v-if="sub.caret">›</i>
                <div v-if="sub.caret && ctxMenu.fly2 === sub.id" class="fs-ctx-sub fs-ctx-sub2" @mousedown.stop>
                  <button
                    v-for="leaf in sub.children"
                    :key="leaf.id"
                    type="button"
                    @click="onCtxAction(leaf.id)"
                  >{{ leaf.label }}</button>
                </div>
              </button>
            </template>
          </div>
        </button>
      </template>
    </div>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="sheetListPop.open"
        class="fs-sheet-list"
        :style="{ left: `${sheetListPop.left}px`, top: `${sheetListPop.top}px` }"
        @mousedown.stop
        @keydown.stop
      >
        <div class="fs-sheet-list-search">
          <icon-search class="fs-sheet-list-search-ico" />
          <input
            v-model="sheetListPop.query"
            type="text"
            placeholder="请输入内容"
            @keydown.esc.stop="closeSheetListPop"
          >
        </div>
        <ul class="fs-sheet-list-ul" role="listbox">
          <li
            v-for="sheet in filteredSheetList"
            :key="sheet.id"
            class="fs-sheet-list-li"
            :class="{
              dragging: sheetDrag.id === sheet.id,
              'drag-over': sheetDrag.overId === sheet.id && sheetDrag.id !== sheet.id,
            }"
            @dragover="onSheetListDragOver($event, sheet)"
            @dragleave="onSheetListDragLeave(sheet)"
            @drop="onSheetListDrop($event, sheet)"
          >
            <button
              type="button"
              class="fs-sheet-list-item"
              :class="{ active: sheet.id === sheetListPop.activeId }"
              @click="activateFromSheetList(sheet)"
            >
              <span
                class="fs-sheet-list-drag"
                :draggable="sheetListCanDrag"
                aria-hidden="true"
                @dragstart.stop="onSheetListDragStart($event, sheet)"
                @dragend.stop="onSheetListDragEnd"
                @click.stop
              >
                <svg width="6" height="10" viewBox="0 0 6 10" fill="none"><path d="M.4 0h1.2c.22 0 .4.18.4.4v1.2a.4.4 0 01-.4.4H.4a.4.4 0 01-.4-.4V.4C0 .18.18 0 .4 0zm4 0h1.2c.22 0 .4.18.4.4v1.2a.4.4 0 01-.4.4H4.4a.4.4 0 01-.4-.4V.4c0-.22.18-.4.4-.4zm-4 8h1.2c.22 0 .4.18.4.4v1.2a.4.4 0 01-.4.4H.4a.4.4 0 01-.4-.4V8.4c0-.22.18-.4.4-.4zm4 0h1.2c.22 0 .4.18.4.4v1.2a.4.4 0 01-.4.4H4.4a.4.4 0 01-.4-.4V8.4c0-.22.18-.4.4-.4zm-4-4h1.2c.22 0 .4.18.4.4v1.2a.4.4 0 01-.4.4H.4a.4.4 0 01-.4-.4V4.4c0-.22.18-.4.4-.4zm4 0h1.2c.22 0 .4.18.4.4v1.2a.4.4 0 01-.4.4H4.4a.4.4 0 01-.4-.4V4.4c0-.22.18-.4.4-.4z" fill="#8F959E" fill-rule="nonzero"/></svg>
              </span>
              <i v-if="sheet.color" class="fs-sheet-list-dot" :style="{ background: sheet.color }" />
              <span class="fs-sheet-list-name">{{ sheet.name }}</span>
              <span class="fs-sheet-list-trail">
                <svg
                  v-if="isSheetHidden(sheet)"
                  class="fs-sheet-list-eye"
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  aria-hidden="true"
                >
                  <path d="M2.2 8s2.2-3.6 5.8-3.6S13.8 8 13.8 8s-2.2 3.6-5.8 3.6S2.2 8 2.2 8z" fill="none" stroke="currentColor" stroke-width="1.2" />
                  <circle cx="8" cy="8" r="1.6" fill="none" stroke="currentColor" stroke-width="1.2" />
                  <path d="M3.2 12.8 12.8 3.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                </svg>
                <icon-check v-else-if="sheet.id === sheetListPop.activeId" class="fs-sheet-list-check" />
              </span>
            </button>
          </li>
          <li v-if="!filteredSheetList.length" class="fs-sheet-list-empty">无匹配工作表</li>
        </ul>
      </div>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="sheetTabMenu.show"
        class="fs-sheet-ctx"
        :style="{ left: `${sheetTabMenu.x}px`, top: `${sheetTabMenu.y}px` }"
        @mousedown.stop
        @contextmenu.prevent
      >
        <a-menu
          class="fs-sheet-arco-menu"
          :selected-keys="[]"
          @menu-item-click="onSheetTabAction"
        >
          <a-menu-item key="delete">删除</a-menu-item>
          <a-menu-item key="rename">重命名</a-menu-item>
          <a-menu-item key="color" class="fs-sheet-color-item">
            <span>工作表标签颜色</span>
            <icon-right class="fs-sheet-caret" />
          </a-menu-item>
          <a-menu-item key="insert">插入工作表</a-menu-item>
          <a-menu-item key="copy">复制工作表</a-menu-item>
          <a-menu-item key="hide">隐藏工作表</a-menu-item>
          <a-menu-item key="protect">
            <span>保护工作表</span>
            <a-tag class="fs-sheet-new" color="red" size="small">New</a-tag>
          </a-menu-item>
          <a-menu-item key="export">导出为图片</a-menu-item>
        </a-menu>
      </div>
    </Teleport>
    <div v-if="fmtDlg.show" class="fs-fmt" @mousedown.stop>
      <div class="fs-dv-head">
        <span>设置单元格格式</span>
        <button type="button" class="fs-dv-x" @click="fmtDlg.show = false">×</button>
      </div>
      <div class="fs-dv-tabs">
        <button type="button" :class="{ on: fmtDlg.tab === 'number' }" @click="fmtDlg.tab = 'number'">数字</button>
        <button type="button" :class="{ on: fmtDlg.tab === 'align' }" @click="fmtDlg.tab = 'align'">对齐</button>
        <button type="button" :class="{ on: fmtDlg.tab === 'font' }" @click="fmtDlg.tab = 'font'">字体</button>
        <button type="button" :class="{ on: fmtDlg.tab === 'border' }" @click="fmtDlg.tab = 'border'">边框</button>
        <button type="button" :class="{ on: fmtDlg.tab === 'fill' }" @click="fmtDlg.tab = 'fill'">填充</button>
      </div>
      <div v-if="fmtDlg.tab === 'number'" class="fs-fmt-body">
        <div class="fs-fmt-cats">
          <div class="fs-fmt-cat-h">分类</div>
          <button v-for="c in FMT_CATS" :key="c.id" type="button" :class="{ on: fmtDlg.cat === c.id }" @click="fmtDlg.cat = c.id">{{ c.label }}</button>
        </div>
        <div class="fs-fmt-main">
          <div class="fs-fmt-sample"><span>示例</span><b>{{ fmtPreview() }}</b></div>
          <p>{{ FMT_CATS.find((c) => c.id === fmtDlg.cat)?.hint }}</p>
          <div v-if="fmtDlg.cat === 'number' || fmtDlg.cat === 'currency' || fmtDlg.cat === 'accounting' || fmtDlg.cat === 'percent'" class="fs-fmt-opts">
            <label>小数位数 <input v-model.number="fmtDlg.decimals" type="number" min="0" max="6"></label>
            <label v-if="fmtDlg.cat !== 'percent'"><input v-model="fmtDlg.thousand" type="checkbox">使用千位分隔符</label>
            <label v-if="fmtDlg.cat === 'currency' || fmtDlg.cat === 'accounting'">符号
              <select v-model="fmtDlg.symbol"><option>¥</option><option>$</option></select>
            </label>
          </div>
          <div v-else-if="fmtDlg.cat === 'date'" class="fs-fmt-list">
            <button v-for="fa in FMT_DATES" :key="fa" type="button" :class="{ on: fmtDlg.dateFa === fa }" @click="fmtDlg.dateFa = fa">{{ fmtDateLabel(fa) }}</button>
          </div>
          <div v-else-if="fmtDlg.cat === 'time'" class="fs-fmt-list">
            <button v-for="fa in FMT_TIMES" :key="fa" type="button" :class="{ on: fmtDlg.timeFa === fa }" @click="fmtDlg.timeFa = fa">{{ fmtDateLabel(fa) }}</button>
          </div>
          <template v-else-if="fmtDlg.cat === 'custom'">
            <div class="fs-fmt-list fs-fmt-custom">
              <button v-for="fa in FMT_CUSTOM" :key="fa" type="button" :class="{ on: fmtDlg.custom === fa }" @click="fmtDlg.custom = fa">{{ fa }}</button>
            </div>
            <input v-model="fmtDlg.custom" class="fs-dv-input" placeholder="格式代码，例如 0.00 或 yyyy年m月d日">
          </template>
        </div>
      </div>
      <div v-else-if="fmtDlg.tab === 'align'" class="fs-fmt-pane">
        <label>水平对齐
          <select v-model="fmtDlg.ht"><option value="1">左对齐</option><option value="0">居中</option><option value="2">右对齐</option></select>
        </label>
        <label>垂直对齐
          <select v-model="fmtDlg.vt"><option value="1">顶端对齐</option><option value="0">居中</option><option value="2">底端对齐</option></select>
        </label>
        <label class="fs-dv-check"><input v-model="fmtDlg.wrap" type="checkbox">自动换行</label>
      </div>
      <div v-else-if="fmtDlg.tab === 'font'" class="fs-fmt-pane">
        <label>字体
          <select v-model="fmtDlg.font">
            <option
              v-for="item in FONT_NAMES"
              :key="`fmt-${item.key}`"
              :value="item.key === 'default' ? '默认字体' : item.id"
              :style="{ fontFamily: item.family }"
            >{{ item.label }}</option>
          </select>
        </label>
        <label>字号 <input v-model.number="fmtDlg.size" type="number" min="8" max="72"></label>
        <label class="fs-dv-check"><input v-model="fmtDlg.bold" type="checkbox">粗体</label>
        <button type="button" class="fs-fmt-color" @click="openFmtColor('fmt-fc', $event)"><i :style="{ background: fmtDlg.color }" />字体颜色</button>
      </div>
      <div v-else-if="fmtDlg.tab === 'border'" class="fs-fmt-pane">
        <button type="button" :class="{ on: fmtDlg.border === 'border-all' }" @click="fmtDlg.border = 'border-all'">所有边框</button>
        <button type="button" :class="{ on: fmtDlg.border === 'border-outside' }" @click="fmtDlg.border = 'border-outside'">外边框</button>
        <button type="button" :class="{ on: fmtDlg.border === 'border-bottom' }" @click="fmtDlg.border = 'border-bottom'">下边框</button>
        <button type="button" :class="{ on: fmtDlg.border === 'border-none' }" @click="fmtDlg.border = 'border-none'">无边框</button>
      </div>
      <div v-else class="fs-fmt-pane">
        <button type="button" class="fs-fmt-color" @click="openFmtColor('fmt-bg', $event)"><i :style="{ background: fmtDlg.fill || '#fff' }" />填充颜色</button>
      </div>
      <div class="fs-fmt-foot">
        <button type="button" class="fs-dv-cancel" @click="fmtDlg.show = false">取消</button>
        <button type="button" class="fs-dv-ok" @click="confirmFmtDlg">确定</button>
      </div>
    </div>
    <div v-if="dvDlg.show" class="fs-dv" @mousedown.stop>
      <div class="fs-dv-head">
        <span>数据验证</span>
        <button type="button" class="fs-dv-x" @click="dvDlg.show = false">×</button>
      </div>
      <div class="fs-dv-tabs">
        <button type="button" :class="{ on: dvDlg.tab === 'set' }" @click="dvDlg.tab = 'set'">设置</button>
        <button type="button" :class="{ on: dvDlg.tab === 'hint' }" @click="dvDlg.tab = 'hint'">输入警告与帮助</button>
      </div>
      <div v-if="dvDlg.tab === 'set'" class="fs-dv-body">
        <div class="fs-dv-row">
          <span class="fs-dv-lab">验证条件</span>
          <select v-model="dvDlg.cond" @change="onDvCond">
            <option v-for="c in DV_CONDS" :key="c">{{ c }}</option>
          </select>
        </div>
        <template v-if="dvDlg.cond === '单选' || dvDlg.cond === '多选'">
          <div class="fs-dv-row">
            <span class="fs-dv-lab">选项来源</span>
            <label class="fs-dv-radio"><input v-model="dvDlg.source" type="radio" value="custom">自定义</label>
            <label class="fs-dv-radio"><input v-model="dvDlg.source" type="radio" value="ref">引用数据</label>
          </div>
          <textarea
            v-if="dvDlg.source === 'custom'"
            v-model="dvDlg.text"
            class="fs-dv-area"
            placeholder="请输入选项，选项间通过“回车换行”或“英文逗号（,）”隔开"
          />
          <input v-else v-model="dvDlg.refText" class="fs-dv-input" placeholder="例如 A1:A10">
          <div class="fs-dv-checks">
            <label><input v-model="dvDlg.optionColor" type="checkbox">选项颜色</label>
            <button v-if="dvDlg.optionColor" type="button" class="fs-dv-pen" title="编辑选项颜色" @click="dvDlg.colorEdit = !dvDlg.colorEdit">✎</button>
            <label><input v-model="dvDlg.showArrow" type="checkbox">显示下拉箭头</label>
          </div>
          <div v-if="dvDlg.optionColor && dvDlg.colorEdit" class="fs-dv-colors">
            <button v-for="opt in dvOptionList()" :key="opt" type="button" class="fs-dv-chip" @click="openDvColor(opt, $event)">
              <i :style="{ background: dvDlg.colors[opt] || '#3370ff' }" />{{ opt }}
            </button>
            <span v-if="!dvOptionList().length" class="fs-dv-empty">先填写选项</span>
          </div>
        </template>
        <template v-else-if="dvDlg.cond === '数字' || dvDlg.cond === '日期' || dvDlg.cond === '文本'">
          <div class="fs-dv-row">
            <span class="fs-dv-lab">条件</span>
            <select v-model="dvDlg.op">
              <option v-for="[k, lab] in (dvDlg.cond === '文本' ? DV_TEXT_OPS : DV_NUM_OPS)" :key="k" :value="k">{{ lab }}</option>
            </select>
          </div>
          <input v-model="dvDlg.v1" class="fs-dv-input" :type="dvDlg.cond === '日期' ? 'date' : 'text'" :placeholder="dvDlg.cond === '文本' ? '内容' : '值'">
          <input v-if="dvDlg.cond !== '文本' && (dvDlg.op === 'between' || dvDlg.op === 'notBetween')" v-model="dvDlg.v2" class="fs-dv-input" :type="dvDlg.cond === '日期' ? 'date' : 'text'" placeholder="到">
        </template>
        <p v-else-if="dvDlg.cond === '手机号'" class="fs-dv-note">只允许 11 位手机号，以 1 开头。</p>
        <p v-else-if="dvDlg.cond === '邮箱'" class="fs-dv-note">只允许邮箱地址，例如 name@example.com。</p>
        <p v-else class="fs-dv-note">选中单元格后可直接勾选，值为 ✓ 或留空。</p>
      </div>
      <div v-else class="fs-dv-body">
        <label class="fs-dv-check"><input v-model="dvDlg.hintOn" type="checkbox">选定单元格时显示</label>
        <input v-model="dvDlg.hintTitle" class="fs-dv-input" placeholder="标题">
        <textarea v-model="dvDlg.hintText" class="fs-dv-area" placeholder="输入提示内容" />
        <label class="fs-dv-check"><input v-model="dvDlg.warnOn" type="checkbox">输入无效数据时显示出错警告</label>
        <select v-model="dvDlg.warnStyle">
          <option value="stop">拒绝输入</option>
          <option value="warn">警告</option>
          <option value="info">信息</option>
        </select>
        <input v-model="dvDlg.warnTitle" class="fs-dv-input" placeholder="警告标题">
        <textarea v-model="dvDlg.warnText" class="fs-dv-area" placeholder="警告内容" />
      </div>
      <div class="fs-dv-foot">
        <button type="button" class="fs-dv-clear" @click="clearValidation">清除数据验证</button>
        <span class="fs-dv-gap" />
        <button type="button" class="fs-dv-cancel" @click="dvDlg.show = false">取消</button>
        <button type="button" class="fs-dv-ok" @click="confirmValidation">确定</button>
      </div>
    </div>
    <div
      v-if="copyMark.show"
      class="fs-copy-mark"
      :style="{ left: `${copyMark.left}px`, top: `${copyMark.top}px`, width: `${copyMark.width}px`, height: `${copyMark.height}px` }"
    />
    <button
      v-if="dvArrow.show"
      type="button"
      class="fs-dv-arrow"
      :style="{ left: `${dvArrow.left}px`, top: `${dvArrow.top}px` }"
      @mousedown.stop.prevent="openDvList"
    >▾</button>
    <div
      v-if="dvList.show"
      class="fs-dv-list"
      :style="{ left: `${dvList.left}px`, top: `${dvList.top}px` }"
      @mousedown.stop
    >
      <button
        v-for="opt in dvList.options"
        :key="opt"
        type="button"
        :class="{ on: dvList.picked.includes(opt) }"
        @click="pickDvOption(opt)"
      >
        <i v-if="dvList.colors[opt]" :style="{ background: dvList.colors[opt] }" />{{ opt }}
      </button>
      <span v-if="!dvList.options.length" class="fs-dv-empty">没有可选项</span>
    </div>
    <button
      v-if="dvCheck.show"
      type="button"
      class="fs-dv-checkbtn"
      :class="{ on: dvCheck.on }"
      :style="{ left: `${dvCheck.left}px`, top: `${dvCheck.top}px` }"
      @mousedown.stop.prevent="toggleDvCheck"
    >{{ dvCheck.on ? '✓' : '' }}</button>
    <div
      v-if="dvHint.show"
      class="fs-dv-hint"
      :style="{ left: `${dvHint.left}px`, top: `${dvHint.top}px` }"
    >
      <b v-if="dvHint.title">{{ dvHint.title }}</b>
      <span>{{ dvHint.text }}</span>
    </div>
    <Teleport to="body">
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
    </Teleport>
    <Teleport to="body">
      <ColorPop
        :show="colorPop.show"
        :left="colorPop.left"
        :top="colorPop.top"
        :origin="colorPop.origin"
        :clearable="colorPop.kind === 'sheet-tab'"
        @update:show="colorPop.show = $event"
        @pick="applyCellColor"
      />
      <div
        v-if="fsTip.show"
        class="fs-tip"
        :style="{ left: `${fsTip.left}px`, top: `${fsTip.top}px` }"
      >{{ fsTip.text }}</div>
    </Teleport>
  </div>
</template>
