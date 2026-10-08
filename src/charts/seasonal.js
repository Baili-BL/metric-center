import { DEFAULT_COLORS as FALLBACK } from './seasonalColors.js'

const COLORS = FALLBACK

export function parseMd(raw) {
  const s = String(raw || '').trim().replace(/\//g, '-')
  const m = s.match(/^(\d{1,2})-(\d{1,2})$/)
  if (!m) return { m: 1, d: 1, key: '01-01' }
  const mo = Math.min(12, Math.max(1, +m[1] || 1))
  const day = Math.min(31, Math.max(1, +m[2] || 1))
  return {
    m: mo,
    d: day,
    key: `${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  }
}

export function compareMd(a, b) {
  const aa = typeof a === 'string' ? parseMd(a) : a
  const bb = typeof b === 'string' ? parseMd(b) : b
  if (aa.m !== bb.m) return aa.m - bb.m
  return aa.d - bb.d
}

/** start >= end → 必须跨年 */
export function mustCrossYear(start, end) {
  return compareMd(parseMd(start), parseMd(end)) >= 0
}

export function defaultSeason() {
  return {
    start: '01-01',
    end: '12-31',
    crossYear: false,
    align: 'gregorian',
    yearColors: {},
    yearStyles: {},
  }
}

/** 春节（正月初一）日期表，覆盖 2000-2049 */
const CNY_DATES = {
  2000: '02-05', 2001: '01-24', 2002: '02-12', 2003: '02-01', 2004: '01-22',
  2005: '02-09', 2006: '01-29', 2007: '02-18', 2008: '02-07', 2009: '01-26',
  2010: '02-14', 2011: '02-03', 2012: '01-23', 2013: '02-10', 2014: '01-31',
  2015: '02-19', 2016: '02-08', 2017: '01-28', 2018: '02-16', 2019: '02-05',
  2020: '01-25', 2021: '02-12', 2022: '02-01', 2023: '01-22', 2024: '02-10',
  2025: '01-29', 2026: '02-17', 2027: '02-06', 2028: '01-26', 2029: '02-13',
  2030: '02-03', 2031: '01-23', 2032: '02-11', 2033: '01-31', 2034: '02-19',
  2035: '02-08', 2036: '01-28', 2037: '02-15', 2038: '02-04', 2039: '01-24',
  2040: '02-12', 2041: '02-01', 2042: '01-22', 2043: '02-10', 2044: '01-30',
  2045: '02-17', 2046: '02-06', 2047: '01-26', 2048: '02-14', 2049: '02-02',
}

/** 某年春节（正月初一）的 Date；未知年份返回 null */
export function cnyDate(y) {
  const md = CNY_DATES[+y]
  if (!md) return null
  const [m, d] = md.split('-').map(Number)
  return new Date(+y, m - 1, d)
}

/** b - a 的天数差（同为本地零点时精确） */
function dayDiff(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

/** 格式化春节相对天数：0 → 春节，正 → +n，负 → -n */
export function cnyOffsetLabel(off) {
  if (off === 0) return '春节'
  return off > 0 ? `+${off}` : String(off)
}

/** 清洗按年份的线条样式覆盖：只保留合法的 width / dash */
function sanitizeYearStyles(raw) {
  const out = {}
  if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([y, o]) => {
      if (!o || typeof o !== 'object') return
      const w = Number(o.width)
      const item = {}
      if (Number.isFinite(w) && w >= 0.5 && w <= 8) item.width = w
      if (typeof o.dash === 'string' && o.dash) item.dash = o.dash
      if (Object.keys(item).length) out[String(y)] = item
    })
  }
  return out
}

export function normalizeSeason(raw = {}) {
  const base = defaultSeason()
  const start = parseMd(raw.start || base.start).key
  const end = parseMd(raw.end || base.end).key
  const forced = mustCrossYear(start, end)
  return {
    start,
    end,
    crossYear: forced ? true : !!raw.crossYear,
    align: raw.align === 'cny' ? 'cny' : 'gregorian',
    yearColors: raw.yearColors && typeof raw.yearColors === 'object' ? { ...raw.yearColors } : {},
    yearStyles: sanitizeYearStyles(raw.yearStyles),
  }
}

/** 某年份的线宽：优先用户覆盖；默认本年 2.5px、其他年份 1.5px */
export function seasonYearWidth(season, year, currentYear) {
  const o = season?.yearStyles?.[String(year)]
  const w = Number(o?.width)
  if (Number.isFinite(w)) return w
  return String(year) === String(currentYear) ? 2.5 : 1.5
}

/** 某年份的虚线样式：优先用户覆盖，回退全局 dash */
export function seasonYearDash(season, year, fallback) {
  const o = season?.yearStyles?.[String(year)]
  return o?.dash || fallback || 'solid'
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function daysInMonth(m) {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] || 30
}

function parseLabel(lab) {
  const s = String(lab || '')
  const full = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (full) return { y: +full[1], m: +full[2], d: +full[3], daily: true }
  const ym = s.match(/^(\d{4})-(\d{2})/)
  if (ym) return { y: +ym[1], m: +ym[2], d: 1, daily: false }
  return null
}

function labelsAreDaily(labels) {
  return (labels || []).some((l) => /^\d{4}-\d{2}-\d{2}/.test(String(l)))
}

/** 生成季节横轴刻度（已排序） */
export function buildSeasonAxis(start, end, crossYear, daily = true) {
  const s = parseMd(start)
  const e = parseMd(end)
  const ticks = []
  const pushMonth = (m) => {
    if (daily) {
      const dim = daysInMonth(m)
      for (let d = 1; d <= dim; d++) {
        ticks.push({
          m,
          d,
          key: `${pad2(m)}-${pad2(d)}`,
          label: `${pad2(m)}/${pad2(d)}`,
        })
      }
    } else {
      ticks.push({
        m,
        d: 1,
        key: `${pad2(m)}-01`,
        label: `${pad2(m)}/01`,
      })
    }
  }

  if (!crossYear) {
    if (daily) {
      let m = s.m
      let d = s.d
      for (;;) {
        ticks.push({ m, d, key: `${pad2(m)}-${pad2(d)}`, label: `${pad2(m)}/${pad2(d)}` })
        if (m === e.m && d === e.d) break
        d += 1
        if (d > daysInMonth(m)) { d = 1; m += 1 }
        if (m > 12) break
      }
    } else {
      for (let m = s.m; m <= e.m; m++) pushMonth(m)
    }
  } else if (daily) {
    let m = s.m
    let d = s.d
    // start → 12/31
    for (;;) {
      ticks.push({ m, d, key: `${pad2(m)}-${pad2(d)}`, label: `${pad2(m)}/${pad2(d)}` })
      if (m === 12 && d === 31) break
      d += 1
      if (d > daysInMonth(m)) { d = 1; m += 1 }
      if (m > 12) break
    }
    // 01/01 → end
    m = 1
    d = 1
    for (;;) {
      ticks.push({ m, d, key: `${pad2(m)}-${pad2(d)}`, label: `${pad2(m)}/${pad2(d)}` })
      if (m === e.m && d === e.d) break
      d += 1
      if (d > daysInMonth(m)) { d = 1; m += 1 }
      if (m > 12) break
    }
  } else {
    for (let m = s.m; m <= 12; m++) pushMonth(m)
    for (let m = 1; m <= e.m; m++) pushMonth(m)
  }

  return ticks.map((t, i) => ({ ...t, idx: i }))
}

function inSeasonWindow(md, start, end, crossYear) {
  const c = compareMd(md, start)
  const d = compareMd(md, end)
  if (!crossYear) return c >= 0 && d <= 0
  // 跨年：>= start 或 <= end
  return c >= 0 || d <= 0
}

/**
 * 将点归入季节年：
 * - 非跨年：日历年
 * - 跨年：落在 start~年末 → 该日历年；落在年初~end → 日历年-1（与 start 同属一季）
 */
function seasonYearOf(y, md, start, crossYear) {
  if (!crossYear) return String(y)
  if (compareMd(md, start) >= 0) return String(y)
  return String(y - 1)
}

/**
 * @returns {{ rows, years, colors, currentYear, axisTicks, domain }}
 */
export function buildSeasonalPack(series, labels, seasonCfg = {}, nullMode = 'cross') {
  const season = normalizeSeason(seasonCfg)
  const sr = series?.[0]
  const vals = sr?.values || []
  const daily = labelsAreDaily(labels)
  const cnyAligned = season.align === 'cny'

  let axisTicks = buildSeasonAxis(season.start, season.end, season.crossYear, daily)
  let idxByKey = new Map(axisTicks.map((t) => [t.key, t.idx]))
  // 月度数据：仅用 MM-01 键匹配
  if (!daily) {
    axisTicks.forEach((t) => {
      idxByKey.set(`${pad2(t.m)}-01`, t.idx)
    })
  }

  // 春节对齐：x 轴改为「相对当年春节的天数」，各年曲线按春节锚点平移对齐
  let cnyOffOf = null
  let cnyOMin = 0
  if (cnyAligned) {
    const offsets = []
    cnyOffOf = new Map()
    labels.forEach((lab, i) => {
      const p = parseLabel(lab)
      if (!p) return
      const cny = cnyDate(p.y)
      if (!cny) return
      const off = dayDiff(cny, new Date(p.y, p.m - 1, daily ? p.d : 1))
      cnyOffOf.set(i, off)
      offsets.push(off)
    })
    if (offsets.length) {
      cnyOMin = Math.min(...offsets)
      const oMax = Math.max(...offsets)
      axisTicks = []
      for (let o = cnyOMin; o <= oMax; o++) {
        axisTicks.push({ key: `cny:${o}`, label: cnyOffsetLabel(o) })
      }
      axisTicks = axisTicks.map((t, i) => ({ ...t, idx: i }))
    } else {
      // 年份超出春节表范围，退回公历
      cnyOffOf = null
    }
  }

  const byYear = {}
  labels.forEach((lab, i) => {
    const p = parseLabel(lab)
    if (!p) return
    const md = { m: p.m, d: daily ? p.d : 1, key: `${pad2(p.m)}-${pad2(daily ? p.d : 1)}` }
    if (!inSeasonWindow(md, season.start, season.end, season.crossYear)) return
    const sy = seasonYearOf(p.y, md, season.start, season.crossYear)
    let x
    if (cnyOffOf) {
      const off = cnyOffOf.get(i)
      if (off == null) return
      x = off - cnyOMin
    } else {
      x = idxByKey.get(md.key)
      if (x == null && !daily) x = idxByKey.get(`${pad2(p.m)}-01`)
      if (x == null) return
    }
    if (!byYear[sy]) byYear[sy] = []
    byYear[sy].push({
      idx: i,
      x,
      md: cnyOffOf ? cnyOffsetLabel(cnyOffOf.get(i)) : (axisTicks[x]?.label || md.key.replace('-', '/')),
      mdKey: md.key,
      value: vals[i],
      tip: lab,
      year: sy,
    })
  })

  const years = Object.keys(byYear).sort((a, b) => +a - +b)
  const colors = years.map((y, i) => season.yearColors?.[y] || COLORS[i % COLORS.length])
  const colorOf = Object.fromEntries(years.map((y, i) => [y, colors[i]]))

  const rows = []
  years.forEach((y) => {
    const pts = byYear[y].slice().sort((a, b) => a.x - b.x || a.idx - b.idx)
    pts.forEach((pt) => {
      const num = Number(pt.value)
      const empty = pt.value == null || pt.value === '' || !Number.isFinite(num)
      const name = `${y}年`
      if (empty) {
        if (nullMode === 'zero') {
          rows.push({
            x: pt.x, md: pt.md, value: 0, name, year: y, color: colorOf[y], tip: pt.tip,
          })
        } else if (nullMode === 'break') {
          rows.push({
            x: pt.x, md: pt.md, value: null, name, year: y, color: colorOf[y], tip: pt.tip,
          })
        }
        return
      }
      rows.push({
        x: pt.x, md: pt.md, value: num, name, year: y, color: colorOf[y], tip: pt.tip,
      })
    })
  })

  const calY = String(new Date().getFullYear())
  const currentYear = years.includes(calY) ? calY : (years[years.length - 1] || calY)

  return {
    rows,
    years,
    colors,
    currentYear,
    axisTicks,
    domain: axisTicks.map((_, i) => i),
  }
}

export function seasonYearColor(season, year, index = 0) {
  const s = normalizeSeason(season)
  if (s.yearColors?.[year]) return s.yearColors[year]
  return COLORS[index % COLORS.length]
}

export function listSeasonYears(labels, seasonCfg = {}) {
  const season = normalizeSeason(seasonCfg)
  const daily = labelsAreDaily(labels)
  const set = new Set()
  ;(labels || []).forEach((lab) => {
    const p = parseLabel(lab)
    if (!p) return
    const md = { m: p.m, d: daily ? p.d : 1, key: `${pad2(p.m)}-${pad2(daily ? p.d : 1)}` }
    if (!inSeasonWindow(md, season.start, season.end, season.crossYear)) return
    set.add(seasonYearOf(p.y, md, season.start, season.crossYear))
  })
  return [...set].sort((a, b) => +a - +b)
}
