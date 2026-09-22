export const CHART_TYPES = [
  { id: 'line', name: '线图', group: '线/面图', icon: 'chart-line' },
  { id: 'seasonal', name: '季节性图', group: '线/面图', icon: 'chart-seasonal' },
  { id: 'area', name: '面积图', group: '线/面图', icon: 'chart-line-2' },
  { id: 'stackArea', name: '堆叠面积', group: '线/面图', icon: 'chart-stack-area' },
  { id: 'stackAreaPercent', name: '百分比堆积', group: '线/面图', icon: 'chart-stack-pct' },
  { id: 'bar', name: '柱图', group: '柱/条形', icon: 'chart-bar' },
  { id: 'stackCol', name: '堆叠柱图', group: '柱/条形', icon: 'chart-stack-col' },
  { id: 'stackColPercent', name: '百分比堆积柱', group: '柱/条形', icon: 'chart-stack-col-pct' },
  { id: 'hbar', name: '条形图', group: '柱/条形', icon: 'chart-hbar' },
  { id: 'crossBar', name: '截面柱形图', group: '柱/条形', icon: 'chart-cross-bar' },
  { id: 'pie', name: '饼图', group: '占比', icon: 'chart-pie' },
  { id: 'scatter', name: '散点图', group: '分布', icon: 'chart-scatter' },
  { id: 'timeScatter', name: '时序散点图', group: '分布', icon: 'chart-time-scatter' },
  { id: 'crossScatter', name: '截面散点图', group: '分布', icon: 'chart-cross-scatter' },
  { id: 'combo', name: '线柱混合', group: '组合', icon: 'chart-combo' },
]

export const CT_GROUP_ORDER = ['线/面图', '柱/条形', '占比', '分布', '组合']

export const LINE_FAMILY = ['line', 'area', 'stackArea', 'stackAreaPercent', 'combo']
export const BAR_FAMILY = ['bar', 'stackCol', 'stackColPercent', 'hbar']
export const COL_FAMILY = ['bar', 'stackCol', 'stackColPercent']

export const PLOT_VIS_TYPES = [
  { id: 'line', title: '线图', icon: 'vis-line' },
  { id: 'area', title: '面积图', icon: 'vis-area' },
  { id: 'stackArea', title: '堆积面积', icon: 'vis-stack-area' },
  { id: 'stackAreaPercent', title: '百分比堆积', icon: 'vis-stack-pct' },
]

export const BAR_VIS_TYPES = [
  { id: 'bar', title: '柱图', icon: 'vis-bar' },
  { id: 'stackCol', title: '堆积柱图', icon: 'vis-stack-col' },
  { id: 'stackColPercent', title: '百分比堆积', icon: 'vis-stack-col-pct' },
]

export const DASH_STYLES = [
  { id: 'solid', css: 'solid' },
  { id: 'dot', css: 'dotted' },
  { id: 'dash', css: 'dashed' },
]

export const MARKER_SHAPES = [
  { id: 'circle', g2: 'point', hollow: false },
  { id: 'circleHollow', g2: 'point', hollow: true },
  { id: 'diamond', g2: 'diamond', hollow: false },
  { id: 'diamondHollow', g2: 'diamond', hollow: true },
  { id: 'triangle', g2: 'triangle', hollow: false },
  { id: 'triangleHollow', g2: 'triangle', hollow: true },
  { id: 'square', g2: 'square', hollow: false },
  { id: 'squareHollow', g2: 'square', hollow: true },
]

export const FONT_SIZES = Array.from({ length: 19 }, (_, i) => i + 10)

export function typeName(id) {
  return CHART_TYPES.find((t) => t.id === id)?.name || id || '线图'
}

