<script setup>
import { createElement, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { handleBorder } from '@fortune-sheet/core'
import { Workbook } from '@fortune-sheet/react'
import { Message, Modal } from '@arco-design/web-vue'
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
const FMT_DATES = [
  { fa: 'yyyy-MM-dd', sample: '2017-08-01' },
  { fa: 'yyyy/MM/dd', sample: '2017/08/01' },
  { fa: 'yyyy年M月d日', sample: '2017年8月1日' },
  { fa: 'MM-dd', sample: '08-01' },
]
const FMT_TIMES = [
  { fa: 'hh:mm:ss', sample: '23:24:25' },
  { fa: 'hh:mm', sample: '23:24' },
  { fa: 'yyyy-MM-dd hh:mm:ss', sample: '2017-08-01 23:24:25' },
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
  }, 16)
}

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
  if (!api?.setCellValuesByRange || !sheet) return
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
  // 一次写回 = 一步撤销（逐格 setCellValue 会产生行×列个撤销步骤）
  const matrix = rows.map((line) => Array.from({ length: maxC + 1 }, (_, c) => {
    const cell = line[c]
    return cell == null ? '' : { ...cell }
  }))
  try {
    api.setCellValuesByRange(matrix, { row: [filterPop.r0, filterPop.r1], column: [0, maxC] }, { id: sheet.id })
  } catch { /* */ }
}

