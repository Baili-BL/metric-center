import { cellPlain, colName } from './pivot'
import { defaultBuilderState, defaultSeriesStyle, typeName } from '../charts/types'

/** 与图库配色同一套，表格图表的主题色直接复用 */
export const SHEET_PALETTES = [
  { name: '中辉期货', colors: ['#c8102e', '#1a3a6b', '#d4a017', '#2e7d5b', '#7a5195', '#e8734a'] },
  { name: '当前仪表板', colors: ['#2E74FF', '#58CAF4', '#867EEC', '#FCBC3D', '#45D0B5', '#5B7BBA'] },
  { name: '暖阳', colors: ['#f2994a', '#f2c94c', '#eb5757', '#bb6bd9', '#56ccf2', '#6fcf97'] },
  { name: '森林', colors: ['#27ae60', '#6fcf97', '#219653', '#9ccc65', '#2f6bff', '#00acc1'] },
  { name: '紫调', colors: ['#7b61ff', '#9b51e0', '#c47ef0', '#5ec8f2', '#f2994a', '#4ecf9f'] },
]

const TYPE_LABEL = {
  bar: '基础柱状图',
  stackCol: '堆积柱状图',
  stackColPercent: '百分比堆积柱状图',
  hbar: '条形图',
  crossBar: '截面柱形图',
  line: '基础折线图',
  seasonal: '季节性图',
  area: '基础面积图',
  stackArea: '堆积面积图',
  stackAreaPercent: '百分比堆积面积图',
  pie: '饼图',
  scatter: '散点图',
  timeScatter: '时序散点图',
  crossScatter: '截面散点图',
  combo: '组合图',
}

export function sheetTypeName(id) {
  return TYPE_LABEL[id] || typeName(id)
}

export function paletteOf(state) {
  return SHEET_PALETTES[state?.paletteIdx] || SHEET_PALETTES[0]
}

export function freshChartState(title) {
  const state = defaultBuilderState({
    type: 'bar',
    title: title || '图表',
    paletteIdx: 1,
    titleShow: true,
    legendShow: true,
    legendPos: 'bottom',
    legendAlign: 'center',
    titleBold: true,
    labelShow: false,
    axisShow: true,
    gradient: false,
    tableShow: false,
  })
  state.ax.x.show = true
  state.ax.yL.show = true
  state.ax.yR.show = true
  state.ax.x.line = true
  state.ax.x.grid = false
  state.ax.yL.grid = true
  state.ax.yR.grid = false
  state.ax.yL.gridColor = '#e5e6eb'
  state.ax.x.gridColor = '#e5e6eb'
  return state
}

export function applySheetPalette(state, idx) {
  state.paletteIdx = idx
  const colors = paletteOf(state).colors
  ;(state.series || []).forEach((s, i) => { s.color = colors[i % colors.length] })
}

function cellAccess(sheet) {
  const cellData = sheet?.cellData || {}
  const at = (r, c) => cellPlain(cellData[r]?.[c] ?? cellData[String(r)]?.[c] ?? cellData[String(r)]?.[String(c)])
  const asNumber = (p) => {
    if (!p || p.kind === 'empty') return null
    if (p.kind === 'n') return p.v
    const n = Number(String(p.v).replace(/,/g, ''))
    return Number.isFinite(n) && String(p.v).trim() !== '' ? n : null
  }
  return { at, asNumber }
}

