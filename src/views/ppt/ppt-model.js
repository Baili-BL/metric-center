import { hashStr, monthLabels, uid } from '../../utils/hash'
import { mergeBuilderState, toPaintSpec } from '../../charts/types'

export const PPT_SCOPES = [
  { id: 'mine', name: '我的PPT' },
  { id: 'shared', name: '共享PPT' },
  { id: 'public', name: '公共PPT' },
]

export const PPT_TYPES = [
  { id: 'weekly', name: '周报' },
  { id: 'monthly', name: '月报' },
  { id: 'topic', name: '专题' },
  { id: 'roadshow', name: '路演' },
]

export const TYPE_NAME = Object.fromEntries(PPT_TYPES.map((t) => [t.id, t.name]))

export const COVER_TEMPLATES = [
  { id: 'city', name: '都市封面', accent: '#c62828', bg: '#1d2a3a' },
  { id: 'navy', name: '深蓝商务', accent: '#c9a227', bg: '#12264a' },
  { id: 'crimson', name: '朱红研报', accent: '#f3d19e', bg: '#8b1e2d' },
  { id: 'light', name: '浅色简约', accent: '#1664ff', bg: '#f4f7fb' },
]

export const LAYOUT_GROUPS = [
  { id: 'basic', name: '基础版式' },
  { id: 'text', name: '文本版式' },
  { id: 'chart', name: '图表版式' },
]

export const LAYOUTS = [
  { id: 'titleContent', name: '标题和内容', group: 'basic', slots: ['content'] },
  { id: 'sectionTitle', name: '节标题', group: 'basic', slots: ['text'] },
  { id: 'twoColContent', name: '两栏内容', group: 'basic', slots: ['content', 'content'] },
  { id: 'compare', name: '比较', group: 'basic', slots: ['text', 'text', 'content', 'content'] },
  { id: 'titleOnly', name: '仅标题', group: 'basic', slots: [] },
  { id: 'blank', name: '空白', group: 'basic', slots: ['content'] },
  { id: 'contentTitle', name: '内容与标题', group: 'basic', slots: ['text', 'content', 'content'] },
  { id: 'picTitle', name: '图片与标题', group: 'basic', slots: ['content', 'text'] },
  { id: 'titleVert', name: '标题和竖排文字', group: 'basic', slots: ['text'] },
  { id: 'vertTitleText', name: '垂直排列标题与文本', group: 'basic', slots: ['text', 'content'] },

  { id: 'titleBody', name: '一段文本', group: 'text', slots: ['text'] },
  { id: 'rowsText', name: '多行文本', group: 'text', slots: ['text', 'text', 'text'] },
  { id: 'colsText', name: '多列文本', group: 'text', slots: ['text', 'text', 'text'] },
  { id: 'textCards', name: '文本卡片', group: 'text', slots: ['text', 'text', 'text'] },
  { id: 'quoteCards', name: '引言和文本卡片', group: 'text', slots: ['text', 'text', 'text', 'text'] },
  { id: 'cardsSummary', name: '文本卡片和总结', group: 'text', slots: ['text', 'text', 'text', 'text'] },
  { id: 'gridText', name: '宫格文本', group: 'text', slots: ['text', 'text', 'text', 'text'] },
  { id: 'iconText', name: '多列图标配文', group: 'text', slots: ['text', 'text', 'text'] },
  { id: 'kpiText', name: '多列大数字配文', group: 'text', slots: ['text', 'text', 'text', 'text', 'text', 'text'] },
  { id: 'lrTexts', name: '左右版多行文本', group: 'text', slots: ['text', 'text', 'text', 'text'] },
  { id: 'twoCol', name: '左右分栏', group: 'text', slots: ['text', 'text'] },

  { id: 'twoChartV', name: '双图上下', group: 'chart', slots: ['chart', 'chart'] },
  { id: 'twoChart', name: '双图表', group: 'chart', slots: ['chart', 'chart'] },
  { id: 'threeChart', name: '三图表', group: 'chart', slots: ['chart', 'chart', 'chart'] },
  { id: 'chartText', name: '图文混排', group: 'chart', slots: ['chart', 'text'] },
  { id: 'chart', name: '单图表', group: 'chart', slots: ['chart'] },
  { id: 'table', name: '表格页', group: 'chart', slots: ['table'] },
  { id: 'chartTable', name: '图表+表格', group: 'chart', slots: ['chart', 'table'] },
  { id: 'sandbox', name: '沙盘图', group: 'chart', slots: ['sandbox'] },
  { id: 'chartCaption3', name: '多列图表配文', group: 'chart', slots: ['chart', 'text', 'chart', 'text', 'chart', 'text'] },
  { id: 'chartCards3', name: '多列图表卡片', group: 'chart', slots: ['chart', 'chart', 'chart'] },
  { id: 'textCharts', name: '左文右多图表卡片', group: 'chart', slots: ['text', 'chart', 'chart'] },
  { id: 'chartTexts', name: '左图表右多文', group: 'chart', slots: ['chart', 'text', 'text'] },
  { id: 'chartBelow', name: '上图表下多文', group: 'chart', slots: ['chart', 'text', 'text', 'text'] },
  { id: 'rowsChartText', name: '多行左图表右文', group: 'chart', slots: ['chart', 'text', 'chart', 'text'] },
  { id: 'chartsSummary', name: '图表卡片和总结', group: 'chart', slots: ['chart', 'chart', 'chart', 'text'] },
  { id: 'captionChart3', name: '多列上文下图表', group: 'chart', slots: ['text', 'chart', 'text', 'chart', 'text', 'chart'] },
  { id: 'quoteCharts', name: '引言和图表卡片', group: 'chart', slots: ['text', 'chart', 'chart', 'chart'] },
  { id: 'gridCharts', name: '宫格图表', group: 'chart', slots: ['chart', 'chart', 'chart', 'chart'] },
  { id: 'kpiChart', name: '多列大数字配图表', group: 'chart', slots: ['text', 'chart', 'text', 'chart', 'text', 'chart'] },
  { id: 'lrCharts', name: '左右版多列图表', group: 'chart', slots: ['chart', 'chart', 'chart', 'chart'] },
  { id: 'lrChartCards', name: '左右版图表卡片', group: 'chart', slots: ['chart', 'chart', 'chart'] },
]

