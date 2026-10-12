<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { ME, PEOPLE } from '../../utils/hash'
import { parentPathOf } from '../../utils/dir'
import { startDirDrag } from '../../utils/dir-drag'
import { usePptStore } from '../../stores/ppt'
import { downloadPptx } from '../../utils/exportPpt'
import { runWithExportLoading } from '../../utils/exportLoading'
import Icon from '../../components/Icon.vue'
import AppModal from '../../components/AppModal.vue'
import FilterBar from '../../components/FilterBar.vue'
import DirTree from '../../components/DirTree.vue'
import DirPathPicker from '../../components/DirPathPicker.vue'
import PptSlide from './PptSlide.vue'
import PptEditor from './PptEditor.vue'
import PptPresent from './PptPresent.vue'
import { PPT_TYPES, typeName } from './ppt-model'

const route = useRoute()
const router = useRouter()
const store = usePptStore()
const dirCollapsed = ref(false)
const menuId = ref('')
const menuPos = reactive({ left: '0px', top: '0px' })
const filterOpen = ref('')
const dateDraft = reactive({ from: '', to: '' })
const dirModal = reactive({ visible: false, mode: 'add', parent: '', name: '' })
const moveModal = reactive({ visible: false, kind: 'dir', from: '', title: '', dest: '' })
const delModal = reactive({ visible: false, kind: '', title: '', msg: '', path: '', id: '' })
const batchModal = reactive({ visible: false, dir: '', ids: [] })
const batchList = ref([])
const shareModal = reactive({ visible: false, id: '', users: [] })
const mergeModal = reactive({ visible: false, ids: [], title: '合并PPT', tab: 'public' })
const previewModal = reactive({ visible: false, ppt: null })
const reportModal = reactive({ visible: false, report: null })
const presentPpt = ref(null)
const presentStart = ref(0)

const editorId = computed(() => String(route.params.id || ''))
const presenting = computed(() => route.query.preview === '1' || route.query.play === '1')
const isMine = computed(() => store.scope === 'mine')
const isShared = computed(() => store.scope === 'shared')
const isPublic = computed(() => store.scope === 'public')
const menuPpt = computed(() => store.get(menuId.value))
const dateLabel = computed(() => {
  const f = store.filters
  if (f.dateFrom || f.dateTo) {
    const a = f.dateFrom ? f.dateFrom.slice(5).replace('-', '/') : '…'
    const b = f.dateTo ? f.dateTo.slice(5).replace('-', '/') : '…'
    return `${a} ~ ${b}`
  }
  return '创建时间'
})
const typeLabel = computed(() => (store.filters.pptType ? typeName(store.filters.pptType) : '类型'))
const creatorLabel = computed(() => store.filters.creator || '创建人')
const mergePool = computed(() => {
  const mine = store.pack.ppts.mine || []
  const pub = store.pack.ppts.public || []
  return mergeModal.tab === 'mine' ? mine : pub
})

watch(() => route.query.scope, (id) => {
  if (id === 'mine' || id === 'shared' || id === 'public') store.setScope(id)
}, { immediate: true })
watch(() => route.query.side, (side) => {
  if (store.scope === 'shared' && (side === 'in' || side === 'out')) store.setShareSide(side)
}, { immediate: true })
watch(editorId, (id) => {
  if (!id) return
  const found = store.findById(id)
  if (!found) {
    Message.error('PPT 不存在或已删除')
    router.replace({ path: '/ppt', query: { scope: store.scope } })
    return
  }
  if (store.scope !== found.scope) store.setScope(found.scope)
}, { immediate: true })

function pptLink(p, extra = {}) {
  return {
    name: 'ppt',
    params: { id: p.id },
    query: { scope: p.scope || store.scope, ...(store.scope === 'shared' ? { side: store.shareSide } : {}), ...extra },
  }
}
function goScope(scope, side) {
  router.push({ path: '/ppt', query: { scope, ...(scope === 'shared' ? { side: side || 'out' } : {}) } })
}
function openEditor(p) {
  if (!p) return
  menuId.value = ''
  router.push(pptLink(p))
}
function closeEditor() {
  router.push({ path: '/ppt', query: { scope: store.scope, ...(store.scope === 'shared' ? { side: store.shareSide } : {}) } })
}
function openAdd() {
  if (!isMine.value) return
  const ppt = store.createPpt('未命名PPT', { dir: store.currentDir, type: 'weekly' })
  Message.success('已创建 PPT，请完善封面标题与内容')
  openEditor(ppt)
}

