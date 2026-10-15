import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { normalizeWorkbook, univerToBook, workbookXlsxBuffer } from './workbook'
import { chartSourceRefs } from './sheetChart'
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

function axisNumber(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function manualAxis(ax, which) {
  if (!ax) return null
  const auto = which === 'min' ? ax.minAuto : ax.maxAuto
  const raw = which === 'min' ? ax.minV : ax.maxV
  if (auto !== false || raw == null || raw === '') return null
  return axisNumber(raw)
}

function seriesNumbers(list) {
  const out = []
  for (const s of list || []) {
    for (const v of s.values || []) {
      const n = axisNumber(v)
      if (n != null) out.push(n)
    }
  }
  return out
}

function stackedExtent(list) {
  const len = Math.max(0, ...(list || []).map((s) => (s.values || []).length))
  if (!len) return null
  let min = 0
  let max = 0
  let any = false
  for (let i = 0; i < len; i++) {
    let pos = 0
    let neg = 0
    for (const s of list) {
      const n = axisNumber(s.values?.[i])
      if (n == null) continue
      any = true
      if (n >= 0) pos += n
      else neg += n
    }
    if (pos > max) max = pos
    if (neg < min) min = neg
  }
  return any ? [min, max] : null
}

/** 与界面 G2 同一套 Y 轴范围：自动时用数据端点（柱/面积含 0），手填时用最小值/最大值 */
function displayedYDomain(ax, list, type) {
  const percent = isPercent(type)
  const stacked = type === 'stackCol' || type === 'stackArea'
  const baselineZero = !percent && !['line', 'scatter', 'seasonal'].includes(type)
  const manualMin = manualAxis(ax, 'min')
  const manualMax = manualAxis(ax, 'max')
  const nums = seriesNumbers(list)
  if (manualMin != null && manualMax != null) return widen(manualMin, manualMax)
  if (manualMin != null) return widen(manualMin, Math.max(...nums, manualMin + 1))
  if (manualMax != null) return widen(nums.length ? Math.min(...nums, manualMax - 1) : manualMax - 1, manualMax)
  if (percent) return [0, 1]
  if (stacked) {
    const ext = stackedExtent(list)
    return ext ? widen(ext[0], ext[1]) : null
  }
  if (!nums.length) return null
  let min = Math.min(...nums)
  let max = Math.max(...nums)
  if (baselineZero) {
    min = Math.min(min, 0)
    max = Math.max(max, 0)
  }
  return widen(min, max)
}

function widen(min, max) {
  if (max > min) return [min, max]
  const pad = Math.abs(Number(min)) * 0.05 || 1
  return [min, min + pad]
}

function fmtAxis(n) {
  return String(Number(Number(n).toPrecision(12)))
}

function scalingXml(domain, reversed) {
  const orient = reversed ? 'maxMin' : 'minMax'
  if (!domain) return `<c:scaling><c:orientation val="${orient}"/></c:scaling>`
  return `<c:scaling><c:orientation val="${orient}"/>`
    + `<c:max val="${fmtAxis(domain[1])}"/><c:min val="${fmtAxis(domain[0])}"/></c:scaling>`
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

function buildChartXml(pack, state, totalRows, dataSheet = '明细数据', refs = null) {
  const sheetQ = `'${String(dataSheet).replace(/'/g, "''")}'`
  const series = pack.series || []
  const labels = pack.labels || []
  const type = pack.type || 'line'
  const nSer = series.length
  const lineFam = ['line', 'area', 'stackArea', 'stackAreaPercent'].includes(type)
  const isBar = isBarFamily(type) || type === 'combo' || type === 'bar'
  const pie = type === 'pie'
  const scatter = type === 'scatter'
  const axIds = '<c:axId val="111111111"/><c:axId val="222222222"/>'
  const rightAxIds = '<c:axId val="111111111"/><c:axId val="333333333"/>'
  const canSplit = !!state.dual && !pie && !isBar
  const leftIdx = []
  const rightIdx = []
  series.forEach((s, i) => {
    if (canSplit && s.axis === 'right') rightIdx.push(i)
    else leftIdx.push(i)
  })
  const useRight = canSplit && rightIdx.length > 0 && leftIdx.length > 0
  const plotIdx = useRight ? leftIdx : series.map((_, i) => i)

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

  function strPts() {
    const pts = []
    for (let i = 0; i < totalRows; i++) {
      pts.push(`<c:pt idx="${i}"><c:v>${xEsc(labels[i] ?? '')}</c:v></c:pt>`)
    }
    return pts.join('')
  }

  function strCache() {
    return `<c:strCache><c:ptCount val="${totalRows}"/>${strPts()}</c:strCache>`
  }

  function serNameXml(idx) {
    const ref = refs?.series?.[idx]
    if (ref?.nameCell) return `<c:tx><c:strRef><c:f>${sheetQ}!${ref.nameCell}</c:f></c:strRef></c:tx>`
    if (ref?.nameText) return `<c:tx><c:v>${xEsc(ref.nameText)}</c:v></c:tx>`
    const colL = colLetter(idx + 1)
    return `<c:tx><c:strRef><c:f>${sheetQ}!$${colL}$1</c:f></c:strRef></c:tx>`
  }

  function serCommon(idx) {
    const s = series[idx]
    const col = hexColor(s.color)
    const w = (s.width || state.width || 3) * 12700
    return `<c:idx val="${idx}"/><c:order val="${idx}"/>`
      + serNameXml(idx)
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
    const cache = strCache()
    if (refs) {
      if (refs.cats) return `<c:cat><c:strRef><c:f>${sheetQ}!${refs.cats}</c:f>${cache}</c:strRef></c:cat>`
      return `<c:cat><c:strLit><c:ptCount val="${totalRows}"/>${strPts()}</c:strLit></c:cat>`
    }
    return `<c:cat><c:strRef><c:f>${sheetQ}!$A$2:$A$${totalRows + 1}</c:f>${cache}</c:strRef></c:cat>`
  }

  function valRef(idx) {
    const colL = refs?.series?.[idx]?.vals
    const f = colL ? `${sheetQ}!${colL}` : `${sheetQ}!$${colLetter(idx + 1)}$2:$${colLetter(idx + 1)}$${totalRows + 1}`
    return `<c:val><c:numRef><c:f>${f}</c:f>${numCache(idx)}</c:numRef></c:val>`
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
    /* 饼/环不写系列级填充，颜色一律走 dPt，避免整图被刷成同色 */
    return `<c:idx val="${idx}"/><c:order val="${idx}"/>${serNameXml(idx)}`
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
    plotIdx.forEach((idx) => {
      const colL = colLetter(idx + 1)
      plotInner += `<c:ser>${serCommon(idx)}${markerXml(idx)}`
        + (refs?.cats
          ? `<c:xVal><c:strRef><c:f>${sheetQ}!${refs.cats}</c:f>${strCache()}</c:strRef></c:xVal>`
          : `<c:xVal><c:strRef><c:f>${sheetQ}!$A$2:$A$${totalRows + 1}</c:f>${strCache()}</c:strRef></c:xVal>`)
        + `<c:yVal><c:numRef><c:f>${sheetQ}!$${colL}$2:$${colL}$${totalRows + 1}</c:f>${numCache(idx)}</c:numRef></c:yVal>`
        + '</c:ser>'
    })
    plotInner += `${axIds}</c:scatterChart>`
  } else if (isBar || type === 'combo') {
    const barDir = type === 'hbar' ? 'bar' : 'col'
    const grouping = type === 'stackColPercent' ? 'percentStacked' : (type === 'stackCol' ? 'stacked' : 'clustered')
    plotInner = `<c:barChart><c:barDir val="${barDir}"/><c:grouping val="${grouping}"/><c:varyColors val="0"/>`
    plotIdx.forEach((idx) => {
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
    plotIdx.forEach((idx) => {
      plotInner += `<c:ser>${serCommon(idx)}${markerXml(idx)}${catRef()}${valRef(idx)}</c:ser>`
    })
    plotInner += `${axIds}</c:areaChart>`
  } else {
    const smooth = state.lineType === 'curve' ? 1 : 0
    plotInner = '<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>'
    plotIdx.forEach((idx) => {
      plotInner += `<c:ser>${serCommon(idx)}${markerXml(idx)}`
        + `<c:smooth val="${smooth}"/>${catRef()}${valRef(idx)}</c:ser>`
    })
    plotInner += `${axIds}</c:lineChart>`
  }

  if (useRight) {
    if (scatter) {
      plotInner += '<c:scatterChart><c:scatterStyle val="marker"/>'
      rightIdx.forEach((idx) => {
        const colL = colLetter(idx + 1)
        plotInner += `<c:ser>${serCommon(idx)}${markerXml(idx)}`
          + (refs?.cats
            ? `<c:xVal><c:strRef><c:f>${sheetQ}!${refs.cats}</c:f>${strCache()}</c:strRef></c:xVal>`
            : `<c:xVal><c:strRef><c:f>${sheetQ}!$A$2:$A$${totalRows + 1}</c:f>${strCache()}</c:strRef></c:xVal>`)
          + `<c:yVal><c:numRef><c:f>${sheetQ}!$${colL}$2:$${colL}$${totalRows + 1}</c:f>${numCache(idx)}</c:numRef></c:yVal>`
          + '</c:ser>'
      })
      plotInner += `${rightAxIds}</c:scatterChart>`
    } else if (type === 'area' || type === 'stackArea' || type === 'stackAreaPercent') {
      const g2 = type === 'stackAreaPercent' ? 'percentStacked' : (type === 'stackArea' ? 'stacked' : 'standard')
      plotInner += `<c:areaChart><c:grouping val="${g2}"/><c:varyColors val="0"/>`
      rightIdx.forEach((idx) => {
        plotInner += `<c:ser>${serCommon(idx)}${markerXml(idx)}${catRef()}${valRef(idx)}</c:ser>`
      })
      plotInner += `${rightAxIds}</c:areaChart>`
    } else {
      const smooth = state.lineType === 'curve' ? 1 : 0
      plotInner += '<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>'
      rightIdx.forEach((idx) => {
        plotInner += `<c:ser>${serCommon(idx)}${markerXml(idx)}<c:smooth val="${smooth}"/>${catRef()}${valRef(idx)}</c:ser>`
      })
      plotInner += `${rightAxIds}</c:lineChart>`
    }
  }

  let axesXml = ''
  if (!pie) {
    const axisSer = seriesForAxis(useRight ? leftIdx.map((i) => series[i]) : series, 'left')
    const fmtCode = xEsc(isPercent(type) ? '0%' : excelNumFmtOf(axisSer)).replace(/"/g, '&quot;')
    const grid = state.ax?.yL?.grid ? '<c:majorGridlines/>' : ''
    const shared = useRight && state.dualSync === 'value'
    const allNums = seriesNumbers(series)
    const sharedDomain = shared && allNums.length
      ? widen(Math.min(0, ...allNums), Math.max(...allNums))
      : null
    const leftDomain = sharedDomain || displayedYDomain(state.ax?.yL, plotIdx.map((i) => series[i]), type)
    axesXml = '<c:catAx><c:axId val="111111111"/><c:scaling><c:orientation val="minMax"/></c:scaling>'
      + '<c:delete val="0"/><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="222222222"/></c:catAx>'
      + `<c:valAx><c:axId val="222222222"/>${scalingXml(leftDomain, state.ax?.yL?.reversed)}`
      + `<c:delete val="0"/><c:axPos val="l"/>${grid}`
      + `<c:tickLblPos val="nextTo"/><c:numFmt formatCode="${fmtCode}" sourceLinked="0"/><c:crossBetween val="between"/><c:crossAx val="111111111"/></c:valAx>`
    if (useRight) {
      const rightSer = seriesForAxis(rightIdx.map((i) => series[i]), 'right')
      const rightFmt = xEsc(isPercent(type) ? '0%' : excelNumFmtOf(rightSer)).replace(/"/g, '&quot;')
      const rightDomain = sharedDomain || displayedYDomain(state.ax?.yR, rightIdx.map((i) => series[i]), type)
      const rightGrid = state.ax?.yR?.grid ? '<c:majorGridlines/>' : ''
      axesXml += `<c:valAx><c:axId val="333333333"/>${scalingXml(rightDomain, state.ax?.yR?.reversed)}`
        + `<c:delete val="0"/><c:axPos val="r"/>${rightGrid}`
        + `<c:tickLblPos val="nextTo"/><c:numFmt formatCode="${rightFmt}" sourceLinked="0"/>`
        + '<c:crossAx val="111111111"/><c:crosses val="max"/></c:valAx>'
    }
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

function fillChartSheets(wsChart, wsData, pack, state) {
  const totalRows = pack.labels.length
  const nSer = pack.series.length
  const titleColor = hexColor(state.titleColor, '333333')
  wsChart.getCell('A1').value = pack.title || '图表'
  wsChart.getCell('A1').font = { bold: true, size: 15, color: { argb: `FF${titleColor}` } }
  wsChart.getCell('A2').value = '（原生 Excel 图表，可在 Excel 中直接编辑数据与样式）'
  wsChart.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF9AA0AD' } }
  wsChart.getColumn(1).width = 14

  wsData.getCell(1, 1).value = '日期'
  pack.series.forEach((s, j) => { wsData.getCell(1, j + 2).value = s.name })
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6B' } }
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' } }
  for (let c = 1; c <= nSer + 1; c++) {
    const hc = wsData.getCell(1, c)
    hc.fill = headerFill
    hc.font = headerFont
    hc.alignment = { horizontal: 'center' }
  }
  wsData.getColumn(1).width = 12
  pack.series.forEach((_, j) => { wsData.getColumn(j + 2).width = 22 })

  for (let i = 0; i < totalRows; i++) {
    const r = i + 2
    wsData.getCell(r, 1).value = pack.labels[i]
    if (r % 2 === 0) {
      for (let c2 = 1; c2 <= nSer + 1; c2++) {
        wsData.getCell(r, c2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F6FA' } }
      }
    }
    pack.series.forEach((s, j) => {
      const v = s.values?.[i]
      const cell = wsData.getCell(r, j + 2)
      if (v == null || v === '') cell.value = null
      else {
        cell.value = Number(v)
        if (!Number.isFinite(cell.value)) cell.value = v
        cell.numFmt = excelNumFmtOf(s)
      }
    })
  }
}

function drawingRels(chartFile) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/${chartFile}"/>`
    + '</Relationships>'
}

function sheetDrawingRels(drawingFile) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/${drawingFile}"/>`
    + '</Relationships>'
}

function uniqueSheetName(wb, base) {
  const used = new Set(wb.worksheets.map((w) => w.name))
  const clean = String(base || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet'
  if (!used.has(clean)) return clean
  let n = 2
  while (used.has(`${clean.slice(0, 28)}${n}`)) n += 1
  return `${clean.slice(0, 28)}${n}`
}

function chartPacksOf(items) {
  const packs = []
  for (const item of items || []) {
    const state = item.state || {}
    const pack = prepareChartExportPack(state, item.labels || [], item.series || state.series || [])
    if (!pack.series.length || !pack.labels.length) continue
    packs.push({ pack, state, totalRows: pack.labels.length })
  }
  return packs
}

function appendChartSheets(wb, packs) {
  packs.forEach((p, i) => {
    p.chartName = uniqueSheetName(wb, i === 0 ? '图表' : `图表${i + 1}`)
    p.dataName = uniqueSheetName(wb, i === 0 ? '明细数据' : `明细数据${i + 1}`)
    fillChartSheets(wb.addWorksheet(p.chartName), wb.addWorksheet(p.dataName), p.pack, p.state)
  })
}

async function attachDrawing(zip, sheetNo, drawingFile) {
  const sheetPath = `xl/worksheets/sheet${sheetNo}.xml`
  const sheetFile = zip.file(sheetPath)
  if (!sheetFile) return
  let xml = await sheetFile.async('string')
  const relPath = `xl/worksheets/_rels/sheet${sheetNo}.xml.rels`
  const relFile = zip.file(relPath)
  let relId = 'rId1'
  if (relFile) {
    let rels = await relFile.async('string')
    if (!rels.includes(`drawings/${drawingFile}`)) {
      const ids = [...rels.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]))
      relId = `rId${(ids.length ? Math.max(...ids) : 0) + 1}`
      rels = rels.replace(
        '</Relationships>',
        `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/${drawingFile}"/></Relationships>`,
      )
      zip.file(relPath, rels)
    }
  } else {
    zip.file(relPath, sheetDrawingRels(drawingFile))
  }
  if (!xml.includes('<drawing ')) {
    zip.file(sheetPath, xml.replace('</worksheet>', `<drawing r:id="${relId}"/></worksheet>`))
  }
}

async function injectNativeCharts(buf, packs, sheetOffset = 0) {
  const zip = await JSZip.loadAsync(buf)
  let ct = await zip.file('[Content_Types].xml').async('string')
  const overrides = []
  for (let i = 0; i < packs.length; i++) {
    const p = packs[i]
    const n = i + 1
    const sheetNo = sheetOffset + i * 2 + 1
    zip.file(`xl/charts/chart${n}.xml`, buildChartXml(p.pack, p.state, p.totalRows, p.dataName))
    zip.file(`xl/drawings/drawing${n}.xml`, buildChartDrawingXml())
    zip.file(`xl/drawings/_rels/drawing${n}.xml.rels`, drawingRels(`chart${n}.xml`))
    await attachDrawing(zip, sheetNo, `drawing${n}.xml`)
    const drawingOverride = `<Override PartName="/xl/drawings/drawing${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`
    const chartOverride = `<Override PartName="/xl/charts/chart${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`
    if (!ct.includes(`/xl/drawings/drawing${n}.xml`)) overrides.push(drawingOverride)
    if (!ct.includes(`/xl/charts/chart${n}.xml`)) overrides.push(chartOverride)
  }
  if (overrides.length) {
    ct = ct.replace('</Types>', `${overrides.join('')}</Types>`)
    zip.file('[Content_Types].xml', ct)
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

async function exportManyChartExcel(items, filename) {
  const wb = new ExcelJS.Workbook()
  const packs = chartPacksOf(items)
  if (!packs.length) throw new Error('没有可导出的数据')
  appendChartSheets(wb, packs)
  const blob = await injectNativeCharts(await wb.xlsx.writeBuffer(), packs, 0)
  downloadBlob(blob, filename || '图表.xlsx')
  return blob
}

function absCell(col, row) {
  return `$${colLetter(col)}$${row + 1}`
}

function absColRange(col, r0, r1) {
  return `$${colLetter(col)}$${r0 + 1}:$${colLetter(col)}$${r1 + 1}`
}

function sheetOfWorkbook(workbook, name) {
  const data = normalizeWorkbook(workbook)
  const list = data?.sheetOrder?.length
    ? data.sheetOrder.map((id) => data.sheets?.[id]).filter(Boolean)
    : Object.values(data?.sheets || {})
  return list.find((sh) => sh.name === name) || list[0] || null
}

function emu(px) {
  return Math.max(0, Math.round((Number(px) || 0) * 9525))
}

function spanAnchor(ch, sheet) {
  const colW = (c) => {
    const map = sheet?.fortune?.columnlen || {}
    const px = Number(map[c] ?? map[String(c)])
    return px > 0 ? px : 73
  }
  const rowH = (r) => {
    const map = sheet?.fortune?.rowlen || {}
    const px = Number(map[r] ?? map[String(r)])
    return px > 0 ? px : 24
  }
  const walk = (start, offset, size, measure) => {
    let index = Math.max(0, start || 0)
    let off = Math.max(0, Number(offset) || 0)
    let left = Math.max(24, Number(size) || 0)
    const first = measure(index)
    if (off >= first) off = Math.max(0, first - 1)
    if (left <= first - off) return { index, off: off + left }
    left -= first - off
    index += 1
    while (left > measure(index) && index < start + 80) {
      left -= measure(index)
      index += 1
    }
    return { index, off: Math.max(1, Math.min(left, measure(index) - 1)) }
  }
  const fromCol = Math.max(0, ch.anchorCol || 0)
  const fromRow = Math.max(0, ch.anchorRow || 0)
  const endC = walk(fromCol, ch.offsetX || 0, ch.w || 480, colW)
  const endR = walk(fromRow, ch.offsetY || 0, ch.h || 300, rowH)
  let toCol = endC.index
  let toRow = endR.index
  let toColOff = emu(endC.off)
  let toRowOff = emu(endR.off)
  const fromColOff = emu(Math.min(Math.max(0, ch.offsetX || 0), Math.max(0, colW(fromCol) - 8)))
  const fromRowOff = emu(Math.min(Math.max(0, ch.offsetY || 0), Math.max(0, rowH(fromRow) - 4)))
  if (toCol < fromCol || (toCol === fromCol && toColOff <= fromColOff)) {
    toCol = fromCol + 6
    toColOff = 0
  }
  if (toRow < fromRow || (toRow === fromRow && toRowOff <= fromRowOff)) {
    toRow = fromRow + 12
    toRowOff = 0
  }
  return {
    fromCol, fromColOff, fromRow, fromRowOff, toCol, toColOff, toRow, toRowOff,
    cx: emu(Math.max(360, ch.w || 480)),
    cy: emu(Math.max(220, ch.h || 300)),
  }
}

function buildAnchoredDrawingXml(anchors) {
  const body = anchors.map((a, i) => {
    const cx = a.cx || emu(480)
    const cy = a.cy || emu(300)
    return '<xdr:oneCellAnchor>'
      + `<xdr:from><xdr:col>${a.fromCol}</xdr:col><xdr:colOff>${a.fromColOff}</xdr:colOff><xdr:row>${a.fromRow}</xdr:row><xdr:rowOff>${a.fromRowOff}</xdr:rowOff></xdr:from>`
      + `<xdr:ext cx="${cx}" cy="${cy}"/>`
      + '<xdr:graphicFrame macro="">'
      + `<xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="图表${i + 1}"/><xdr:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></xdr:cNvGraphicFramePr></xdr:nvGraphicFramePr>`
      + `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></xdr:xfrm>`
      + '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">'
      + '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" '
      + `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${i + 1}"/>`
      + '</a:graphicData></a:graphic>'
      + '</xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor>'
  }).join('')
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" '
    + 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
    + body
    + '</xdr:wsDr>'
}

function multiChartRels(chartFiles) {
  const rels = chartFiles.map((file, i) => (
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/${file}"/>`
  )).join('')
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + rels
    + '</Relationships>'
}

async function worksheetFileNo(zip) {
  const wb = await zip.file('xl/workbook.xml').async('string')
  const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string')
  const relTarget = {}
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const id = m[1].match(/\bId="([^"]+)"/)?.[1]
    const target = m[1].match(/\bTarget="([^"]+)"/)?.[1]
    if (id && target) relTarget[id] = target
  }
  const map = new Map()
  for (const m of wb.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const name = m[1].match(/\bname="([^"]+)"/)?.[1]
    const id = m[1].match(/\br:id="([^"]+)"/)?.[1]
    const file = String(relTarget[id] || '').match(/sheet(\d+)\.xml/)?.[1]
    if (name && file) map.set(name, Number(file))
  }
  return map
}

function tableChartGroups(workbook, charts) {
  const groups = new Map()
  for (const ch of charts || []) {
    const sheet = sheetOfWorkbook(workbook, ch?.sheetName)
    if (!sheet) continue
    const state = ch.state || {}
    const src = chartSourceRefs(sheet, ch.range, {
      categoryCol: state.categoryCol,
      categoryCols: state.categoryCols,
      seriesCols: state.seriesCols,
    })
    if (!src?.series?.length) continue
    const styled = (state.series || []).slice(0, src.series.length)
    const pack = prepareChartExportPack(state, src.labels, styled.length ? styled : src.series.map((s) => ({ name: s.name, values: s.values })))
    const linked = pack.series.length === src.series.length && pack.labels.length === src.labels.length
    const use = linked ? pack : {
      type: pack.type || state.type || 'bar',
      labels: src.labels,
      series: src.series.map((s, i) => ({
        name: s.name,
        values: s.values,
        color: state.series?.[i]?.color || '#2E74FF',
      })),
      title: state.title || src.series[0]?.name || '图表',
    }
    if (!linked) use.series = use.series.slice(0, src.series.length)
    const n = Math.min(use.series.length, src.series.length)
    use.series = use.series.slice(0, n)
    use.labels = src.labels
    const refs = {
      cats: src.labelCol == null ? null : absColRange(src.labelCol, src.bodyStart, src.bodyEnd),
      series: src.series.slice(0, n).map((s) => ({
        nameCell: src.headerRow == null ? null : absCell(s.col, src.headerRow),
        nameText: s.name,
        vals: absColRange(s.col, src.bodyStart, src.bodyEnd),
      })),
    }
    const sheetName = String(sheet.name || '数据').slice(0, 31)
    if (!groups.has(sheetName)) groups.set(sheetName, [])
    groups.get(sheetName).push({
      pack: use,
      state,
      refs,
      anchor: spanAnchor(ch, sheet),
      totalRows: src.labels.length,
    })
  }
  return groups
}

async function injectChartsOntoSheets(buf, groups) {
  const zip = await JSZip.loadAsync(buf)
  const fileNo = await worksheetFileNo(zip)
  let ct = await zip.file('[Content_Types].xml').async('string')
  const overrides = []
  let chartSeq = 0
  let drawingSeq = 0
  for (const [sheetName, items] of groups) {
    const sheetNo = fileNo.get(sheetName) || fileNo.values().next().value
    if (!sheetNo || !items.length) continue
    drawingSeq += 1
    const chartFiles = []
    items.forEach((item) => {
      chartSeq += 1
      const file = `chart${chartSeq}.xml`
      chartFiles.push(file)
      zip.file(`xl/charts/${file}`, buildChartXml(item.pack, item.state, item.totalRows, sheetName, item.refs))
      const chartOverride = `<Override PartName="/xl/charts/${file}" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`
      if (!ct.includes(`/xl/charts/${file}`)) overrides.push(chartOverride)
    })
    const drawingFile = `drawing${drawingSeq}.xml`
    zip.file(`xl/drawings/${drawingFile}`, buildAnchoredDrawingXml(items.map((item) => item.anchor)))
    zip.file(`xl/drawings/_rels/${drawingFile}.rels`, multiChartRels(chartFiles))
    await attachDrawing(zip, sheetNo, drawingFile)
    const drawingOverride = `<Override PartName="/xl/drawings/${drawingFile}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`
    if (!ct.includes(`/xl/drawings/${drawingFile}`)) overrides.push(drawingOverride)
  }
  if (overrides.length) {
    ct = ct.replace('</Types>', `${overrides.join('')}</Types>`)
    zip.file('[Content_Types].xml', ct)
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

/**
 * 表格导出：原工作簿按单元格原样写入，图表作为原生图浮在同一张数据表上。
 */
export async function exportTableExcel(workbook, charts, filename, title) {
  const book = univerToBook(workbook)
  if (title) book.title = title
  const groups = tableChartGroups(workbook, charts)
  const buf = await workbookXlsxBuffer(book)
  const blob = groups.size
    ? await injectChartsOntoSheets(buf, groups)
    : new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  downloadBlob(blob, filename || `${title || '表格'}.xlsx`)
  let chartCount = 0
  groups.forEach((items) => { chartCount += items.length })
  return { blob, chartCount }
}

/** 表格里的图表按图库同一套导出：Sheet「图表」原生可编辑图 + Sheet「明细数据」 */
export async function exportSheetChartsExcel(charts, filename) {
  const list = []
  for (const ch of charts || []) {
    const state = ch?.state || {}
    const labels = Array.isArray(ch?.labels) ? ch.labels : []
    const series = state.series || ch?.series || []
    if (!series.length || !labels.length) continue
    list.push({ state, labels, series })
  }
  if (!list.length) throw new Error('没有可导出的图表数据')
  if (list.length === 1) {
    return exportChartExcel({
      state: list[0].state,
      labels: list[0].labels,
      series: list[0].series,
      filename,
    })
  }
  return exportManyChartExcel(list, filename)
}
