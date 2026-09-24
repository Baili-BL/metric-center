<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useIndicatorStore } from '../../stores/indicators'
import Icon from '../../components/Icon.vue'
import AppModal from '../../components/AppModal.vue'
import CalcIndicatorDialog from './CalcIndicatorDialog.vue'
import {
  copyMonthlyTsv,
  DV_MONTHS,
  dvDailyRows,
  freqLabel,
  lineageOf,
  paintLineChart,
  paintSeasonChart,
} from './detail-utils'

const DATE_PRESETS = [
  { id: 'custom', name: '自定义' },
  { id: 'recent5y', name: '最近5年' },
  { id: 'history', name: '历史至今' },
  { id: 'past5y', name: '过去5年' },
  { id: 'recent1y', name: '最近一年' },
  { id: 'recent6m', name: '最近6个月' },
]

function monthToDay(ym, end = false) {
  if (!ym) return ''
  if (String(ym).length >= 10) return String(ym).slice(0, 10)
  const [y, m] = String(ym).split('-').map(Number)
  if (end) {
    const last = new Date(y, m, 0).getDate()
    return `${ym}-${String(last).padStart(2, '0')}`
  }
  return `${ym}-01`
}

function rangeOfPreset(id, current = {}) {
  const last = DV_MONTHS[DV_MONTHS.length - 1]
  const first = DV_MONTHS[0]
  const [ly, lm] = last.split('-').map(Number)
  const shift = (yOff, mOff = 0) => {
    const d = new Date(ly, lm - 1 + mOff, 1)
    d.setFullYear(d.getFullYear() + yOff)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  let from = first
  let to = last
  let mode = 'range'
  let years = 0
  if (id === 'history') { from = first }
  else if (id === 'recent5y') { mode = 'recent'; years = 5; from = shift(-5) }
  else if (id === 'past5y') { from = shift(-10); to = shift(-5) }
  else if (id === 'recent1y') { mode = 'recent'; years = 1; from = shift(-1) }
  else if (id === 'recent6m') { from = shift(0, -6) }
  else {
    from = (current.from || '').slice(0, 7) || shift(-5)
    to = (current.to || '').slice(0, 7) || last
  }
  return { mode, years, from: monthToDay(from), to: monthToDay(to, true) }
}

const store = useIndicatorStore()
const detail = computed(() => store.get(store.detailId))
const listKw = ref('')
const tab = ref('走势图')
const seasonOn = ref(false)
const seasonMode = ref('gregorian')
const yoyOn = ref(false)
const moreOpen = ref(false)
const loading = ref(false)
const refreshN = ref(0)
const dataCollapsed = ref(true)
const forkOpen = ref(true)
const chartEl = ref(null)
const datePreset = ref('history')
const presetOpen = ref(false)
const timeRange = reactive(rangeOfPreset('history'))
const editVisible = ref(false)
const latestVisible = ref(false)
const lineageVisible = ref(false)
const formulaVisible = ref(false)
const editForm = reactive({ title: '', unit: '' })
const latestForm = reactive({ date: '', val: '', curDate: '—', curVal: '—' })
const legend = ref([])
const tip = reactive({ show: false, text: '', x: 0, y: 0, below: false })

let chart = null
let ro = null
let paintTimer = 0

const list = computed(() => {
  const q = listKw.value.trim().toLowerCase()
  return store.cards.filter((c) => {
    if (!q) return true
    return c.title.toLowerCase().includes(q) || String(c.id).toLowerCase().includes(q)
  })
})
const isCalc = computed(() => detail.value?.kind === 'calc')
const presetLabel = computed(() => DATE_PRESETS.find((p) => p.id === datePreset.value)?.name || '自定义')
const rangeValue = computed(() => (timeRange.from && timeRange.to ? [timeRange.from, timeRange.to] : []))
const dailyRows = computed(() => (detail.value ? dvDailyRows(detail.value.title) : []))
const dailyNewestFirst = computed(() => dailyRows.value.slice().reverse())
const nowStamp = () => {
  const n = new Date()
  const p = (x) => String(x).padStart(2, '0')
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())} ${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`
}
const lineage = computed(() => lineageOf(detail.value, store.cards))

function resetView() {
  tab.value = '走势图'
  seasonOn.value = false
  seasonMode.value = 'gregorian'
  yoyOn.value = false
  moreOpen.value = false
  dataCollapsed.value = true
  listKw.value = ''
  legend.value = []
  datePreset.value = 'history'
  Object.assign(timeRange, rangeOfPreset('history'))
}

function close() {
  destroyChart()
  store.detailId = ''
}

function pick(c) {
  if (!c) return
  store.detailId = c.id
}

function destroyChart() {
  chart?.destroy?.()
  chart = null
  if (chartEl.value) chartEl.value.innerHTML = ''
}

async function paint() {
  if (!detail.value || tab.value !== '走势图' || !chartEl.value) return
  destroyChart()
  await nextTick()
  for (let i = 0; i < 20; i++) {
    if (chartEl.value.clientWidth > 80) break
    await new Promise((r) => requestAnimationFrame(r))
  }
  if (chartEl.value.clientWidth < 80) return
  const title = detail.value.title
  const unit = detail.value.unit
  const painted = seasonOn.value
    ? paintSeasonChart(chartEl.value, title, timeRange, seasonMode.value, unit, refreshN.value)
    : paintLineChart(chartEl.value, title, timeRange, yoyOn.value, unit, refreshN.value)
  chart = painted.chart
  legend.value = painted.legend
}
function schedulePaint() {
  clearTimeout(paintTimer)
  paintTimer = window.setTimeout(() => { paint() }, 80)
}

function toggleYoy() {
  if (seasonOn.value) return
  yoyOn.value = !yoyOn.value
  paint()
}

function toggleSeason() {
  seasonOn.value = !seasonOn.value
  if (seasonOn.value) yoyOn.value = false
  Message.success(seasonOn.value ? '已切换为季节性图（按年切分叠加）' : '已切换为曲线图')
  paint()
}

function setSeasonMode(mode) {
  if (!seasonOn.value || seasonMode.value === mode) return
  seasonMode.value = mode
  Message.success(mode === 'cny' ? '已按春节日历对齐' : '已按公历对齐')
  paint()
}

function toggleState() {
  if (!detail.value) return
  store.toggle(detail.value.id)
  Message.success(`已${detail.value.state === '停用' ? '停用' : '启用'}指标：${detail.value.title}`)
}

function refresh() {
  if (!detail.value) return
  loading.value = true
  refreshN.value += 1
  setTimeout(() => {
    if (tab.value === '数据详情') {
      loading.value = false
      Message.success('数据详情已刷新')
    } else {
      paint()
      loading.value = false
      Message.success(seasonOn.value ? '季节性图已刷新' : '走势图已刷新')
    }
  }, 420)
}

function applyPreset(id) {
  datePreset.value = id
  presetOpen.value = false
  Object.assign(timeRange, rangeOfPreset(id, timeRange))
  if (tab.value === '走势图') paint()
}

function onRangeChange(v) {
  datePreset.value = 'custom'
  Object.assign(timeRange, { mode: 'range', years: 0, from: v?.[0] || '', to: v?.[1] || '' })
  if (tab.value === '走势图') paint()
}

function openEdit() {
  moreOpen.value = false
  if (!detail.value) return
  Object.assign(editForm, { title: detail.value.title, unit: detail.value.unit || '' })
  editVisible.value = true
}

function confirmEdit() {
  const name = editForm.title.trim()
  if (!name) return Message.error('请填写指标名称')
  if (name !== detail.value.title && store.cards.some((c) => c.title === name && c.id !== detail.value.id)) {
    return Message.error('已存在同名指标')
  }
  store.updateInfo(detail.value.id, { title: name, unit: editForm.unit.trim() })
  editVisible.value = false
  Message.success('已保存编辑信息')
  if (tab.value === '走势图') paint()
}

function openLatest() {
  moreOpen.value = false
  if (!detail.value) return
  const last = dailyRows.value[dailyRows.value.length - 1]
  latestForm.date = ''
  latestForm.val = ''
  latestForm.curDate = detail.value.latestDate || last?.date || '—'
  latestForm.curVal = detail.value.latest ?? last?.val ?? '—'
  latestVisible.value = true
}

function confirmLatest() {
  if (!latestForm.date) return Message.error('请选择预测日期')
  if (latestForm.val === '' || Number.isNaN(Number(latestForm.val))) return Message.error('请输入有效的预测值')
  store.addLatest(detail.value.id, latestForm.date, Number(latestForm.val))
  latestVisible.value = false
  Message.success(`已保存最新值：${latestForm.date} / ${latestForm.val}`)
}

function copyData() {
  moreOpen.value = false
  if (!detail.value) return
  const text = copyMonthlyTsv(detail.value.title, refreshN.value)
  const done = () => Message.success(`已复制 ${text.split('\n').length - 1} 期数据，可直接粘贴到 Excel`)
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, done)
  else done()
}

function openFormula() {
  moreOpen.value = false
  if (!isCalc.value) return Message.info('原始指标没有计算公式')
  formulaVisible.value = true
}

function openLineage() {
  moreOpen.value = false
  if (!isCalc.value) return Message.info('原始指标无需溯源')
  forkOpen.value = true
  lineageVisible.value = true
}

function relatedToast() {
  moreOpen.value = false
  Message.info(`关联指标 ${lineage.value.leaves.length} 个（演示）`)
}

function recalc() {
  moreOpen.value = false
  Message.success('已触发重新计算（演示）')
}

function onNodeEnter(e, text) {
  const r = e.currentTarget.getBoundingClientRect()
  tip.text = text
  tip.show = true
  nextTick(() => {
    const tw = 180
    const th = 48
    let left = r.left + r.width / 2 - tw / 2
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8))
    let top = r.top - th - 10
    tip.below = top < 8
    if (tip.below) top = r.bottom + 10
    tip.x = Math.round(left)
    tip.y = Math.round(top)
  })
}

function onDocClick(e) {
  if (!e.target.closest?.('.dv-more')) moreOpen.value = false
  if (!e.target.closest?.('.df-preset')) presetOpen.value = false
}

watch(() => store.detailId, (id, prev) => {
  if (!id) {
    destroyChart()
    ro?.disconnect()
    ro = null
    return
  }
  if (!prev) resetView()
  nextTick(() => {
    bindResize()
    paint()
  })
})

watch(tab, (t) => {
  if (t === '走势图') nextTick(paint)
  else destroyChart()
})

function bindResize() {
  ro?.disconnect()
  if (!chartEl.value || typeof ResizeObserver === 'undefined') return
  let last = 0
  ro = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect?.width || 0
    if (w < 80 || Math.abs(w - last) < 2) return
    last = w
    schedulePaint()
  })
  ro.observe(chartEl.value)
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  if (detail.value) {
    resetView()
    nextTick(() => {
      bindResize()
      paint()
    })
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  clearTimeout(paintTimer)
  ro?.disconnect()
  destroyChart()
  store.detailId = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="detail" class="detail-view show">
      <div class="dv-left">
        <div class="dv-back" @click="close">‹ 返回指标列表</div>
        <div class="dv-search">
          <Icon name="search" :size="13" />
          <input v-model="listKw" placeholder="搜索指标 / 指标ID" autocomplete="off">
        </div>
        <div class="dv-list">
          <div v-if="!list.length" class="dv-list-empty">未找到匹配的指标</div>
          <div
            v-for="c in list"
            :key="c.id"
            class="dv-item"
            :class="{ active: c.id === detail.id }"
            :title="`${c.id}　${c.title}`"
            @click="pick(c)"
          >{{ c.title }}</div>
        </div>
      </div>

      <div class="dv-main">
        <div class="dv-head" :class="{ 'is-detail': tab === '数据详情' }">
          <div class="dv-tabs">
            <span class="dv-tab" :class="{ active: tab === '走势图' }" @click="tab = '走势图'">走势图</span>
            <span class="dv-tab" :class="{ active: tab === '数据详情' }" @click="tab = '数据详情'">数据详情</span>
          </div>
          <div class="dv-chart-tools">
            <div class="date-filter-wrap dv-date-filter">
              <div class="df-preset">
                <button type="button" class="df-preset-btn" :class="{ open: presetOpen }" @click.stop="presetOpen = !presetOpen">
                  <span>{{ presetLabel }}</span>
                  <Icon name="chevron-down-fill" :size="12" />
                </button>
                <div v-if="presetOpen" class="df-preset-menu">
                  <button
                    v-for="p in DATE_PRESETS"
                    :key="p.id"
                    type="button"
                    :class="{ active: datePreset === p.id }"
                    @click="applyPreset(p.id)"
                  >{{ p.name }}</button>
                </div>
              </div>
              <div class="df-range">
                <a-range-picker
                  size="small"
                  style="width: 240px"
                  value-format="YYYY-MM-DD"
                  popup-container="body"
                  :model-value="rangeValue"
                  @change="onRangeChange"
                />
              </div>
            </div>
            <div class="dv-chart-switch">
              <button
                type="button"
                class="btn"
                :class="{ active: yoyOn, 'is-disabled': seasonOn }"
                :disabled="seasonOn"
                :title="seasonOn ? '季节性图下不可展示同比' : ''"
                @click="toggleYoy"
              >{{ yoyOn ? '隐藏同比图' : '展示同比图' }}</button>
              <button type="button" class="btn" :class="{ active: seasonOn }" @click="toggleSeason">
                {{ seasonOn ? '切换曲线图' : '切换季节性图' }}
              </button>
            </div>
          </div>
          <div class="dv-actions">
            <button
              type="button"
              class="ic-ico dv-state-ico"
              :class="detail.state === '停用' ? 'is-off' : 'is-on'"
              :title="detail.state === '停用' ? '启用' : '停用'"
              :data-tip="detail.state === '停用' ? '启用' : '停用'"
              @click="toggleState"
            >
              <Icon :name="detail.state === '停用' ? 'unlock' : 'lock'" :size="18" />
            </button>
            <button class="dv-act" type="button" @click="refresh">刷新</button>
            <div class="dv-more">
              <button class="dv-act" type="button" @click.stop="moreOpen = !moreOpen">更多操作 ▾</button>
              <div class="dv-menu" :class="{ show: moreOpen }">
                <button type="button" @click="openEdit">编辑信息</button>
                <button v-if="isCalc" type="button" @click="recalc">重新计算</button>
                <button type="button" @click="copyData">复制数据</button>
                <button v-if="isCalc" type="button" @click="openFormula">查看公式</button>
                <button type="button" @click="openLatest">添加最新值</button>
                <button v-if="isCalc" type="button" @click="openLineage">指标溯源</button>
                <button v-if="isCalc" type="button" @click="relatedToast">关联指标</button>
              </div>
            </div>
          </div>
        </div>

        <div v-show="tab === '走势图'" class="dv-chart-wrap">
          <div class="dv-chart-card">
            <div class="dv-chart-loading" :class="{ show: loading }">
              <div class="load-box"><div class="load-spin"></div><span>图表刷新中…</span></div>
            </div>
            <div class="dv-legend">
              <span v-for="it in legend" :key="it.name" class="lg-item" :title="it.name">
                <span v-if="it.dash" class="lg-line is-dash"></span>
                <span v-else class="lg-line" :style="{ background: it.color }"></span>
                <span class="lg-name">{{ it.name }}</span>
              </span>
            </div>
            <div ref="chartEl" class="dv-chart-host"></div>
            <div class="dv-season-modes" :class="{ show: seasonOn }">
              <button type="button" :class="{ active: seasonMode === 'gregorian' }" @click="setSeasonMode('gregorian')">公历</button>
              <button type="button" :class="{ active: seasonMode === 'cny' }" @click="setSeasonMode('cny')">春节对齐</button>
            </div>
            <div class="dv-foot">
              <span>数据来源：{{ detail.source }}</span>
              <span>添加人：{{ detail.creator || '陈为昌' }}</span>
            </div>
          </div>
        </div>

        <div v-show="tab === '数据详情'" class="dv-detail show">
          <div class="dv-cat-card">
            <div class="dv-cat-head">基本信息</div>
            <div class="dv-cat-body">
              <table class="dv-info-grid-table">
                <tr><th>指标ID</th><td>{{ detail.id }}</td></tr>
                <tr><th>指标名称</th><td>{{ detail.title }}</td></tr>
                <tr><th>指标目录</th><td>{{ detail.dir }}</td></tr>
                <tr><th>频度</th><td>{{ freqLabel(detail.freq) }}</td></tr>
                <tr><th>单位</th><td>{{ detail.unit }}</td></tr>
              </table>
            </div>
          </div>
          <div class="dv-cat-card">
            <div class="dv-cat-head">来源与计算</div>
            <div class="dv-cat-body">
              <table class="dv-info-grid-table">
                <tr><th>数据来源</th><td>{{ detail.source }}</td></tr>
                <tr><th>计算类型</th><td>{{ detail.calcType || '原始指标' }}</td></tr>
                <tr><th>起始时间</th><td>{{ dailyRows[0]?.date || '—' }}</td></tr>
                <tr><th>更新时间</th><td>{{ nowStamp() }}</td></tr>
                <tr><th>添加人</th><td>{{ detail.creator || '陈为昌' }}</td></tr>
              </table>
            </div>
          </div>
          <div class="dv-cat-card" :class="{ 'dv-cat-collapsed': dataCollapsed }">
            <div class="dv-cat-head dv-cat-toggle" @click="dataCollapsed = !dataCollapsed">
              数据明细
              <span class="dv-cat-count">共 {{ dailyRows.length }} 条</span>
              <svg class="i dv-cat-arrow" width="12" height="12" aria-hidden="true"><use href="#i-chevron-down"></use></svg>
            </div>
            <div class="dv-cat-body dv-cat-scroll">
              <table class="dv-detail-table">
                <tbody>
                  <tr v-for="(r, i) in dailyNewestFirst" :key="r.date">
                    <td>
                      <span v-if="i === 0" class="dv-dot"></span>
                      <span v-else style="display:inline-block;width:12px"></span>
                      {{ r.date }}
                    </td>
                    <td class="num">{{ r.val }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <AppModal :visible="editVisible" title="编辑信息" icon="edit-fill" :width="520" @update:visible="(v) => { editVisible = v }">
        <div class="ei-form">
          <div class="ei-row">
            <label>指标名称:</label>
            <input type="text" v-model="editForm.title" placeholder="请输入指标名称" autocomplete="off">
          </div>
          <div class="ei-row">
            <label>单位:</label>
            <input type="text" v-model="editForm.unit" placeholder="请输入单位" autocomplete="off">
          </div>
        </div>
        <template #footer>
          <button type="button" class="btn primary" style="min-width:88px" @click="confirmEdit">确定</button>
          <button type="button" class="btn" style="min-width:88px" @click="editVisible = false">取消</button>
        </template>
      </AppModal>

      <AppModal :visible="latestVisible" title="添加最新值" icon="g-968fa17e" :width="560" @update:visible="(v) => { latestVisible = v }">
        <div class="lv-grid">
          <div class="lv-field"><label>指标名称</label><div class="lv-val">{{ detail.title }}</div></div>
          <div class="lv-field"><label>频度</label><div class="lv-val">{{ freqLabel(detail.freq) }}</div></div>
          <div class="lv-field"><label>最新日期</label><div class="lv-val muted">{{ latestForm.curDate }}</div></div>
          <div class="lv-field"><label>最新值</label><div class="lv-val muted">{{ latestForm.curVal }}</div></div>
          <div class="lv-field"><label>预测日期</label><input type="date" v-model="latestForm.date"></div>
          <div class="lv-field"><label>预测值</label><input type="text" v-model="latestForm.val" placeholder="请输入值" inputmode="decimal" autocomplete="off"></div>
        </div>
        <template #footer>
          <button type="button" class="btn primary" style="min-width:88px" @click="confirmLatest">保存</button>
          <button type="button" class="btn tint" style="min-width:88px" @click="latestVisible = false">取消</button>
        </template>
      </AppModal>

      <CalcIndicatorDialog v-model:visible="formulaVisible" :view-only="true" :seed-title="detail?.title || ''" />

      <AppModal :visible="lineageVisible" title="指标溯源" icon="g-74345ca2" flush :width="960" :height="720" @update:visible="(v) => { lineageVisible = v }">
        <div class="lineage-body">
          <div class="lg-canvas">
            <div class="lg-tree">
              <div class="lg-title">{{ lineage.root }}</div>
              <div class="lg-level">
                <div class="lg-node root" @mouseenter="onNodeEnter($event, lineage.formulaRoot)" @mouseleave="tip.show = false">{{ lineage.root }}</div>
              </div>
              <div class="lg-vstem"></div>
              <div v-if="lineage.mid" class="lg-level">
                <div
                  class="lg-node link"
                  @mouseenter="onNodeEnter($event, lineage.formulaMid)"
                  @mouseleave="tip.show = false"
                  @click="Message.info('查看指标：' + lineage.mid + '（演示）')"
                >{{ lineage.mid }}</div>
              </div>
              <button v-if="lineage.mid" type="button" class="lg-toggle" title="展开/收起" @click="forkOpen = !forkOpen">{{ forkOpen ? '−' : '+' }}</button>
              <div v-show="forkOpen" class="lg-fork">
                <div class="lg-hbar-wrap"><div class="lg-hbar"></div></div>
                <div class="lg-leaves">
                  <div v-for="leaf in lineage.leaves" :key="leaf.name" class="lg-leaf-col">
                    <div class="lg-vstem"></div>
                    <div class="lg-node leaf link" @mouseenter="onNodeEnter($event, leaf.source)" @mouseleave="tip.show = false">{{ leaf.name }}</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="lg-mini" aria-hidden="true">
              <div class="lg-mini-inner">
                <div class="m-node root"></div>
                <div class="m-node" style="width:40px"></div>
                <div class="m-row">
                  <div v-for="leaf in lineage.leaves" :key="'m-' + leaf.name" class="m-node"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppModal>
      <div class="lg-tip" :class="{ show: tip.show, below: tip.below }" :style="{ left: tip.x + 'px', top: tip.y + 'px' }" v-html="tip.text.replace(/\n/g, '<br>')"></div>
    </div>
  </Teleport>
</template>
