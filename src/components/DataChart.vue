<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Chart } from '@antv/g2'

/**
 * DataHub 仪表盘通用图表：直接接收 G2 v5 spec，
 * 与业务型 G2Chart.vue（paintChart 指标体系）解耦。
 */
const props = defineProps({
  spec: { type: Object, required: true },
  height: { type: Number, default: 260 },
  /** 填满父容器高度（父级需为 flex 布局） */
  fill: { type: Boolean, default: false },
})

const el = ref(null)
let chart = null
let renderSeq = 0

async function render() {
  if (!el.value) return
  const seq = ++renderSeq
  const prev = chart
  chart = null
  try { prev?.destroy?.() } catch { /* noop */ }
  el.value.innerHTML = ''
  try {
    const c = new Chart({
      container: el.value,
      autoFit: true,
      height: props.fill ? undefined : props.height,
    })
    c.options({ ...props.spec })
    await c.render()
    if (seq === renderSeq) chart = c
    else { try { c.destroy?.() } catch { /* noop */ } }
  } catch (err) {
    console.warn('[DataChart] render failed:', err)
  }
}

onMounted(render)
onBeforeUnmount(() => {
  renderSeq++
  try { chart?.destroy?.() } catch { /* noop */ }
  chart = null
})
watch(() => props.spec, render, { deep: true })
watch(() => [props.height, props.fill], render)
</script>

<template>
  <div ref="el" class="dc-host" :class="{ 'dc-fill': fill }" :style="fill ? { height: '100%' } : { height: height + 'px' }" />
</template>

<style scoped>
.dc-host { width: 100%; min-height: 80px; }
.dc-host.dc-fill { flex: 1; min-height: 120px; }
</style>