export function isSeasonal(t) { return t === 'seasonal' }
export function isPie(t) { return t === 'pie' }
export function isHbar(t) { return t === 'hbar' }
export function isCrossBar(t) { return t === 'crossBar' }
export function isCrossScatter(t) { return t === 'crossScatter' }
export function isTimeScatter(t) { return t === 'timeScatter' }
export function isScatter(t) { return t === 'scatter' || t === 'timeScatter' || t === 'crossScatter' }
export function isArea(t) { return t === 'area' || t === 'stackArea' || t === 'stackAreaPercent' }
export function isLineFamily(t) { return LINE_FAMILY.includes(t) }
export function isColFamily(t) { return COL_FAMILY.includes(t) }
export function isBarFamily(t) { return ['bar', 'stackCol', 'stackColPercent', 'hbar', 'crossBar'].includes(t) }
export function isStack(t) { return ['stackCol', 'stackColPercent', 'stackArea', 'stackAreaPercent'].includes(t) }
export function isPercent(t) { return t === 'stackColPercent' || t === 'stackAreaPercent' }
export function isCrossSection(t) { return t === 'crossBar' || t === 'crossScatter' }
export function usesCrossSectionTime(t) { return t === 'crossBar' || t === 'pie' }
export function usesViewCtrl(t) { return LINE_FAMILY.includes(t) }
export function showLinePlot(t) { return LINE_FAMILY.includes(t) || t === 'seasonal' }
export function showDualAxis(t) {
  return !isBarFamily(t) && !isPie(t) && !isSeasonal(t) && !isCrossSection(t)
}

function axisX() {
  return {
    show: true,
    showTitle: false,
    title: '',
    unit: '',
    titleColor: '#666666',
    titleSize: 11,
    titleBold: false,
    titleItalic: false,
    showLabels: true,
    labelRule: 'smart',
    labelContent: 'time',
    labelColor: '#666666',
    labelSize: 11,
    labelBold: false,
    labelItalic: false,
    ticks: false,
    line: false,
    lineColor: '#c4c8cf',
    lineWidth: 1,
    lineDash: 'solid',
    grid: false,
    gridColor: '#f0f1f4',
    gridWidth: 1,
    gridDash: 'solid',
    zero: true,
    zeroColor: '#c4c8cf',
    zeroWidth: 1,
    zeroDash: 'solid',
  }
}

function axisY() {
  return {
    show: true,
    reversed: false,
    showTitle: false,
    title: '',
    unit: '',
    titlePos: 'top',
    titleColor: '#333333',
    titleSize: 11,
    titleBold: false,
    titleItalic: false,
    showLabels: true,
    labelFmt: 'auto',
    labelColor: '#333333',
    labelSize: 11,
    labelBold: false,
    labelItalic: false,
    ticks: false,
    line: false,
    lineColor: '#c4c8cf',
    lineWidth: 1,
    lineDash: 'solid',
    grid: false,
    gridColor: '#f0f1f4',
    gridWidth: 1,
    gridDash: 'solid',
    minAuto: true,
    maxAuto: true,
    minV: null,
    maxV: null,
    customTick: false,
    tickMode: 'step',
    tickStep: null,
    tickCount: 5,
  }
}

export function defaultAxis() {
  return { x: axisX(), yL: axisY(), yR: axisY() }
}

export function defaultSeriesStyle() {
  return {
    dash: '',
    lineWidth: null,
    marker: null,
    markerShape: '',
    labelShow: false,
    labelPos: 'auto',
    labelColor: '#333333',
    labelSize: 12,
    labelBold: false,
    labelItalic: false,
    minMaxShow: false,
    minMaxPos: 'auto',
    minMaxMax: true,
    minMaxMin: true,
    minMaxFill: '#2e74ff',
    minMaxColor: '#ffffff',
    minMaxSize: 12,
    minMaxBold: false,
    minMaxItalic: false,
    barStroke: '',
    barStrokeWidth: 0,
    axisMode: 'default',
    alias: '',
    desc: '',
    cond: null,
    fmt: null,
    nullDisplay: 'blank',
    sort: 'none',
    mark: null,
  }
}

export function defaultCrossPoint(partial = {}) {
  return { type: 'relative', unit: 'day', op: '-', offset: 0, base: '', date: '', ...partial }
}
export function defaultCrossBarState() {
  return {
    filter: 'day',
    rangeKind: 'span',
    day: defaultCrossPoint(),
    start: defaultCrossPoint(),
    end: defaultCrossPoint(),
  }
}
export function defaultCrossAxis() {
  return { mode: 'latest', ago: 1, fixed: '' }
}

