import { usesViewCtrl } from './types'

export function viewCtrlVisibleRatio(labels, minWidth, hostWidth) {
  const n = (labels && labels.length) || 1
  const w = hostWidth || 640
  const minW = Math.max(8, Math.min(200, Number(minWidth) || 32))
  const visible = Math.max(1, Math.floor(Math.max(80, w - 80) / minW))
  return Math.max(0.05, Math.min(1, visible / n))
}

export function viewCtrlBottomReserve(spec) {
  if (!spec?.viewCtrlShow || spec.mini || !usesViewCtrl(spec.type)) return 0
  return spec.viewCtrlType === 'slider' ? 52 : 28
}

function viewCtrlSliderHandleShape(chart) {
  return function handleShape() {
    try {
      const ctx = chart?.getContext?.()
      const doc = ctx?.canvas?.document
      if (!doc?.createElement) return null
      const g = doc.createElement('g')
      const circle = doc.createElement('circle')
      circle.style.r = 8
      circle.style.fill = '#FFFFFF'
      circle.style.stroke = '#C9CDD4'
      circle.style.lineWidth = 1
      circle.style.shadowColor = 'rgba(0,0,0,0.08)'
      circle.style.shadowBlur = 2
      circle.style.shadowOffsetY = 1
      g.appendChild(circle)
      const addGrip = (x) => {
        const line = doc.createElement('line')
        line.style.x1 = x
        line.style.x2 = x
        line.style.y1 = -3.5
        line.style.y2 = 3.5
        line.style.stroke = '#86909C'
        line.style.lineWidth = 1.2
        line.style.lineCap = 'round'
        g.appendChild(line)
      }
      addGrip(-2)
      addGrip(2)
      return g
    } catch {
      return null
    }
  }
}

function viewCtrlSparklineData(series = [], labels = []) {
  const n = labels.length || series[0]?.values?.length || 0
  if (n < 2) return null
  const pack = series.map((s) => {
    const arr = []
    for (let i = 0; i < n; i++) {
      const v = s.values?.[i]
      arr.push(v == null || !Number.isFinite(+v) ? 0 : +v)
    }
    return arr
  })
  if (!pack.length) return null
  return pack.length === 1 ? pack[0] : pack
}

export function viewCtrlFormatDateLabel(d, labels) {
  if (d == null || d === '') return ''
  if (typeof d === 'number' && Number.isFinite(d) && labels?.length) {
    let i = Math.round(d)
    if (i < 0) i = 0
    if (i > labels.length - 1) i = labels.length - 1
    if (labels[i] != null) return String(labels[i]).replace(/-/g, '')
  }
  return String(d).replace(/-/g, '')
}

function viewCtrlSliderStyle(chart, series, labels) {
  const spark = viewCtrlSparklineData(series, labels)
  const style = {
    trackSize: 16,
    trackFill: '#E5E6EB',
    trackFillOpacity: 1,
    trackOpacity: 1,
    selectionFill: '#8EC5FF',
    selectionFillOpacity: 0.45,
    selectionStroke: 'transparent',
    showHandle: true,
    showLabel: false,
    showLabelOnInteraction: false,
    autoFitLabel: true,
    handleIconSize: 16,
    handleIconFill: '#FFFFFF',
    handleIconFillOpacity: 1,
    handleIconStroke: '#C9CDD4',
    handleIconStrokeOpacity: 1,
    handleIconLineWidth: 1,
    handleSpacing: 4,
    sparklineType: 'line',
    sparklineSmooth: true,
    sparklineColor: '#3DDBC2',
    sparklineLineStroke: '#3DDBC2',
    sparklineLineStrokeOpacity: 1,
    sparklineAreaFill: '#3DDBC2',
    sparklineAreaFillOpacity: 0.12,
  }
  if (spark) style.sparklineData = spark
  const shape = viewCtrlSliderHandleShape(chart)
  if (shape) style.handleIconShape = shape
  else style.handleIconRadius = 14
  return style
}

