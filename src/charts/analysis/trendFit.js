function lsLinear(xs, ys) {
  const n = xs.length
  if (n < 2) return null
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < n; i++) {
    sx += xs[i]
    sy += ys[i]
    sxx += xs[i] * xs[i]
    sxy += xs[i] * ys[i]
  }
  const den = n * sxx - sx * sx
  if (!den) return null
  const b = (n * sxy - sx * sy) / den
  const a = (sy - b * sx) / n
  return { a, b }
}

function lsQuad(xs, ys) {
  const n = xs.length
  if (n < 3) return null
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxxx = 0
  let sxxxx = 0
  let sxy = 0
  let sxxy = 0
  for (let i = 0; i < n; i++) {
    const x = xs[i]
    const y = ys[i]
    sx += x
    sy += y
    sxx += x * x
    sxxx += x * x * x
    sxxxx += x * x * x * x
    sxy += x * y
    sxxy += x * x * y
  }
  const rows = [
    [n, sx, sxx, sy],
    [sx, sxx, sxxx, sxy],
    [sxx, sxxx, sxxxx, sxxy],
  ]
  for (let i = 0; i < 3; i++) {
    let max = i
    for (let k = i + 1; k < 3; k++) {
      if (Math.abs(rows[k][i]) > Math.abs(rows[max][i])) max = k
    }
    const tmp = rows[i]
    rows[i] = rows[max]
    rows[max] = tmp
    if (Math.abs(rows[i][i]) < 1e-12) return null
    for (let k = i + 1; k < 3; k++) {
      const f = rows[k][i] / rows[i][i]
      for (let j = i; j < 4; j++) rows[k][j] -= f * rows[i][j]
    }
  }
  const x3 = [0, 0, 0]
  for (let i = 2; i >= 0; i--) {
    x3[i] = rows[i][3]
    for (let j = i + 1; j < 3; j++) x3[i] -= rows[i][j] * x3[j]
    x3[i] /= rows[i][i]
  }
  return { a: x3[0], b: x3[1], c: x3[2] }
}

function trendFn(type, pts) {
  const xs = []
  const ys = []
  const pushXY = (x, y) => { xs.push(x); ys.push(y) }
  if (type === 'log') {
    pts.forEach((p) => pushXY(Math.log(p.x + 1), p.y))
    const fit = lsLinear(xs, ys)
    if (!fit) return null
    return (x) => fit.a + fit.b * Math.log(x + 1)
  }
  if (type === 'exp') {
    pts.forEach((p) => { if (p.y > 0) pushXY(p.x, Math.log(p.y)) })
    const fit = lsLinear(xs, ys)
    if (!fit) return null
    return (x) => Math.exp(fit.a + fit.b * x)
  }
  if (type === 'power') {
    pts.forEach((p) => { if (p.y > 0) pushXY(Math.log(p.x + 1), Math.log(p.y)) })
    const fit = lsLinear(xs, ys)
    if (!fit) return null
    return (x) => Math.exp(fit.a + fit.b * Math.log(x + 1))
  }
  if (type === 'poly') {
    pts.forEach((p) => pushXY(p.x, p.y))
    const fit = lsQuad(xs, ys)
    if (!fit) return null
    return (x) => fit.a + fit.b * x + fit.c * x * x
  }
  pts.forEach((p) => pushXY(p.x, p.y))
  const fit = lsLinear(xs, ys)
  if (!fit) return null
  return (x) => fit.a + fit.b * x
}

function pickAutoTrend(pts) {
  const kinds = ['linear', 'log', 'exp', 'poly', 'power']
  let best = null
  let bestErr = Infinity
  for (let k = 0; k < kinds.length; k++) {
    const fn = trendFn(kinds[k], pts)
    if (!fn) continue
    let err = 0
    let n = 0
    for (let i = 0; i < pts.length; i++) {
      const v = fn(pts[i].x)
      if (v == null || !Number.isFinite(v)) continue
      err += (v - pts[i].y) * (v - pts[i].y)
      n++
    }
    if (n && err / n < bestErr) {
      bestErr = err / n
      best = fn
    }
  }
  return best || trendFn('linear', pts)
}

function advanceLabel(label, step) {
  const s = String(label || '')
  const m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/)
  if (!m) return `${s}+${step}`
  let y = +m[1]
  let mo = +m[2]
  mo += step
  while (mo > 12) { mo -= 12; y += 1 }
  while (mo < 1) { mo += 12; y -= 1 }
  const day = m[3] ? `-${m[3]}` : ''
  return `${y}-${String(mo).padStart(2, '0')}${day}`
}

/**
 * @param {{ values?: any[], name?: string, color?: string, axis?: string, alias?: string }} seriesItem
 * @param {string[]} labels
 * @param {{ type?: string, forecast?: number, name?: string, color?: string }} spec
 */
export function fitTrendRows(seriesItem, labels, spec = {}) {
  if (!seriesItem) return []
  const data = seriesItem.values || []
  const pts = []
  for (let i = 0; i < data.length; i++) {
    const y = data[i]
    if (y == null || !Number.isFinite(+y)) continue
    pts.push({ x: i, y: +y })
  }
  if (pts.length < 2) return []
  const type = spec.type || 'auto'
  let fn = type === 'auto' ? pickAutoTrend(pts) : trendFn(type, pts)
  if (!fn) fn = trendFn('linear', pts)
  if (!fn) return []
  const last = Math.max(0, data.length - 1)
  const end = last + Math.max(0, Math.round(+spec.forecast || 0))
  const name = spec.name || `${seriesItem.alias || seriesItem.name || ''} 趋势`
  const color = spec.color || '#f2994a'
  const axis = seriesItem.axis || 'left'
  const rows = []
  for (let i = 0; i <= end; i++) {
    const y = fn(i)
    if (y == null || !Number.isFinite(y)) continue
    let xLabel
    if (i < labels.length) xLabel = labels[i]
    else xLabel = advanceLabel(labels[labels.length - 1] || String(i), i - (labels.length - 1))
    rows.push({
      x: xLabel,
      idx: i,
      value: y,
      name,
      color,
      axis,
    })
  }
  return rows
}
