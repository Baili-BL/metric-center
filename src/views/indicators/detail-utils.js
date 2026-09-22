import { Chart } from '@antv/g2'

export const DV_LINE_COLOR = '#0016ED'
export const SEASON_YEAR_COLORS = ['#8b9099', '#1a1a1a', '#e6b800', '#e53935', '#1c4cf2', '#00a870', '#7b61ff']
export const CNY_DATES = {
  2019: '2019-02-05', 2020: '2020-01-25', 2021: '2021-02-12', 2022: '2022-02-01',
  2023: '2023-01-22', 2024: '2024-02-10', 2025: '2025-01-29', 2026: '2026-02-17',
  2027: '2027-02-06',
}

export const DV_MONTHS = Array.from({ length: 91 }, (_, i) => {
  const y = 2019 + Math.floor(i / 12)
  const m = (i % 12) + 1
  return `${y}-${String(m).padStart(2, '0')}`
})

export function dvHash(s) {
  let h = 0
  const str = String(s || '')
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

function rng(seed0) {
  let seed = seed0 % 233280
  return () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
}

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`
}

export function fmtYMD(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function parseYMD(s) {
  const p = String(s).split('-')
  return new Date(+p[0], +p[1] - 1, +p[2])
}

export function freqLabel(freq) {
  return String(freq || '日频').replace('频', '') + '度'
}

export function dvMonthly(title, refreshN = 0) {
  const rnd = rng(dvHash(title) + refreshN * 9973)
  let v = 40 + rnd() * 60
  const ph = rnd() * 6.28
  const drift = (rnd() - 0.45) * 1.5
  const out = []
  for (let i = 0; i < DV_MONTHS.length; i++) {
    v += (rnd() - 0.5) * 8 + drift + Math.sin(i / 6 + ph) * 0.9
    out.push(+v.toFixed(1))
  }
  return out
}

export function filterMonths(range) {
  let months = DV_MONTHS.slice()
  if (range.mode === 'recent' && range.years > 0) {
    const last = months[months.length - 1]
    const [y, m] = last.split('-')
    const start = `${+y - range.years}-${m}`
    months = months.filter((d) => d >= start)
  } else if (range.mode === 'range') {
    const from = (range.from || '').slice(0, 7)
    const to = (range.to || '').slice(0, 7)
    if (from) months = months.filter((d) => d >= from)
    if (to) months = months.filter((d) => d <= to)
  }
  return months.length ? months : DV_MONTHS.slice()
}

export function lineSeries(title, range, yoyOn, refreshN = 0) {
  const data = dvMonthly(title, refreshN)
  const months = filterMonths(range)
  const idxMap = {}
  DV_MONTHS.forEach((d, i) => { idxMap[d] = i })
  const main = months.map((d) => {
    const i = idxMap[d]
    return { date: d, value: i != null ? data[i] : null, name: title }
  }).filter((r) => r.value != null)
  const yoy = yoyOn
    ? months.map((d) => {
      const i = idxMap[d]
      return { date: d, value: i != null && i >= 12 ? data[i - 12] : null, name: '去年同期' }
    }).filter((r) => r.value != null)
    : []
  return { main, yoy }
}

export function dvDailyRows(title) {
  const rnd = rng(dvHash(title) % 233280)
  const base = Math.round(2000 + rnd() * 2000)
  const rows = []
  const today = new Date()
  for (let i = 59; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000)
    rows.push({ date: fmtYMD(d), val: base + Math.round((rnd() - 0.5) * 40) })
  }
  return rows
}

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.round((d - start) / 86400000)
}

export function doyToMMDD(doy) {
  let n = Math.round(Number(doy))
  if (!Number.isFinite(n)) return ''
  if (n < 1) n = 1
  if (n > 365) n = 365
  const d = new Date(2023, 0, 1)
  d.setDate(n)
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`
}

export function dvFullDaily(title, refreshN = 0) {
  const rnd = rng(dvHash(title) + refreshN * 9973)
  let v = 5500 + rnd() * 3500
  const out = []
  const ph = rnd() * 6.28
  const drift = (rnd() - 0.48) * 2.2
  const d = new Date(2019, 0, 1)
  const end = new Date(2026, 11, 31)
  let i = 0
  while (d <= end) {
    v += (rnd() - 0.5) * 90 + drift + Math.sin(i / 18 + ph) * 28 + Math.sin(i / 55 + ph * 2) * 55
    if (v < 4800) v = 4800 + rnd() * 120
    if (v > 13500) v = 13500 - rnd() * 120
    out.push({ date: fmtYMD(d), value: +v.toFixed(1) })
    d.setDate(d.getDate() + 1)
    i++
  }
  return out
}

