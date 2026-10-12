import { createApp, h, nextTick } from 'vue'
import JSZip from 'jszip'
import PptSlide from '../views/ppt/PptSlide.vue'
import { COVER_DESIGN_H, COVER_DESIGN_W, slidePageLabel, typeName } from '../views/ppt/ppt-model'

const SLIDE_CX = 12192000
const SLIDE_CY = 6858000
const EXPORT_SCALE = 2

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

function textOfBlock(b) {
  if (!b) return ''
  if (b.type === 'text') return htmlToText(b.text)
  if (b.type === 'chart') {
    const note = htmlToText(b.builderState?.footnote)
    return [`【图表】${b.title || '未命名图表'}`, note].filter(Boolean).join('\n')
  }
  if (b.type === 'table') return `【表格】${b.title || '未命名表格'}`
  if (b.type === 'sandbox') {
    const cells = (b.cells || []).map((c) => `${c.name} ${c.chg > 0 ? '+' : ''}${Math.round((c.chg || 0) * 100)}%`).join('  ')
    return `【沙盘】${b.title || ''}\n${cells}`
  }
  return ''
}

function slideBody(slide) {
  if (slide.kind === 'cover') {
    const c = slide.cover || {}
    const overlay = (c.texts || []).map((t) => htmlToText(t.html)).filter(Boolean).join('\n')
    return [c.subtitle, c.org, c.date, c.author, c.extra, overlay].filter(Boolean).join('\n')
  }
  return (slide.blocks || []).map(textOfBlock).filter(Boolean).join('\n\n')
}

function slideXmlText(title, body) {
  const lines = String(body || ' ').split('\n').map((line) => `
            <a:p>
              <a:r>
                <a:rPr lang="zh-CN" sz="1600"/>
                <a:t>${esc(line || ' ')}</a:t>
              </a:r>
            </a:p>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr txBox="1"/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p><a:r><a:rPr lang="zh-CN" sz="2800" b="1"/><a:t>${esc(title || ' ')}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr txBox="1"/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr wrap="square"/>
          <a:lstStyle/>
          ${lines}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`
}

function slideXmlPic() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="2" name="Slide"/>
          <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rId2"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="0" y="0"/>
            <a:ext cx="${SLIDE_CX}" cy="${SLIDE_CY}"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`
}

function slideRels(hasImage) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  ${hasImage ? '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/imageSLIDE.png"/>' : ''}
</Relationships>`
}

function hidden(el) {
  if (!el || el.nodeType !== 1) return true
  const cs = getComputedStyle(el)
  return cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0
}

function relBox(el, root) {
  const a = el.getBoundingClientRect()
  const b = root.getBoundingClientRect()
  const sx = COVER_DESIGN_W / (b.width || COVER_DESIGN_W)
  const sy = COVER_DESIGN_H / (b.height || COVER_DESIGN_H)
  return {
    x: (a.left - b.left) * sx,
    y: (a.top - b.top) * sy,
    w: a.width * sx,
    h: a.height * sy,
    sx,
    sy,
  }
}

