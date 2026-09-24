<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { TABLE_TYPES, typeName, useTableStore } from '../../stores/tables'
import { previewGrid, previewRows, workbookToXlsx } from '../../utils/workbook'
import DirTree from '../../components/DirTree.vue'
import Icon from '../../components/Icon.vue'
import AppModal from '../../components/AppModal.vue'
import TableEditor from './TableEditor.vue'

const route = useRoute()
const router = useRouter()
const store = useTableStore()
const dirCollapsed = ref(false)
const menuId = ref('')
const menuPos = reactive({ left: '0px', top: '0px' })
const filterOpen = ref('')
const dateDraft = reactive({ from: '', to: '' })
const dirModal = reactive({ visible: false, mode: 'add', parent: '', name: '' })
const addModal = reactive({ visible: false, name: '' })
const delModal = reactive({ visible: false, kind: '', title: '', msg: '', path: '', id: '' })

const dateLabel = computed(() => {
  const f = store.filters
  if (f.dateFrom || f.dateTo) {
    const a = f.dateFrom ? f.dateFrom.slice(5).replace('-', '/') : '…'
    const b = f.dateTo ? f.dateTo.slice(5).replace('-', '/') : '…'
    return `${a} ~ ${b}`
  }
  return '创建时间'
})
const dirParentLabel = computed(() => {
  if (dirModal.mode === 'edit') {
    const parts = dirModal.parent.split('/').filter(Boolean)
    return parts.length > 1 ? parts.slice(0, -1).join('/') : '根目录（一级目录）'
  }
  return dirModal.parent || '根目录（一级目录）'
})
const menuTable = computed(() => store.get(menuId.value))
const previewMode = computed(() => String(route.query.preview || '') === '1')
const editorId = computed(() => String(route.params.id || route.query.id || ''))
const editorNonce = ref(0)

watch(() => route.query.type, (id) => {
  const typeId = TABLE_TYPES.some((t) => t.id === id) ? id : ''
  if (typeId) store.setType(typeId)
  else if (!editorId.value) store.setType('shared')
}, { immediate: true })

watch(editorId, (id) => {
  if (!id) return
  const found = store.findById(id)
  if (!found) {
    Message.error('表格不存在或已删除')
    router.replace({ path: '/tables', query: { type: store.currentType } })
    return
  }
  if (store.currentType !== found.type) store.setType(found.type)
  const needPath = String(route.params.id || '') !== found.table.id
  const needType = route.query.type !== found.type
  if (needPath || needType) {
    router.replace({
      name: 'tables',
      params: { id: found.table.id },
      query: { type: found.type, ...(previewMode.value ? { preview: '1' } : {}) },
    })
  }
}, { immediate: true })

function tableLink(t, extra = {}) {
  return {
    name: 'tables',
    params: { id: t.id },
    query: { type: t.type || store.currentType, ...extra },
  }
}