function filterDaily(rows, range) {
  let list = rows.slice()
  if (range.mode === 'recent' && range.years > 0) {
    const last = parseYMD(list[list.length - 1].date)
    const start = new Date(last.getFullYear() - range.years, last.getMonth(), last.getDate())
    const startS = fmtYMD(start)
    list = list.filter((r) => r.date >= startS)
  } else if (range.mode === 'range') {
    if (range.from) list = list.filter((r) => r.date >= range.from)
    if (range.to) list = list.filter((r) => r.date <= range.to)
  }
  return list.length ? list : rows.slice()
}

export function seasonFlat(title, range, mode, refreshN = 0) {
  const rows = filterDaily(dvFullDaily(title, refreshN), range)
  const flat = []
  if (mode === 'cny') {
    rows.forEach((r) => {
      const d = parseYMD(r.date)
      const y = d.getFullYear()
      const cnyStr = CNY_DATES[y]
      if (!cnyStr) return
      const cny = parseYMD(cnyStr)
      const offset = Math.round((d - cny) / 86400000)
      if (offset < -60 || offset > 300) return
      flat.push({ x: offset, value: r.value, year: String(y), tip: r.date, xLabel: offset })
    })
  } else {
    rows.forEach((r) => {
      const d = parseYMD(r.date)
      let doy = dayOfYear(d)
      if (doy > 365) doy = 365
      flat.push({
        x: doy,
        value: r.value,
        year: String(d.getFullYear()),
        tip: r.date,
        xLabel: `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`,
      })
    })
  }
  return flat
}

export function seasonYears(flat) {
  const set = new Set()
  const arr = []
  flat.forEach((r) => {
    if (!set.has(r.year)) {
      set.add(r.year)
      arr.push(r.year)
    }
  })
  return arr.sort()
}

function tipCfg() {
  return {
    title: (d) => String(d.date).replace(/-/g, '/'),
    items: [{
      channel: 'y',
      valueFormatter: (v) => Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    }],
  }
}

function newChart(el) {
  return new Chart({
    container: el,
    autoFit: true,
    height: Math.max(el.clientHeight || 0, 480),
    paddingLeft: 48,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 26,
    theme: 'light',
  })
}

export function paintLineChart(el, title, range, yoyOn, unit, refreshN = 0) {
  const { main, yoy } = lineSeries(title, range, yoyOn, refreshN)
  const colorDomain = yoy.length ? [title, '去年同期'] : [title]
  const colorRange = yoy.length ? [DV_LINE_COLOR, '#9aa0ad'] : [DV_LINE_COLOR]
  const chart = newChart(el)
  const tip = tipCfg()
  chart
    .line()
    .data(main)
    .encode('x', 'date')
    .encode('y', 'value')
    .encode('color', 'name')
    .encode('series', 'name')
    .style('lineWidth', 3)
    .style('lineCap', 'round')
    .style('lineJoin', 'round')
    .style('stroke', DV_LINE_COLOR)
    .scale('color', { domain: colorDomain, range: colorRange })
    .axis('x', {
      labelFormatter: (v) => String(v).slice(2).replace('-', '/'),
      label: { style: { fill: '#9aa0ad', fontSize: 11 } },
      tick: { style: { stroke: '#e3e6eb' } },
      line: { style: { stroke: '#e3e6eb' } },
      title: false,
    })
    .axis('y', {
      labelFormatter: (v) => Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 1 }),
      label: { style: { fill: '#9aa0ad', fontSize: 11 } },
      grid: { line: { style: { stroke: '#f0f1f4' } } },
      title: unit || false,
    })
    .legend(false)
    .tooltip(tip)
  if (yoy.length) {
    chart
      .line()
      .data(yoy)
      .encode('x', 'date')
      .encode('y', 'value')
      .encode('color', 'name')
      .encode('series', 'name')
      .style('lineWidth', 2)
      .style('lineDash', [6, 4])
      .style('shape', 'smooth')
      .style('stroke', '#9aa0ad')
      .scale('color', { domain: colorDomain, range: colorRange })
      .axis(false)
      .legend(false)
      .tooltip(tip)
  }
  chart.render()
  return {
    chart,
    legend: yoy.length
      ? [{ name: title, color: DV_LINE_COLOR }, { name: '去年同期', color: '#9aa0ad', dash: true }]
      : [{ name: title, color: DV_LINE_COLOR }],
  }
}

