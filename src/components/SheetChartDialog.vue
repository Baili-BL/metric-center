<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import Icon from './Icon.vue'
import BuilderStylePanel from '../views/builder/BuilderStylePanel.vue'
import { CHART_TYPES, CT_GROUP_ORDER } from '../charts/types'
import { SHEET_PALETTES, applySheetPalette, paletteOf, sheetTypeName } from '../utils/sheetChart'

const props = defineProps({
  state: { type: Object, required: true },
  rangeText: { type: String, default: '' },
  categoryName: { type: String, default: '类别' },
  columns: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'pick', 'range', 'category', 'add-series', 'replace-series', 'remove-series'])

const tab = ref('data')
const typeOpen = ref(false)
const palOpen = ref(false)
const fieldMenu = ref(null)
const rangeDraft = ref(props.rangeText)
watch(() => props.rangeText, (v) => { rangeDraft.value = v })

const SHEET_SKIP_TYPES = new Set(['crossBar', 'crossScatter'])
const groups = computed(() => CT_GROUP_ORDER.map((group) => ({
  group,
  items: CHART_TYPES.filter((t) => t.group === group && !SHEET_SKIP_TYPES.has(t.id)),
})).filter((g) => g.items.length))
const palette = computed(() => paletteOf(props.state))
function touchAxis(key, field, value) {
  const ax = props.state.ax?.[key]
  if (ax) ax[field] = value
}
const gridOn = computed({
  get: () => !!(props.state.ax?.x?.grid || props.state.ax?.yL?.grid),
  set: (v) => {
    touchAxis('x', 'grid', v)
    touchAxis('yL', 'grid', v)
    touchAxis('yR', 'grid', v)
  },
})
const axisOn = computed({
  get: () => props.state.axisShow !== false && props.state.ax?.x?.show !== false,
  set: (v) => {
    props.state.axisShow = v
    touchAxis('x', 'show', v)
    touchAxis('yL', 'show', v)
    touchAxis('yR', 'show', v)
  },
})

function pickType(id) {
  props.state.type = id
  typeOpen.value = false
}
function pickPalette(i) {
  applySheetPalette(props.state, i)
  palOpen.value = false
}
const usedCols = computed(() => new Set((props.state.series || []).map((s) => s.col)))
const spareCols = computed(() => props.columns.filter((col) => col.numeric > 0 && col.col !== props.state.categoryCol && !usedCols.value.has(col.col)))
function seriesChoices(current) {
  return props.columns.filter((col) => col.numeric > 0 && (col.col === current || !usedCols.value.has(col.col)) && col.col !== props.state.categoryCol)
}
function closePops() {
  typeOpen.value = false
  palOpen.value = false
  fieldMenu.value = null
}
function openField(kind, index, event) {
  typeOpen.value = false
  palOpen.value = false
  const rect = event.currentTarget.getBoundingClientRect()
  const width = Math.max(rect.width, 220)
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  fieldMenu.value = { kind, index, left, width, top: rect.bottom + 4 }
  nextTick(() => {
    const menu = document.querySelector('.sc-float')
    if (!menu || !fieldMenu.value) return
    const h = menu.offsetHeight
    let top = rect.bottom + 4
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 4)
    fieldMenu.value = { ...fieldMenu.value, top }
  })
}
function commitRange() {
  const text = String(rangeDraft.value ?? '').trim()
  if (!text || text === props.rangeText) {
    rangeDraft.value = props.rangeText
    return
  }
  emit('range', text)
  nextTick(() => { rangeDraft.value = props.rangeText })
}
</script>

