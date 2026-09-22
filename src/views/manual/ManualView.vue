<script setup>
import { computed, reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import ExcelJS from 'exceljs'
import { DEMO_TPL1, DEMO_TPL2, MANUAL_FREQS, useManualStore } from '../../stores/manual'
import { useIndicatorStore } from '../../stores/indicators'
import DirTree from '../../components/DirTree.vue'
import DirPathPicker from '../../components/DirPathPicker.vue'
import Icon from '../../components/Icon.vue'
import AppModal from '../../components/AppModal.vue'

const store = useManualStore()
const indicators = useIndicatorStore()
const dirCollapsed = ref(false)
const dirModal = reactive({ visible: false, mode: 'add', parent: '', name: '' })
const delModal = reactive({ visible: false, kind: '', title: '', msg: '', path: '', ids: [] })
const importVisible = ref(false)
const previewVisible = ref(false)
const previewDone = ref(false)
const importFileName = ref('—')
const pendingRows = ref([])
const importResult = reactive({ ok: 0, fail: 0, failRows: [] })
const fileInput = ref(null)
const lightbox = ref('')
const jump = ref(1)
const joinVisible = ref(false)
const joinStep = ref(1)
const libDirMode = ref('split')
const libSel = ref({})
const libEdit = ref([])
const libFilter = reactive({ cat: '', freq: '', kw: '' })

const dirParentLabel = computed(() => {
  if (dirModal.mode === 'edit') {
    const parts = dirModal.parent.split('/').filter(Boolean)
    return parts.length > 1 ? parts.slice(0, -1).join('/') : '根目录（一级目录）'
  }
  return dirModal.parent || '根目录（一级目录）'
})
const selectedIds = computed(() => Object.keys(store.selected).filter((id) => store.selected[id]))
const pageAllChecked = computed(() => store.paged.length > 0 && store.paged.every((x) => store.selected[x.id]))
const pageNums = computed(() => {
  const n = store.pageCount
  const cur = store.page
  const start = Math.max(1, Math.min(cur - 2, n - 4))
  return Array.from({ length: Math.min(5, n) }, (_, i) => start + i).filter((p) => p >= 1 && p <= n)
})
const dirTops = computed(() => store.dirs.map((d) => d.name))
const previewNames = computed(() => {
  const set = new Set()
  pendingRows.value.forEach((r) => { if (r.name) set.add(r.name) })
  return set.size
})
const libPool = computed(() => store.indicators.filter((x) => !store.joined[x.id]))
const libPickList = computed(() => libPool.value.filter((p) => {
  const dir = p.dir || ''
  if (libFilter.cat && dir !== libFilter.cat && !dir.startsWith(`${libFilter.cat}/`)) return false
  if (libFilter.freq && (p.freq || '日度') !== libFilter.freq) return false
  const kw = libFilter.kw.trim().toLowerCase()
  if (kw && !(`${p.id} ${p.name}`).toLowerCase().includes(kw)) return false
  return true
}))
const libPickIds = computed(() => Object.keys(libSel.value).filter((id) => libSel.value[id]))
const libPickAll = computed(() => libPickList.value.length > 0 && libPickList.value.every((p) => libSel.value[p.id]))

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
    visible: true, kind: 'dir', path, ids: [], title: '删除目录',
    msg: cnt > 0
      ? `目录「${label}」下仍有 ${cnt} 个指标，须先移出或删除指标后再删目录。`
      : `确认删除目录「${label}」？删除后不可恢复。`,
  })
}
function confirmDel() {
  if (delModal.kind === 'dir') {
    if (store.dirCount(delModal.path) > 0) return Message.warning('目录下仍有指标，不能删除')
    const r = store.removeDir(delModal.path)
    if (!r.ok) return Message.error(r.msg)
    Message.success(`已删除目录：${delModal.path.split('/').pop()}`)
  } else {
    store.removeByIds(delModal.ids)
    Message.success(`已删除 ${delModal.ids.length} 个指标`)
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
  if (r.path) store.currentDir = r.path
  dirModal.visible = false
  Message.success(dirModal.mode === 'edit' ? '目录已保存' : `已添加目录：${name}`)
}
function selectDir(path) {
  store.currentDir = path
  store.setPage(1)
}
function onDropDir(from, target) {
  const r = store.moveDir(from, target)
  if (!r.ok) return Message.error(r.msg)
  if (!r.skipped) Message.success(r.msg || '目录已移动')
}
function toggleRow(id, on) { store.toggleSelect(id, on) }
function togglePageAll() {
  const on = !pageAllChecked.value
  store.paged.forEach((x) => store.toggleSelect(x.id, on))
}
function openBatchDel() {
  if (!selectedIds.value.length) return
  Object.assign(delModal, {
    visible: true, kind: 'items', path: '', ids: selectedIds.value.slice(), title: '批量删除',
    msg: `确认删除已选 ${selectedIds.value.length} 个指标？删除后不可恢复。`,
  })
}

function downloadBlob(buf, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 800)
}
async function writeSheet(name, header, data) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(name)
  ws.addRow(header)
  data.forEach((row) => ws.addRow(row))
  return wb.xlsx.writeBuffer()
}
async function downloadTemplate(kind) {
  const header = ['品种/Variety', '指标名称/Indicator Name', '指标日期/Indicator Date', '值/Value', '单位/Unit']
  const src = kind === 2 ? DEMO_TPL2 : DEMO_TPL1
  const rows = src.filter((r) => r.name).map((r) => [r.variety, r.name, r.date, r.value, r.unit])
  const buf = await writeSheet(`模板${kind}`, header, rows)
  downloadBlob(buf, `数据导入模板${kind}.xlsx`)
  Message.success(`已下载模板${kind}`)
}
async function exportExcel() {
  const list = store.filtered
  if (!list.length) return Message.warning('当前没有可导出的数据')
  const buf = await writeSheet('手工录入数据', ['指标ID', '指标名称', '所属目录', '品种', '单位', '创建人', '最新日期', '最新值'], list.map((x) => [x.id, x.name, x.dir || '', x.variety || '', x.unit, x.creator, x.latestDate, x.latestVal]))
  downloadBlob(buf, '手工录入数据导出.xlsx')
  Message.success(`已导出 ${list.length} 个指标`)
}
async function downloadFailList(list) {
  const rows = (list || store.failRows).map((r) => [r.variety, r.name, r.date, r.value, r.unit, r.note || ''])
  if (!rows.length) return Message.info('暂无失败数据')
  const buf = await writeSheet('导入失败数据', ['品种/Variety', '指标名称/Indicator Name', '指标日期/Indicator Date', '值/Value', '单位/Unit', '备注/Note'], rows)
  downloadBlob(buf, '失败列表.xlsx')
}

