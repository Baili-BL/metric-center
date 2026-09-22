import { Chart } from '@antv/g2'
import LabelAdapter from '../utils/label-adapter'
import { hashStr } from '../utils/hash'
import {
  isArea,
  isBarFamily,
  isColFamily,
  isCrossBar,
  isCrossScatter,
  isHbar,
  isPercent,
  isPie,
  isSeasonal,
  isStack,
  isTimeScatter,
  MARKER_SHAPES,
  resolveCrossBarRange,
  resolveCrossTimeIdx,
  sectionValue,
} from './types'
import { applyViewControls, syncViewControlsToChart } from './viewCtrl'
import {
  displayNullText,
  formatAxisLabelValue,
  formatDimTime,
  fmtSeriesVal,
  migrateFmtToDisplay,
} from './fieldFmt'

const DEFAULT_COLORS = ['#1664FF', '#e34d59', '#12b76a', '#f2994a', '#7b61ff', '#56ccf2']

function colorScale(names, colors) {
  return {
    domain: names,
    range: names.map((_, i) => colors[i] || DEFAULT_COLORS[i % DEFAULT_COLORS.length]),
  }
}

function seriesName(s) {
  return s.alias || s.name
}

function dashArr(id) {
  if (id === 'dash' || id === 'dashed') return [6, 4]
  if (id === 'dot' || id === 'dotted') return [2, 3]
  return undefined
}

function markerSpec(id) {
  return MARKER_SHAPES.find((m) => m.id === id) || MARKER_SHAPES[0]
}

function lineShape(lineType) {
  return lineType === 'curve' ? 'smooth' : 'line'
}

function areaShape(lineType) {
  return lineType === 'curve' ? 'smooth' : 'area'
}