export function applyViewControls(view, chart, spec, labels, hostEl) {
  if (!spec?.viewCtrlShow || spec.mini || !usesViewCtrl(spec.type)) {
    view.slider = false
    view.scrollbar = false
    stampViewCtrlOnMarks(view)
    return view
  }
  const ratio = viewCtrlVisibleRatio(labels, spec.viewCtrlMinWidth, hostEl?.clientWidth)
  const extra = viewCtrlBottomReserve(spec)
  const floor = spec.viewCtrlType === 'slider' ? 72 : 48
  view.paddingBottom = Math.max(Number(view.paddingBottom) || 0, extra, floor)
  const labFmt = (d) => viewCtrlFormatDateLabel(d, labels)
  if (spec.viewCtrlType === 'slider') {
    view.slider = {
      x: {
        values: [0, Math.min(1, Math.max(0.15, ratio))],
        labelFormatter: labFmt,
        ...viewCtrlSliderStyle(chart, spec.series, labels),
      },
    }
    view.scrollbar = false
    view.interaction = { ...(view.interaction || {}), sliderFilter: true, scrollbarFilter: false }
  } else {
    // G2 view 不会把 scrollbar 继承到子 mark，滚动条改由图表容器展示
    view.slider = false
    view.scrollbar = false
    view.paddingBottom = Math.max(Number(view.paddingBottom) || 0, 16)
    view.interaction = { ...(view.interaction || {}), scrollbarFilter: false, sliderFilter: false }
  }
  stampViewCtrlOnMarks(view)
  return view
}

function stampViewCtrlOnMarks(view) {
  const marks = view?.children
  if (!Array.isArray(marks)) return
  marks.forEach((mark) => {
    if (!mark || typeof mark !== 'object') return
    mark.slider = view.slider
    mark.scrollbar = view.scrollbar
  })
}

export function syncViewControlsToChart(chart, view) {
  if (!chart?.options || !view) return
  try {
    chart.options({
      slider: view.slider ?? false,
      scrollbar: view.scrollbar ?? false,
      interaction: view.interaction || {},
    })
  } catch { /* ignore */ }
}

function measureText(text) {
  if (!text) return 0
  try {
    if (!measureText._ctx) {
      const c = document.createElement('canvas')
      measureText._ctx = c.getContext('2d')
    }
    const ctx = measureText._ctx
    ctx.font = '11px "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif'
    return Math.ceil(ctx.measureText(text).width)
  } catch {
    return Math.ceil(String(text).length * 6.6)
  }
}

function findSliderNodes(chart) {
  try {
    const ctx = chart?.getContext?.()
    const doc = ctx?.canvas?.document
    const root = doc?.documentElement || doc
    if (!root) return null
    const out = { slider: null, track: null, start: null, end: null }
    const walk = (n, d) => {
      if (!n || d > 14) return
      const cn = String(n.className || '')
      if (cn === 'slider' || /(^|\s)slider$/.test(cn)) out.slider = n
      if (cn.includes('slider-track')) out.track = n
      if (cn.includes('start-handle')) out.start = n
      if (cn.includes('end-handle')) out.end = n
      const kids = n.childNodes || []
      for (let i = 0; i < kids.length; i++) walk(kids[i], d + 1)
    }
    walk(root, 0)
    return out
  } catch {
    return null
  }
}

function nodeBounds(n) {
  if (!n) return null
  try {
    const b = n.getBounds?.()
    if (b?.min && b?.max) {
      return {
        x: b.min[0],
        y: b.min[1],
        w: b.max[0] - b.min[0],
        h: b.max[1] - b.min[1],
        cx: (b.min[0] + b.max[0]) / 2,
        cy: (b.min[1] + b.max[1]) / 2,
      }
    }
  } catch { /* ignore */ }
  return null
}

function ellipsize(text, maxW) {
  text = String(text || '')
  if (!text) return ''
  maxW = +maxW || 0
  if (maxW < 8) return ''
  if (measureText(text) <= maxW) return text
  const ell = '...'
  const ew = measureText(ell)
  const minPrefix = Math.min(4, text.length)
  if (maxW < ew + measureText(text.slice(0, minPrefix))) return ''
  for (let n = text.length - 1; n >= minPrefix; n--) {
    const t = text.slice(0, n) + ell
    if (measureText(t) <= maxW) return t
  }
  return ''
}

