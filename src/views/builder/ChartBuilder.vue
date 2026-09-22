<script setup>
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import ExcelJS from 'exceljs'
import {
  CHART_TYPES,
  CT_GROUP_ORDER,
  crossBarTimeLabel,
  crossTimeLabel,
  defaultBuilderState,
  defaultSeriesStyle,
  isCrossScatter,
  isPie,
  isSeasonal,
  latestYmd,
  mergeBuilderState,
  monthStartYmd,
  resolveCrossBarRange,
  sectionValue,
  toPaintSpec,
  usesCrossSectionTime,
} from '../../charts/types'
import G2Chart from '../../components/G2Chart.vue'
import Icon from '../../components/Icon.vue'
import {
  applyCategoryOrder,
  applyCondToValues,
  applyNumberFmtPreset,
  seriesCondText,
  seriesFmtText,
} from '../../charts/fieldFmt'
import BuilderStylePanel from './BuilderStylePanel.vue'
import CrossSectionTime from './CrossSectionTime.vue'
import DataCondDialog from './DataCondDialog.vue'
import DimChip from './DimChip.vue'
import FieldFmtDialog from './FieldFmtDialog.vue'
import FieldItem from './FieldItem.vue'
import AppModal from '../../components/AppModal.vue'
import DirPathPicker from '../../components/DirPathPicker.vue'
import { useGalleryStore } from '../../stores/gallery'
import { useIndicatorStore } from '../../stores/indicators'
import { hashStr, rndSeries } from '../../utils/hash'

const props = defineProps({
  chartId: { type: String, default: '' },
  mode: { type: String, default: 'page' },
})
const emit = defineEmits(['saved', 'close'])

const PALETTES = [
  { name: '中辉期货', colors: ['#c8102e', '#1a3a6b', '#d4a017', '#2e7d5b', '#7a5195', '#e8734a'] },
  { name: '当前仪表板', colors: ['#2E74FF', '#58CAF4', '#867EEC', '#FCBC3D', '#45D0B5', '#5B7BBA'] },
  { name: '暖阳', colors: ['#f2994a', '#f2c94c', '#eb5757', '#bb6bd9', '#56ccf2', '#6fcf97'] },
  { name: '森林', colors: ['#27ae60', '#6fcf97', '#219653', '#9ccc65', '#2f6bff', '#00acc1'] },
  { name: '紫调', colors: ['#7b61ff', '#9b51e0', '#c47ef0', '#5ec8f2', '#f2994a', '#4ecf9f'] },
]
const DATE_PRESETS = [
  { id: 'custom', name: '自定义' },
  { id: 'recent5y', name: '最近5年' },
  { id: 'history', name: '历史至今' },
  { id: 'past5y', name: '过去5年' },
  { id: 'recent1y', name: '最近一年' },
  { id: 'recent6m', name: '最近6个月' },
]
const BUILDER_MONTHS = Array.from({ length: 91 }, (_, i) => {
  const y = 2019 + Math.floor(i / 12)
  const m = (i % 12) + 1
  return `${y}-${String(m).padStart(2, '0')}`
})
const MAX_IND = 8

const gallery = useGalleryStore()
const indicators = useIndicatorStore()
const state = reactive(defaultBuilderState())
const saveForm = reactive({ title: '', dir: '' })
const cfgTab = ref('fields')
const configMode = ref('manual')
const manualCollapsed = ref(false)
const typeOpen = ref(false)
const presetOpen = ref(false)
const infoOpen = ref(false)
const pickOpen = ref(false)
const fcfgOpen = ref(false)
const fcfgIdx = ref(-1)
const dcOpen = ref(false)
const fmtOpen = ref(false)
const fmtIdx = ref(-1)
const pickKw = ref('')
const pickExact = ref(false)
const saveVisible = ref(false)
const aiInput = ref('')
const aiMsgs = ref([])
const pickAxis = ref('left')
const seasonStart = ref('01-01')
const seasonEnd = ref('12-31')
const chartHost = ref(null)

