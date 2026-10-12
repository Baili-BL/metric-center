<script setup>
import { computed } from 'vue'
import { dashCap, dashPattern, shapeById } from './ppt-shapes'

const props = defineProps({
  shapeId: { type: String, default: 'rect' },
  shape: { type: Object, default: null },
  preview: { type: Boolean, default: false },
})

const def = computed(() => shapeById(props.shape?.shape || props.shapeId))
const draw = computed(() => def.value.draw || { type: 'rect', x: 1, y: 1, w: 30, h: 30 })
const kind = computed(() => props.shape?.kind || def.value.kind || 'closed')
const isLine = computed(() => kind.value === 'line')
const mid = computed(() => `mk-${(props.shape?.id || props.shapeId || 'p').replace(/[^a-zA-Z0-9_-]/g, '')}`)

const stroke = computed(() => (props.preview ? '#2f6bff' : (props.shape?.strokeColor || '#4e5969')))
const swPx = computed(() => Math.max(0.25, Number(props.shape?.strokeWidth) || 1))
const dashCss = computed(() => dashPattern(props.shape?.strokeDash, swPx.value))
const cap = computed(() => dashCap(props.shape?.strokeDash, isLine.value))
const fillNone = computed(() => {
  if (props.preview || isLine.value) return true
  return !!props.shape?.fillNone
})
const fill = computed(() => {
  if (fillNone.value) return 'none'
  return props.shape?.fill || '#dbe7ff'
})
const arrows = computed(() => props.preview ? (def.value.arrows || 'none') : (props.shape?.arrows || def.value.arrows || 'none'))
const markerStart = computed(() => (isLine.value && (arrows.value === 'start' || arrows.value === 'both') ? `url(#${mid.value}-s)` : ''))
const markerEnd = computed(() => (isLine.value && (arrows.value === 'end' || arrows.value === 'both') ? `url(#${mid.value}-e)` : ''))

const canvasStyle = computed(() => {
  if (props.preview) return undefined
  return {
    '--ppt-sw': `${swPx.value}px`,
    '--ppt-dash': dashCss.value,
    '--ppt-cap': cap.value,
  }
})

const common = computed(() => {
  if (props.preview) {
    return {
      fill: fill.value,
      stroke: stroke.value,
      'stroke-width': 1.5,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }
  }
  return {
    fill: fill.value,
    stroke: stroke.value,
    'stroke-width': swPx.value,
    'stroke-linecap': cap.value,
    'stroke-linejoin': 'miter',
    'stroke-miterlimit': 2.5,
    'vector-effect': 'non-scaling-stroke',
    'marker-start': markerStart.value || undefined,
    'marker-end': markerEnd.value || undefined,
  }
})
</script>

<template>
  <svg
    class="ppt-shape-svg"
    :class="{ canvas: !preview, line: isLine }"
    viewBox="0 0 32 32"
    :preserveAspectRatio="preview ? 'xMidYMid meet' : 'none'"
    :style="canvasStyle"
    aria-hidden="true"
  >
    <defs v-if="isLine && !preview">
      <marker :id="mid + '-s'" markerWidth="8" markerHeight="8" refX="1.4" refY="4" orient="auto" markerUnits="strokeWidth">
        <path d="M8 0 L0 4 L8 8 Z" :fill="stroke" />
      </marker>
      <marker :id="mid + '-e'" markerWidth="8" markerHeight="8" refX="6.6" refY="4" orient="auto" markerUnits="strokeWidth">
        <path d="M0 0 L8 4 L0 8 Z" :fill="stroke" />
      </marker>
    </defs>
    <line
      v-if="draw.type === 'line'"
      v-bind="common"
      :x1="draw.x1" :y1="draw.y1" :x2="draw.x2" :y2="draw.y2"
    />
    <polyline
      v-else-if="draw.type === 'polyline'"
      v-bind="common"
      fill="none"
      :points="draw.points"
    />
    <polygon
      v-else-if="draw.type === 'poly'"
      v-bind="common"
      :points="draw.points"
    />
    <path
      v-else-if="draw.type === 'path'"
      v-bind="common"
      :d="draw.d"
      fill-rule="evenodd"
    />
    <rect
      v-else-if="draw.type === 'rect'"
      v-bind="common"
      :x="draw.x" :y="draw.y" :width="draw.w" :height="draw.h" :rx="draw.rx || 0" :ry="draw.rx || 0"
    />
    <ellipse
      v-else
      v-bind="common"
      :cx="draw.cx" :cy="draw.cy" :rx="draw.rx" :ry="draw.ry"
    />
  </svg>
</template>
