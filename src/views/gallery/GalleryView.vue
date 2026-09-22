<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import ExcelJS from 'exceljs'
import { useGalleryStore } from '../../stores/gallery'
import { CHART_TYPES, CT_GROUP_ORDER, isBarFamily, isPie, isScatter, mergeBuilderState, toPaintSpec, typeName } from '../../charts/types'
import DirTree from '../../components/DirTree.vue'
import FilterBar from '../../components/FilterBar.vue'
import G2Chart from '../../components/G2Chart.vue'
import Icon from '../../components/Icon.vue'
import AppModal from '../../components/AppModal.vue'
import DirPathPicker from '../../components/DirPathPicker.vue'
import ChartBuilder from '../builder/ChartBuilder.vue'
import { hashStr } from '../../utils/hash'

const store = useGalleryStore()
const info = ref(null)
const dirModal = reactive({ visible: false, mode: 'add', parent: '', name: '' })
const delModal = reactive({ visible: false, kind: '', title: '', msg: '', id: '', path: '' })
const batchModal = reactive({ visible: false, dir: '', ids: [] })
const batchList = ref([])
const drawerId = ref('')
const menuId = ref('')
const menuPos = reactive({ left: '0px', top: '0px' })
const filterOpen = ref('')
const dateDraft = reactive({ from: '', to: '' })

const total = computed(() => store.filtered.length)
const menuChart = computed(() => store.getChart(menuId.value))
const groupedTypes = computed(() => CT_GROUP_ORDER.map((g) => ({
  group: g,
  items: CHART_TYPES.filter((t) => t.group === g),
})))
const dateLabel = computed(() => {
  const f = store.filters
  if (f.dateFrom || f.dateTo) {
    const a = f.dateFrom ? f.dateFrom.slice(5).replace('-', '/') : '…'
    const b = f.dateTo ? f.dateTo.slice(5).replace('-', '/') : '…'
    return `${a} ~ ${b}`
  }
  return '创建时间'
})
const typeLabel = computed(() => (store.filters.chartType ? typeName(store.filters.chartType) : '图类型'))
const creatorLabel = computed(() => store.filters.creator || '创建人')

function toggleFilter(id) {
  if (filterOpen.value === id) {
    filterOpen.value = ''
    return
  }
  if (id === 'date') {
    dateDraft.from = store.filters.dateFrom
    dateDraft.to = store.filters.dateTo
  }
  filterOpen.value = id
}
function fmtDate(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function quickDays(n) {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - (n - 1))
  dateDraft.from = fmtDate(from)
  dateDraft.to = fmtDate(to)
}
function applyDate() {
  let from = dateDraft.from || ''
  let to = dateDraft.to || ''
  if (from && to && from > to) { const tmp = from; from = to; to = tmp }
  store.filters.dateFrom = from
  store.filters.dateTo = to
  store.page = 1
  filterOpen.value = ''
}
function resetDate() {
  dateDraft.from = ''
  dateDraft.to = ''
  store.filters.dateFrom = ''
  store.filters.dateTo = ''
  store.page = 1
  filterOpen.value = ''
}
function setType(id) {
  store.filters.chartType = id
  store.page = 1
  filterOpen.value = ''
}
function setCreator(name) {
  store.filters.creator = name
  store.page = 1
  filterOpen.value = ''
}

