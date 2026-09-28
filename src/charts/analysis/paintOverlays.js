import {
  dashLineArr,
  defaultAnnoCfg,
  isUnsetColor,
  normalizeAnno,
  normalizeGuide,
  normalizeTrend,
} from './types'
import { resolveGuideValue } from './guideMath'
import { fitTrendRows } from './trendFit'

function seriesNameOf(s) {
  return s?.alias || s?.name || ''
}

function findSeries(list, name) {
  if (!name) return list?.[0] || null
  return list?.find((s) => s.name === name || seriesNameOf(s) === name) || list?.[0] || null
}

function yExtent(seriesList) {
  let min = Infinity
  let max = -Infinity
  ;(seriesList || []).forEach((s) => {
    ;(s.values || []).forEach((v) => {
      if (v != null && Number.isFinite(+v)) {
        const n = +v
        if (n < min) min = n
        if (n > max) max = n
      }
    })
  })
  if (min === Infinity) return [0, 1]
  if (min === max) {
    const pad = Math.abs(max) * 0.05 || 1
    return [min - pad, max + pad]
  }
  return [min, max]
}

function annoDimsOf(a) {
  if (Array.isArray(a.dims) && a.dims.length) return a.dims
  if (a.dim != null && a.dim !== '') return [a.dim]
  return []
}