/** 选区内每一列：表头名、是否有数值。供横轴/纵轴切换 */
export function inspectSheetRange(sheet, range) {
  if (!sheet || !range) return null
  const { at, asNumber } = cellAccess(sheet)
  const r0 = range.startRow
  const r1 = range.endRow
  const c0 = range.startColumn
  const c1 = range.endColumn
  if (r1 < r0 || c1 < c0 || (r1 === r0 && c1 === c0)) return null
  const top = []
  for (let c = c0; c <= c1; c++) top.push(at(r0, c))
  const textHeads = top.filter((p) => p.kind === 's').length
  const header = textHeads >= 1 && textHeads >= top.length - 1
  const bodyStart = header ? r0 + 1 : r0
  if (bodyStart > r1) return null
  const columns = []
  for (let c = c0; c <= c1; c++) {
    const head = header ? at(r0, c) : { kind: 'empty' }
    let numeric = 0
    for (let r = bodyStart; r <= r1; r++) {
      if (asNumber(at(r, c)) != null) numeric += 1
    }
    columns.push({
      col: c,
      name: head.kind === 'empty' ? `列${colName(c)}` : String(head.v),
      numeric,
    })
  }
  return { at, asNumber, r0, r1, c0, c1, header, bodyStart, columns }
}

/**
 * 把选区读成类别 + 系列。
 * binding.seriesCols 有值时按用户指定的横轴列、纵轴列，不再自动猜。
 */
export function matrixFromSheet(sheet, range, binding = null) {
  const info = inspectSheetRange(sheet, range)
  if (!info) return null
  const { at, asNumber, r0, r1, c0, c1, header, bodyStart, columns } = info
  const inside = (c) => c >= c0 && c <= c1
  const explicit = Array.isArray(binding?.seriesCols) && binding.seriesCols.length > 0
  let categoryCol = explicit && inside(binding.categoryCol) ? binding.categoryCol : null
  let seriesCols = explicit ? binding.seriesCols.filter((c) => inside(c) && c !== categoryCol) : null
  if (!seriesCols?.length) {
    let textLabels = 0
    for (let r = bodyStart; r <= r1; r++) {
      if (at(r, c0).kind === 's') textLabels += 1
    }
    const bodyRows = r1 - bodyStart + 1
    const labelCol = c1 > c0 && textLabels >= Math.ceil(bodyRows / 2)
    categoryCol = labelCol ? c0 : null
    seriesCols = columns.filter((col) => col.col !== categoryCol && col.numeric > 0).map((col) => col.col)
  }
  if (!seriesCols.length) return null

  const labels = []
  for (let r = bodyStart; r <= r1; r++) {
    if (categoryCol == null) labels.push(String(r - bodyStart + 1))
    else {
      const p = at(r, categoryCol)
      labels.push(p.kind === 'empty' ? '' : String(p.v))
    }
  }
  const series = seriesCols.map((c, i) => {
    const meta = columns.find((col) => col.col === c)
    const values = []
    for (let r = bodyStart; r <= r1; r++) values.push(asNumber(at(r, c)))
    return { col: c, name: meta?.name || `系列${i + 1}`, values }
  }).filter((s) => s.values.some((v) => v != null))
  if (!series.length || !labels.length) return null
  const cat = columns.find((col) => col.col === categoryCol)
  return {
    labels,
    series,
    categoryName: cat?.name || '类别',
    categoryCol,
    seriesCols: series.map((s) => s.col),
    columns,
    headerRow: header ? r0 : null,
    bodyStart,
    bodyEnd: r1,
  }
}

/** 图表在原表上的单元格引用：类别列、各数值列，行号为 0 起 */
export function chartSourceRefs(sheet, range, binding = null) {
  const matrix = matrixFromSheet(sheet, range, binding)
  if (!matrix) return null
  return {
    headerRow: matrix.headerRow,
    bodyStart: matrix.bodyStart,
    bodyEnd: matrix.bodyEnd,
    labelCol: matrix.categoryCol,
    labels: matrix.labels,
    series: matrix.series,
  }
}

export function syncChartSeries(state, matrix) {
  const colors = paletteOf(state).colors
  const prev = state.series || []
  state.categoryCol = matrix.categoryCol
  state.seriesCols = matrix.seriesCols.slice()
  state.series = matrix.series.map((s, i) => {
    const old = prev.find((p) => p.col === s.col) || prev.find((p) => p.name === s.name) || {}
    return {
      ...defaultSeriesStyle(),
      ...old,
      col: s.col,
      name: s.name,
      values: s.values.slice(),
      color: old.color || colors[i % colors.length],
    }
  })
}
