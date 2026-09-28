/** 条件格式图标集预览（对齐飞书） */
export const CF_ICON_RED = '#f76964'
export const CF_ICON_YELLOW = '#fad355'
export const CF_ICON_GREEN = '#62d256'
export const CF_ICON_GRAY = '#8f959e'
export const CF_ICON_DARK = '#373c43'
export const CF_ICON_STAR = '#ffc60a'

const PATHS = {
  arrowDown: 'M12 20.2c.3 0 .55-.12.75-.35l5.1-5.35a.9.9 0 0 0-.02-1.25.86.86 0 0 0-1.23.02l-3.6 3.78V4.9c0-.5-.4-.9-.9-.9s-.9.4-.9.9v12.55l-3.6-3.78a.86.86 0 0 0-1.23-.02.9.9 0 0 0-.02 1.25l5.1 5.35c.2.23.45.35.75.35Z',
  arrowUp: 'M12 3.8c-.3 0-.55.12-.75.35L6.15 9.5a.9.9 0 0 0 .02 1.25c.34.35.9.36 1.23-.02l3.6-3.78V19.1c0 .5.4.9.9.9s.9-.4.9-.9V6.95l3.6 3.78c.33.38.89.37 1.23.02a.9.9 0 0 0 .02-1.25l-5.1-5.35A.95.95 0 0 0 12 3.8Z',
  arrowRight: 'M20.2 12c0-.3-.12-.55-.35-.75l-5.35-5.1a.9.9 0 0 0-1.25.02.86.86 0 0 0 .02 1.23l3.78 3.6H4.9c-.5 0-.9.4-.9.9s.4.9.9.9h12.55l-3.78 3.6a.86.86 0 0 0-.02 1.23.9.9 0 0 0 1.25.02l5.35-5.1c.23-.2.35-.45.35-.75Z',
  arrowUpRight: 'M18.7 5.3c-.18-.18-.42-.28-.7-.28h-6.2a.9.9 0 1 0 0 1.8h4.02L6.45 16.2a.9.9 0 1 0 1.27 1.27L16.9 8.28v4.02a.9.9 0 1 0 1.8 0V6c0-.28-.1-.52-.28-.7Z',
  arrowDownRight: 'M18.7 18.7c-.18.18-.42.28-.7.28h-6.2a.9.9 0 1 1 0-1.8h4.02L6.45 7.8A.9.9 0 1 1 7.72 6.53L16.9 15.72V11.7a.9.9 0 1 1 1.8 0V18c0 .28-.1.52-.28.7Z',
  triUp: 'M12 5.2 19.2 17.6H4.8L12 5.2Z',
  triDown: 'M12 18.8 4.8 6.4h14.4L12 18.8Z',
  bar: 'M5.5 11h13v2H5.5z',
  circle: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17Z',
  circleRim: 'M12 19.8a7.8 7.8 0 1 0 0-15.6 7.8 7.8 0 0 0 0 15.6Zm0 .9a8.7 8.7 0 1 1 0-17.4 8.7 8.7 0 0 1 0 17.4Z',
  diamond: 'M12 3.8 20.2 12 12 20.2 3.8 12 12 3.8Z',
  check: 'M9.7 16.55a.9.9 0 0 1-.64-.27l-3.2-3.25a.9.9 0 1 1 1.28-1.26l2.55 2.6 6.5-6.7a.9.9 0 1 1 1.3 1.25l-7.14 7.36a.9.9 0 0 1-.65.27Z',
  cross: 'M7.05 7.05a.9.9 0 0 1 1.27 0L12 10.73l3.68-3.68a.9.9 0 1 1 1.27 1.27L13.27 12l3.68 3.68a.9.9 0 1 1-1.27 1.27L12 13.27l-3.68 3.68a.9.9 0 1 1-1.27-1.27L10.73 12 7.05 8.32a.9.9 0 0 1 0-1.27Z',
  bang: 'M12 6.2c.5 0 .9.4.9.9v5.6a.9.9 0 1 1-1.8 0V7.1c0-.5.4-.9.9-.9Zm0 11.5a1.15 1.15 0 1 0 0-2.3 1.15 1.15 0 0 0 0 2.3Z',
  flag: 'M6.4 4.5h.2c.4 0 .7.2.9.5l.3.5c.5.8 1.4 1.3 2.4 1.3h6.3c.7 0 1.1.8.7 1.4l-1.8 2.6c-.3.4-.3 1 0 1.4l1.8 2.6c.4.6 0 1.4-.7 1.4H9.9c-.8 0-1.5.3-2 .9l-.4.4c-.2.2-.5.3-.8.3H6.4V4.5Z',
  star: 'M12 3.6l2.1 5.2 5.6.5-4.3 3.7 1.3 5.4L12 15.8 7.3 18.4l1.3-5.4-4.3-3.7 5.6-.5L12 3.6Z',
  starEmpty: 'M12 5.1l1.45 3.6.4.1 3.9.35-2.95 2.55.9 3.75L12 13.7l-3.7 1.75.9-3.75-2.95-2.55 3.9-.35.4-.1L12 5.1Zm0-1.5L9.9 8.8 4.3 9.3l4.3 3.7-1.3 5.4L12 15.8l4.7 2.6-1.3-5.4 4.3-3.7-5.6-.5L12 3.6Z',
}