export const LAYOUT_MAP = Object.fromEntries(LAYOUTS.map((l) => [l.id, l]))

const EN_DICT = {
  周报: 'Weekly',
  月报: 'Monthly',
  专题: 'Special Report',
  路演: 'Roadshow',
  黑色金属: 'Ferrous',
  有色金属: 'Nonferrous',
  能化: 'Energy & Chem',
  农产品: 'Agri',
  宏观策略: 'Macro Strategy',
  螺纹钢: 'Rebar',
  热卷: 'HRC',
  铁矿: 'Iron Ore',
  焦炭: 'Coke',
  焦煤: 'Coking Coal',
  沪铜: 'SHFE Copper',
  沪锌: 'SHFE Zinc',
  电解铝: 'Aluminum',
  氧化铝: 'Alumina',
  PVC: 'PVC',
  PP: 'PP',
  PE: 'PE',
  甲醇: 'Methanol',
  PTA: 'PTA',
  基差: 'Basis',
  库存: 'Inventory',
  现货: 'Spot',
  主力: 'Front Month',
  走势: 'Trend',
  对比: 'Comparison',
  监测: 'Monitor',
  观点: 'View',
  总结: 'Summary',
  目录: 'Contents',
  中辉期货有限公司: 'ZHQH Futures',
}

export function typeName(id) {
  return TYPE_NAME[id] || id || '周报'
}

export function layoutOf(id) {
  return LAYOUT_MAP[id] || LAYOUTS[0]
}

export function clone(v) {
  return JSON.parse(JSON.stringify(v))
}