function pad2(n) { return String(n).padStart(2, '0') }
export function monthStartYmd(ym) { return `${String(ym || '2019-01').slice(0, 7)}-01` }
export function monthEndYmd(ym) {
  const [y, m] = String(ym || '2026-07').slice(0, 7).split('-').map(Number)
  if (!y || !m) return '2026-07-31'
  const d = new Date(y, m, 0)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
export function latestYmd(labels = []) {
  return monthEndYmd(labels[labels.length - 1] || '2026-07')
}
function parseYmd(s) {
  const p = String(s || '').split('-')
  return new Date(+p[0] || 2026, (+p[1] || 1) - 1, +p[2] || 1)
}
function fmtYmd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function clampYmd(ymd, labels) {
  const min = monthStartYmd(labels[0] || '2019-01')
  const max = monthEndYmd(labels[labels.length - 1] || '2026-07')
  if (ymd < min) return min
  if (ymd > max) return max
  return ymd
}
function addMonthsSafe(dt, n) {
  const day = dt.getDate()
  const x = new Date(dt.getFullYear(), dt.getMonth() + (+n || 0), 1)
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
  x.setDate(Math.min(day, last))
  return x
}
export function applyRelativeOffset(baseYmd, unit, op, offset, labels) {
  const d = parseYmd(baseYmd)
  const n = Math.max(0, Math.round(+offset || 0))
  const sign = op === '+' ? 1 : -1
  let next = d
  if (unit === 'year') next = addMonthsSafe(d, sign * n * 12)
  else if (unit === 'month') next = addMonthsSafe(d, sign * n)
  else next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + sign * n)
  return clampYmd(fmtYmd(next), labels)
}
export function monthIdxFromYmd(ymd, labels) {
  const key = String(ymd).slice(0, 7)
  const fi = labels.indexOf(key)
  if (fi >= 0) return fi
  const dt = parseYmd(ymd)
  let best = 0
  let bestDiff = Infinity
  labels.forEach((lab, i) => {
    const [y, m] = String(lab).split('-').map(Number)
    const mid = new Date(y, (m || 1) - 1, 15)
    const diff = Math.abs(+mid - +dt)
    if (diff < bestDiff) { bestDiff = diff; best = i }
  })
  return best
}
export function resolveCrossPointYmd(point, labels, fallback) {
  const p = { ...defaultCrossPoint(), ...point }
  const latest = fallback || latestYmd(labels)
  if (p.type === 'precise') return clampYmd(p.date || latest, labels)
  return applyRelativeOffset(p.base || p.date || latest, p.unit, p.op, p.offset, labels)
}
export function resolveCrossBarRange(crossBar, labels = []) {
  const cfg = {
    ...defaultCrossBarState(),
    ...crossBar,
    day: { ...defaultCrossPoint(), ...crossBar?.day },
    start: { ...defaultCrossPoint(), ...crossBar?.start },
    end: { ...defaultCrossPoint(), ...crossBar?.end },
  }
  const latest = latestYmd(labels)
  const dataStart = monthStartYmd(labels[0] || '2019-01')
  if (cfg.filter === 'range') {
    const kind = cfg.rangeKind === 'start' || cfg.rangeKind === 'end' ? cfg.rangeKind : 'span'
    let sYmd
    let eYmd
    if (kind === 'start') {
      sYmd = resolveCrossPointYmd(cfg.start, labels, dataStart)
      eYmd = latest
    } else if (kind === 'end') {
      sYmd = dataStart
      eYmd = resolveCrossPointYmd(cfg.end, labels, latest)
    } else {
      sYmd = resolveCrossPointYmd(cfg.start, labels, dataStart)
      eYmd = resolveCrossPointYmd(cfg.end, labels, latest)
    }
    if (sYmd > eYmd) { const t = sYmd; sYmd = eYmd; eYmd = t }
    return {
      filter: 'range', rangeKind: kind, sYmd, eYmd,
      sIdx: monthIdxFromYmd(sYmd, labels),
      eIdx: monthIdxFromYmd(eYmd, labels),
      time: `${sYmd} 至 ${eYmd}`,
    }
  }
  const ymd = resolveCrossPointYmd(cfg.day, labels, latest)
  const idx = monthIdxFromYmd(ymd, labels)
  return { filter: 'day', sYmd: ymd, eYmd: ymd, sIdx: idx, eIdx: idx, time: ymd }
}
export function crossBarTimeLabel(crossBar, labels = []) {
  const r = resolveCrossBarRange(crossBar, labels)
  if (r.filter === 'range') {
    if (r.rangeKind === 'start') return `开始于 ${r.sYmd} → ${r.eYmd}`
    if (r.rangeKind === 'end') return `结束于 ${r.eYmd}（自 ${r.sYmd}）`
    return `区间 ${r.time}`
  }
  const p = { ...defaultCrossPoint(), ...crossBar?.day }
  if (p.type === 'precise') return `精确 ${r.eYmd}`
  const unitLab = p.unit === 'year' ? '年' : p.unit === 'month' ? '月' : '日'
  if (+p.offset === 0) return `相对 ${r.eYmd}（基准）`
  return `相对 ${p.op}${p.offset}${unitLab} → ${r.eYmd}`
}
export function resolveCrossTimeIdx(cfg, labels = []) {
  const last = Math.max(0, labels.length - 1)
  const c = { mode: 'latest', ago: 1, fixed: '', ...cfg }
  if (c.mode === 'fixed' && c.fixed) {
    const key = String(c.fixed).slice(0, 7)
    const fi = labels.findIndex((l) => l === key || l.startsWith(key))
    return fi >= 0 ? fi : last
  }
  if (c.mode === 'ago') return Math.max(0, last - Math.max(1, Number(c.ago) || 1))
  return last
}
export function crossTimeLabel(cfg, labels = []) {
  const idx = resolveCrossTimeIdx(cfg, labels)
  const lab = labels[idx] || '—'
  if (cfg?.mode === 'latest') return `最新 ${lab}`
  if (cfg?.mode === 'ago') return `${cfg.ago || 1} 期前 ${lab}`
  return `固定 ${lab}`
}
export function sectionValue(values, range) {
  if (!values) return null
  if (range.filter === 'range') {
    let sum = 0
    let hit = 0
    for (let i = range.sIdx; i <= range.eIdx; i++) {
      const v = Number(values[i])
      if (Number.isFinite(v)) { sum += v; hit++ }
    }
    return hit ? sum : null
  }
  const v = Number(values[range.eIdx])
  return Number.isFinite(v) ? v : null
}