export function cfIconSvg(kind, color) {
  const d = PATHS[kind]
  if (!d) return ''
  const fill = color || 'currentColor'
  if (kind === 'circleRim') {
    return `<svg viewBox="0 0 24 24" width="20" height="20"><path d="${d}" fill="${fill}"/></svg>`
  }
  if (kind === 'starEmpty') {
    return `<svg viewBox="0 0 24 24" width="20" height="20"><path d="${PATHS.star}" fill="none" stroke="${fill}" stroke-width="1.4"/></svg>`
  }
  return `<svg viewBox="0 0 24 24" width="20" height="20"><path d="${d}" fill="${fill}"/></svg>`
}

export function cfSignalSvg(level, total = 4) {
  const gap = 2
  const w = (20 - gap * (total - 1)) / total
  let bars = ''
  for (let i = 0; i < total; i += 1) {
    const h = 6 + i * ((14) / (total - 1 || 1))
    const x = i * (w + gap)
    const y = 20 - h - 2
    const on = i < level
    bars += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="${on ? '#3370ff' : '#c8cdd3'}"/>`
  }
  return `<svg viewBox="0 0 20 20" width="20" height="20">${bars}</svg>`
}

export function cfPieSvg(filled) {
  // filled: 4=full, 3=3/4, 2=half, 1=1/4, 0=empty
  const colors = ['#646a73', '#646a73']
  if (filled <= 0) {
    return `<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="8" fill="none" stroke="#646a73" stroke-width="1.5"/></svg>`
  }
  if (filled >= 4) {
    return `<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="8" fill="#646a73"/></svg>`
  }
  const angle = filled * 90
  const rad = (angle - 90) * Math.PI / 180
  const x = 12 + 8 * Math.cos(rad)
  const y = 12 + 8 * Math.sin(rad)
  const large = angle > 180 ? 1 : 0
  return `<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="8" fill="none" stroke="#646a73" stroke-width="1.5"/><path d="M12 12 L12 4 A8 8 0 ${large} 1 ${x} ${y} Z" fill="#646a73"/></svg>`
}

export function cfBoxesSvg(filled) {
  // 2x2 grid, filled 0-4
  const cells = [
    [2, 2], [11, 2],
    [2, 11], [11, 11],
  ]
  let rects = ''
  cells.forEach(([x, y], i) => {
    const on = i < filled
    rects += `<rect x="${x}" y="${y}" width="7" height="7" rx="1" fill="${on ? '#3370ff' : 'none'}" stroke="#8f959e" stroke-width="1.2"/>`
  })
  return `<svg viewBox="0 0 20 20" width="20" height="20">${rects}</svg>`
}

/** 应用顺序：高→低（与 marks/format 一致）。预览顺序是低→高。 */
export function cfIconGlyphs(item) {
  const preview = item?.preview
  if (preview === 'signal3') {
    return [3, 2, 1].map((level) => ({ special: 'signal', level, total: 3 }))
  }
  if (preview === 'pie3') {
    return [4, 2, 0].map((filled) => ({ special: 'pie', filled }))
  }
  if (preview === 'pie5') {
    return [4, 3, 2, 1, 0].map((filled) => ({ special: 'pie', filled }))
  }
  if (Array.isArray(preview) && preview.length) {
    return [...preview].reverse()
  }
  const marks = item?.marks || []
  const colors = item?.format || []
  return marks.map((mark, i) => ({ mark, color: colors[i] || colors[0] || '#1f2329' }))
}

export function cfIconGlyphHtml(glyph, size = 16) {
  if (!glyph) return ''
  if (glyph.special === 'signal') {
    return cfSignalSvg(glyph.level, glyph.total).replace(/width="20"/g, `width="${size}"`).replace(/height="20"/g, `height="${size}"`)
  }
  if (glyph.special === 'pie') {
    return cfPieSvg(glyph.filled).replace(/width="20"/g, `width="${size}"`).replace(/height="20"/g, `height="${size}"`)
  }
  if (glyph.kind) {
    return cfIconSvg(glyph.kind, glyph.color)
      .replace(/width="20"/g, `width="${size}"`)
      .replace(/height="20"/g, `height="${size}"`)
  }
  const color = glyph.color || '#1f2329'
  return `<span style="color:${color};font-size:${size}px;line-height:1;font-weight:700">${glyph.mark || ''}</span>`
}
