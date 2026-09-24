import ExcelJS from 'exceljs'

export function normalizeWorkbook(raw) {
  if (!raw || typeof raw !== 'object') return raw
  if (raw.sheets) return raw
  if (raw.workbook?.sheets) return { ...raw.workbook, resources: raw.resources }
  if (raw.snapshot?.sheets) return raw.snapshot
  return raw
}

export function firstSheet(wb) {
  const data = normalizeWorkbook(wb)
  if (!data?.sheets) return null
  const order = data.sheetOrder?.[0]
  return (order && data.sheets[order]) || data.sheets[Object.keys(data.sheets)[0]]
}

export function cellText(cell) {
  if (cell == null || cell === '') return ''
  if (typeof cell !== 'object') return String(cell)
  if (cell.v != null && cell.v !== '') {
    return typeof cell.v === 'object' ? cellText(cell.v) : String(cell.v)
  }
  const stream = cell.p?.body?.dataStream
  if (stream) return String(stream).replace(/[\u0000-\u0002\r\n]+/g, '').trim()
  if (cell.f) return String(cell.f)
  return ''
}

export function valuesToCellData(values, startRow = 0, startCol = 0) {
  const cellData = {}
  ;(values || []).forEach((row, ri) => {
    if (!row) return
    const r = startRow + ri
    ;(Array.isArray(row) ? row : []).forEach((v, ci) => {
      if (v == null || v === '') return
      if (!cellData[r]) cellData[r] = {}
      cellData[r][startCol + ci] = typeof v === 'number' ? { v, t: 2 } : { v: String(v), t: 1 }
    })
  })
  return cellData
}

function trimPreview(rows) {
  let lastR = -1
  let colMax = 0
  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell) {
        lastR = r
        colMax = Math.max(colMax, c)
      }
    })
  })
  if (lastR < 0) return []
  return rows.slice(0, lastR + 1).map((row) => row.slice(0, colMax + 1))
}

export function previewFromMatrix(values, maxR = 16, maxC = 10) {
  if (!values?.length) return []
  const rows = values.slice(0, maxR).map((row) => {
    const cells = Array.isArray(row) ? row : []
    const out = []
    for (let c = 0; c < maxC; c++) out.push(cells[c] == null ? '' : String(cells[c]))
    return out
  })
  return trimPreview(rows)
}

