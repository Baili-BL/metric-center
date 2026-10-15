import JSZip from 'jszip'
import { colName, extractPivotSource, listWorkbookSheets, parseA1Range, valueLabel } from './pivot'

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const PIVOT_CACHE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotCacheDefinition'
const PIVOT_RECORDS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotCacheRecords'
const PIVOT_TABLE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotTable'
const AGG = { sum: 'sum', count: 'count', avg: 'average', max: 'max', min: 'min' }
const AGG_BACK = { sum: 'sum', count: 'count', average: 'avg', max: 'max', min: 'min' }
const SHOW = { pctCol: 'percentOfCol', pctRow: 'percentOfRow', pctTotal: 'percentOfTotal', index: 'index' }
const SHOW_BACK = { percentOfCol: 'pctCol', percentOfRow: 'pctRow', percentOfTotal: 'pctTotal', index: 'index' }

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function xmlUnescape(value) {
  return String(value ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function attrOf(chunk, name) {
  const m = String(chunk || '').match(new RegExp(`\\b${name}="([^"]*)"`))
  return m ? xmlUnescape(m[1]) : ''
}

function a1(col, row) {
  return `${colName(col)}${row + 1}`
}

function rangeRef(range) {
  if (!range) return ''
  return `${a1(range.startColumn, range.startRow)}:${a1(range.endColumn, range.endRow)}`
}

function bit(on) {
  return on ? '1' : '0'
}

function layoutMode(cfg) {
  if (cfg?.reportLayout === 'tabular') return { compact: '0', outline: '0' }
  if (cfg?.reportLayout === 'outline') return { compact: '0', outline: '1' }
  if (cfg?.reportLayout === 'compact') return { compact: '1', outline: '1' }
  return { compact: '', outline: '' }
}

function usableIndex(idx, count) {
  return Number.isInteger(idx) && idx >= 0 && idx < count
}

function sheetByName(workbook, name) {
  const list = listWorkbookSheets(workbook)
  if (!name) return list[0] || null
  return list.find((p) => p.name === name)
    || list.find((p) => String(p.sheet?.name || '').slice(0, 31) === String(name).slice(0, 31))
    || null
}

function uniqueNames(headers) {
  const used = new Set()
  return headers.map((raw, i) => {
    let name = String(raw || `列${i + 1}`).trim().slice(0, 255) || `列${i + 1}`
    const base = name
    let n = 2
    while (used.has(name)) {
      name = `${base.slice(0, 250)}${n}`
      n += 1
    }
    used.add(name)
    return name
  })
}

function columnCache(values) {
  const index = new Map()
  const items = []
  let hasNum = false
  let hasStr = false
  let allInt = true
  const rec = values.map((v) => {
    if (v === '' || v == null) return '<m/>'
    if (typeof v === 'number' && Number.isFinite(v)) {
      hasNum = true
      if (!Number.isInteger(v)) allInt = false
      const key = `n:${v}`
      if (!index.has(key)) {
        index.set(key, items.length)
        items.push({ kind: 'n', v })
      }
      return `<x v="${index.get(key)}"/>`
    }
    hasStr = true
    allInt = false
    const text = String(v)
    const key = `s:${text}`
    if (!index.has(key)) {
      index.set(key, items.length)
      items.push({ kind: 's', v: text })
    }
    return `<x v="${index.get(key)}"/>`
  })
  return { items, rec, hasNum, hasStr, allInt: hasNum && !hasStr && allInt }
}

function sharedItemsXml(col) {
  const flags = [`count="${col.items.length}"`]
  if (col.hasNum && !col.hasStr) {
    flags.unshift('containsString="0"', 'containsSemiMixedTypes="0"', 'containsNumber="1"')
    if (col.allInt) flags.unshift('containsInteger="1"')
  }
  const body = col.items.map((it) => (it.kind === 'n'
    ? `<n v="${it.v}"/>`
    : `<s v="${xmlEscape(it.v)}"/>`)).join('')
  return `<sharedItems ${flags.join(' ')}>${body}</sharedItems>`
}

function fieldItemsXml(col, { subtotal, hidden }) {
  const rows = col.items.map((it, i) => {
    const key = String(it.v)
    const hide = hidden && Object.prototype.hasOwnProperty.call(hidden, key) && !hidden[key]
    return `<item x="${i}"${hide ? ' h="1"' : ''}/>`
  })
  if (subtotal) rows.push('<item t="default"/>')
  return `<items count="${rows.length}">${rows.join('')}</items>`
}

function buildModel(workbook, cfg) {
  if (!cfg?.range || !cfg.values?.length) return null
  const srcPack = sheetByName(workbook, cfg.sourceName)
  const src = srcPack ? extractPivotSource(srcPack.sheet, cfg.range) : null
  if (!src?.headers?.length || !src.rows?.length) return null
  const names = uniqueNames(src.headers)
  const count = names.length
  const rowsF = (cfg.rowsF || []).filter((idx) => usableIndex(idx, count))
  const cols = (cfg.cols || []).filter((idx) => usableIndex(idx, count))
  const values = (cfg.values || []).filter((v) => usableIndex(v?.idx, count))
  const filters = (cfg.filters || []).filter((f) => usableIndex(f?.idx, count))
  if (!values.length) return null
  const columns = names.map((_, i) => columnCache(src.rows.map((row) => row[i])))
  const out = cfg.out?.rows && cfg.out?.cols ? cfg.out : null
  const outRef = out
    ? `${a1(out.startColumn, out.startRow)}:${a1(out.startColumn + out.cols - 1, out.startRow + out.rows - 1)}`
    : ''
  if (!outRef) return null
  return {
    names,
    columns,
    rowsF,
    cols,
    values,
    filters,
    sourceName: srcPack.name,
    sourceRef: rangeRef(cfg.range),
    outName: cfg.outName || srcPack.name,
    outRef,
    recordCount: src.rows.length,
    cfg,
    labelState: { headers: names, calcFields: [] },
  }
}

function pivotTableXml(model) {
  const { cfg, names, columns, rowsF, cols, values, filters } = model
  const lay = layoutMode(cfg)
  const showSub = cfg.showSubTotal !== false
  const subTop = showSub && cfg.subtotalPos === 'top' && lay.outline === '1' ? ' subtotalTop="1"' : ''
  const blank = !!cfg.blankRows
  const lastRow = rowsF[rowsF.length - 1]
  const pageSet = new Set(filters.map((f) => f.idx))
  const rowSet = new Set(rowsF)
  const colSet = new Set(cols)
  const dataSet = new Set(values.map((v) => v.idx))
  const fields = names.map((_, i) => {
    const col = columns[i]
    let axis = ''
    if (pageSet.has(i)) axis = 'axisPage'
    else if (rowSet.has(i)) axis = 'axisRow'
    else if (colSet.has(i)) axis = 'axisCol'
    if (!axis) return dataSet.has(i) ? '<pivotField dataField="1" showAll="0"/>' : '<pivotField showAll="0"/>'
    const filter = filters.find((f) => f.idx === i)
    const hidden = axis === 'axisPage' ? (filter?.selected || null) : null
    const subtotal = axis === 'axisRow' || axis === 'axisCol' ? showSub : false
    const items = fieldItemsXml(col, { subtotal, hidden })
    const axisAttr = axis ? ` axis="${axis}"` : ''
    const dataAttr = dataSet.has(i) ? ' dataField="1"' : ''
    const layAttr = axis === 'axisRow' || axis === 'axisCol'
      ? `${lay.compact === '' ? '' : ` compact="${lay.compact}" outline="${lay.outline}"`}${axis === 'axisRow' ? subTop : ''} defaultSubtotal="${bit(subtotal)}"${axis === 'axisRow' && blank && i !== lastRow ? ' insertBlankRow="1"' : ''}`
      : ''
    return `<pivotField${axisAttr}${dataAttr} showAll="0"${layAttr}>${items}</pivotField>`
  }).join('')
  const rowXml = rowsF.length
    ? `<rowFields count="${rowsF.length}">${rowsF.map((i) => `<field x="${i}"/>`).join('')}</rowFields>`
    : ''
  const colRefs = cols.map((i) => `<field x="${i}"/>`)
  if (values.length > 1) colRefs.push('<field x="-2"/>')
  const colXml = colRefs.length
    ? `<colFields count="${colRefs.length}">${colRefs.join('')}</colFields>`
    : ''
  const pageXml = filters.length
    ? `<pageFields count="${filters.length}">${filters.map((f) => `<pageField fld="${f.idx}" hier="-1"/>`).join('')}</pageFields>`
    : ''
  const dataXml = `<dataFields count="${values.length}">${values.map((v) => {
    const sub = AGG[v.agg] || 'sum'
    const show = SHOW[v.show]
    return `<dataField name="${xmlEscape(valueLabel(model.labelState, v))}" fld="${v.idx}" baseField="0" baseItem="0"${sub === 'sum' ? '' : ` subtotal="${sub}"`}${show ? ` showDataAs="${show}"` : ''}/>`
  }).join('')}</dataFields>`
  const headerRows = cols.length ? cols.length + (values.length > 1 ? 1 : 0) : 1
  const firstDataCol = rowsF.length || 0
  const pageAttr = filters.length ? ` rowPageCount="${filters.length}" colPageCount="1"` : ''
  const rowGrand = cfg.showColTotal !== false && cols.length ? 1 : 0
  const colGrand = cfg.showRowTotal !== false && rowsF.length ? 1 : 0
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<pivotTableDefinition xmlns="${NS_MAIN}" name="透视表1" cacheId="1" dataCaption="值" `
    + 'updatedVersion="6" minRefreshableVersion="3" useAutoFormatting="1" itemPrintTitles="1" createdVersion="6" indent="0" '
    + `${lay.compact === '' ? '' : `compact="${lay.compact}" compactData="${lay.compact}" outline="${lay.outline}" outlineData="${lay.outline}" `}gridDropZones="1" `
    + `rowGrandTotals="${rowGrand}" colGrandTotals="${colGrand}">`
    + `<location ref="${model.outRef}" firstHeaderRow="1" firstDataRow="${headerRows}" firstDataCol="${firstDataCol}"${pageAttr}/>`
    + `<pivotFields count="${names.length}">${fields}</pivotFields>`
    + rowXml
    + colXml
    + pageXml
    + dataXml
    + '<pivotTableStyleInfo name="PivotStyleLight16" '
    + `showRowHeaders="${bit(cfg.rowHeaders !== false)}" showColHeaders="${bit(cfg.colHeaders !== false)}" `
    + `showRowStripes="${bit(!!cfg.bandRows)}" showColStripes="${bit(!!cfg.bandCols)}" showLastColumn="1"/>`
    + '</pivotTableDefinition>'
}

function cacheDefinitionXml(model) {
  const fields = model.names.map((name, i) => (
    `<cacheField name="${xmlEscape(name)}" numFmtId="0">${sharedItemsXml(model.columns[i])}</cacheField>`
  )).join('')
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<pivotCacheDefinition xmlns="${NS_MAIN}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" `
    + `r:id="rId1" refreshOnLoad="1" refreshedBy="AILab" createdVersion="6" refreshedVersion="6" minRefreshableVersion="3" recordCount="${model.recordCount}">`
    + `<cacheSource type="worksheet"><worksheetSource ref="${model.sourceRef}" sheet="${xmlEscape(model.sourceName)}"/></cacheSource>`
    + `<cacheFields count="${model.names.length}">${fields}</cacheFields>`
    + '</pivotCacheDefinition>'
}

function cacheRecordsXml(model) {
  const rows = []
  for (let r = 0; r < model.recordCount; r += 1) {
    rows.push(`<r>${model.columns.map((col) => col.rec[r]).join('')}</r>`)
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<pivotCacheRecords xmlns="${NS_MAIN}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" count="${model.recordCount}">`
    + rows.join('')
    + '</pivotCacheRecords>'
}

function relsXml(items) {
  const body = items.map((it) => `<Relationship Id="${it.id}" Type="${it.type}" Target="${it.target}"/>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}">${body}</Relationships>`
}

function nextRid(xml) {
  const ids = [...String(xml || '').matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]))
  return `rId${(ids.length ? Math.max(...ids) : 0) + 1}`
}

