<script setup>
import { computed } from 'vue'
import G2Chart from './G2Chart.vue'
import { sheetPieSlices } from '../charts/paint'
import { isBarFamily, isPie, isSeasonal, resolveCrossBarRange, sectionValue, toPaintSpec } from '../charts/types'
import { listSeasonYears, seasonYearColor } from '../charts/seasonal'

const props = defineProps({
  state: { type: Object, required: true },
  labels: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})

const paintSeries = computed(() => {
  const series = props.state.series || []
  if (isSeasonal(props.state.type)) return series
  const items = props.state.legendItems
  const filtered = series.filter((s) => s && (!items || items.includes(s.alias || s.name)))
  return filtered.length ? filtered : series
})
const spec = computed(() => ({
  ...toPaintSpec(props.state, paintSeries.value, props.labels || []),
  fromSheet: true,
}))
const legendSeries = computed(() => {
  if (isPie(props.state.type)) return sheetPieSlices(paintSeries.value, props.labels || [])
  if (isSeasonal(props.state.type)) {
    return listSeasonYears(props.labels || [], props.state.season).map((y, i) => ({
      name: `${y}年`,
      color: seasonYearColor(props.state.season, y, i),
    }))
  }
  return paintSeries.value.filter((s) => s && s.name)
})
const titleStyle = computed(() => ({
  color: props.state.titleColor || '#333333',
  fontSize: `${props.state.titleSize || 16}px`,
  fontWeight: props.state.titleBold ? 700 : 400,
  fontStyle: props.state.titleItalic ? 'italic' : 'normal',
}))
const legendStyle = computed(() => ({
  color: props.state.legendColor || '#333',
  fontSize: `${props.state.legendSize || 12}px`,
  fontWeight: props.state.legendBold ? 700 : 400,
  fontStyle: props.state.legendItalic ? 'italic' : 'normal',
}))
const legendAlign = computed(() => {
  if (props.state.legendAlign === 'flex-end') return 'right'
  if (props.state.legendAlign === 'flex-start') return 'left'
  return 'center'
})
const legendBefore = computed(() => props.state.legendShow && legendSeries.value.length
  && (props.state.legendPos === 'left' || props.state.legendPos === 'top' || !props.state.legendPos))
const legendAfter = computed(() => props.state.legendShow && legendSeries.value.length
  && (props.state.legendPos === 'bottom' || props.state.legendPos === 'right'))
const legendVertical = (pos) => pos === 'left' || pos === 'right' || props.state.legendStyle === 'column'
const blockMark = computed(() => isBarFamily(props.state.type) || isPie(props.state.type))
const pieTotal = computed(() => {
  if (!isPie(props.state.type) || props.state.pieStyle !== 'donut' || !props.state.pieTotalShow) return null
  const range = resolveCrossBarRange(props.state.crossBar, props.labels || [])
  const n = (props.state.series || []).reduce((a, s) => a + Math.abs(Number(sectionValue(s.values || [], range) ?? 0)), 0)
  return n
})

function onTitle(e) {
  const text = (e.target.textContent || '').trim()
  props.state.title = text || '图表'
}
</script>

<template>
  <div
    class="cb-chart-card sheet-chart-card"
    :class="['legend-' + (state.legendPos || 'top'), { 'legend-column': state.legendStyle === 'column' }]"
  >
    <div v-if="state.titleShow" class="chart-title" :class="'align-' + (state.titleAlign || 'left')">
      <h3
        :contenteditable="editable"
        spellcheck="false"
        :style="titleStyle"
        @blur="onTitle"
      >{{ state.title }}</h3>
      <div v-if="state.remarkOn && state.remark && state.remarkPos !== 'chartTop'" class="chart-remark rich-note" v-html="state.remark" />
      <div v-if="state.divider" class="chart-divider" :style="{ borderTopColor: state.dividerColor, borderTopWidth: (state.dividerWidth || 1) + 'px' }" />
    </div>
    <div v-if="state.remarkOn && state.remark && state.remarkPos === 'chartTop'" class="chart-remark rich-note" v-html="state.remark" />
    <div class="chart-plot-wrap">
      <div
        v-if="legendBefore"
        class="chart-legend"
        :class="['align-' + legendAlign, { vertical: legendVertical(state.legendPos) }]"
        :style="legendStyle"
      >
        <span v-for="s in legendSeries" :key="s.name" class="lg-item">
          <i class="lg-mark" :class="blockMark ? 'block' : 'line'" :style="{ background: blockMark ? s.color : 'transparent', borderColor: s.color }" />
          <span class="lg-name">{{ s.alias || s.name }}</span>
        </span>
      </div>
      <div class="chart-body">
        <G2Chart v-if="state.series?.length" :spec="spec" fill />
        <div v-else class="chart-empty">请选择包含表头和数值的区域</div>
        <div v-if="pieTotal != null" class="pie-total-layer">
          <div class="pie-total-name" :style="{ color: state.pieTotalNameColor, fontSize: (state.pieTotalNameSize || 12) + 'px', fontWeight: state.pieTotalNameBold ? 700 : 400, fontStyle: state.pieTotalNameItalic ? 'italic' : 'normal' }">{{ state.pieTotalName || '总计' }}</div>
          <div class="pie-total-value" :style="{ color: state.pieTotalValueColor, fontSize: (state.pieTotalValueSize || 20) + 'px', fontWeight: state.pieTotalValueBold ? 700 : 400, fontStyle: state.pieTotalValueItalic ? 'italic' : 'normal' }">{{ pieTotal.toLocaleString('en-US') }}</div>
        </div>
      </div>
      <div
        v-if="legendAfter"
        class="chart-legend"
        :class="['align-' + legendAlign, { vertical: legendVertical(state.legendPos) }]"
        :style="legendStyle"
      >
        <span v-for="s in legendSeries" :key="'b-' + s.name" class="lg-item">
          <i class="lg-mark" :class="blockMark ? 'block' : 'line'" :style="{ background: blockMark ? s.color : 'transparent', borderColor: s.color }" />
          <span class="lg-name">{{ s.alias || s.name }}</span>
        </span>
      </div>
    </div>
    <div v-if="state.footnoteOn && state.footnote" class="chart-footnote rich-note" v-html="state.footnote" />
  </div>
</template>
