function ellipsisText(ctx, text, maxW) {
  const s = String(text || '')
  if (!s || maxW <= 0) return ''
  if (ctx.measureText(s).width <= maxW) return s
  let lo = 0
  let hi = s.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const t = `${s.slice(0, mid)}…`
    if (ctx.measureText(t).width <= maxW) lo = mid
    else hi = mid - 1
  }
  return lo > 0 ? `${s.slice(0, lo)}…` : '…'
}

function layoutLegendRows(ctx, series, maxW, opts = {}) {
  const gapX = 18
  const fontSize = opts.legendSize || 12
  const markerPad = opts.lineMarker ? 22 : 14
  ctx.font = `${opts.legendItalic ? 'italic ' : ''}${opts.legendBold ? '700 ' : '400 '}${fontSize}px sans-serif`
  const rows = []
  let row = []
  let rowW = 0
  series.forEach((sr) => {
    const name = String(sr.alias || sr.name || '')
    const w = markerPad + ctx.measureText(name).width
    const next = rowW + (row.length ? gapX : 0) + w
    if (row.length && next > maxW) {
      rows.push({ items: row, w: rowW })
      row = []
      rowW = 0
    }
    row.push({ sr, name, w })
    rowW += (row.length > 1 ? gapX : 0) + w
  })
  if (row.length) rows.push({ items: row, w: rowW })
  return rows
}

