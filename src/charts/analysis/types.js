export const TREND_TYPES = [
  { id: 'auto', name: '自动' },
  { id: 'linear', name: '线性' },
  { id: 'log', name: '对数' },
  { id: 'exp', name: '指数' },
  { id: 'poly', name: '多项式' },
  { id: 'power', name: '幂函数' },
]

export const GUIDE_LABELS = [
  { id: 'value', name: '显示数值' },
  { id: 'name', name: '显示名称' },
  { id: 'none', name: '不显示' },
]

export const GUIDE_TEXT_POS = [
  { id: 'left', name: '居左' },
  { id: 'center', name: '居中' },
  { id: 'right', name: '居右' },
]

export function warnUid() {
  return Date.now() + Math.round(Math.random() * 1000)
}

export function nextWarnName(prefix, list = []) {
  let n = 0
  list.forEach((it) => {
    const m = String(it.name || '').match(new RegExp(`^${prefix}(\\d+)$`))
    if (m) n = Math.max(n, +m[1])
  })
  return `${prefix}${n + 1}`
}

export function defaultDateTransforms() {
  return [
    { type: 'freq', scope: 'month', anchor: 'first' },
    { type: 'offset', unit: 'day', n: -1 },
  ]
}

function cloneTransforms(arr, legacy) {
  if (Array.isArray(arr) && arr.length) {
    return arr.map((t) => ({ ...t }))
  }
  if (Array.isArray(legacy) && legacy.length) {
    return legacy.map((n) => ({ type: 'offset', unit: 'month', n: +n || 0 }))
  }
  return []
}

export const GUIDE_DEFAULTS = {
  axis: 'left',
  scaleMode: 'calc',
  mode: 'calc',
  metricSrc: 'first',
  otherMetric: '',
  timeMode: 'chart',
  startMode: 'fixed',
  startDate: '',
  startBase: 'system',
  startShift: 0,
  endMode: 'dynamic',
  endDate: '',
  endBase: 'system',
  endShift: 0,
  calcMode: 'mean',
  stdK: 1,
  quantileP: 50,
  quantileKind: 'count',
  agg: 'avg',
  value: null,
  labelMode: 'name',
  dash: 'dot',
  color: '#2e74ff',
  width: 2,
  desc: '',
  textPos: 'left',
  textColor: '#1f2329',
  textSize: 12,
}

export function defaultGuide(seriesName = '', list = []) {
  return {
    id: warnUid(),
    name: nextWarnName('辅助线', list),
    series: seriesName,
    ...GUIDE_DEFAULTS,
    dateShifts: [],
    startTransforms: defaultDateTransforms(),
    endTransforms: defaultDateTransforms(),
  }
}

export function normalizeGuide(g, seriesName = '') {
  if (!g) return defaultGuide(seriesName)
  const out = { ...GUIDE_DEFAULTS, ...g }
  if (!g.scaleMode) {
    out.scaleMode = (g.mode === 'fixed' || g.type === 'fixed') ? 'fixed' : 'calc'
  }
  out.mode = out.scaleMode === 'fixed' ? 'fixed' : 'calc'
  out.id = g.id || warnUid()
  out.name = g.name || '辅助线1'
  out.series = g.series || seriesName
  out.dateShifts = Array.isArray(g.dateShifts) ? g.dateShifts.slice() : []
  out.startBase = g.startBase || g.baseDate || 'system'
  out.endBase = g.endBase || g.baseDate || 'system'
  out.startShift = g.startShift != null ? +g.startShift : (+g.shift || 0)
  out.endShift = g.endShift != null ? +g.endShift : (+g.shift || 0)
  out.startTransforms = cloneTransforms(g.startTransforms)
  out.endTransforms = cloneTransforms(g.endTransforms, g.dateShifts)
  return out
}

export function defaultTrend(seriesName = '', list = []) {
  return {
    id: warnUid(),
    name: nextWarnName('趋势线', list),
    series: seriesName,
    type: 'auto',
    dash: 'dash',
    color: '#f2994a',
    forecast: 0,
  }
}