function asCellMap(cellData) {
  if (!cellData) return null
  if (Array.isArray(cellData)) {
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
  return cellData
}

function sheetList(wb) {
  const data = normalizeWorkbook(wb)
  if (!data?.sheets) return []
  if (data.sheetOrder?.length) return data.sheetOrder.map((id) => data.sheets[id]).filter(Boolean)
  return Object.values(data.sheets)
}

function filledCount(sheet) {
  const cellData = sheet?.cellData
  if (!cellData) return 0
  let n = 0
  Object.values(cellData).forEach((row) => {
    Object.values(row || {}).forEach((cell) => { if (cellText(cell)) n += 1 })
  })
  return n
}

export function pickPreviewSheet(wb) {
  const data = normalizeWorkbook(wb)
  const list = sheetList(data)
  if (!list.length) return null
  const preferred = data?.activeSheetId && data.sheets?.[data.activeSheetId]
  if (preferred && filledCount(preferred) > 0) return preferred
  let best = list[0]
  let score = filledCount(best)
  list.forEach((sh) => {
    const s = filledCount(sh)
    if (s > score) {
      best = sh
      score = s
    }
  })
  return best
}

function colorOf(v) {
  if (!v) return ''
  let rgb = typeof v === 'string' ? v : (v.rgb || v.value || '')
  if (!rgb) return ''
  rgb = String(rgb).trim()
  if (rgb.startsWith('rgb')) return rgb
  rgb = rgb.replace(/^0x/i, '').replace(/^#/, '')
  if (rgb.length === 8 && /^[0-9a-fA-F]+$/.test(rgb)) rgb = rgb.slice(2)
  if (rgb.length === 6 && /^[0-9a-fA-F]+$/.test(rgb)) return `#${rgb}`
  return ''
}

function cellStyleOf(cell, styles) {
  let s = cell?.s
  if (s != null && typeof s !== 'object') s = styles?.[s] || styles?.[String(s)]
  if (!s || typeof s !== 'object') return { bg: '', color: '', bold: false }
  return {
    bg: colorOf(s.bg),
    color: colorOf(s.cl),
    bold: !!s.bl,
  }
}

function trimPreviewGrid(rows) {
  let lastR = -1
  let colMax = 0
  rows.forEach((row, r) => {
    let acc = 0
    row.forEach((cell) => {
      const span = Number(cell?.colspan || 1)
      if (cell?.text || cell?.bg) {
        lastR = r
        colMax = Math.max(colMax, acc + span - 1)
      }
      acc += span
    })
  })
  if (lastR < 0) return []
  return rows.slice(0, lastR + 1).map((row) => {
    const out = []
    let acc = 0
    row.forEach((cell) => {
      if (acc > colMax) return
      const span = Number(cell?.colspan || 1)
      out.push({ ...cell, colspan: Math.min(span, colMax - acc + 1) })
      acc += span
    })
    return out
  })
}

export function previewGrid(wb, maxR = 16, maxC = 10) {
  const data = normalizeWorkbook(wb)
  const sheet = pickPreviewSheet(data)
  const cellData = asCellMap(sheet?.cellData)
  if (!cellData) return []
  const styles = data?.styles || sheet?.styles || {}
  const merges = sheet?.mergeData || []
  const skip = new Set()
  const rows = []
  for (let r = 0; r < maxR; r++) {
    const line = cellData[r] || cellData[String(r)] || {}
    const cells = []
    for (let c = 0; c < maxC; c++) {
      if (skip.has(`${r}:${c}`)) continue
      const raw = line[c] ?? line[String(c)]
      const st = cellStyleOf(raw, styles)
      const merge = merges.find((m) => Number(m.startRow) === r && Number(m.startColumn) === c)
      let colspan = 1
      if (merge) {
        colspan = Math.max(1, Math.min(maxC, Number(merge.endColumn) + 1) - c)
        for (let cc = c + 1; cc < c + colspan; cc++) skip.add(`${r}:${cc}`)
      }
      cells.push({
        text: cellText(raw),
        bg: st.bg,
        color: st.color,
        bold: st.bold,
        colspan,
      })
    }
    rows.push(cells)
  }
  return trimPreviewGrid(rows)
}

export function previewRows(wb, maxR = 16, maxC = 10) {
  if (wb?.__preview?.length) return wb.__preview
  const sheet = pickPreviewSheet(wb)
  const cellData = asCellMap(sheet?.cellData)
  if (!cellData) return []
  const rows = []
  for (let r = 0; r < maxR; r++) {
    const line = cellData[r] || cellData[String(r)] || {}
    const cells = []
    for (let c = 0; c < maxC; c++) {
      cells.push(cellText(line[c] ?? line[String(c)]))
    }
    rows.push(cells)
  }
  return trimPreview(rows)
}

export function headerFields(wb) {
  const row = previewRows(wb, 1, 12)[0] || []
  return row.filter(Boolean)
}

export function colLetter(n) {
  let s = ''
  let x = Number(n) + 1
  while (x > 0) {
    x -= 1
    s = String.fromCharCode(65 + (x % 26)) + s
    x = Math.floor(x / 26)
  }
  return s
}

function argbOf(hex) {
  if (!hex) return ''
  let h = String(hex).trim().replace(/^#/, '').replace(/^0x/i, '')
  if (h.length === 8 && /^[0-9a-fA-F]+$/.test(h)) return h.toUpperCase()
  if (h.length === 6 && /^[0-9a-fA-F]+$/.test(h)) return `FF${h.toUpperCase()}`
  return ''
}

function hexOfArgb(argb) {
  if (!argb) return ''
  const s = String(argb).replace(/^#/, '')
  if (s.length >= 6) return `#${s.slice(-6)}`
  return ''
}

function themeToHex(theme) {
  const map = ['#000000', '#FFFFFF', '#1F4E79', '#FFFFFF', '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47']
  return map[Number(theme)] || ''
}

function excelColor(c) {
  if (!c) return ''
  if (c.argb) return hexOfArgb(c.argb)
  if (c.theme != null) return themeToHex(c.theme)
  if (typeof c === 'string') return colorOf(c)
  return colorOf(c.rgb || c.value)
}

function styleFromUniver(cell, styles) {
  let s = cell?.s
  if (s != null && typeof s !== 'object') s = styles?.[s] || styles?.[String(s)]
  if (!s || typeof s !== 'object') return {}
  const out = {}
  const bg = colorOf(s.bg)
  const fg = colorOf(s.cl)
  if (bg) out.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argbOf(bg) } }
  const font = {}
  if (s.bl) font.bold = true
  if (fg) font.color = { argb: argbOf(fg) }
  if (s.fs) font.size = Number(s.fs) || undefined
  if (s.ff) font.name = s.ff
  if (Object.keys(font).length) out.font = font
  if (s.ht === 2) out.alignment = { horizontal: 'center', vertical: 'middle' }
  else if (s.ht === 3) out.alignment = { horizontal: 'right', vertical: 'middle' }
  else if (s.ht === 1) out.alignment = { horizontal: 'left', vertical: 'middle' }
  return out
}

function applyExcelStyle(target, style) {
  if (style.fill) target.fill = style.fill
  if (style.font) target.font = { ...(target.font || {}), ...style.font }
  if (style.alignment) target.alignment = { ...(target.alignment || {}), ...style.alignment }
}

function excelCellToUniver(cell) {
  const out = {}
  const raw = cell.value
  if (raw && typeof raw === 'object' && raw.richText) {
    out.v = raw.richText.map((t) => t.text || '').join('')
    out.t = 1
  } else if (raw && typeof raw === 'object' && raw.formula != null) {
    out.f = String(raw.formula)
    out.v = raw.result != null ? raw.result : ''
    out.t = typeof raw.result === 'number' ? 2 : 1
  } else if (raw && typeof raw === 'object' && raw.text != null && raw.hyperlink) {
    out.v = raw.text
    out.t = 1
  } else if (raw instanceof Date) {
    out.v = raw.toISOString().slice(0, 10)
    out.t = 1
  } else if (typeof raw === 'number') {
    out.v = raw
    out.t = 2
  } else if (typeof raw === 'boolean') {
    out.v = raw ? 'TRUE' : 'FALSE'
    out.t = 1
  } else if (raw != null && raw !== '') {
    out.v = String(raw)
    out.t = 1
  }
  const s = {}
  const bg = excelColor(cell.fill?.fgColor)
  const fg = excelColor(cell.font?.color)
  if (bg) s.bg = { rgb: bg }
  if (fg) s.cl = { rgb: fg }
  if (cell.font?.bold) s.bl = 1
  if (cell.font?.size) s.fs = cell.font.size
  if (cell.font?.name) s.ff = cell.font.name
  if (cell.alignment?.horizontal === 'center') s.ht = 2
  else if (cell.alignment?.horizontal === 'right') s.ht = 3
  else if (cell.alignment?.horizontal === 'left') s.ht = 1
  if (Object.keys(s).length) out.s = s
  return out
}

function parseA1(addr) {
  const m = String(addr).toUpperCase().match(/^([A-Z]+)(\d+)$/)
  if (!m) return { r: 0, c: 0 }
  let c = 0
  for (let i = 0; i < m[1].length; i++) c = c * 26 + (m[1].charCodeAt(i) - 64)
  return { r: Number(m[2]) - 1, c: c - 1 }
}

function sheetMerges(ws) {
  const refs = ws.model?.merges || []
  return refs.map((ref) => {
    const [a, b] = String(ref).split(':')
    const p1 = parseA1(a)
    const p2 = parseA1(b || a)
    return {
      startRow: Math.min(p1.r, p2.r),
      startColumn: Math.min(p1.c, p2.c),
      endRow: Math.max(p1.r, p2.r),
      endColumn: Math.max(p1.c, p2.c),
    }
  })
}

function sheetListOf(wb) {
  const data = normalizeWorkbook(wb)
  if (!data?.sheets) return []
  if (data.sheetOrder?.length) return data.sheetOrder.map((id) => data.sheets[id]).filter(Boolean)
  return Object.values(data.sheets)
}

export function univerToBook(wb) {
  const book = new ExcelJS.Workbook()
  book.creator = 'AILab'
  const data = normalizeWorkbook(wb)
  const list = sheetListOf(data)
  const styles = data?.styles || {}
  ;(list.length ? list : [{ name: '数据', cellData: {} }]).forEach((sh, idx) => {
    const name = String(sh.name || `Sheet${idx + 1}`).slice(0, 31) || `Sheet${idx + 1}`
    const ws = book.addWorksheet(name)
    const cellData = asCellMap(sh.cellData) || {}
    Object.keys(cellData).forEach((rk) => {
      const r = Number(rk)
      if (!Number.isFinite(r)) return
      Object.keys(cellData[rk] || {}).forEach((ck) => {
        const c = Number(ck)
        if (!Number.isFinite(c)) return
        const raw = cellData[rk][ck]
        const cell = ws.getCell(r + 1, c + 1)
        if (raw?.f) cell.value = { formula: String(raw.f).replace(/^=/, ''), result: raw.v }
        else if (raw?.t === 2 || typeof raw?.v === 'number') cell.value = Number(raw.v)
        else {
          const text = cellText(raw)
          if (text !== '') cell.value = text
        }
        applyExcelStyle(cell, styleFromUniver(raw, styles))
      })
    })
    ;(sh.mergeData || []).forEach((m) => {
      try {
        ws.mergeCells(Number(m.startRow) + 1, Number(m.startColumn) + 1, Number(m.endRow) + 1, Number(m.endColumn) + 1)
      } catch { /* */ }
    })
    ws.properties.defaultRowHeight = 20
    ws.properties.defaultColWidth = 12
  })
  if (!book.worksheets.length) book.addWorksheet('数据')
  return book
}

export function bookToUniver(book, meta = {}) {
  const sheets = {}
  const sheetOrder = []
  ;(book.worksheets || []).forEach((ws, i) => {
    const id = `sheet-${i + 1}`
    sheetOrder.push(id)
    const cellData = {}
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const mapped = excelCellToUniver(cell)
        if (mapped.v == null && mapped.f == null && !mapped.s) return
        const r = rowNumber - 1
        const c = colNumber - 1
        if (!cellData[r]) cellData[r] = {}
        cellData[r][c] = mapped
      })
    })
    sheets[id] = {
      id,
      name: ws.name || `Sheet${i + 1}`,
      cellData,
      mergeData: sheetMerges(ws),
      rowCount: Math.max(40, (ws.rowCount || 0) + 12),
      columnCount: Math.max(12, (ws.columnCount || 0) + 4),
    }
  })
  if (!sheetOrder.length) {
    const id = 'sheet-1'
    sheetOrder.push(id)
    sheets[id] = { id, name: '数据', cellData: {}, mergeData: [], rowCount: 40, columnCount: 12 }
  }
  return {
    id: meta.id || '',
    name: meta.name || book.title || '',
    sheetOrder,
    sheets,
    activeSheetId: sheetOrder[0],
  }
}