export function defaultBuilderState(partial = {}) {
  return {
    type: 'line',
    title: '未命名图表',
    unit: '',
    dual: false,
    dualSync: 'count',
    axisShow: true,
    ax: defaultAxis(),
    lineType: 'curve',
    dash: 'solid',
    width: 3,
    marker: false,
    markerShape: 'circle',
    nullMode: 'cross',
    fillOpacity: 100,
    barWidth: 55,
    barRadius: null,
    barStyleApplied: false,
    pieStyle: 'pie',
    pieRadius: 92,
    pieMergeOthers: false,
    pieMergeCount: null,
    pieOthersName: '其他',
    pieOthersColor: '',
    pieTotalShow: false,
    pieTotalName: '',
    pieTotalNameColor: '#86909C',
    pieTotalNameSize: 12,
    pieTotalNameBold: false,
    pieTotalNameItalic: false,
    pieTotalValueColor: '#1D2129',
    pieTotalValueSize: 20,
    pieTotalValueBold: true,
    pieTotalValueItalic: false,
    gradient: false,
    tooltipShow: true,
    tooltipShare: true,
    tooltipShareDecimals: 2,
    tooltipBg: '#ffffff',
    tooltipColor: '#333333',
    tooltipSize: 12,
    tooltipBold: false,
    tooltipItalic: false,
    legendShow: true,
    legendPos: 'top',
    legendAlign: 'flex-start',
    legendStyle: 'auto',
    legendItems: null,
    legendColor: '#333333',
    legendSize: 12,
    legendBold: false,
    legendItalic: false,
    labelShow: false,
    labelPos: 'upLine',
    labelFull: true,
    labelOverlap: false,
    labelColor: '#333333',
    labelSize: 12,
    labelBold: false,
    labelItalic: false,
    titleShow: true,
    titleAlign: 'left',
    titleColor: '#333333',
    titleSize: 16,
    titleBold: false,
    titleItalic: false,
    divider: false,
    dividerColor: '#e3e6eb',
    dividerWidth: 1,
    remark: '',
    remarkOn: false,
    remarkPos: 'afterTitle',
    footnote: '',
    footnoteOn: false,
    tableShow: true,
    viewCtrlShow: false,
    viewCtrlType: 'scrollbar',
    viewCtrlMinWidth: 32,
    dimTimeFormat: 'auto',
    dimSort: 'asc',
    dimNullDisplay: 'blank',
    dimLabelMode: 'nameFmt',
    paletteIdx: 0,
    series: [],
    dateFrom: '2019-01',
    dateTo: '2026-07',
    datePreset: 'history',
    analysis: { markLine: '', markArea: '' },
    cross: { x: defaultCrossAxis(), y: defaultCrossAxis() },
    crossBar: defaultCrossBarState(),
    ...partial,
  }
}