export const DEFAULT_FONT = '"微软雅黑", "Microsoft YaHei", sans-serif'

export const TEXT_FONTS = [
  { id: DEFAULT_FONT, name: '默认字体' },
  { id: '"HarmonyOS Sans SC", "华为鸿蒙字体", sans-serif', name: '华为鸿蒙字体' },
  { id: '"阿里巴巴普惠体", sans-serif', name: '阿里巴巴普惠体' },
  { id: '"PingFang SC", "苹方-简", "Microsoft YaHei", sans-serif', name: '苹方（简体）' },
  { id: 'Arial, Helvetica, sans-serif', name: 'Arial' },
  { id: '"Arial Black", Gadget, sans-serif', name: 'Arial Black' },
  { id: '"Arial Narrow", Arial, sans-serif', name: 'Arial Narrow' },
  { id: '"Courier New", Courier, monospace', name: 'Courier New' },
  { id: '"Comic Sans MS", "Comic Sans", cursive', name: 'Comic Sans MS' },
  { id: 'Georgia, serif', name: 'Georgia' },
  { id: 'Impact, Charcoal, sans-serif', name: 'Impact' },
  { id: 'Tahoma, Geneva, sans-serif', name: 'Tahoma' },
  { id: '"Times New Roman", Times, serif', name: 'Times New Roman' },
  { id: 'Verdana, Geneva, sans-serif', name: 'Verdana' },
  { id: 'Calibri, Candara, Segoe, sans-serif', name: 'Calibri' },
  { id: 'Cambria, Georgia, serif', name: 'Cambria' },
  { id: 'Consolas, "Courier New", monospace', name: 'Consolas' },
  { id: 'DengXian, "Microsoft YaHei", sans-serif', name: '等线' },
  { id: 'FangSong, "STFangsong", serif', name: '仿宋' },
  { id: 'KaiTi, "STKaiti", serif', name: '楷体' },
  { id: 'SimSun, "Songti SC", serif', name: '宋体' },
  { id: 'SimHei, "Heiti SC", sans-serif', name: '黑体' },
]
export const TEXT_SIZES = [10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]

const FONT_ALIASES = {
  'Microsoft YaHei, Helvetica, sans-serif': DEFAULT_FONT,
  'Helvetica, Arial, sans-serif': 'Arial, Helvetica, sans-serif',
  'SimSun, serif': 'SimSun, "Songti SC", serif',
  'KaiTi, serif': 'KaiTi, "STKaiti", serif',
  'Arial, sans-serif': 'Arial, Helvetica, sans-serif',
}

export function resolveFontFamily(id) {
  if (!id) return DEFAULT_FONT
  if (TEXT_FONTS.some((f) => f.id === id)) return id
  return FONT_ALIASES[id] || id
}

export function filterFontOption(input, option) {
  const q = String(input || '').trim().toLowerCase()
  if (!q) return true
  const label = String(option?.label || '')
  return label.toLowerCase().includes(q)
}

export const PPT_PALETTES = [
  { id: 'official', name: '官方', colors: ['#c8102e', '#1a3a6b', '#d4a017', '#2e7d5b', '#7a5195', '#e8734a'] },
  { id: 'dashboard', name: '仪表板', colors: ['#2E74FF', '#58CAF4', '#867EEC', '#FCBC3D', '#45D0B5', '#5B7BBA'] },
  { id: 'warm', name: '暖阳', colors: ['#f2994a', '#f2c94c', '#eb5757', '#bb6bd9', '#56ccf2', '#6fcf97'] },
  { id: 'forest', name: '森林', colors: ['#27ae60', '#6fcf97', '#219653', '#9ccc65', '#2f6bff', '#00acc1'] },
  { id: 'violet', name: '紫调', colors: ['#7b61ff', '#9b51e0', '#c47ef0', '#5ec8f2', '#f2994a', '#4ecf9f'] },
  { id: 'custom', name: '自定义', colors: ['#1664ff', '#14c9c9', '#f7ba1e', '#f53f3f', '#722ed1', '#00b42a'] },
]

