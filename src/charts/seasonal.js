import { DEFAULT_COLORS as FALLBACK } from './seasonalColors'

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
    yearColors: {},
  }
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
    yearColors: raw.yearColors && typeof raw.yearColors === 'object' ? { ...raw.yearColors } : {},
  }
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
  const axisTicks = buildSeasonAxis(season.start, season.end, season.crossYear, daily)
  const idxByKey = new Map(axisTicks.map((t) => [t.key, t.idx]))
  // 月度数据：仅用 MM-01 键匹配
  if (!daily) {
    axisTicks.forEach((t) => {
      idxByKey.set(`${pad2(t.m)}-01`, t.idx)
    })
  }

  const byYear = {}
  labels.forEach((lab, i) => {
    const p = parseLabel(lab)
    if (!p) return
    const md = { m: p.m, d: daily ? p.d : 1, key: `${pad2(p.m)}-${pad2(daily ? p.d : 1)}` }
    if (!inSeasonWindow(md, season.start, season.end, season.crossYear)) return
    const sy = seasonYearOf(p.y, md, season.start, season.crossYear)
    let x = idxByKey.get(md.key)
    if (x == null && !daily) x = idxByKey.get(`${pad2(p.m)}-01`)
    if (x == null) return
    if (!byYear[sy]) byYear[sy] = []
    byYear[sy].push({
      idx: i,
      x,
      md: axisTicks[x]?.label || md.key.replace('-', '/'),
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
