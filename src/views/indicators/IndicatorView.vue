<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useIndicatorStore } from '../../stores/indicators'
import { parentPathOf } from '../../utils/dir'
import IndicatorDirTree from '../../components/IndicatorDirTree.vue'
import IndicatorDetail from './IndicatorDetail.vue'
import G2Chart from '../../components/G2Chart.vue'
import Icon from '../../components/Icon.vue'
import AppModal from '../../components/AppModal.vue'
import DirPathPicker from '../../components/DirPathPicker.vue'
import CalcIndicatorDialog from './CalcIndicatorDialog.vue'
import AddIndicatorDialog from './AddIndicatorDialog.vue'
import CodeIndicatorDialog from './CodeIndicatorDialog.vue'
import IndPicker from './IndPicker.vue'

const store = useIndicatorStore()
const dirCollapsed = ref(false)
const dirModal = reactive({ visible: false, mode: 'add', parent: '', name: '' })
const moveModal = reactive({ visible: false, kind: 'dir', from: '', title: '', dest: '' })
const delModal = reactive({ visible: false, kind: '', title: '', msg: '', path: '', id: '' })
const addVisible = ref(false)
const calcVisible = ref(false)
const codeVisible = ref(false)
const replaceVisible = ref(false)
const batchModal = reactive({ visible: false, dir: '', ids: [] })
const batchList = ref([])
const replace = reactive({ from: '', to: '', exactFrom: false, exactTo: false })
const filterOpen = ref('')
const dateDraft = reactive({ from: '', to: '' })
const creatorLabel = computed(() => store.filters.creator || '全部创建人')

const total = computed(() => store.kindCounts.total)
const names = computed(() => store.cards.map((c) => c.title))
const dateLabel = computed(() => {
  const f = store.filters
  if (f.dateFrom || f.dateTo) {
    const a = f.dateFrom ? f.dateFrom.slice(5).replace('-', '/') : '…'
    const b = f.dateTo ? f.dateTo.slice(5).replace('-', '/') : '…'
    return `${a} ~ ${b}`
  }
  return '数据日期'
})
const dirParentLabel = computed(() => {
  if (dirModal.mode === 'edit') {
    const parts = dirModal.parent.split('/').filter(Boolean)
    return parts.length > 1 ? parts.slice(0, -1).join('/') : '根目录（一级目录）'
  }
  return dirModal.parent || '根目录（一级目录）'
})

