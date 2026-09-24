<script setup>
import { computed, reactive, ref, watch } from 'vue'

const MATRIX = [
  '#ffffff', '#165dff', '#00d6c8', '#14c9c9', '#00b42a', '#9fdb1d', '#f7ba1e', '#ff7d00', '#f53f3f', '#f5319d', '#722ed1', '#d91ad9',
  '#f7f8fa', '#e8f3ff', '#e8fffb', '#e8fffb', '#e8ffea', '#fcffe8', '#fffce8', '#fff7e8', '#ffece8', '#ffe8f1', '#f5e8ff', '#ffe8fb',
  '#f2f3f5', '#bedaff', '#b7f4ec', '#b5f4ea', '#aff0b5', '#edf8bb', '#fdf4bf', '#ffe4ba', '#fdcdc5', '#fdd4e8', '#ddbef6', '#f7baef',
  '#c9cdd4', '#6aa1ff', '#5edfd6', '#37d4cf', '#23c343', '#c9e968', '#fadc6d', '#ffb65d', '#f98981', '#f979b7', '#a871e3', '#e865df',
  '#86909c', '#165dff', '#0fc6c2', '#14c9c9', '#00b42a', '#9fdb1d', '#f7ba1e', '#ff7d00', '#f53f3f', '#f5319d', '#722ed1', '#d91ad9',
  '#4e5969', '#0e42d2', '#0aa5a8', '#07828b', '#008026', '#7eb712', '#cc9213', '#d25f00', '#cb272d', '#cb1e83', '#551db0', '#b010b6',
]
const RECENT_SLOTS = 12
const SHADE_STEPS = 13
const STORE_KEY = 'cbRecentColors'

const props = defineProps({
  show: Boolean,
  left: { type: Number, default: 0 },
  top: { type: Number, default: 0 },
  origin: { type: String, default: '#1f2329' },
})
const emit = defineEmits(['update:show', 'pick'])

const cp = reactive({
  origin: '#1f2329',
  hueBase: [46, 116, 255],
  alpha: 1,
  hsl: [214, 100, 59],
})
const recent = ref(loadRecent())

function hslToRgb(h, s, l) {
  h /= 360
  s /= 100
  l /= 100
  const f = (n) => {
    const k = (n + h * 12) % 12
    const a = s * Math.min(l, 1 - l)
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255)
  }
  return [f(0), f(8), f(4)]
}
function rgbToHex(r, g, b) {
  const p = (x) => x.toString(16).padStart(2, '0')
  return `#${p(Math.max(0, Math.min(255, r)))}${p(Math.max(0, Math.min(255, g)))}${p(Math.max(0, Math.min(255, b)))}`
}
function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return [h * 360, s * 100, l * 100]
}
function parseColorToRgb(c) {
  const s = String(c || '').trim()
  if (!s || s.toLowerCase() === 'transparent') return [255, 255, 255, 0]
  if (s[0] === '#') {
    let h = s.slice(1)
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    if (h.length >= 6) {
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1]
    }
  }
  const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i)
  if (m) return [+m[1], +m[2], +m[3], m[4] != null ? +m[4] : 1]
  return [47, 107, 255, 1]
}

const matrix = computed(() => MATRIX)
function swatchLight(color) {
  const [r, g, b] = parseColorToRgb(color)
  return (r * 299 + g * 587 + b * 114) / 1000 > 186
}
function swatchOn(color) {
  return String(color).toLowerCase() === hex.value.toLowerCase()
}

function currentColor() {
  const r = cp.hueBase
  if (cp.alpha <= 0.005) return ''
  if (cp.alpha >= 0.995) return rgbToHex(r[0], r[1], r[2])
  return `rgba(${r[0]},${r[1]},${r[2]},${cp.alpha.toFixed(2)})`
}