export function defaultPptStyle() {
  return {
    mode: 'light',
    paletteId: 'official',
    customColors: ['#1664ff', '#14c9c9', '#f7ba1e', '#f53f3f', '#722ed1', '#00b42a'],
    gradient: true,
    semantic: { up: '#e34d59', mid: '#fa8c16', down: '#12b76a' },
    font: DEFAULT_FONT,
    titleFont: DEFAULT_FONT,
    radius: 'sm',
    spacing: 'normal',
    showTitle: true,
    showFooter: true,
    showFootnote: true,
    footnote: '',
    margin: 'normal',
    titleSize: 24,
    titleColor: '#333333',
    titleBold: true,
    titleItalic: false,
    titleAlign: 'left',
    bodySize: 16,
    bodyColor: '#333333',
    bodyBold: false,
    bodyItalic: false,
    capSize: 12,
    bodyBg: '',
  }
}

export function normalizePptStyle(raw) {
  const d = defaultPptStyle()
  if (!raw || typeof raw !== 'object') return d
  const palOk = PPT_PALETTES.some((p) => p.id === raw.paletteId)
  const custom = Array.isArray(raw.customColors)
    ? d.customColors.map((c, i) => raw.customColors[i] || c)
    : d.customColors
  return {
    ...d,
    ...raw,
    paletteId: palOk ? raw.paletteId : d.paletteId,
    customColors: custom,
    semantic: { ...d.semantic, ...(raw.semantic || {}) },
    mode: 'light',
    radius: ['none', 'sm', 'lg'].includes(raw.radius) ? raw.radius : 'sm',
    spacing: ['compact', 'normal', 'loose'].includes(raw.spacing) ? raw.spacing : 'normal',
    margin: ['compact', 'normal', 'loose'].includes(raw.margin) ? raw.margin : 'normal',
    titleAlign: ['left', 'center', 'right'].includes(raw.titleAlign) ? raw.titleAlign : 'left',
    showTitle: raw.showTitle !== false,
    showFooter: raw.showFooter !== false,
    showFootnote: raw.showFootnote !== false,
    footnote: typeof raw.footnote === 'string' ? raw.footnote : d.footnote,
    gradient: !!raw.gradient,
    titleBold: !!raw.titleBold,
    titleItalic: !!raw.titleItalic,
    bodyBold: !!raw.bodyBold,
    bodyItalic: !!raw.bodyItalic,
    titleSize: Number(raw.titleSize) || d.titleSize,
    bodySize: Number(raw.bodySize) || d.bodySize,
    capSize: Number(raw.capSize) || d.capSize,
    font: resolveFontFamily(raw.font || d.font),
    titleFont: resolveFontFamily(raw.titleFont || raw.font || d.titleFont),
    titleColor: raw.titleColor || d.titleColor,
    bodyColor: raw.bodyColor || d.bodyColor,
    bodyBg: raw.bodyBg || '',
  }
}

export function pptPalette(style) {
  const s = normalizePptStyle(style)
  if (s.paletteId === 'custom') return s.customColors
  return (PPT_PALETTES.find((p) => p.id === s.paletteId) || PPT_PALETTES[0]).colors
}

