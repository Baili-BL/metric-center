<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { paintChart } from '../charts/paint'
import { usesViewCtrl } from '../charts/types'
import { bindViewCtrlDateLabels, hideViewCtrlDateLabels } from '../charts/viewCtrl'

const props = defineProps({
  spec: { type: Object, required: true },
  height: { type: Number, default: 0 },
  mini: { type: Boolean, default: false },
  fill: { type: Boolean, default: false },
})

const wrap = ref(null)
const el = ref(null)
const layer = ref(null)
const startEl = ref(null)
const endEl = ref(null)
let chart = null
let unbindLabels = null

const isScrollbar = computed(() => (
  !props.mini
  && !!props.spec?.viewCtrlShow
  && props.spec?.viewCtrlType === 'scrollbar'
  && usesViewCtrl(props.spec?.type)
))
const barMinWidth = computed(() => {
  const n = (props.spec?.labels || []).length || 1
  const minW = Math.max(8, Math.min(200, Number(props.spec?.viewCtrlMinWidth) || 32))
  return `${n * minW + 72}px`
})

function clearLabels() {
  unbindLabels?.()
  unbindLabels = null
  hideViewCtrlDateLabels({ layer: layer.value })
}

async function render() {
  if (!el.value) return
  clearLabels()
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
}

onMounted(render)
onBeforeUnmount(() => {
  clearLabels()
  chart?.destroy?.()
})
watch(() => props.spec, render, { deep: true })
</script>

<template>
  <div
    ref="wrap"
    class="g2-wrap"
    :class="{ mini, fill, spark: spec.type === 'sparkArea' || spec.spark, 'is-bar': isScrollbar }"
    :style="height ? { height: height + 'px' } : null"
  >
    <div class="g2-scroll-port" :class="{ on: isScrollbar }">
      <div ref="el" class="g2-host" :style="isScrollbar ? { minWidth: barMinWidth } : undefined" />
    </div>
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
.g2-scroll-port { width: 100%; height: 100%; min-height: inherit; }
.g2-scroll-port.on {
  overflow-x: scroll;
  overflow-y: hidden;
}
.g2-scroll-port.on::-webkit-scrollbar { height: 8px; }
.g2-scroll-port.on::-webkit-scrollbar-track { background: #E5E6EB; border-radius: 4px; }
.g2-scroll-port.on::-webkit-scrollbar-thumb { background: #C9CDD4; border-radius: 4px; }
.g2-scroll-port.on::-webkit-scrollbar-thumb:hover { background: #86909C; }
.g2-host { width: 100%; height: 100%; min-height: inherit; }
.g2-wrap.is-bar .g2-host { height: calc(100% - 2px); }
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
