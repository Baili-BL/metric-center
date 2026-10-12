import { cfIconGlyphHtml, cfIconGlyphs } from './cf-icons'

function asCellMap(cellData) {
  if (!cellData) return {}
  if (!Array.isArray(cellData)) return cellData
  const map = {}
  cellData.forEach((row, r) => {
    if (Array.isArray(row)) {
      map[r] = {}
      row.forEach((cell, c) => {
        if (cell != null && cell !== '') map[r][c] = typeof cell === 'object' ? cell : { v: cell }
      })
    } else if (row && typeof row === 'object') map[r] = row
  })
  return map
}

function getCell(cellData, r, c) {
  const line = cellData[r] || cellData[String(r)] || {}
  return line[c] ?? line[String(c)]
}

function cellPlain(cell) {
  if (cell == null || cell === '') return ''
  if (typeof cell !== 'object') return String(cell)
  if (cell.m != null && cell.m !== '') return String(cell.m)
  if (cell.v != null && cell.v !== '') {
    return typeof cell.v === 'object' ? cellPlain(cell.v) : String(cell.v)
  }
  return ''
}

const GLYPH_RE = /[↑→↓↗↘▲▼▬●⬤◆✓✕!⚑★☆▂▃▄█▁◕◑◔○▣□]/g

function cellNumber(cell) {
  if (cell == null || cell === '') return NaN
  if (typeof cell === 'number') return cell
  if (typeof cell !== 'object') {
    const t = String(cell).replace(/,/g, '').trim()
    if (t.endsWith('%')) {
      const n = Number(t.slice(0, -1))
      return Number.isFinite(n) ? n / 100 : NaN
    }
    return Number(t)
  }
  const raw = cell.v
  if (typeof raw === 'number') return raw
  const text = String(raw ?? cell.m ?? '').replace(GLYPH_RE, '').replace(/,/g, '').trim()
  if (!text) return NaN
  if (text.endsWith('%')) {
    const n = Number(text.slice(0, -1))
    return Number.isFinite(n) ? n / 100 : NaN
  }
  return Number(text)
}

function cellFa(cell) {
  return cell?.s?.ct?.fa || cell?.ct?.fa || ''
}

function compareValue(raw, sample) {
  if (raw == null || raw === '') return NaN
  const text = String(raw).trim()
  if (!text) return NaN
  if (text.endsWith('%')) {
    const n = Number(text.slice(0, -1))
    return Number.isFinite(n) ? n / 100 : NaN
  }
  const n = Number(text.replace(/,/g, ''))
  if (!Number.isFinite(n)) return NaN
  if (cellFa(sample).includes('%') && Math.abs(n) >= 1) return n / 100
  return n
}

function inRange(ranges, r, c) {
  return (ranges || []).some((range) => {
    const row = range?.row
    const col = range?.column
    if (!row || !col) return false
    return r >= row[0] && r <= row[1] && c >= col[0] && c <= col[1]
  })
}

function eachRangeCell(ranges, fn) {
  ;(ranges || []).forEach((range) => {
    const row = range?.row
    const col = range?.column
    if (!row || !col) return
    for (let r = row[0]; r <= row[1]; r += 1) {
      for (let c = col[0]; c <= col[1]; c += 1) fn(r, c)
    }
  })
}

function parseRgb(color) {
  const s = String(color || '').trim()
  const rgb = s.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]]
  const hex = s.replace(/^#/, '')
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    const n = parseInt(hex, 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
    ]
  }
  return [255, 255, 255]
}