function drawLegendItem(ctx, x, y, sr, name, maxNameW, opts = {}) {
  const cy = y + 6
  const color = sr.color || '#2f6bff'
  if (opts.lineMarker) {
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    const dash = sr.dash || opts.dash || 'solid'
    if (dash === 'dash') ctx.setLineDash([4, 3])
    else if (dash === 'dot') ctx.setLineDash([1.5, 2.5])
    else ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(x, cy)
    ctx.lineTo(x + 16, cy)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.arc(x + 8, cy, 3, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.fillStyle = opts.legendColor || '#333'
    ctx.textBaseline = 'middle'
    ctx.fillText(ellipsisText(ctx, name, maxNameW), x + 22, cy)
  } else {
    ctx.fillStyle = color
    ctx.fillRect(x + 1, cy - 4, 8, 8)
    ctx.fillStyle = opts.legendColor || '#333'
    ctx.textBaseline = 'middle'
    ctx.fillText(ellipsisText(ctx, name, maxNameW), x + 14, cy)
  }
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

/**
 * Compose chart canvas with title / legend / remark / footnote into a PNG and download.
 * @param {HTMLCanvasElement} srcCanvas
 * @param {object} meta builder-like state fields
 */
export function exportChartPng(srcCanvas, meta = {}) {
  if (!srcCanvas) throw new Error('暂无可下载的图表内容')

  const dpr = window.devicePixelRatio || 1
  const scale = Math.max(2, Math.min(3, Math.round(dpr) || 2))
  const chartW = srcCanvas.clientWidth || Math.round(srcCanvas.width / dpr) || srcCanvas.width
  const chartH = srcCanvas.clientHeight || Math.round(srcCanvas.height / dpr) || srcCanvas.height
  if (!chartW || !chartH) throw new Error('图表尺寸无效，请稍后重试')

  const padX = 28
  const padTop = 22
  const padBottom = 22
  const titleGap = 10
  const legendGap = 14
  const itemH = 22
  const sideW = 168

  const legendShow = meta.legendShow !== false
  const pos = legendShow ? (meta.legendPos || 'top') : null
  const series = (legendShow && Array.isArray(meta.series) ? meta.series : []).filter(Boolean)
  const titleText = meta.titleShow !== false ? String(meta.title || '') : ''
  const titleSize = meta.titleSize || 16
  const titleColor = meta.titleColor || '#333333'
  const titleBold = !!meta.titleBold
  const titleItalic = !!meta.titleItalic
  const align = meta.legendAlign || 'flex-start'
  const lineMarker = !!(meta.lineMarker ?? /line|area|combo|seasonal/i.test(String(meta.type || '')))

  const measure = document.createElement('canvas').getContext('2d')
  const legendOpts = {
    legendSize: meta.legendSize || 12,
    legendBold: !!meta.legendBold,
    legendItalic: !!meta.legendItalic,
    legendColor: meta.legendColor || '#333',
    lineMarker,
    dash: meta.dash,
  }

  let contentW = chartW
  if (pos === 'left' || pos === 'right') contentW = chartW + legendGap + sideW

  let titleH = 0
  if (titleText) {
    measure.font = `${titleItalic ? 'italic ' : ''}${titleBold ? '700 ' : '400 '}${titleSize}px sans-serif`
    titleH = titleSize + 8
  }

  let legendH = 0
  let legendRows = []
  let sideLegendH = 0
  if (series.length) {
    if (pos === 'left' || pos === 'right') {
      sideLegendH = series.length * itemH + Math.max(0, series.length - 1) * 6
    } else {
      legendRows = layoutLegendRows(measure, series, contentW, legendOpts)
      legendH = legendRows.length * itemH + Math.max(0, legendRows.length - 1) * 6
    }
  }

  const remarkText = meta.remarkOn && meta.remark ? String(meta.remark).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() : ''
  const remarkH = remarkText ? 18 : 0
  const footnoteText = meta.footnoteOn && meta.footnote ? String(meta.footnote).replace(/<[^>]+>/g, '') : ''
  const footnoteH = footnoteText ? 18 : 0

  let bodyH = chartH
  if ((pos === 'left' || pos === 'right') && sideLegendH > bodyH) bodyH = sideLegendH

  let totalW = padX * 2 + contentW
  let totalH = padTop + padBottom + titleH + (titleH ? titleGap : 0) + bodyH
  if (legendH) totalH += legendH + legendGap
  if (remarkH) totalH += remarkH + 6
  if (footnoteH) totalH += footnoteH + 8
  // remark afterTitle consumes space before body; chartTop also before chart
  // Already counted remarkH once — if both positions somehow set, still one block.

  const out = document.createElement('canvas')
  out.width = Math.round(totalW * scale)
  out.height = Math.round(totalH * scale)
  const ctx = out.getContext('2d')
  ctx.scale(scale, scale)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, totalW, totalH)

  let y = padTop
  if (titleText) {
    ctx.font = `${titleItalic ? 'italic ' : ''}${titleBold ? '700 ' : '400 '}${titleSize}px sans-serif`
    ctx.fillStyle = titleColor
    ctx.textBaseline = 'top'
    const titleAlign = meta.titleAlign || 'center'
    let tx = padX
    if (titleAlign === 'center') {
      ctx.textAlign = 'center'
      tx = padX + contentW / 2
    } else if (titleAlign === 'right') {
      ctx.textAlign = 'right'
      tx = padX + contentW
    } else {
      ctx.textAlign = 'left'
    }
    ctx.fillText(ellipsisText(ctx, titleText, contentW), tx, y)
    ctx.textAlign = 'left'
    y += titleH + titleGap
  }

  if (remarkText && meta.remarkPos !== 'chartTop') {
    ctx.font = '12px sans-serif'
    ctx.fillStyle = '#9aa0ad'
    ctx.textBaseline = 'top'
    ctx.fillText(ellipsisText(ctx, remarkText, contentW), padX, y)
    y += remarkH + 6
  }

  function drawTopBottomLegend(atY) {
    if (!legendRows.length) return
    ctx.font = `${legendOpts.legendItalic ? 'italic ' : ''}${legendOpts.legendBold ? '700 ' : '400 '}${legendOpts.legendSize}px sans-serif`
    let yy = atY
    legendRows.forEach((row) => {
      let x0 = padX
      if (align === 'center') x0 = padX + (contentW - row.w) / 2
      else if (align === 'flex-end') x0 = padX + contentW - row.w
      let xx = x0
      row.items.forEach((it, idx) => {
        if (idx) xx += 18
        const namePad = lineMarker ? 22 : 14
        drawLegendItem(ctx, xx, yy, it.sr, it.name, it.w - namePad, legendOpts)
        xx += it.w
      })
      yy += itemH + 6
    })
  }

  if (pos === 'top' && legendH) {
    drawTopBottomLegend(y)
    y += legendH + legendGap
  }

  if (remarkText && meta.remarkPos === 'chartTop') {
    ctx.font = '12px sans-serif'
    ctx.fillStyle = '#9aa0ad'
    ctx.textBaseline = 'top'
    ctx.fillText(ellipsisText(ctx, remarkText, contentW), padX, y)
    y += remarkH + 6
  }

  let chartX = padX
  let legendX = padX
  if (pos === 'left') {
    legendX = padX
    chartX = padX + sideW + legendGap
  } else if (pos === 'right') {
    chartX = padX
    legendX = padX + chartW + legendGap
  }

  if ((pos === 'left' || pos === 'right') && series.length) {
    ctx.font = `${legendOpts.legendItalic ? 'italic ' : ''}${legendOpts.legendBold ? '700 ' : '400 '}${legendOpts.legendSize}px sans-serif`
    let ly = y
    if (align === 'center') ly = y + Math.max(0, (bodyH - sideLegendH) / 2)
    else if (align === 'flex-end') ly = y + Math.max(0, bodyH - sideLegendH)
    series.forEach((sr, i) => {
      drawLegendItem(ctx, legendX, ly + i * (itemH + 6), sr, String(sr.alias || sr.name || ''), sideW - 18, legendOpts)
    })
  }

  ctx.drawImage(srcCanvas, chartX, y, chartW, chartH)
  y += bodyH

  if (pos === 'bottom' && legendH) {
    y += legendGap
    drawTopBottomLegend(y)
    y += legendH
  }

  if (footnoteText) {
    y += 8
    ctx.font = '12px sans-serif'
    ctx.fillStyle = '#9aa0ad'
    ctx.textBaseline = 'top'
    ctx.fillText(ellipsisText(ctx, footnoteText, contentW), padX, y)
  }

  return new Promise((resolve, reject) => {
    out.toBlob((blob) => {
      if (!blob) {
        reject(new Error('导出失败'))
        return
      }
      downloadBlob(blob, `${meta.title || 'chart'}.png`)
      resolve(blob)
    }, 'image/png')
  })
}