function cellText(v) {
  if (v == null || v === '') return ''
  if (v instanceof Date) {
    const p = (n) => String(n).padStart(2, '0')
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`
  }
  if (typeof v === 'object') {
    if (v.result != null) return cellText(v.result)
    if (v.text) return String(v.text).trim()
    if (v.richText) return v.richText.map((t) => t.text).join('').trim()
  }
  const s = String(v).trim()
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('/')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return s
}
function headerKey(text) {
  const t = String(text || '').toLowerCase()
  if (/品种|variety/.test(t)) return 'variety'
  if (/名称|name/.test(t) && !/目录/.test(t)) return 'name'
  if (/日期|date/.test(t)) return 'date'
  if (/值|value/.test(t) && !/单位/.test(t)) return 'value'
  if (/单位|unit/.test(t)) return 'unit'
  if (/频度|频率|freq/.test(t)) return 'freq'
  if (/目录|dir/.test(t)) return 'dir'
  return ''
}
async function parseWorkbook(buf) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  const ws = wb.worksheets[0]
  if (!ws) return []
  const map = {}
  const first = ws.getRow(1)
  first.eachCell((cell, col) => {
    const k = headerKey(cellText(cell.value))
    if (k) map[col] = k
  })
  const fallback = { 1: 'variety', 2: 'name', 3: 'date', 4: 'value', 5: 'unit' }
  const colMap = Object.keys(map).length ? map : fallback
  const out = []
  ws.eachRow((row, i) => {
    if (i === 1) return
    const rec = { variety: '', name: '', date: '', value: '', unit: '', freq: '', dir: '' }
    Object.entries(colMap).forEach(([col, key]) => { rec[key] = cellText(row.getCell(Number(col)).value) })
    if (Object.values(rec).some((v) => String(v).trim())) out.push(rec)
  })
  return out
}
function openImport() {
  previewDone.value = false
  pendingRows.value = []
  importResult.ok = 0
  importResult.fail = 0
  importResult.failRows = []
  importVisible.value = true
}
function pickFile() { fileInput.value?.click() }
async function onFileChange(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  let rows = []
  try {
    rows = await parseWorkbook(await file.arrayBuffer())
    if (!rows.length) return Message.warning('空数据模板不允许导入')
  } catch {
    const name = file.name || ''
    rows = /模板2|template\s*2/i.test(name)
      ? DEMO_TPL2.map((r) => ({ ...r }))
      : DEMO_TPL1.map((r) => ({ ...r }))
  }
  if (!rows.length) return Message.warning('空数据模板不允许导入')
  importFileName.value = file.name
  pendingRows.value = rows
  importVisible.value = false
  previewDone.value = false
  previewVisible.value = true
  Message.success(`解析成功 ${rows.length} 行，请确认预览`)
}
function confirmImport() {
  if (!pendingRows.value.length) return Message.warning('请先上传文件')
  const result = store.upsertRows(pendingRows.value)
  pendingRows.value = []
  importResult.ok = result.ok
  importResult.fail = result.fail
  importResult.failRows = result.failRows
  previewDone.value = true
  if (result.fail) Message.warning('部分导入成功，可下载失败列表')
  else Message.success(`导入成功 ${result.ok} 条`)
}

function openJoin() {
  const next = {}
  selectedIds.value.forEach((id) => { if (!store.joined[id]) next[id] = true })
  libSel.value = next
  libEdit.value = []
  libDirMode.value = 'split'
  libFilter.cat = store.currentDir ? store.currentDir.split('/')[0] : ''
  libFilter.freq = ''
  libFilter.kw = ''
  joinStep.value = 1
  joinVisible.value = true
}
function toggleLib(id, on) {
  if (on) libSel.value[id] = true
  else delete libSel.value[id]
}
function toggleLibAll() {
  const on = !libPickAll.value
  libPickList.value.forEach((p) => toggleLib(p.id, on))
}
function buildLibEdit() {
  const defDir = store.currentDir || '中国宏观'
  const prev = {}
  libEdit.value.forEach((r) => { prev[r.id] = r })
  const byId = {}
  libPool.value.forEach((x) => { byId[x.id] = x })
  libEdit.value = libPickIds.value.map((id) => {
    if (prev[id]) return prev[id]
    const p = byId[id]
    return {
      id,
      name: p?.name || id,
      unit: p?.unit || '',
      freq: p?.freq || '日度',
      dir: p?.dir || defDir,
    }
  })
  if (libDirMode.value === 'same' && libEdit.value.length) {
    const same = libEdit.value[0].dir || defDir
    libEdit.value.forEach((r) => { r.dir = same })
  }
}
function setDirMode(mode) {
  libDirMode.value = mode
  if (mode === 'same' && libEdit.value.length) {
    const same = libEdit.value[0].dir || store.currentDir || '中国宏观'
    libEdit.value.forEach((r) => { r.dir = same })
  }
}
function setSameDir(dir) {
  libEdit.value.forEach((r) => { r.dir = dir })
}
function joinNext() {
  if (joinStep.value === 1) {
    if (!libPickIds.value.length) return Message.warning('请至少勾选一个指标')
    buildLibEdit()
    joinStep.value = 2
    return
  }
  for (const row of libEdit.value) {
    if (!row.name) return Message.warning(`请填写指标名称：${row.id}`)
    if (!row.unit) return Message.warning(`请填写单位：${row.id}`)
    if (!row.freq) return Message.warning(`请选择频度：${row.id}`)
    if (!row.dir) return Message.warning(`请选择指标目录：${row.id}`)
  }
  const fresh = libEdit.value.filter((row) => !store.joined[row.id])
  if (!fresh.length) return Message.warning('所选指标均已加入指标库')
  store.markJoined(fresh)
  indicators.addBase(fresh.map((row) => ({
    id: row.id,
    title: row.name,
    unit: row.unit,
    freq: row.freq,
    dir: row.dir,
    source: '手工',
    latest: store.indicators.find((x) => x.id === row.id)?.latestVal,
    latestDate: store.indicators.find((x) => x.id === row.id)?.latestDate,
  })), fresh[fresh.length - 1].dir)
  const lastDir = fresh[fresh.length - 1].dir
  store.currentDir = lastDir
  store.clearSelected()
  joinVisible.value = false
  Message.success(`已加入指标库 ${fresh.length} 条，目录「${lastDir}」（来源：手工）`)
}
function goPage(n) {
  store.setPage(n)
  jump.value = store.page
}
function jumpPage() { goPage(Number(jump.value) || 1) }
</script>

<template>
  <div class="md-page ind-page">
    <aside class="dir-panel ic-dir-panel" :class="{ collapsed: dirCollapsed }">
      <div class="dir-head">
        <h2>目录</h2>
        <label class="only-mine"><input type="checkbox" v-model="store.filters.onlyMine">只看我的</label>
      </div>
      <div class="dir-search">
        <div class="ds-input">
          <Icon name="search" :size="13" />
          <input v-model="store.filters.kw" placeholder="指标ID/指标名称" autocomplete="off" @input="store.setPage(1)">
        </div>
      </div>
      <DirTree
        :tree="store.dirs"
        :current="store.currentDir"
        :count-of="store.dirCount"
        :movable-dirs="true"
        @select="selectDir"
        @add="onAdd"
        @edit="onEdit"
        @remove="onRemoveDir"
        @drop-dir="onDropDir"
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

    <section class="md-main">
      <div class="md-toolbar">
        <button type="button" class="btn primary" @click="openImport">导入数据</button>
        <button type="button" class="btn primary" title="勾选手工指标并确认目录后加入指标库" @click="openJoin">批量加入指标库</button>
        <button type="button" class="btn soft" :disabled="!selectedIds.length" @click="openBatchDel">批量删除</button>
        <button type="button" class="btn linkish" @click="exportExcel">导出excel <span title="按当前筛选结果导出">ⓘ</span></button>
      </div>
      <div class="md-count">共 <b>{{ store.filtered.length }}</b> 个指标</div>
      <div class="md-table-wrap">
        <div v-if="!store.filtered.length" class="md-empty">
          <svg width="120" height="90" viewBox="0 0 120 90" fill="none" aria-hidden="true">
            <ellipse cx="60" cy="78" rx="34" ry="6" fill="#eef0f4"/>
            <rect x="34" y="28" width="52" height="40" rx="6" fill="#e8ebf0" stroke="#d5dae3"/>
            <path d="M44 40h32M44 50h20" stroke="#c5ccd8" stroke-width="3" stroke-linecap="round"/>
            <circle cx="86" cy="24" r="10" fill="#dbe7ff" stroke="#9db7ff"/>
            <path d="M86 20v5M83.5 26.5h5" stroke="#2f6bff" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
          <div>暂无数据</div>
        </div>
        <table v-else class="list-table md-table">
          <thead>
            <tr>
              <th style="width:42px"><input type="checkbox" :checked="pageAllChecked" @change="togglePageAll"></th>
              <th>指标ID</th>
              <th>指标名称</th>
              <th>所属目录</th>
              <th>单位</th>
              <th>创建人</th>
              <th>最新日期</th>
              <th>最新值</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="x in store.paged" :key="x.id">
              <td><input type="checkbox" :checked="!!store.selected[x.id]" @change="toggleRow(x.id, $event.target.checked)"></td>
              <td class="lt-id">{{ x.id }}</td>
              <td :title="x.name">{{ x.name }}</td>
              <td>{{ x.dir || '—' }}</td>
              <td>{{ x.unit }}</td>
              <td>{{ x.creator }}</td>
              <td>{{ x.latestDate }}</td>
              <td class="lt-num">{{ x.latestVal }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="md-pager">
        <span>共{{ store.filtered.length }}条</span>
        <button type="button" :disabled="store.page <= 1" @click="goPage(store.page - 1)">‹</button>
        <button v-for="p in pageNums" :key="p" type="button" :class="{ on: p === store.page }" @click="goPage(p)">{{ p }}</button>
        <button type="button" :disabled="store.page >= store.pageCount" @click="goPage(store.page + 1)">›</button>
        <span>前往</span>
        <input v-model="jump" @keyup.enter="jumpPage">
        <span>页</span>
      </div>
    </section>
  </div>

  <AppModal :visible="importVisible" title="导入数据" icon="g-6541007a" :width="560" @update:visible="(v) => { importVisible = v }">
    <div class="imp-sec">
      <div class="imp-sec-title">导入数据</div>
      <div class="imp-upload-wrap">
        <button type="button" class="btn primary imp-upload-btn" @click="pickFile">
          <Icon name="g-7189b4be" :size="15" />导入数据
        </button>
        <div class="imp-upload-hint">上传已填写的 Excel 模板；解析成功后将打开独立预览弹窗确认入库。</div>
      </div>
      <input ref="fileInput" type="file" accept=".xlsx,.xls" hidden @change="onFileChange">
    </div>
    <div class="imp-steps">
      <div>1.第一步，点击「导入数据」上传已填写模板；空数据模板不允许导入。</div>
      <div>2.第二步，在预览弹窗核对数据后确认导入。</div>
      <div>3.第三步，完成导入。若有失败数据，可下载 <a href="javascript:void(0)" @click="downloadFailList()">导入失败列表</a>。</div>
    </div>
    <div class="imp-divider"></div>
    <div class="imp-sec" style="margin-bottom:0">
      <div class="imp-sec-title">下载导入模板</div>
      <div class="imp-tpls">
        <div class="imp-tpl">
          <button type="button" class="btn primary" @click="downloadTemplate(1)"><Icon name="download" :size="14" />模板1</button>
          <div class="imp-thumb" title="查看大图" @click="lightbox = '/manual-data/tpl1-preview.svg'">
            <img src="/manual-data/tpl1-preview.svg" alt="模板1预览">
          </div>
          <button type="button" class="imp-view" @click="lightbox = '/manual-data/tpl1-preview.svg'">查看大图</button>
        </div>
        <div class="imp-tpl">
          <button type="button" class="btn primary" @click="downloadTemplate(2)"><Icon name="download" :size="14" />模板2</button>
          <div class="imp-thumb" title="查看大图" @click="lightbox = '/manual-data/tpl2-preview.svg'">
            <img src="/manual-data/tpl2-preview.svg" alt="模板2预览">
          </div>
          <button type="button" class="imp-view" @click="lightbox = '/manual-data/tpl2-preview.svg'">查看大图</button>
        </div>
      </div>
    </div>
  </AppModal>

  <AppModal :visible="previewVisible" title="导入预览" icon="g-968fa17e" :width="720" @update:visible="(v) => { previewVisible = v }">
    <div v-if="previewDone" class="result-box show" :class="{ ok: !importResult.fail }">
      <template v-if="importResult.fail">
        成功导入 <b>{{ importResult.ok }}</b> 条，失败 <b>{{ importResult.fail }}</b> 条。
        <a href="javascript:void(0)" @click="downloadFailList(importResult.failRows)">下载失败列表</a>
      </template>
      <template v-else>全部导入成功，共 <b>{{ importResult.ok }}</b> 条数据。</template>
    </div>
    <div v-if="!previewDone" class="preview-meta">
      <span>文件：<b>{{ importFileName }}</b> · 共 <b>{{ pendingRows.length }}</b> 条 / <b>{{ previewNames }}</b> 个指标</span>
    </div>
    <div v-if="!previewDone" class="tip">请核对下方解析结果，确认无误后入库。空名称等无效行将记入失败列表。</div>
    <div class="preview-table-wrap">
      <table>
        <thead><tr><th>品种</th><th>指标名称</th><th>指标日期</th><th>值</th><th>单位</th></tr></thead>
        <tbody>
          <tr v-for="(r, i) in pendingRows" :key="i">
            <td>{{ r.variety }}</td>
            <td><span v-if="r.name">{{ r.name }}</span><span v-else style="color:#e34d59">（空）</span></td>
            <td>{{ r.date }}</td>
            <td>{{ r.value }}</td>
            <td>{{ r.unit }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <template #footer>
      <template v-if="!previewDone">
        <button type="button" class="btn" style="min-width:88px" @click="previewVisible = false">取消</button>
        <button type="button" class="btn primary" style="min-width:96px" :disabled="!pendingRows.length" @click="confirmImport">确认导入</button>
      </template>
      <button v-else type="button" class="btn primary" style="min-width:96px" @click="previewVisible = false">完成</button>
    </template>
  </AppModal>

  <AppModal :visible="joinVisible" title="批量加入指标库" icon="unlink" :width="1040" overflow-visible @update:visible="(v) => { joinVisible = v }">
    <div class="tip">从手工录入指标中勾选，再确认名称 / 单位 / 频度，并绑定到目标目录后加入指标中心（与三源「目录绑定」交互一致）。</div>
    <div class="bind-steps">
      <div class="bind-step" :class="{ on: joinStep === 1, done: joinStep === 2 }"><span class="bs-n">1</span>选择指标</div>
      <div class="bind-step-line"></div>
      <div class="bind-step" :class="{ on: joinStep === 2 }"><span class="bs-n">2</span>确认加入</div>
    </div>
    <div v-if="joinStep === 1">
      <div class="pick-bar">
        <a-select v-model="libFilter.cat" allow-clear placeholder="筛选目录" style="width:132px" size="small">
          <a-option v-for="n in dirTops" :key="n" :value="n">{{ n }}</a-option>
        </a-select>
        <a-select v-model="libFilter.freq" allow-clear placeholder="筛选频度" style="width:120px" size="small">
          <a-option v-for="f in MANUAL_FREQS" :key="f" :value="f">{{ f }}</a-option>
        </a-select>
        <div class="pick-search">
          <Icon name="search" :size="13" />
          <input v-model="libFilter.kw" placeholder="指标ID/指标名称" autocomplete="off">
        </div>
        <label class="pick-check"><input type="checkbox" :checked="libPickAll" @change="toggleLibAll">列表全选</label>
        <span class="pick-count">已选: <b>{{ libPickIds.length }}</b></span>
      </div>
      <div class="pick-table-wrap">
        <table class="pick-table">
          <thead>
            <tr>
              <th style="width:40px"></th>
              <th style="width:120px">指标ID</th>
              <th>指标名称</th>
              <th style="width:110px">最新日期</th>
              <th style="width:100px;text-align:right">最新值</th>
              <th style="width:70px">频度</th>
              <th style="width:80px">单位</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!libPickList.length">
              <td colspan="7" style="text-align:center;color:var(--text-3);padding:28px">暂无匹配指标（已加入的不再展示）</td>
            </tr>
            <tr v-for="p in libPickList" :key="p.id" :class="{ on: libSel[p.id] }" @click="toggleLib(p.id, !libSel[p.id])">
              <td><input type="checkbox" :checked="!!libSel[p.id]" @click.stop @change="toggleLib(p.id, $event.target.checked)"></td>
              <td>{{ p.id }}</td>
              <td class="pt-name" :title="p.name">{{ p.name }}</td>
              <td>{{ p.latestDate }}</td>
              <td class="pt-num">{{ p.latestVal }}</td>
              <td>{{ p.freq || '日度' }}</td>
              <td>{{ p.unit }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else class="bind-edit-wrap">
      <table class="bind-edit">
        <thead>
          <tr>
            <th style="width:120px">指标ID</th>
            <th>指标名称</th>
            <th style="width:110px">单位</th>
            <th style="width:100px">频度</th>
            <th style="width:240px">
              <div class="be-dir-head">
                <span>指标目录</span>
                <div class="be-mode">
                  <label><input type="radio" name="libDirMode" value="split" :checked="libDirMode === 'split'" @change="setDirMode('split')">分目录</label>
                  <label><input type="radio" name="libDirMode" value="same" :checked="libDirMode === 'same'" @change="setDirMode('same')">同目录</label>
                </div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in libEdit" :key="row.id">
            <td class="be-id">{{ row.id }}</td>
            <td class="be-name"><input v-model="row.name" type="text" placeholder="请输入指标名称"></td>
            <td class="be-unit"><input v-model="row.unit" type="text" placeholder="单位"></td>
            <td class="be-freq">
              <a-select v-model="row.freq" size="small">
                <a-option v-for="f in MANUAL_FREQS" :key="f" :value="f">{{ f }}</a-option>
              </a-select>
            </td>
            <td class="be-dir">
              <DirPathPicker
                :model-value="row.dir"
                :tree="store.dirs"
                @update:model-value="(v) => libDirMode === 'same' ? setSameDir(v) : row.dir = v"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <template #footer>
      <button v-if="joinStep === 2" type="button" class="btn" style="min-width:88px" @click="joinStep = 1">上一步</button>
      <button type="button" class="btn primary" style="min-width:88px" @click="joinNext">{{ joinStep === 1 ? '下一步' : '确认加入' }}</button>
      <button v-if="joinStep === 1" type="button" class="btn" style="min-width:88px" @click="joinVisible = false">取消</button>
    </template>
  </AppModal>

  <AppModal :visible="dirModal.visible" :title="dirModal.mode === 'edit' ? '编辑目录' : '添加目录'" :icon="dirModal.mode === 'edit' ? 'edit-fill' : 'plus-16'" :width="420" @update:visible="(v) => { dirModal.visible = v }">
    <div class="fm-field">
      <label>上级目录</label>
      <div class="fm-static">{{ dirParentLabel }}</div>
    </div>
    <div class="fm-field">
      <label><i class="req">*</i>目录名称</label>
      <input v-model="dirModal.name" placeholder="请输入目录名称" autocomplete="off">
    </div>
    <template #footer>
      <button type="button" class="btn" style="min-width:88px" @click="dirModal.visible = false">取消</button>
      <button type="button" class="btn primary" style="min-width:88px" @click="confirmDir">保存</button>
    </template>
  </AppModal>

  <AppModal :visible="delModal.visible" :title="delModal.title" icon="g-557e9ce3" danger :width="440" @update:visible="(v) => { delModal.visible = v }">
    <div class="tip">{{ delModal.msg }}</div>
    <template #footer>
      <button type="button" class="btn" style="min-width:88px" @click="delModal.visible = false">取消</button>
      <button
        v-if="!(delModal.kind === 'dir' && store.dirCount(delModal.path) > 0)"
        type="button"
        class="btn primary"
        style="min-width:88px"
        @click="confirmDel"
      >删除</button>
    </template>
  </AppModal>

  <Teleport to="body">
    <div v-if="lightbox" class="md-lightbox" @click.self="lightbox = ''">
      <button type="button" class="lb-x" @click="lightbox = ''">✕</button>
      <img :src="lightbox" alt="模板大图">
    </div>
  </Teleport>
</template>