export function mergeBuilderState(saved = {}, extras = {}) {
  const base = defaultBuilderState()
  const next = {
    ...base,
    ...saved,
    ...extras,
    ax: {
      x: { ...base.ax.x, ...(saved.ax?.x || {}) },
      yL: { ...base.ax.yL, ...(saved.ax?.yL || {}) },
      yR: { ...base.ax.yR, ...(saved.ax?.yR || {}) },
    },
    analysis: { ...base.analysis, ...(saved.analysis || {}) },
    cross: {
      x: { ...base.cross.x, ...(saved.cross?.x || {}) },
      y: { ...base.cross.y, ...(saved.cross?.y || {}) },
    },
    crossBar: {
      ...base.crossBar,
      ...(saved.crossBar || {}),
      day: { ...base.crossBar.day, ...(saved.crossBar?.day || {}) },
      start: { ...base.crossBar.start, ...(saved.crossBar?.start || {}) },
      end: { ...base.crossBar.end, ...(saved.crossBar?.end || {}) },
    },
    series: Array.isArray(saved.series) ? saved.series.map((s) => ({ ...defaultSeriesStyle(), ...s })) : [],
  }
  if (extras.title) next.title = extras.title
  if (extras.series) next.series = extras.series
  return next
}

export function toPaintSpec(state, series, labels) {
  return {
    type: state.type,
    series,
    labels,
    unit: state.unit,
    dual: state.dual,
    dualSync: state.dualSync,
    axisShow: state.axisShow,
    ax: state.ax,
    lineType: state.lineType,
    dash: state.dash,
    width: state.width,
    marker: state.marker,
    markerShape: state.markerShape,
    nullMode: state.nullMode,
    fillOpacity: state.fillOpacity,
    barWidth: state.barWidth,
    barRadius: state.barRadius,
    pieStyle: state.pieStyle,
    pieRadius: state.pieRadius,
    pieMergeOthers: state.pieMergeOthers,
    pieMergeCount: state.pieMergeCount,
    pieOthersName: state.pieOthersName,
    pieOthersColor: state.pieOthersColor,
    gradient: state.gradient,
    tooltipShow: state.tooltipShow,
    tooltipShare: state.tooltipShare,
    tooltipShareDecimals: state.tooltipShareDecimals,
    tooltipBg: state.tooltipBg,
    tooltipColor: state.tooltipColor,
    tooltipSize: state.tooltipSize,
    tooltipBold: state.tooltipBold,
    tooltipItalic: state.tooltipItalic,
    customLegend: true,
    labelShow: state.labelShow,
    labelPos: state.labelPos,
    labelFull: state.labelFull,
    labelOverlap: state.labelOverlap,
    labelColor: state.labelColor,
    labelSize: state.labelSize,
    labelBold: state.labelBold,
    labelItalic: state.labelItalic,
    markLine: state.analysis?.markLine,
    viewCtrlShow: state.viewCtrlShow,
    viewCtrlType: state.viewCtrlType,
    viewCtrlMinWidth: state.viewCtrlMinWidth,
    dimTimeFormat: state.dimTimeFormat,
    dimSort: state.dimSort,
    dimNullDisplay: state.dimNullDisplay,
    crossBar: state.crossBar,
    cross: state.cross,
  }
}