function specOf(c) {
  const st = mergeBuilderState(c.builderState || {}, { title: c.title, series: c.builderState?.series || [] })
  if (!st.type) st.type = c.type || 'line'
  if (!st.unit) st.unit = c.unit || ''
  return { ...toPaintSpec(st, st.series || [], store.LABELS), customLegend: true, tooltipShow: true }
}
function isFav(c) {
  return c.inMine != null ? !!c.inMine : !!c.mine
}
function legendOf(c) {
  const series = c.builderState?.series || []
  return series.map((s) => ({
    name: s.alias || s.name,
    color: s.color,
    kind: s.kind || '',
  }))
}
function legendMark(c, s, i) {
  const t = c.builderState?.type || c.type
  if (t === 'combo') return (s.kind === 'line' || (s.kind !== 'bar' && i === 0)) ? 'line' : 'square'
  if (isPie(t) || isBarFamily(t)) return 'square'
  if (isScatter(t)) return 'dot'
  return 'line'
}
function chartIndicators(c) {
  const series = c?.builderState?.series || []
  const seen = new Set()
  return series.map((s) => {
    const name = s.alias || s.name || '未命名指标'
    const raw = /^(ID|IND)\d+/i.test(s.indId || s.code || s.id || '') ? (s.indId || s.code || s.id) : ''
    const id = raw || `ID${10000000 + (hashStr(name) % 90000000)}`
    return { name, id }
  }).filter((x) => {
    if (seen.has(x.id)) return false
    seen.add(x.id)
    return true
  })
}
function openNew() {
  drawerId.value = ''
  store.drawerOpen = true
}
function openEdit(c) {
  closeMenu()
  drawerId.value = c.id
  store.editingId = c.id
  store.drawerOpen = true
}
function isFavOn(c) {
  return isFav(c)
}
function toggleFav(c) {
  if (!c) return
  const next = store.toggleFav(c.id)
  closeMenu()
  Message.success(isFav(next || c) ? `已添加收藏「${c.title}」` : `已取消收藏「${c.title}」`)
}
function closeMenu() {
  menuId.value = ''
}
function toggleMenu(e, c) {
  e.stopPropagation()
  if (menuId.value === c.id) {
    closeMenu()
    return
  }
  const r = e.currentTarget.getBoundingClientRect()
  menuId.value = c.id
  const mw = 126
  const mh = 240
  let left = r.left - 10
  let top = r.bottom + 2
  if (left < 8) left = 8
  if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8
  if (top + mh > window.innerHeight - 8) top = r.top - mh - 4
  if (top < 8) top = 8
  menuPos.left = `${Math.round(left)}px`
  menuPos.top = `${Math.round(top)}px`
}
function openInfo(c) {
  info.value = c
  closeMenu()
}
async function downloadXlsx(c) {
  closeMenu()
  const series = c.builderState?.series || []
  if (!series.length) return Message.warning('没有可导出的数据')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('图表数据')
  ws.addRow(['日期', ...series.map((s) => s.alias || s.name)])
  store.LABELS.forEach((lab, i) => {
    ws.addRow([lab, ...series.map((s) => s.values?.[i] ?? '')])
  })
  const buf = await wb.xlsx.writeBuffer()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  a.download = `${c.title || 'chart'}.xlsx`
  a.click()
  Message.success('已导出 Excel')
}
function downloadPng(c) {
  closeMenu()
  const card = document.querySelector(`.gal-grid .chart-card[data-id="${c.id}"]`)
  const canvas = card?.querySelector('canvas')
  if (!canvas) return Message.warning('请等待预览加载完成')
  canvas.toBlob((blob) => {
    if (!blob) return Message.error('导出失败')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${c.title || 'chart'}.png`
    a.click()
    Message.success('已下载图片')
  }, 'image/png')
}
function onDocClick(e) {
  closeMenu()
  if (e.target.closest?.('.gi-date, .arco-picker-container, .arco-trigger-popup, .arco-panel-date, .arco-picker-dropdown')) return
  filterOpen.value = ''
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
const dirParentLabel = computed(() => {
  if (dirModal.mode === 'edit') {
    const parts = dirModal.parent.split('/').filter(Boolean)
    return parts.length > 1 ? parts.slice(0, -1).join('/') : '根目录（一级目录）'
  }
  return dirModal.parent || '根目录（一级目录）'
})

function confirmDir() {
  const name = dirModal.name.trim()
  if (!name) return Message.error('请填写目录名称')
  if (/[/\\]/.test(name)) return Message.error('目录名称不能包含斜杠')
  const r = dirModal.mode === 'edit'
    ? store.renameDir(dirModal.parent, name)
    : store.addDir(dirModal.parent, name)
  if (!r.ok) return Message.error(r.msg)
  if (dirModal.mode !== 'edit' && r.path) {
    store.currentDir = r.path
    store.page = 1
  }
  Message.success(dirModal.mode === 'edit' ? '目录已保存' : `已添加目录：${name}`)
  dirModal.visible = false
}
function onAdd(path) {
  dirModal.mode = path ? 'child' : 'add'
  dirModal.parent = path || ''
  dirModal.name = ''
  dirModal.visible = true
}
function chartDirShort(path) {
  const parts = (path || '').split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : '未分类'
}
function onEdit(path) {
  dirModal.mode = 'edit'
  dirModal.parent = path
  dirModal.name = path.split('/').pop()
  dirModal.visible = true
}
function onRemove(path) {
  const label = path.split('/').pop()
  const cnt = store.dirCount(path)
  delModal.kind = 'dir'
  delModal.path = path
  delModal.id = ''
  delModal.title = '删除目录'
  delModal.msg = cnt > 0
    ? `目录「${label}」下仍有 ${cnt} 张图表，删除后其子目录结构将一并移除。确认删除该目录？`
    : `确认删除目录「${label}」？删除后不可恢复。`
  delModal.visible = true
}
function delChart(c) {
  closeMenu()
  if (!c) return
  let nm = c.title || c.id
  if (nm.length > 22) nm = `${nm.slice(0, 22)}…`
  delModal.kind = 'chart'
  delModal.id = c.id
  delModal.path = ''
  delModal.title = '删除图表'
  delModal.msg = `确认删除图表「${nm}」？删除后不可恢复。`
  delModal.visible = true
}
function confirmDel() {
  if (delModal.kind === 'dir') {
    const label = delModal.path.split('/').pop()
    store.removeDir(delModal.path)
    if (store.currentDir === delModal.path || store.currentDir.startsWith(`${delModal.path}/`)) store.currentDir = ''
    Message.success(`已删除目录：${label}`)
  } else if (delModal.kind === 'chart') {
    store.removeChart(delModal.id)
    Message.success('已删除图表')
  } else if (delModal.kind === 'batch') {
    batchModal.ids.forEach((id) => store.removeChart(id))
    batchModal.ids = []
    Message.success('已删除')
  }
  delModal.visible = false
}
function openBatch() {
  const rows = store.filtered
  if (!rows.length) return Message.warning('当前目录暂无图表可移动')
  batchList.value = rows.map((c) => ({ id: c.id, title: c.title, dir: c.dir || '' }))
  batchModal.ids = batchList.value.map((c) => c.id)
  batchModal.dir = ''
  batchModal.visible = true
}
function toggleBatchId(id, on) {
  if (on) {
    if (!batchModal.ids.includes(id)) batchModal.ids.push(id)
  } else {
    batchModal.ids = batchModal.ids.filter((x) => x !== id)
  }
}
function toggleBatchAll() {
  if (batchModal.ids.length === batchList.value.length) batchModal.ids = []
  else batchModal.ids = batchList.value.map((c) => c.id)
}
function doBatchMove() {
  if (!batchModal.dir) return Message.warning('请选择目标目录')
  if (!batchModal.ids.length) return Message.warning('请勾选要移动的图表')
  store.moveCharts(batchModal.ids, batchModal.dir)
  store.currentDir = batchModal.dir
  store.page = 1
  batchModal.visible = false
  Message.success(`已移动 ${batchModal.ids.length} 张图表`)
}
function onDropItem(payload, path) {
  if (!path) return Message.warning('请拖到具体目录')
  const hit = payload.item || store.getChart(payload.id)
  if (!hit) return
  if (hit.dir === path) return Message.info(`「${hit.title}」已在该目录`)
  store.moveCharts([hit.id], path)
  store.selectDir(path)
  store.selectItem(hit.id)
  Message.success(`已移动「${hit.title}」到「${path.split('/').join(' / ')}」`)
}
function onDropDir(fromPath, targetPath) {
  const r = store.moveDir(fromPath, targetPath)
  if (!r || r.skipped) return
  if (!r.ok) return Message.warning(r.msg)
  if (r.path) store.selectDir(r.path)
  if (r.msg) Message.success(r.msg)
}
</script>

<template>
  <aside class="dir-panel">
    <div class="dir-head">
      <h2>目录</h2>
      <label class="only-mine"><a-checkbox v-model="store.filters.onlyMine">只看我的</a-checkbox></label>
    </div>
    <FilterBar v-model="store.filters" placeholder="请输入图表名称/ID" :show-mine="false" :show-date="false" />
    <DirTree
      :tree="store.dirs"
      :current="store.currentDir"
      :current-item="store.currentItem"
      :count-of="store.dirCount"
      :leaves-of="store.itemsInDir"
      :movable-dirs="true"
      :movable-items="true"
      @select="(p) => store.selectDir(p)"
      @select-item="(item) => store.selectItem(item.id)"
      @add="onAdd"
      @edit="onEdit"
      @remove="onRemove"
      @drop-dir="onDropDir"
      @drop-item="onDropItem"
    />
    <div class="dir-foot">
      <a-button long @click="onAdd(store.currentDir)">
        <template #icon><Icon name="plus-14" :size="13" /></template>
        {{ store.currentDir ? '添加子目录' : '添加一级目录' }}
      </a-button>
      <a-button long @click="openBatch">
        <template #icon><Icon name="swap" :size="13" /></template>
        批量移动图表
      </a-button>
    </div>
  </aside>

  <section class="gallery-panel">
    <div class="gal-head">
      <span class="gal-count">共 <b>{{ total }}</b> 张图表</span>
      <div class="gi-search">
        <Icon name="search" :size="13" />
        <input v-model="store.filters.nameKw" placeholder="搜索图表名称" autocomplete="off" @input="store.page = 1">
      </div>
      <div class="gal-filters">
        <div class="gi-date" :class="{ open: filterOpen === 'date' }">
          <button type="button" class="gi-date-btn" :class="{ on: !!(store.filters.dateFrom || store.filters.dateTo) }" @click.stop="toggleFilter('date')">
            <Icon name="calendar" :size="13" />
            <span>{{ dateLabel }}</span>
            <Icon name="chevron-down" :size="10" />
          </button>
          <div v-if="filterOpen === 'date'" class="gi-date-pop show" @click.stop>
            <div class="gdp-row">
              <label>开始日期</label>
              <a-date-picker
                v-model="dateDraft.from"
                value-format="YYYY-MM-DD"
                placeholder="年 / 月 / 日"
                size="small"
                allow-clear
              />
            </div>
            <div class="gdp-row">
              <label>结束日期</label>
              <a-date-picker
                v-model="dateDraft.to"
                value-format="YYYY-MM-DD"
                placeholder="年 / 月 / 日"
                size="small"
                allow-clear
              />
            </div>
            <div class="gdp-quick">
              <button type="button" @click="quickDays(7)">近7天</button>
              <button type="button" @click="quickDays(30)">近30天</button>
              <button type="button" @click="quickDays(90)">近90天</button>
            </div>
            <div class="gdp-actions">
              <button type="button" class="btn tint" @click="resetDate">重置</button>
              <button type="button" class="btn primary" @click="applyDate">确定</button>
            </div>
          </div>
        </div>
        <div class="gi-date" :class="{ open: filterOpen === 'type' }">
          <button type="button" class="gi-date-btn" :class="{ on: !!store.filters.chartType }" @click.stop="toggleFilter('type')">
            <Icon name="filter" :size="13" />
            <span>{{ typeLabel }}</span>
            <Icon name="chevron-down" :size="10" />
          </button>
          <div v-if="filterOpen === 'type'" class="gi-type-pop show" @click.stop>
            <button type="button" class="gi-type-item" :class="{ on: !store.filters.chartType }" @click="setType('')">全部类型</button>
            <template v-for="g in groupedTypes" :key="g.group">
              <div class="gi-type-group">{{ g.group }}</div>
              <button
                v-for="t in g.items"
                :key="t.id"
                type="button"
                class="gi-type-item"
                :class="{ on: store.filters.chartType === t.id }"
                @click="setType(t.id)"
              >{{ t.name }}</button>
            </template>
          </div>
        </div>
        <div class="gi-date" :class="{ open: filterOpen === 'creator' }">
          <button type="button" class="gi-date-btn" :class="{ on: !!store.filters.creator }" @click.stop="toggleFilter('creator')">
            <svg class="i" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="6" r="2.4" stroke="currentColor" stroke-width="1.3"/>
              <path d="M3.6 13c.6-2.2 2.2-3.4 4.4-3.4s3.8 1.2 4.4 3.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            <span>{{ creatorLabel }}</span>
            <Icon name="chevron-down" :size="10" />
          </button>
          <div v-if="filterOpen === 'creator'" class="gi-type-pop show" @click.stop>
            <button type="button" class="gi-type-item" :class="{ on: !store.filters.creator }" @click="setCreator('')">全部创建人</button>
            <button
              v-for="name in store.creators"
              :key="name"
              type="button"
              class="gi-type-item"
              :class="{ on: store.filters.creator === name }"
              @click="setCreator(name)"
            >{{ name }}</button>
          </div>
        </div>
      </div>
      <div class="view-toggle">
        <button type="button" class="vt-btn" :class="{ active: store.viewMode === 'card' }" data-tip="图形视图" aria-label="图形视图" @click="store.viewMode = 'card'">
          <Icon name="g-19a52e64" :size="14" />
        </button>
        <button type="button" class="vt-btn" :class="{ active: store.viewMode === 'list' }" data-tip="列表视图" aria-label="列表视图" @click="store.viewMode = 'list'">
          <Icon name="g-54277c6f" :size="14" />
        </button>
      </div>
      <button type="button" class="btn-add-chart" @click="openNew">
        <Icon name="g-1840980a" :size="14" />
        添加图表
      </button>
    </div>

    <div class="gal-scroll">
    <div v-if="!store.paged.length" class="gal-empty">暂无匹配图表<br>可调整目录、图类型、创建人、创建时间或搜索条件</div>

    <div v-else-if="store.viewMode === 'card'" class="gal-grid">
      <article
        v-for="c in store.paged"
        :key="c.id"
        class="chart-card"
        :class="{ 'menu-open': menuId === c.id }"
        :data-id="c.id"
        @click="openEdit(c)"
      >
        <div class="cc-head">
          <div class="cc-name">{{ c.title }}</div>
          <div class="cc-head-acts" @click.stop>
            <button type="button" class="cc-fav" :class="{ on: isFavOn(c) }" :aria-label="isFavOn(c) ? '取消收藏' : '添加收藏'" @click="toggleFav(c)">
              <Icon name="star" :size="16" />
              <span class="cc-fav-tip">{{ isFavOn(c) ? '取消收藏' : '添加收藏' }}</span>
            </button>
            <button type="button" class="cc-more" :class="{ open: menuId === c.id }" aria-label="更多" @click="toggleMenu($event, c)">
              <Icon name="more" :size="14" />
            </button>
          </div>
        </div>
        <div v-if="legendOf(c).length" class="cc-mini-legend">
          <span v-for="(s, i) in legendOf(c)" :key="s.name" class="mlg-item">
            <span v-if="legendMark(c, s, i) === 'line'" class="mlg-line" :style="{ background: s.color }"></span>
            <span v-else-if="legendMark(c, s, i) === 'square'" class="mlg-sq" :style="{ background: s.color }"></span>
            <span v-else class="mlg-dot" :style="{ background: s.color }"></span>
            <span class="mlg-name">{{ s.name }}</span>
          </span>
        </div>
        <div class="cc-preview">
          <G2Chart :spec="specOf(c)" fill />
        </div>
      </article>
    </div>

    <div v-else class="gal-grid as-list">
      <table class="list-table">
        <thead>
          <tr>
            <th>图表名称</th><th>图表ID</th><th>类型</th><th>所属目录</th><th>创建人</th><th>修改人</th><th>创建时间</th><th>收藏</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in store.paged" :key="c.id" :data-id="c.id" @click="openEdit(c)">
            <td>{{ c.title }}</td>
            <td>{{ c.id }}</td>
            <td>{{ typeName(c.builderState?.type || c.type) }}</td>
            <td>{{ c.dir || '—' }}</td>
            <td>{{ c.creator || '—' }}</td>
            <td>{{ c.updater || '—' }}</td>
            <td>{{ c.date || '—' }}</td>
            <td><span :class="isFavOn(c) ? 'state-on' : 'state-off'">{{ isFavOn(c) ? '已收藏' : '未收藏' }}</span></td>
            <td>
              <div class="lt-ops" @click.stop>
                <button type="button" class="ic-ico" title="打开图表" @click="openEdit(c)"><Icon name="preview" :size="16" /></button>
                <button type="button" class="ic-ico" title="查看图表信息" @click="openInfo(c)"><Icon name="info-fill" :size="16" /></button>
                <button type="button" class="ic-ico" :class="{ on: isFavOn(c) }" :title="isFavOn(c) ? '取消收藏' : '收藏'" @click="toggleFav(c)"><Icon name="star" :size="16" /></button>
                <button type="button" class="ic-ico" title="删除" @click="delChart(c)"><Icon name="trash" :size="16" /></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    </div>

    <div class="gal-pager">
      <a-pagination :current="store.page" :total="total" :page-size="store.pageSize" size="small" @change="(p) => store.page = p" />
    </div>
  </section>

  <Teleport to="body">
    <div v-if="store.drawerOpen" class="builder-drawer-root open is-ready">
      <div class="builder-drawer" role="dialog" aria-modal="true" aria-label="新建图表">
        <ChartBuilder :chart-id="drawerId" mode="drawer" @saved="store.drawerOpen = false" @close="store.drawerOpen = false" />
      </div>
    </div>
  </Teleport>

  <AppModal
    :visible="dirModal.visible"
    :title="dirModal.mode === 'edit' ? '编辑' : '添加'"
    :icon="dirModal.mode === 'edit' ? 'edit-fill' : 'plus-16'"
    :width="480"
    @update:visible="(v) => { dirModal.visible = v }"
  >
    <div class="df-form">
      <template v-if="dirModal.mode === 'edit'">
        <div class="df-row"><label>目录名称</label><input v-model="dirModal.name" placeholder="必填项" autocomplete="off" autofocus></div>
        <div class="df-row"><label>上级目录</label>
          <a-select :model-value="dirParentLabel" disabled popup-container="body">
            <a-option :value="dirParentLabel">{{ dirParentLabel }}</a-option>
          </a-select>
        </div>
        <div class="df-note">注：只能移动到同一层级的分类</div>
      </template>
      <template v-else>
        <div class="df-row"><label>上级目录</label><div class="df-val">{{ dirParentLabel }}</div></div>
        <div class="df-row"><label>目录名称</label><input v-model="dirModal.name" placeholder="必填项" autocomplete="off" autofocus></div>
      </template>
    </div>
    <template #footer>
      <button type="button" class="btn primary" style="min-width:88px" @click="confirmDir">保存</button>
      <button type="button" class="btn tint" style="min-width:88px" @click="dirModal.visible = false">取消</button>
    </template>
  </AppModal>

  <AppModal
    :visible="batchModal.visible"
    title="批量移动图表"
    icon="swap-16"
    overflow-visible
    :width="600"
    @update:visible="(v) => { batchModal.visible = v }"
  >
    <div class="bm-toolbar">
      <div style="font-size:13px;color:var(--text-2)">来源目录：<b>{{ store.currentDir ? store.currentDir.split('/').filter(Boolean).join(' / ') : '全部图表' }}</b></div>
      <span class="bm-summary">已选 {{ batchModal.ids.length }} / {{ batchList.length }}</span>
      <button type="button" class="btn" style="height:30px;padding:0 12px;font-size:12px" @click="toggleBatchAll">
        {{ batchModal.ids.length === batchList.length && batchList.length ? '取消全选' : '全选' }}
      </button>
    </div>
    <div class="bm-list">
      <label v-for="c in batchList" :key="c.id" class="bm-row">
        <input type="checkbox" :checked="batchModal.ids.includes(c.id)" @change="toggleBatchId(c.id, $event.target.checked)">
        <span class="bm-name">{{ c.title }}</span>
        <span class="bm-dir" :title="c.dir">{{ chartDirShort(c.dir) }}</span>
      </label>
    </div>
    <div class="bm-select">
      <label>移动到</label>
      <DirPathPicker v-model="batchModal.dir" :tree="store.dirs" placeholder="请选择目标目录" />
    </div>
    <template #footer>
      <span class="foot-left">支持将卡片拖到目录树，也可用此面板批量移动</span>
      <button type="button" class="btn primary" @click="doBatchMove">确认移动</button>
      <button type="button" class="btn tint" @click="batchModal.visible = false">取消</button>
    </template>
  </AppModal>

  <AppModal
    :visible="delModal.visible"
    :title="delModal.title"
    icon="trash"
    danger
    :width="440"
    @update:visible="(v) => { delModal.visible = v }"
  >
    <div class="del-msg">{{ delModal.msg }}</div>
    <template #footer>
      <button type="button" class="btn danger" style="min-width:88px" @click="confirmDel">删除</button>
      <button type="button" class="btn tint" style="min-width:88px" @click="delModal.visible = false">取消</button>
    </template>
  </AppModal>

  <Teleport to="body">
    <ul v-if="menuId && menuChart" class="cc-card-menu show" :style="menuPos" role="menu" @click.stop>
      <li role="none"><button type="button" class="ccm-item" @click="openEdit(menuChart)">编辑</button></li>
      <li role="none"><button type="button" class="ccm-item" @click="openInfo(menuChart)">查看图表信息</button></li>
      <li class="ccm-sep" aria-hidden="true"></li>
      <li role="none"><button type="button" class="ccm-item" @click="toggleFav(menuChart)">{{ isFavOn(menuChart) ? '取消收藏' : '收藏' }}</button></li>
      <li class="ccm-sep" aria-hidden="true"></li>
      <li role="none"><button type="button" class="ccm-item" @click="downloadXlsx(menuChart)">下载Excel</button></li>
      <li role="none"><button type="button" class="ccm-item" @click="downloadPng(menuChart)">下载图片</button></li>
      <li class="ccm-sep" aria-hidden="true"></li>
      <li role="none"><button type="button" class="ccm-item" @click="delChart(menuChart); closeMenu()">删除</button></li>
    </ul>
  </Teleport>

  <AppModal :visible="!!info" title="图表信息" icon="info-fill" :width="520" @update:visible="(v) => { if (!v) info = null }">
    <div v-if="info" class="ci-panel">
      <section class="ci-sec">
        <div class="ci-sec-h">基本信息</div>
        <div class="ci-row">
          <span class="ci-k">名称</span>
          <span class="ci-v ci-ellipsis" :title="info.title">{{ info.title }}</span>
          <span class="ci-k">图表ID</span>
          <span class="ci-v ci-ellipsis" :title="info.id">{{ info.id }}</span>
        </div>
      </section>
      <section class="ci-sec">
        <div class="ci-sec-h">创建</div>
        <div class="ci-row ci-row-2">
          <span class="ci-k">创建人</span><span class="ci-v">{{ info.creator || '—' }}</span>
          <span class="ci-k">创建时间</span><span class="ci-v">{{ info.date || '—' }}</span>
        </div>
      </section>
      <section class="ci-sec">
        <div class="ci-sec-h">修改</div>
        <div class="ci-row ci-row-2">
          <span class="ci-k">修改人</span><span class="ci-v">{{ info.updater || '—' }}</span>
          <span class="ci-k">修改时间</span><span class="ci-v">{{ info.updated || info.date || '—' }}</span>
        </div>
      </section>
      <section class="ci-sec">
        <div class="ci-sec-h">指标</div>
        <div class="ci-inds">
          <table>
            <colgroup><col class="ci-col-name"><col class="ci-col-id"></colgroup>
            <thead><tr><th>指标名称</th><th>指标ID</th></tr></thead>
            <tbody>
              <tr v-if="!chartIndicators(info).length"><td colspan="2" style="color:var(--text-3)">暂无指标</td></tr>
              <tr v-for="x in chartIndicators(info)" :key="x.id">
                <td class="ci-name"><span class="ci-ellipsis" :title="x.name">{{ x.name }}</span></td>
                <td class="ci-id">{{ x.id }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
    <template #footer>
      <button type="button" class="btn primary" style="min-width:88px" @click="info = null">关闭</button>
    </template>
  </AppModal>
</template>