function mixRgb(a, b, t) {
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(', ')})`
}

function scaleColor(format, t) {
  const cols = (format || []).map(parseRgb)
  if (cols.length < 2) return format?.[0] || ''
  if (cols.length === 2) return mixRgb(cols[0], cols[1], t)
  if (t <= 0.5) return mixRgb(cols[0], cols[1], t * 2)
  return mixRgb(cols[1], cols[2], (t - 0.5) * 2)
}

function collectRules(sheet) {
  const cf = sheet?.fortune?.conditionformat || sheet?.luckysheet_conditionformat_save || []
  const bars = sheet?.fortune?.dataBars || sheet?.config?.fs_data_bars || sheet?.fs_data_bars || []
  return { cf: Array.isArray(cf) ? cf : [], bars: Array.isArray(bars) ? bars : [] }
}

function highlightHit(name, values, cell, n, stats) {
  const sample = stats.sample
  const threshold = compareValue(values[0], sample)
  const threshold2 = compareValue(values[1], sample)
  if (name === 'greaterThan') return Number.isFinite(n) && Number.isFinite(threshold) && n > threshold
  if (name === 'lessThan') return Number.isFinite(n) && Number.isFinite(threshold) && n < threshold
  if (name === 'equal') {
    return Number.isFinite(n) && Number.isFinite(threshold)
      ? n === threshold
      : cellPlain(cell) === String(values[0] ?? '')
  }
  if (name === 'between') {
    const lo = Math.min(threshold, threshold2)
    const hi = Math.max(threshold, threshold2)
    return Number.isFinite(n) && Number.isFinite(lo) && Number.isFinite(hi) && n >= lo && n <= hi
  }
  if (name === 'textContains') return cellPlain(cell).includes(String(values[0] ?? ''))
  if (name === 'duplicateValue') {
    const key = cellPlain(cell)
    const count = stats.counts[key] || 0
    return String(values[0] ?? '0') === '1' ? count === 1 : count > 1
  }
  if (name === 'aboveAverage') return Number.isFinite(n) && n > stats.avg
  if (name === 'belowAverage') return Number.isFinite(n) && n < stats.avg
  const rankN = Math.max(1, Number(values[0]) || 10)
  if (name === 'top10') return Number.isFinite(n) && stats.sortedDesc.indexOf(n) < rankN
  if (name === 'last10') return Number.isFinite(n) && stats.sortedAsc.indexOf(n) < rankN
  if (name === 'top10_percent') {
    const cut = stats.sortedDesc[Math.max(0, Math.ceil(stats.sortedDesc.length * rankN / 100) - 1)]
    return Number.isFinite(n) && Number.isFinite(cut) && n >= cut
  }
  if (name === 'last10_percent') {
    const cut = stats.sortedAsc[Math.max(0, Math.ceil(stats.sortedAsc.length * rankN / 100) - 1)]
    return Number.isFinite(n) && Number.isFinite(cut) && n <= cut
  }
  return false
}

function rangeStats(cellData, ranges) {
  const cells = []
  const counts = {}
  eachRangeCell(ranges, (r, c) => {
    const cell = getCell(cellData, r, c)
    const n = cellNumber(cell)
    const key = cellPlain(cell)
    counts[key] = (counts[key] || 0) + 1
    cells.push({ r, c, cell, n, key })
  })
  const nums = cells.map((x) => x.n).filter((n) => Number.isFinite(n))
  const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
  return {
    cells,
    counts,
    avg,
    sample: cells.find((x) => Number.isFinite(x.n))?.cell,
    sortedAsc: [...nums].sort((a, b) => a - b),
    sortedDesc: [...nums].sort((a, b) => b - a),
    min: nums.length ? Math.min(...nums) : 0,
    max: nums.length ? Math.max(...nums) : 0,
  }
}

function ensureStyle(map, r, c) {
  const key = `${r}:${c}`
  let cur = map.get(key)
  if (!cur) {
    cur = {}
    map.set(key, cur)
  }
  return cur
}

const KIND_MARK = {
  arrowUp: '↑',
  arrowDown: '↓',
  arrowRight: '→',
  arrowUpRight: '↗',
  arrowDownRight: '↘',
  triUp: '▲',
  triDown: '▼',
  bar: '▬',
  circle: '●',
  circleRim: '⬤',
  check: '✓',
  cross: '✕',
  bang: '!',
  flag: '⚑',
  star: '★',
  starEmpty: '☆',
}

function kindMark(glyph) {
  if (!glyph) return ''
  if (glyph.special === 'signal') return ['▂', '▃', '█'][Math.max(0, (glyph.level || 1) - 1)] || '▃'
  if (glyph.special === 'pie') return ['○', '◔', '◑', '◕', '●'][glyph.filled] || '◑'
  return KIND_MARK[glyph.kind] || ''
}

const VISUAL_TYPES = new Set(['colorGradation', 'dataBar', 'icons'])

/** 把工作表条件格式算成单元格叠加样式（高亮/色阶/数据条/图标集） */
export function cfOverlayMap(sheet) {
  const cellData = asCellMap(sheet?.cellData)
  const { cf, bars } = collectRules(sheet)
  const map = new Map()
  if (!cf.length && !bars.length) return map

  cf.forEach((rule) => {
    if (!rule) return
    const type = rule.type
    const ranges = rule.cellrange || []
    if (!ranges.length) return
    const stats = rangeStats(cellData, ranges)

    if (type === 'colorGradation' && Array.isArray(rule.format) && rule.format.length) {
      const span = stats.max - stats.min
      stats.cells.forEach(({ r, c, n }) => {
        if (!Number.isFinite(n)) return
        const t = span === 0 ? 0.5 : (n - stats.min) / span
        ensureStyle(map, r, c).bg = scaleColor(rule.format, t)
      })
      return
    }

    if (type === 'icons') {
      const glyphs = rule.glyphs || cfIconGlyphs(rule)
      const count = Math.max(1, glyphs.length || 3)
      const span = stats.max - stats.min
      stats.cells.forEach(({ r, c, n }) => {
        if (!Number.isFinite(n)) return
        const t = span === 0 ? 1 : (n - stats.min) / span
        const bucket = Math.min(count - 1, Math.max(0, Math.floor((1 - t) * count)))
        const glyph = glyphs[bucket] || glyphs[0]
        const st = ensureStyle(map, r, c)
        st.icon = cfIconGlyphHtml(glyph, 12)
        if (glyph?.color) st.iconColor = glyph.color
        st.iconMark = glyph?.mark || kindMark(glyph) || rule.marks?.[bucket] || ''
      })
      return
    }

    if (type === 'dataBar') {
      applyBar(map, stats, rule.format)
      return
    }

    if (VISUAL_TYPES.has(type)) return
    const name = rule.conditionName || type
    if (!name || name === 'default' || name === 'formula' || name === 'occurrenceDate') return
    const format = rule.format || {}
    const bg = format.cellColor || format.bg || ''
    const color = format.textColor || format.fc || ''
    const bold = !!format.bl
    if (!bg && !color && !bold) return
    stats.cells.forEach(({ r, c, cell, n }) => {
      if (!highlightHit(name, rule.conditionValue || [], cell, n, stats)) return
      const st = ensureStyle(map, r, c)
      if (bg) st.bg = bg
      if (color) st.color = color
      if (bold) st.bold = true
    })
  })

  bars.forEach((rule) => {
    if (!rule) return
    const stats = rangeStats(cellData, rule.cellrange || [])
    applyBar(map, stats, rule.format)
  })

  return map
}

function applyBar(map, stats, format) {
  const color = format?.[0] || '#638ec6'
  const color2 = format?.[1] || ''
  const span = stats.max - stats.min
  stats.cells.forEach(({ r, c, n }) => {
    if (!Number.isFinite(n)) return
    const t = span === 0 ? 1 : Math.max(0, Math.min(1, (n - stats.min) / span))
    ensureStyle(map, r, c).bar = { pct: t, color, color2 }
  })
}

export function mergeCfStyle(base, overlay) {
  if (!overlay) return base
  const next = { ...base }
  if (overlay.bg) next.bg = overlay.bg
  if (overlay.color) next.color = overlay.color
  if (overlay.bold) next.bold = true
  if (overlay.icon) next.icon = overlay.icon
  if (overlay.iconMark) next.iconMark = overlay.iconMark
  if (overlay.iconColor) next.iconColor = overlay.iconColor
  if (overlay.bar) next.bar = overlay.bar
  return next
}