function cssUrl(value) {
  const m = String(value || '').match(/url\((['"]?)(.*?)\1\)/)
  return m ? m[2] : ''
}

function parseRadius(value, fallback = 0) {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : fallback
}

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

function fontOf(cs, scale = 1) {
  const size = (Number.parseFloat(cs.fontSize) || 14) * scale
  return `${cs.fontStyle || 'normal'} ${cs.fontWeight || '400'} ${size}px ${cs.fontFamily || 'sans-serif'}`
}

function drawWrapped(ctx, text, box, cs, scaleY) {
  const raw = String(text || '').replace(/\r/g, '')
  if (!raw.trim() || box.w < 2 || box.h < 2) return
  const lineH = (Number.parseFloat(cs.lineHeight) || Number.parseFloat(cs.fontSize) * 1.4 || 18) * scaleY
  const padX = 2
  const maxW = Math.max(4, box.w - padX * 2)
  ctx.save()
  ctx.beginPath()
  ctx.rect(box.x, box.y, box.w, box.h)
  ctx.clip()
  ctx.fillStyle = cs.color || '#333'
  ctx.font = fontOf(cs, scaleY)
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  const align = cs.textAlign
  const x0 = align === 'center' ? box.x + box.w / 2 : align === 'right' ? box.x + box.w - padX : box.x + padX
  ctx.textAlign = align === 'center' || align === 'right' ? align : 'left'
  let y = box.y + 1
  const paras = raw.split('\n')
  for (const para of paras) {
    const chars = Array.from(para)
    if (!chars.length) {
      y += lineH
      if (y > box.y + box.h) break
      continue
    }
    let line = ''
    for (const ch of chars) {
      const next = line + ch
      if (line && ctx.measureText(next).width > maxW) {
        ctx.fillText(line, x0, y)
        y += lineH
        if (y > box.y + box.h) {
          ctx.restore()
          return
        }
        line = ch
      } else line = next
    }
    if (line) {
      ctx.fillText(line, x0, y)
      y += lineH
    }
    if (y > box.y + box.h) break
  }
  ctx.restore()
}

function drawTextEl(ctx, el, root) {
  if (hidden(el) || el.classList.contains('ph')) return
  const box = relBox(el, root)
  if (box.w < 1 || box.h < 1) return
  const cs = getComputedStyle(el)
  const text = (el.value != null && el.tagName === 'INPUT' ? el.value : el.innerText || '').trim()
  if (!text) return
  drawWrapped(ctx, text, box, cs, box.sy)
}

function fillEl(ctx, el, root) {
  if (hidden(el)) return
  const box = relBox(el, root)
  if (box.w < 1 || box.h < 1) return
  const cs = getComputedStyle(el)
  const bg = cs.backgroundColor
  if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') return
  const radius = parseRadius(cs.borderTopLeftRadius)
  ctx.save()
  ctx.fillStyle = bg
  if (radius > 0) {
    roundRect(ctx, box.x, box.y, box.w, box.h, radius * box.sx)
    ctx.fill()
  } else {
    ctx.fillRect(box.x, box.y, box.w, box.h)
  }
  ctx.restore()
}

function strokeEl(ctx, el, root) {
  if (hidden(el)) return
  const box = relBox(el, root)
  const cs = getComputedStyle(el)
  const w = Number.parseFloat(cs.borderTopWidth) || 0
  if (w <= 0 || cs.borderTopStyle === 'none') return
  ctx.save()
  ctx.strokeStyle = cs.borderTopColor || '#e8eaed'
  ctx.lineWidth = w * box.sx
  ctx.strokeRect(box.x, box.y, box.w, box.h)
  ctx.restore()
}

async function loadImg(src) {
  if (!src) return null
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise((resolve) => {
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = src
    setTimeout(resolve, 2000)
  })
  return img.naturalWidth ? img : null
}

async function drawCssBg(ctx, el, root) {
  if (hidden(el)) return
  const box = relBox(el, root)
  const cs = getComputedStyle(el)
  if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
    ctx.fillStyle = cs.backgroundColor
    ctx.fillRect(box.x, box.y, box.w, box.h)
  }
  const url = cssUrl(cs.backgroundImage)
  if (!url || url === 'none') return
  const abs = url.startsWith('data:') ? url : new URL(url, window.location.href).href
  const img = await loadImg(abs)
  if (img) ctx.drawImage(img, box.x, box.y, box.w, box.h)
}

async function drawSvg(ctx, svg, root) {
  if (!svg || hidden(svg)) return
  const box = relBox(svg, root)
  if (box.w < 1 || box.h < 1) return
  const xml = new XMLSerializer().serializeToString(svg)
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  try {
    const img = await loadImg(href)
    if (img) ctx.drawImage(img, box.x, box.y, box.w, box.h)
  } finally {
    URL.revokeObjectURL(href)
  }
}

async function rasterizeSlide(root) {
  if (!root) throw new Error('幻灯片未渲染')
  const W = COVER_DESIGN_W
  const H = COVER_DESIGN_H
  const canvas = document.createElement('canvas')
  canvas.width = W * EXPORT_SCALE
  canvas.height = H * EXPORT_SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  if (root.classList.contains('is-cover')) {
    const design = root.querySelector('.cover-design')
    if (design) await drawCssBg(ctx, design, root)
    root.querySelectorAll('.cover-brand, .cover-kicker, .cover-title, .cover-line, .cover-meta, .cover-extra, .cover-city-meta, .cover-text').forEach((el) => {
      if (el.classList.contains('cover-line')) {
        if (hidden(el)) return
        const box = relBox(el, root)
        const cs = getComputedStyle(el)
        ctx.fillStyle = cs.backgroundColor || '#c9a227'
        ctx.fillRect(box.x, box.y, box.w, box.h)
        return
      }
      drawTextEl(ctx, el, root)
    })
    return canvas.toDataURL('image/png')
  }

  const master = root.querySelector('img.slide-master')
  if (master) {
    await new Promise((resolve) => {
      if (master.complete) resolve()
      else {
        master.onload = () => resolve()
        master.onerror = () => resolve()
        setTimeout(resolve, 1500)
      }
    })
    if (master.naturalWidth) {
      const box = relBox(master, root)
      ctx.drawImage(master, box.x, box.y, box.w, box.h)
    }
  }

  root.querySelectorAll('.sand-cell').forEach((el) => fillEl(ctx, el, root))
  root.querySelectorAll('.slot-table td').forEach((el) => {
    fillEl(ctx, el, root)
    strokeEl(ctx, el, root)
  })

  root.querySelectorAll('canvas').forEach((el) => {
    if (hidden(el) || !el.width || !el.height) return
    const target = el.closest('.g2-host') || el
    const box = relBox(target, root)
    if (box.w < 2 || box.h < 2) return
    try { ctx.drawImage(el, box.x, box.y, box.w, box.h) } catch { /* ignore */ }
  })

  root.querySelectorAll('.slide-title, .slide-title-input, .slot-cap, .slot-footnote, .slot-text, .slide-endnote, .slide-foot, .sand-cell, .slot-table td').forEach((el) => {
    drawTextEl(ctx, el, root)
  })

  for (const sh of root.querySelectorAll('.slide-shape')) {
    if (hidden(sh)) continue
    fillEl(ctx, sh, root)
    strokeEl(ctx, sh, root)
    const svg = sh.querySelector('svg')
    if (svg) await drawSvg(ctx, svg, root)
    sh.querySelectorAll('.shape-label').forEach((el) => drawTextEl(ctx, el, root))
  }

  return canvas.toDataURL('image/png')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function canvasHasInk(c) {
  if (!c?.width || !c?.height) return false
  try {
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return true
    const sw = Math.min(c.width, 120)
    const sh = Math.min(c.height, 80)
    const samples = [
      ctx.getImageData(0, 0, sw, sh).data,
      ctx.getImageData(Math.max(0, Math.floor(c.width / 2) - 40), Math.max(0, Math.floor(c.height / 2) - 40), 80, 80).data,
    ]
    return samples.some((d) => {
      for (let i = 3; i < d.length; i += 4) if (d[i] > 8) return true
      return false
    })
  } catch {
    return true
  }
}

function ensureExportStyle() {
  if (document.getElementById('ppt-export-style')) return
  const style = document.createElement('style')
  style.id = 'ppt-export-style'
  style.textContent = `
    .ppt-export-host { position:fixed;left:0;top:0;width:${COVER_DESIGN_W}px;height:${COVER_DESIGN_H}px;z-index:180;pointer-events:none;overflow:hidden;background:#fff; }
    .ppt-export-host .ppt-slide, .ppt-export-host .slide-fit { width:${COVER_DESIGN_W}px !important;height:${COVER_DESIGN_H}px !important; }
    .ppt-export-host .slot-chart { height:100%; min-height:0; }
    .ppt-export-host .slot-chart .g2-wrap,
    .ppt-export-host .slot-chart .g2-host { height:100% !important; min-height:240px !important; flex:1 1 auto; }
  `
  document.head.appendChild(style)
}

async function waitReady(host) {
  await nextTick()
  host.querySelectorAll('.slot-chart .g2-wrap, .slot-chart .g2-host').forEach((el) => {
    el.style.setProperty('height', '100%', 'important')
  })
  if (document.fonts?.ready) {
    try { await Promise.race([document.fonts.ready, sleep(800)]) } catch { /* ignore */ }
  }
  const imgs = [...host.querySelectorAll('img')]
  await Promise.all(imgs.map((img) => {
    if (img.complete) return null
    return new Promise((resolve) => {
      img.onload = () => resolve()
      img.onerror = () => resolve()
      setTimeout(resolve, 1500)
    })
  }))
  const start = Date.now()
  while (Date.now() - start < 4500) {
    const hosts = [...host.querySelectorAll('.g2-host')]
    if (!hosts.length) break
    const sized = hosts.every((el) => el.clientWidth > 16 && el.clientHeight > 16)
    const canvases = hosts.map((el) => el.querySelector('canvas')).filter(Boolean)
    const inked = canvases.length === hosts.length && canvases.every(canvasHasInk)
    if (sized && inked) {
      await sleep(280)
      break
    }
    await sleep(80)
  }
}

async function captureSlidePng(ppt, slide) {
  ensureExportStyle()
  const host = document.createElement('div')
  host.className = 'ppt-export-host'
  document.body.appendChild(host)
  const app = createApp({
    render: () => h(PptSlide, {
      slide,
      template: ppt.cover?.template || ppt.coverTemplate || 'city',
      pptStyle: ppt.style,
      hiRes: true,
    }),
  })
  app.mount(host)
  try {
    await waitReady(host)
    const root = host.querySelector('.ppt-slide')
    return await rasterizeSlide(root)
  } finally {
    app.unmount()
    host.remove()
  }
}

function dataUrlToBase64(dataUrl) {
  const i = String(dataUrl || '').indexOf(',')
  return i >= 0 ? dataUrl.slice(i + 1) : ''
}

export async function buildPptxBlob(ppt) {
  const zip = new JSZip()
  const slides = ppt.slides || []
  const captured = []
  for (const s of slides) {
    try {
      captured.push(await captureSlidePng(ppt, s))
    } catch {
      captured.push('')
    }
  }

  const slideFiles = slides.map((s, i) => {
    const title = s.kind === 'cover' ? (s.cover?.title || ppt.title) : (s.title || slidePageLabel(s, i))
    if (captured[i]) return { xml: slideXmlPic(), image: captured[i], i }
    return { xml: slideXmlText(title, slideBody(s)), image: '', i }
  })

  const imageOverrides = slideFiles
    .filter((s) => s.image)
    .map((s) => `<Override PartName="/ppt/media/image${s.i + 1}.png" ContentType="image/png"/>`)
    .join('')

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  ${slideFiles.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}
  ${imageOverrides}
</Types>`)

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`)

  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${esc(ppt.title)}</dc:title>
  <dc:creator>${esc(ppt.creator || '')}</dc:creator>
  <cp:lastModifiedBy>${esc(ppt.updater || '')}</cp:lastModifiedBy>
</cp:coreProperties>`)

  zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>AILab PPT</Application>
  <Slides>${slideFiles.length}</Slides>
  <PresentationFormat>${esc(typeName(ppt.type))}</PresentationFormat>
</Properties>`)

  zip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${slideFiles.map((_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('')}
  <Relationship Id="rId${slideFiles.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`)

  zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>
    ${slideFiles.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('')}
  </p:sldIdLst>
  <p:sldSz cx="${SLIDE_CX}" cy="${SLIDE_CY}"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`)

  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`)

  zip.file('ppt/slideMasters/slideMaster1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`)

  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`)

  zip.file('ppt/slideLayouts/slideLayout1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
  <p:cSld name="Blank">
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`)

  zip.file('ppt/theme/theme1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office">
  <a:themeElements>
    <a:clrScheme name="Office">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1F497D"/></a:dk2>
      <a:lt2><a:srgbClr val="EEECE1"/></a:lt2>
      <a:accent1><a:srgbClr val="1664FF"/></a:accent1>
      <a:accent2><a:srgbClr val="E34D59"/></a:accent2>
      <a:accent3><a:srgbClr val="12B76A"/></a:accent3>
      <a:accent4><a:srgbClr val="F2994A"/></a:accent4>
      <a:accent5><a:srgbClr val="7B61FF"/></a:accent5>
      <a:accent6><a:srgbClr val="56CCF2"/></a:accent6>
      <a:hlink><a:srgbClr val="1664FF"/></a:hlink>
      <a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Office">
      <a:majorFont><a:latin typeface="Calibri"/><a:ea typeface="微软雅黑"/></a:majorFont>
      <a:minorFont><a:latin typeface="Calibri"/><a:ea typeface="微软雅黑"/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
        <a:ln w="25400"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
        <a:ln w="38100"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`)

  slideFiles.forEach((item, i) => {
    zip.file(`ppt/slides/slide${i + 1}.xml`, item.xml)
    zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, slideRels(!!item.image).replace('imageSLIDE.png', `image${i + 1}.png`))
    if (item.image) zip.file(`ppt/media/image${i + 1}.png`, dataUrlToBase64(item.image), { base64: true })
  })

  return zip.generateAsync({ type: 'blob' })
}

export async function downloadPptx(ppt) {
  const blob = await buildPptxBlob(ppt)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${ppt.title || 'PPT'}.pptx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 800)
}
