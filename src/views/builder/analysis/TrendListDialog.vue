<script setup>
import { ref, watch } from 'vue'
import { IconPlus, IconDelete } from '@arco-design/web-vue/es/icon'
import {
  TREND_TYPES,
  defaultTrend,
  normalizeTrend,
} from '../../../charts/analysis/types'
import { DASH_STYLES } from '../../../charts/types'
import ColorPop from '../../../components/ColorPop.vue'

const props = defineProps({
  visible: Boolean,
  trends: { type: Array, default: () => [] },
  seriesList: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:visible', 'ok'])

const draft = ref([])
const colorOpen = ref(false)
const colorIdx = ref(-1)
const colorLeft = ref(0)
const colorTop = ref(0)
const colorOrigin = ref('#f2994a')

const dashOptions = DASH_STYLES.map((d) => ({
  value: d.id,
  label: d.id === 'solid' ? '实线' : d.id === 'dash' ? '虚线' : '点线',
}))

watch(() => [props.visible, props.trends], () => {
  if (!props.visible) return
  draft.value = (props.trends || []).map((t) => normalizeTrend(
    JSON.parse(JSON.stringify(t)),
    props.seriesList[0]?.name || '',
  ))
})

function seriesLabel(s) {
  return s.alias || s.name
}

function addTrend() {
  draft.value.push(defaultTrend(props.seriesList[0]?.name || '', draft.value))
}

function removeTrend(i) {
  draft.value.splice(i, 1)
}

function openColor(i, e) {
  const r = e.currentTarget.getBoundingClientRect()
  const width = 284
  const height = 420
  colorLeft.value = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
  let top = r.bottom + 6
  if (top + height > window.innerHeight - 8) top = Math.max(8, r.top - height - 6)
  colorTop.value = Math.round(top)
  colorIdx.value = i
  colorOrigin.value = draft.value[i]?.color || '#f2994a'
  colorOpen.value = true
}

function onColorPick(color) {
  if (colorIdx.value < 0 || !draft.value[colorIdx.value]) return
  draft.value[colorIdx.value].color = color || colorOrigin.value
}

function confirm() {
  emit('ok', draft.value.map((t) => normalizeTrend(t)))
  emit('update:visible', false)
}

function cancel() {
  emit('update:visible', false)
}
</script>

<template>
  <a-modal
    :visible="visible"
    title="趋势线"
    :width="900"
    unmount-on-close
    @ok="confirm"
    @cancel="cancel"
    @update:visible="emit('update:visible', $event)"
  >
    <button type="button" class="guide-add" @click="addTrend">
      <IconPlus />
      添加趋势线
    </button>

    <div v-if="!draft.length" class="anno-empty">暂无趋势线，点击上方按钮添加。</div>

    <div v-for="(t, i) in draft" :key="t.id" class="gl-row">
      <input class="gl-name" v-model="t.name" maxlength="40" placeholder="名称">
      <select class="gl-sel gl-series" v-model="t.series">
        <option v-for="s in seriesList" :key="s.name" :value="s.name">{{ seriesLabel(s) }}</option>
      </select>
      <select class="gl-sel" v-model="t.type">
        <option v-for="x in TREND_TYPES" :key="x.id" :value="x.id">{{ x.name }}</option>
      </select>
      <select class="gl-sel" v-model="t.dash" style="min-width:72px;width:80px">
        <option v-for="d in dashOptions" :key="d.value" :value="d.value">{{ d.label }}</option>
      </select>
      <button
        type="button"
        class="ml-color color-well"
        :style="{ background: t.color }"
        title="颜色"
        @click.stop="openColor(i, $event)"
      />
      <span class="gl-forecast">
        后推
        <input type="number" v-model.number="t.forecast" min="0" max="36">
        期
      </span>
      <button type="button" class="gl-del" title="删除" @click="removeTrend(i)">
        <IconDelete />
      </button>
    </div>

    <Teleport to="body">
      <ColorPop
        :show="colorOpen"
        :left="colorLeft"
        :top="colorTop"
        :origin="colorOrigin"
        @update:show="colorOpen = $event"
        @pick="onColorPick"
      />
    </Teleport>
  </a-modal>
</template>
