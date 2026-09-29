import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { migrateFmtToDisplay } from '../charts/fieldFmt'
import { buildSeasonalPack } from '../charts/seasonal'
import {
  isBarFamily,
  isPercent,
  isPie,
  isSeasonal,
  isScatter,
  isCrossScatter,
  isTimeScatter,
  resolveCrossBarRange,
  sectionValue,
  usesCrossSectionTime,
} from '../charts/types'
import { PALETTE } from './hash'

function xEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function excelQuotePart(s) {
  return `"${String(s || '').replace(/"/g, '""')}"`
}

function excelNumFmtOf(series) {
  const f = migrateFmtToDisplay(series && series.fmt)
  if (f.kind === 'manual') return f.pattern || '#,##0'
  let body = '0'
  if (f.decimals > 0) body += `.${'0'.repeat(f.decimals)}`
  if (f.thou) body = `#,##${body}`
  if (f.kind === 'percent') return body + excelQuotePart('%')
  let unit = ''
  if (f.kind === 'number' && !f.hideUnit) {
    if (f.unit === 'wan') unit = '万'
    else if (f.unit === 'yi') unit = '亿'
    else if (f.unit === 'k') unit = '千'
    else if (f.unit === 'm') unit = '百万'
  }
  const prefix = f.prefix || (f.currency ? '￥' : '')
  return (prefix ? excelQuotePart(prefix) : '') + body + (unit ? excelQuotePart(unit) : '') + (f.suffix ? excelQuotePart(f.suffix) : '')
}

