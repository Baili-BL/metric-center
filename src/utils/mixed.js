// 混合表日期/取值工具：日期解析、期数位移、日期变换、指标按日期取值、四则表达式求值
import { monthLabels } from './hash'

export const FREQ_SHIFT_DAYS = { 日频: 1, 周频: 7, 月频: 0, 年频: 0 }

export function parseDate(s) {
  if (s == null) return null
  // Excel 日期序列号（fortune 会把键入的日期自动转为序列，如 46113 = 2026-04-01）
  if (typeof s === 'number' && Number.isFinite(s) && s >= 20000 && s <= 80000) {
    const utc = new Date(Date.UTC(1899, 11, 30) + s * 86400000)
    return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate())
  }
  const str = String(s).trim()
  let m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  m = str.match(/^(\d{4})[-/](\d{1,2})$/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, 1)
  m = str.match(/^(\d{1,2})[-/](\d{1,2})$/)
  if (m) return new Date(new Date().getFullYear(), Number(m[1]) - 1, Number(m[2]))
  return null
}

export function fmtDate(d) {
  if (!(d instanceof Date) || isNaN(d)) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + Number(n || 0))
  return x
}

export function addMonths(d, n) {
  const x = new Date(d)
  const day = x.getDate()
  x.setDate(1)
  x.setMonth(x.getMonth() + Number(n || 0))
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
  x.setDate(Math.min(day, last))
  return x
}

// 期数位移：按指标频率移动 n 期（月频=±n 月，周频=±n 周，日频=±n 天）
export function shiftPeriods(dateStr, n, freq) {
  const d = parseDate(dateStr)
  if (!d) return ''
  const num = Number(n || 0)
  if (!num) return fmtDate(d)
  if (freq === '月频') return fmtDate(addMonths(d, num))
  if (freq === '年频') return fmtDate(addMonths(d, num * 12))
  if (freq === '周频') return fmtDate(addDays(d, num * 7))
  return fmtDate(addDays(d, num))
}

// 日期变换：额外位移（天/周/月）+ 锚定（所在周周一 / 月初 / 月末）
// tf: { days, weeks, months, anchor: 'none' | 'monday' | 'monthStart' | 'monthEnd' }
export function transformDate(dateStr, tf) {
  let d = parseDate(dateStr)
  if (!d) return ''
  const t = tf || {}
  if (Number(t.months)) d = addMonths(d, Number(t.months))
  if (Number(t.weeks)) d = addDays(d, Number(t.weeks) * 7)
  if (Number(t.days)) d = addDays(d, Number(t.days))
  if (t.anchor === 'monday') {
    const wd = d.getDay() || 7 // 周日=7
    d = addDays(d, 1 - wd)
  } else if (t.anchor === 'monthStart') {
    d = new Date(d.getFullYear(), d.getMonth(), 1)
  } else if (t.anchor === 'monthEnd') {
    d = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  }
  return fmtDate(d)
}

// 指标按日期取值：values 与 LABELS(YYYY-MM) 对齐，取日期所在月；越界取最近一期
export function indValueAt(ind, dateStr, labels) {
  if (!ind || !Array.isArray(ind.values)) return null
  const d = parseDate(dateStr)
  if (!d) return null
  const LABELS = labels || []
  const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  let idx = LABELS.indexOf(label)
  if (idx < 0) {
    if (label > LABELS[LABELS.length - 1]) idx = LABELS.length - 1
    else idx = 0
  }
  const v = ind.values[idx]
  return v == null ? null : { value: v, label: LABELS[idx], exact: LABELS[idx] === label }
}

// 关联单元格引用（如 B3）→ {row, col}
export function refToRC(ref) {
  const m = String(ref || '').trim().toUpperCase().match(/^([A-Z]+)(\d+)$/)
  if (!m) return null
  let c = 0
  for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64)
  return { row: Number(m[2]) - 1, col: c - 1 }
}

// 安全四则表达式求值：变量为单字母 A-F，值来自 vars 映射
export function evalExpr(expr, vars) {
  const e = String(expr || '').toUpperCase()
  if (!e || !/^[A-F0-9+\-*/().\s]*$/.test(e)) return null
  let code = e
  Object.keys(vars || {}).forEach((k) => {
    code = code.split(k).join(`(${vars[k]})`)
  })
  if (/[A-F]/.test(code)) return null
  try {
    // eslint-disable-next-line no-new-func
    const r = new Function(`"use strict";return (${code})`)()
    return Number.isFinite(r) ? r : null
  } catch {
    return null
  }
}

export const ANCHOR_OPTS = [
  { id: 'none', name: '不锚定' },
  { id: 'monday', name: '所在周周一' },
  { id: 'monthStart', name: '所在月月初' },
  { id: 'monthEnd', name: '所在月月末' },
  { id: 'prevMonthSameDay', name: '上月同期' },
  { id: 'prevYearSameDay', name: '上年同期' },
]

// 叠加式日期变换（按添加顺序依次计算）
// 项：{ type: 'shift', unit: 'day'|'week'|'month', n: 数值 } 或 { type: 'anchor', anchor: 锚定id }
export function applyTransforms(dateStr, list) {
  let d = parseDate(dateStr)
  if (!d) return ''
  ;(Array.isArray(list) ? list : []).forEach((t) => {
    if (!t) return
    if (t.type === 'shift') {
      const n = Number(t.n || 0)
      if (t.unit === 'month') d = addMonths(d, n)
      else if (t.unit === 'week') d = addDays(d, n * 7)
      else d = addDays(d, n)
    } else if (t.type === 'anchor') {
      if (t.anchor === 'monday') {
        const wd = d.getDay() || 7
        d = addDays(d, 1 - wd)
      } else if (t.anchor === 'monthStart') {
        d = new Date(d.getFullYear(), d.getMonth(), 1)
      } else if (t.anchor === 'monthEnd') {
        d = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      } else if (t.anchor === 'prevMonthSameDay') {
        d = addMonths(d, -1)
      } else if (t.anchor === 'prevYearSameDay') {
        d = addMonths(d, -12)
      }
    }
  })
  return fmtDate(d)
}

// 单元格引用（如 B3）的 A1 表示
export function rcToRef(row, col) {
  let s = ''
  let c = Number(col) + 1
  while (c > 0) {
    const m = (c - 1) % 26
    s = String.fromCharCode(65 + m) + s
    c = Math.floor((c - 1) / 26)
  }
  return `${s}${Number(row) + 1}`
}

// 变换项的展示文案，如「-5 天」「所在周周一」
export function transformLabel(t) {
  if (!t) return ''
  if (t.type === 'shift') {
    const unit = t.unit === 'month' ? '月' : t.unit === 'week' ? '周' : '天'
    return `${Number(t.n || 0) > 0 ? '+' : ''}${Number(t.n || 0)} ${unit}`
  }
  return (ANCHOR_OPTS.find((a) => a.id === t.anchor) || {}).name || t.anchor
}

export { monthLabels }
