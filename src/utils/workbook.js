import ExcelJS from 'exceljs'

export function firstSheet(wb) {
  if (!wb?.sheets) return null
  const order = wb.sheetOrder?.[0]
  return (order && wb.sheets[order]) || wb.sheets[Object.keys(wb.sheets)[0]]
}

export function previewRows(wb, maxR = 6, maxC = 5) {
  const sheet = firstSheet(wb)
  const cellData = sheet?.cellData
  if (!cellData) return []
  const rows = Object.keys(cellData).map(Number).sort((a, b) => a - b).slice(0, maxR)
  if (!rows.length) return []
  let colMax = 0
  rows.forEach((r) => {
    Object.keys(cellData[r] || {}).forEach((c) => { colMax = Math.max(colMax, Number(c)) })
  })
  colMax = Math.min(colMax, maxC - 1)
  return rows.map((r) => {
    const cells = []
    for (let c = 0; c <= colMax; c++) {
      const cell = cellData[r]?.[c]
      cells.push(cell?.v != null ? String(cell.v) : '')
    }
    return cells
  })
}

export function headerFields(wb) {
  const row = previewRows(wb, 1, 12)[0] || []
  return row.filter(Boolean)
}

export async function workbookToXlsx(wb, title) {
  const book = new ExcelJS.Workbook()
  const sheets = wb?.sheetOrder?.length
    ? wb.sheetOrder.map((id) => wb.sheets?.[id]).filter(Boolean)
    : Object.values(wb?.sheets || {})
  const list = sheets.length ? sheets : [{ name: '数据', cellData: {} }]
  list.forEach((sh, idx) => {
    const ws = book.addWorksheet(String(sh.name || `Sheet${idx + 1}`).slice(0, 31) || `Sheet${idx + 1}`)
    const cellData = sh.cellData || {}
    const rowKeys = Object.keys(cellData).map(Number).sort((a, b) => a - b)
    if (!rowKeys.length) {
      ws.addRow([''])
      return
    }
    let colMax = 0
    rowKeys.forEach((r) => {
      Object.keys(cellData[r] || {}).forEach((c) => { colMax = Math.max(colMax, Number(c)) })
    })
    rowKeys.forEach((r) => {
      const vals = []
      for (let c = 0; c <= colMax; c++) {
        const cell = cellData[r]?.[c]
        vals.push(cell?.v != null ? cell.v : '')
      }
      ws.addRow(vals)
    })
    const head = ws.getRow(1)
    head.font = { bold: true }
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F3FF' } }
  })
  return book.xlsx.writeBuffer()
}