export function pptStyleVars(style) {
  const s = normalizePptStyle(style)
  const rad = s.radius === 'none' ? '0px' : s.radius === 'lg' ? '12px' : '6px'
  const gap = s.spacing === 'compact' ? '6px' : s.spacing === 'loose' ? '16px' : '10px'
  const pad = s.margin === 'compact' ? '8px 14px 18px' : s.margin === 'loose' ? '10px 36px 36px' : '4px 20px 28px'
  const autoBody = s.mode === 'dark' && (!s.bodyColor || s.bodyColor === '#333333') ? '#e8eaed' : s.bodyColor
  const autoBg = s.bodyBg || (s.mode === 'dark' ? '#1a1f2c' : 'transparent')
  return {
    '--ppt-font': s.font,
    '--ppt-title-font': s.titleFont || s.font,
    '--ppt-title-size': `${s.titleSize}px`,
    '--ppt-title-color': s.titleColor,
    '--ppt-title-weight': s.titleBold ? '700' : '600',
    '--ppt-title-style': s.titleItalic ? 'italic' : 'normal',
    '--ppt-title-align': s.titleAlign,
    '--ppt-body-size': `${s.bodySize}px`,
    '--ppt-body-color': autoBody,
    '--ppt-body-weight': s.bodyBold ? '700' : '400',
    '--ppt-body-style': s.bodyItalic ? 'italic' : 'normal',
    '--ppt-cap-size': `${s.capSize}px`,
    '--ppt-radius': rad,
    '--ppt-gap': gap,
    '--ppt-pad': pad,
    '--ppt-body-bg': autoBg,
    '--ppt-up': s.semantic.up,
    '--ppt-mid': s.semantic.mid,
    '--ppt-down': s.semantic.down,
  }
}

