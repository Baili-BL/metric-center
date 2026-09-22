export const PIVOT_AGGS = [
  { id: 'sum', name: '求和' },
  { id: 'count', name: '计数' },
  { id: 'avg', name: '平均值' },
  { id: 'max', name: '最大值' },
  { id: 'min', name: '最小值' },
]

export function emptyPivot() {
  return {
    open: false,
    headers: [],
    rows: [],
    range: null,
    sourceName: '',
    filters: [],
    rowsF: [],
    cols: [],
    values: [],
    out: null,
    outName: '',
  }
}

export function colName(n) {
  let s = ''
  let x = n + 1
  while (x > 0) {
    x -= 1
    s = String.fromCharCode(65 + (x % 26)) + s
    x = Math.floor(x / 26)
  }
  return s
}

export function cellPlain(cell) {
  if (!cell) return { kind: 'empty' }
  let v = cell.v
  if (v && typeof v === 'object' && v.v != null) v = v.v
  if (v == null && cell.p?.body?.dataStream) {
    v = String(cell.p.body.dataStream).replace(/\r?\n/g, '').replace(/\u0000/g, '')
  }
  if (v == null || v === '') return { kind: 'empty' }
  if (cell.t === 2 || cell.t === 'n' || typeof v === 'number') {
    const n = Number(v)
    if (Number.isFinite(n)) return { kind: 'n', v: n }
  }
  return { kind: 's', v: String(v) }
}

export function sheetUsedRange(sheet) {
  const cellData = sheet?.cellData || {}
  let maxR = -1
  let maxC = -1
  Object.keys(cellData).forEach((rk) => {
    const r = Number(rk)
    if (!Number.isFinite(r)) return
    Object.keys(cellData[r] || {}).forEach((ck) => {
      const cell = cellData[r][ck]
      const p = cellPlain(cell)
      if (p.kind === 'empty' && !(cell && cell.s)) return
      maxR = Math.max(maxR, r)
      maxC = Math.max(maxC, Number(ck) || 0)
    })
  })
  if (maxR < 0) return null
  return { startRow: 0, startColumn: 0, endRow: maxR, endColumn: maxC }
}

export function extractPivotSource(sheet, range) {
  const cellData = sheet?.cellData || {}
  const headers = []
  for (let c = range.startColumn; c <= range.endColumn; c++) {
    const cell = cellData[range.startRow]?.[c]
    const p = cellPlain(cell)
    headers.push(p.kind === 'empty' ? `列${colName(c)}` : String(p.v))
  }
  const rows = []
  for (let r = range.startRow + 1; r <= range.endRow; r++) {
    const row = []
    let empty = true
    for (let c = range.startColumn; c <= range.endColumn; c++) {
      const p = cellPlain(cellData[r]?.[c])
      const v = p.kind === 'empty' ? '' : p.v
      if (v !== '') empty = false
      row.push(v)
    }
    if (!empty) rows.push(row)
  }
  return { headers, rows }
}

export function parseA1Range(text) {
  const raw = String(text || '').trim().replace(/^.*!/, '').replace(/\$/g, '')
  const m = raw.toUpperCase().match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/)
  if (!m) return null
  const col = (s) => {
    let n = 0
    for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64)
    return n - 1
  }
  const a = { startRow: Number(m[2]) - 1, startColumn: col(m[1]), endRow: Number(m[4]) - 1, endColumn: col(m[3]) }
  if (a.endRow < a.startRow) { const t = a.startRow; a.startRow = a.endRow; a.endRow = t }
  if (a.endColumn < a.startColumn) { const t = a.startColumn; a.startColumn = a.endColumn; a.endColumn = t }
  return a
}

export function parseA1Cell(text) {
  const raw = String(text || '').trim().replace(/^.*!/, '').replace(/\$/g, '')
  const m = raw.toUpperCase().match(/^([A-Z]+)(\d+)$/)
  if (!m) return null
  let n = 0
  const s = m[1]
  for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64)
  return { row: Number(m[2]) - 1, col: n - 1 }
}

export function absRangeRef(name, range) {
  return `${name}!$${colName(range.startColumn)}$${range.startRow + 1}:$${colName(range.endColumn)}$${range.endRow + 1}`
}

export function absCellRef(name, row, col) {
  return `${name}!$${colName(col)}$${row + 1}`
}

export function listWorkbookSheets(wb) {
  if (!wb?.sheets) return []
  const ids = wb.sheetOrder?.length ? wb.sheetOrder.slice() : Object.keys(wb.sheets)
  const seen = {}
  return ids.map((id, i) => wb.sheets[id]).filter(Boolean).map((sh, i) => {
    let name = String(sh.name || `Sheet${i + 1}`).slice(0, 31) || `Sheet${i + 1}`
    const base = name
    let n = 2
    while (seen[name]) { name = `${base.slice(0, 28)}_${n}`; n++ }
    seen[name] = true
    return { name, sheet: sh }
  })
}

export function fieldUsed(state, idx) {
  if (state.rowsF.includes(idx) || state.cols.includes(idx)) return true
  if (state.filters.some((f) => f.idx === idx)) return true
  if (state.values.some((v) => v.idx === idx)) return true
  return false
}