const hex = computed(() => rgbToHex(cp.hueBase[0], cp.hueBase[1], cp.hueBase[2]))
const preview = computed(() => currentColor() || 'transparent')
const alphaBg = computed(() => (
  `linear-gradient(to right, rgba(${cp.hueBase.join(',')},0), ${hex.value}),repeating-conic-gradient(#d9d9d9 0 25%,#fff 0 50%)`
))
const shadeColors = computed(() => {
  const [h, s] = cp.hsl
  return Array.from({ length: SHADE_STEPS }, (_, i) => {
    const l = 7 + (i / (SHADE_STEPS - 1)) * 84
    const rgb = hslToRgb(h, s, l)
    return rgbToHex(rgb[0], rgb[1], rgb[2])
  })
})
const shadeIndex = computed(() => {
  const l = Math.max(7, Math.min(91, cp.hsl[2]))
  return Math.max(0, Math.min(SHADE_STEPS - 1, Math.round(((l - 7) / 84) * (SHADE_STEPS - 1))))
})
function loadColor(color) {
  const rgb = parseColorToRgb(color)
  cp.hueBase = [rgb[0], rgb[1], rgb[2]]
  cp.alpha = rgb[3] == null ? 1 : Math.max(0, Math.min(1, rgb[3]))
  cp.hsl = rgbToHsl(rgb[0], rgb[1], rgb[2])
}

function apply(color, record) {
  emit('pick', color)
  if (record !== false && color) pushRecent(color)
}

function pick(color, record) {
  loadColor(color)
  apply(currentColor(), record)
}
function resetColor() {
  pick(cp.origin, false)
}

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]') } catch { return [] }
}
function pushRecent(color) {
  const arr = loadRecent().filter((c) => c !== color)
  arr.unshift(color)
  const next = arr.slice(0, RECENT_SLOTS)
  try { localStorage.setItem(STORE_KEY, JSON.stringify(next)) } catch { /* */ }
  recent.value = next
}

function onTrackDown(e, onPct) {
  const el = e.currentTarget
  const pct = (ev) => {
    const rect = el.getBoundingClientRect()
    return Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
  }
  e.preventDefault()
  onPct(pct(e))
  const mv = (ev) => onPct(pct(ev))
  const up = () => {
    document.removeEventListener('mousemove', mv)
    document.removeEventListener('mouseup', up)
    apply(currentColor())
  }
  document.addEventListener('mousemove', mv)
  document.addEventListener('mouseup', up)
}

function onShadePct(p) {
  const idx = Math.max(0, Math.min(SHADE_STEPS - 1, Math.round(p * (SHADE_STEPS - 1))))
  cp.hsl[2] = 7 + (idx / (SHADE_STEPS - 1)) * 84
  cp.hueBase = hslToRgb(cp.hsl[0], cp.hsl[1], cp.hsl[2])
  apply(currentColor(), false)
}

function onAlphaPct(p) {
  cp.alpha = Math.round(p * 100) / 100
  apply(currentColor(), false)
}

async function dropper() {
  if (!window.EyeDropper) return
  try {
    const res = await new EyeDropper().open()
    if (res?.sRGBHex) pick(res.sRGBHex)
  } catch { /* */ }
}

watch(() => props.show, (on) => {
  if (!on) return
  cp.origin = props.origin || '#1f2329'
  loadColor(cp.origin)
  if (!props.origin) cp.alpha = 0
  recent.value = loadRecent()
})
</script>