function hexToRgba(hex, a) {
  const h = String(hex || '').replace('#', '')
  if (h.length < 6) return `rgba(22,100,255,${a})`
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

function areaFill(color, gradient, op) {
  const c = color || DEFAULT_COLORS[0]
  if (gradient) return `l(270) 0:${hexToRgba(c, Math.min(op, 0.55))} 1:${hexToRgba(c, 0.02)}`
  return hexToRgba(c, Math.min(op, 0.45))
}

function flattenRows(series, labels, nullMode = 'cross') {
  const rows = []
  series.forEach((s) => {
    const vals = s.values || []
    labels.forEach((label, i) => {
      const raw = vals[i]
      const num = Number(raw)
      const empty = raw == null || raw === '' || !Number.isFinite(num)
      if (empty) {
        if (nullMode === 'zero') {
          rows.push({
            x: label,
            value: 0,
            name: seriesName(s),
            color: s.color,
            axis: s.axis || 'left',
            kind: s.kind || 'line',
          })
        } else if (nullMode === 'break') {
          rows.push({
            x: label,
            value: null,
            name: seriesName(s),
            color: s.color,
            axis: s.axis || 'left',
            kind: s.kind || 'line',
          })
        }
        return
      }
      rows.push({
        x: label,
        value: num,
        name: seriesName(s),
        color: s.color,
        axis: s.axis || 'left',
        kind: s.kind || 'line',
      })
    })
  })
  return rows
}

function pieRows(series, labels, spec = {}) {
  const range = resolveCrossBarRange(spec.crossBar, labels)
  let raw = series.map((s) => ({
    name: seriesName(s),
    color: s.color,
    value: Math.abs(Number(sectionValue(s.values || [], range) ?? 0)),
    time: range.time,
  })).filter((r) => r.value > 0)
  if (spec.pieMergeOthers && raw.length > 2) {
    const keep = Math.max(2, Math.min(50, Number(spec.pieMergeCount) || Math.max(2, raw.length - 1)))
    raw = [...raw].sort((a, b) => b.value - a.value)
    if (raw.length > keep) {
      const head = raw.slice(0, keep - 1)
      const rest = raw.slice(keep - 1)
      const merged = rest.reduce((a, b) => a + b.value, 0)
      head.push({
        name: spec.pieOthersName || '其他',
        color: spec.pieOthersColor || '#c4c8cf',
        value: merged,
      })
      raw = head
    }
  }
  const total = raw.reduce((a, b) => a + b.value, 0) || 1
  const dec = spec.tooltipShareDecimals == null ? 2 : Number(spec.tooltipShareDecimals)
  return raw.map((r) => ({
    ...r,
    share: r.value / total,
    labelText: `${r.name} ${(r.value / total * 100).toFixed(Math.max(0, dec))}%`,
  }))
}

function seasonalRows(series, labels, nullMode = 'cross') {
  const years = {}
  labels.forEach((lab, i) => {
    const [y, m] = String(lab).split('-')
    if (!years[y]) years[y] = { year: y, vals: Array(12).fill(null) }
    years[y].vals[Number(m) - 1] = series[0]?.values?.[i]
  })
  const yearList = Object.keys(years).sort()
  const rows = []
  yearList.forEach((y, yi) => {
    years[y].vals.forEach((v, mi) => {
      const num = Number(v)
      const empty = v == null || v === '' || !Number.isFinite(num)
      if (empty) {
        if (nullMode === 'zero') {
          rows.push({ x: mi, md: String(mi + 1).padStart(2, '0'), value: 0, name: `${y}年`, year: y, color: DEFAULT_COLORS[yi % DEFAULT_COLORS.length] })
        } else if (nullMode === 'break') {
          rows.push({ x: mi, md: String(mi + 1).padStart(2, '0'), value: null, name: `${y}年`, year: y, color: DEFAULT_COLORS[yi % DEFAULT_COLORS.length] })
        }
        return
      }
      rows.push({
        x: mi,
        md: String(mi + 1).padStart(2, '0'),
        value: num,
        name: `${y}年`,
        year: y,
        color: DEFAULT_COLORS[yi % DEFAULT_COLORS.length],
      })
    })
  })
  return { rows, years: yearList, colors: yearList.map((_, i) => DEFAULT_COLORS[i % DEFAULT_COLORS.length]) }
}

function crossRows(series, labels, spec = {}) {
  const range = resolveCrossBarRange(spec.crossBar, labels)
  return series.map((s) => ({
    name: seriesName(s),
    value: Number(sectionValue(s.values || [], range) ?? 0),
    color: s.color,
    time: range.time,
  }))
}

const CROSS_SUBJECTS = ['上海', '杭州', '南京', '苏州', '宁波', '无锡', '合肥', '常州', '嘉兴', '绍兴', '南通', '温州']

function crossScatterRows(series, labels, spec = {}) {
  const xSr = series[0]
  const ySr = series[1]
  if (!xSr || !ySr) return []
  const xIdx = resolveCrossTimeIdx(spec.cross?.x, labels)
  const yIdx = resolveCrossTimeIdx(spec.cross?.y, labels)
  const xBase = Number((xSr.values || [])[xIdx])
  const yBase = Number((ySr.values || [])[yIdx])
  if (!Number.isFinite(xBase) || !Number.isFinite(yBase)) return []
  const xName = seriesName(xSr)
  const yName = seriesName(ySr)
  const color = xSr.color || DEFAULT_COLORS[0]
  return CROSS_SUBJECTS.map((name) => {
    const h = hashStr(`${name}|${xSr.name}|${ySr.name}`)
    const rx = 0.72 + ((h % 55) / 100)
    const ry = 0.72 + (((h >> 5) % 55) / 100)
    const corr = (((h >> 9) % 21) - 10) / 100
    return {
      name,
      x: +(xBase * rx).toFixed(2),
      y: +(yBase * (ry + corr)).toFixed(2),
      color,
      xTime: labels[xIdx],
      yTime: labels[yIdx],
      xInd: xName,
      yInd: yName,
    }
  })
}

function textStyle(color, size, bold, italic) {
  return {
    fill: color || '#333333',
    fontSize: Number(size) || 12,
    fontWeight: bold ? 700 : 400,
    fontStyle: italic ? 'italic' : 'normal',
  }
}

function axisTitle(ax, fallback) {
  if (!ax?.showTitle) return false
  const t = String(ax.title || '').trim()
  const u = String(ax.unit || fallback || '').trim()
  if (t && u) return `${t}（${u}）`
  return t || u || false
}

function seriesByAxis(series, side) {
  const list = (series || []).filter((s) => (side === 'right' ? s.axis === 'right' : (s.axis || 'left') !== 'right'))
  return list.find((s) => s.fmt) || list[0] || null
}

function findNamedSeries(series, name) {
  return (series || []).find((s) => (s.alias || s.name) === name)
}

function buildAxis(ax, key, fallbackUnit, mini, spec) {
  const o = ax?.[key] || {}
  if (!o.show) return false
  const isX = key === 'x'
  const title = axisTitle(o, isX ? '' : fallbackUnit)
  const ts = textStyle(o.titleColor, o.titleSize, o.titleBold, o.titleItalic)
  const ls = textStyle(o.labelColor, o.labelSize, o.labelBold, o.labelItalic)
  const cfg = {
    title: title || false,
    titleFill: ts.fill,
    titleFontSize: ts.fontSize,
    titleFontWeight: ts.fontWeight,
    titleFontStyle: ts.fontStyle,
    label: o.showLabels === false ? false : true,
    labelFill: ls.fill,
    labelFontSize: ls.fontSize,
    labelFontWeight: ls.fontWeight,
    labelFontStyle: ls.fontStyle,
    tick: !!o.ticks,
    line: !!o.line,
    lineStroke: o.lineColor || '#c4c8cf',
    lineLineWidth: Number(o.lineWidth) || 1,
    grid: !!o.grid,
    gridStroke: o.gridColor || '#f0f1f4',
    gridLineWidth: Number(o.gridWidth) || 1,
    gridLineDash: dashArr(o.gridDash),
  }
  if (isX) {
    cfg.labelAutoHide = o.labelRule !== 'dense'
    cfg.labelAutoRotate = !mini && o.labelRule !== 'sparse'
    if (o.labelRule === 'sparse') cfg.tickCount = 6
    if (o.labelRule === 'dense') cfg.tickFilter = () => true
    if (o.labelContent === 'index') {
      cfg.labelFormatter = (_v, i) => String((i ?? 0) + 1)
    } else {
      cfg.labelFormatter = (v) => formatDimTime(v, spec?.dimTimeFormat, spec?.dimNullDisplay)
    }
  } else {
    const side = key === 'yR' ? 'right' : 'left'
    const sr = seriesByAxis(spec?.series, side)
    cfg.labelFormatter = (v) => {
      const n = Number(v)
      if (!Number.isFinite(n)) return displayNullText(sr?.nullDisplay || spec?.dimNullDisplay)
      if (sr?.fmt) return formatAxisLabelValue(n, migrateFmtToDisplay(sr.fmt))
      return n.toLocaleString('zh-CN', { maximumFractionDigits: 1 })
    }
    cfg.position = key === 'yR' ? 'right' : 'left'
  }
  return cfg
}

function yScale(axY, rows) {
  const domain = []
  if (axY && axY.minAuto === false && axY.minV != null && axY.minV !== '') domain[0] = Number(axY.minV)
  if (axY && axY.maxAuto === false && axY.maxV != null && axY.maxV !== '') domain[1] = Number(axY.maxV)
  const scale = {}
  if (domain.length === 2 && Number.isFinite(domain[0]) && Number.isFinite(domain[1])) scale.domain = domain
  else if (domain.length && Number.isFinite(domain[0])) {
    const max = Math.max(...rows.map((r) => Number(r.value)).filter(Number.isFinite), domain[0] + 1)
    scale.domain = [domain[0], max]
  }
  if (axY?.reversed) scale.range = [0, 1]
  if (axY?.customTick && axY.tickMode === 'count' && axY.tickCount) scale.tickCount = Number(axY.tickCount)
  if (axY?.customTick && axY.tickMode === 'step' && axY.tickStep) scale.tickMethod = () => {
    const step = Number(axY.tickStep)
    if (!Number.isFinite(step) || step <= 0) return undefined
    return undefined
  }
  if (axY?.customTick && axY.tickMode === 'count') scale.tickCount = Math.max(2, Number(axY.tickCount) || 5)
  return scale
}

function labelCfg(spec, forBar, series) {
  const anySeries = Array.isArray(series) && series.some((s) => s.labelShow)
  if (!spec.labelShow && !anySeries) return undefined
  const pos = spec.labelPos
  let position = 'top'
  if (forBar) {
    if (pos === 'inside' || pos === 'belowLine' || pos === 'bottom') position = 'inside'
    else if (pos === 'center') position = 'inside'
    else position = 'top'
  } else if (pos === 'belowLine' || pos === 'bottom') position = 'bottom'
  const named = series ? seriesMap(series) : null
  const cfg = {
    text: (d) => {
      if (named && !spec.labelShow && !named[d.name]?.labelShow) return ''
      return fmtSeriesVal(d.value, named?.[d.name])
    },
    position,
    style: textStyle(spec.labelColor, spec.labelSize, spec.labelBold, spec.labelItalic),
  }
  if (!spec.labelFull && !spec.labelOverlap) cfg.transform = [{ type: 'overlapHide' }]
  return [cfg]
}

function seriesMap(series) {
  const map = {}
  series.forEach((s) => { map[seriesName(s)] = s })
  return map
}

function lineStyleOf(s, spec) {
  const dash = s?.dash || spec.dash
  const width = s?.lineWidth != null && s.lineWidth !== '' ? Number(s.lineWidth) : Number(spec.width) || 2
  return {
    lineWidth: width,
    lineDash: dashArr(dash),
  }
}

function showMarker(s, spec) {
  if (s && s.marker != null) return !!s.marker
  return !!spec.marker
}

function markerOf(s, spec) {
  return markerSpec(s?.markerShape || spec.markerShape || 'circle')
}

function extremaRows(series, labels, spec) {
  const out = []
  series.forEach((s) => {
    if (!s.minMaxShow) return
    const vals = (s.values || []).map((v, i) => ({ i, v: Number(v) })).filter((x) => Number.isFinite(x.v))
    if (!vals.length) return
    const max = vals.reduce((a, b) => (b.v > a.v ? b : a))
    const min = vals.reduce((a, b) => (b.v < a.v ? b : a))
    if (s.minMaxMax !== false) out.push({ x: labels[max.i], value: max.v, name: seriesName(s), kind: 'max', fill: s.minMaxFill || '#2e74ff', color: s.minMaxColor || '#fff', size: s.minMaxSize || 12, bold: s.minMaxBold, italic: s.minMaxItalic, pos: s.minMaxPos || 'auto' })
    if (s.minMaxMin !== false) out.push({ x: labels[min.i], value: min.v, name: seriesName(s), kind: 'min', fill: s.minMaxFill || '#2e74ff', color: s.minMaxColor || '#fff', size: s.minMaxSize || 12, bold: s.minMaxBold, italic: s.minMaxItalic, pos: s.minMaxPos || 'auto' })
  })
  return out
}

function comboSplit(series) {
  const bars = []
  const lines = []
  const areas = []
  ;(series || []).forEach((s) => {
    const m = s.mark || s.kind
    if (m === 'bar') bars.push(s)
    else if (m === 'area') areas.push(s)
    else if (m === 'line') lines.push(s)
    else if (s.axis === 'right') lines.push(s)
    else bars.push(s)
  })
  if (!bars.length && !lines.length && !areas.length) {
    if ((series || []).length < 2) return { lines: series || [], bars: [], areas: [] }
    return { lines: [series[0]], bars: series.slice(1), areas: [] }
  }
  return { lines, bars, areas }
}

export function decideMiniLayout(el, type, labels, unit) {
  if (!LabelAdapter?.decideLayout || !el) return null
  const chartType = type === 'pie' ? 'pie' : type === 'hbar' ? 'hbar' : (type && String(type).includes('Col')) || type === 'crossBar' ? 'bar' : 'line'
  return LabelAdapter.decideLayout({
    surface: 'galleryMini',
    chartType,
    container: el,
    labels: labels || [],
    yTickSamples: ['0', '50', '100'],
    fontSize: 10,
    yFontSize: 10,
    unitFontSize: 10,
    fontFamily: 'sans-serif',
    chrome: { legendOutside: true, yUnitTop: !!unit, dualAxis: false, xTitle: false },
    uiRule: 'smart',
  })
}

function applyCartesianView(chart, spec, rows, children, names, colors, extra = {}) {
  const {
    type, unit, axisShow, ax, dual, dualSync, tooltipShow, customLegend,
    barWidth, mini, markLine,
  } = spec
  const layout = extra.layout
  const xPad = isColFamily(type) || isHbar(type)
    ? Math.max(0, Math.min(0.9, 1 - (Number(barWidth) || 55) / 100))
    : undefined

  const axis = axisShow === false
    ? { x: false, y: false }
    : {
      x: layout?.axis?.x || buildAxis(ax, 'x', '', mini, spec),
      y: buildAxis(ax, 'yL', unit, mini, spec),
    }

  const scale = { color: colorScale(names, colors) }
  if (xPad != null) scale.x = { paddingInner: xPad, paddingOuter: xPad / 2 }
  const yS = yScale(ax?.yL, rows)
  if (Object.keys(yS).length) scale.y = yS

  if (dual && extra.rightRows?.length) {
    axis.y1 = buildAxis(ax, 'yR', unit, mini, spec)
    const yR = yScale(ax?.yR, extra.rightRows)
    if (dualSync === 'value') {
      const all = [...rows, ...extra.rightRows].map((r) => Number(r.value)).filter(Number.isFinite)
      const domain = [Math.min(0, ...all), Math.max(...all)]
      scale.y = { ...(scale.y || {}), domain }
      scale.y1 = { independent: true, domain }
    } else {
      scale.y1 = { independent: true, ...yR, tickCount: dualSync === 'count' ? (scale.y?.tickCount || ax?.yL?.tickCount || 5) : yR.tickCount }
    }
  }

  const ml = Number(markLine)
  if (Number.isFinite(ml) && String(markLine ?? '').trim() !== '') {
    children.push({
      type: 'lineY',
      data: [ml],
      style: { stroke: '#e34d59', lineDash: [5, 4], lineWidth: 1.5 },
    })
  }

  const view = {
    type: 'view',
    data: rows,
    scale,
    axis,
    legend: mini || customLegend ? false : { color: { position: 'top' } },
    tooltip: tooltipShow ? {
      css: spec.tooltipBg ? { '.g2-tooltip': { background: spec.tooltipBg, color: spec.tooltipColor, fontSize: `${spec.tooltipSize || 12}px` } } : undefined,
      items: [{
        channel: 'y',
        value: (d) => fmtSeriesVal(d.value, findNamedSeries(spec.series, d.name)),
      }],
    } : false,
    children,
  }
  applyViewControls(view, chart, spec, extra.labels || spec.labels || [], extra.host || chart.getContainer?.())
  if (isHbar(type)) view.coordinate = { transform: [{ type: 'transpose' }] }
  chart.options(view)
  syncViewControlsToChart(chart, view)
}

const SPARK_LINE = '#0016ED'
const SPARK_FILL = 'rgba(0,22,237,.10)'

function paintSparkArea(el, spec) {
  const vals = (spec.series?.[0]?.values || []).map(Number).filter((v) => Number.isFinite(v))
  if (!vals.length) {
    el.innerHTML = ''
    return null
  }
  const pts = vals.map((v, i) => ({ i, v }))
  let ymin = Math.min(...vals)
  let ymax = Math.max(...vals)
  const ypad = (ymax - ymin) * 0.08 || 1
  const xScale = { type: 'linear', nice: false, range: [0, 1], domain: [0, pts.length - 1] }
  const yScale = { nice: false, domain: [ymin - ypad, ymax + ypad] }
  const chart = new Chart({
    container: el,
    autoFit: true,
    width: el.clientWidth || 280,
    height: spec.height || el.clientHeight || 86,
    margin: 0,
    padding: 0,
    inset: 0,
    axis: false,
    legend: false,
    tooltip: false,
    theme: 'light',
    animation: false,
  })
  chart
    .area()
    .data(pts)
    .encode('x', 'i')
    .encode('y', 'v')
    .scale('x', xScale)
    .scale('y', yScale)
    .style('fill', SPARK_FILL)
    .axis(false)
    .legend(false)
    .tooltip(false)
  chart
    .line()
    .data(pts)
    .encode('x', 'i')
    .encode('y', 'v')
    .scale('x', xScale)
    .scale('y', yScale)
    .style('stroke', SPARK_LINE)
    .style('lineWidth', 3)
    .style('lineCap', 'round')
    .style('lineJoin', 'round')
    .axis(false)
    .legend(false)
    .tooltip(false)
  chart.render()
  return chart
}

export function paintChart(el, spec) {
  if (!el) return null
  if (spec?.type === 'sparkArea' || spec?.spark) return paintSparkArea(el, spec)
  const {
    type = 'line',
    series = [],
    labels = [],
    unit = '',
    height,
    mini = false,
    fillOpacity = 100,
    barRadius = 0,
    pieStyle = 'pie',
    pieRadius = 92,
    tooltipShow = true,
    customLegend = false,
    markLine = '',
    lineType = 'curve',
    dash = 'solid',
    width = 3,
    marker = false,
    markerShape = 'circle',
    nullMode = 'cross',
    gradient = false,
  } = spec

  const names = series.map(seriesName)
  const colors = series.map((s, i) => s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length])
  const op = Math.max(0, Math.min(100, Number(fillOpacity) || 100)) / 100
  const radius = Math.max(0, Math.min(24, Number(barRadius) || 0))
  const layout = mini ? decideMiniLayout(el, type, labels, unit) : null
  const smap = seriesMap(series)

  const chart = new Chart({
    container: el,
    autoFit: true,
    height: height || el.clientHeight || (mini ? 132 : 420),
  })

  if (isSeasonal(type)) {
    const pack = seasonalRows(series, labels, nullMode)
    const children = [{
      type: 'line',
      encode: { x: 'md', y: 'value', color: 'name', shape: lineShape(lineType) },
      style: { lineWidth: Number(width) || 1.8, lineDash: dashArr(dash) },
      labels: labelCfg(spec, false),
    }]
    if (marker) {
      const mk = markerSpec(markerShape)
      children.push({
        type: 'point',
        encode: { x: 'md', y: 'value', color: 'name', shape: mk.g2 },
        style: { r: mini ? 2.5 : 3.5, fillOpacity: mk.hollow ? 0 : 1, stroke: mk.hollow ? undefined : undefined, lineWidth: mk.hollow ? 1.4 : 0 },
      })
    }
    applyCartesianView(chart, { ...spec, type, mini, customLegend, tooltipShow, markLine }, pack.rows, children, pack.years.map((y) => `${y}年`), pack.colors, { layout })
    chart.render()
    return chart
  }

  if (isPie(type)) {
    const data = pieRows(series, labels, spec)
    if (!data.length) {
      el.innerHTML = '<div class="hc-fallback" style="height:100%;display:flex;align-items:center;justify-content:center;color:#86909C;font-size:13px">请添加指标并确认截面时间有数据</div>'
      return null
    }
    const outerR = Math.max(0.35, Math.min(1, (Number(pieRadius) || 92) / 100))
    const innerR = pieStyle === 'donut' ? Math.max(0, Math.min(outerR - 0.1, outerR * 0.52)) : 0
    const shareDec = spec.tooltipShareDecimals == null ? 2 : Number(spec.tooltipShareDecimals)
    chart
      .interval()
      .coordinate({ type: 'theta', outerRadius: outerR, innerRadius: innerR })
      .data(data)
      .transform({ type: 'stackY' })
      .encode('y', 'value')
      .encode('color', 'name')
      .scale('color', colorScale(data.map((d) => d.name), data.map((d) => d.color)))
      .style('stroke', '#fff')
      .style('lineWidth', 2)
      .style('fillOpacity', op)
      .axis(false)
      .legend(mini || customLegend ? false : true)
      .tooltip(tooltipShow ? {
        title: (d) => d.name,
        items: spec.tooltipShare === false
          ? [{ channel: 'y' }]
          : [{ channel: 'y' }, { name: '占比', value: (d) => `${(d.share * 100).toFixed(Math.max(0, shareDec))}%` }],
      } : false)
    if (spec.labelShow) {
      chart.encode('label', 'labelText')
      chart.label({
        text: 'labelText',
        style: textStyle(spec.labelColor, spec.labelSize, spec.labelBold, spec.labelItalic),
      })
    }
    chart.render()
    return chart
  }

  if (isCrossBar(type)) {
    const data = crossRows(series, labels, spec)
    if (!data.length) {
      el.innerHTML = '<div class="hc-fallback" style="height:100%;display:flex;align-items:center;justify-content:center;color:#86909C;font-size:13px">请添加指标并确认截面时间有数据</div>'
      return null
    }
    const children = [{
      type: 'interval',
      encode: { x: 'name', y: 'value', color: 'name' },
      style: { fillOpacity: op, radiusTopLeft: radius, radiusTopRight: radius },
      labels: labelCfg(spec, true),
    }]
    applyCartesianView(chart, { ...spec, type, mini, customLegend: true, tooltipShow, markLine }, data, children, data.map((d) => d.name), data.map((d) => d.color), { layout })
    chart.render()
    return chart
  }

  if (isCrossScatter(type)) {
    const data = crossScatterRows(series, labels, spec)
    if (!data.length) {
      el.innerHTML = '<div class="hc-fallback" style="height:100%;display:flex;align-items:center;justify-content:center;color:#86909C;font-size:13px">请分别选择 X / Y 轴指标</div>'
      return null
    }
    const mk = markerSpec(markerShape)
    const xName = data[0].xInd
    const yName = data[0].yInd
    const xTime = data[0].xTime
    const yTime = data[0].yTime
    const ax = spec.ax || {}
    const patched = {
      ...spec,
      ax: {
        ...ax,
        x: {
          ...(ax.x || {}),
          showTitle: true,
          title: (ax.x?.showTitle && ax.x?.title) ? ax.x.title : `${xName}（${xTime}）`,
        },
        yL: {
          ...(ax.yL || {}),
          showTitle: true,
          title: (ax.yL?.showTitle && ax.yL?.title) ? ax.yL.title : `${yName}（${yTime}）`,
        },
      },
    }
    const children = [{
      type: 'point',
      encode: { x: 'x', y: 'y', shape: mk.g2 },
      style: {
        r: mini ? 4 : 6,
        fill: data[0].color,
        fillOpacity: mk.hollow ? 0.15 : 0.85,
        stroke: '#fff',
        lineWidth: 1,
      },
      labels: spec.labelShow ? [{
        text: (d) => d.name,
        position: 'top',
        style: textStyle(spec.labelColor, spec.labelSize, spec.labelBold, spec.labelItalic),
      }] : undefined,
    }]
    applyCartesianView(chart, { ...patched, type, mini, customLegend: true, tooltipShow, markLine }, data, children, [xName], [data[0].color], { layout })
    chart.render()
    return chart
  }

  if (type === 'scatter' || isTimeScatter(type)) {
    const a = series[0] || { values: [] }
    const b = series[1] || a
    const data = labels.map((lab, i) => ({
      x: type === 'scatter' ? Number((a.values || [])[i] ?? i) : lab,
      y: Number((b.values || [])[i] ?? 0),
      name: seriesName(a) || '散点',
    })).filter((r) => Number.isFinite(r.y))
    const mk = markerSpec(markerShape)
    const children = [{
      type: 'point',
      data,
      encode: { x: 'x', y: 'y', color: 'name', shape: mk.g2 },
      style: { r: mini ? 3 : 5, fillOpacity: mk.hollow ? 0 : 1, lineWidth: mk.hollow ? 1.4 : 0 },
      labels: spec.labelShow ? [{
        text: (d) => Number(d.y).toLocaleString('en-US'),
        position: spec.labelPos === 'belowLine' || spec.labelPos === 'bottom' ? 'bottom' : 'top',
        style: textStyle(spec.labelColor, spec.labelSize, spec.labelBold, spec.labelItalic),
      }] : undefined,
    }]
    applyCartesianView(chart, { ...spec, type, mini, customLegend: true, tooltipShow, markLine }, data, children, [data[0]?.name || '散点'], [colors[0]], { layout })
    chart.render()
    return chart
  }

  const stacked = isStack(type)
  const percent = isPercent(type)
  const bar = isBarFamily(type)
  const area = isArea(type)
  const useDual = !!(spec.dual && series.some((s) => s.axis === 'right') && !bar)

  const leftSeries = useDual ? series.filter((s) => (s.axis || 'left') !== 'right') : series
  const rightSeries = useDual ? series.filter((s) => s.axis === 'right') : []
  const rows = flattenRows(leftSeries.length ? leftSeries : series, labels, nullMode)
  const rightRows = rightSeries.length ? flattenRows(rightSeries, labels, nullMode) : []

  if (!rows.length && !rightRows.length) {
    el.innerHTML = '<div class="hc-fallback" style="height:100%;display:flex;align-items:center;justify-content:center;color:#86909C;font-size:13px">没有数据</div>'
    return null
  }

  function marks(srcSeries, srcRows, yKey) {
    const children = []
    const encodeY = yKey === 'y1' ? { y: 'value' } : { y: 'value' }
    const scale = yKey === 'y1' ? { y: { independent: true, key: 'y1' } } : undefined
    const axis = yKey === 'y1' ? { y: 'y1' } : undefined

    if (type === 'combo') {
      const { lines, bars, areas } = comboSplit(srcSeries)
      if (bars.length) {
        const barRows = flattenRows(bars, labels, 'zero')
        children.push({
          type: 'interval',
          data: barRows,
          encode: { x: 'x', ...encodeY, color: 'name' },
          scale,
          axis,
          style: {
            fillOpacity: op,
            radiusTopLeft: radius,
            radiusTopRight: radius,
            stroke: (d) => smap[d.name]?.barStroke || undefined,
            lineWidth: (d) => Number(smap[d.name]?.barStrokeWidth) || 0,
          },
          transform: [{ type: 'dodgeX' }],
          labels: labelCfg(spec, true, bars),
        })
      }
      if (lines.length) {
        const lineRows = flattenRows(lines, labels, nullMode)
        children.push({
          type: 'line',
          data: lineRows,
          encode: { x: 'x', ...encodeY, color: 'name', shape: lineShape(lineType) },
          scale,
          axis,
          style: {
            lineWidth: (d) => lineStyleOf(smap[d.name], spec).lineWidth,
            lineDash: (d) => lineStyleOf(smap[d.name], spec).lineDash,
          },
          labels: labelCfg(spec, false, lines),
        })
        if (marker || lines.some((s) => showMarker(s, spec))) {
          children.push({
            type: 'point',
            data: lineRows.filter((r) => r.value != null),
            encode: { x: 'x', ...encodeY, color: 'name', shape: (d) => markerOf(smap[d.name], spec).g2 },
            scale,
            axis,
            style: {
              r: mini ? 2.5 : 3.5,
              fillOpacity: (d) => (markerOf(smap[d.name], spec).hollow ? 0 : 1),
              lineWidth: (d) => (markerOf(smap[d.name], spec).hollow ? 1.4 : 0),
            },
          })
        }
      }
      if (areas.length) {
        const areaRows = flattenRows(areas, labels, nullMode)
        children.push({
          type: 'area',
          data: areaRows,
          encode: { x: 'x', ...encodeY, color: 'name', shape: areaShape(lineType) },
          scale,
          axis,
          style: {
            fillOpacity: op,
            fill: (d) => areaFill(smap[d.name]?.color || d.color, spec.gradient, op),
          },
          labels: labelCfg(spec, false, areas),
        })
        children.push({
          type: 'line',
          data: areaRows,
          encode: { x: 'x', ...encodeY, color: 'name', shape: lineShape(lineType) },
          scale,
          axis,
          style: {
            lineWidth: (d) => lineStyleOf(smap[d.name], spec).lineWidth,
            lineDash: (d) => lineStyleOf(smap[d.name], spec).lineDash,
          },
        })
      }
      return children
    }

    if (bar) {
      children.push({
        type: 'interval',
        data: srcRows,
        encode: { x: 'x', ...encodeY, color: 'name' },
        scale,
        axis,
        style: {
          fillOpacity: op,
          ...(isHbar(type)
            ? { radiusTopRight: radius, radiusBottomRight: radius }
            : { radiusTopLeft: radius, radiusTopRight: radius }),
          stroke: (d) => smap[d.name]?.barStroke || undefined,
          lineWidth: (d) => Number(smap[d.name]?.barStrokeWidth) || 0,
        },
        transform: stacked
          ? (percent ? [{ type: 'stackY' }, { type: 'normalizeY' }] : [{ type: 'stackY' }])
          : [{ type: 'dodgeX' }],
        labels: labelCfg(spec, true, srcSeries),
      })
      return children
    }

    if (area) {
      children.push({
        type: 'area',
        data: srcRows,
        encode: { x: 'x', ...encodeY, color: 'name', shape: areaShape(lineType) },
        scale,
        axis,
        style: {
          fill: (d) => areaFill(smap[d.name]?.color || d.color, gradient, op),
          fillOpacity: gradient ? 1 : Math.min(op, 0.45),
        },
        transform: stacked ? (percent ? [{ type: 'stackY' }, { type: 'normalizeY' }] : [{ type: 'stackY' }]) : [],
      })
      children.push({
        type: 'line',
        data: srcRows,
        encode: { x: 'x', ...encodeY, color: 'name', shape: lineShape(lineType) },
        scale,
        axis,
        style: {
          lineWidth: (d) => lineStyleOf(smap[d.name], spec).lineWidth,
          lineDash: (d) => lineStyleOf(smap[d.name], spec).lineDash,
        },
        transform: stacked ? (percent ? [{ type: 'stackY' }, { type: 'normalizeY' }] : [{ type: 'stackY' }]) : [],
        labels: labelCfg(spec, false, srcSeries),
      })
    } else {
      children.push({
        type: 'line',
        data: srcRows,
        encode: { x: 'x', ...encodeY, color: 'name', shape: lineShape(lineType) },
        scale,
        axis,
        style: {
          lineWidth: (d) => lineStyleOf(smap[d.name], spec).lineWidth || Number(width) || 2,
          lineDash: (d) => lineStyleOf(smap[d.name], spec).lineDash,
        },
        labels: labelCfg(spec, false, srcSeries),
      })
    }

    const marked = srcSeries.filter((s) => showMarker(s, spec))
    if (marked.length) {
      children.push({
        type: 'point',
        data: srcRows.filter((r) => r.value != null && marked.some((s) => seriesName(s) === r.name)),
        encode: { x: 'x', ...encodeY, color: 'name', shape: (d) => markerOf(smap[d.name], spec).g2 },
        scale,
        axis,
        style: {
          r: mini ? 2.5 : 3.5,
          fillOpacity: (d) => (markerOf(smap[d.name], spec).hollow ? 0 : 1),
          lineWidth: (d) => (markerOf(smap[d.name], spec).hollow ? 1.4 : 0),
        },
      })
    }
    return children
  }

  const children = [
    ...marks(leftSeries.length ? leftSeries : series, rows, 'y'),
    ...(rightRows.length ? marks(rightSeries, rightRows, 'y1') : []),
  ]

  const extrema = extremaRows(series, labels, spec)
  if (extrema.length) {
    children.push({
      type: 'point',
      data: extrema,
      encode: { x: 'x', y: 'value' },
      style: {
        r: 5,
        fill: (d) => d.fill,
        stroke: '#fff',
        lineWidth: 1,
      },
      labels: [{
        text: (d) => Number(d.value).toLocaleString('en-US'),
        position: d => (d.pos === 'bottom' || (d.pos === 'auto' && d.kind === 'min') ? 'bottom' : 'top'),
        style: (d) => ({
          ...textStyle(d.color, d.size, d.bold, d.italic),
          background: true,
          fill: d.color,
        }),
      }],
    })
  }

  applyCartesianView(chart, { ...spec, type, mini, customLegend, tooltipShow, markLine }, rows.length ? rows : rightRows, children, names, colors, { layout, rightRows })
  chart.render()
  return chart
}
