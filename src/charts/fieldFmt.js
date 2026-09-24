export const TIME_DIM_FORMATS = [
  { id: 'auto', label: '自动' },
  { id: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  { id: 'YYYYMMDD', label: 'YYYYMMDD' },
  { id: 'YYYY/MM/DD', label: 'YYYY/MM/DD' },
  { id: 'YYYY年M月D日', label: 'YYYY年M月D日' },
  { id: '中文YYYY年M月D日', label: '中文YYYY年M月D日' },
  { id: 'MMDD', label: 'MMDD' },
  { id: 'MM-DD', label: 'MM-DD' },
  { id: 'MM/DD', label: 'MM/DD' },
  { id: 'M月D日', label: 'M月D日' },
  { id: 'DDMMYYYY', label: 'DDMMYYYY' },
  { id: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
]

export const DC_OPS = [
  { v: '>', t: '大于' },
  { v: '>=', t: '大于等于' },
  { v: '<', t: '小于' },
  { v: '<=', t: '小于等于' },
  { v: '=', t: '等于' },
  { v: '!=', t: '不等于' },
  { v: 'null', t: '为空' },
  { v: 'notnull', t: '不为空' },
]

export const DC_AGGS = [
  ['avg', '区间均值'],
  ['max', '区间最大'],
  ['min', '区间最小'],
  ['sum', '区间求和'],
  ['last', '最新值'],
]

export const FMT_PRESETS = [
  { id: 'auto', label: '自动' },
  { id: 'none', label: '无' },
  { id: 'int', label: '整数' },
  { id: '1', label: '保留1位小数' },
  { id: '2', label: '保留2位小数' },
  { id: 'pct', label: '百分比' },
  { id: 'pct1', label: '百分比1位小数' },
  { id: 'pct2', label: '百分比2位小数' },
  { id: 'custom', label: '自定义' },
]

export const NULL_MODES = [
  { id: 'blank', label: '空白' },
  { id: 'dash', label: '显示为 -' },
  { id: 'empty', label: '显示为 空' },
  { id: 'na', label: '显示为 N/A' },
]

export const SORT_MODES = [
  { id: 'none', label: '不排序' },
  { id: 'asc', label: '升序' },
  { id: 'desc', label: '降序' },
]

export const DIM_SORT_MODES = [
  { id: 'asc', label: '升序' },
  { id: 'desc', label: '降序' },
]

const CN_UPPER_DIGITS = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖']

export function defaultFmt() {
  return {
    kind: 'auto',
    unit: 'none',
    hideUnit: false,
    decimals: 1,
    neg: 'minus',
    prefix: '',
    suffix: '',
    currency: false,
    thou: true,
    pattern: '#,##0',
    preset: 'auto',
  }
}

export function normalizeAxisLabelDisplay(f) {
  const out = defaultFmt()
  if (!f || typeof f !== 'object') return out
  if (['auto', 'number', 'percent', 'manual'].includes(f.kind)) out.kind = f.kind
  if (['none', 'k', 'wan', 'm', 'yi', 'auto'].includes(f.unit)) out.unit = f.unit
  out.hideUnit = !!f.hideUnit
  out.decimals = f.decimals != null && Number.isFinite(+f.decimals) ? Math.max(0, Math.min(6, Math.round(+f.decimals))) : 1
  if (['minus', 'paren', 'trail'].includes(f.neg)) out.neg = f.neg
  out.prefix = String(f.prefix || '')
  out.suffix = String(f.suffix || '')
  out.currency = !!f.currency
  out.thou = f.thou !== false
  out.pattern = String(f.pattern || '#,##0')
  out.preset = f.preset || ''
  return out
}

export function migrateFmtToDisplay(f) {
  if (!f || typeof f !== 'object') return defaultFmt()
  if (f.kind) {
    const out = normalizeAxisLabelDisplay(f)
    out.preset = f.preset || (f.kind === 'auto' ? 'auto' : 'custom')
    return out
  }
  const out = defaultFmt()
  out.preset = f.preset || ''
  const hasAffix = !!(f.prefix || f.suffix)
  if (f.type === 'percent' || f.unit === 'pct') {
    out.kind = 'percent'
    out.decimals = f.decimals != null && Number.isFinite(+f.decimals) ? Math.max(0, Math.min(6, Math.round(+f.decimals))) : 0
    out.thou = !!f.thou
  } else if (!hasAffix && (f.preset === 'auto' || (!f.preset && (f.unit === 'auto' || !f.unit)))) {
    out.kind = 'auto'
    out.preset = out.preset || 'auto'
  } else {
    out.kind = 'number'
    out.unit = ['wan', 'yi', 'k', 'm', 'auto'].includes(f.unit) ? f.unit : 'none'
    out.decimals = f.decimals != null && Number.isFinite(+f.decimals) ? Math.max(0, Math.min(6, Math.round(+f.decimals))) : 2
    out.thou = f.thou !== false
  }
  out.prefix = String(f.prefix || '')
  out.suffix = String(f.suffix || '')
  if (!out.preset) {
    if (out.kind === 'auto') out.preset = 'auto'
    else if (out.kind === 'percent') {
      out.preset = out.decimals === 0 ? 'pct' : out.decimals === 1 ? 'pct1' : out.decimals === 2 ? 'pct2' : 'custom'
    } else out.preset = 'custom'
  }
  return out
}

export function applyNumberFmtPreset(s, v) {
  if (!s) return
  const f = defaultFmt()
  f.preset = v || 'auto'
  if (v === 'pct' || v === 'pct1' || v === 'pct2') {
    f.kind = 'percent'
    f.decimals = v === 'pct' ? 0 : v === 'pct1' ? 1 : 2
    f.thou = false
  } else if (v === 'none') {
    f.kind = 'number'
    f.unit = 'none'
    f.decimals = 2
    f.thou = false
  } else if (v === 'int') {
    f.kind = 'number'
    f.unit = 'none'
    f.decimals = 0
    f.thou = true
  } else if (v === '1') {
    f.kind = 'number'
    f.unit = 'none'
    f.decimals = 1
    f.thou = true
  } else if (v === '2') {
    f.kind = 'number'
    f.unit = 'none'
    f.decimals = 2
    f.thou = true
  } else {
    f.kind = 'auto'
    f.preset = 'auto'
  }
  s.fmt = f
}

export function seriesFmtMenuPreset(s) {
  if (!s || !s.fmt) return 'auto'
  const f = migrateFmtToDisplay(s.fmt)
  const known = ['auto', 'none', 'int', '1', '2', 'pct', 'pct1', 'pct2', 'custom']
  if (f.preset && known.includes(f.preset)) return f.preset
  if (f.kind === 'auto') return 'auto'
  if (f.kind === 'percent') {
    return f.decimals === 0 ? 'pct' : f.decimals === 1 ? 'pct1' : f.decimals === 2 ? 'pct2' : 'custom'
  }
  if (f.kind === 'number' && f.unit === 'none' && !f.prefix && !f.suffix) {
    if (f.decimals === 0) return 'int'
    if (f.decimals === 1) return '1'
    if (f.decimals === 2 && !f.thou) return 'none'
    if (f.decimals === 2) return '2'
  }
  return 'custom'
}

export function seriesFmtText(s) {
  if (!s || !s.fmt) return '自动适配'
  const f = migrateFmtToDisplay(s.fmt)
  const map = {
    auto: '自动',
    none: '无',
    int: '整数',
    1: '1位小数',
    2: '2位小数',
    pct: '百分比',
    pct1: '百分比1位',
    pct2: '百分比2位',
  }
  if (f.preset && map[f.preset]) return map[f.preset]
  const kind = { auto: '自动适配', number: '数值', percent: '百分比', manual: '手动输入' }[f.kind] || '自定义'
  if (f.kind === 'auto' || f.kind === 'manual') return kind
  return `${kind} / ${f.decimals}位小数`
}

function formatByNumPattern(n, pattern) {
  const raw = String(pattern || '#,##0')
  const pct = raw.includes('%')
  const p = raw.replace(/%/g, '')
  let val = Number(n)
  if (!Number.isFinite(val)) return ''
  if (pct) val *= 100
  const neg = val < 0
  val = Math.abs(val)
  const thou = p.includes(',')
  const decPart = ((p.split('.')[1] || '').match(/[0#]+/) || [''])[0]
  let txt = val.toFixed(decPart.length)
  if (thou) {
    const parts = txt.split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    txt = parts.join('.')
  }
  if (neg) txt = `-${txt}`
  if (pct) txt += '%'
  return txt
}

export function formatAxisLabelValue(v, spec) {
  const cfg = normalizeAxisLabelDisplay(spec)
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  if (cfg.kind === 'auto') return n.toLocaleString('zh-CN', { maximumFractionDigits: 1 })
  if (cfg.kind === 'manual') return formatByNumPattern(n, cfg.pattern)
  let unitTxt = ''
  let val = n
  if (cfg.kind === 'percent') {
    unitTxt = '%'
  } else {
    const u = cfg.unit || 'none'
    if (u === 'k') { val /= 1000; unitTxt = '千' }
    else if (u === 'wan') { val /= 10000; unitTxt = '万' }
    else if (u === 'm') { val /= 1000000; unitTxt = '百万' }
    else if (u === 'yi') { val /= 100000000; unitTxt = '亿' }
    else if (u === 'auto') {
      const a = Math.abs(val)
      if (a >= 1e8) { val /= 1e8; unitTxt = '亿' }
      else if (a >= 1e4) { val /= 1e4; unitTxt = '万' }
      else if (a >= 1e3) { val /= 1e3; unitTxt = '千' }
    }
    if (cfg.hideUnit) unitTxt = ''
  }
  const neg = val < 0
  let txt = Math.abs(val).toFixed(cfg.decimals)
  if (cfg.thou) {
    const parts = txt.split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    txt = parts.join('.')
  }
  const prefix = cfg.prefix || (cfg.currency ? '￥' : '')
  const suffix = cfg.suffix || ''
  const core = `${prefix}${txt}${unitTxt}${suffix}`
  if (!neg) return core
  if (cfg.neg === 'paren') return `(${core})`
  if (cfg.neg === 'trail') return `${core}-`
  return `-${core}`
}

export function displayNullText(mode) {
  const m = mode || 'blank'
  if (m === 'dash') return '-'
  if (m === 'empty') return '空'
  if (m === 'na') return 'N/A'
  return ''
}

export function fmtSeriesVal(v, s, isNull) {
  if (isNull || v == null || Number.isNaN(Number(v))) return displayNullText(s && s.nullDisplay)
  return formatAxisLabelValue(v, migrateFmtToDisplay(s && s.fmt))
}

function parseMonthParts(lab) {
  const m = String(lab || '').match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/)
  if (!m) return null
  return { y: +m[1], m: +m[2], d: +(m[3] || 1) }
}

function toCnUpperDigits(n) {
  return String(n == null ? '' : n).replace(/\d/g, (d) => CN_UPPER_DIGITS[+d] || d)
}

function toCnUpperNumber(n) {
  n = +n
  if (!Number.isFinite(n) || n < 0) return toCnUpperDigits(n)
  if (n <= 10) return CN_UPPER_DIGITS[n] || toCnUpperDigits(n)
  if (n < 20) return `拾${n === 10 ? '' : CN_UPPER_DIGITS[n - 10]}`
  if (n < 100) {
    const t = Math.floor(n / 10)
    const o = n % 10
    return `${CN_UPPER_DIGITS[t]}拾${o ? CN_UPPER_DIGITS[o] : ''}`
  }
  return toCnUpperDigits(n)
}

export function timeDimFormatLabel(id) {
  return TIME_DIM_FORMATS.find((x) => x.id === id)?.label || '自动'
}

export function formatDimTime(lab, fmt, nullMode = 'blank') {
  if (lab == null || lab === '') return displayNullText(nullMode)
  const p = parseMonthParts(lab)
  if (!p) return String(lab || '')
  const y = String(p.y)
  const mm = String(p.m).padStart(2, '0')
  const m = String(p.m)
  const dd = String(p.d).padStart(2, '0')
  const d = String(p.d)
  const f = fmt || 'auto'
  if (f === 'YYYY-MM-DD') return `${y}-${mm}-${dd}`
  if (f === 'YYYYMMDD') return `${y}${mm}${dd}`
  if (f === 'YYYY/MM/DD') return `${y}/${mm}/${dd}`
  if (f === 'YYYY年M月D日') return `${y}年${m}月${d}日`
  if (f === '中文YYYY年M月D日') return `${toCnUpperDigits(y)}年${toCnUpperNumber(p.m)}月${toCnUpperNumber(p.d)}日`
  if (f === 'MMDD') return `${mm}${dd}`
  if (f === 'MM-DD') return `${mm}-${dd}`
  if (f === 'MM/DD') return `${mm}/${dd}`
  if (f === 'M月D日') return `${m}月${d}日`
  if (f === 'DDMMYYYY') return `${dd}${mm}${y}`
  if (f === 'MM/DD/YYYY') return `${mm}/${dd}/${y}`
  return `${y.slice(2)}/${mm}`
}

export function dimChipLabel(state = {}) {
  const fmt = timeDimFormatLabel(state.dimTimeFormat)
  const mode = state.dimLabelMode || 'nameFmt'
  if (mode === 'name') return '时间维度'
  if (mode === 'fmt') return fmt
  return `时间维度(${fmt})`
}

export function seriesHasCond(s) {
  const c = s && s.cond
  if (!c || c.enabled === false) return false
  if (!Array.isArray(c.groups)) return false
  return c.groups.some((g) => g && g.rules && g.rules.length)
}

export function seriesCondText(s) {
  if (!seriesHasCond(s)) return '未设置'
  let n = 0
  ;(s.cond.groups || []).forEach((g) => { n += (g.rules || []).length })
  return `已生效（${n} 条）`
}

export function defaultCond() {
  return { enabled: true, where: 'current', groups: [{ field: '', rules: [] }] }
}

export function normalizeCond(c) {
  const out = defaultCond()
  if (c && typeof c === 'object') {
    out.enabled = c.enabled !== false
    out.where = c.where === 'other' ? 'other' : 'current'
    if (Array.isArray(c.groups) && c.groups.length) {
      out.groups = c.groups.map((g) => ({
        field: String(g && g.field || ''),
        rules: Array.isArray(g && g.rules)
          ? g.rules.map((r) => ({
            op: (r && r.op) || '>',
            val: r && r.val != null ? r.val : '',
            pct: !!(r && r.pct),
            agg: (r && r.agg) || 'avg',
          }))
          : [],
      }))
    }
  }
  return out
}

export function condPassRule(v, r) {
  if (v == null) return r.op === 'null'
  const n = +v
  if (!Number.isFinite(n)) return false
  let t = r.val === '' || r.val == null ? NaN : +r.val
  if (r.pct && Number.isFinite(t)) t /= 100
  switch (r.op) {
    case '>': return Number.isFinite(t) && n > t
    case '>=': return Number.isFinite(t) && n >= t
    case '<': return Number.isFinite(t) && n < t
    case '<=': return Number.isFinite(t) && n <= t
    case '=': return Number.isFinite(t) && n === t
    case '!=': return Number.isFinite(t) && n !== t
    case 'null': return false
    case 'notnull': return true
    default: return true
  }
}

export function condOtherAggVal(field, agg, seriesList, values) {
  const sr = (seriesList || []).find((x) => x.name === field)
  const src = values || sr?.values || []
  const vals = src.map(Number).filter(Number.isFinite)
  if (!vals.length) return null
  if (agg === 'max') return Math.max(...vals)
  if (agg === 'min') return Math.min(...vals)
  if (agg === 'sum') return vals.reduce((a, b) => a + b, 0)
  if (agg === 'last') return vals[vals.length - 1]
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export function applyCondToValues(sr, seriesList, values) {
  const src = Array.isArray(values) ? values.slice() : []
  const c = sr && sr.cond
  if (!c || c.enabled === false) return src
  const groups = Array.isArray(c.groups) ? c.groups : []
  if (!groups.length) return src
  return src.map((v, i) => {
    let ok = true
    for (let gi = 0; gi < groups.length && ok; gi++) {
      const g = groups[gi]
      if (!g || !g.rules || !g.rules.length) continue
      for (let ri = 0; ri < g.rules.length && ok; ri++) {
        const r = g.rules[ri]
        const val = c.where === 'other' && g.field
          ? condOtherAggVal(g.field, r.agg || 'avg', seriesList, (seriesList || []).find((x) => x.name === g.field)?.values)
          : v
        ok = condPassRule(val == null ? null : +val, r)
      }
    }
    return ok ? v : null
  })
}

export function cleanCondDraft(draft) {
  const clean = normalizeCond(draft)
  clean.groups = clean.groups.map((g) => ({
    field: g.field,
    rules: g.rules.filter((r) => (r.op === 'null' || r.op === 'notnull') || (r.val !== '' && r.val != null && Number.isFinite(+r.val))),
  })).filter((g) => (clean.where === 'other' ? (g.field && g.rules.length) : g.rules.length))
  if (!clean.groups.length) return null
  clean.enabled = true
  return clean
}

export function buildCategoryOrder(labels, series, dimSort = 'asc') {
  const n = (labels || []).length
  const order = Array.from({ length: n }, (_, i) => i)
  const ms = (series || []).find((s) => s.sort === 'asc' || s.sort === 'desc')
  if (ms) {
    const dir = ms.sort === 'desc' ? -1 : 1
    const data = ms.values || []
    order.sort((a, b) => {
      const va = data[a]
      const vb = data[b]
      const na = va == null || !Number.isFinite(+va)
      const nb = vb == null || !Number.isFinite(+vb)
      if (na && nb) return a - b
      if (na) return 1
      if (nb) return -1
      if (+va !== +vb) return (+va - +vb) * dir
      return a - b
    })
  } else if (dimSort === 'desc') {
    order.reverse()
  }
  return order
}

export function applyCategoryOrder(labels, series, dimSort) {
  const order = buildCategoryOrder(labels, series, dimSort)
  return {
    labels: order.map((i) => labels[i]),
    series: (series || []).map((s) => ({
      ...s,
      values: order.map((i) => s.values?.[i]),
    })),
  }
}

export function seriesComboMark(sr) {
  const m = sr && sr.mark
  if (m === 'bar' || m === 'line' || m === 'area') return m
  return sr && sr.axis === 'right' ? 'line' : 'bar'
}

export function comboMarkLabel(mark) {
  if (mark === 'line') return '折线'
  if (mark === 'area') return '面积'
  return '柱形'
}

export function comboMarkIcon(mark) {
  if (mark === 'line') return 'mark-line'
  if (mark === 'area') return 'mark-area'
  return 'mark-bar'
}
