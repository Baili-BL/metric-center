<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { paintChart } from '../charts/paint'
import { usesViewCtrl } from '../charts/types'
import { bindViewCtrlDateLabels, hideViewCtrlDateLabels } from '../charts/viewCtrl'

const props = defineProps({
  spec: { type: Object, required: true },
  height: { type: Number, default: 0 },
  mini: { type: Boolean, default: false },
  fill: { type: Boolean, default: false },
  picking: { type: Boolean, default: false },
  /** 列表页预览等场景强制关闭图表 tooltip */
  disableTooltip: { type: Boolean, default: false },
})
const emit = defineEmits(['point-click'])

const wrap = ref(null)
const el = ref(null)
const layer = ref(null)
const startEl = ref(null)
const endEl = ref(null)
let chart = null
let unbindLabels = null
let unbindClick = null

function clearLabels() {
  unbindLabels?.()
  unbindLabels = null
  hideViewCtrlDateLabels({ layer: layer.value })
}

function clearClick() {
  unbindClick?.()
  unbindClick = null
}

function extractDatum(ev) {
  if (!ev) return null
  let d = ev.data
  if (d && d.data !== undefined) d = d.data
  if (Array.isArray(d)) {
    d = d.find((x) => x && (x.x != null || x.date != null || x.name != null)) || d[0]
  }
  if (!d || typeof d !== 'object') return null
  if (d.x == null && d.date == null && d.name == null) return null
  return d
}

function bindClick() {
  clearClick()
  if (!chart || typeof chart.on !== 'function') return
  const onPick = (ev) => {
    if (!props.picking) return
    const d = extractDatum(ev)
    if (!d) return
    if (ev?.nativeEvent?.preventDefault) {
      ev.nativeEvent.preventDefault()
      ev.nativeEvent.stopPropagation()
    }
    emit('point-click', d)
  }
  chart.on('element:click', onPick)
  chart.on('click', onPick)
  unbindClick = () => {
    chart?.off?.('element:click', onPick)
    chart?.off?.('click', onPick)
  }
}

async function render() {
  if (!el.value) return
  clearLabels()
  clearClick()
  chart?.destroy?.()
  chart = null
  el.value.innerHTML = ''
  await nextTick()
  for (let i = 0; i < 20; i++) {
    if (el.value.clientWidth > 0) break
    await new Promise((r) => requestAnimationFrame(r))
  }
  chart = paintChart(el.value, {
    ...props.spec,
    height: props.height || undefined,
    mini: props.mini,
    // 迷你 / 列表预览强制关闭 tooltip
    ...(props.mini || props.disableTooltip
      ? { tooltipShow: false, disableTooltip: true, listPreview: true }
      : {}),
  })
  const showSlider = !props.mini
    && props.spec.viewCtrlShow
    && props.spec.viewCtrlType === 'slider'
    && usesViewCtrl(props.spec.type)
    && chart
  if (showSlider) {
    unbindLabels = bindViewCtrlDateLabels(chart, props.spec.labels || [], {
      host: wrap.value,
      layer: layer.value,
      start: startEl.value,
      end: endEl.value,
    })
  } else {
    hideViewCtrlDateLabels({ layer: layer.value })
  }
  bindClick()
}

onMounted(render)
onBeforeUnmount(() => {
  clearLabels()
  clearClick()
  chart?.destroy?.()
})
watch(() => props.spec, render, { deep: true })
watch(() => props.picking, () => {
  if (chart) bindClick()
})
</script>

<template>
  <div
    ref="wrap"
    class="g2-wrap"
    :class="{ mini, fill, spark: spec.type === 'sparkArea' || spec.spark }"
    :style="height ? { height: height + 'px' } : null"
  >
    <div ref="el" class="g2-host" />
    <div ref="layer" class="viewctrl-date-layer" hidden>
      <span ref="startEl" class="vc-date"></span>
      <span ref="endEl" class="vc-date"></span>
    </div>
  </div>
</template>

<style scoped>
.g2-wrap { position: relative; width: 100%; height: 100%; min-height: 120px; }
.g2-wrap.mini { min-height: 120px; height: 132px; }
.g2-wrap.spark { min-height: 86px; height: 86px; }
.g2-wrap.fill { min-height: 0; height: 100%; }
.g2-host { width: 100%; height: 100%; min-height: inherit; }
.viewctrl-date-layer {
  position: absolute; inset: 0; pointer-events: none; z-index: 4; overflow: hidden;
}
.viewctrl-date-layer[hidden] { display: none !important; }
.vc-date {
  position: absolute; font-size: 11px; line-height: 1; color: #4E5969;
  font-family: "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
  white-space: nowrap; transform: translateY(-50%); user-select: none;
}
</style>