function toggleMenu(e, p) {
  if (menuId.value === p.id) { menuId.value = ''; return }
  menuId.value = p.id
  const r = e.currentTarget.getBoundingClientRect()
  const left = Math.min(Math.max(8, r.right - 160), window.innerWidth - 176)
  let top = r.bottom + 2
  if (top + 280 > window.innerHeight - 8) top = Math.max(8, r.top - 280)
  menuPos.left = `${left}px`
  menuPos.top = `${top}px`
}

function onAdd(path) {
  if (!isMine.value) return
  Object.assign(dirModal, { visible: true, mode: path ? 'child' : 'add', parent: path || '', name: '' })
}
function onEdit(path) {
  Object.assign(dirModal, { visible: true, mode: 'edit', parent: path, name: String(path || '').split('/').pop() })
}
function confirmDir() {
  const name = dirModal.name.trim()
  if (!name) return Message.error('请填写目录名称')
  if (/[/\\]/.test(name)) return Message.error('目录名称不能包含斜杠')
  const r = dirModal.mode === 'edit'
    ? store.renameDir(dirModal.parent, name)
    : store.addDir(dirModal.parent, name)
  if (!r.ok) return Message.error(r.msg)
  if (dirModal.mode !== 'edit' && r.path) store.selectDir(r.path)
  dirModal.visible = false
  Message.success(dirModal.mode === 'edit' ? '目录已保存' : `已添加目录：${name}`)
}
function onCopyDir(path) {
  const r = store.copyDir(path)
  if (!r.ok) return Message.error(r.msg)
  Message.success(`已复制目录及 ${r.count} 份 PPT`)
}
function onRemoveDir(path) {
  const label = String(path || '').split('/').pop()
  const cnt = store.dirCount(path)
  Object.assign(delModal, {
    visible: true, kind: 'dir', path, id: '', title: '删除目录',
    msg: cnt > 0
      ? `目录「${label}」下仍有 ${cnt} 份 PPT，删除后其子目录结构将一并移除。确认删除该目录？`
      : `确认删除目录「${label}」？删除后不可恢复。`,
  })
}
function onDirToEn(path) {
  const r = store.dirToEn(path)
  if (!r.ok) return Message.error(r.msg)
  Message.success(`已将 ${r.count} 份 PPT 转为英文，生成到「${r.path}」`)
  store.setScope('mine')
  store.selectDir(r.path)
  router.replace({ path: '/ppt', query: { scope: 'mine' } })
}
function openBatch() {
  if (!isMine.value) return
  const rows = store.filtered
  if (!rows.length) return Message.warning('当前目录暂无 PPT 可移动')
  batchList.value = rows.map((p) => ({ id: p.id, title: p.title, dir: p.dir || '' }))
  batchModal.ids = batchList.value.map((p) => p.id)
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
  else batchModal.ids = batchList.value.map((p) => p.id)
}
function doBatchMove() {
  if (!batchModal.dir) return Message.warning('请选择目标目录')
  if (!batchModal.ids.length) return Message.warning('请勾选要移动的 PPT')
  store.movePpts(batchModal.ids, batchModal.dir)
  store.selectDir(batchModal.dir)
  batchModal.visible = false
  Message.success(`已移动 ${batchModal.ids.length} 份 PPT`)
}
function onDropItem(payload, path) {
  if (!isMine.value) return
  if (!path) return Message.warning('请拖到具体目录')
  const hit = payload.item || store.get(payload.id)
  if (!hit) return
  if (hit.dir === path) return Message.info(`「${hit.title}」已在该目录`)
  store.movePpts([hit.id], path)
  store.selectDir(path)
  store.selectItem(hit.id)
  Message.success(`已移动「${hit.title}」到「${path.split('/').join(' / ')}」`)
}
function onMove(payload) {
  if (!isMine.value) return
  if (payload?.kind === 'item') {
    const item = payload.item
    if (!item?.id) return
    Object.assign(moveModal, {
      visible: true,
      kind: 'item',
      from: item.id,
      title: item.title || payload.title || item.id,
      dest: item.dir || '',
    })
    return
  }
  const path = payload?.path || ''
  if (!path) return
  Object.assign(moveModal, {
    visible: true,
    kind: 'dir',
    from: path,
    title: payload.title || path.split('/').pop(),
    dest: parentPathOf(path),
  })
}
function confirmMove() {
  if (moveModal.kind === 'dir') {
    const r = store.moveDir(moveModal.from, moveModal.dest || '')
    if (!r || r.skipped) { moveModal.visible = false; return }
    if (!r.ok) return Message.warning(r.msg)
    if (r.path) store.selectDir(r.path)
    moveModal.visible = false
    Message.success(r.msg || '目录已移动')
    return
  }
  if (!moveModal.dest) return Message.warning('请选择目标目录')
  store.movePpts([moveModal.from], moveModal.dest)
  store.selectDir(moveModal.dest)
  moveModal.visible = false
  Message.success(`已将「${moveModal.title}」移动到「${moveModal.dest.split('/').join(' / ')}」`)
}
function onDropDir(fromPath, targetPath) {
  if (!isMine.value) return
  const r = store.moveDir(fromPath, targetPath)
  if (!r || r.skipped) return
  if (!r.ok) return Message.warning(r.msg)
  if (r.path) store.selectDir(r.path)
  if (r.msg) Message.success(r.msg)
}
function onCardDragStart(e, p) {
  if (!isMine.value) return
  if (e.target?.closest?.('.cc-more, .tc-head-acts, .lt-ops')) {
    e.preventDefault()
    return
  }
  startDirDrag({
    type: 'item',
    id: p.id,
    name: p.title,
    label: p.title,
    item: p,
  }, e)
}
function confirmDel() {
  if (delModal.kind === 'dir') {
    const r = store.removeDir(delModal.path)
    if (!r.ok) return Message.error(r.msg)
    Message.success('目录已删除')
  } else {
    store.removePpt(delModal.id)
    Message.success('PPT 已删除')
  }
  delModal.visible = false
}
function askDelPpt(p) {
  Object.assign(delModal, {
    visible: true, kind: 'ppt', path: '', id: p.id, title: '删除 PPT',
    msg: `确认删除「${p.title}」？删除后不可恢复。`,
  })
  menuId.value = ''
}