function clickData(label) {
  if (label === '筛选') {
    const el = hostRef.value?.querySelector('[data-label="筛选"], [data-tips="筛选"]')
    openFilter(el)
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
  if (!api?.setCellValuesByRange || !sel || !sheet) return
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
  // 一次写回 = 一步撤销（逐格 setCellValue 会产生行×列个撤销步骤）
  const matrix = rows.map((cells) => cells.map((cell) => (cell == null ? '' : { ...cell })))
  try {
    api.setCellValuesByRange(matrix, { row: [r0, r1], column: [c0, c1] }, { id: sheet.id })
  } catch { /* */ }
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
  const filtered = !!(sheet?.filter_select || sheet?.filter)
  setOn(byLabel('冻结'), frozen)
  setOn(byLabel('筛选'), filtered || filterHidden.has(sheet?.id))
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
  dataBar.filter = !!(sheet?.filter_select || sheet?.filter) || filterHidden.has(sheet?.id)
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
function fmtSampleText() {
  const cat = fmtDlg.cat
  if (cat === 'general') return ''
  if (cat === 'text') return '文本'
  if (cat === 'date') return FMT_DATES.find((x) => x.fa === fmtDlg.dateFa)?.sample || '2017-08-01'
  if (cat === 'time') return FMT_TIMES.find((x) => x.fa === fmtDlg.timeFa)?.sample || '23:24:25'
  if (cat === 'percent') return fmtDlg.decimals ? '12.00%' : '12%'
  if (cat === 'fraction') return '1/2'
  if (cat === 'sci') return '1.23E+03'
  if (cat === 'special') return '000123'
  if (cat === 'custom') return fmtDlg.custom
  const body = fmtDlg.thousand ? '1,234' : '1234'
  const dec = fmtDlg.decimals ? `.${'0'.repeat(Math.min(6, fmtDlg.decimals))}` : ''
  const sign = fmtDlg.cat === 'currency' || fmtDlg.cat === 'accounting' ? fmtDlg.symbol : ''
  return `${sign}${body}${dec}`
}
function openFmtDlg() {
  pop.show = false
  const api = instRef.current
  const sheet = api?.getSheet?.()
  const sel = api?.getSelection?.()?.[0]
  const cell = sheet?.data?.[sel?.row?.[0] ?? 0]?.[sel?.column?.[0] ?? 0]
  const fa = cell?.ct?.fa || 'General'
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
    if (filterPop.show) {
      filterPop.show = false
      return
    }
    openFilter(filterHit)
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

const ctxMenu = reactive({ show: false, x: 0, y: 0, fly: '' })
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
const DV_CONDS = ['单选', '多选', '数字', '日期', '文本', '复选框', '手机号', '邮箱']
const dvDlg = reactive({
  show: false,
  tab: 'set',
  cond: '单选',
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
    }
  }
  ctxDlg.show = false
}

function dvOptionList() {
  return dvDlg.text.split(/[\n,，]/).map((s) => s.trim()).filter(Boolean)
}
function openValidation() {
  const box = selectionBox()
  const rule = box?.sheet?.dataVerification?.[`${box.r0}_${box.c0}`]
  dvDlg.tab = 'set'
  dvDlg.colorEdit = false
  dvDlg.cond = '单选'
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
  if (rule?.type === 'dropdown') {
    dvDlg.cond = rule.type2 ? '多选' : '单选'
    const value = String(rule.value1 || '')
    const isRef = /^\$?[A-Z]+\d+:\$?[A-Z]+\d+$/i.test(value)
    dvDlg.source = isRef ? 'ref' : 'custom'
    if (isRef) dvDlg.refText = value
    else dvDlg.text = value.split(',').join('\n')
    dvDlg.optionColor = !!rule.optionColor
    dvDlg.showArrow = rule.showArrow !== false
    dvDlg.colors = { ...(rule.colors || {}) }
    dvDlg.hintOn = !!rule.hintShow
    dvDlg.hintTitle = rule.hintTitle || ''
    dvDlg.hintText = rule.hintText || ''
    dvDlg.warnOn = rule.prohibitInput !== false
    dvDlg.warnText = rule.warnText || ''
  } else if (rule?.type === 'checkbox') dvDlg.cond = '复选框'
  else if (rule?.type === 'number') dvDlg.cond = '数字'
  else if (rule?.type === 'date') dvDlg.cond = '日期'
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
  const list = ['单选', '多选'].includes(dvDlg.cond)
  const value1 = list
    ? (dvDlg.source === 'ref' ? dvDlg.refText.trim() : dvOptionList().join(','))
    : ''
  const rule = {
    type: dvDlg.cond === '复选框' ? 'checkbox' : (dvDlg.cond === '数字' ? 'number' : (dvDlg.cond === '日期' ? 'date' : 'dropdown')),
    type2: dvDlg.cond === '多选',
    value1,
    prohibitInput: dvDlg.warnOn,
    hintShow: dvDlg.hintOn,
    hintTitle: dvDlg.hintTitle,
    hintText: dvDlg.hintText || dvDlg.warnText,
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
    openFmtDlg()
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
  const el = anchor?.closest?.('.sheet-list-container, .fortune-sheettab-button') || anchor
  const r = el?.getBoundingClientRect?.()
  if (!r) return
  closeSheetTabMenu()
  sheetListPop.query = ''
  try { sheetListPop.activeId = instRef.current?.getSheet?.()?.id || '' }
  catch { sheetListPop.activeId = '' }
  sheetListPop.left = Math.round(r.left)
  sheetListPop.top = Math.round(r.top - 8)
  sheetListPop.open = true
  nextTick(() => {
    const pop = document.querySelector('.fs-sheet-list')
    if (!pop) return
    const h = pop.getBoundingClientRect().height
    sheetListPop.top = Math.max(8, Math.round(r.top - h - 4))
  })
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
  if (e.target.closest?.('.cp, .fs-pop, .fs-fold, .fs-cf-dlg, .fs-cf-fly, .fs-find, .fs-ctx, .fs-ctx-dlg, .fs-filter, .fs-style-cluster, .fs-align-cluster, .fs-fmt-cluster, .fs-data-cluster, .fs-ht-menu, .fs-sheet-ctx, .fs-sheet-list, .fs-font-menu, .sheet-list-container, #all-sheets, .arco-trigger-popup')) return
  // 颜色按钮由 onFreezeCapture 负责开关，避免 mousedown 先关掉、click 再打开时被冲掉
  if (findColorCombo(e.target)) return
  pop.show = false
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
    ],
    hooks: {
      afterSelectionChange: (_id, sel) => {
        syncCfRangeFromSelection(sel)
        scheduleDataBars()
        if (cfState.side && cfState.panel === 'rules') refreshCfFlags()
      },
    },
    onChange: (next) => { latest = next || latest; markActiveTools(); scheduleDataBars(); syncBarStore() },
  }))
  requestAnimationFrame(() => {
    watchToolbarLabels()
    bindFreezeClick()
    const native = cfRules().filter((rule) => rule.type !== 'dataBar')
    if (native.length !== cfRules().length) patchCf(native, false)
    const sheet = instRef.current?.getSheet?.()
    if (sheet) {
      const fromSheet = sheet.config?.fs_data_bars || sheet.fs_data_bars
      if (fromSheet?.length && !dataBarStore.has(sheetBarKey(sheet))) dataBarStore.set(sheetBarKey(sheet), fromSheet)
    }
    drawDataBars()
    drawIconSets()
  })
  const redrawBars = () => scheduleDataBars()
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
/** Enter 捕获阶段：出现过全角等号且 DOM 里已丢失 '=' 时，补回完整公式再交给 fortune 提交 */
function onDocFormulaKeydown(e) {
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
  document.execCommand('insertText', false, item.name + '(')
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
  document.removeEventListener('mousedown', onDocScaleDown, true)
  document.removeEventListener('input', onDocFormulaInput, true)
  document.removeEventListener('compositionend', onDocFormulaInput, true)
  document.removeEventListener('keydown', onDocFormulaKeydown, true)
  document.removeEventListener('mousedown', onDocEditResidueDown, true)
  document.removeEventListener('selectionchange', onDocFuncSelChange, true)
  document.removeEventListener('scroll', onDocFuncScroll, true)
  labelObs?.disconnect()
  labelObs = null
  hostRef.value?.removeEventListener('mousedown', onColorToolbarCapture, true)
  hostRef.value?.removeEventListener('click', onColorToolbarCapture, true)
  hostRef.value?.removeEventListener('click', onFreezeCapture, true)
  hostRef.value?.removeEventListener('click', onSheetTabFuncClick, true)
  hostRef.value?.removeEventListener('mousedown', onSheetListBtnClick, true)
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
  <div class="fortune-wrap" :class="{ 'fs-open': !folded, 'cf-side': cfState.side && cfState.dlg, 'cf-picking': cfState.pickingRange, 'fs-sheet-list-open': sheetListPop.open }" @mousedown="onWrapDown" @mouseover="onTipOver" @mouseleave="onTipLeave">
    <input ref="fileRef" type="file" accept=".xlsx,.xls" hidden @change="onImport">
    <div ref="hostRef" class="fortune-host"></div>
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
    <Teleport to="body">
      <div
        v-if="sheetListPop.open"
        class="fs-sheet-list"
        :style="{ left: `${sheetListPop.left}px`, top: `${sheetListPop.top}px` }"
        @mousedown.stop
      >
        <div class="fs-sheet-list-search">
          <icon-search class="fs-sheet-list-search-ico" />
          <input
            v-model="sheetListPop.query"
            type="text"
            placeholder="查找"
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
          <div class="fs-fmt-sample"><span>示例</span><b>{{ fmtSampleText() }}</b></div>
          <p>{{ FMT_CATS.find((c) => c.id === fmtDlg.cat)?.hint }}</p>
          <div v-if="fmtDlg.cat === 'number' || fmtDlg.cat === 'currency' || fmtDlg.cat === 'accounting' || fmtDlg.cat === 'percent'" class="fs-fmt-opts">
            <label>小数位数 <input v-model.number="fmtDlg.decimals" type="number" min="0" max="6"></label>
            <label v-if="fmtDlg.cat !== 'percent'"><input v-model="fmtDlg.thousand" type="checkbox">使用千位分隔符</label>
            <label v-if="fmtDlg.cat === 'currency' || fmtDlg.cat === 'accounting'">符号
              <select v-model="fmtDlg.symbol"><option>¥</option><option>$</option></select>
            </label>
          </div>
          <div v-else-if="fmtDlg.cat === 'date'" class="fs-fmt-list">
            <button v-for="d in FMT_DATES" :key="d.fa" type="button" :class="{ on: fmtDlg.dateFa === d.fa }" @click="fmtDlg.dateFa = d.fa">{{ d.sample }}</button>
          </div>
          <div v-else-if="fmtDlg.cat === 'time'" class="fs-fmt-list">
            <button v-for="d in FMT_TIMES" :key="d.fa" type="button" :class="{ on: fmtDlg.timeFa === d.fa }" @click="fmtDlg.timeFa = d.fa">{{ d.sample }}</button>
          </div>
          <input v-else-if="fmtDlg.cat === 'custom'" v-model="fmtDlg.custom" class="fs-dv-input" placeholder="格式代码">
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
          <select v-model="dvDlg.cond">
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
        <p v-else class="fs-dv-note">当前条件会作用到选中单元格。</p>
      </div>
      <div v-else class="fs-dv-body">
        <label class="fs-dv-check"><input v-model="dvDlg.hintOn" type="checkbox">选定单元格时显示</label>
        <input v-model="dvDlg.hintTitle" class="fs-dv-input" placeholder="标题">
        <textarea v-model="dvDlg.hintText" class="fs-dv-area" placeholder="输入提示内容" />
        <label class="fs-dv-check"><input v-model="dvDlg.warnOn" type="checkbox">输入无效数据时显示出错警告</label>
        <select v-model="dvDlg.warnStyle">
          <option value="stop">停止</option>
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
