<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import G2Chart from '../../components/G2Chart.vue'
import PptShapeSvg from './PptShapeSvg.vue'
import { COVER_DESIGN_H, COVER_DESIGN_W, chartFootnoteHtml, chartPaintSpec, coverTextStyle, htmlFontsToEm, plainNote, pptStyleVars, textLook } from './ppt-model'

const props = defineProps({
  slide: { type: Object, required: true },
  template: { type: String, default: 'city' },
  pptStyle: { type: Object, default: null },
  mini: { type: Boolean, default: false },
  editable: { type: Boolean, default: false },
  dropIndex: { type: Number, default: -1 },
  selectedIndex: { type: Number, default: -1 },
  selectedTitle: { type: Boolean, default: false },
  layerMode: { type: Boolean, default: false },
  selectedShapeId: { type: String, default: '' },
  hiRes: { type: Boolean, default: false },
})
const emit = defineEmits([
  'update-title', 'update-text', 'pick-block', 'edit-block', 'replace-block',
  'drop-block', 'drag-over', 'drag-leave', 'select-block', 'select-title',
  'edit-text', 'update-box', 'reset-box', 'select-shape', 'update-shape', 'remove-shape',
])

const cover = computed(() => props.slide?.cover || {})
const theme = computed(() => cover.value.template || props.template || 'city')
const layout = computed(() => props.slide?.layout || 'chartText')
const blocks = computed(() => props.slide?.blocks || [])

const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
const drag = ref(null)
const shapeDrag = ref(null)
const editingShape = ref('')
const shapes = computed(() => props.slide?.shapes || [])
const rootEl = ref(null)
const pageFit = ref({ s: 1, x: 0, y: 0 })
const coverFit = ref({ s: 1, x: 0, y: 0 })
let coverRo = null

function fitPage() {
  const el = rootEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const s = Math.min(r.width / COVER_DESIGN_W, r.height / COVER_DESIGN_H) || 1
  const x = (r.width - COVER_DESIGN_W * s) / 2
  const y = (r.height - COVER_DESIGN_H * s) / 2
  pageFit.value = { s, x, y }
  if (props.mini) coverFit.value = { s: 1, x: 0, y: 0 }
  else coverFit.value = { s, x, y }
}
const pageFitStyle = computed(() => {
  if (!props.mini) return null
  return {
    transform: `translate(${pageFit.value.x}px, ${pageFit.value.y}px) scale(${pageFit.value.s})`,
    '--cover-scale': pageFit.value.s,
  }
})
const coverDesignStyle = computed(() => ({
  transform: `translate(${coverFit.value.x}px, ${coverFit.value.y}px) scale(${coverFit.value.s})`,
  '--cover-scale': coverFit.value.s,
}))

onMounted(() => {
  fitPage()
  if (typeof ResizeObserver === 'undefined') return
  coverRo = new ResizeObserver(fitPage)
  if (rootEl.value) coverRo.observe(rootEl.value)
})
watch(() => props.mini, () => fitPage())

const styleVars = computed(() => pptStyleVars(props.pptStyle))
const showFootnote = computed(() => props.pptStyle?.showFootnote !== false)
const pageFootnote = computed(() => {
  if (!showFootnote.value) return ''
  const text = String(props.pptStyle?.footnote || '').trim()
  if (!text) return ''
  const hasChart = (props.slide?.blocks || []).some((b) => b?.type === 'chart' && b.builderState)
  if (hasChart) return ''
  return text
})
function footHtml(b) {
  return chartFootnoteHtml(b, props.pptStyle)
}