async function worksheetNames(zip) {
  const wb = await zip.file('xl/workbook.xml').async('string')
  const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string')
  const relTarget = {}
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const id = attrOf(m[1], 'Id')
    const target = attrOf(m[1], 'Target')
    if (id && target) relTarget[id] = target
  }
  const map = new Map()
  for (const m of wb.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const name = attrOf(m[1], 'name')
    const id = attrOf(m[1], 'r:id') || attrOf(m[1], 'id')
    const file = String(relTarget[id] || '').match(/sheet(\d+)\.xml/)?.[1]
    if (name && file) map.set(name, Number(file))
  }
  return { wb, rels, map }
}

function insertPivotCache(wb, relId) {
  if (wb.includes('<pivotCaches')) return wb
  const block = `<pivotCaches><pivotCache cacheId="1" r:id="${relId}"/></pivotCaches>`
  if (wb.includes('</calcPr>')) return wb.replace('</calcPr>', `</calcPr>${block}`)
  if (wb.includes('<extLst')) return wb.replace('<extLst', `${block}<extLst`)
  return wb.replace('</workbook>', `${block}</workbook>`)
}

async function attachWorksheetPivot(zip, sheetNo) {
  const relPath = `xl/worksheets/_rels/sheet${sheetNo}.xml.rels`
  const relFile = zip.file(relPath)
  const item = { id: 'rId1', type: PIVOT_TABLE, target: '../pivotTables/pivotTable1.xml' }
  if (!relFile) {
    zip.file(relPath, relsXml([item]))
    return
  }
  let rels = await relFile.async('string')
  if (rels.includes('pivotTable')) return
  item.id = nextRid(rels)
  rels = rels.replace('</Relationships>', `<Relationship Id="${item.id}" Type="${item.type}" Target="${item.target}"/></Relationships>`)
  zip.file(relPath, rels)
}

