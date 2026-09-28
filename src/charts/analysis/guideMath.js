import { normalizeGuide } from './types'

function parseYmd(s) {
  const p = String(s || '').split(/[-T/\s]/)
  const y = +p[0] || 1970
  const m = (+p[1] || 1) - 1
  const d = +p[2] || 1
  return new Date(y, m, d)
}

function fmtYmd(dt) {
  const y = dt.getFullYear()
  const m = dt.getMonth() + 1
  const d = dt.getDate()
  return `${y}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d}`
}

function addDays(dt, n) {
  const x = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
  x.setDate(x.getDate() + (+n || 0))
  return x
}

function addMonths(dt, n) {
  const day = dt.getDate()
  const x = new Date(dt.getFullYear(), dt.getMonth() + (+n || 0), 1)
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
  x.setDate(Math.min(day, last))
  return x
}

function startOfWeekMon(dt) {
  const x = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
  const w = x.getDay()
  x.setDate(x.getDate() - (w === 0 ? 6 : w - 1))
  return x
}

function applyFreqDate(dt, scope, anchor) {
  const y = dt.getFullYear()
  const m = dt.getMonth()
  if (scope === 'week') {
    const mon = startOfWeekMon(dt)
    const map = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }
    mon.setDate(mon.getDate() + (map[anchor] != null ? map[anchor] : 0))
    return mon
  }
  if (scope === 'month') {
    return anchor === 'last' ? new Date(y, m + 1, 0) : new Date(y, m, 1)
  }
  if (scope === 'quarter') {
    const q = Math.floor(m / 3) * 3
    return anchor === 'last' ? new Date(y, q + 3, 0) : new Date(y, q, 1)
  }
  if (scope === 'year') {
    return anchor === 'last' ? new Date(y, 11, 31) : new Date(y, 0, 1)
  }
  return dt
}

function applyOffsetDate(dt, n, unit) {
  n = +n || 0
  if (unit === 'month') return addMonths(dt, n)
  if (unit === 'year') return addMonths(dt, n * 12)
  return addDays(dt, n)
}

export function applyDateTransforms(dt, list) {
  let cur = dt
  ;(list || []).forEach((t) => {
    if (!t) return
    if (t.type === 'freq') cur = applyFreqDate(cur, t.scope || 'month', t.anchor || 'first')
    else if (t.type === 'offset') cur = applyOffsetDate(cur, t.n, t.unit || 'day')
  })
  return cur
}

function labelToMonthKey(label) {
  const s = String(label || '')
  const m = s.match(/^(\d{4})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}`
  return s.slice(0, 7)
}

function findLabelIdx(labels, key) {
  if (!labels?.length) return 0
  const k = labelToMonthKey(key)
  let best = -1
  for (let i = 0; i < labels.length; i++) {
    if (labelToMonthKey(labels[i]) === k) return i
    if (String(labels[i]).startsWith(k) || k.startsWith(String(labels[i]).slice(0, 7))) best = i
  }
  return best >= 0 ? best : 0
}

function guideSeries(g, seriesList) {
  const name = (g.metricSrc === 'other' && g.otherMetric) ? g.otherMetric : (g.series || '')
  const list = seriesList || []
  return list.find((s) => s.name === name) || list[0] || null
}

function seriesLatestIdx(sr) {
  const vals = sr?.values || []
  for (let i = vals.length - 1; i >= 0; i--) {
    if (vals[i] != null && Number.isFinite(+vals[i])) return i
  }
  return Math.max(0, vals.length - 1)
}

function guideBaseDate(g, side, seriesList, labels) {
  const base = (side === 'start' ? g.startBase : g.endBase) || 'system'
  const shift = Math.max(0, +((side === 'start' ? g.startShift : g.endShift) || 0))
  if (base === 'latest') {
    const sr = guideSeries(g, seriesList)
    const idx = Math.max(0, seriesLatestIdx(sr) - shift)
    const lab = labels?.[idx] || labels?.[labels.length - 1]
    return parseYmd(`${labelToMonthKey(lab)}-01`)
  }
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function resolveGuideBound(g, side, seriesList, labels) {
  const mode = side === 'start' ? g.startMode : g.endMode
  const last = Math.max(0, (labels?.length || 1) - 1)
  if (side === 'end' && (mode === 'now' || !mode)) return last
  if (mode !== 'dynamic') {
    const raw = side === 'start' ? g.startDate : g.endDate
    const fallback = side === 'start' ? labels?.[0] : labels?.[last]
    return findLabelIdx(labels, raw || fallback)
  }
  const dt = applyDateTransforms(
    guideBaseDate(g, side, seriesList, labels),
    side === 'start' ? g.startTransforms : g.endTransforms,
  )
  return findLabelIdx(labels, fmtYmd(dt))
}

function guideRangeIdx(g, seriesList, labels) {
  if (g.timeMode === 'chart' || !labels?.length) {
    return { s: 0, e: Math.max(0, (labels?.length || 1) - 1) }
  }
  let s = resolveGuideBound(g, 'start', seriesList, labels)
  let e = resolveGuideBound(g, 'end', seriesList, labels)
  if (s > e) { const t = s; s = e; e = t }
  return { s, e }
}

function guideValuesInRange(g, seriesList, labels) {
  const sr = guideSeries(g, seriesList)
  if (!sr) return []
  const vals = sr.values || []
  const r = guideRangeIdx(g, seriesList, labels)
  const out = []
  for (let i = r.s; i <= r.e && i < vals.length; i++) {
    const v = vals[i]
    if (v != null && Number.isFinite(+v)) out.push(+v)
  }
  return out
}

function statMean(arr) {
  let s = 0
  for (let i = 0; i < arr.length; i++) s += arr[i]
  return s / arr.length
}

function statStd(arr) {
  if (arr.length < 2) return 0
  const m = statMean(arr)
  let v = 0
  for (let i = 0; i < arr.length; i++) v += (arr[i] - m) * (arr[i] - m)
  return Math.sqrt(v / (arr.length - 1))
}

function statQuantile(arr, p) {
  const a = arr.slice().sort((x, y) => x - y)
  const i = Math.min(a.length - 1, Math.max(0, Math.round((+p / 100) * (a.length - 1))))
  return a[i]
}

export function resolveGuideValue(raw, seriesList, labels) {
  if (!raw) return null
  const g = normalizeGuide(raw, seriesList?.[0]?.name || '')
  if (g.scaleMode === 'fixed' || g.mode === 'fixed' || g.type === 'fixed') {
    return g.value == null || g.value === '' ? null : +g.value
  }
  let vals = guideValuesInRange(g, seriesList, labels)
  if (!vals.length) {
    const sr = guideSeries(g, seriesList)
    vals = (sr?.values || []).map(Number).filter(Number.isFinite)
  }
  if (!vals.length) return null
  if (g.calcMode === 'meanStd') return +(statMean(vals) + (+g.stdK || 1) * statStd(vals)).toFixed(2)
  if (g.calcMode === 'quantile') return +statQuantile(vals, g.quantileP == null ? 50 : g.quantileP).toFixed(2)
  if (g.agg === 'max' || g.type === 'max') return Math.max(...vals)
  if (g.agg === 'min' || g.type === 'min') return Math.min(...vals)
  return +statMean(vals).toFixed(2)
}