function specOf(block) {
  if (!block || block.type !== 'chart') return null
  if (!block.builderState) return null
  return chartPaintSpec(block, props.pptStyle)
}
function isEmpty(b) {
  if (!b || b.type === 'content') return true
  if (b.type === 'text') return !plainNote(b.text)
  if (b.type === 'chart') return !b.builderState
  if (b.type === 'table') return !b.preview?.length
  if (b.type === 'sandbox') return !b.cells?.length
  return true
}
function emptyHint(b) {
  if (b?.type === 'table') return '点击插入表格'
  if (b?.type === 'sandbox') return '点击插入沙盘'
  if (b?.type === 'content') return '点击插入图表、表格或文本'
  return '点击插入图表'
}
function isVisual(b) {
  return b && (b.type === 'chart' || b.type === 'table' || b.type === 'sandbox')
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}
function boxOf(b) {
  const raw = b?.box || {}
  const w = clamp(Number(raw.w) || 100, 20, 100)
  const h = clamp(Number(raw.h) || 100, 20, 100)
  const x = clamp(Number(raw.x) || 0, 0, 100 - w)
  const y = clamp(Number(raw.y) || 0, 0, 100 - h)
  return { x, y, w, h }
}
function isCustomBox(b) {
  const box = boxOf(b)
  return box.x !== 0 || box.y !== 0 || box.w !== 100 || box.h !== 100
}
function boxStyle(b) {
  const box = boxOf(b)
  return {
    left: `${box.x}%`,
    top: `${box.y}%`,
    width: `${box.w}%`,
    height: `${box.h}%`,
  }
}
function chgClass(v) {
  if (v > 0.02) return 'up'
  if (v < -0.02) return 'down'
  return 'flat'
}
function chgText(v) {
  const n = Math.round((v || 0) * 100)
  return `${n > 0 ? '+' : ''}${n}%`
}
function onDragOver(e, i) {
  if (!props.editable) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
  emit('drag-over', i)
}
function onDrop(e, i) {
  if (!props.editable) return
  e.preventDefault()
  emit('drop-block', { index: i, raw: e.dataTransfer.getData('application/json') })
}
function onBodyDrag(e) {
  if (!props.editable) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
}
function onBodyDrop(e) {
  if (!props.editable) return
  e.preventDefault()
  emit('drop-block', { index: -1, raw: e.dataTransfer.getData('application/json') })
}
function textBoxStyle(b) {
  const look = textLook(b, props.pptStyle)
  return {
    ...boxStyle(b),
    fontFamily: look.fontFamily,
    fontSize: `${look.fontSize}px`,
    color: look.color,
    fontWeight: look.fontWeight,
    fontStyle: look.fontStyle,
  }
}
watch(() => props.layerMode, (on) => { if (!on) editingShape.value = '' })
watch(() => props.selectedShapeId, (id) => { if (id !== editingShape.value) editingShape.value = '' })

function onSlotClick(i, b) {
  if (props.layerMode || !props.editable) return
  if (b.type === 'text') {
    emit('select-block', i)
    if (isEmpty(b)) emit('edit-text', i)
    return
  }
  if (isEmpty(b) || b.type === 'content') emit('pick-block', i)
  else emit('select-block', i)
}
function startTextEdit(i) {
  emit('select-block', i)
  emit('edit-text', i)
}