export function uniqueFieldValues(rows, idx) {
  const seen = {}
  const list = []
  rows.forEach((row) => {
    const v = row[idx] == null ? '' : row[idx]
    const k = String(v)
    if (!seen[k]) { seen[k] = true; list.push(v) }
  })
  return list
}

export function fieldIsNumber(rows, idx) {
  let n = 0
  let t = 0
  rows.forEach((row) => {
    if (row[idx] === '' || row[idx] == null) return
    t++
    if (typeof row[idx] === 'number') n++
  })
  return t > 0 && n * 2 >= t
}

export function removeField(state, idx) {
  state.rowsF = state.rowsF.filter((i) => i !== idx)
  state.cols = state.cols.filter((i) => i !== idx)
  state.filters = state.filters.filter((f) => f.idx !== idx)
  state.values = state.values.filter((v) => v.idx !== idx)
}

export function addFieldTo(state, idx, zone) {
  removeField(state, idx)
  if (zone === 'rows') state.rowsF.push(idx)
  else if (zone === 'cols') state.cols.push(idx)
  else if (zone === 'filters') {
    const selected = {}
    uniqueFieldValues(state.rows, idx).forEach((v) => { selected[String(v)] = true })
    state.filters.push({ idx, selected })
  } else if (zone === 'values') {
    state.values.push({ idx, agg: fieldIsNumber(state.rows, idx) ? 'sum' : 'count' })
  }
}

export function guessZone(state, idx) {
  return fieldIsNumber(state.rows, idx) ? 'values' : 'rows'
}

export function aggName(id) {
  return PIVOT_AGGS.find((a) => a.id === id)?.name || id
}

export function valueLabel(state, v) {
  return `${aggName(v.agg)}项:${state.headers[v.idx] || ''}`
}

export function filterLabel(state, f) {
  const name = state.headers[f.idx] || ''
  const keys = Object.keys(f.selected || {})
  const on = keys.filter((k) => f.selected[k])
  if (!keys.length || on.length === keys.length) return name
  if (!on.length) return `${name} (无)`
  if (on.length === 1) return `${name} (${on[0]})`
  return `${name} (${on.length} 项)`
}

function applyPivotFilters(state, rows) {
  return rows.filter((row) => state.filters.every((f) => {
    const selected = f.selected || {}
    const keys = Object.keys(selected)
    if (!keys.length) return true
    const on = keys.filter((k) => selected[k])
    if (on.length === keys.length || !on.length) return true
    return !!selected[String(row[f.idx] == null ? '' : row[f.idx])]
  }))
}

function comboKey(row, idxs) {
  return idxs.map((i) => String(row[i] == null ? '' : row[i])).join('\x1f')
}

function uniqueCombos(rows, idxs) {
  if (!idxs.length) return [[]]
  const seen = {}
  const list = []
  rows.forEach((row) => {
    const parts = idxs.map((i) => (row[i] == null ? '' : row[i]))
    const k = parts.map(String).join('\x1f')
    if (!seen[k]) { seen[k] = true; list.push(parts) }
  })
  return list
}

function round2(n) { return Math.round(n * 100) / 100 }

function aggValues(arr, agg) {
  if (agg === 'count') return arr.filter((v) => v !== '' && v != null).length
  const nums = arr.map(Number).filter((n) => Number.isFinite(n))
  if (!nums.length) return ''
  if (agg === 'avg') return round2(nums.reduce((a, b) => a + b, 0) / nums.length)
  if (agg === 'max') return Math.max(...nums)
  if (agg === 'min') return Math.min(...nums)
  return round2(nums.reduce((a, b) => a + b, 0))
}

