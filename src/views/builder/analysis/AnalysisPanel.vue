<script setup>
import { computed, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import {
  defaultAnno,
  defaultAnnoCfg,
  normalizeAnno,
} from '../../../charts/analysis/types'
import GuideListDialog from './GuideListDialog.vue'
import TrendListDialog from './TrendListDialog.vue'
import AnnoEditPane from './AnnoEditPane.vue'
import Icon from '../../../components/Icon.vue'

const props = defineProps({
  state: { type: Object, required: true },
  labels: { type: Array, default: () => [] },
  picking: { type: Boolean, default: false },
})
const emit = defineEmits(['update:picking', 'pick-start'])

const guideOpen = ref(false)
const trendOpen = ref(false)
const editingId = ref(null)
const dragId = ref(null)

const analysis = computed(() => props.state.analysis || { guides: [], trends: [], annos: [], markLine: '', markArea: '' })

const guidesOn = computed(() => (analysis.value.guides || []).length > 0)
const trendsOn = computed(() => (analysis.value.trends || []).length > 0)
const annos = computed(() => analysis.value.annos || [])
const editingAnno = computed(() => annos.value.find((a) => String(a.id) === String(editingId.value)) || null)

function ensureAnnos() {
  if (!Array.isArray(analysis.value.annos)) analysis.value.annos = []
  return analysis.value.annos
}

function onGuidesOk(list) {
  analysis.value.guides = list
  const first = list.find((g) => g.mode === 'fixed' && g.value != null)
  analysis.value.markLine = first ? String(first.value) : ''
}

function onTrendsOk(list) {
  analysis.value.trends = list
}

function annoSubText(a) {
  const mode = a.cfg?.mode || (a.dim != null ? 'manual' : 'measure')
  if (mode === 'measure') return `${a.cfg?.labelText || a.text || '区间'}（条件标注）`
  return `${a.text || '拐点'}：${a.dim ?? '未点选'}`
}

function addAnno() {
  const list = ensureAnnos()
  const item = defaultAnno(list)
  item.cfg = defaultAnnoCfg()
  item.cfg.mode = 'manual'
  list.push(item)
  editingId.value = item.id
  emit('update:picking', true)
  emit('pick-start', item.id)
}

function toggleVisible(a) {
  a.visible = a.visible === false
}

function removeAnno(a) {
  const list = ensureAnnos()
  const i = list.findIndex((x) => String(x.id) === String(a.id))
  if (i >= 0) list.splice(i, 1)
  if (String(editingId.value) === String(a.id)) editingId.value = null
}

function openEdit(a) {
  editingId.value = a.id
}

function onAnnoChange(next) {
  const list = ensureAnnos()
  const i = list.findIndex((x) => String(x.id) === String(next.id))
  if (i >= 0) list[i] = normalizeAnno(next)
}

function onAnnoPick() {
  emit('update:picking', true)
  emit('pick-start', editingId.value)
}

function applyPick(datum) {
  if (!datum) return
  const list = ensureAnnos()
  const dim = datum.x ?? datum.date ?? datum.name
  const series = datum.name || ''
  let item = list.find((a) => String(a.id) === String(editingId.value))
  if (!item) {
    item = defaultAnno(list)
    item.cfg = defaultAnnoCfg()
    item.cfg.mode = 'manual'
    list.push(item)
    editingId.value = item.id
  }
  item.dim = dim
  item.series = series
  if (!item.cfg) item.cfg = defaultAnnoCfg()
  item.cfg.mode = 'manual'
  emit('update:picking', false)
  Message.success(`已绑定 ${item.name}`)
}

function onDragStart(a, e) {
  dragId.value = a.id
  e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e) {
  e.preventDefault()
}

function onDrop(target) {
  const list = ensureAnnos()
  const from = list.findIndex((a) => String(a.id) === String(dragId.value))
  const to = list.findIndex((a) => String(a.id) === String(target.id))
  dragId.value = null
  if (from < 0 || to < 0 || from === to) return
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved)
}

defineExpose({ applyPick })
</script>

<template>
  <div class="analysis-panel">
    <div class="sec open warn-sec">
      <div class="sec-head"><span class="s-name">分析预警</span></div>
      <div class="sec-body">
        <div class="warn-row">
          <span class="warn-name">标识线</span>
          <span>
            <span v-if="guidesOn" class="warn-on">已开启</span>
            <button type="button" class="warn-edit" title="编辑" @click="guideOpen = true">
              <Icon name="edit" :size="14" />
            </button>
          </span>
        </div>
        <div class="warn-row">
          <span class="warn-name">趋势线</span>
          <span>
            <span v-if="trendsOn" class="warn-on">已开启</span>
            <button type="button" class="warn-edit" title="编辑" @click="trendOpen = true">
              <Icon name="edit" :size="14" />
            </button>
          </span>
        </div>
      </div>
    </div>

    <div class="sec open anno-sec">
      <div class="sec-head"><span class="s-name">标注</span></div>
      <div class="sec-body">
        <button
          type="button"
          class="anno-add"
          :class="{ picking }"
          @click="addAnno"
        >
          <Icon name="plus-fill" :size="12" />
          新增标注
        </button>

        <div v-if="!annos.length" class="anno-empty">
          暂无标注。点击「新增标注」后，在图表上点选数据点。
        </div>

        <div v-else class="anno-list">
          <div
            v-for="a in annos"
            :key="a.id"
            class="anno-card"
            :class="{ 'is-hidden': a.visible === false, dragging: String(dragId) === String(a.id) }"
            draggable="true"
            @dragstart="onDragStart(a, $event)"
            @dragover="onDragOver"
            @drop="onDrop(a)"
          >
            <span class="anno-card-top">
              <span class="anno-drag" title="拖拽调整优先级"><Icon name="drag-handle" :size="12" /></span>
              <span class="anno-name" :title="a.name">{{ a.name }}</span>
              <button
                type="button"
                class="anno-ico-btn"
                :title="a.visible === false ? '显示' : '隐藏'"
                @click="toggleVisible(a)"
              >
                <Icon :name="a.visible !== false ? 'eye-off' : 'preview'" :size="14" />
              </button>
              <button type="button" class="anno-ico-btn" title="删除" @click="removeAnno(a)">
                <Icon name="trash" :size="14" />
              </button>
              <button type="button" class="anno-ico-btn" title="编辑" @click="openEdit(a)">
                <Icon name="edit" :size="14" />
              </button>
            </span>
            <span class="anno-card-sub">
              <span class="anno-dim" :title="annoSubText(a)">{{ annoSubText(a) }}</span>
            </span>
          </div>
        </div>

        <AnnoEditPane
          v-if="editingAnno"
          :anno="editingAnno"
          :series-list="state.series || []"
          :labels="labels"
          @change="onAnnoChange"
          @close="editingId = null"
          @pick="onAnnoPick"
          @cancel-pick="emit('update:picking', false)"
        />

        <div class="anno-tip">
          <Icon name="info-fill" :size="12" />
          标注中含有相同维值，将向上覆盖，可拖拽改变优先级。
        </div>
      </div>
    </div>

    <GuideListDialog
      v-model:visible="guideOpen"
      :guides="analysis.guides"
      :series-list="state.series || []"
      :dual="!!state.dual"
      @ok="onGuidesOk"
    />
    <TrendListDialog
      v-model:visible="trendOpen"
      :trends="analysis.trends"
      :series-list="state.series || []"
      @ok="onTrendsOk"
    />
  </div>
</template>