export async function xlsxToUniver(buf, title = '') {
  const book = new ExcelJS.Workbook()
  await book.xlsx.load(buf)
  return bookToUniver(book, { name: title })
}

export async function workbookToXlsx(wb, title) {
  const book = univerToBook(wb)
  if (title) book.title = title
  return book.xlsx.writeBuffer()
}

export function usedExtent(wb) {
  const sheet = pickPreviewSheet(wb)
  const cellData = asCellMap(sheet?.cellData)
  let maxR = 0
  let maxC = 0
  Object.keys(cellData || {}).forEach((rk) => {
    const r = Number(rk)
    Object.keys(cellData[rk] || {}).forEach((ck) => {
      const cell = cellData[rk][ck]
      if (!cellText(cell) && !cellStyleOf(cell, {}).bg) return
      maxR = Math.max(maxR, r)
      maxC = Math.max(maxC, Number(ck) || 0)
    })
  })
  return { rows: maxR + 1, cols: maxC + 1 }
}

export function paintWorkbookThumb(wb, cssW = 180, cssH = 244) {
  const data = normalizeWorkbook(wb)
  const sheet = pickPreviewSheet(data)
  const cellData = asCellMap(sheet?.cellData)
  if (!cellData) return ''
  const styles = data?.styles || sheet?.styles || {}
  const merges = sheet?.mergeData || []
  const ext = usedExtent(data)
  const rows = Math.min(16, Math.max(1, ext.rows))
  const cols = Math.min(10, Math.max(1, ext.cols))
  const scale = 2
  const gutter = 22
  const colW = Math.max(56, Math.floor((cssW * scale - gutter) / cols))
  const rowH = Math.max(20, Math.floor((cssH * scale - gutter) / Math.max(rows, 6)))
  const tw = gutter + cols * colW
  const th = gutter + rows * rowH
  const canvas = document.createElement('canvas')
  canvas.width = cssW * scale
  canvas.height = cssH * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#d0d4dc'
  ctx.lineWidth = 1
  ctx.font = `600 ${11 * scale / 2 + 4}px Segoe UI, Microsoft YaHei, sans-serif`
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#f3f5f8'
  ctx.fillRect(0, 0, tw, gutter)
  ctx.fillRect(0, 0, gutter, th)
  ctx.fillStyle = '#8b93a3'
  ctx.textAlign = 'center'
  for (let c = 0; c < cols; c++) {
    ctx.fillText(colLetter(c), gutter + c * colW + colW / 2, gutter / 2)
  }
  for (let r = 0; r < rows; r++) {
    ctx.fillText(String(r + 1), gutter / 2, gutter + r * rowH + rowH / 2)
  }
  const skip = new Set()
  ctx.textAlign = 'left'
  for (let r = 0; r < rows; r++) {
    const line = cellData[r] || cellData[String(r)] || {}
    for (let c = 0; c < cols; c++) {
      if (skip.has(`${r}:${c}`)) continue
      const raw = line[c] ?? line[String(c)]
      const st = cellStyleOf(raw, styles)
      const merge = merges.find((m) => Number(m.startRow) === r && Number(m.startColumn) === c)
      let span = 1
      let rspan = 1
      if (merge) {
        span = Math.max(1, Math.min(cols, Number(merge.endColumn) + 1) - c)
        rspan = Math.max(1, Math.min(rows, Number(merge.endRow) + 1) - r)
        for (let rr = r; rr < r + rspan; rr++) {
          for (let cc = c; cc < c + span; cc++) {
            if (rr !== r || cc !== c) skip.add(`${rr}:${cc}`)
          }
        }
      }
      const x = gutter + c * colW
      const y = gutter + r * rowH
      const w = span * colW
      const h = rspan * rowH
      ctx.fillStyle = st.bg || '#fff'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = '#d0d4dc'
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
      const text = cellText(raw)
      if (text) {
        ctx.fillStyle = st.color || '#1f2329'
        ctx.font = `${st.bold ? '700' : '400'} ${Math.round(11 * scale / 1.6)}px Segoe UI, Microsoft YaHei, sans-serif`
        ctx.save()
        ctx.beginPath()
        ctx.rect(x + 4, y, w - 8, h)
        ctx.clip()
        ctx.fillText(text, x + 6, y + h / 2)
        ctx.restore()
      }
    }
  }
  try { return canvas.toDataURL('image/png') } catch { return '' }
}