function layoutDateLabels(track, startCx, endCx, textStart, textEnd) {
  const gap = 6
  const handleR = 8
  const pad = 6
  const minShow = Math.max(28, measureText('2002...'))
  const left = track.x
  const right = track.x + track.w
  const y = track.y + track.h / 2
  let Lh = startCx
  let Rh = endCx
  if (!(Rh > Lh)) Rh = Lh + 1
  const mid = (Lh + Rh) / 2
  const span = Rh - Lh
  const t0 = String(textStart || '')
  const t1 = String(textEnd || '')

  const placeLeftOf = (cx, text, maxLeft) => {
    const slot = cx - handleR - pad - maxLeft
    const tt = ellipsize(text, slot)
    if (!tt) return null
    const w = measureText(tt)
    return { text: tt, x: cx - handleR - pad - w, w }
  }
  const placeRightOf = (cx, text, maxRight) => {
    const slot = maxRight - (cx + handleR + pad)
    const tt = ellipsize(text, slot)
    if (!tt) return null
    return { text: tt, x: cx + handleR + pad, w: measureText(tt) }
  }

  const samePoint = (t0 && t0 === t1) || span < handleR * 2.8
  if (samePoint) {
    const merged = (t0 === t1 ? t0 : (t1 || t0)) || t0 || t1
    const anchor = span < handleR * 4 ? mid : Rh
    let one = placeLeftOf(anchor, merged, left)
    if (!one) one = placeRightOf(anchor, merged, right)
    if (!one) {
      return { startX: left, endX: left, y, mode: 'merge-hide', startText: '', endText: '', hideStart: true, hideEnd: true }
    }
    return { startX: one.x, endX: one.x, y, mode: 'merge', startText: '', endText: one.text, hideStart: true, hideEnd: false }
  }

  let hideStart = false
  let hideEnd = false
  let sText = t0
  let eText = t1
  let sX = left
  let eX = left
  let mode = 'adapt'

  const startOuter = placeLeftOf(Lh, t0, left)
  if (startOuter) {
    sText = startOuter.text
    sX = startOuter.x
  } else {
    const innerLeft = Lh + handleR + pad
    const innerRight = Rh - handleR - pad
    const innerSlot = Math.max(0, innerRight - innerLeft)
    if (innerSlot >= minShow) {
      sText = ellipsize(t0, innerSlot)
      if (sText) { sX = innerLeft; mode = 'start-in' }
      else hideStart = true
    } else hideStart = true
  }

  let endCapLeft = hideStart ? (Lh + handleR + pad) : (sX + measureText(sText) + gap)
  endCapLeft = Math.max(endCapLeft, Lh + handleR + pad)
  const endInnerRight = Rh - handleR - pad
  const endInnerSlot = Math.max(0, endInnerRight - endCapLeft)
  if (endInnerSlot >= minShow) {
    eText = ellipsize(t1, endInnerSlot)
    if (eText) {
      eX = endInnerRight - measureText(eText)
      if (!hideStart && eX < sX + measureText(sText) + gap) {
        const allow = Math.max(0, endInnerRight - (sX + measureText(sText) + gap))
        eText = ellipsize(t1, allow)
        if (eText) eX = endInnerRight - measureText(eText)
        else hideEnd = true
      }
    } else hideEnd = true
  } else {
    const endOuter = placeRightOf(Rh, t1, right)
    if (endOuter) {
      eText = endOuter.text
      eX = endOuter.x
      mode = mode === 'start-in' ? 'start-in-end-out' : 'end-out'
    } else {
      const endLeftOnly = placeLeftOf(Rh, t1, hideStart ? left : (sX + measureText(sText) + gap))
      if (endLeftOnly) {
        eText = endLeftOnly.text
        eX = endLeftOnly.x
        mode = 'end-left'
      } else hideEnd = true
    }
  }

  if (!hideStart && !hideEnd) {
    const sW = measureText(sText)
    if (sX + sW + gap > eX) {
      const fit = Math.max(0, eX - gap - sX)
      const ns = ellipsize(t0, fit)
      if (ns) sText = ns
      else hideStart = true
    }
  }

  if (hideStart && hideEnd) {
    const fallback = placeLeftOf(Rh, t1 || t0, left) || placeRightOf(Lh, t0 || t1, right)
    if (fallback) {
      hideEnd = false
      eText = fallback.text
      eX = fallback.x
      mode = 'single'
    }
  }

  return {
    startX: sX, endX: eX, y, mode,
    startText: hideStart ? '' : sText,
    endText: hideEnd ? '' : eText,
    hideStart, hideEnd,
  }
}