<template>
  <div
    v-show="show"
    class="cp"
    :style="{ left: `${left}px`, top: `${top}px` }"
    @mousedown.stop
  >
    <div class="cp-tabs">
      <button type="button" class="cp-reset" @click="resetColor">
        <svg viewBox="0 0 12 12" width="12" height="12" fill="currentColor" aria-hidden="true">
          <path d="M10.9 5.6a.4.4 0 0 1 .4.4A5.25 5.25 0 0 1 1.7 9.4l-.6.6a.15.15 0 0 1-.26-.09L.4 8.05a.15.15 0 0 1 .17-.17l2.14.3a.15.15 0 0 1 .09.26l-.72.71A4.5 4.5 0 0 0 6 10.5 4.5 4.5 0 0 0 10.5 6a.4.4 0 0 1 .4-.4zM6 .75a5.25 5.25 0 0 1 3.78 1.6l.59-.59a.15.15 0 0 1 .25.09l.31 2.14a.15.15 0 0 1-.17.17l-2.14-.3a.15.15 0 0 1-.09-.26l.72-.71A4.5 4.5 0 0 0 1.5 6a.4.4 0 1 1-.8 0A5.25 5.25 0 0 1 6 .75z" />
        </svg>
        重置
      </button>
    </div>
    <div class="cp-matrix">
      <button
        v-for="(c, i) in matrix"
        :key="`${c}-${i}`"
        type="button"
        class="cp-sw"
        :class="{ on: swatchOn(c), light: swatchLight(c) }"
        :style="{ background: c }"
        :title="c"
        @click="pick(c)"
      />
    </div>
    <div class="cp-div" />
    <div class="cp-mid">
      <div class="cp-sliders">
        <div class="cp-track" @mousedown="onTrackDown($event, onShadePct)">
          <div class="cp-shade">
            <button
              v-for="(c, i) in shadeColors"
              :key="c"
              type="button"
              class="cp-gseg"
              :class="{ on: i === shadeIndex }"
              :style="{ background: c }"
            />
          </div>
        </div>
        <div class="cp-track cp-alpha-track" @mousedown="onTrackDown($event, onAlphaPct)">
          <div class="cp-alpha" :style="{ background: alphaBg, backgroundSize: 'auto,8px 8px' }" />
          <div class="cp-handle round" :style="{ left: `${cp.alpha * 100}%`, background: hex }" />
        </div>
      </div>
      <div class="cp-side">
        <div class="cp-preview" :style="{ background: preview }" />
        <button type="button" class="cp-tool" title="吸管取色" @click="dropper">
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none" aria-hidden="true">
            <path d="M7.8 1.6l2.6 2.6M8.7 2.5 4.2 7l-.8 2.6L6 8.8l4.5-4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M3.6 7.2 2.2 8.6a1 1 0 0 0 0 1.4v0a1 1 0 0 0 1.4 0L5 8.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          </svg>
        </button>
        <label class="cp-tool" title="更多颜色">
          <input type="color" :value="hex" @input="pick($event.target.value)">
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M3 8a5.8 5.8 0 0 0 1.6 3.7L2.5 13.8A8.6 8.6 0 0 1 0 8h3z" fill="#ADDD2E" />
            <path d="M4.6 4.3A5.8 5.8 0 0 0 3 8H0a8.6 8.6 0 0 1 2.5-5.7l2.1 2z" fill="#37C15C" />
            <path d="M8 16v-3a5.8 5.8 0 0 0 3.7-1.6l2 2.1A8.6 8.6 0 0 1 8 16z" fill="#FFA235" />
            <path d="M4.3 11.4A5.8 5.8 0 0 0 8 13v3a8.6 8.6 0 0 1-5.7-2.5l2-2.1z" fill="#FEF800" />
            <path d="M11.4 11.7A5.8 5.8 0 0 0 13 8h3a8.6 8.6 0 0 1-2.5 5.7l-2.1-2z" fill="#FF3556" />
            <path d="M13 8a5.8 5.8 0 0 0-1.6-3.7l2.1-2A8.6 8.6 0 0 1 16 8h-3z" fill="#FF4DE1" />
            <path d="M8 3a5.8 5.8 0 0 0-3.7 1.6L2.3 2.5A8.6 8.6 0 0 1 8 0v3z" fill="#16EAEF" />
            <path d="M11.7 4.6A5.8 5.8 0 0 0 8 3V0a8.6 8.6 0 0 1 5.7 2.5l-2 2.1z" fill="#2E74FF" />
          </svg>
        </label>
      </div>
    </div>
    <div class="cp-div" />
    <div class="cp-recent-block">
      <div class="cp-recent-head">
        <span class="cp-label">最近使用
          <span class="cp-info" title="最近选用的颜色会保存在本地">
            <svg viewBox="0 0 12 12" width="12" height="12" fill="currentColor" aria-hidden="true">
              <path d="M6 .75a5.25 5.25 0 1 1 0 10.5A5.25 5.25 0 0 1 6 .75zm0 .9a4.35 4.35 0 1 0 0 8.7 4.35 4.35 0 0 0 0-8.7zM6 5.1a.45.45 0 0 1 .45.45v3.15a.45.45 0 1 1-.9 0V5.55A.45.45 0 0 1 6 5.1zm0-1.8a.6.6 0 1 1 0 1.2.6.6 0 0 1 0-1.2z" />
            </svg>
          </span>
        </span>
      </div>
      <div class="cp-swatch-grid">
        <button
          v-for="(c, i) in recent"
          :key="`${c}-${i}`"
          type="button"
          class="cp-sw"
          :style="{ background: c }"
          :title="c"
          @click="pick(c)"
        />
        <span v-for="n in Math.max(0, RECENT_SLOTS - recent.length)" :key="`e${n}`" class="cp-sw empty" />
      </div>
    </div>
  </div>
</template>