function cellToFortune(raw, styles) {
  let s = raw?.s
  if (s != null && typeof s !== 'object') s = styles?.[s] || styles?.[String(s)]
  const text = cellText(raw)
  const v = {}
  if (raw?.f) v.f = String(raw.f).startsWith('=') ? String(raw.f) : `=${raw.f}`
  if (text !== '') {
    v.v = raw?.t === 2 || typeof raw?.v === 'number' ? Number(raw.v) : text
    v.m = String(text)
  }
  if (s?.bl) v.bl = 1
  if (s?.it) v.it = 1
  if (s?.un) v.un = s.un
  if (s?.cln) v.cl = 1
  const bg = colorOf(s?.bg)
  const fc = colorOf(s?.cl)
  if (bg) v.bg = bg
  if (fc) v.fc = fc
  if (s?.ht === 2) v.ht = 0
  else if (s?.ht === 3) v.ht = 2
  else if (s?.ht === 1) v.ht = 1
  if (s?.vt != null) v.vt = s.vt
  if (s?.tb) v.tb = s.tb
  if (s?.tr) v.tr = s.tr
  if (s?.ct) v.ct = s.ct
  if (s?.fs) v.fs = Number(s.fs)
  if (s?.ff) v.ff = s.ff
  if (v.v == null && v.m == null && !v.f && !v.bg && !v.bl && !v.it && !v.un && !v.cl && !v.ct) return null
  return v
}