export function buildPivotMatrix(state) {
  const headers = state.headers
  const rows = applyPivotFilters(state, state.rows)
  const rowIdxs = state.rowsF.slice()
  const colIdxs = state.cols.slice()
  const vals = state.values.length ? state.values.slice() : [{ idx: -1, agg: 'count', implicit: true }]
  if (!rowIdxs.length && !colIdxs.length && !state.values.length) return []
  const rowCombos = uniqueCombos(rows, rowIdxs)
  const colCombos = uniqueCombos(rows, colIdxs)
  const buckets = {}
  rows.forEach((row) => {
    const rk = comboKey(row, rowIdxs)
    const ck = comboKey(row, colIdxs)
    if (!buckets[rk]) buckets[rk] = {}
    if (!buckets[rk][ck]) buckets[rk][ck] = []
    buckets[rk][ck].push(row)
  })
  const pick = (list, val) => (val.implicit ? list : list.map((row) => row[val.idx]))
  const aggAt = (rk, ck, val) => aggValues(pick((buckets[rk] || {})[ck] || [], val), val.agg)
  const aggRow = (rk, val) => {
    let all = []
    colCombos.forEach((ckParts) => {
      all = all.concat((buckets[rk] || {})[ckParts.map(String).join('\x1f')] || [])
    })
    return aggValues(pick(all, val), val.agg)
  }
  const aggCol = (ck, val) => {
    let all = []
    rowCombos.forEach((rkParts) => {
      all = all.concat((buckets[rkParts.map(String).join('\x1f')] || {})[ck] || [])
    })
    return aggValues(pick(all, val), val.agg)
  }
  const aggAll = (val) => aggValues(pick(rows, val), val.agg)
  const showColTotal = colIdxs.length > 0
  const showRowTotal = rowIdxs.length > 0
  const twoHead = colIdxs.length > 0 && vals.length > 1
  const leftW = Math.max(rowIdxs.length, 1)
  const matrix = []
  if (twoHead) {
    const top = []
    for (let i = 0; i < leftW; i++) top.push(i === 0 ? (headers[rowIdxs[0]] || '') : '')
    colCombos.forEach((parts) => {
      const name = parts.map(String).join(' / ')
      vals.forEach((_, vi) => { top.push(vi === 0 ? name : '') })
    })
    if (showColTotal) vals.forEach((_, vi) => { top.push(vi === 0 ? '总计' : '') })
    matrix.push(top)
    const sub = []
    for (let r = 0; r < leftW; r++) sub.push(headers[rowIdxs[r]] || '')
    colCombos.forEach(() => { vals.forEach((v) => { sub.push(valueLabel(state, v)) }) })
    if (showColTotal) vals.forEach((v) => { sub.push(valueLabel(state, v)) })
    matrix.push(sub)
  } else {
    const head = []
    if (rowIdxs.length) rowIdxs.forEach((idx) => { head.push(headers[idx]) })
    else head.push('')
    if (colIdxs.length) {
      colCombos.forEach((parts) => {
        const name = parts.map(String).join(' / ')
        vals.forEach((v) => { head.push(vals.length === 1 ? name : `${name} ${valueLabel(state, v)}`) })
      })
    } else {
      vals.forEach((v) => { head.push(v.implicit ? '计数' : valueLabel(state, v)) })
    }
    if (showColTotal) {
      vals.forEach((v) => { head.push(vals.length === 1 ? '总计' : `总计 ${valueLabel(state, v)}`) })
    }
    matrix.push(head)
  }
  const dataLine = (rkParts, isTotal) => {
    const rk = rkParts.map(String).join('\x1f')
    const line = []
    if (isTotal) {
      line.push('总计')
      for (let p = 1; p < leftW; p++) line.push('')
    } else if (rowIdxs.length) {
      rkParts.forEach((part) => { line.push(part) })
    } else line.push('')
    colCombos.forEach((ckParts) => {
      const ck = ckParts.map(String).join('\x1f')
      vals.forEach((v) => { line.push(isTotal ? aggCol(ck, v) : aggAt(rk, ck, v)) })
    })
    if (showColTotal) vals.forEach((v) => { line.push(isTotal ? aggAll(v) : aggRow(rk, v)) })
    return line
  }
  if (!rowIdxs.length) matrix.push(dataLine([], false))
  else {
    rowCombos.forEach((parts) => { matrix.push(dataLine(parts, false)) })
    if (showRowTotal) matrix.push(dataLine([], true))
  }
  return matrix
}

export function writePivotToSheet(sheet, matrix, startRow, startCol, headerRows, prev) {
  if (!sheet) return false
  if (!sheet.cellData) sheet.cellData = {}
  if (prev?.rows && prev?.cols) {
    for (let rr = 0; rr < prev.rows; rr++) {
      const r0 = prev.startRow + rr
      if (!sheet.cellData[r0]) continue
      for (let cc = 0; cc < prev.cols; cc++) delete sheet.cellData[r0][prev.startColumn + cc]
    }
  }
  matrix.forEach((row, ri) => {
    const r = startRow + ri
    if (!sheet.cellData[r]) sheet.cellData[r] = {}
    row.forEach((v, ci) => {
      const n = typeof v === 'number' && Number.isFinite(v)
      const cell = n ? { v, t: 2 } : { v: String(v == null ? '' : v), t: 1 }
      if (ri < headerRows) cell.s = { bl: 1, bg: { rgb: '#E8F3FF' }, ht: 2 }
      sheet.cellData[r][startCol + ci] = cell
    })
  })
  sheet.rowCount = Math.max(sheet.rowCount || 0, startRow + matrix.length + 4)
  sheet.columnCount = Math.max(sheet.columnCount || 0, startCol + (matrix[0]?.length || 0) + 4)
  return true
}

export function toPivotConfig(state) {
  return {
    range: state.range,
    sourceName: state.sourceName,
    outName: state.outName,
    filters: state.filters,
    rowsF: state.rowsF,
    cols: state.cols,
    values: state.values,
    out: state.out,
  }
}

export function applyPivotConfig(state, cfg) {
  if (!cfg) return
  if (cfg.range) state.range = cfg.range
  if (cfg.sourceName) state.sourceName = cfg.sourceName
  if (cfg.outName) state.outName = cfg.outName
  state.filters = cfg.filters || []
  state.rowsF = cfg.rowsF || []
  state.cols = cfg.cols || []
  state.values = cfg.values || []
  state.out = cfg.out || null
}