function colLetter(idx) {
  let s = ''
  let n = idx + 1
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function hexColor(c, fallback = 'C8102E') {
  const raw = String(c || fallback).replace('#', '').toUpperCase()
  return /^[0-9A-F]{6}$/.test(raw) ? raw : fallback
}

function seriesName(s) {
  return String(s?.alias || s?.name || '系列')
}

function seriesForAxis(series, axis = 'left') {
  const hit = (series || []).find((s) => {
    const a = s.axis || 'left'
    return axis === 'left' ? a !== 'right' : a === 'right'
  })
  return hit || series?.[0] || null
}

/** 将 builder 状态整理为 Sheet2 + OOXML 所需的 labels / series / type */
export function prepareChartExportPack(state, labels, series) {
  const type = state?.type || 'line'
  const srcSeries = Array.isArray(series) ? series : []
  const srcLabels = Array.isArray(labels) ? labels : []

  if (isSeasonal(type)) {
    const pack = buildSeasonalPack(srcSeries, srcLabels, state.season, state.nullMode)
    const ticks = pack.axisTicks || []
    const outLabels = ticks.map((t) => t.label)
    const outSeries = pack.years.map((y, i) => {
      const vals = new Array(ticks.length).fill(null)
      pack.rows.filter((r) => String(r.year) === String(y)).forEach((r) => {
        if (r.x >= 0 && r.x < vals.length) vals[r.x] = r.value
      })
      return {
        name: `${y}年`,
        color: pack.colors[i] || '#26bf59',
        values: vals,
        width: String(y) === String(pack.currentYear) ? 3 : (state.width || 2),
        marker: state.marker,
        fmt: srcSeries[0]?.fmt,
      }
    })
    return {
      type: 'line',
      labels: outLabels,
      series: outSeries,
      title: state.title || '图表',
    }
  }

  if (usesCrossSectionTime(type)) {
    const range = resolveCrossBarRange(state.crossBar, srcLabels)
    if (isPie(type)) {
      return {
        type: 'pie',
        pieStyle: state.pieStyle === 'donut' ? 'donut' : 'pie',
        pieRadius: state.pieRadius,
        labels: srcSeries.map((s) => seriesName(s)),
        series: [{
          name: '取值',
          color: srcSeries[0]?.color || '#c8102e',
          /* 扇区色按指标逐点写入 c:dPt，不能只留系列级单色 */
          pointColors: srcSeries.map((s, i) => s.color || PALETTE[i % PALETTE.length]),
          values: srcSeries.map((s) => sectionValue(s.values || [], range)),
          fmt: srcSeries[0]?.fmt,
        }],
        title: state.title || '图表',
      }
    }
    /* 截面柱：每指标一色 → 拆成多系列各 1 点 */
    return {
      type: 'bar',
      labels: ['截面'],
      series: srcSeries.map((s) => ({
        name: seriesName(s),
        color: s.color || '#c8102e',
        values: [sectionValue(s.values || [], range)],
        fmt: s.fmt,
      })),
      title: state.title || '图表',
    }
  }

  if (isCrossScatter(type)) {
    const xSr = srcSeries[0]
    const ySr = srcSeries[1]
    const xIdx = Math.max(0, srcLabels.length - 1)
    const yIdx = Math.max(0, srcLabels.length - 1)
    const xv = Number((xSr?.values || [])[xIdx])
    const yv = Number((ySr?.values || [])[yIdx])
    return {
      type: 'scatter',
      labels: [seriesName(xSr) || 'X'],
      series: [{
        name: seriesName(ySr) || 'Y',
        color: xSr?.color || ySr?.color || '#c8102e',
        values: [Number.isFinite(yv) ? yv : null],
        marker: true,
        fmt: ySr?.fmt,
        /* 附带 X 数值供说明行；图表仍按类别轴 */
        _xNote: Number.isFinite(xv) ? xv : null,
      }],
      title: state.title || '图表',
    }
  }

  if (isScatter(type)) {
    const a = srcSeries[0] || { values: [] }
    const b = srcSeries[1] || a
    const outLabels = isTimeScatter(type)
      ? srcLabels
      : srcLabels.map((lab, i) => {
        const xv = Number((a.values || [])[i])
        return Number.isFinite(xv) ? String(xv) : String(lab ?? i + 1)
      })
    const ySrc = isTimeScatter(type) ? a : b
    return {
      type: 'scatter',
      labels: outLabels,
      series: [{
        name: seriesName(ySrc) || '散点',
        color: a.color || '#c8102e',
        values: outLabels.map((_, i) => {
          const v = Number((ySrc.values || [])[i])
          return Number.isFinite(v) ? v : null
        }),
        marker: true,
        fmt: ySrc.fmt,
      }],
      title: state.title || '图表',
    }
  }

  return {
    type,
    labels: srcLabels,
    series: srcSeries.map((s) => ({
      name: seriesName(s),
      color: s.color || '#c8102e',
      values: Array.isArray(s.values) ? s.values.slice() : [],
      width: s.lineWidth ?? s.width,
      marker: s.marker,
      fmt: s.fmt,
      axis: s.axis || 'left',
    })),
    title: state.title || '图表',
  }
}

function buildChartXml(pack, state, totalRows) {
  const series = pack.series || []
  const labels = pack.labels || []
  const type = pack.type || 'line'
  const nSer = series.length
  const lineFam = ['line', 'area', 'stackArea', 'stackAreaPercent'].includes(type)
  const isBar = isBarFamily(type) || type === 'combo' || type === 'bar'
  const pie = type === 'pie'
  const scatter = type === 'scatter'
  const axIds = '<c:axId val="111111111"/><c:axId val="222222222"/>'

  function numCache(idx) {
    const pts = []
    let k = 0
    const fillZero = isBar || type === 'stackArea' || type === 'stackAreaPercent'
    for (let i = 0; i < totalRows; i++, k++) {
      let v = series[idx]?.values?.[i]
      if (v == null || v === '') {
        if (fillZero) v = 0
        else continue
      }
      pts.push(`<c:pt idx="${k}"><c:v>${v}</c:v></c:pt>`)
    }
    return `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${k}"/>${pts.join('')}</c:numCache>`
  }

  function strCache() {
    const pts = []
    for (let i = 0; i < totalRows; i++) {
      pts.push(`<c:pt idx="${i}"><c:v>${xEsc(labels[i] ?? '')}</c:v></c:pt>`)
    }
    return `<c:strCache><c:ptCount val="${totalRows}"/>${pts.join('')}</c:strCache>`
  }

  function serCommon(idx) {
    const s = series[idx]
    const col = hexColor(s.color)
    const colL = colLetter(idx + 1)
    const w = (s.width || state.width || 3) * 12700
    return `<c:idx val="${idx}"/><c:order val="${idx}"/>`
      + `<c:tx><c:strRef><c:f>'明细数据'!$${colL}$1</c:f></c:strRef></c:tx>`
      + `<c:spPr><a:solidFill><a:srgbClr val="${col}"/></a:solidFill>`
      + (lineFam ? `<a:ln w="${w}"><a:solidFill><a:srgbClr val="${col}"/></a:solidFill></a:ln>` : '')
      + '</c:spPr>'
  }

  function markerXml(idx) {
    const s = series[idx]
    const col = hexColor(s.color)
    const on = s.marker != null ? !!s.marker : !!state.marker
    if (on) {
      return `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="${col}"/></a:solidFill></c:spPr></c:marker>`
    }
    return '<c:marker><c:symbol val="none"/></c:marker>'
  }

  function catRef() {
    return `<c:cat><c:strRef><c:f>'明细数据'!$A$2:$A$${totalRows + 1}</c:f>${strCache()}</c:strRef></c:cat>`
  }

  function valRef(idx) {
    const colL = colLetter(idx + 1)
    return `<c:val><c:numRef><c:f>'明细数据'!$${colL}$2:$${colL}$${totalRows + 1}</c:f>${numCache(idx)}</c:numRef></c:val>`
  }

  function piePointXml(idx) {
    const colors = series[idx]?.pointColors || []
    if (!colors.length) return ''
    return colors.map((c, i) => {
      const col = hexColor(c)
      return `<c:dPt><c:idx val="${i}"/><c:spPr><a:solidFill><a:srgbClr val="${col}"/></a:solidFill>`
        + '<a:ln w="12700"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>'
    }).join('')
  }

  function serPieHead(idx) {
    const colL = colLetter(idx + 1)
    /* 饼/环不写系列级填充，颜色一律走 dPt，避免整图被刷成同色 */
    return `<c:idx val="${idx}"/><c:order val="${idx}"/>`
      + `<c:tx><c:strRef><c:f>'明细数据'!$${colL}$1</c:f></c:strRef></c:tx>`
  }

  let plotInner = ''
  if (pie) {
    const donut = (pack.pieStyle || state.pieStyle) === 'donut'
    const tag = donut ? 'doughnutChart' : 'pieChart'
    /* 与 G2 一致：内径 ≈ 外径 × 0.52；Excel holeSize 为整饼直径百分比 10–90 */
    const outerR = Math.max(0.35, Math.min(1, (Number(pack.pieRadius ?? state.pieRadius) || 92) / 100))
    const innerR = donut ? Math.max(0, Math.min(outerR - 0.1, outerR * 0.52)) : 0
    const holeSize = Math.round(Math.max(10, Math.min(90, (innerR / Math.max(outerR, 0.01)) * 100))) || 50
    plotInner = `<c:${tag}><c:varyColors val="0"/>`
    series.forEach((_, idx) => {
      plotInner += `<c:ser>${serPieHead(idx)}${piePointXml(idx)}${catRef()}${valRef(idx)}</c:ser>`
    })
    if (donut) plotInner += `<c:holeSize val="${holeSize}"/>`
    plotInner += `</c:${tag}>`
  } else if (scatter) {
    plotInner = '<c:scatterChart><c:scatterStyle val="marker"/>'
    series.forEach((_, idx) => {
      const colL = colLetter(idx + 1)
      plotInner += `<c:ser>${serCommon(idx)}${markerXml(idx)}`
        + `<c:xVal><c:strRef><c:f>'明细数据'!$A$2:$A$${totalRows + 1}</c:f>${strCache()}</c:strRef></c:xVal>`
        + `<c:yVal><c:numRef><c:f>'明细数据'!$${colL}$2:$${colL}$${totalRows + 1}</c:f>${numCache(idx)}</c:numRef></c:yVal>`
        + '</c:ser>'
    })
    plotInner += `${axIds}</c:scatterChart>`
  } else if (isBar || type === 'combo') {
    const barDir = type === 'hbar' ? 'bar' : 'col'
    const grouping = type === 'stackColPercent' ? 'percentStacked' : (type === 'stackCol' ? 'stacked' : 'clustered')
    plotInner = `<c:barChart><c:barDir val="${barDir}"/><c:grouping val="${grouping}"/><c:varyColors val="0"/>`
    series.forEach((_, idx) => {
      plotInner += `<c:ser>${serCommon(idx)}${catRef()}${valRef(idx)}</c:ser>`
    })
    const overlap = (grouping === 'stacked' || grouping === 'percentStacked') ? 100 : 0
    plotInner += `${axIds}<c:gapWidth val="60"/><c:overlap val="${overlap}"/></c:barChart>`
    if (type === 'combo' && nSer > 0) {
      plotInner += `<c:lineChart><c:grouping val="standard"/>${axIds}`
        + `<c:ser>${serCommon(0)}${markerXml(0)}${catRef()}${valRef(0)}</c:ser></c:lineChart>`
    }
  } else if (type === 'area' || type === 'stackArea' || type === 'stackAreaPercent') {
    const g2 = type === 'stackAreaPercent' ? 'percentStacked' : (type === 'stackArea' ? 'stacked' : 'standard')
    plotInner = `<c:areaChart><c:grouping val="${g2}"/><c:varyColors val="0"/>`
    series.forEach((_, idx) => {
      plotInner += `<c:ser>${serCommon(idx)}${markerXml(idx)}${catRef()}${valRef(idx)}</c:ser>`
    })
    plotInner += `${axIds}</c:areaChart>`
  } else {
    const smooth = state.lineType === 'curve' ? 1 : 0
    plotInner = '<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>'
    series.forEach((_, idx) => {
      plotInner += `<c:ser>${serCommon(idx)}${markerXml(idx)}`
        + `<c:smooth val="${smooth}"/>${catRef()}${valRef(idx)}</c:ser>`
    })
    plotInner += `${axIds}</c:lineChart>`
  }

  let axesXml = ''
  if (!pie) {
    const axisSer = seriesForAxis(series, 'left')
    const fmtCode = xEsc(isPercent(type) ? '0%' : excelNumFmtOf(axisSer)).replace(/"/g, '&quot;')
    const grid = state.ax?.yL?.grid ? '<c:majorGridlines/>' : ''
    axesXml = '<c:catAx><c:axId val="111111111"/><c:scaling><c:orientation val="minMax"/></c:scaling>'
      + '<c:delete val="0"/><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="222222222"/></c:catAx>'
      + '<c:valAx><c:axId val="222222222"/><c:scaling><c:orientation val="minMax"/></c:scaling>'
      + `<c:delete val="0"/><c:axPos val="l"/>${grid}`
      + `<c:tickLblPos val="nextTo"/><c:numFmt formatCode="${fmtCode}" sourceLinked="0"/><c:crossBetween val="between"/><c:crossAx val="111111111"/></c:valAx>`
  }

  const legendPos = ({ top: 't', bottom: 'b', left: 'l', right: 'r' }[state.legendPos] || 't')
  const legendXml = state.legendShow !== false
    ? `<c:legend><c:legendPos val="${legendPos}"/><c:overlay val="0"/></c:legend>`
    : ''

  const titleColor = hexColor(state.titleColor, '333333')
  const titleBold = state.titleBold ? 1 : 0
  const titleText = xEsc(pack.title || state.title || '图表')
  const blanks = isBar
    ? 'gap'
    : (state.nullMode === 'zero' ? 'zero' : state.nullMode === 'break' ? 'gap' : 'span')

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" '
    + 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
    + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<c:chart>'
    + `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1400" b="${titleBold}"><a:solidFill><a:srgbClr val="${titleColor}"/></a:solidFill></a:defRPr></a:pPr><a:r><a:t>${titleText}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`
    + '<c:autoTitleDeleted val="0"/>'
    + '<c:plotArea><c:layout/>'
    + plotInner
    + axesXml
    + '</c:plotArea>'
    + legendXml
    + `<c:plotVisOnly val="1"/><c:dispBlanksAs val="${blanks}"/>`
    + '</c:chart>'
    + '</c:chartSpace>'
}

function buildChartDrawingXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" '
    + 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
    + '<xdr:twoCellAnchor>'
    + '<xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>'
    + '<xdr:to><xdr:col>11</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>30</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>'
    + '<xdr:graphicFrame macro="">'
    + '<xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="图表"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>'
    + '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>'
    + '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">'
    + '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" '
    + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/>'
    + '</a:graphicData></a:graphic>'
    + '</xdr:graphicFrame>'
    + '<xdr:clientData/>'
    + '</xdr:twoCellAnchor>'
    + '</xdr:wsDr>'
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

/**
 * 导出带原生可编辑 Excel 图表的 xlsx（对齐 ai-lab-main）
 * @param {{ state: object, labels: string[], series?: object[], filename?: string }} opts
 */
export async function exportChartExcel(opts = {}) {
  const state = opts.state || {}
  const labels = opts.labels || []
  const series = opts.series || state.series || []
  if (!series.length && !isSeasonal(state.type)) {
    throw new Error('请先添加至少一个指标系列')
  }

  const pack = prepareChartExportPack(state, labels, series)
  if (!pack.series.length) throw new Error('没有可导出的数据')

  const totalRows = pack.labels.length
  if (!totalRows) throw new Error('没有可导出的数据行')

  const nSer = pack.series.length
  const wb = new ExcelJS.Workbook()
  const ws1 = wb.addWorksheet('图表')
  const ws2 = wb.addWorksheet('明细数据')

  const titleColor = hexColor(state.titleColor, '333333')
  ws1.getCell('A1').value = pack.title || '图表'
  ws1.getCell('A1').font = { bold: true, size: 15, color: { argb: `FF${titleColor}` } }
  ws1.getCell('A2').value = '（原生 Excel 图表，可在 Excel 中直接编辑数据与样式）'
  ws1.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF9AA0AD' } }
  ws1.getColumn(1).width = 14

  ws2.getCell(1, 1).value = '日期'
  pack.series.forEach((s, j) => { ws2.getCell(1, j + 2).value = s.name })
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6B' } }
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' } }
  for (let c = 1; c <= nSer + 1; c++) {
    const hc = ws2.getCell(1, c)
    hc.fill = headerFill
    hc.font = headerFont
    hc.alignment = { horizontal: 'center' }
  }
  ws2.getColumn(1).width = 12
  pack.series.forEach((_, j) => { ws2.getColumn(j + 2).width = 22 })

  for (let i = 0; i < totalRows; i++) {
    const r = i + 2
    ws2.getCell(r, 1).value = pack.labels[i]
    if (r % 2 === 0) {
      for (let c2 = 1; c2 <= nSer + 1; c2++) {
        ws2.getCell(r, c2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F6FA' } }
      }
    }
    pack.series.forEach((s, j) => {
      const v = s.values?.[i]
      const cell = ws2.getCell(r, j + 2)
      if (v == null || v === '') cell.value = null
      else {
        cell.value = Number(v)
        if (!Number.isFinite(cell.value)) cell.value = v
        cell.numFmt = excelNumFmtOf(s)
      }
    })
  }

  const baseBuf = await wb.xlsx.writeBuffer()
  const zip = await JSZip.loadAsync(baseBuf)
  zip.file('xl/charts/chart1.xml', buildChartXml(pack, state, totalRows))
  zip.file('xl/drawings/drawing1.xml', buildChartDrawingXml())
  zip.file(
    'xl/drawings/_rels/drawing1.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>'
      + '</Relationships>',
  )
  zip.file(
    'xl/worksheets/_rels/sheet1.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>'
      + '</Relationships>',
  )

  let sheet1 = await zip.file('xl/worksheets/sheet1.xml').async('string')
  let ct = await zip.file('[Content_Types].xml').async('string')
  sheet1 = sheet1.replace('</worksheet>', '<drawing r:id="rId1"/></worksheet>')
  zip.file('xl/worksheets/sheet1.xml', sheet1)
  if (!ct.includes('drawings/drawing1.xml')) {
    ct = ct.replace(
      '</Types>',
      '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>'
        + '<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>'
        + '</Types>',
    )
    zip.file('[Content_Types].xml', ct)
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  const filename = opts.filename || `${pack.title || state.title || 'chart'}.xlsx`
  downloadBlob(blob, filename)
  return blob
}