function applyDrag(ev) {
  const d = drag.value
  if (!d) return
  const dx = ((ev.clientX - d.x) / d.rect.width) * 100
  const dy = ((ev.clientY - d.y) / d.rect.height) * 100
  let { x, y, w, h } = d.box
  const dir = d.dir
  if (dir === 'move') {
    x = clamp(x + dx, 0, 100 - w)
    y = clamp(y + dy, 0, 100 - h)
  } else {
    if (dir.includes('e')) w = clamp(w + dx, 20, 100 - x)
    if (dir.includes('s')) h = clamp(h + dy, 20, 100 - y)
    if (dir.includes('w')) {
      const nx = clamp(x + dx, 0, x + w - 20)
      w += x - nx
      x = nx
    }
    if (dir.includes('n')) {
      const ny = clamp(y + dy, 0, y + h - 20)
      h += y - ny
      y = ny
    }
  }
  const moved = Math.abs(dx) + Math.abs(dy) > 0.4
  if (dir === 'move' && !moved && !d.moved) return
  d.moved = true
  emit('update-box', { index: d.index, box: { x: round1(x), y: round1(y), w: round1(w), h: round1(h) } })
}
function round1(n) {
  return Math.round(n * 10) / 10
}
function onMove(ev) {
  applyDrag(ev)
}
function onUp() {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  drag.value = null
}
function shapeBox(sh) {
  const w = clamp(Number(sh?.w) || 18, 2, 100)
  const h = clamp(Number(sh?.h) || 10, 2, 100)
  const x = clamp(Number(sh?.x) || 0, 0, 100 - w)
  const y = clamp(Number(sh?.y) || 0, 0, 100 - h)
  return { x, y, w, h }
}
function hexAlpha(hex, transparency) {
  const raw = String(hex || '#ffffff').replace('#', '')
  const h = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.padEnd(6, '0')
  const r = Number.parseInt(h.slice(0, 2), 16) || 0
  const g = Number.parseInt(h.slice(2, 4), 16) || 0
  const b = Number.parseInt(h.slice(4, 6), 16) || 0
  const a = 1 - Math.min(100, Math.max(0, Number(transparency) || 0)) / 100
  return `rgba(${r}, ${g}, ${b}, ${a})`
}
function cssBorderStyle(dash) {
  if (dash === 'roundDot' || dash === 'dot') return 'dotted'
  if (dash && dash !== 'solid') return 'dashed'
  return 'solid'
}
function shapeStyle(sh) {
  const box = shapeBox(sh)
  const style = {
    left: `${box.x}%`,
    top: `${box.y}%`,
    width: `${box.w}%`,
    height: `${box.h}%`,
  }
  if (sh.kind === 'text') {
    const sw = Math.max(0.25, Number(sh.strokeWidth) || 0.75)
    style.background = sh.fillNone ? 'transparent' : hexAlpha(sh.fill || '#ffffff', sh.fillAlpha)
    style.border = sh.strokeNone
      ? 'none'
      : `${sw}px ${cssBorderStyle(sh.strokeDash)} ${sh.strokeColor || '#8f959e'}`
    style.borderRadius = '0'
    style.boxSizing = 'border-box'
  }
  return style
}
function shapeTextStyle(sh) {
  const vert = sh.writingMode === 'vertical'
  const align = sh.align || 'center'
  return {
    color: sh.color || '#1d2129',
    fontSize: `${sh.fontSize || 16}px`,
    fontFamily: sh.fontFamily || 'inherit',
    fontWeight: sh.bold ? '700' : '400',
    fontStyle: sh.italic ? 'italic' : 'normal',
    textAlign: align,
    justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
    writingMode: vert ? 'vertical-rl' : 'horizontal-tb',
    textOrientation: vert ? 'mixed' : undefined,
  }
}
function applyShapeDrag(ev) {
  const d = shapeDrag.value
  if (!d) return
  const dx = ((ev.clientX - d.x) / d.rect.width) * 100
  const dy = ((ev.clientY - d.y) / d.rect.height) * 100
  let { x, y, w, h } = d.box
  const dir = d.dir
  if (dir === 'move') {
    x = clamp(x + dx, 0, 100 - w)
    y = clamp(y + dy, 0, 100 - h)
  } else {
    if (dir.includes('e')) w = clamp(w + dx, 2, 100 - x)
    if (dir.includes('s')) h = clamp(h + dy, 2, 100 - y)
    if (dir.includes('w')) {
      const nx = clamp(x + dx, 0, x + w - 2)
      w += x - nx
      x = nx
    }
    if (dir.includes('n')) {
      const ny = clamp(y + dy, 0, y + h - 2)
      h += y - ny
      y = ny
    }
  }
  const moved = Math.abs(dx) + Math.abs(dy) > 0.3
  if (dir === 'move' && !moved && !d.moved) return
  d.moved = true
  emit('update-shape', { id: d.id, patch: { x: round1(x), y: round1(y), w: round1(w), h: round1(h) } })
}
function onShapeMove(ev) {
  applyShapeDrag(ev)
}
function onShapeUp() {
  window.removeEventListener('pointermove', onShapeMove)
  window.removeEventListener('pointerup', onShapeUp)
  shapeDrag.value = null
}
function startShapeResize(e, sh, dir) {
  if (!props.layerMode || props.mini) return
  e.preventDefault()
  e.stopPropagation()
  const layer = rootEl.value?.querySelector('.slide-layers')
  if (!layer) return
  emit('select-shape', sh.id)
  shapeDrag.value = {
    id: sh.id,
    dir,
    x: e.clientX,
    y: e.clientY,
    box: shapeBox(sh),
    rect: layer.getBoundingClientRect(),
    moved: false,
  }
  window.addEventListener('pointermove', onShapeMove)
  window.addEventListener('pointerup', onShapeUp)
}
function onShapeClick(e, sh) {
  if (!props.layerMode || props.mini) return
  e.stopPropagation()
  emit('select-shape', sh.id)
}
function startShapeText(sh) {
  if (!props.layerMode || props.mini) return
  if (sh.kind === 'line') return
  editingShape.value = sh.id
  emit('select-shape', sh.id)
  nextTick(() => {
    const el = rootEl.value?.querySelector(`textarea[data-shape="${sh.id}"]`)
    el?.focus()
  })
}
function startResize(e, i, dir) {
  if (!props.editable || props.mini) return
  e.preventDefault()
  e.stopPropagation()
  const slot = e.currentTarget.closest('.slide-slot')
  if (!slot) return
  emit('select-block', i)
  drag.value = {
    index: i,
    dir,
    x: e.clientX,
    y: e.clientY,
    box: boxOf(blocks.value[i]),
    rect: slot.getBoundingClientRect(),
    moved: false,
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointermove', onShapeMove)
  window.removeEventListener('pointerup', onShapeUp)
  coverRo?.disconnect()
})
</script>