function fortuneCellToUniver(cell) {
  if (cell == null || cell === '') return null
  if (typeof cell !== 'object') {
    const n = typeof cell === 'number'
    return n ? { v: cell, t: 2 } : { v: String(cell), t: 1 }
  }
  const out = {}
  if (cell.f) out.f = String(cell.f).replace(/^=/, '')
  if (cell.v != null && cell.v !== '') {
    out.v = cell.v
    out.t = typeof cell.v === 'number' ? 2 : 1
  } else if (cell.m != null && cell.m !== '') {
    out.v = cell.m
    out.t = 1
  }
  const s = {}
  if (cell.bl) s.bl = 1
  if (cell.it) s.it = 1
  if (cell.un) s.un = cell.un
  if (cell.cl) s.cln = 1
  if (cell.bg) s.bg = { rgb: colorOf(cell.bg) || cell.bg }
  if (cell.fc) s.cl = { rgb: colorOf(cell.fc) || cell.fc }
  if (cell.ht === 0) s.ht = 2
  else if (cell.ht === 2) s.ht = 3
  else if (cell.ht === 1) s.ht = 1
  if (cell.vt != null) s.vt = cell.vt
  if (cell.tb) s.tb = cell.tb
  if (cell.tr) s.tr = cell.tr
  if (cell.ct) s.ct = cell.ct
  if (cell.fs) s.fs = cell.fs
  if (cell.ff) s.ff = cell.ff
  if (Object.keys(s).length) out.s = s
  if (out.v == null && !out.f && !out.s) return null
  return out
}