async function download(p) {
  try {
    await runWithExportLoading(() => downloadPptx(p), '正在导出 PPT，请稍候...')
    Message.success('已下载 PPTX')
  } catch (e) {
    Message.error(e?.message || '下载失败')
  }
  menuId.value = ''
}
function copyPpt(p) {
  const r = isPublic.value ? store.copyToMine(p.id) : store.copyPpt(p.id, 'mine', store.currentDir || p.dir)
  if (!r.ok) return Message.error(r.msg)
  Message.success(isPublic.value ? '已复制到我的 PPT' : '已复制')
  menuId.value = ''
  if (isPublic.value) {
    store.setScope('mine')
    router.push({ path: '/ppt', query: { scope: 'mine' } })
  }
}
function toEn(p) {
  const r = store.pptToEn(p.id)
  if (!r.ok) return Message.error(r.msg)
  Message.success(`已生成英文 PPT「${r.ppt.title}」`)
  menuId.value = ''
  store.setScope('mine')
  store.selectDir(r.ppt.dir)
  router.push({ path: '/ppt', query: { scope: 'mine' } })
}
function openShare(p) {
  shareModal.id = p.id
  shareModal.users = [...(p.shares || [])]
  shareModal.visible = true
  menuId.value = ''
}
function confirmShare() {
  const r = store.sharePpt(shareModal.id, shareModal.users)
  if (!r.ok) return Message.error(r.msg)
  shareModal.visible = false
  Message.success(shareModal.users.length ? '已更新共享用户' : '已取消全部共享')
}
function unshare(p) {
  store.unsharePpt(p.id)
  Message.success('已取消共享')
  menuId.value = ''
}
function convertReport(p) {
  const r = store.toReport(p.id)
  if (!r.ok) return Message.error(r.msg)
  reportModal.report = r.report
  reportModal.visible = true
  menuId.value = ''
  Message.success(r.existed ? '已有对应报告' : '已转为报告')
}
function openPreview(p) {
  previewModal.ppt = p
  previewModal.visible = true
  menuId.value = ''
}
function doPublish() {
  if (!previewModal.ppt) return
  store.publishPpt(previewModal.ppt.id, true)
  previewModal.visible = false
  Message.success('已发布')
}
function present(p, start = 0) {
  presentPpt.value = p
  presentStart.value = start
  menuId.value = ''
  previewModal.visible = false
}
function closePresent() {
  presentPpt.value = null
  if (presenting.value) {
    const q = { ...route.query }
    delete q.preview
    delete q.play
    router.replace({ name: 'ppt', params: route.params, query: q })
  }
}