export function paintSeasonChart(el, title, range, mode, unit, refreshN = 0) {
  const flat = seasonFlat(title, range, mode, refreshN)
  const years = seasonYears(flat)
  const colors = years.map((_, i) => SEASON_YEAR_COLORS[i % SEASON_YEAR_COLORS.length])
  const chart = newChart(el)
  const xFmt = mode === 'cny'
    ? (v) => {
      const n = Math.round(Number(v))
      if (n === 0) return '春节'
      return `${n > 0 ? '+' : ''}${n}天`
    }
    : (v) => doyToMMDD(v)
  chart.data(flat)
  chart
    .line()
    .encode('x', 'x')
    .encode('y', 'value')
    .encode('color', 'year')
    .encode('series', 'year')
    .style('lineWidth', 2)
    .style('shape', 'smooth')
    .scale('color', { domain: years, range: colors })
    .scale('x', { nice: true })
    .axis('x', {
      labelFormatter: xFmt,
      label: { style: { fill: '#9aa0ad', fontSize: 11 } },
      tick: { style: { stroke: '#e3e6eb' } },
      line: { style: { stroke: '#e3e6eb' } },
      title: false,
      tickCount: mode === 'cny' ? 7 : 4,
    })
    .axis('y', {
      labelFormatter: (v) => Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 0 }),
      label: { style: { fill: '#9aa0ad', fontSize: 11 } },
      grid: { line: { style: { stroke: '#f0f1f4' } } },
      title: unit || false,
    })
    .legend(false)
    .tooltip({
      title: (d) => {
        if (mode === 'cny') {
          const n = Math.round(Number(d.x))
          const rel = n === 0 ? '春节' : `${n > 0 ? '春节后' : '春节前'}${Math.abs(n)}天`
          return `${d.year}年 · ${rel}（${String(d.tip).replace(/-/g, '/')}）`
        }
        return `${d.year}年 · ${d.xLabel || doyToMMDD(d.x)}（${String(d.tip).replace(/-/g, '/')}）`
      },
      items: [{
        channel: 'y',
        valueFormatter: (v) => Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      }],
    })
  chart.render()
  return {
    chart,
    legend: years.map((y, i) => ({ name: `${y}年`, color: colors[i] })),
  }
}

export function lineageOf(card, cards) {
  const title = card?.title || ''
  if (title === '五大材周度消费量同比' || /五大材/.test(title)) {
    return {
      root: '五大材周度消费量同比',
      formulaRoot: '计算公式：同比（本期 / 去年同期 − 1）',
      mid: '五大材周度消费量',
      formulaMid: '计算公式：\nA+B+C+D+E，全部',
      leaves: [
        { name: '螺纹钢: 消费量: 中国 (周) (A)', source: '来源于上海钢联' },
        { name: '线材: 消费量: 中国 (周) (B)', source: '来源于上海钢联' },
        { name: '热轧板卷: 消费量: 中国 (周) (C)', source: '来源于上海钢联' },
        { name: '冷轧板卷: 消费量: 中国 (周) (D)', source: '来源于上海钢联' },
        { name: '中厚板: 消费量: 中国 (周) (E)', source: '来源于上海钢联' },
      ],
    }
  }
  const ct = card?.calcType || '指标运算'
  let base = title.replace(/同比|环比|累计|差值|均值/g, '') || title
  if (base === title) base = `${title}·成分`
  const dir = card?.dir || ''
  const samples = (cards || []).filter((c) => c.dir === dir && c.title !== title).slice(0, 5)
  const letters = 'ABCDEFGH'
  while (samples.length < 3) samples.push({ title: `${dir}·成分指标${samples.length + 1}`, source: card?.source || '手工' })
  return {
    root: title,
    formulaRoot: `计算公式：${ct}`,
    mid: base,
    formulaMid: `计算公式：\n${samples.map((_, i) => letters[i]).join('+')}，全部`,
    leaves: samples.map((c, i) => ({
      name: `${c.title} (${letters[i]})`,
      source: `来源于${c.source || '手工'}`,
    })),
  }
}

export function copyMonthlyTsv(title, refreshN = 0) {
  const data = dvMonthly(title, refreshN)
  return `日期\t${title}\n` + data.map((v, i) => `${DV_MONTHS[i]}\t${v}`).join('\n')
}