function fortuneCellsOf(sh) {
  const map = new Map()
  ;(sh?.celldata || []).forEach((item) => {
    if (item) map.set(`${item.r},${item.c}`, item)
  })
  ;(sh?.data || []).forEach((row, r) => {
    ;(row || []).forEach((cell, c) => {
      if (cell != null && cell !== '') map.set(`${r},${c}`, { r, c, v: cell })
    })
  })
  return [...map.values()]
}

function putMerge(merge, m) {
  if (!m) return
  const r = Number(m.r)
  const c = Number(m.c)
  const rs = Number(m.rs) || 1
  const cs = Number(m.cs) || 1
  if (!Number.isFinite(r) || !Number.isFinite(c)) return
  if (rs <= 1 && cs <= 1) return
  merge[`${r}_${c}`] = { r, c, rs, cs }
}

function collectFortuneMerges(sh) {
  const merge = {}
  Object.values(sh?.config?.merge || {}).forEach((m) => putMerge(merge, m))
  fortuneCellsOf(sh).forEach((item) => putMerge(merge, item?.v?.mc))
  return merge
}

function stampMergeCells(celldata, merge) {
  const at = (r, c) => {
    let item = celldata.find((x) => x.r === r && x.c === c)
    if (!item) {
      item = { r, c, v: {} }
      celldata.push(item)
    }
    if (!item.v || typeof item.v !== 'object') item.v = {}
    return item.v
  }
  Object.values(merge).forEach((m) => {
    at(m.r, m.c).mc = { r: m.r, c: m.c, rs: m.rs, cs: m.cs }
    for (let r = m.r; r < m.r + m.rs; r += 1) {
      for (let c = m.c; c < m.c + m.cs; c += 1) {
        if (r === m.r && c === m.c) continue
        at(r, c).mc = { r: m.r, c: m.c }
      }
    }
  })
}