function confirmMerge() {
  if (mergeModal.ids.length < 2) return Message.warning('请至少选择两份 PPT')
  const r = store.mergePpts(mergeModal.ids, mergeModal.title.trim() || '合并PPT')
  if (!r.ok) return Message.error(r.msg)
  mergeModal.visible = false
  Message.success('已合并，进入编辑页')
  openEditor(r.ppt)
}

function toggleFilter(name) {
  if (name === 'date' && filterOpen.value !== 'date') {
    dateDraft.from = store.filters.dateFrom
    dateDraft.to = store.filters.dateTo
  }
  filterOpen.value = filterOpen.value === name ? '' : name
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
  filterOpen.value = ''
}
function resetDate() {
  dateDraft.from = ''
  dateDraft.to = ''
  store.filters.dateFrom = ''
  store.filters.dateTo = ''
  filterOpen.value = ''
}
function onDocClick(e) {
  if (e.target.closest?.('.gi-date, .cc-card-menu, .cc-more, .arco-trigger-popup')) return
  filterOpen.value = ''
  menuId.value = ''
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

const shareUsers = PEOPLE.filter((n) => n !== ME)
const dirParentLabel = computed(() => {
  if (dirModal.mode === 'edit') {
    const parts = dirModal.parent.split('/').filter(Boolean)
    return parts.length > 1 ? parts.slice(0, -1).join('/') : '根目录（一级目录）'
  }
  return dirModal.parent || '根目录（一级目录）'
})
function pptDirShort(path) {
  const parts = (path || '').split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : '未分类'
}
</script>

<template>
  <PptPresent v-if="(presentPpt || presenting) && (presentPpt || store.get(editorId))" :ppt="presentPpt || store.get(editorId)" :start="presentStart" @close="closePresent" />

  <div v-else class="ppt-page" :class="{ editing: !!editorId }">
    <aside class="dir-panel" :class="{ collapsed: dirCollapsed }">
      <div class="dir-head">
        <h2>目录</h2>
        <span class="ppt-scope-tag">{{ store.scope === 'mine' ? '我的PPT' : store.scope === 'shared' ? '共享PPT' : '公共PPT' }}</span>
      </div>
      <div v-if="isShared" class="ppt-share-tabs">
        <button type="button" :class="{ on: store.shareSide === 'out' }" @click="goScope('shared', 'out')">我共享的</button>
        <button type="button" :class="{ on: store.shareSide === 'in' }" @click="goScope('shared', 'in')">收到共享</button>
      </div>
      <FilterBar v-model="store.filters" placeholder="请输入PPT名称/ID" :show-mine="false" :show-date="false" />
      <DirTree
        :tree="store.dirs"
        :current="store.currentDir"
        :current-item="store.currentItem"
        :count-of="store.dirCount"
        :leaves-of="store.itemsInDir"
        :leaf-title="(it) => it.title"
        :leaf-key="(it) => it.id"
        leaf-icon="dir-chart"
        :editable="isMine"
        :movable-dirs="isMine"
        :movable-items="isMine"
        @select="(p) => store.selectDir(p)"
        @select-item="(item) => store.selectItem(item.id)"
        @add="onAdd"
        @edit="onEdit"
        @remove="onRemoveDir"
        @move="onMove"
        @drop-dir="onDropDir"
        @drop-item="onDropItem"
      >
        <template #menu-extra="{ path }">
          <a-doption @click="onCopyDir(path)">复制</a-doption>
          <a-doption @click="onDirToEn(path)">转英文PPT</a-doption>
        </template>
      </DirTree>
      <div v-if="isMine" class="dir-foot">
        <a-button long @click="onAdd(store.currentDir)">
          <template #icon><Icon name="plus-14" :size="13" /></template>
          {{ store.currentDir ? '添加子目录' : '添加一级目录' }}
        </a-button>
        <a-button long @click="openBatch">
          <template #icon><Icon name="swap" :size="13" /></template>
          批量移动PPT
        </a-button>
      </div>
      <button class="dir-toggle" title="收起 / 展开目录" @click="dirCollapsed = !dirCollapsed">
        <Icon name="chevrons-left" :size="12" />
      </button>
    </aside>

    <section class="gallery-panel">
      <div class="gal-head">
        <span class="gal-count">共 <b>{{ store.filtered.length }}</b> 份 PPT</span>
        <div class="gi-search">
          <Icon name="search" :size="13" />
          <input v-model="store.filters.nameKw" placeholder="搜索 PPT 名称" autocomplete="off">
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
                <a-date-picker v-model="dateDraft.from" value-format="YYYY-MM-DD" placeholder="年 / 月 / 日" size="small" allow-clear />
              </div>
              <div class="gdp-row">
                <label>结束日期</label>
                <a-date-picker v-model="dateDraft.to" value-format="YYYY-MM-DD" placeholder="年 / 月 / 日" size="small" allow-clear />
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
            <button type="button" class="gi-date-btn" :class="{ on: !!store.filters.pptType }" @click.stop="toggleFilter('type')">
              <Icon name="filter" :size="13" />
              <span>{{ typeLabel }}</span>
              <Icon name="chevron-down" :size="10" />
            </button>
            <div v-if="filterOpen === 'type'" class="gi-type-pop show" @click.stop>
              <button type="button" class="gi-type-item" :class="{ on: !store.filters.pptType }" @click="store.filters.pptType = ''; filterOpen = ''">全部类型</button>
              <button v-for="t in PPT_TYPES" :key="t.id" type="button" class="gi-type-item" :class="{ on: store.filters.pptType === t.id }" @click="store.filters.pptType = t.id; filterOpen = ''">{{ t.name }}</button>
            </div>
          </div>
          <div class="gi-date" :class="{ open: filterOpen === 'creator' }">
            <button type="button" class="gi-date-btn" :class="{ on: !!store.filters.creator }" @click.stop="toggleFilter('creator')">
              <Icon name="filter" :size="13" />
              <span>{{ creatorLabel }}</span>
              <Icon name="chevron-down" :size="10" />
            </button>
            <div v-if="filterOpen === 'creator'" class="gi-type-pop show" @click.stop>
              <button type="button" class="gi-type-item" :class="{ on: !store.filters.creator }" @click="store.filters.creator = ''; filterOpen = ''">全部创建人</button>
              <button v-for="name in store.creators" :key="name" type="button" class="gi-type-item" :class="{ on: store.filters.creator === name }" @click="store.filters.creator = name; filterOpen = ''">{{ name }}</button>
            </div>
          </div>
        </div>
        <div class="view-toggle">
          <button type="button" class="vt-btn" :class="{ active: store.viewMode === 'card' }" @click="store.viewMode = 'card'"><Icon name="view-card" :size="14" /></button>
          <button type="button" class="vt-btn" :class="{ active: store.viewMode === 'list' }" @click="store.viewMode = 'list'"><Icon name="view-list" :size="14" /></button>
        </div>
        <button v-if="isMine" type="button" class="btn tint" @click="mergeModal.visible = true; mergeModal.ids = []; mergeModal.title = '合并PPT'">合并PPT</button>
        <button v-if="isMine" type="button" class="btn-add-chart" @click="openAdd">
          <Icon name="plus" :size="14" />
          添加/编辑PPT
        </button>
      </div>

      <div class="gal-scroll">
        <div v-if="!store.filtered.length" class="gal-empty">暂无匹配 PPT<br>可调整目录、类型或搜索条件</div>
        <div v-else-if="store.viewMode === 'card'" class="gal-grid ppt-grid">
          <article
            v-for="p in store.filtered"
            :key="p.id"
            class="ppt-card"
            :class="{ 'menu-open': menuId === p.id }"
            :draggable="isMine"
            @dragstart="onCardDragStart($event, p)"
            @click="isPublic ? openPreview(p) : openEditor(p)"
          >
            <div class="tc-head">
              <div class="tc-name" :title="p.title">{{ p.title }}</div>
              <div class="tc-head-acts" @click.stop>
                <span v-if="p.lang === 'en'" class="ppt-lang">EN</span>
                <span v-if="p.published" class="ppt-pub">已发布</span>
                <button type="button" class="cc-more" :class="{ open: menuId === p.id }" @click="toggleMenu($event, p)">
                  <Icon name="more" :size="14" />
                </button>
              </div>
            </div>
            <div class="ppt-thumb">
              <PptSlide :slide="p.slides?.[0] || { kind: 'cover', cover: p.cover }" :template="p.cover?.template || 'navy'" :ppt-style="p.style" mini />
            </div>
            <div class="ppt-meta">
              <span>{{ typeName(p.type) }}</span>
              <span>{{ p.creator }}</span>
              <span>{{ p.date }}</span>
            </div>
          </article>
        </div>
        <table v-else class="list-table">
          <thead>
            <tr>
              <th>PPT名称</th><th>ID</th><th>类型</th><th>目录</th>
              <th>创建人</th><th>创建时间</th><th>状态</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in store.filtered" :key="p.id" :draggable="isMine" @dragstart="onCardDragStart($event, p)" @click="isPublic ? openPreview(p) : openEditor(p)">
              <td class="lt-name">{{ p.title }}</td>
              <td class="lt-id">{{ p.id }}</td>
              <td>{{ typeName(p.type) }}</td>
              <td>{{ p.dir || '—' }}</td>
              <td>{{ p.creator }}</td>
              <td>{{ p.date }}</td>
              <td>{{ p.published ? '已发布' : '草稿' }}{{ p.reportId ? ' · 已转报告' : '' }}</td>
              <td @click.stop>
                <div class="lt-ops">
                  <button type="button" class="ic-ico" title="预览" @click="openPreview(p)"><Icon name="preview" :size="16" /></button>
                  <button type="button" class="ic-ico" title="演示" @click="present(p)"><Icon name="g-c7c8d705" :size="16" /></button>
                  <button type="button" class="ic-ico" title="下载" @click="download(p)"><Icon name="download" :size="16" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>

  <ul v-if="menuId && menuPpt" class="cc-card-menu show ppt-menu" :style="menuPos" role="menu" @click.stop>
    <li><button type="button" class="ccm-item" @click="openPreview(menuPpt)">预览发布</button></li>
    <li><button type="button" class="ccm-item" @click="present(menuPpt)">演示</button></li>
    <li><button type="button" class="ccm-item" @click="download(menuPpt)">下载</button></li>
    <li><button type="button" class="ccm-item" @click="convertReport(menuPpt)">{{ menuPpt.reportId ? '查看报告' : '转报告' }}</button></li>
    <li v-if="!isPublic" class="ccm-sep"></li>
    <li v-if="!isPublic"><button type="button" class="ccm-item" @click="openEditor(menuPpt)">编辑</button></li>
    <li><button type="button" class="ccm-item" @click="copyPpt(menuPpt)">{{ isPublic ? '复制到我的PPT' : '复制' }}</button></li>
    <li v-if="isPublic || isMine"><button type="button" class="ccm-item" @click="toEn(menuPpt)">转英文PPT</button></li>
    <template v-if="isShared">
      <li class="ccm-sep"></li>
      <li><button type="button" class="ccm-item" @click="openShare(menuPpt)">选择共享用户</button></li>
      <li><button type="button" class="ccm-item" @click="unshare(menuPpt)">取消共享</button></li>
    </template>
    <template v-if="!isPublic">
      <li class="ccm-sep"></li>
      <li><button type="button" class="ccm-item" @click="askDelPpt(menuPpt)">删除</button></li>
    </template>
  </ul>

  <AppModal :visible="dirModal.visible" :title="dirModal.mode === 'edit' ? '编辑' : '添加'" :icon="dirModal.mode === 'edit' ? 'edit-fill' : 'plus-16'" :width="480" @update:visible="(v) => dirModal.visible = v">
    <div class="df-form">
      <template v-if="dirModal.mode === 'edit'">
        <div class="df-row"><label>目录名称</label><input v-model="dirModal.name" placeholder="必填项" autocomplete="off"></div>
        <div class="df-row"><label>上级目录</label>
          <a-select :model-value="dirParentLabel" disabled popup-container="body">
            <a-option :value="dirParentLabel">{{ dirParentLabel }}</a-option>
          </a-select>
        </div>
        <div class="df-note">注：只能移动到同一层级的分类</div>
      </template>
      <template v-else>
        <div class="df-row"><label>上级目录</label><div class="df-val">{{ dirParentLabel }}</div></div>
        <div class="df-row"><label>目录名称</label><input v-model="dirModal.name" placeholder="必填项" autocomplete="off"></div>
      </template>
    </div>
    <template #footer>
      <button type="button" class="btn primary" style="min-width:88px" @click="confirmDir">保存</button>
      <button type="button" class="btn tint" style="min-width:88px" @click="dirModal.visible = false">取消</button>
    </template>
  </AppModal>

  <AppModal
    :visible="moveModal.visible"
    :title="moveModal.kind === 'dir' ? '移动目录' : '移动PPT'"
    icon="g-18d681d0"
    overflow-visible
    :width="480"
    @update:visible="(v) => { moveModal.visible = v }"
  >
    <div class="df-form">
      <div class="df-row">
        <label>{{ moveModal.kind === 'dir' ? '当前目录' : '当前PPT' }}</label>
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
      <button type="button" class="btn tint" style="min-width:88px" @click="moveModal.visible = false">取消</button>
      <button type="button" class="btn primary" style="min-width:88px" @click="confirmMove">确认移动</button>
    </template>
  </AppModal>

  <AppModal
    :visible="batchModal.visible"
    title="批量移动PPT"
    icon="swap-16"
    overflow-visible
    :width="600"
    @update:visible="(v) => { batchModal.visible = v }"
  >
    <div class="bm-toolbar">
      <div style="font-size:13px;color:var(--text-2)">来源目录：<b>{{ store.currentDir ? store.currentDir.split('/').filter(Boolean).join(' / ') : '全部PPT' }}</b></div>
      <span class="bm-summary">已选 {{ batchModal.ids.length }} / {{ batchList.length }}</span>
      <button type="button" class="btn" style="height:30px;padding:0 12px;font-size:12px" @click="toggleBatchAll">
        {{ batchModal.ids.length === batchList.length && batchList.length ? '取消全选' : '全选' }}
      </button>
    </div>
    <div class="bm-list">
      <label v-for="p in batchList" :key="p.id" class="bm-row">
        <input type="checkbox" :checked="batchModal.ids.includes(p.id)" @change="toggleBatchId(p.id, $event.target.checked)">
        <span class="bm-name">{{ p.title }}</span>
        <span class="bm-dir" :title="p.dir">{{ pptDirShort(p.dir) }}</span>
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

  <AppModal :visible="delModal.visible" :title="delModal.title" icon="warning" danger :width="440" @update:visible="(v) => delModal.visible = v">
    <div class="tip">{{ delModal.msg }}</div>
    <template #footer>
      <button type="button" class="btn" @click="delModal.visible = false">取消</button>
      <button type="button" class="btn danger" @click="confirmDel">删除</button>
    </template>
  </AppModal>

  <AppModal :visible="shareModal.visible" title="选择共享用户" icon="nav-link" :width="440" @update:visible="(v) => shareModal.visible = v">
    <div class="ppt-share-users">
      <label v-for="n in shareUsers" :key="n">
        <input type="checkbox" :checked="shareModal.users.includes(n)" @change="shareModal.users = $event.target.checked ? [...shareModal.users, n] : shareModal.users.filter((x) => x !== n)">
        {{ n }}
      </label>
    </div>
    <template #footer>
      <button type="button" class="btn tint" @click="shareModal.visible = false">取消</button>
      <button type="button" class="btn primary" @click="confirmShare">确定</button>
    </template>
  </AppModal>

  <AppModal :visible="mergeModal.visible" title="合并PPT" icon="swap-16" :width="640" @update:visible="(v) => mergeModal.visible = v">
    <div class="fm-field">
      <label>合并后标题</label>
      <input v-model="mergeModal.title" placeholder="合并PPT">
    </div>
    <div class="ppt-share-tabs" style="margin:12px 0">
      <button type="button" :class="{ on: mergeModal.tab === 'public' }" @click="mergeModal.tab = 'public'">公共图库</button>
      <button type="button" :class="{ on: mergeModal.tab === 'mine' }" @click="mergeModal.tab = 'mine'">我的图库</button>
    </div>
    <div class="ppt-pick-list">
      <label v-for="p in mergePool" :key="p.id" class="ppt-pick-row">
        <input type="checkbox" :checked="mergeModal.ids.includes(p.id)" @change="mergeModal.ids = $event.target.checked ? [...mergeModal.ids, p.id] : mergeModal.ids.filter((x) => x !== p.id)">
        <span>{{ p.title }}</span>
        <em>{{ p.dir || '未分类' }}</em>
      </label>
    </div>
    <template #footer>
      <span class="foot-left">已选 {{ mergeModal.ids.length }} 份</span>
      <button type="button" class="btn tint" @click="mergeModal.visible = false">取消</button>
      <button type="button" class="btn primary" @click="confirmMerge">确定</button>
    </template>
  </AppModal>

  <AppModal :visible="previewModal.visible" title="预览发布" icon="preview" :width="860" @update:visible="(v) => previewModal.visible = v">
    <div v-if="previewModal.ppt" class="ppt-preview-list">
      <div v-for="s in previewModal.ppt.slides" :key="s.id" class="ppt-preview-item">
        <PptSlide :slide="s" :template="previewModal.ppt.cover?.template || 'navy'" :ppt-style="previewModal.ppt.style" mini />
      </div>
    </div>
    <template #footer>
      <button type="button" class="btn" @click="present(previewModal.ppt)">演示</button>
      <button type="button" class="btn tint" @click="previewModal.visible = false">取消</button>
      <button v-if="previewModal.ppt && previewModal.ppt.scope !== 'public'" type="button" class="btn primary" @click="doPublish">发布</button>
    </template>
  </AppModal>

  <AppModal :visible="reportModal.visible" :title="reportModal.report ? '查看报告' : '报告'" icon="nav-report" :width="480" @update:visible="(v) => reportModal.visible = v">
    <div v-if="reportModal.report" class="ci-panel">
      <div class="ci-row"><span class="ci-k">报告名称</span><span class="ci-v">{{ reportModal.report.title }}</span></div>
      <div class="ci-row"><span class="ci-k">报告ID</span><span class="ci-v">{{ reportModal.report.id }}</span></div>
      <div class="ci-row"><span class="ci-k">页数</span><span class="ci-v">{{ reportModal.report.pages }}</span></div>
      <div class="ci-row"><span class="ci-k">生成时间</span><span class="ci-v">{{ reportModal.report.date }}</span></div>
      <div class="ci-row"><span class="ci-k">生成人</span><span class="ci-v">{{ reportModal.report.creator }}</span></div>
    </div>
    <template #footer>
      <button type="button" class="btn primary" @click="reportModal.visible = false">关闭</button>
    </template>
  </AppModal>

  <PptEditor
    v-if="editorId"
    :ppt-id="editorId"
    @close="closeEditor"
    @preview="openPreview"
    @present="present"
  />
</template>