<template>
  <aside class="sc-panel" role="dialog" aria-label="图表" @mousedown.stop="closePops">
    <header class="sc-head">
      <span class="sc-title">图表</span>
      <span class="sc-info" title="用当前选区的表头和数值绘制，样式与图库图表一致">
        <Icon name="info-circle" :size="14" />
      </span>
      <button type="button" class="sc-x" title="关闭" @click="emit('close')">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4.1 4.1l7.8 7.8M11.9 4.1l-7.8 7.8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      </button>
    </header>
    <div class="sc-tabs">
      <button type="button" :class="{ on: tab === 'data' }" @click="tab = 'data'">类型与数据</button>
      <button type="button" :class="{ on: tab === 'style' }" @click="tab = 'style'">自定义样式</button>
    </div>
    <div class="sc-body">
      <div v-show="tab === 'data'" class="sc-form">
            <label class="sc-label">图表类型</label>
            <div class="sc-select" :class="{ open: typeOpen }">
              <button type="button" class="sc-select-btn" @click.stop="typeOpen = !typeOpen; palOpen = false">
                <Icon name="chart-bar" :size="14" />
                <span>{{ sheetTypeName(state.type) }}</span>
                <i class="sc-caret" />
              </button>
              <div v-if="typeOpen" class="sc-menu" @mousedown.stop>
                <div v-for="g in groups" :key="g.group" class="sc-group">
                  <div class="sc-group-name">{{ g.group }}</div>
                  <button
                    v-for="item in g.items"
                    :key="item.id"
                    type="button"
                    :class="{ on: state.type === item.id }"
                    @click="pickType(item.id)"
                  >
                    <Icon :name="item.icon" :size="14" />
                    {{ sheetTypeName(item.id) }}
                  </button>
                </div>
              </div>
            </div>

            <label class="sc-label">主题色</label>
            <div class="sc-pal" :class="{ open: palOpen }">
              <button type="button" class="sc-pal-row" @click.stop="palOpen = !palOpen; typeOpen = false">
                <i v-for="c in palette.colors" :key="c" class="p-c" :style="{ background: c }" />
                <span class="p-name">{{ palette.name }}</span>
              </button>
              <div v-if="palOpen" class="sc-pal-list" @mousedown.stop>
                <button
                  v-for="(p, i) in SHEET_PALETTES"
                  :key="p.name"
                  type="button"
                  class="sc-pal-opt"
                  :class="{ on: state.paletteIdx === i }"
                  @click="pickPalette(i)"
                >
                  <i v-for="c in p.colors" :key="c" class="p-c" :style="{ background: c }" />
                  <span class="p-name">{{ p.name }}</span>
                </button>
              </div>
            </div>

            <label class="sc-check">
              <input v-model="state.gradient" type="checkbox">
              <span>渐变填充</span>
            </label>

            <div class="sc-label">图表选项</div>
            <div class="sc-opts">
              <label><input v-model="state.titleShow" type="checkbox"><span>图表标题</span></label>
              <label><input v-model="state.legendShow" type="checkbox"><span>图例</span></label>
              <label><input v-model="state.labelShow" type="checkbox"><span>数据标签</span></label>
              <label><input v-model="axisOn" type="checkbox"><span>坐标轴</span></label>
              <label><input v-model="gridOn" type="checkbox"><span>网格线</span></label>
            </div>

            <label class="sc-label">数据范围</label>
            <div class="sc-range">
              <input
                v-model="rangeDraft"
                spellcheck="false"
                title="可直接改区域，回车确认"
                @keydown.enter.prevent="commitRange"
                @blur="commitRange"
              >
              <button type="button" title="到表格中框选区域" @mousedown.stop @click="emit('pick')">
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 2h4v1.4H3.4v2.6H2V2Zm8 0h4v4h-1.4V3.4H10V2ZM2 10h1.4v2.6H6V14H2v-4Zm10.6 0H14v4h-4v-1.4h2.6V10Z" fill="currentColor"/></svg>
              </button>
            </div>

            <div class="sc-label">横轴（类别）</div>
            <button type="button" class="sc-field sc-field-btn" @click.stop="openField('category', -1, $event)">
              <i class="sc-field-ico">T</i>
              <span>{{ categoryName || '类别' }}</span>
              <i class="sc-caret" />
            </button>

            <div class="sc-label">纵轴（系列）</div>
            <div v-for="(s, i) in state.series" :key="`${s.col}-${i}`" class="sc-field">
              <button type="button" class="sc-series" @click.stop="openField('series', i, $event)">
                <i class="sc-field-ico num">123</i>
                <span>{{ s.name }}</span>
                <i class="sc-caret" />
              </button>
              <button type="button" class="sc-series-x" title="移除这个系列" @click="emit('remove-series', i)">×</button>
            </div>
            <button type="button" class="sc-add" @click.stop="openField('add', -1, $event)">+ 添加系列</button>
          </div>
          <div
            v-if="fieldMenu"
            class="sc-menu sc-float"
            :style="{ left: `${fieldMenu.left}px`, width: `${fieldMenu.width}px`, top: `${fieldMenu.top}px` }"
            @mousedown.stop
          >
            <template v-if="fieldMenu.kind === 'category'">
              <button
                v-for="col in columns"
                :key="col.col"
                type="button"
                :class="{ on: col.col === state.categoryCol }"
                @click="emit('category', col.col); fieldMenu = null"
              >
                <i class="sc-field-ico">T</i>
                {{ col.name }}
              </button>
            </template>
            <template v-else-if="fieldMenu.kind === 'series'">
              <button
                v-for="col in seriesChoices(state.series[fieldMenu.index]?.col)"
                :key="col.col"
                type="button"
                :class="{ on: col.col === state.series[fieldMenu.index]?.col }"
                @click="emit('replace-series', fieldMenu.index, col.col); fieldMenu = null"
              >
                <i class="sc-field-ico num">123</i>
                {{ col.name }}
              </button>
              <div v-if="!seriesChoices(state.series[fieldMenu.index]?.col).length" class="sc-empty">没有其他数值列</div>
            </template>
            <template v-else>
              <button
                v-for="col in spareCols"
                :key="col.col"
                type="button"
                @click="emit('add-series', col.col); fieldMenu = null"
              >
                <i class="sc-field-ico num">123</i>
                {{ col.name }}
              </button>
              <div v-if="!spareCols.length" class="sc-empty">范围内没有更多数值列，可扩大数据范围后再添加</div>
            </template>
          </div>
          <div v-show="tab === 'style'" class="cb-root sc-style">
            <BuilderStylePanel :state="state" :palettes="SHEET_PALETTES" hide-aux @palette="pickPalette" />
          </div>
    </div>
  </aside>
</template>