function previewOf(t) {
  const grid = previewGrid(t.workbook, 16, 10)
  if (grid.length) return grid
  const plain = (t.preview && t.preview.length) ? t.preview : previewRows(t.workbook, 16, 10)
  return plain.map((row) => (row || []).map((text) => (typeof text === 'object' ? text : { text, bg: '', color: '', bold: false, colspan: 1 })))
}
function cellPreviewStyle(c) {
  const s = {}
  if (c?.bg) s.background = c.bg
  if (c?.color) s.color = c.color
  if (c?.bold) s.fontWeight = '600'
  return s
}
function previewColIndexes(rows) {
  let n = 0
  ;(rows || []).forEach((row) => {
    let c = 0
    row.forEach((cell) => { c += Number(cell?.colspan || 1) })
    n = Math.max(n, c)
  })
  return Array.from({ length: n }, (_, i) => i)
}
function colLetter(i) {
  let n = i
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}
function onCardClick(t) {
  menuId.value = ''
  if (String(editorId.value) === String(t.id)) editorNonce.value += 1
}
function dirShort(path) {
  const parts = (path || '').split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : '—'
}
function selectDir(path) {
  store.currentDir = path
  store.currentItem = ''
}
function selectItem(item) {
  store.currentItem = item.id
  store.currentDir = item.dir || ''
}
function onAdd(path) {
  Object.assign(dirModal, { visible: true, mode: path ? 'child' : 'add', parent: path || '', name: '' })
}
function onFooterAdd() { onAdd(store.currentDir || '') }
function onEdit(path) {
  Object.assign(dirModal, { visible: true, mode: 'edit', parent: path, name: path.split('/').pop() })
}
function onRemoveDir(path) {
  const label = path.split('/').pop()
  const cnt = store.dirCount(path)
  Object.assign(delModal, {
    visible: true, kind: 'dir', path, id: '', title: '删除目录',
    msg: cnt > 0
      ? `目录「${label}」下仍有 ${cnt} 张表格，删除后其子目录将一并移除。确认删除？`
      : `确认删除目录「${label}」？删除后不可恢复。`,
  })
}
function onRemoveItem(item) {
  const t = typeof item === 'string' ? store.get(item) : item
  if (!t) return
  Object.assign(delModal, {
    visible: true, kind: 'table', path: '', id: t.id, title: '删除表格',
    msg: `确认删除表格「${t.title}」？删除后不可恢复。`,
  })
}
function confirmDir() {
  const name = dirModal.name.trim()
  if (!name) return Message.error('请填写目录名称')
  if (/[/\\]/.test(name)) return Message.error('目录名称不能包含斜杠')
  const r = dirModal.mode === 'edit' ? store.renameDir(dirModal.parent, name) : store.addDir(dirModal.parent, name)
  if (!r.ok) return Message.error(r.msg)
  dirModal.visible = false
  Message.success(dirModal.mode === 'edit' ? '目录已保存' : `已添加目录：${name}`)
}
function confirmDel() {
  if (delModal.kind === 'dir') {
    const r = store.removeDir(delModal.path)
    if (!r.ok) return Message.error(r.msg)
    Message.success('目录已删除')
  } else {
    store.removeTable(delModal.id)
    Message.success('表格已删除')
  }
  delModal.visible = false
}
function onDropDir(from, target) {
  const r = store.moveDir(from, target)
  if (!r.ok) return Message.error(r.msg)
  if (!r.skipped) Message.success(r.msg || '目录已移动')
}
function onDropItem(payload, dest) {
  const id = payload?.id || payload?.item?.id
  if (!id || !dest) return
  store.moveTable(id, dest)
  store.currentDir = dest
  Message.success('表格已移动')
}
function toggleFav(t) {
  store.toggleFav(t.id)
  Message.success(store.tableFav(store.get(t.id)) ? '已收藏' : '已取消收藏')
}
function openEditor(t) {
  if (!t) return
  menuId.value = ''
  router.push(tableLink(t))
}
function closeEditor() {
  router.push({ path: '/tables', query: { type: store.currentType } })
}
function openAdd() {
  addModal.name = ''
  addModal.visible = true
}
function confirmAdd() {
  const name = addModal.name.trim()
  if (!name) return Message.error('请输入表格名称')
  const t = store.createTable(name)
  addModal.visible = false
  Message.success(`已创建「${name}」`)
  openEditor(t)
}
async function downloadXlsx(t) {
  if (!t) return
  const buf = await workbookToXlsx(t.workbook, t.title)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  a.download = `${t.title}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 800)
  Message.success(`已导出 Excel（.xlsx）`)
}
function toggleMenu(e, t) {
  if (menuId.value === t.id) { menuId.value = ''; return }
  menuId.value = t.id
  const r = e.currentTarget.getBoundingClientRect()
  const left = Math.min(Math.max(8, r.left - 10), window.innerWidth - 140)
  let top = r.bottom + 2
  if (top + 170 > window.innerHeight - 8) top = Math.max(8, r.top - 170)
  menuPos.left = `${left}px`
  menuPos.top = `${top}px`
}
function onExact(e) {
  store.filters.exact = e.target.checked
  Message.info(e.target.checked ? '已开启精准匹配：仅完全匹配表格名称/ID' : '已关闭精准匹配：支持模糊搜索')
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
  if (e.target.closest?.('.gi-date, .arco-picker-container, .arco-trigger-popup, .cc-card-menu, .cc-more')) return
  filterOpen.value = ''
  menuId.value = ''
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div class="tbl-page" :class="{ 'is-preview': previewMode }">
    <aside class="dir-panel ic-dir-panel" :class="{ collapsed: dirCollapsed }">
      <div class="dir-head">
        <h2>目录</h2>
        <label class="only-mine"><input type="checkbox" v-model="store.filters.onlyMine">只看我的</label>
      </div>
      <div class="dir-search">
        <div class="ds-input">
          <Icon name="search" :size="13" />
          <input v-model="store.filters.kw" placeholder="请输入表格名称/ID" autocomplete="off">
        </div>
        <label class="exact">精准匹配
          <span class="switch">
            <input type="checkbox" :checked="store.filters.exact" @change="onExact">
            <span class="sl"></span>
          </span>
        </label>
      </div>
      <DirTree
        :tree="store.dirs"
        :current="store.currentDir"
        :current-item="store.currentItem"
        :count-of="store.dirCount"
        :leaves-of="store.itemsInDir"
        :leaf-title="(it) => it.title"
        :leaf-key="(it) => it.id"
        leaf-icon="dir-chart"
        :movable-dirs="true"
        :movable-items="true"
        @select="selectDir"
        @select-item="selectItem"
        @add="onAdd"
        @edit="onEdit"
        @remove="onRemoveDir"
        @remove-item="onRemoveItem"
        @drop-dir="onDropDir"
        @drop-item="onDropItem"
      />
      <div class="dir-foot">
        <button type="button" @click="onFooterAdd">
          <Icon name="plus-14" :size="13" />
          {{ store.currentDir ? '添加子目录' : '添加一级目录' }}
        </button>
      </div>
      <button class="dir-toggle" title="收起 / 展开目录" @click="dirCollapsed = !dirCollapsed">
        <Icon name="chevrons-left" :size="12" />
      </button>
    </aside>

    <section class="sheet-panel gallery-panel">
      <div class="gal-head">
        <span class="gal-count">共 <b>{{ store.filtered.length }}</b> 张表格</span>
        <div class="gi-search">
          <Icon name="search" :size="13" />
          <input v-model="store.filters.nameKw" placeholder="搜索表格名称" autocomplete="off">
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
        </div>
        <div class="view-toggle">
          <button type="button" class="vt-btn" :class="{ active: store.viewMode === 'card' }" data-tip="图形视图" @click="store.viewMode = 'card'">
            <Icon name="view-card" :size="14" />
          </button>
          <button type="button" class="vt-btn" :class="{ active: store.viewMode === 'list' }" data-tip="列表视图" @click="store.viewMode = 'list'">
            <Icon name="view-list" :size="14" />
          </button>
        </div>
        <button type="button" class="btn-add-chart" @click="openAdd">
          <Icon name="plus" :size="14" />
          添加表格
        </button>
      </div>

      <div class="gal-scroll">
        <div v-if="!store.filtered.length" class="gal-empty">暂无匹配表格<br>可调整目录、创建时间或搜索条件</div>
        <div v-else-if="store.viewMode === 'card'" class="gal-grid">
          <router-link
            v-for="t in store.filtered"
            :key="`${t.id}-${t.previewRev || t.updated || ''}`"
            class="tbl-card"
            :class="{ 'menu-open': menuId === t.id }"
            :to="tableLink(t)"
            @click="onCardClick(t)"
          >
            <div class="tc-head">
              <div class="tc-name" :title="t.title">{{ t.title }}</div>
              <div class="tc-head-acts" @click.stop>
                <button type="button" class="cc-fav" :class="{ on: store.tableFav(t) }" @click="toggleFav(t)">
                  <Icon name="star" :size="16" />
                  <span class="cc-fav-tip">{{ store.tableFav(t) ? '取消收藏' : '添加收藏' }}</span>
                </button>
                <button type="button" class="cc-more" :class="{ open: menuId === t.id }" @click="toggleMenu($event, t)">
                  <Icon name="more" :size="14" />
                </button>
              </div>
            </div>
            <div class="tc-preview">
              <div v-if="t.thumb" class="tc-paste-pic">
                <img class="tc-shot" :src="t.thumb" alt="">
              </div>
              <div v-else-if="!previewOf(t).length" class="tc-empty">暂无预览</div>
              <div v-else class="tc-thumb">
                <table class="tc-sheet">
                  <thead>
                    <tr>
                      <th class="tc-gutter"></th>
                      <th v-for="j in previewColIndexes(previewOf(t))" :key="'c'+j" class="tc-colh">{{ colLetter(j) }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, i) in previewOf(t)" :key="i">
                      <th class="tc-rowh">{{ i + 1 }}</th>
                      <td
                        v-for="(c, j) in row"
                        :key="j"
                        :colspan="c.colspan || 1"
                        :style="cellPreviewStyle(c)"
                      >{{ c.text }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </router-link>
        </div>
        <table v-else class="list-table">
          <thead>
            <tr>
              <th>表格名称</th><th>表格ID</th><th>类型</th><th>所属目录</th>
              <th>创建人</th><th>修改人</th><th>创建时间</th><th>收藏</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in store.filtered" :key="t.id" @click="openEditor(t)">
              <td class="lt-name" :title="t.title">{{ t.title }}</td>
              <td class="lt-id">{{ t.id }}</td>
              <td>{{ typeName(t.type) }}</td>
              <td>{{ dirShort(t.dir) }}</td>
              <td>{{ t.creator }}</td>
              <td>{{ t.updater }}</td>
              <td>{{ t.date }}</td>
              <td>{{ store.tableFav(t) ? '已收藏' : '未收藏' }}</td>
              <td @click.stop>
                <div class="lt-ops">
                  <button type="button" class="ic-ico" title="打开表格" @click="openEditor(t)"><Icon name="preview" :size="16" /></button>
                  <button type="button" class="ic-ico" title="下载Excel" @click="downloadXlsx(t)"><Icon name="download" :size="16" /></button>
                  <button type="button" class="ic-ico" :class="{ on: store.tableFav(t) }" :title="store.tableFav(t) ? '取消收藏' : '添加收藏'" @click="toggleFav(t)"><Icon name="star" :size="16" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>

  <ul v-if="menuId && menuTable" class="cc-card-menu show" :style="menuPos" role="menu" @click.stop>
    <li><button type="button" class="ccm-item" @click="openEditor(menuTable)">编辑</button></li>
    <li class="ccm-sep"></li>
    <li><button type="button" class="ccm-item" @click="toggleFav(menuTable); menuId = ''">{{ store.tableFav(menuTable) ? '取消收藏' : '收藏' }}</button></li>
    <li class="ccm-sep"></li>
    <li><button type="button" class="ccm-item" @click="downloadXlsx(menuTable); menuId = ''">下载Excel</button></li>
    <li class="ccm-sep"></li>
    <li><button type="button" class="ccm-item" @click="onRemoveItem(menuTable); menuId = ''">删除</button></li>
  </ul>

  <AppModal :visible="addModal.visible" title="添加表格" icon="plus" :width="420" @update:visible="(v) => { addModal.visible = v }">
    <div class="fm-field">
      <label>所属目录</label>
      <div class="fm-static">{{ store.currentDir || '当前分类根目录' }}</div>
    </div>
    <div class="fm-field">
      <label><i class="req">*</i>表格名称</label>
      <input v-model="addModal.name" placeholder="请输入表格名称" autocomplete="off">
    </div>
    <template #footer>
      <button type="button" class="btn" style="min-width:88px" @click="addModal.visible = false">取消</button>
      <button type="button" class="btn primary" style="min-width:88px" @click="confirmAdd">创建</button>
    </template>
  </AppModal>

  <AppModal :visible="dirModal.visible" :title="dirModal.mode === 'edit' ? '编辑目录' : '添加目录'" :icon="dirModal.mode === 'edit' ? 'edit-fill' : 'plus-16'" :width="420" @update:visible="(v) => { dirModal.visible = v }">
    <div class="fm-field"><label>上级目录</label><div class="fm-static">{{ dirParentLabel }}</div></div>
    <div class="fm-field">
      <label><i class="req">*</i>目录名称</label>
      <input v-model="dirModal.name" placeholder="请输入目录名称" autocomplete="off">
    </div>
    <template #footer>
      <button type="button" class="btn" style="min-width:88px" @click="dirModal.visible = false">取消</button>
      <button type="button" class="btn primary" style="min-width:88px" @click="confirmDir">保存</button>
    </template>
  </AppModal>

  <AppModal :visible="delModal.visible" :title="delModal.title" icon="warning" danger :width="440" @update:visible="(v) => { delModal.visible = v }">
    <div class="tip">{{ delModal.msg }}</div>
    <template #footer>
      <button type="button" class="btn" style="min-width:88px" @click="delModal.visible = false">取消</button>
      <button type="button" class="btn primary" style="min-width:88px" @click="confirmDel">删除</button>
    </template>
  </AppModal>

  <TableEditor :key="`${editorId || 'none'}-${editorNonce}`" :table-id="editorId" :preview="previewMode" @close="closeEditor" />
</template>