<template>
  <div
    ref="rootEl"
    class="ppt-slide"
    :class="[`theme-${slide.kind === 'cover' ? theme : template}`, slide.kind === 'cover' ? 'is-cover' : `lay-${layout}`, { mini, editing: editable, layering: layerMode, 'is-dark': pptStyle?.mode === 'dark', 'hide-title': pptStyle && pptStyle.showTitle === false, 'hide-foot': pptStyle && pptStyle.showFooter === false, 'hide-note': pptStyle && pptStyle.showFootnote === false }]"
    :style="styleVars"
    @click.self="editable && emit('select-block', -1)"
  >
    <div class="slide-fit" :style="pageFitStyle">
    <template v-if="slide.kind === 'cover'">
      <div class="cover-design" :style="coverDesignStyle">
        <div class="cover-photo" />
        <div class="cover-deco" />
        <div class="cover-brand">{{ cover.org || '中辉期货有限公司' }}</div>
        <div class="cover-kicker">{{ cover.subtitle || '智能PPT' }}</div>
        <h3 class="cover-title">{{ cover.title || slide.title || '未命名PPT' }}</h3>
        <div class="cover-line" />
        <div class="cover-meta">
          <span v-if="cover.date">{{ cover.date }}</span>
          <span v-if="cover.author">{{ cover.author }}</span>
        </div>
        <div v-if="cover.extra" class="cover-extra">{{ cover.extra }}</div>
        <div v-if="theme === 'city'" class="cover-city-meta">
          <div>名字：{{ cover.author || '' }}</div>
          <div>编号：{{ cover.date || '' }}</div>
        </div>
        <div
          v-for="t in (cover.texts || [])"
          v-show="!$slots['cover-overlay']"
          :key="t.id"
          class="cover-text"
          :style="coverTextStyle(t)"
          v-html="htmlFontsToEm(t.html, t.fontSize)"
        />
        <slot name="cover-overlay" />
      </div>
    </template>

    <template v-else>
      <img class="slide-master" src="/ppt-master.jpg" alt="" draggable="false">
      <div class="slide-chrome" aria-hidden="true" @click="editable && emit('select-block', -1)" />
      <div class="slide-title-row" @click="editable && emit('select-title')">
        <input
          v-if="editable"
          class="slide-title-input"
          :class="{ on: selectedTitle }"
          :value="slide.title"
          placeholder="点击输入标题"
          @click.stop="emit('select-title')"
          @focus="emit('select-title')"
          @input="emit('update-title', $event.target.value)"
        >
        <h4 v-else class="slide-title">{{ slide.title }}</h4>
      </div>
      <div
        class="slide-body"
        @click.self="editable && emit('select-block', -1)"
        @dragover="onBodyDrag"
        @drop="onBodyDrop"
      >
        <div
          v-for="(b, i) in blocks"
          :key="i"
          class="slide-slot"
          :class="[b.type, { empty: isEmpty(b), over: dropIndex === i, selected: selectedIndex === i }]"
          @click="onSlotClick(i, b)"
          @dblclick.stop="editable && (b.type === 'text' ? startTextEdit(i) : (isVisual(b) && !isEmpty(b) && emit('edit-block', i)))"
          @dragover="onDragOver($event, i)"
          @dragleave="emit('drag-leave')"
          @drop.stop="onDrop($event, i)"
        >
          <template v-if="b.type === 'text'">
            <div
              class="slot-frame text-frame"
              :class="{ on: editable && selectedIndex === i, custom: isCustomBox(b) }"
              :style="textBoxStyle(b)"
              @pointerdown="editable && !isEmpty(b) && startResize($event, i, 'move')"
            >
              <div
                v-if="isEmpty(b)"
                class="slot-text ph"
              >{{ editable ? '点击输入文本内容' : '' }}</div>
              <div
                v-else
                class="slot-text rich-note"
                v-html="b.text"
              />
              <div v-if="editable && selectedIndex === i" class="slot-handles" @pointerdown.stop>
                <i v-for="h in HANDLES" :key="h" class="slot-handle" :class="h" @pointerdown.stop="startResize($event, i, h)" />
              </div>
            </div>
          </template>
          <template v-else>
            <div
              class="slot-frame"
              :class="{ on: editable && selectedIndex === i, custom: isCustomBox(b) }"
              :style="boxStyle(b)"
              @pointerdown="editable && !isEmpty(b) && startResize($event, i, 'move')"
            >
              <div v-if="editable && !isEmpty(b)" class="slot-ops" @click.stop @pointerdown.stop>
                <button type="button" @click="emit('edit-block', i)">编辑</button>
                <button type="button" @click="emit('replace-block', i)">替换</button>
                <button v-if="isCustomBox(b)" type="button" @click="emit('reset-box', i)">还原大小</button>
              </div>
              <template v-if="b.type === 'chart'">
                <div v-if="specOf(b)" class="slot-chart">
                  <div v-if="b.title" class="slot-cap">{{ b.title }}</div>
                  <G2Chart :key="(pptStyle?.paletteId || '') + String(!!pptStyle?.gradient) + (hiRes ? '-hi' : '')" :spec="specOf(b)" fill mini disable-tooltip />
                  <div v-if="footHtml(b)" class="slot-footnote rich-note" v-html="footHtml(b)"></div>
                </div>
                <div v-else class="slot-ph slot-ph-chart">{{ emptyHint(b) }}</div>
              </template>
              <template v-else-if="b.type === 'table'">
                <div v-if="b.preview?.length" class="slot-table">
                  <div v-if="b.title" class="slot-cap">{{ b.title }}</div>
                  <table>
                    <tr v-for="(row, ri) in b.preview.slice(0, 8)" :key="ri">
                      <td v-for="(c, ci) in row.slice(0, 6)" :key="ci">{{ typeof c === 'object' ? c.text : c }}</td>
                    </tr>
                  </table>
                </div>
                <div v-else class="slot-ph">点击插入表格</div>
              </template>
              <template v-else-if="b.type === 'sandbox'">
                <div class="slot-sand">
                  <div class="slot-cap">{{ b.title || '品种沙盘' }}</div>
                  <div class="sand-grid">
                    <div v-for="c in b.cells || []" :key="c.name" class="sand-cell" :class="chgClass(c.chg)">
                      <b>{{ c.name }}</b>
                      <span>{{ chgText(c.chg) }}</span>
                    </div>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="slot-ph">{{ emptyHint(b) }}</div>
              </template>
              <div v-if="editable && selectedIndex === i && !isEmpty(b)" class="slot-handles" @pointerdown.stop>
                <i v-for="h in HANDLES" :key="h" class="slot-handle" :class="h" @pointerdown.stop="startResize($event, i, h)" />
              </div>
            </div>
          </template>
        </div>
      </div>
      <div v-if="pageFootnote" class="slide-endnote">{{ pageFootnote }}</div>
      <div v-if="slide.pageNo" class="slide-foot">第{{ slide.pageNo }}页</div>
    </template>
    <div
      class="slide-layers"
      :class="{ on: layerMode }"
      @pointerdown.self="layerMode && emit('select-shape', '')"
    >
      <div
        v-for="sh in shapes"
        :key="sh.id"
        class="slide-shape"
        :class="{ selected: selectedShapeId === sh.id, line: sh.kind === 'line', textbox: sh.kind === 'text', vert: sh.writingMode === 'vertical' }"
        :style="shapeStyle(sh)"
        @pointerdown="layerMode && startShapeResize($event, sh, 'move')"
        @click="onShapeClick($event, sh)"
        @dblclick.stop="startShapeText(sh)"
      >
        <PptShapeSvg v-if="sh.kind !== 'text'" :shape="sh" />
        <textarea
          v-if="layerMode && editingShape === sh.id"
          :data-shape="sh.id"
          :value="sh.text"
          :style="shapeTextStyle(sh)"
          :placeholder="sh.kind === 'text' ? '点击输入文字' : ''"
          @click.stop
          @pointerdown.stop
          @blur="editingShape = ''"
          @input="emit('update-shape', { id: sh.id, patch: { text: $event.target.value } })"
        />
        <div
          v-else-if="sh.kind === 'text' || sh.text"
          class="shape-label"
          :class="{ ph: !String(sh.text || '').trim() }"
          :style="shapeTextStyle(sh)"
        >{{ String(sh.text || '').trim() ? sh.text : (sh.kind === 'text' ? '点击输入文字' : '') }}</div>
        <button
          v-if="layerMode && selectedShapeId === sh.id"
          type="button"
          class="shape-del"
          title="删除图层"
          @pointerdown.stop
          @click.stop="emit('remove-shape', sh.id)"
        >×</button>
        <div v-if="layerMode && selectedShapeId === sh.id" class="slot-handles" @pointerdown.stop>
          <i v-for="h in HANDLES" :key="h" class="slot-handle" :class="h" @pointerdown.stop="startShapeResize($event, sh, h)" />
        </div>
      </div>
    </div>
    </div>
  </div>
</template>