export function plainNote(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeFootText(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function chartFootnoteHtml(block, style) {
  const s = normalizePptStyle(style)
  if (!s.showFootnote) return ''
  const own = block?.builderState
  if (own?.footnoteOn && plainNote(own.footnote)) return own.footnote
  const global = s.footnote
  if (!plainNote(global)) return ''
  if (/<[a-z][\s\S]*>/i.test(global)) return global
  return escapeFootText(global)
}

export function emptyText(text = '') {
  return {
    type: 'text',
    text,
  }
}

export function textLook(b = {}, style) {
  const s = normalizePptStyle(style)
  const custom = !!b._customLook
  return {
    fontFamily: resolveFontFamily(custom && b.fontFamily ? b.fontFamily : s.font),
    fontSize: custom && b.fontSize ? Number(b.fontSize) : s.bodySize,
    color: custom && b.color ? b.color : ((s.mode === 'dark' && s.bodyColor === '#333333') ? '#e8eaed' : s.bodyColor),
    fontWeight: (custom ? !!b.bold : s.bodyBold) ? '700' : '400',
    fontStyle: (custom ? !!b.italic : s.bodyItalic) ? 'italic' : 'normal',
  }
}

export function emptyChart() {
  return { type: 'chart', chartId: '', title: '', builderState: null }
}

export function emptyTable() {
  return { type: 'table', tableId: '', title: '', preview: [] }
}

export function emptySandbox(seed = 1) {
  return { type: 'sandbox', title: '品种沙盘', cells: makeSandboxCells(seed) }
}

export function emptyContent() {
  return { type: 'content' }
}

export function slotAccepts(slot, blockType) {
  if (slot === 'content') return true
  return slot === blockType
}

export function isBlockFilled(b) {
  if (!b) return false
  if (b.type === 'chart') return !!b.builderState
  if (b.type === 'table') return !!b.preview?.length
  if (b.type === 'text') return !!plainNote(b.text)
  if (b.type === 'sandbox') return !!b.cells?.length
  return false
}

export function makeSandboxCells(seed = 1) {
  const names = ['螺纹', '热卷', '铁矿', '焦炭', 'PVC', 'PP', '甲醇', 'PTA', '沪铜', '电解铝', '沪锌', '镍']
  return names.map((name, i) => {
    const n = ((seed * 17 + i * 53) % 21) - 10
    return { name, chg: Number((n / 10).toFixed(2)) }
  })
}

export function blocksForLayout(layoutId, prev = []) {
  const slots = layoutOf(layoutId).slots || []
  return slots.map((slot, i) => {
    const old = prev[i]
    if (slot === 'content' && old && old.type !== 'content' && isBlockFilled(old)) return old
    if (old && old.type === slot) return old
    if (slot === 'chart') return emptyChart()
    if (slot === 'table') return emptyTable()
    if (slot === 'sandbox') return emptySandbox(hashStr(layoutId + i))
    if (slot === 'content') return emptyContent()
    return emptyText(old?.text || '')
  })
}

/** Cover overlay fonts/positions are authored against this 16:9 design size. */
export const COVER_DESIGN_W = 1920
export const COVER_DESIGN_H = 1080

export function htmlFontsToEm(html, base = 16) {
  const b = Number(base) || 16
  return String(html || '').replace(/font-size:\s*([\d.]+)px/gi, (_, n) => {
    const em = Number(n) / b
    return `font-size:${Number.isFinite(em) && em > 0 ? em.toFixed(4) : 1}em`
  })
}

export function coverTextStyle(t = {}) {
  return {
    left: `${t.x}%`,
    top: `${t.y}%`,
    width: `${t.w}%`,
    height: `${t.h}%`,
    color: t.color || '#fff',
    fontSize: `${t.fontSize || 88}px`,
    fontFamily: resolveFontFamily(t.fontFamily),
    textAlign: t.align || 'left',
    fontWeight: t.bold ? '700' : '400',
    fontStyle: t.italic ? 'italic' : 'normal',
    textDecoration: [t.underline ? 'underline' : '', t.strike ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
  }
}

export function emptyCoverText(x, y, dark = false, template = 'city') {
  const city = template === 'city'
  return {
    id: uid('CT'),
    html: '',
    x: x == null ? (city ? 11.2 : 28) : x,
    y: y == null ? (city ? 32.4 : 36) : y,
    w: city ? 78 : 44,
    h: city ? 14 : 18,
    color: dark ? '#1d2129' : '#ffffff',
    fontSize: city ? 88 : 32,
    fontFamily: DEFAULT_FONT,
    align: 'left',
    bold: !!city,
    italic: false,
    underline: false,
    strike: false,
  }
}

export function makeCoverSlide(cover = {}, template = 'city') {
  return {
    id: uid('S'),
    kind: 'cover',
    layout: '',
    pageNo: 0,
    title: cover.title || '',
    blocks: [],
    shapes: [],
    layoutMode: 'tile',
    cover: {
      title: cover.title || '未命名PPT',
      subtitle: cover.subtitle || '',
      org: cover.org || '中辉期货有限公司',
      date: cover.date || '',
      author: cover.author || '',
      extra: cover.extra || '',
      template,
      texts: cover.texts ? clone(cover.texts) : [],
    },
  }
}

export function makeContentSlide(layoutId = 'chartText', extras = {}) {
  const layout = layoutOf(layoutId)
  return {
    id: uid('S'),
    kind: 'content',
    layout: layout.id,
    pageNo: extras.pageNo || 0,
    title: extras.title != null ? extras.title : '',
    blocks: extras.blocks || blocksForLayout(layout.id),
    shapes: extras.shapes || [],
    layoutMode: extras.layoutMode || 'tile',
  }
}

export function defaultCover(title, typeId = 'weekly') {
  return {
    title,
    subtitle: typeName(typeId),
    org: '中辉期货有限公司',
    date: '',
    author: '',
    extra: '内部资料 · 仅供参考',
    template: 'city',
    texts: [],
  }
}

export function defaultSlides(title, typeId) {
  const cover = defaultCover(title, typeId)
  return [
    makeCoverSlide(cover, cover.template),
    makeContentSlide('chartText', {
      pageNo: 1,
      title: '',
      blocks: [emptyChart(), emptyText('')],
    }),
    makeContentSlide('sandbox', {
      pageNo: 2,
      title: '品种沙盘',
      blocks: [emptySandbox(hashStr(title || 'sand'))],
    }),
  ]
}

export function chartPaintSpec(chartLike, style) {
  if (!chartLike) return null
  const st = mergeBuilderState(chartLike.builderState || {}, {
    title: chartLike.title,
    series: chartLike.builderState?.series || [],
  })
  if (!st.type) st.type = chartLike.type || 'line'
  if (!st.unit) st.unit = chartLike.unit || ''
  const spec = {
    ...toPaintSpec(st, st.series || [], monthLabels(36)),
    customLegend: true,
    tooltipShow: false,
    listPreview: true,
    disableTooltip: true,
  }
  if (!style) return spec
  const s = normalizePptStyle(style)
  spec.gradient = s.gradient
  const colors = pptPalette(s)
  spec.series = (spec.series || []).map((ser, i) => ({
    ...ser,
    color: colors[i % colors.length],
  }))
  return spec
}

export function snapshotChart(chart) {
  if (!chart) return emptyChart()
  return {
    type: 'chart',
    chartId: chart.id || '',
    title: chart.title || '',
    typeName: chart.type || chart.builderState?.type || 'line',
    builderState: clone(chart.builderState || null),
  }
}

export function snapshotTable(table, preview) {
  if (!table) return emptyTable()
  return {
    type: 'table',
    tableId: table.id || '',
    title: table.title || '',
    preview: preview || [],
  }
}

export function zhToEn(text) {
  let s = String(text || '')
  Object.keys(EN_DICT).sort((a, b) => b.length - a.length).forEach((k) => {
    s = s.split(k).join(EN_DICT[k])
  })
  return s
}

export function translateChartState(builderState, title) {
  const st = clone(builderState || {})
  if (st.title) st.title = zhToEn(st.title)
  ;(st.series || []).forEach((s) => {
    if (s.name) s.name = zhToEn(s.name)
    if (s.alias) s.alias = zhToEn(s.alias)
  })
  return { title: zhToEn(title || st.title || ''), builderState: st }
}

export function translatePpt(ppt, destDir) {
  const next = clone(ppt)
  next.id = uid('P')
  next.style = normalizePptStyle(ppt.style)
  next.lang = 'en'
  next.dir = destDir
  next.title = zhToEn(ppt.title)
  next.published = false
  next.reportId = ''
  next.shares = []
  next.shareSide = ''
  next.scope = 'mine'
  next.sourceId = ppt.id
  next.slides = (ppt.slides || []).map((slide) => {
    const s = clone(slide)
    s.id = uid('S')
    if (s.kind === 'cover' && s.cover) {
      s.cover.title = zhToEn(s.cover.title)
      s.cover.subtitle = zhToEn(s.cover.subtitle)
      s.cover.org = zhToEn(s.cover.org)
      s.cover.extra = zhToEn(s.cover.extra)
      s.title = s.cover.title
    } else {
      s.title = zhToEn(s.title)
    }
    s.blocks = (s.blocks || []).map((b) => {
      if (b.type === 'text') return { ...b, text: zhToEn(b.text) }
      if (b.type === 'chart') {
        const tr = translateChartState(b.builderState, b.title)
        return { ...b, title: tr.title, builderState: tr.builderState }
      }
      if (b.type === 'table') return { ...b, title: zhToEn(b.title) }
      if (b.type === 'sandbox') {
        return {
          ...b,
          title: zhToEn(b.title),
          cells: (b.cells || []).map((c) => ({ ...c, name: zhToEn(c.name) })),
        }
      }
      return b
    })
    return s
  })
  if (next.cover) {
    next.cover = {
      ...next.cover,
      title: zhToEn(next.cover.title),
      subtitle: zhToEn(next.cover.subtitle),
      org: zhToEn(next.cover.org),
      extra: zhToEn(next.cover.extra),
    }
  }
  return next
}

export function enDirName(name) {
  const n = String(name || '').replace(/（EN）$/, '').trim()
  return n ? `${n}（EN）` : '英文PPT'
}

export function slidePageLabel(slide, index) {
  if (slide?.kind === 'cover') return '封面'
  const n = slide?.pageNo || index
  return `第 ${n} 页`
}

export function contentSlides(ppt) {
  return (ppt?.slides || []).filter((s) => s.kind !== 'cover')
}