export function normalizeTrend(t, seriesName = '') {
  if (!t) return defaultTrend(seriesName)
  return {
    id: t.id || warnUid(),
    name: t.name || '趋势线1',
    series: t.series || seriesName,
    type: t.type || 'auto',
    dash: t.dash || 'dash',
    color: t.color || '#f2994a',
    forecast: Math.max(0, Math.round(+t.forecast || 0)),
  }
}

export function defaultAnnoCfg() {
  return {
    mode: 'measure',
    rangeType: 'calculated',
    measure: '',
    thresholdOp: '>=',
    thresholdVal: 'avg',
    customVal: '',
    betweenMin: '',
    betweenMax: '',
    showLabel: true,
    labelText: '',
    rangeStyle: 'fill',
    rangeColor: '#2e74ff',
    showPoint: false,
    pointColor: '',
    highlightLine: true,
    scope: 'all',
    showIcon: true,
    showNote: true,
    pointColorM: '#2e74ff',
    dimBg: '',
    icon: '',
  }
}

export function defaultAnno(list = []) {
  return {
    id: warnUid(),
    name: nextWarnName('标注', list),
    text: '拐点',
    dim: null,
    series: '',
    visible: true,
    cfg: defaultAnnoCfg(),
  }
}

export function normalizeAnno(a) {
  if (!a) return defaultAnno()
  const cfg = { ...defaultAnnoCfg(), ...(a.cfg || {}) }
  if (!a.cfg && a.dim != null) cfg.mode = 'manual'
  let dims
  if (Array.isArray(a.dims) && a.dims.length) dims = a.dims.slice()
  else if (Array.isArray(a.dim) && a.dim.length) dims = a.dim.slice()
  else if (a.dim != null && a.dim !== '') dims = [a.dim]
  return {
    id: a.id || warnUid(),
    name: a.name || '标注1',
    text: a.text || '',
    dim: dims?.length ? dims[0] : (a.dim ?? null),
    dims,
    series: a.series || '',
    visible: a.visible !== false,
    cfg,
  }
}

export function defaultAnalysis() {
  return {
    markLine: '',
    markArea: '',
    guides: [],
    trends: [],
    annos: [],
  }
}

/** Migrate legacy markLine string into guides when needed. */
export function normalizeAnalysis(raw = {}, seriesName = '') {
  const base = defaultAnalysis()
  const src = raw && typeof raw === 'object' ? raw : {}
  let guides = Array.isArray(src.guides) ? src.guides.map((g) => normalizeGuide(g, seriesName)) : []
  const trends = Array.isArray(src.trends) ? src.trends.map((t) => normalizeTrend(t, seriesName)) : []
  const annos = Array.isArray(src.annos) ? src.annos.map(normalizeAnno) : []

  const legacy = src.markLine
  if (!guides.length && legacy != null && String(legacy).trim() !== '') {
    const v = Number(legacy)
    if (Number.isFinite(v)) {
      guides = [normalizeGuide({
        ...defaultGuide(seriesName),
        scaleMode: 'fixed',
        mode: 'fixed',
        value: v,
        name: '辅助线1',
        labelMode: 'value',
        color: '#e34d59',
        dash: 'dash',
      }, seriesName)]
    }
  }

  const firstFixed = guides.find((g) => g.mode === 'fixed' && g.value != null)
  return {
    ...base,
    ...src,
    guides,
    trends,
    annos,
    markLine: firstFixed ? String(firstFixed.value) : (src.markLine ?? ''),
    markArea: src.markArea ?? '',
  }
}

export function seriesDisplayName(s) {
  if (!s) return ''
  return s.alias || String(s.name || '').split(':')[0] || s.name || ''
}

export function dashLineArr(id) {
  if (id === 'dash' || id === 'dashed') return [6, 4]
  if (id === 'dot' || id === 'dotted') return [2, 3]
  if (id === 'dashdot') return [6, 3, 2, 3]
  return undefined
}

export function isUnsetColor(c) {
  if (c == null || c === '') return true
  const s = String(c).trim().toLowerCase()
  if (s === 'transparent') return true
  const m = s.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*([\d.]+))?\s*\)/)
  if (m && m[1] != null && +m[1] === 0) return true
  return false
}