function toBlob(buf) {
  if (buf instanceof Blob) return buf
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/** 把当前透视配置写成 Excel 原生数据透视表，打开后可以改字段、刷新。 */
export async function injectExcelPivot(buf, workbook, cfg) {
  const model = buildModel(workbook, cfg)
  if (!model) return { blob: toBlob(buf), added: false }
  const zip = await JSZip.loadAsync(buf)
  const found = await worksheetNames(zip)
  const sheetNo = found.map.get(model.outName) || found.map.get(model.sourceName)
  if (!sheetNo) return { blob: toBlob(buf), added: false }
  zip.file('xl/pivotCache/pivotCacheDefinition1.xml', cacheDefinitionXml(model))
  zip.file('xl/pivotCache/pivotCacheRecords1.xml', cacheRecordsXml(model))
  zip.file('xl/pivotCache/_rels/pivotCacheDefinition1.xml.rels', relsXml([
    { id: 'rId1', type: PIVOT_RECORDS, target: 'pivotCacheRecords1.xml' },
  ]))
  zip.file('xl/pivotTables/pivotTable1.xml', pivotTableXml(model))
  zip.file('xl/pivotTables/_rels/pivotTable1.xml.rels', relsXml([
    { id: 'rId1', type: PIVOT_CACHE, target: '../pivotCache/pivotCacheDefinition1.xml' },
  ]))
  const cacheRid = nextRid(found.rels)
  const rels = found.rels.includes('pivotCacheDefinition1.xml')
    ? found.rels
    : found.rels.replace('</Relationships>', `<Relationship Id="${cacheRid}" Type="${PIVOT_CACHE}" Target="pivotCache/pivotCacheDefinition1.xml"/></Relationships>`)
  zip.file('xl/_rels/workbook.xml.rels', rels)
  zip.file('xl/workbook.xml', insertPivotCache(found.wb, cacheRid))
  await attachWorksheetPivot(zip, sheetNo)
  let ct = await zip.file('[Content_Types].xml').async('string')
  const overrides = [
    ['/xl/pivotCache/pivotCacheDefinition1.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.pivotCacheDefinition+xml'],
    ['/xl/pivotCache/pivotCacheRecords1.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.pivotCacheRecords+xml'],
    ['/xl/pivotTables/pivotTable1.xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.pivotTable+xml'],
  ].filter(([part]) => !ct.includes(part))
    .map(([part, type]) => `<Override PartName="${part}" ContentType="${type}"/>`)
  if (overrides.length) {
    ct = ct.replace('</Types>', `${overrides.join('')}</Types>`)
    zip.file('[Content_Types].xml', ct)
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return { blob, added: true }
}

function sharedValues(xml) {
  const shared = xml.match(/<sharedItems\b[^>]*>([\s\S]*?)<\/sharedItems>/)
  if (!shared) return []
  return [...shared[1].matchAll(/<(s|n|m)\b([^>]*)\/>/g)].map((m) => {
    if (m[1] === 'm') return ''
    if (m[1] === 'n') return Number(attrOf(m[2], 'v'))
    return attrOf(m[2], 'v')
  })
}

function fieldIndexes(xml, tag) {
  const block = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  if (!block) return []
  return [...block[1].matchAll(/<(?:field|pageField)\b([^>]*)\/>/g)].map((m) => {
    const raw = attrOf(m[1], 'x') || attrOf(m[1], 'fld')
    return Number(raw)
  }).filter((n) => Number.isInteger(n) && n >= 0)
}

/** 从 xlsx 里读出第一张原生透视表，供再次打开后继续编辑。读不到则返回 null。 */
export async function readExcelPivot(buf) {
  try {
    const zip = await JSZip.loadAsync(buf)
    const tableFile = zip.file('xl/pivotTables/pivotTable1.xml')
    const cacheFile = zip.file('xl/pivotCache/pivotCacheDefinition1.xml')
    if (!tableFile || !cacheFile) return null
    const table = await tableFile.async('string')
    const cache = await cacheFile.async('string')
    let outName = ''
    const books = await worksheetNames(zip)
    for (const [name, no] of books.map) {
      const sheetRels = zip.file(`xl/worksheets/_rels/sheet${no}.xml.rels`)
      if (!sheetRels) continue
      const xml = await sheetRels.async('string')
      if (xml.includes('pivotTables/pivotTable1.xml')) { outName = name; break }
    }
    const source = cache.match(/<worksheetSource\b([^>]*)\/>/)
    const location = table.match(/<location\b([^>]*)\/>/)
    if (!source || !location) return null
    const range = parseA1Range(attrOf(source[1], 'ref'))
    const outRange = parseA1Range(attrOf(location[1], 'ref'))
    if (!range || !outRange) return null
    const cacheFields = [...cache.matchAll(/<cacheField\b([^>]*?)(?:\/>|>([\s\S]*?)<\/cacheField>)/g)]
    const pivotFields = [...table.matchAll(/<pivotField\b([^>]*?)(?:\/>|>([\s\S]*?)<\/pivotField>)/g)]
    const head = table.match(/<pivotTableDefinition\b([^>]*)>/)?.[1] || ''
    const dataFields = [...table.matchAll(/<dataField\b([^>]*)\/>/g)].map((m) => {
      const agg = AGG_BACK[attrOf(m[1], 'subtotal') || 'sum'] || 'sum'
      const show = SHOW_BACK[attrOf(m[1], 'showDataAs')] || 'none'
      const idx = Number(attrOf(m[1], 'fld'))
      return Number.isInteger(idx) ? { idx, agg, show } : null
    }).filter(Boolean)
    if (!dataFields.length) return null
    const filters = fieldIndexes(table, 'pageFields').map((idx) => {
      const body = pivotFields[idx]?.[2] || ''
      const values = sharedValues(cacheFields[idx]?.[2] || '')
      const selected = {}
      const hidden = new Set([...body.matchAll(/<item\b([^>]*)\/>/g)]
        .filter((m) => attrOf(m[1], 'h') === '1')
        .map((m) => Number(attrOf(m[1], 'x'))))
      values.forEach((v, i) => { selected[String(v)] = !hidden.has(i) })
      return { idx, selected, cond: null }
    })
    const compact = attrOf(head, 'compact')
    const outline = attrOf(head, 'outline')
    let reportLayout = ''
    if (compact === '0' && outline === '0') reportLayout = 'tabular'
    else if (compact === '0' && outline === '1') reportLayout = 'outline'
    else if (compact === '1') reportLayout = 'compact'
    const rowField = pivotFields.find((f) => attrOf(f[1], 'axis') === 'axisRow')
    const style = table.match(/<pivotTableStyleInfo\b([^>]*)\/>/)?.[1] || ''
    return {
      range,
      sourceName: attrOf(source[1], 'sheet'),
      outName,
      filters,
      rowsF: fieldIndexes(table, 'rowFields'),
      cols: fieldIndexes(table, 'colFields'),
      values: dataFields,
      calcFields: [],
      showRowTotal: attrOf(head, 'colGrandTotals') !== '0',
      showColTotal: attrOf(head, 'rowGrandTotals') !== '0',
      showSubTotal: !rowField || attrOf(rowField[1], 'defaultSubtotal') !== '0',
      repeatLabels: false,
      reportLayout,
      subtotalPos: rowField && attrOf(rowField[1], 'subtotalTop') === '1' ? 'top' : 'bottom',
      blankRows: pivotFields.some((f) => attrOf(f[1], 'insertBlankRow') === '1'),
      rowHeaders: attrOf(style, 'showRowHeaders') !== '0',
      colHeaders: attrOf(style, 'showColHeaders') !== '0',
      bandRows: attrOf(style, 'showRowStripes') === '1',
      bandCols: attrOf(style, 'showColStripes') === '1',
      fieldOpts: {},
      collapsed: {},
      out: {
        startRow: outRange.startRow,
        startColumn: outRange.startColumn,
        rows: outRange.endRow - outRange.startRow + 1,
        cols: outRange.endColumn - outRange.startColumn + 1,
      },
    }
  } catch {
    return null
  }
}