export function hideViewCtrlDateLabels(els) {
  if (els?.layer) els.layer.hidden = true
}

export function bindViewCtrlDateLabels(chart, labels, els) {
  const { host, layer, start, end } = els || {}
  if (!layer || !start || !end) return () => {}

  const hide = () => { layer.hidden = true }
  if (!chart || !labels?.length) {
    hide()
    return () => {}
  }

  let raf = 0
  const sync = () => {
    const nodes = findSliderNodes(chart)
    const track = nodeBounds(nodes?.track) || nodeBounds(nodes?.slider)
    if (!track || track.w < 8) {
      hide()
      return
    }
    let vals = [0, 1]
    try {
      const sliderNode = nodes?.slider
      if (sliderNode && typeof sliderNode.getValues === 'function') {
        const gv = sliderNode.getValues()
        if (gv && gv.length >= 2) vals = [+gv[0], +gv[1]]
      } else {
        const sx = chart.options?.()?.slider?.x
        if (sx?.values?.length >= 2) vals = [+sx.values[0], +sx.values[1]]
      }
    } catch { /* keep default */ }
    if (!(Number.isFinite(vals[0]) && Number.isFinite(vals[1]))) vals = [0, 1]
    if (vals[1] < vals[0]) { const t = vals[0]; vals[0] = vals[1]; vals[1] = t }
    let startCx = track.x + Math.max(0, Math.min(1, vals[0])) * track.w
    let endCx = track.x + Math.max(0, Math.min(1, vals[1])) * track.w
    const sb = nodeBounds(nodes?.start)
    const eb = nodeBounds(nodes?.end)
    if (sb && sb.w < 28) startCx = sb.cx
    if (eb && eb.w < 28) endCx = eb.cx
    const nLab = labels.length || 1
    const i0 = Math.round(vals[0] * Math.max(0, nLab - 1))
    const i1 = Math.round(vals[1] * Math.max(0, nLab - 1))
    const layout = layoutDateLabels(track, startCx, endCx, viewCtrlFormatDateLabel(i0, labels), viewCtrlFormatDateLabel(i1, labels))
    start.textContent = layout.startText || ''
    end.textContent = layout.endText || ''
    start.style.left = `${Math.round(layout.startX)}px`
    start.style.top = `${Math.round(layout.y)}px`
    end.style.left = `${Math.round(layout.endX)}px`
    end.style.top = `${Math.round(layout.y)}px`
    start.style.visibility = layout.hideStart ? 'hidden' : 'visible'
    end.style.visibility = layout.hideEnd ? 'hidden' : 'visible'
    layer.hidden = false
  }

  const schedule = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => { raf = 0; sync() })
  }
  schedule()
  const t = setTimeout(schedule, 40)

  const nodes = findSliderNodes(chart)
  const slider = nodes?.slider
  const onVal = () => schedule()
  if (slider?.addEventListener) {
    try { slider.addEventListener('valuechange', onVal) } catch { /* ignore */ }
  }
  if (host) {
    host.addEventListener('pointerdown', onVal)
    host.addEventListener('pointermove', onVal)
    host.addEventListener('pointerup', onVal)
  }
  try { chart.on?.('afterrender', schedule) } catch { /* ignore */ }
  try { chart.on?.('sliderX:filter', schedule) } catch { /* ignore */ }

  return () => {
    clearTimeout(t)
    if (raf) cancelAnimationFrame(raf)
    hide()
    if (slider?.removeEventListener) {
      try { slider.removeEventListener('valuechange', onVal) } catch { /* ignore */ }
    }
    if (host) {
      host.removeEventListener('pointerdown', onVal)
      host.removeEventListener('pointermove', onVal)
      host.removeEventListener('pointerup', onVal)
    }
    try { chart.off?.('afterrender', schedule) } catch { /* ignore */ }
    try { chart.off?.('sliderX:filter', schedule) } catch { /* ignore */ }
  }
}