function annoThresholdValue(sr, cfg) {
  if (cfg?.rangeType === 'fixed') {
    const fv = parseFloat(cfg.customVal)
    return Number.isFinite(fv) ? fv : null
  }
  const nums = (sr?.values || []).map(Number).filter(Number.isFinite)
  if (!nums.length) return null
  const k = cfg.thresholdVal || 'avg'
  if (k === 'custom') {
    const c = parseFloat(cfg.customVal)
    return Number.isFinite(c) ? c : null
  }
  if (k === 'max') return Math.max(...nums)
  if (k === 'min') return Math.min(...nums)
  if (k === 'median') {
    const s = nums.slice().sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
  }
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function annoBetweenRange(cfg) {
  const a = parseFloat(cfg?.betweenMin)
  const b = parseFloat(cfg?.betweenMax)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return a <= b ? [a, b] : [b, a]
}

function annoMatchOp(v, op, t, cfg) {
  if (op === 'between') {
    const rg = annoBetweenRange(cfg)
    if (!rg) return false
    return v >= rg[0] && v <= rg[1]
  }
  if (op === '<=') return v <= t
  if (op === '>') return v > t
  if (op === '<') return v < t
  if (op === '=') return Math.abs(v - t) < 1e-9
  return v >= t
}

function resolveMeasure(a, seriesList, labels) {
  const cfg = { ...defaultAnnoCfg(), ...(a.cfg || {}) }
  const sr = findSeries(seriesList, cfg.measure)
  if (!sr) return null
  const op = cfg.thresholdOp || '>='
  let t = null
  let hi = null
  if (op === 'between') {
    const rg = annoBetweenRange(cfg)
    if (!rg) return null
    t = rg[0]
    hi = rg[1]
  } else {
    t = annoThresholdValue(sr, cfg)
    if (t == null) return null
  }
  const rows = []
  const vals = sr.values || []
  for (let i = 0; i < labels.length; i++) {
    const v = vals[i]
    if (v == null || !Number.isFinite(+v)) continue
    const vv = +v
    if (annoMatchOp(vv, op, t, cfg)) {
      rows.push({
        x: labels[i],
        value: vv,
        name: seriesNameOf(sr),
        color: sr.color,
        axis: sr.axis || 'left',
      })
    }
  }
  return { rows, threshold: t, thresholdHi: hi, cfg, series: sr }
}

function guideLabelText(g, value) {
  if (g.labelMode === 'none') return ''
  if (g.desc && String(g.desc).trim()) return String(g.desc).trim()
  if (g.labelMode === 'value') {
    return Number.isFinite(value) ? String(+Number(value).toFixed(2)) : ''
  }
  return g.name || ''
}

function guideLabelPosition(textPos) {
  if (textPos === 'left') return 'left'
  if (textPos === 'center') return 'top'
  return 'right'
}

function buildGuideChildren(guides, seriesList, labels) {
  const out = []
  ;(guides || []).forEach((raw) => {
    const g = normalizeGuide(raw, seriesList?.[0]?.name || '')
    const v = resolveGuideValue(g, seriesList, labels)
    if (v == null || !Number.isFinite(v)) return
    const dash = dashLineArr(g.dash)
    const color = g.color || '#8c8c8c'
    const lab = guideLabelText(g, v)
    const child = {
      type: 'lineY',
      data: [v],
      style: {
        stroke: color,
        lineWidth: g.width || 2,
        ...(dash ? { lineDash: dash } : {}),
      },
      tooltip: false,
    }
    if (lab) {
      child.labels = [{
        text: lab,
        position: guideLabelPosition(g.textPos),
        style: {
          fill: g.textColor || '#1f2329',
          fontSize: g.textSize || 12,
        },
      }]
    }
    out.push(child)
  })
  return out
}

function buildTrendChildren(trends, seriesList, labels) {
  const out = []
  const list = (trends || []).map((t) => normalizeTrend(t, seriesList?.[0]?.name || ''))
  list.forEach((tr) => {
    const targets = tr.series
      ? seriesList.filter((s) => s.name === tr.series)
      : seriesList
    targets.forEach((sr) => {
      const rows = fitTrendRows(sr, labels, tr)
      if (rows.length < 2) return
      const dash = dashLineArr(tr.dash)
      out.push({
        type: 'line',
        data: rows,
        encode: { x: 'x', y: 'value' },
        style: {
          stroke: tr.color || '#f2994a',
          lineWidth: 1.3,
          strokeOpacity: 0.9,
          ...(dash ? { lineDash: dash } : {}),
        },
        axis: false,
        legend: false,
        tooltip: false,
      })
    })
  })
  return out
}

function buildMeasureAnnoChildren(a, seriesList, labels) {
  const r = resolveMeasure(a, seriesList, labels)
  if (!r) return []
  const cfg = r.cfg
  const op = cfg.thresholdOp || '>='
  const ext = yExtent(seriesList)
  let y0
  let y1
  if (op === 'between') {
    const rg = r.thresholdHi != null ? [r.threshold, r.thresholdHi] : annoBetweenRange(cfg)
    if (!rg) return []
    y0 = rg[0]
    y1 = rg[1]
  } else {
    const t = r.threshold
    if (t == null || !Number.isFinite(t)) return []
    if (op === '<=' || op === '<') { y0 = ext[0]; y1 = t }
    else if (op === '=') { y0 = t; y1 = t }
    else { y0 = t; y1 = ext[1] }
  }
  if (y0 > y1) { const sw = y0; y0 = y1; y1 = sw }
  const fill = cfg.rangeColor || '#2e74ff'
  const out = []
  if (cfg.rangeStyle === 'line' || op === '=') {
    const lineVals = op === 'between' ? [y0, y1] : [r.threshold]
    out.push({
      type: 'lineY',
      data: lineVals,
      style: {
        stroke: fill,
        lineWidth: 1.2,
        lineDash: [4, 4],
        pointerEvents: 'none',
      },
      legend: false,
      tooltip: false,
    })
  } else {
    out.push({
      type: 'rangeY',
      data: [{ yRange: [y0, y1] }],
      encode: { y: 'yRange' },
      style: {
        fill,
        fillOpacity: 0.18,
        pointerEvents: 'none',
      },
      legend: false,
      tooltip: false,
    })
  }
  if (cfg.showPoint && r.rows.length && !isUnsetColor(cfg.pointColor)) {
    out.push({
      type: 'point',
      data: r.rows,
      encode: { x: 'x', y: 'value', size: () => 3 },
      scale: { size: { type: 'identity', independent: true } },
      style: {
        fill: cfg.pointColor,
        stroke: '#fff',
        lineWidth: 1.2,
        pointerEvents: 'none',
      },
      legend: false,
      tooltip: false,
      axis: false,
    })
  }
  if (cfg.showLabel !== false) {
    const lab = cfg.labelText || a.text || a.name || '区间'
    out.push({
      type: 'text',
      data: [{
        x: labels[labels.length - 1],
        value: y1,
        annoText: lab,
      }],
      encode: { x: 'x', y: 'value', text: 'annoText' },
      style: {
        fill: '#1f2329',
        fontSize: 11,
        textAlign: 'right',
        textBaseline: 'top',
        dx: -8,
        dy: 6,
        pointerEvents: 'none',
      },
      legend: false,
      tooltip: false,
      axis: false,
    })
  }
  return out
}

function buildManualAnnoChildren(a, seriesList, labels) {
  const cfg = { ...defaultAnnoCfg(), ...(a.cfg || {}) }
  const dims = annoDimsOf(a)
  if (!dims.length) return []
  const sr = findSeries(seriesList, a.series)
  const out = []
  const yMax = yExtent(seriesList)[1]
  const pointRows = []
  dims.forEach((d) => {
    const idx = labels.indexOf(d)
    if (idx < 0 || !sr) return
    const val = sr.values?.[idx]
    if (val == null || !Number.isFinite(+val)) return
    pointRows.push({
      x: d,
      value: +val,
      annoText: a.text || a.name || '拐点',
    })
  })

  if (!isUnsetColor(cfg.dimBg)) {
    dims.forEach((d) => {
      if (labels.indexOf(d) < 0) return
      out.push({
        type: 'rangeX',
        data: [{ xRange: [d, d] }],
        encode: { x: 'xRange' },
        style: {
          fill: cfg.dimBg,
          fillOpacity: 0.18,
          pointerEvents: 'none',
        },
        legend: false,
        tooltip: false,
      })
    })
  }

  if (cfg.showNote !== false && pointRows.length) {
    out.push({
      type: 'text',
      data: pointRows.map((r) => ({ ...r, value: yMax })),
      encode: { x: 'x', y: 'value', text: 'annoText' },
      style: {
        fill: '#1f2329',
        fontSize: 11,
        fontWeight: 500,
        textAlign: 'center',
        textBaseline: 'bottom',
        dy: -8,
        background: true,
        backgroundFill: '#ffffff',
        backgroundRadius: 2,
        backgroundPadding: [2, 6],
        pointerEvents: 'none',
      },
      legend: false,
      tooltip: false,
      axis: false,
    })
  }

  if (cfg.showPoint !== false && pointRows.length && !isUnsetColor(cfg.pointColorM)) {
    out.push({
      type: 'point',
      data: pointRows,
      encode: { x: 'x', y: 'value', size: () => 3 },
      scale: { size: { type: 'identity', independent: true } },
      style: {
        fill: '#ffffff',
        stroke: cfg.pointColorM,
        lineWidth: 1.4,
        pointerEvents: 'none',
      },
      legend: false,
      tooltip: false,
      axis: false,
    })
  }
  return out
}

function buildAnnoChildren(annos, seriesList, labels) {
  const out = []
  ;(annos || []).forEach((raw) => {
    const a = normalizeAnno(raw)
    if (a.visible === false) return
    const mode = a.cfg?.mode || (a.dim != null ? 'manual' : 'measure')
    if (mode === 'measure') out.push(...buildMeasureAnnoChildren(a, seriesList, labels))
    else out.push(...buildManualAnnoChildren(a, seriesList, labels))
  })
  return out
}

/**
 * Build G2 overlay children for analysis guides / trends / annos.
 * Falls back to legacy markLine when guides is empty.
 */
export function buildAnalysisOverlays(spec, labels) {
  if (!spec || spec.type === 'pie') return []
  const seriesList = spec.series || []
  const labs = labels || spec.labels || []
  const guides = spec.guides || []
  const trends = spec.trends || []
  const annos = spec.annos || []
  const out = []

  if (guides.length) {
    out.push(...buildGuideChildren(guides, seriesList, labs))
  } else {
    const ml = Number(spec.markLine)
    if (Number.isFinite(ml) && String(spec.markLine ?? '').trim() !== '') {
      out.push({
        type: 'lineY',
        data: [ml],
        style: { stroke: '#e34d59', lineDash: [5, 4], lineWidth: 1.5 },
        labels: [{
          text: `预警 ${ml}`,
          position: 'right',
          style: { fill: '#e34d59', fontSize: 11 },
        }],
        tooltip: false,
      })
    }
  }

  out.push(...buildTrendChildren(trends, seriesList, labs))
  out.push(...buildAnnoChildren(annos, seriesList, labs))
  return out
}