export function univerToFortune(wb) {
  const data = normalizeWorkbook(wb)
  const list = sheetList(data)
  const styles = data?.styles || {}
  if (!list.length) {
    return [{ name: '数据', id: 'sheet-1', order: 0, status: 1, celldata: [], row: 40, column: 12 }]
  }
  return list.map((sh, i) => {
    const celldata = []
    const cellData = asCellMap(sh.cellData) || {}
    let maxR = 0
    let maxC = 0
    Object.keys(cellData).forEach((rk) => {
      const r = Number(rk)
      if (!Number.isFinite(r)) return
      Object.keys(cellData[rk] || {}).forEach((ck) => {
        const c = Number(ck)
        if (!Number.isFinite(c)) return
        const v = cellToFortune(cellData[rk][ck], styles)
        if (!v) return
        celldata.push({ r, c, v })
        maxR = Math.max(maxR, r)
        maxC = Math.max(maxC, c)
      })
    })
    const merge = {}
    ;(sh.mergeData || []).forEach((m) => {
      const r = Number(m.startRow) || 0
      const c = Number(m.startColumn) || 0
      putMerge(merge, {
        r,
        c,
        rs: Math.max(1, Number(m.endRow) - r + 1),
        cs: Math.max(1, Number(m.endColumn) - c + 1),
      })
    })
    stampMergeCells(celldata, merge)
    Object.values(merge).forEach((m) => {
      maxR = Math.max(maxR, m.r + m.rs - 1)
      maxC = Math.max(maxC, m.c + m.cs - 1)
    })
    return {
      name: sh.name || `Sheet${i + 1}`,
      id: String(sh.id || `sheet-${i + 1}`),
      order: i,
      status: i === 0 ? 1 : 0,
      celldata,
      row: Math.min(200, Math.max(40, maxR + 12, Math.min(Number(sh.rowCount) || 0, 200))),
      column: Math.min(40, Math.max(12, maxC + 4, Math.min(Number(sh.columnCount) || 0, 40))),
      config: {
        ...(Object.keys(merge).length ? { merge } : {}),
        ...(sh.fortune?.borderInfo ? { borderInfo: sh.fortune.borderInfo } : {}),
        ...(sh.fortune?.rowlen ? { rowlen: sh.fortune.rowlen } : {}),
        ...(sh.fortune?.columnlen ? { columnlen: sh.fortune.columnlen } : {}),
        ...(sh.fortune?.rowhidden ? { rowhidden: sh.fortune.rowhidden } : {}),
        ...(sh.fortune?.colhidden ? { colhidden: sh.fortune.colhidden } : {}),
      },
      ...(sh.fortune?.frozen ? { frozen: sh.fortune.frozen } : {}),
      ...(sh.fortune?.conditionformat ? { luckysheet_conditionformat_save: sh.fortune.conditionformat } : {}),
    }
  })
}

export function fortuneToUniver(sheets, meta = {}) {
  const sheetOrder = []
  const out = {}
  ;(sheets || []).forEach((sh, i) => {
    const id = String(sh.id || `sheet-${i + 1}`)
    sheetOrder.push(id)
    const cellData = {}
    fortuneCellsOf(sh).forEach((item) => {
      const mapped = fortuneCellToUniver(item.v)
      if (!mapped) return
      const r = Number(item.r)
      const c = Number(item.c)
      if (!cellData[r]) cellData[r] = {}
      cellData[r][c] = mapped
    })
    const mergeData = Object.values(collectFortuneMerges(sh)).map((m) => ({
      startRow: m.r,
      startColumn: m.c,
      endRow: m.r + m.rs - 1,
      endColumn: m.c + m.cs - 1,
    }))
    const fortune = {}
    if (sh.config?.borderInfo?.length) fortune.borderInfo = sh.config.borderInfo
    if (sh.config?.rowlen) fortune.rowlen = sh.config.rowlen
    if (sh.config?.columnlen) fortune.columnlen = sh.config.columnlen
    if (sh.config?.rowhidden) fortune.rowhidden = sh.config.rowhidden
    if (sh.config?.colhidden) fortune.colhidden = sh.config.colhidden
    if (sh.frozen) fortune.frozen = sh.frozen
    if (sh.luckysheet_conditionformat_save?.length) fortune.conditionformat = sh.luckysheet_conditionformat_save
    out[id] = {
      id,
      name: sh.name || `Sheet${i + 1}`,
      cellData,
      mergeData,
      rowCount: sh.row || 40,
      columnCount: sh.column || 12,
      ...(Object.keys(fortune).length ? { fortune } : {}),
    }
  })
  if (!sheetOrder.length) {
    const id = 'sheet-1'
    sheetOrder.push(id)
    out[id] = { id, name: '数据', cellData: {}, mergeData: [], rowCount: 40, columnCount: 12 }
  }
  return {
    id: meta.id || '',
    name: meta.name || '',
    sheetOrder,
    sheets: out,
    activeSheetId: sheetOrder[0],
  }
}