function specOf(c) {
  return {
    type: 'sparkArea',
    spark: true,
    series: [{ name: c.title, color: '#0016ED', values: c.values || [] }],
    labels: store.LABELS,
    unit: c.unit,
  }
}
function sparkTick(i) {
  const labs = store.LABELS
  const lab = labs[i] || ''
  const [y, m] = String(lab).split('-')
  return y && m ? `${String(y).slice(-2)}/${m}` : ''
}
const sparkTicks = computed(() => {
  const n = store.LABELS.length
  const mid = Math.max(0, Math.floor((n - 1) / 2))
  return [sparkTick(0), sparkTick(mid), sparkTick(n - 1)]
})
function dirShort(path) {
  const parts = (path || '').split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : '未分类'
}
function onAdd(path) {
  Object.assign(dirModal, { visible: true, mode: path ? 'child' : 'add', parent: path || '', name: '' })
}
function onFooterAdd() { onAdd(store.currentDir || '') }
function onEdit(path) {
  Object.assign(dirModal, { visible: true, mode: 'edit', parent: path, name: path.split('/').pop() })
}
function onMove(payload) {
  if (payload?.kind === 'item') {
    const item = payload.item
    const title = item?.title || payload.title || ''
    if (!title) return
    Object.assign(moveModal, {
      visible: true, kind: 'item', from: title, title, dest: item?.dir || '',
    })
    return
  }
  const path = payload?.path || payload?.key || ''
  if (!path) return
  Object.assign(moveModal, {
    visible: true, kind: 'dir', from: path, title: payload.title || path.split('/').pop(), dest: parentPathOf(path),
  })
}
function confirmMove() {
  if (moveModal.kind === 'dir') {
    const r = store.moveDir(moveModal.from, moveModal.dest || '')
    if (!r || r.skipped) { moveModal.visible = false; return }
    if (!r.ok) return Message.error(r.msg)
    moveModal.visible = false
    Message.success(r.msg || '目录已移动')
    return
  }
  if (!moveModal.dest) return Message.warning('请选择目标目录')
  const r = store.moveItem(moveModal.from, moveModal.dest)
  if (!r.ok) return Message.warning(r.msg)
  moveModal.visible = false
  Message.success(r.msg || `已移动「${moveModal.title}」到「${moveModal.dest.split('/').join(' / ')}」`)
}
function onRemoveDir(path) {
  const label = path.split('/').pop()
  const cnt = store.dirCount(path)
  Object.assign(delModal, {
    visible: true, kind: 'dir', path, id: '', title: '删除目录',
    msg: cnt > 0
      ? `目录「${label}」下仍有 ${cnt} 个指标，删除后其子目录结构将一并移除。确认删除该目录？`
      : `确认删除目录「${label}」？删除后不可恢复。`,
  })
}
function onRemoveItem(title) {
  Object.assign(delModal, {
    visible: true, kind: 'item', path: '', id: title, title: '删除指标',
    msg: `确认删除指标「${title}」？删除后不可恢复。`,
  })
}
function confirmDel() {
  if (delModal.kind === 'dir') {
    const r = store.removeDir(delModal.path)
    if (!r.ok) return Message.error(r.msg)
    Message.success(`已删除目录：${delModal.path.split('/').pop()}`)
  } else {
    store.remove(delModal.id)
    Message.success('已删除')
  }
  delModal.visible = false
}
function confirmDir() {
  const name = dirModal.name.trim()
  if (!name) return Message.error('请填写目录名称')
  if (/[/\\]/.test(name)) return Message.error('目录名称不能包含斜杠')
  const r = dirModal.mode === 'edit'
    ? store.renameDir(dirModal.parent, name)
    : store.addDir(dirModal.parent, name)
  if (!r.ok) return Message.error(r.msg)
  dirModal.visible = false
  Message.success(dirModal.mode === 'edit' ? '目录已保存' : `已添加目录：${name}`)
}
function onExactChange(e) {
  store.filters.exact = e.target.checked
  store.page = 1
  Message.info(e.target.checked ? '已开启精准匹配：仅完全匹配指标ID/名称' : '已关闭精准匹配：支持模糊搜索')
}
function toggleFilter(name) {
  if (name === 'date' && filterOpen.value !== 'date') {
    dateDraft.from = store.filters.dateFrom
    dateDraft.to = store.filters.dateTo
  }
  filterOpen.value = filterOpen.value === name ? '' : name
}
function setCreator(name) {
  store.filters.creator = name
  store.page = 1
  filterOpen.value = ''
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
function openBatch() {
  const rows = store.filtered
  if (!rows.length) return Message.warning('当前目录暂无指标可移动')
  batchList.value = rows.map((c) => ({ id: c.id, title: c.title, dir: c.dir || '' }))
  batchModal.ids = batchList.value.map((c) => c.id)
  batchModal.dir = ''
  batchModal.visible = true
}
function toggleBatchId(id, on) {
  if (on) { if (!batchModal.ids.includes(id)) batchModal.ids.push(id) }
  else batchModal.ids = batchModal.ids.filter((x) => x !== id)
}
function toggleBatchAll() {
  batchModal.ids = batchModal.ids.length === batchList.value.length ? [] : batchList.value.map((c) => c.id)
}
function doBatchMove() {
  if (!batchModal.dir) return Message.warning('请选择目标目录')
  if (!batchModal.ids.length) return Message.warning('请勾选要移动的指标')
  store.moveTo(batchModal.ids, batchModal.dir)
  store.currentDir = batchModal.dir
  store.page = 1
  batchModal.visible = false
  Message.success(`已移动 ${batchModal.ids.length} 个指标`)
}
function doReplace() {
  if (!replace.from || !replace.to) return Message.warning('请先选择原指标和替换指标')
  if (replace.from === replace.to) return Message.warning('原指标与替换指标不能相同')
  store.replaceRef(replace.from, replace.to)
  replaceVisible.value = false
  Message.success('已替换引用')
}
function openReplace() {
  replace.from = ''
  replace.to = ''
  replace.exactFrom = false
  replace.exactTo = false
  replaceVisible.value = true
}
function onDocClick(e) {
  if (e.target.closest?.('.gi-date, .arco-picker-container, .arco-trigger-popup, .arco-panel-date, .arco-picker-dropdown')) return
  filterOpen.value = ''
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div class="ind-page">
    <aside class="dir-panel ic-dir-panel" :class="{ collapsed: dirCollapsed }">
      <div class="dir-head">
        <h2>目录</h2>
        <label class="only-mine"><input type="checkbox" v-model="store.filters.onlyMine">只看我的</label>
      </div>
      <div class="dir-search">
        <div class="ds-input">
          <Icon name="search" :size="13" />
          <input v-model="store.filters.kw" placeholder="指标ID/指标名称" autocomplete="off" @input="store.page = 1">
        </div>
        <label class="exact">精准匹配
          <span class="switch">
            <input type="checkbox" :checked="store.filters.exact" @change="onExactChange">
            <span class="sl"></span>
          </span>
        </label>
      </div>
      <IndicatorDirTree @add="onAdd" @edit="onEdit" @remove="onRemoveDir" @remove-item="onRemoveItem" @move="onMove" />
      <div class="dir-foot">
        <button type="button" @click="onFooterAdd">
          <Icon name="plus-14" :size="13" />
          {{ store.currentDir ? '添加子目录' : '添加一级目录' }}
        </button>
        <button type="button" @click="openBatch">
          <Icon name="swap" :size="13" />
          批量移动指标
        </button>
      </div>
      <button class="dir-toggle" title="收起 / 展开目录" @click="dirCollapsed = !dirCollapsed">
        <Icon name="chevrons-left" :size="12" />
      </button>
    </aside>

    <section class="main-panel">
      <div class="grid-head">
        <span class="gal-count">
          共 <b>{{ total }}</b> 个指标（
          <span class="k-tag k-base">基础</span>{{ store.kindCounts.base }} ·
          <span class="k-tag k-calc">计算</span>{{ store.kindCounts.calc }}）
        </span>
        <div class="gi-search">
          <Icon name="search" :size="13" />
          <input v-model="store.filters.kw" placeholder="搜索指标名称" autocomplete="off" @input="store.page = 1">
        </div>
        <div class="grid-actions">
          <button type="button" class="act-btn primary" @click="addVisible = true">
            <Icon name="g-2949287e" :size="13" />添加指标
          </button>
          <button type="button" class="act-btn" @click="calcVisible = true">
            <Icon name="g-1fef0bd3" :size="13" />计算指标
          </button>
          <button type="button" class="act-btn" @click="openReplace">
            <Icon name="g-b8735c67" :size="13" />替换指标
          </button>
          <button type="button" class="act-btn" @click="codeVisible = true">
            <Icon name="g-e52bc886" :size="13" />代码运算
          </button>
          <button type="button" class="act-btn" @click="Message.info('数据调整功能规划中（演示）')">
            <Icon name="g-c7833b6f" :size="13" />数据调整
          </button>
        </div>
        <div class="gi-date" :class="{ open: filterOpen === 'creator' }">
          <button type="button" class="gi-date-btn" :class="{ on: !!store.filters.creator }" title="按创建人筛选" @click.stop="toggleFilter('creator')">
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
        <div class="view-toggle">
          <button type="button" class="vt-btn" :class="{ active: store.viewMode === 'card' }" data-tip="图形视图" @click="store.viewMode = 'card'">
            <Icon name="g-19a52e64" :size="14" />
          </button>
          <button type="button" class="vt-btn" :class="{ active: store.viewMode === 'list' }" data-tip="列表视图" @click="store.viewMode = 'list'">
            <Icon name="g-54277c6f" :size="14" />
          </button>
        </div>
      </div>

      <div v-if="!store.paged.length" class="cards-empty" style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-3);font-size:13px">暂无匹配指标</div>

      <div v-else-if="store.viewMode === 'card'" class="ind-cards">
        <div v-for="c in store.paged" :key="c.id" class="ind-card" @click="store.detailId = c.id">
          <div class="ind-title">
            <span class="k-tag" :class="c.kind === 'calc' ? 'k-calc' : 'k-base'">{{ c.kind === 'calc' ? '计算' : '基础' }}</span>
            <span class="ind-name">{{ c.title }}</span>
          </div>
          <div class="ind-chart"><G2Chart :spec="specOf(c)" :height="86" /></div>
          <div class="ind-dates">
            <span>{{ sparkTicks[0] }}</span>
            <span>{{ sparkTicks[1] }}</span>
            <span>{{ sparkTicks[2] }}</span>
          </div>
          <div class="ind-foot">
            <span>创建时间：{{ c.date }}</span>
            <span class="ind-ops" @click.stop>
              <button type="button" class="ic-ico lt-view" data-tip="查看预览" @click="store.detailId = c.id"><Icon name="preview" :size="16" /></button>
              <button
                type="button"
                class="ic-ico lt-toggle"
                :class="c.state === '停用' ? 'is-off' : 'is-on'"
                :data-tip="c.state === '停用' ? '启用' : '停用'"
                @click="store.toggle(c.id)"
              >
                <Icon :name="c.state === '停用' ? 'unlock' : 'lock'" :size="16" />
              </button>
            </span>
          </div>
        </div>
      </div>

      <div v-else class="list-wrap">
        <table class="list-table">
          <thead>
            <tr>
              <th>指标名称</th><th>指标ID</th><th>单位</th><th>频率</th><th>类型</th>
              <th style="text-align:right">最新值</th><th>最新日期</th><th>数据来源</th>
              <th>所属目录</th><th>创建时间</th><th>状态</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in store.paged" :key="c.id">
              <td class="lt-name" @click="store.detailId = c.id">{{ c.title }}</td>
              <td class="lt-id">{{ c.id }}</td>
              <td>{{ c.unit }}</td>
              <td>{{ c.freq }}</td>
              <td>
                <span class="type-cell">
                  <span class="k-tag" :class="c.kind === 'calc' ? 'k-calc' : 'k-base'">{{ c.kind === 'calc' ? '计算' : '基础' }}</span>
                  <span v-if="c.calcType" class="tag">{{ c.calcType }}</span>
                  <span v-else class="raw">原始指标</span>
                </span>
              </td>
              <td class="lt-num">{{ Number(c.latest || 0).toFixed(1) }}</td>
              <td>{{ c.latestDate || c.date }}</td>
              <td>{{ c.source }}</td>
              <td :title="c.dir">{{ dirShort(c.dir) }}</td>
              <td>{{ c.date }}</td>
              <td><span :class="c.state === '停用' ? 'state-off' : 'state-on'">{{ c.state }}</span></td>
              <td>
                <div class="lt-ops">
                  <button type="button" class="ic-ico lt-view" data-tip="查看预览" @click="store.detailId = c.id"><Icon name="preview" :size="16" /></button>
                  <button
                    type="button"
                    class="ic-ico lt-toggle"
                    :class="c.state === '停用' ? 'is-off' : 'is-on'"
                    :data-tip="c.state === '停用' ? '启用' : '停用'"
                    @click="store.toggle(c.id)"
                  >
                    <Icon :name="c.state === '停用' ? 'unlock' : 'lock'" :size="16" />
                  </button>
                  <button type="button" class="ic-ico lt-del" data-tip="删除" @click="onRemoveItem(c.title)"><Icon name="trash" :size="16" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="gal-pager">
        <a-pagination :current="store.page" :total="total" :page-size="store.pageSize" size="small" @change="(p) => store.page = p" />
      </div>
    </section>

    <IndicatorDetail />
    <AddIndicatorDialog v-model:visible="addVisible" />
    <CalcIndicatorDialog v-model:visible="calcVisible" />
    <CodeIndicatorDialog v-model:visible="codeVisible" />

    <AppModal :visible="replaceVisible" title="替换指标" icon="g-410b486a" size="md" overflow-visible @update:visible="(v) => { replaceVisible = v }">
      <div class="rp-row">
        <span class="rp-label req">原指标</span>
        <IndPicker v-model="replace.from" :names="names" :exact="replace.exactFrom" placeholder="指标ID/指标名称" />
        <span class="exact">精准匹配
          <span class="switch"><input type="checkbox" v-model="replace.exactFrom"><span class="sl"></span></span>
        </span>
      </div>
      <div class="rp-row">
        <span class="rp-label req">替换为</span>
        <IndPicker v-model="replace.to" :names="names" :exact="replace.exactTo" placeholder="指标ID/指标名称" />
        <span class="exact">精准匹配
          <span class="switch"><input type="checkbox" v-model="replace.exactTo"><span class="sl"></span></span>
        </span>
      </div>
      <div class="rp-actions">
        <button type="button" class="btn primary" @click="doReplace">全部替换</button>
        <button type="button" class="btn tint" @click="replaceVisible = false">取消</button>
      </div>
      <div class="rp-tip">提示：替换后，图、表、计算指标和逻辑图引用到原指标的会全部由替换指标替代</div>
    </AppModal>

    <AppModal
      :visible="dirModal.visible"
      :title="dirModal.mode === 'edit' ? '编辑' : '添加'"
      :icon="dirModal.mode === 'edit' ? 'edit-fill' : 'plus-16'"
      :width="480"
      @update:visible="(v) => { dirModal.visible = v }"
    >
      <div class="df-form">
        <template v-if="dirModal.mode === 'edit'">
          <div class="df-row"><label>目录名称</label><input v-model="dirModal.name" placeholder="必填项" autofocus></div>
          <div class="df-row"><label>上级目录</label>
            <a-select :model-value="dirParentLabel" disabled popup-container="body">
              <a-option :value="dirParentLabel">{{ dirParentLabel }}</a-option>
            </a-select>
          </div>
          <div class="df-note">注：只能移动到同一层级的分类</div>
        </template>
        <template v-else>
          <div class="df-row"><label>上级目录</label><div class="df-val">{{ dirParentLabel }}</div></div>
          <div class="df-row"><label>目录名称</label><input v-model="dirModal.name" placeholder="必填项" autofocus></div>
        </template>
      </div>
      <template #footer>
        <button type="button" class="btn primary" style="min-width:88px" @click="confirmDir">保存</button>
        <button type="button" class="btn tint" style="min-width:88px" @click="dirModal.visible = false">取消</button>
      </template>
    </AppModal>

    <AppModal
      :visible="moveModal.visible"
      :title="moveModal.kind === 'dir' ? '移动目录' : '移动指标'"
      icon="g-18d681d0"
      overflow-visible
      :width="480"
      @update:visible="(v) => { moveModal.visible = v }"
    >
      <div class="df-form">
        <div class="df-row">
          <label>{{ moveModal.kind === 'dir' ? '当前目录' : '当前指标' }}</label>
          <div class="df-val">{{ moveModal.title }}</div>
        </div>
        <div class="df-row">
          <label>移动到</label>
          <DirPathPicker
            v-model="moveModal.dest"
            :tree="store.dirs"
            :allow-root="moveModal.kind === 'dir'"
            :placeholder="moveModal.kind === 'dir' ? '请选择上级目录' : '请选择目标目录'"
          />
        </div>
      </div>
      <template #footer>
        <button type="button" class="btn primary" style="min-width:88px" @click="confirmMove">确认移动</button>
        <button type="button" class="btn tint" style="min-width:88px" @click="moveModal.visible = false">取消</button>
      </template>
    </AppModal>

    <AppModal
      :visible="batchModal.visible"
      title="批量移动指标"
      icon="swap-16"
      overflow-visible
      :width="600"
      @update:visible="(v) => { batchModal.visible = v }"
    >
      <div class="bm-toolbar">
        <div style="font-size:13px;color:var(--text-2)">来源目录：<b>{{ store.currentDir ? store.currentDir.split('/').filter(Boolean).join(' / ') : '全部指标' }}</b></div>
        <span class="bm-summary">已选 {{ batchModal.ids.length }} / {{ batchList.length }}</span>
        <button type="button" class="btn" style="height:30px;padding:0 12px;font-size:12px" @click="toggleBatchAll">
          {{ batchModal.ids.length === batchList.length && batchList.length ? '取消全选' : '全选' }}
        </button>
      </div>
      <div class="bm-list">
        <label v-for="c in batchList" :key="c.id" class="bm-row">
          <input type="checkbox" :checked="batchModal.ids.includes(c.id)" @change="toggleBatchId(c.id, $event.target.checked)">
          <span class="bm-name">{{ c.title }}</span>
          <span class="bm-dir">{{ dirShort(c.dir) }}</span>
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
  </div>
</template>