const groupedTypes = computed(() => CT_GROUP_ORDER.map((g) => ({
  group: g,
  items: CHART_TYPES.filter((t) => t.group === g),
})))
const pathLabel = (path) => (path || '').split('/').filter(Boolean).join(' / ')
const rawLabels = computed(() => {
  const n = state.series[0]?.values?.length
  if (n && n === gallery.LABELS.length) return gallery.LABELS
  return BUILDER_MONTHS
})
const viewLabels = computed(() => {
  const from = (state.dateFrom || '').slice(0, 7)
  const to = (state.dateTo || '').slice(0, 7)
  return rawLabels.value.filter((d) => (!from || d >= from) && (!to || d <= to))
})
const viewSeries = computed(() => {
  const set = new Set(viewLabels.value)
  const idx = rawLabels.value.map((d, i) => (set.has(d) ? i : -1)).filter((i) => i >= 0)
  return state.series.map((s) => ({
    ...s,
    values: idx.map((i) => s.values?.[i]),
  }))
})
const paintLabels = computed(() => (usesCrossSectionTime(state.type) ? rawLabels.value : viewLabels.value))
const paintSeriesRaw = computed(() => (usesCrossSectionTime(state.type) ? state.series : viewSeries.value))
const fieldPaint = computed(() => {
  const src = paintSeriesRaw.value
  const filtered = src.map((s) => ({ ...s, values: applyCondToValues(s, src, s.values) }))
  return applyCategoryOrder(paintLabels.value, filtered, state.dimSort)
})
const paintSeries = computed(() => fieldPaint.value.series)
const spec = computed(() => toPaintSpec(state, fieldPaint.value.series, fieldPaint.value.labels))
const fcfgSeries = computed(() => (fcfgIdx.value >= 0 ? state.series[fcfgIdx.value] : null))
const fmtSeries = computed(() => (fmtIdx.value >= 0 ? state.series[fmtIdx.value] : null))
const canPaint = computed(() => (isCrossScatter(state.type) ? state.series.length >= 2 : state.series.length > 0))
const hideDimChip = computed(() => usesCrossSectionTime(state.type) || isCrossScatter(state.type))
const hideDatePreset = computed(() => usesCrossSectionTime(state.type) || isSeasonal(state.type))
const crossBarRange = computed(() => resolveCrossBarRange(state.crossBar, rawLabels.value))
const crossBarHint = computed(() => crossBarTimeLabel(state.crossBar, rawLabels.value))
const crossMinDate = computed(() => monthStartYmd(rawLabels.value[0] || '2019-01'))
const crossMaxDate = computed(() => latestYmd(rawLabels.value))
const headerCrossShowRange = computed(() => state.crossBar?.filter === 'range')
const headerCrossDayDate = computed(() => bindCrossPointDate(state.crossBar?.day, 'day'))
const headerCrossStartDate = computed(() => bindCrossPointDate(state.crossBar?.start, 'start'))
const headerCrossEndDate = computed(() => bindCrossPointDate(state.crossBar?.end, 'end'))
const crossXHint = computed(() => (state.series[0] ? `取值时间：${crossTimeLabel(state.cross?.x, paintLabels.value)}` : ''))
const crossYHint = computed(() => (state.series[1] ? `取值时间：${crossTimeLabel(state.cross?.y, paintLabels.value)}` : ''))
const crossXName = computed(() => state.series[0]?.alias || state.series[0]?.name || '')
const crossYName = computed(() => state.series[1]?.alias || state.series[1]?.name || '')
const legendSeries = computed(() => {
  const items = state.legendItems
  return state.series.filter((s) => !items || items.includes(s.alias || s.name))
})
const titleTextStyle = computed(() => ({
  color: state.titleColor || '#333333',
  fontSize: `${state.titleSize || 16}px`,
  fontWeight: state.titleBold ? 700 : 400,
  fontStyle: state.titleItalic ? 'italic' : 'normal',
}))
const legendTextStyle = computed(() => ({
  color: state.legendColor || '#333',
  fontSize: `${state.legendSize || 12}px`,
  fontWeight: state.legendBold ? 700 : 400,
  fontStyle: state.legendItalic ? 'italic' : 'normal',
}))
const pieTotalValue = computed(() => {
  const range = resolveCrossBarRange(state.crossBar, paintLabels.value)
  return paintSeries.value.reduce((a, s) => a + Math.abs(Number(sectionValue(s.values || [], range) ?? 0)), 0)
})
const currentType = computed(() => CHART_TYPES.find((t) => t.id === state.type) || CHART_TYPES[0])
const leftSeries = computed(() => state.series.map((s, i) => ({ s, i })).filter((x) => (x.s.axis || 'left') !== 'right'))
const rightSeries = computed(() => state.series.map((s, i) => ({ s, i })).filter((x) => x.s.axis === 'right'))
const isCombo = computed(() => state.type === 'combo')
const groupedPick = computed(() => {
  const q = pickKw.value.trim().toLowerCase()
  const map = {}
  indicators.cards.forEach((c) => {
    const hit = !q
      || (pickExact.value ? (c.title.toLowerCase() === q || String(c.id).toLowerCase() === q) : (c.title.toLowerCase().includes(q) || String(c.id).toLowerCase().includes(q)))
    if (!hit) return
    const g = c.dir?.split('/')[0] || '其他'
    if (!map[g]) map[g] = []
    map[g].push(c)
  })
  return Object.keys(map).sort().map((g) => ({ g, items: map[g] }))
})
const presetLabel = computed(() => DATE_PRESETS.find((p) => p.id === state.datePreset)?.name || '历史至今')
function monthStart(ym) {
  const s = String(ym || '')
  if (s.length >= 10) return s.slice(0, 10)
  return s.length >= 7 ? `${s.slice(0, 7)}-01` : ''
}
function monthEnd(ym) {
  const s = String(ym || '')
  if (s.length >= 10) return s.slice(0, 10)
  const [y, m] = s.slice(0, 7).split('-').map(Number)
  if (!y || !m) return ''
  return `${s.slice(0, 7)}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}
const headerRange = computed(() => (state.dateFrom && state.dateTo ? [monthStart(state.dateFrom), monthEnd(state.dateTo)] : []))

function loadChart(id) {
  const c = id ? gallery.getChart(id) : null
  const next = c?.builderState
    ? mergeBuilderState(c.builderState, { title: c.title })
    : defaultBuilderState({ title: '未命名图表', series: [] })
  Object.assign(state, next)
  if (!state.dateFrom) state.dateFrom = rawLabels.value[0]
  if (!state.dateTo) state.dateTo = rawLabels.value.at(-1)
  if (!state.cross) state.cross = { x: { mode: 'latest', ago: 1, fixed: '' }, y: { mode: 'latest', ago: 1, fixed: '' } }
  if (!state.cross.x.fixed) state.cross.x.fixed = rawLabels.value.at(-1) || ''
  if (!state.cross.y.fixed) state.cross.y.fixed = rawLabels.value.at(-1) || ''
  if (!state.crossBar) state.crossBar = defaultBuilderState().crossBar
  saveForm.title = state.title
  saveForm.dir = c?.dir || gallery.currentDir || ''
  cfgTab.value = 'fields'
  configMode.value = 'manual'
  pickOpen.value = false
}

watch(() => props.chartId, (id) => loadChart(id), { immediate: true })

function applyPreset(id) {
  state.datePreset = id
  presetOpen.value = false
  const labs = rawLabels.value
  const last = labs[labs.length - 1]
  const first = labs[0]
  const [ly, lm] = last.split('-').map(Number)
  const shift = (yOff, mOff = 0) => {
    const d = new Date(ly, lm - 1 + mOff, 1)
    d.setFullYear(d.getFullYear() + yOff)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  if (id === 'history') { state.dateFrom = first; state.dateTo = last }
  else if (id === 'recent5y') { state.dateFrom = shift(-5); state.dateTo = last }
  else if (id === 'past5y') { state.dateFrom = shift(-10); state.dateTo = shift(-5) }
  else if (id === 'recent1y') { state.dateFrom = shift(-1); state.dateTo = last }
  else if (id === 'recent6m') { state.dateFrom = shift(0, -6); state.dateTo = last }
}

function onRangeChange(v) {
  state.dateFrom = v?.[0] || ''
  state.dateTo = v?.[1] || ''
  state.datePreset = 'custom'
}

function applyPalette(idx) {
  state.paletteIdx = idx
  const colors = PALETTES[idx].colors
  state.series.forEach((s, i) => { s.color = colors[i % colors.length] })
}

function makeSeries(card, axis, color) {
  return {
    ...defaultSeriesStyle(),
    name: card.title,
    alias: '',
    color,
    axis: axis || 'left',
    values: card.values?.length === gallery.LABELS.length
      ? card.values.slice()
      : rndSeries(hashStr(card.title), BUILDER_MONTHS.length, 2000 + (hashStr(card.title) % 4000), 40 + (hashStr(card.title) % 80)),
    unit: card.unit || '',
    source: card.source || '',
    freq: card.freq || '',
    latest: card.latest,
  }
}

function addSeries(card, axis = pickAxis.value) {
  if (isCrossScatter(state.type) && (axis === 'x' || axis === 'y' || axis === 'left' || axis === 'right')) {
    const slot = axis === 'y' || axis === 'right' ? 1 : 0
    const other = state.series[slot === 0 ? 1 : 0]
    if (other && other.name === card.title) {
      Message.warning('X / Y 轴请选择不同指标')
      return
    }
    if (slot === 1 && !state.series[0]) {
      Message.warning('请先选择 X 轴指标')
      return
    }
    const colors = PALETTES[state.paletteIdx].colors
    const next = makeSeries(card, slot === 1 ? 'right' : 'left', colors[slot % colors.length])
    if (state.series[slot]) state.series.splice(slot, 1, next)
    else state.series.push(next)
    pickOpen.value = false
    if (!state.unit) state.unit = card.unit || ''
    return
  }
  if (state.series.some((s) => s.name === card.title)) {
    state.series = state.series.filter((s) => s.name !== card.title)
    return
  }
  if (state.series.length >= MAX_IND) return Message.warning(`最多添加 ${MAX_IND} 个指标`)
  const colors = PALETTES[state.paletteIdx].colors
  state.series.push(makeSeries(card, axis || 'left', colors[state.series.length % colors.length]))
  if (!state.unit) state.unit = card.unit || ''
}

function toYmd(current) {
  if (!current) return ''
  if (typeof current.format === 'function') return current.format('YYYY-MM-DD')
  const d = current instanceof Date ? current : new Date(current)
  if (Number.isNaN(+d)) {
    const s = String(current)
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : ''
  }
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function bindCrossPointDate(point, role) {
  const fallback = role === 'start' ? crossMinDate.value : crossMaxDate.value
  if (!point) return fallback
  if (point.type === 'precise') return point.date || fallback
  if (role === 'day') return point.base || point.date || fallback
  return point.date || point.base || fallback
}
function setCrossPointDate(point, ymd, role) {
  if (!point || !ymd) return
  if (point.type === 'precise') {
    point.date = ymd
    return
  }
  if (role === 'day') {
    point.base = ymd
    return
  }
  point.date = ymd
  point.base = ymd
}
function disabledCrossDate(current) {
  if (!current) return false
  const ymd = toYmd(current)
  if (!ymd) return false
  return ymd < crossMinDate.value || ymd > crossMaxDate.value
}
function setCrossHeaderDay(ymd) {
  if (!ymd) return
  setCrossPointDate(state.crossBar.day, ymd, 'day')
}
function setCrossHeaderRange(v) {
  const s = v?.[0] || ''
  const e = v?.[1] || ''
  if (!s && !e) return
  if (s) setCrossPointDate(state.crossBar.start, s, 'start')
  if (e) setCrossPointDate(state.crossBar.end, e, 'end')
}
function removeSeries(i) {
  state.series.splice(i, 1)
}
function openPick(axis = 'left') {
  pickAxis.value = axis
  pickKw.value = ''
  pickOpen.value = true
}
function openFcfg(i) {
  fcfgIdx.value = i
  pickOpen.value = false
  fcfgOpen.value = true
}
function closeFcfg() {
  fcfgOpen.value = false
  fcfgIdx.value = -1
}
function onFieldColor(i, color) {
  if (state.series[i]) state.series[i].color = color
}
function onFieldMark(i, mark) {
  if (state.series[i]) state.series[i].mark = mark
}
function onFieldFmt(i, id) {
  if (id === 'custom') {
    fmtIdx.value = i
    fmtOpen.value = true
    return
  }
  applyNumberFmtPreset(state.series[i], id)
}
function onFieldNull(i, id) {
  if (state.series[i]) state.series[i].nullDisplay = id
}
function onFieldSort(i, id) {
  if (state.series[i]) state.series[i].sort = id
}
function onCondOk(cond) {
  if (fcfgSeries.value) fcfgSeries.value.cond = cond
}
function onFmtOk(fmt) {
  const s = state.series[fmtIdx.value]
  if (s) s.fmt = fmt
}
function setType(id) {
  state.type = id
  typeOpen.value = false
}
function openSave() {
  saveForm.title = state.title || '未命名图表'
  saveVisible.value = true
}
function confirmSave() {
  if (!saveForm.title.trim()) return Message.error('请填写图库名称')
  state.title = saveForm.title.trim()
  const chart = gallery.saveChart({
    id: props.chartId || undefined,
    title: state.title,
    dir: saveForm.dir,
    builderState: JSON.parse(JSON.stringify(state)),
  })
  Message.success('已保存到图库')
  saveVisible.value = false
  emit('saved', chart)
}
async function exportExcel() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('图表数据')
  if (usesCrossSectionTime(state.type)) {
    const range = resolveCrossBarRange(state.crossBar, rawLabels.value)
    ws.addRow(['截面时间', range.time])
    ws.addRow(['指标', '取值'])
    paintSeries.value.forEach((s) => {
      ws.addRow([s.alias || s.name, sectionValue(s.values || [], range) ?? ''])
    })
  } else if (isCrossScatter(state.type)) {
    ws.addRow(['轴', '指标', '取值时间'])
    ws.addRow(['X', crossXName.value, crossTimeLabel(state.cross?.x, paintLabels.value)])
    ws.addRow(['Y', crossYName.value, crossTimeLabel(state.cross?.y, paintLabels.value)])
  } else {
    const pack = fieldPaint.value
    ws.addRow(['日期', ...pack.series.map((s) => s.alias || s.name)])
    pack.labels.forEach((lab, i) => {
      ws.addRow([lab, ...pack.series.map((s) => s.values?.[i] ?? '')])
    })
  }
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${state.title || 'chart'}.xlsx`
  a.click()
  Message.success('已导出 Excel')
}
function downloadPng() {
  const canvas = chartHost.value?.querySelector?.('canvas')
  if (!canvas) return Message.warning('请先添加指标并生成图表')
  canvas.toBlob((blob) => {
    if (!blob) return Message.error('导出失败')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${state.title || 'chart'}.png`
    a.click()
    Message.success('已下载图片')
  }, 'image/png')
}

function applyAi(text) {
  const t = String(text || '').trim()
  if (!t) return
  aiMsgs.value.push({ role: 'user', text: t })
  let reply = '已根据指令更新预览。'
  if (/柱图/.test(t)) { state.type = 'bar'; reply = '已切换为柱图。' }
  else if (/面积/.test(t)) { state.type = 'area'; reply = '已切换为面积图。' }
  else if (/饼图|环形/.test(t)) { state.type = 'pie'; reply = '已切换为饼图。' }
  else if (/季节/.test(t)) { state.type = 'seasonal'; reply = '已切换为季节性图。' }
  else if (/线图|曲线/.test(t)) { state.type = 'line'; reply = '已切换为线图。' }
  else if (/标题改为[「"]?([^」"]+)/.test(t)) { state.title = t.match(/标题改为[「"]?([^」"]+)/)[1]; reply = `标题已改为「${state.title}」。` }
  else if (/图例.*下/.test(t)) { state.legendPos = 'bottom'; reply = '图例已放到下方。' }
  else if (/暖阳/.test(t)) { applyPalette(2); reply = '已换成暖阳配色。' }
  else if (/预警线\s*(\d+)/.test(t)) { state.analysis.markLine = t.match(/预警线\s*(\d+)/)[1]; reply = `已设置预警线 ${state.analysis.markLine}。` }
  else if (/双Y|双轴/.test(t)) { state.dual = true; reply = '已开启双 Y 轴（线柱混合下可分别指定主副轴）。' }
  else reply = '我还没识别出可执行的可视化参数。可以试试：改成柱图 / 标题改为「…」 / 图例放到下方 / 配色换成暖阳 / 设置预警线 4500'
  aiMsgs.value.push({ role: 'bot', text: reply })
  aiInput.value = ''
}

function onDocClick(e) {
  if (!e.target.closest?.('.ct-select')) typeOpen.value = false
  if (!e.target.closest?.('.df-preset')) presetOpen.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

const isPreview = computed(() => props.mode === 'preview' || props.mode === 'export')
</script>

<template>
  <div class="cb-root" :class="mode">
    <div class="bench" :data-config="configMode">
      <div class="stage">
        <div v-if="!isPreview" class="stage-bar">
          <div class="sb-left">
            <button type="button" class="back-gallery" @click="emit('close')">
              <Icon name="back" :size="14" />
              返回图库
            </button>
            <div class="date-filter-wrap">
              <div v-if="!hideDatePreset" class="df-preset">
                <button type="button" class="df-preset-btn" :class="{ open: presetOpen }" @click.stop="presetOpen = !presetOpen">
                  <span>{{ presetLabel }}</span>
                  <Icon name="chevron-down-fill" :size="12" />
                </button>
                <div v-if="presetOpen" class="df-preset-menu">
                  <button v-for="p in DATE_PRESETS" :key="p.id" type="button" :class="{ active: state.datePreset === p.id }" @click="applyPreset(p.id)">{{ p.name }}</button>
                </div>
              </div>
              <div v-if="usesCrossSectionTime(state.type)" class="df-range df-cross">
                <a-range-picker
                  v-if="headerCrossShowRange"
                  class="df-cross-picker"
                  size="small"
                  value-format="YYYY-MM-DD"
                  popup-container="body"
                  :allow-clear="false"
                  :disabled-date="disabledCrossDate"
                  :title="'截面时间：' + crossBarHint"
                  :model-value="[headerCrossStartDate, headerCrossEndDate]"
                  @update:model-value="setCrossHeaderRange"
                />
                <a-date-picker
                  v-else
                  class="df-cross-picker"
                  size="small"
                  value-format="YYYY-MM-DD"
                  placeholder="请选择时间"
                  popup-container="body"
                  :allow-clear="false"
                  :disabled-date="disabledCrossDate"
                  :title="'截面时间：' + crossBarHint"
                  :model-value="headerCrossDayDate"
                  @update:model-value="setCrossHeaderDay"
                />
              </div>
              <div v-else class="df-range">
                <a-range-picker
                  size="small"
                  style="width: 292px"
                  value-format="YYYY-MM-DD"
                  popup-container="body"
                  :allow-clear="false"
                  :model-value="headerRange"
                  @change="onRangeChange"
                />
              </div>
            </div>
          </div>
          <div class="sb-center">
            <div class="mode-switch" role="tablist">
              <button type="button" :class="{ on: configMode === 'manual' }" @click="configMode = 'manual'; manualCollapsed = false">手工</button>
              <button type="button" :class="{ on: configMode === 'ai' }" @click="configMode = 'ai'">AI</button>
            </div>
          </div>
          <div class="sb-right">
            <button class="btn" type="button" @click="exportExcel">导出Excel</button>
            <button class="btn" type="button" @click="downloadPng">下载</button>
            <button class="btn primary" type="button" @click="openSave">保存图表</button>
          </div>
        </div>

        <div class="cb-chart-card" :class="['legend-' + state.legendPos, { 'legend-column': state.legendStyle === 'column' }]">
          <div v-if="state.titleShow" class="chart-title" :class="'align-' + state.titleAlign">
            <h3 contenteditable spellcheck="false" :style="titleTextStyle" @blur="state.title = ($event.target.textContent || '').trim() || '未命名图表'">{{ state.title }}</h3>
            <div v-if="state.remarkOn && state.remark && state.remarkPos !== 'chartTop'" class="chart-remark">{{ state.remark }}</div>
            <div v-if="state.divider" class="chart-divider" :style="{ borderTopColor: state.dividerColor, borderTopWidth: (state.dividerWidth || 1) + 'px' }"></div>
          </div>
          <div v-if="state.remarkOn && state.remark && state.remarkPos === 'chartTop'" class="chart-remark">{{ state.remark }}</div>
          <div class="chart-plot-wrap">
            <div
              v-if="state.legendShow && legendSeries.length && (state.legendPos === 'left' || state.legendPos === 'top' || !state.legendPos)"
              class="chart-legend"
              :class="['align-' + (state.legendAlign === 'flex-end' ? 'right' : state.legendAlign === 'flex-start' ? 'left' : 'center'), { vertical: state.legendPos === 'left' || state.legendStyle === 'column' }]"
              :style="legendTextStyle"
            >
              <span v-for="s in legendSeries" :key="s.name" class="lg-item" :style="{ color: s.color }">
                <span class="lg-line"></span>
                <span class="lg-name">{{ s.alias || s.name }}</span>
              </span>
            </div>
            <div ref="chartHost" class="chart-body">
              <G2Chart v-if="canPaint" :spec="spec" />
              <div v-else class="chart-empty">{{ isCrossScatter(state.type) ? '请分别选择 X / Y 轴指标' : '请打开手工配置，在「字段」中点击「选择指标」添加' }}</div>
              <div
                v-if="isPie(state.type) && state.pieStyle === 'donut' && state.pieTotalShow && state.series.length"
                class="pie-total-layer"
              >
                <div class="pie-total-name" :style="{ color: state.pieTotalNameColor, fontSize: state.pieTotalNameSize + 'px', fontWeight: state.pieTotalNameBold ? 700 : 400, fontStyle: state.pieTotalNameItalic ? 'italic' : 'normal' }">{{ state.pieTotalName || '总计' }}</div>
                <div class="pie-total-value" :style="{ color: state.pieTotalValueColor, fontSize: state.pieTotalValueSize + 'px', fontWeight: state.pieTotalValueBold ? 700 : 400, fontStyle: state.pieTotalValueItalic ? 'italic' : 'normal' }">{{ pieTotalValue.toLocaleString('en-US') }}</div>
              </div>
            </div>
            <div
              v-if="state.legendShow && legendSeries.length && (state.legendPos === 'bottom' || state.legendPos === 'right')"
              class="chart-legend"
              :class="['align-' + (state.legendAlign === 'flex-end' ? 'right' : state.legendAlign === 'flex-start' ? 'left' : 'center'), { vertical: state.legendPos === 'right' || state.legendStyle === 'column' }]"
              :style="legendTextStyle"
            >
              <span v-for="s in legendSeries" :key="s.name" class="lg-item" :style="{ color: s.color }">
                <span class="lg-line"></span>
                <span class="lg-name">{{ s.alias || s.name }}</span>
              </span>
            </div>
          </div>
          <div v-if="state.footnoteOn && state.footnote" class="chart-footnote">{{ state.footnote }}</div>
        </div>

        <div v-if="state.tableShow !== false" class="table-card" :class="{ open: infoOpen }">
          <div class="table-head" @click="infoOpen = !infoOpen">
            <span class="th-arrow"><Icon name="chevron-right" :size="10" /></span>
            指标信息 <span class="th-hint">图表内指标的基本信息</span>
          </div>
          <div class="table-body">
            <table class="d-table">
              <thead><tr><th>指标</th><th>单位</th><th>频度</th><th>来源</th></tr></thead>
              <tbody>
                <tr v-if="!state.series.length"><td colspan="4" style="color:#86909C">暂无指标</td></tr>
                <tr v-for="s in state.series" :key="s.name">
                  <td>{{ s.alias || s.name }}</td>
                  <td>{{ s.unit || state.unit || '—' }}</td>
                  <td>{{ s.freq || '—' }}</td>
                  <td>{{ s.source || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <aside v-if="!isPreview" class="ai-panel" :class="{ collapsed: configMode !== 'ai' }">
        <div class="ai-top">
          <div class="ai-brand"><span class="ai-logo"><Icon name="sparkle" :size="14" /></span>可视化助手</div>
          <button type="button" class="ai-icon-btn" title="新对话" @click="aiMsgs = []"><Icon name="plus" :size="15" /></button>
        </div>
        <div class="ai-scroll">
          <div class="ai-hello">
            <h3>您好，欢迎使用可视化助手</h3>
            <p>用自然语言配置图表类型、标题、图例、线条、配色等参数，修改会即时反映到中间预览。</p>
          </div>
          <div class="ai-block-title">当前图表可用系列</div>
          <div class="ai-ds-box">
            <span v-if="!state.series.length" class="ai-ds-chip">尚未选择指标</span>
            <span v-for="s in state.series" :key="s.name" class="ai-ds-chip">{{ s.alias || s.name }}</span>
          </div>
          <div class="ai-rec-label">针对当前图表，为您推荐如下配置：</div>
          <button type="button" class="ai-rec" @click="applyAi('改成柱图')">改成柱图，突出对比关系</button>
          <button type="button" class="ai-rec" @click="applyAi('标题改为 PVC 基差走势')">标题改为「PVC 基差走势」</button>
          <button type="button" class="ai-rec" @click="applyAi('图例放到下方并居中')">把图例放到下方并居中</button>
          <button type="button" class="ai-rec" @click="applyAi('配色换成暖阳')">配色换成暖阳方案</button>
          <button type="button" class="ai-rec" @click="applyAi('设置预警线 4500')">设置预警线 4500</button>
          <div class="ai-msgs">
            <div v-for="(m, i) in aiMsgs" :key="i" class="ai-msg" :class="m.role">{{ m.text }}</div>
          </div>
        </div>
        <div class="ai-composer-wrap">
          <div class="ai-composer">
            <div class="ai-ctx">
              <span class="ctx-label">已选数据</span>
              <span class="ctx-chip">{{ state.series.length ? `当前图表 · ${state.series.length} 个指标` : '当前图表' }}</span>
            </div>
            <textarea v-model="aiInput" placeholder="请输入您的问题，向我提问吧" rows="2" @keydown.enter.prevent="applyAi(aiInput)" />
            <div class="ai-composer-tools">
              <button type="button" class="ai-send" @click="applyAi(aiInput)"><Icon name="send" :size="15" /></button>
            </div>
          </div>
        </div>
      </aside>

      <aside v-if="!isPreview" class="manual-panel" :class="{ collapsed: configMode !== 'manual' || manualCollapsed }">
        <button class="panel-toggle" title="收起手工配置" @click="manualCollapsed = !manualCollapsed">
          <Icon name="chevron-right-2" :size="10" />
        </button>
        <div class="mp-head">
          <h2>手工配置</h2>
          <button type="button" class="ai-icon-btn" title="隐藏手工配置" @click="manualCollapsed = true">
            <Icon name="close" :size="14" />
          </button>
        </div>
        <div class="mp-body">
          <div class="ct-row">
            <span class="ct-label">切换图表</span>
            <div class="ct-select" :class="{ open: typeOpen }">
              <button class="ct-trigger" type="button" @click.stop="typeOpen = !typeOpen">
                <Icon :name="currentType.icon" :size="14" />
                <span>{{ currentType.name }}</span>
                <span class="ct-chev"><Icon name="chevron-down" :size="11" /></span>
              </button>
              <div v-if="typeOpen" class="ct-panel">
                <template v-for="g in groupedTypes" :key="g.group">
                  <div class="ct-g-name">{{ g.group }}</div>
                  <div class="ct-grid">
                    <button v-for="t in g.items" :key="t.id" type="button" class="ct-item" :class="{ active: state.type === t.id }" @click="setType(t.id)">
                      <Icon :name="t.icon" :size="18" />
                      {{ t.name }}
                    </button>
                  </div>
                </template>
                <div class="ct-tip">已支持 15 种图形，更多类型持续接入</div>
              </div>
            </div>
          </div>
          <div class="cfg-tabs">
            <button class="cfg-tab" :class="{ active: cfgTab === 'fields' }" @click="cfgTab = 'fields'">字段</button>
            <button class="cfg-tab" :class="{ active: cfgTab === 'style' }" @click="cfgTab = 'style'">样式</button>
            <button class="cfg-tab" :class="{ active: cfgTab === 'analysis' }" @click="cfgTab = 'analysis'">分析</button>
          </div>

          <div v-show="cfgTab === 'fields'" class="cfg-body">
            <div v-if="!hideDimChip" class="fld-block">
              <div class="fld-block-head">维度 <span class="fb-tag">X 轴</span></div>
              <DimChip :state="state" />
            </div>
            <div v-if="isSeasonal(state.type)" class="fld-block">
              <div class="fld-block-head">季节性时间范围</div>
              <div class="season-range-row">
                <input class="cfg-input" v-model="seasonStart" maxlength="5">
                <span>至</span>
                <input class="cfg-input" v-model="seasonEnd" maxlength="5">
              </div>
            </div>
            <div v-if="isCrossScatter(state.type)" class="fld-block cross-block">
              <div class="fld-block-head">截面散点 <span class="fb-tag">X / Y</span></div>
              <div class="cross-axis">
                <div class="cross-axis-h">X 轴 <span class="tag">指标</span></div>
                <div class="cross-ind" :class="{ filled: !!crossXName }" @click="openPick('x')">
                  <span class="ci-name">{{ crossXName || '点击选择 X 轴指标' }}</span>
                  <button type="button" class="ci-act" @click.stop="openPick('x')">选择</button>
                </div>
                <div class="cross-time">
                  <div class="cross-time-row">
                    <label><input type="radio" value="latest" v-model="state.cross.x.mode">最新时间</label>
                    <label><input type="radio" value="ago" v-model="state.cross.x.mode">N前</label>
                    <input class="cfg-input sm" type="number" min="1" max="120" v-model.number="state.cross.x.ago" :disabled="state.cross.x.mode !== 'ago'" title="期数">
                    <label><input type="radio" value="fixed" v-model="state.cross.x.mode">固定日期</label>
                    <input class="cfg-input" type="month" v-model="state.cross.x.fixed" :min="rawLabels[0]" :max="rawLabels.at(-1)" :disabled="state.cross.x.mode !== 'fixed'">
                  </div>
                  <div v-if="crossXHint" class="cross-time-hint">{{ crossXHint }}</div>
                </div>
              </div>
              <div class="cross-axis">
                <div class="cross-axis-h">Y 轴 <span class="tag">指标</span></div>
                <div class="cross-ind" :class="{ filled: !!crossYName }" @click="openPick('y')">
                  <span class="ci-name">{{ crossYName || '点击选择 Y 轴指标' }}</span>
                  <button type="button" class="ci-act" @click.stop="openPick('y')">选择</button>
                </div>
                <div class="cross-time">
                  <div class="cross-time-row">
                    <label><input type="radio" value="latest" v-model="state.cross.y.mode">最新时间</label>
                    <label><input type="radio" value="ago" v-model="state.cross.y.mode">N前</label>
                    <input class="cfg-input sm" type="number" min="1" max="120" v-model.number="state.cross.y.ago" :disabled="state.cross.y.mode !== 'ago'" title="期数">
                    <label><input type="radio" value="fixed" v-model="state.cross.y.mode">固定日期</label>
                    <input class="cfg-input" type="month" v-model="state.cross.y.fixed" :min="rawLabels[0]" :max="rawLabels.at(-1)" :disabled="state.cross.y.mode !== 'fixed'">
                  </div>
                  <div v-if="crossYHint" class="cross-time-hint">{{ crossYHint }}</div>
                </div>
              </div>
            </div>
            <div v-else-if="isCombo" class="fld-block">
              <div class="fld-block-head">主轴指标 <span class="fb-count">已添加 <b>{{ leftSeries.length }}</b></span></div>
              <FieldItem
                v-for="x in leftSeries"
                :key="x.s.name"
                :series="x.s"
                :index="x.i"
                :show-axis="false"
                combo
                @remove="removeSeries"
                @configure="openFcfg"
                @color="onFieldColor"
                @mark="onFieldMark"
                @fmt="onFieldFmt"
                @null="onFieldNull"
                @sort="onFieldSort"
              />
              <button class="fld-add-entry" type="button" @click="openPick('left')"><Icon name="plus-12" :size="12" /> 选择指标</button>
              <div class="fld-block-head" style="margin-top:14px">副轴指标 <span class="fb-count">已添加 <b>{{ rightSeries.length }}</b></span></div>
              <FieldItem
                v-for="x in rightSeries"
                :key="x.s.name"
                :series="x.s"
                :index="x.i"
                :show-axis="false"
                combo
                @remove="removeSeries"
                @configure="openFcfg"
                @color="onFieldColor"
                @mark="onFieldMark"
                @fmt="onFieldFmt"
                @null="onFieldNull"
                @sort="onFieldSort"
              />
              <button class="fld-add-entry" type="button" @click="openPick('right')"><Icon name="plus-12" :size="12" /> 选择指标</button>
            </div>
            <div v-else class="fld-block">
              <div class="fld-block-head">
                {{ isPie(state.type) ? '扇区' : '指标' }} <span class="fb-tag">系列</span>
                <span class="fb-count">已添加 <b>{{ state.series.length }}</b> / {{ MAX_IND }}</span>
              </div>
              <FieldItem
                v-for="(s, i) in state.series"
                :key="s.name"
                :series="s"
                :index="i"
                :show-axis="!isPie(state.type)"
                @remove="removeSeries"
                @configure="openFcfg"
                @color="onFieldColor"
                @mark="onFieldMark"
                @fmt="onFieldFmt"
                @null="onFieldNull"
                @sort="onFieldSort"
              />
              <button class="fld-add-entry" type="button" @click="openPick('left')">
                <Icon name="plus-12" :size="12" /> {{ isPie(state.type) ? '选择扇区' : '选择指标' }}
              </button>
            </div>
            <div
              v-if="usesCrossSectionTime(state.type)"
              class="fld-block cross-block"
            >
              <div class="fld-block-head">截面时间 <span class="fb-tag">取值时点</span></div>
              <CrossSectionTime v-model="state.crossBar" :labels="rawLabels" />
            </div>
          </div>

          <div v-show="cfgTab === 'style'" class="cfg-body">
            <BuilderStylePanel :state="state" :palettes="PALETTES" @palette="applyPalette" />
          </div>

          <div v-show="cfgTab === 'analysis'" class="cfg-body">
            <div class="sec open">
              <div class="sec-head"><span class="s-name">分析预警</span></div>
              <div class="sec-body">
                <div class="warn-row">
                  <span>标识线</span>
                  <span>
                    <span v-if="state.analysis.markLine" class="warn-on">已开启</span>
                  </span>
                </div>
                <div class="cfg-row"><span class="r-label">数值</span><input class="cfg-input" v-model="state.analysis.markLine" placeholder="例如 4500"></div>
                <div class="warn-row"><span>趋势线</span><span style="font-size:12px;color:#86909C">规划中</span></div>
              </div>
            </div>
            <div class="sec open">
              <div class="sec-head"><span class="s-name">标注</span></div>
              <div class="sec-body">
                <button type="button" class="anno-add" @click="Message.info('点击图表数据点添加标注（演示）')">添加标注</button>
              </div>
            </div>
          </div>

          <div v-if="pickOpen" class="fld-ind-overlay">
            <div class="fld-ind-head">
              <button type="button" class="fld-ind-back" @click="pickOpen = false"><Icon name="chevron-left-12" :size="12" /> 返回</button>
              <span class="fld-ind-title">{{ isPie(state.type) ? '选择扇区' : '选择指标' }}</span>
              <span class="fb-count">已选 <b>{{ state.series.length }}</b> / {{ MAX_IND }}</span>
            </div>
            <div class="ip-search-row">
              <div class="ip-search">
                <Icon name="search" :size="13" />
                <input v-model="pickKw" placeholder="搜索 / 过滤指标名称" autocomplete="off">
              </div>
              <label class="ip-exact">精准匹配 <a-switch v-model="pickExact" size="small" /></label>
            </div>
            <div class="ip-list">
              <div v-if="!groupedPick.length" class="ip-empty">未找到匹配的指标</div>
              <div v-for="g in groupedPick" :key="g.g" class="ip-group">
                <div class="g-name">{{ g.g }}</div>
                <div
                  v-for="c in g.items"
                  :key="c.id"
                  class="ip-item"
                  :class="{ added: state.series.some(s => s.name === c.title) }"
                  @click="addSeries(c)"
                >
                  <span class="ip-name">{{ c.title }}</span>
                  <span v-if="state.series.some(s => s.name === c.title)" class="tick">✓</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="fcfgOpen && fcfgSeries" class="fcfg-overlay">
            <div class="fcfg-head">
              <button type="button" class="fcfg-back" title="返回字段设置" @click="closeFcfg"><Icon name="chevron-left-12" :size="12" /></button>
              <span class="fcfg-title">字段配置 - {{ fcfgSeries.alias || fcfgSeries.name }}</span>
            </div>
            <div class="fcfg-body">
              <div class="fcfg-row">
                <span class="r-label">图表内名称</span>
                <input class="fcfg-inp" v-model="fcfgSeries.alias" maxlength="30" placeholder="请输入">
              </div>
              <div class="fcfg-row">
                <span class="r-label">描述</span>
                <input class="fcfg-inp" v-model="fcfgSeries.desc" maxlength="80" placeholder="请输入">
              </div>
              <div class="fcfg-row">
                <span class="r-label">数据条件</span>
                <button type="button" class="fcfg-linkrow" :class="{ 'is-on': seriesCondText(fcfgSeries) !== '未设置' }" @click="dcOpen = true">
                  <span class="lk-name">{{ seriesCondText(fcfgSeries) }}</span>
                  <span class="lk-caret"><Icon name="chevron-right" :size="10" /></span>
                </button>
              </div>
              <div class="fcfg-row">
                <span class="r-label">格式化</span>
                <button type="button" class="fcfg-linkrow" @click="fmtIdx = fcfgIdx; fmtOpen = true">
                  <span class="lk-name">{{ seriesFmtText(fcfgSeries) }}</span>
                  <span class="lk-caret"><Icon name="chevron-right" :size="10" /></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <DataCondDialog v-model:visible="dcOpen" :series="fcfgSeries" :all-series="state.series" @ok="onCondOk" />
    <FieldFmtDialog v-model:visible="fmtOpen" :fmt="fmtSeries?.fmt" @ok="onFmtOk" />

    <a-modal v-model:visible="saveVisible" title="保存到图库" :width="480" @ok="confirmSave">
      <div class="cfg-row"><span class="r-label" style="width:72px">图库名称</span><a-input v-model="saveForm.title" :max-length="80" placeholder="请输入图库名称" /></div>
      <div class="cfg-row" style="margin-top:14px"><span class="r-label" style="width:72px">保存路径</span>
        <DirPathPicker v-model="saveForm.dir" :tree="gallery.dirs" placeholder="请选择目录" />
      </div>
    </a-modal>
  </div>
</template>
