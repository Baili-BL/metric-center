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
  if (Array.isArray(a.dim) && a.dim.length) return a.dim
  if (a.dim != null && a.dim !== '') return [a.dim]
  return []
}

/** 相邻维度下标合并成连续段（对齐 ai-lab annoIndexRanges） */
function annoIndexRanges(a, labels) {
  const seen = Object.create(null)
  const idxs = []
  annoDimsOf(a).forEach((d) => {
    const i = labels.indexOf(d)
    if (i < 0 || seen[i]) return
    seen[i] = true
    idxs.push(i)
  })
  idxs.sort((x, y) => x - y)
  const ranges = []
  idxs.forEach((i) => {
    const last = ranges[ranges.length - 1]
    if (!last || i !== last.end + 1) ranges.push({ start: i, end: i })
    else last.end = i
  })
  return ranges
}

/** 每段：中点类目 + 共用说明文案（名称/描述合并） */
function annoBandMeta(a, labels) {
  const text = a.text || a.name || '手工标注'
  return annoIndexRanges(a, labels).map((rg) => {
    const mid = Math.round((rg.start + rg.end) / 2)
    return {
      start: rg.start,
      end: rg.end,
      mid,
      x: labels[mid],
      annoText: text,
    }
  })
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
      const pos = guideLabelPosition(g.textPos)
      child.labels = [{
        text: lab,
        position: pos,
        // 白色背景芯片：文字叠在标识线上时把线"垫"住，既不压线也不会因上移被绘图区裁剪
        background: {
          fill: '#ffffff',
          opacity: 0.9,
          padding: [1, 4],
          radius: 2,
        },
        style: {
          fill: g.textColor || '#1f2329',
          fontSize: g.textSize || 12,
          lineHeight: 1,
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
      data: [{ value: [y0, y1] }],
      encode: { y: 'value' },
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
    })
  }
  if (cfg.showLabel !== false) {
    const lab = cfg.labelText || a.text || a.name || '区间'
    // 同手工标注：独立 text 标记不渲染，改用不可见 point 锚点 + labels 管道
    out.push({
      type: 'point',
      data: [{
        x: labels[labels.length - 1],
        value: y1,
        annoText: lab,
      }],
      encode: { x: 'x', y: 'value' },
      style: {
        r: 2,
        fill: '#ffffff',
        fillOpacity: 0,
        stroke: '#ffffff',
        strokeOpacity: 0,
        lineWidth: 0,
        pointerEvents: 'none',
      },
      labels: [{
        text: (d) => d.annoText,
        position: 'top',
        dx: -8,
        dy: 4,
        style: {
          fill: '#1f2329',
          fontSize: 11,
          lineHeight: 1,
          textAlign: 'right',
          pointerEvents: 'none',
        },
      }],
      legend: false,
      tooltip: false,
    })
  }
  return out
}

function buildManualAnnoChildren(a, seriesList, labels, opts = {}) {
  const cfg = { ...defaultAnnoCfg(), ...(a.cfg || {}) }
  const dims = annoDimsOf(a)
  if (!dims.length) return []
  const sr = findSeries(seriesList, a.series)
  const out = []
  const bands = annoBandMeta(a, labels)
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
    /* 维度背景：同一标注内连续维在视觉上连成一片（bandStep 占满格缝）；
       数据仍铺全部分类目，仅选中列 opacity=0.18，避免改写共享 band domain。 */
    const bandStep = Number(opts.bandStepPx) || 0
    const wantDims = dims.filter((d) => labels.indexOf(d) >= 0)
    if (wantDims.length && labels.length) {
      const on = new Set(wantDims)
      out.push({
        type: 'interval',
        data: labels.map((d) => ({ x: d, y: [0, 1] })),
        __bg: true,
        encode: { x: 'x', y: 'y', ...(bandStep > 0 ? { size: bandStep } : {}) },
        scale: { y: { type: 'linear', domain: [0, 1], independent: true } },
        style: {
          fill: cfg.dimBg,
          fillOpacity: (d) => (on.has(d.x) ? 0.18 : 0),
          pointerEvents: 'none',
        },
        axis: { y: false },
        legend: false,
        tooltip: false,
      })
    }
  }

  /* 说明/名称：按连续维段合并，每段只在中点画一条（对齐 ai-lab） */
  if (cfg.showNote !== false && bands.length) {
    const [, yTop] = yExtent(seriesList)
    const noteRows = bands.map((b) => ({
      x: b.x,
      value: yTop,
      annoText: b.annoText,
    }))
    out.push({
      type: 'point',
      data: noteRows,
      encode: { x: 'x', y: 'value' },
      style: {
        r: 2,
        fill: '#ffffff',
        fillOpacity: 0,
        stroke: '#ffffff',
        strokeOpacity: 0,
        lineWidth: 0,
        pointerEvents: 'none',
      },
      labels: [{
        text: (d) => d.annoText,
        position: 'top',
        dy: -8,
        background: {
          fill: '#ffffff',
          opacity: 0.9,
          padding: [2, 6],
          radius: 2,
        },
        style: {
          fill: '#1f2329',
          fontSize: 11,
          fontWeight: 500,
          lineHeight: 1,
          textAlign: 'center',
          textBaseline: 'bottom',
          pointerEvents: 'none',
        },
      }],
      legend: false,
      tooltip: false,
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
    })
  }
  return out
}

function buildAnnoChildren(annos, seriesList, labels, opts = {}) {
  const out = []
  ;(annos || []).forEach((raw) => {
    const a = normalizeAnno(raw)
    if (a.visible === false) return
    const mode = a.cfg?.mode || (a.dim != null ? 'manual' : 'measure')
    if (mode === 'measure') out.push(...buildMeasureAnnoChildren(a, seriesList, labels))
    else out.push(...buildManualAnnoChildren(a, seriesList, labels, opts))
  })
  return out
}

/**
 * Build G2 overlay children for analysis guides / trends / annos.
 * Falls back to legacy markLine when guides is empty.
 */
export function buildAnalysisOverlays(spec, labels, opts = {}) {
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
  out.push(...buildAnnoChildren(annos, seriesList, labs, opts))
  return out
}
