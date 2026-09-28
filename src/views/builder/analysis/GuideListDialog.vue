<script setup>
import { ref, watch } from 'vue'
import { IconPlus, IconEdit, IconDelete } from '@arco-design/web-vue/es/icon'
import {
  defaultGuide,
  normalizeGuide,
} from '../../../charts/analysis/types'
import MarkLineDialog from './MarkLineDialog.vue'

const props = defineProps({
  visible: Boolean,
  guides: { type: Array, default: () => [] },
  seriesList: { type: Array, default: () => [] },
  dual: { type: Boolean, default: false },
})
const emit = defineEmits(['update:visible', 'ok'])

const draft = ref([])
const editOpen = ref(false)
const editIdx = ref(-1)
const editGuide = ref(null)

watch(() => [props.visible, props.guides], () => {
  if (!props.visible) return
  draft.value = (props.guides || []).map((g) => normalizeGuide(
    JSON.parse(JSON.stringify(g)),
    props.seriesList[0]?.name || '',
  ))
})

function seriesLabel(name) {
  const s = props.seriesList.find((x) => x.name === name)
  return s ? (s.alias || s.name) : (name || '—')
}

function modeText(g) {
  if (g.scaleMode === 'fixed' || g.mode === 'fixed') return `固定值 ${g.value ?? ''}`
  if (g.calcMode === 'meanStd') return `均值+${g.stdK || 1}σ`
  if (g.calcMode === 'quantile') return `${g.quantileP ?? 50}%分位`
  return '区间均值'
}

function addGuide() {
  draft.value.push(defaultGuide(props.seriesList[0]?.name || '', draft.value))
}

function removeGuide(i) {
  draft.value.splice(i, 1)
}

function openEdit(i) {
  editIdx.value = i
  editGuide.value = draft.value[i]
  editOpen.value = true
}

function onEditOk(g) {
  if (editIdx.value >= 0) draft.value[editIdx.value] = normalizeGuide(g)
  else draft.value.push(normalizeGuide(g))
}

function confirm() {
  emit('ok', draft.value.map((g) => normalizeGuide(g)))
  emit('update:visible', false)
}

function cancel() {
  emit('update:visible', false)
}
</script>

<template>
  <a-modal
    :visible="visible"
    title="标识线"
    :width="720"
    unmount-on-close
    @ok="confirm"
    @cancel="cancel"
    @update:visible="emit('update:visible', $event)"
  >
    <a-button type="outline" long class="an-add-btn" @click="addGuide">
      <template #icon><IconPlus /></template>
      添加辅助线
    </a-button>

    <a-empty v-if="!draft.length" description="暂无标识线，点击上方按钮添加。" />

    <a-list v-else :bordered="false" class="an-list">
      <a-list-item v-for="(g, i) in draft" :key="g.id" class="an-list-item">
        <a-list-item-meta>
          <template #title>{{ g.name }}</template>
          <template #description>
            {{ seriesLabel(g.series) }} · {{ modeText(g) }} · {{ g.axis === 'right' ? '右轴' : '左轴' }}
          </template>
        </a-list-item-meta>
        <template #actions>
          <a-button type="text" size="mini" @click="openEdit(i)">
            <template #icon><IconEdit /></template>
          </a-button>
          <a-button type="text" status="danger" size="mini" @click="removeGuide(i)">
            <template #icon><IconDelete /></template>
          </a-button>
        </template>
      </a-list-item>
    </a-list>

    <MarkLineDialog
      v-model:visible="editOpen"
      :guide="editGuide"
      :series-list="seriesList"
      :dual="dual"
      @ok="onEditOk"
    />
  </a-modal>
</template>
