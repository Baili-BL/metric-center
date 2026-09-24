<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useTableStore } from '../../stores/tables'
import { ME, PEOPLE } from '../../utils/hash'
import { workbookToXlsx } from '../../utils/workbook'
import FortuneSheet from '../../components/FortuneSheet.vue'
import {
  PIVOT_AGGS, absCellRef, absRangeRef, addFieldTo, applyPivotConfig, buildPivotMatrix,
  emptyPivot, extractPivotSource, fieldUsed, filterLabel, guessZone, listWorkbookSheets,
  parseA1Cell, parseA1Range, removeField, sheetUsedRange, toPivotConfig, uniqueFieldValues,
  valueLabel, writePivotToSheet,
} from '../../utils/pivot'
import Icon from '../../components/Icon.vue'
import AppModal from '../../components/AppModal.vue'

const props = defineProps({
  tableId: { type: String, default: '' },
})
const emit = defineEmits(['close'])
const store = useTableStore()

const open = computed(() => !!props.tableId)
const table = computed(() => store.get(props.tableId))
const sheetRef = ref(null)
const savedFlash = ref(false)
const titleEditing = ref(false)
const titleDraft = ref('')
const titleInput = ref(null)
const pivotOpen = ref(false)
const pivotKw = ref('')
const pop = reactive({ show: false, left: '0px', top: '0px', kind: '', zone: '', index: -1 })
const drag = reactive({ idx: -1, from: '' })
const overZone = ref('')
const wizard = reactive({
  visible: false,
  srcType: 'range',
  placeType: 'existing',
  srcRange: '',
  dstCell: '',
})
const pub = reactive({ visible: false, approver: '', reason: '' })
const pivot = reactive(emptyPivot())
const approvers = PEOPLE.filter((p) => p !== ME)

let savedTimer = 0

const fieldList = computed(() => pivot.headers.map((h, i) => ({ i, h })).filter((x) => {
  const kw = pivotKw.value.trim().toLowerCase()
  return !kw || String(x.h).toLowerCase().includes(kw)
}))

function setPageIcon(href) {
  const icon = document.querySelector('link[rel="icon"]') || document.head.appendChild(document.createElement('link'))
  icon.rel = 'icon'
  icon.type = 'image/svg+xml'
  icon.href = href
}

watch(() => props.tableId, async (id, prev) => {
  document.body.classList.toggle('tbl-editor-open', !!id)
  titleEditing.value = false
  if (!id) {
    closePivot(true)
    setPageIcon('/ailab-mark.svg')
    return
  }
  if (prev && prev !== id) capture()
  setPageIcon('/excel-file.svg')
  await loadCurrent()
}, { immediate: true })
watch(sheetRef, (el) => {
  if (el && props.tableId) loadCurrent()
})

function startRename() {
  if (!table.value) return
  titleDraft.value = table.value.title || ''
  titleEditing.value = true
  nextTick(() => {
    titleInput.value?.focus()
    titleInput.value?.select()
  })
}
function commitRename() {
  if (!titleEditing.value) return
  const name = titleDraft.value.trim()
  titleEditing.value = false
  if (!table.value) return
  if (!name) {
    titleDraft.value = table.value.title || ''
    Message.error('请填写表格名称')
    return
  }
  if (name === table.value.title) return
  store.renameTable(props.tableId, name)
  Message.success('名称已更新')
}
function cancelRename() {
  titleEditing.value = false
  titleDraft.value = table.value?.title || ''
}

function onEsc(e) {
  if (e.key !== 'Escape' || !open.value) return
  if (titleEditing.value) { cancelRename(); return }
  if (wizard.visible) { wizard.visible = false; return }
  if (pop.show) { pop.show = false; return }
  if (pub.visible) { pub.visible = false; return }
  if (pivotOpen.value) { closePivot(); return }
  close()
}
window.addEventListener('keydown', onEsc)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEsc)
  document.body.classList.remove('tbl-editor-open')
  setPageIcon('/ailab-mark.svg')
  clearTimeout(savedTimer)
})

async function capture() {
  if (!sheetRef.value || !props.tableId) return { ok: false, msg: '表格未就绪' }
  const snap = sheetRef.value.snapshot()
  if (!snap) return { ok: false, msg: '未能读取当前表格内容' }
  const thumb = sheetRef.value.captureThumb()
  return store.saveWorkbook(props.tableId, snap, snap.__preview, thumb)
}

async function flushAndCapture() {
  return capture()
}

async function loadCurrent() {
  const t = store.get(props.tableId)
  if (!t) return
  applyPivotConfig(pivot, t.pivotConfig)
  pivotOpen.value = false
  await nextTick()
  sheetRef.value?.load(t.workbook || { id: t.id, name: t.title, sheetOrder: [], sheets: {} })
}

async function close() {
  await flushAndCapture()
  closePivot(true)
  document.body.classList.remove('tbl-editor-open')
  emit('close')
}

async function onSave() {
  const t = table.value
  if (!t) return Message.error('请先选择或创建一张表格')
  const result = await flushAndCapture()
  if (!result?.ok) return Message.error(result?.msg || '保存失败，请稍后重试')
  savedFlash.value = true
  clearTimeout(savedTimer)
  savedTimer = setTimeout(() => { savedFlash.value = false }, 1800)
  if (result.persisted === false) Message.warning('预览已更新，但本地缓存写入失败')
  else Message.success(`已保存「${t.title}」`)
}

async function onExport() {
  capture()
  const t = table.value
  if (!t) return Message.error('请先打开一张表格')
  const buf = await workbookToXlsx(t.workbook, t.title)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  a.download = `${t.title}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 800)
  Message.success('已导出 Excel（.xlsx）')
}

function openPublish() {
  const t = table.value
  if (!t) return Message.error('请先打开一张表格')
  capture()
  pub.approver = t.publish?.approver || ''
  pub.reason = t.publish?.reason || ''
  pub.visible = true
}
function confirmPublish() {
  if (!pub.approver) return Message.error('请选择审批人')
  const r = store.submitPublish(props.tableId, { approver: pub.approver, reason: pub.reason })
  if (!r.ok) return Message.error(r.msg)
  pub.visible = false
  Message.success(`已提交发布申请，待 ${pub.approver} 审批`)
}

function liveSheetName() {
  return sheetRef.value?.getActiveSheetName() || listWorkbookSheets(table.value?.workbook)[0]?.name || '数据'
}
function liveSelectionRange() {
  return sheetRef.value?.getSelection() || null
}
function snapshotSheetByName(name) {
  capture()
  const list = listWorkbookSheets(table.value?.workbook)
  if (!list.length) return null
  if (!name) return list[0].sheet
  return list.find((p) => p.name === name)?.sheet || list[0].sheet
}

function openPivotWizard() {
  capture()
  const name = liveSheetName()
  const sheet = snapshotSheetByName(name)
  if (!sheet) return Message.error('当前没有可透视的数据')
  const used = sheetUsedRange(sheet)
  if (!used || used.endRow < 1) return Message.error('请先准备带表头的数据区域')
  const sel = liveSelectionRange()
  const range = (sel && sel.endRow > sel.startRow) ? sel : used
  wizard.srcType = 'range'
  wizard.placeType = 'existing'
  wizard.srcRange = absRangeRef(name, range)
  wizard.dstCell = absCellRef(name, range.startRow, range.endColumn + 2)
  wizard.visible = true
}
function pickSrc() {
  const name = liveSheetName()
  const sel = liveSelectionRange()
  const used = sheetUsedRange(snapshotSheetByName(name))
  const range = (sel && sel.endRow > sel.startRow) ? sel : used
  if (!range) return Message.error('请先框选数据区域')
  wizard.srcRange = absRangeRef(name, range)
}
function pickDst() {
  const name = liveSheetName()
  const sel = liveSelectionRange()
  wizard.dstCell = absCellRef(name, sel ? sel.startRow : 0, sel ? sel.startColumn : 0)
}
async function insertPivotSheet(name) {
  return sheetRef.value?.addSheet(name) || null
}
async function confirmWizard() {
  if (wizard.srcType !== 'range') return Message.info('当前仅支持选择单元格区域')
  const range = parseA1Range(wizard.srcRange)
  if (!range || range.endRow <= range.startRow) return Message.error('请输入有效的数据区域')
  const srcMatch = String(wizard.srcRange).match(/^(?:'([^']+)'|([^!]+))!/)
  const srcName = (srcMatch && (srcMatch[1] || srcMatch[2])) || liveSheetName()
  pivot.sourceName = srcName
  pivot.filters = []
  pivot.rowsF = []
  pivot.cols = []
  pivot.values = []
  const sheet = snapshotSheetByName(srcName)
  const src = sheet ? extractPivotSource(sheet, range) : null
  if (!src?.headers.length || !src.rows.length) return Message.error('数据透视至少需要表头和一行数据')
  pivot.headers = src.headers
  pivot.rows = src.rows
  pivot.range = range
  let place = wizard.placeType
  if (place === 'new') {
    let sheetName = '数据透视表'
    let n = 1
    const list = listWorkbookSheets(table.value?.workbook)
    while (list.some((p) => p.name === sheetName)) { n++; sheetName = `数据透视表${n}` }
    const created = await insertPivotSheet(sheetName)
    if (!created) {
      Message.info('无法创建新工作表，已放到当前表')
      place = 'existing'
    } else {
      pivot.outName = sheetName
      pivot.out = { startRow: 0, startColumn: 0, rows: 0, cols: 0 }
    }
  }
  if (place !== 'new') {
    pivot.outName = liveSheetName()
    const cell = parseA1Cell(wizard.dstCell)
    pivot.out = {
      startRow: cell ? cell.row : range.startRow,
      startColumn: cell ? cell.col : range.endColumn + 2,
      rows: 0,
      cols: 0,
    }
  }
  wizard.visible = false
  pivot.open = true
  pivotOpen.value = true
  pivotKw.value = ''
  persistPivot()
  setTimeout(() => window.dispatchEvent(new Event('resize')), 40)
}
function persistPivot() {
  if (props.tableId) store.savePivotConfig(props.tableId, toPivotConfig(pivot))
}
function closePivot(skipResize) {
  pivot.open = false
  pivotOpen.value = false
  pop.show = false
  if (!skipResize) setTimeout(() => window.dispatchEvent(new Event('resize')), 40)
}

function writeUniverBlock(startRow, startCol, matrix, headerRows) {
  if (!matrix?.length || !matrix[0]?.length) return false
  return !!sheetRef.value?.writeBlock(pivot.outName, startRow, startCol, matrix, headerRows)
}

async function refreshPivotTable() {
  if (!pivot.open) return
  const matrix = buildPivotMatrix(pivot)
  const used = sheetUsedRange(snapshotSheetByName(pivot.sourceName))
  const startRow = pivot.out?.startRow != null ? pivot.out.startRow : (used ? used.startRow : 0)
  const startCol = pivot.out?.startColumn != null ? pivot.out.startColumn : ((used ? used.endColumn : 0) + 2)
  const headerRows = matrix.length && pivot.cols.length && pivot.values.length > 1 ? 2 : (matrix.length ? 1 : 0)
  if (pivot.out?.rows && pivot.out?.cols) {
    const empty = Array.from({ length: pivot.out.rows }, () => Array.from({ length: pivot.out.cols }, () => ''))
    writeUniverBlock(pivot.out.startRow, pivot.out.startColumn, empty, 0)
  }
  if (!matrix.length) {
    pivot.out = { startRow, startColumn: startCol, rows: 0, cols: 0 }
    persistPivot()
    return
  }
  const ok = writeUniverBlock(startRow, startCol, matrix, headerRows)
  if (!ok) {
    capture()
    const list = listWorkbookSheets(table.value?.workbook)
    const pack = list.find((p) => pivot.outName && p.name === pivot.outName) || list[0]
    if (pack) {
      writePivotToSheet(pack.sheet, matrix, startRow, startCol, headerRows, pivot.out)
      store.saveWorkbook(props.tableId, table.value.workbook)
      sheetRef.value?.load(table.value.workbook)
    }
  } else {
    capture()
  }
  pivot.out = { startRow, startColumn: startCol, rows: matrix.length, cols: matrix[0].length }
  persistPivot()
}

function layoutChanged() {
  refreshPivotTable()
}
function onFieldCheck(idx, checked) {
  if (checked) addFieldTo(pivot, idx, guessZone(pivot, idx))
  else removeField(pivot, idx)
  layoutChanged()
}
function onDelField(idx) {
  removeField(pivot, idx)
  pop.show = false
  layoutChanged()
}
function startDrag(idx, from) {
  drag.idx = idx
  drag.from = from
}
function onDropZone(zone) {
  overZone.value = ''
  if (drag.idx < 0) return
  addFieldTo(pivot, drag.idx, zone)
  drag.idx = -1
  layoutChanged()
}
function onDropFields() {
  if (drag.idx < 0) return
  removeField(pivot, drag.idx)
  drag.idx = -1
  layoutChanged()
}
function showPop(kind, zone, index, el) {
  const rect = el.getBoundingClientRect()
  pop.kind = kind
  pop.zone = zone
  pop.index = index
  pop.show = true
  let left = Math.min(rect.left, window.innerWidth - 220)
  let top = rect.bottom + 4
  if (top + 220 > window.innerHeight) top = Math.max(8, rect.top - 224)
  pop.left = `${left}px`
  pop.top = `${top}px`
}
function setAgg(id) {
  const cur = pivot.values[pop.index]
  if (cur) cur.agg = id
  pop.show = false
  layoutChanged()
}
function applyFilterSel() {
  const f = pivot.filters[pop.index]
  if (f) {
    const selected = {}
    document.querySelectorAll('.pv-pop input[type=checkbox]').forEach((inp) => {
      selected[inp.value] = inp.checked
    })
    f.selected = selected
  }
  pop.show = false
  layoutChanged()
}
function addFromPop(idx) {
  addFieldTo(pivot, idx, pop.zone)
  pop.show = false
  layoutChanged()
}
function onDocPop(e) {
  if (!pop.show) return
  if (e.target.closest?.('.pv-pop, .pv-more, .pv-add')) return
  pop.show = false
}
document.addEventListener('mousedown', onDocPop)
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocPop))
</script>

<template>
  <Teleport to="body">
    <div class="editor-root" :class="{ open }" :aria-hidden="!open">
      <div class="editor-bar">
        <button type="button" class="editor-back" title="返回" @click="close()">
          <Icon name="chevron-left-12" :size="16" />
        </button>
        <div class="editor-heading">
          <div class="editor-title-box">
            <input
              v-if="titleEditing"
              ref="titleInput"
              v-model="titleDraft"
              class="editor-title-input"
              maxlength="60"
              spellcheck="false"
              :title="titleDraft || table?.title || '未命名表格'"
              @blur="commitRename"
              @keydown.enter.prevent="commitRename"
              @keydown.esc.stop="cancelRename"
            >
            <button
              v-else
              type="button"
              class="editor-title"
              :title="table?.title || '未命名表格'"
              @click="startRename"
            >{{ table?.title || '未命名表格' }}</button>
          </div>
          <span v-if="table?.publish?.status === 'pending'" class="pub-status">待 {{ table.publish.approver }} 审批</span>
          <div class="editor-meta">
            <span>修改人 <b>{{ table?.updater || '—' }}</b></span>
            <span>修改时间 <b>{{ table?.updated || table?.date || '—' }}</b></span>
          </div>
        </div>
        <div class="editor-acts">
          <button type="button" class="btn" @click="onSave">保存<span class="save-dot" :class="{ show: savedFlash }">有更新</span></button>
          <button type="button" class="btn" @click="onExport">导出</button>
        </div>
      </div>
      <div class="editor-stage">
        <FortuneSheet v-if="open" :key="`${tableId}-fold`" ref="sheetRef" @pivot="openPivotWizard" />
        <aside class="pv-panel" :class="{ open: pivotOpen }">
          <div class="pv-head">
            <span class="pv-title">数据透视表
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5L5 6.5L8 3.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>
            </span>
            <div class="pv-acts">
              <button type="button" class="pv-pin" title="固定">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 17v5M9 3h6l1 7h2l-5 5-5-5h2L9 3z"/></svg>
              </button>
              <button type="button" class="pv-x" title="关闭" @click="closePivot">✕</button>
            </div>
          </div>
          <div class="pv-sec">将字段拖动至数据透视表区域</div>
          <div class="pv-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>
            <input v-model="pivotKw" placeholder="搜索字段" spellcheck="false">
          </div>
          <div
            class="pv-fields"
            @dragover.prevent
            @drop.prevent="onDropFields"
          >
            <label
              v-for="f in fieldList"
              :key="f.i"
              class="pv-field"
              draggable="true"
              @dragstart="startDrag(f.i, 'fields')"
            >
              <span class="pv-grip">
                <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                  <circle cx="3" cy="3" r="1.2"/><circle cx="7" cy="3" r="1.2"/>
                  <circle cx="3" cy="8" r="1.2"/><circle cx="7" cy="8" r="1.2"/>
                  <circle cx="3" cy="13" r="1.2"/><circle cx="7" cy="13" r="1.2"/>
                </svg>
              </span>
              <input type="checkbox" :checked="fieldUsed(pivot, f.i)" @change="onFieldCheck(f.i, $event.target.checked)">
              <span>{{ f.h }}</span>
            </label>
            <div v-if="!fieldList.length" class="pv-ph" style="padding:10px">暂无字段</div>
          </div>
          <div class="pv-zones-wrap">
            <div class="pv-sec" style="padding:0 0 8px">在下面区域中拖动字段</div>
            <div class="pv-zones">
              <div
                v-for="z in [
                  { id: 'filters', name: '筛选器', icon: 'M4 5h16l-6 7v6l-4 1v-7L4 5z' },
                  { id: 'cols', name: '列', icon: 'M8 4h3v16H8zM14 4h3v16h-3z' },
                  { id: 'rows', name: '行', icon: 'M4 7h16M4 12h16M4 17h16' },
                  { id: 'values', name: '值', icon: 'M6 6h4v4H6zM6 14h4v4H6zM14 10h6M17 7v6' },
                ]"
                :key="z.id"
                class="pv-zone"
                :class="{ over: overZone === z.id }"
                :data-zone="z.id"
                @dragover.prevent="overZone = z.id"
                @dragleave="overZone = ''"
                @drop.prevent="onDropZone(z.id)"
              >
                <div class="pv-zone-h">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path :d="z.icon"/></svg>
                  {{ z.name }}
                  <button type="button" class="pv-add" @click="showPop('add', z.id, -1, $event.currentTarget)">+</button>
                </div>
                <div class="pv-drop">
                  <template v-if="z.id === 'filters'">
                    <div v-for="(item, i) in pivot.filters" :key="'f'+item.idx" class="pv-chip" draggable="true" @dragstart="startDrag(item.idx, 'filters')">
                      <span>{{ filterLabel(pivot, item) }}</span>
                      <button type="button" class="pv-more" title="设置" @click="showPop('filter', 'filters', i, $event.currentTarget)">▾</button>
                      <button type="button" class="pv-del" title="移除" @click="onDelField(item.idx)">×</button>
                    </div>
                  </template>
                  <template v-else-if="z.id === 'cols'">
                    <div v-for="idx in pivot.cols" :key="'c'+idx" class="pv-chip" draggable="true" @dragstart="startDrag(idx, 'cols')">
                      <span>{{ pivot.headers[idx] }}</span>
                      <button type="button" class="pv-del" title="移除" @click="onDelField(idx)">×</button>
                    </div>
                  </template>
                  <template v-else-if="z.id === 'rows'">
                    <div v-for="idx in pivot.rowsF" :key="'r'+idx" class="pv-chip" draggable="true" @dragstart="startDrag(idx, 'rows')">
                      <span>{{ pivot.headers[idx] }}</span>
                      <button type="button" class="pv-del" title="移除" @click="onDelField(idx)">×</button>
                    </div>
                  </template>
                  <template v-else>
                    <div v-for="(item, i) in pivot.values" :key="'v'+item.idx" class="pv-chip" draggable="true" @dragstart="startDrag(item.idx, 'values')">
                      <span>{{ valueLabel(pivot, item) }}</span>
                      <button type="button" class="pv-more" title="设置" @click="showPop('agg', 'values', i, $event.currentTarget)">▾</button>
                      <button type="button" class="pv-del" title="移除" @click="onDelField(item.idx)">×</button>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <div v-if="pop.show" class="pv-pop show" :style="{ left: pop.left, top: pop.top }" @click.stop>
      <template v-if="pop.kind === 'agg'">
        <button v-for="a in PIVOT_AGGS" :key="a.id" type="button" @click="setAgg(a.id)">
          {{ pivot.values[pop.index]?.agg === a.id ? '✓ ' : '' }}{{ a.name }}
        </button>
      </template>
      <template v-else-if="pop.kind === 'filter'">
        <label v-for="v in uniqueFieldValues(pivot.rows, pivot.filters[pop.index]?.idx)" :key="String(v)">
          <input type="checkbox" :value="String(v)" :checked="pivot.filters[pop.index]?.selected?.[String(v)] !== false">
          {{ v === '' ? '(空白)' : v }}
        </label>
        <div class="pv-pop-ok"><button type="button" class="btn primary" @click="applyFilterSel">确定</button></div>
      </template>
      <template v-else>
        <button v-for="(h, i) in pivot.headers" :key="i" type="button" @click="addFromPop(i)">{{ h }}</button>
        <div v-if="!pivot.headers.length" class="pv-ph" style="padding:10px">暂无字段</div>
      </template>
    </div>
  </Teleport>

  <AppModal :visible="wizard.visible" title="创建数据透视表" :width="520" :z-index="330" @update:visible="(v) => { wizard.visible = v }">
    <div class="pv-dlg-body">
      <h5>请选择要分析的数据</h5>
      <label class="pv-radio"><input type="radio" v-model="wizard.srcType" value="range"> 请选择单元格区域(S)</label>
      <div class="pv-range-row" :class="{ 'is-off': wizard.srcType !== 'range' }">
        <input v-model="wizard.srcRange" spellcheck="false" placeholder="如 数据!$A$1:$D$8">
        <button type="button" class="pv-pick" title="选择区域" @click="pickSrc">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/><rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/></svg>
        </button>
      </div>
      <label class="pv-radio"><input type="radio" v-model="wizard.srcType" value="multi"> 使用多重合并计算区域(M)</label>
      <div class="pv-range-row" :class="{ 'is-off': wizard.srcType !== 'multi' }">
        <button type="button" class="btn" disabled>选定区域(R)...</button>
        <span class="pv-hint">未检索到选中区域。</span>
      </div>
      <label class="pv-radio"><input type="radio" v-model="wizard.srcType" value="other"> 使用另一个数据透视表(P)</label>
      <div class="pv-other-box" :class="{ 'is-off': wizard.srcType !== 'other' }"></div>
      <h5 class="second">请选择放置数据透视表的位置</h5>
      <label class="pv-radio"><input type="radio" v-model="wizard.placeType" value="new"> 新工作表(N)</label>
      <label class="pv-radio"><input type="radio" v-model="wizard.placeType" value="existing"> 现有工作表(E)</label>
      <div class="pv-range-row" :class="{ 'is-off': wizard.placeType !== 'existing' }">
        <input v-model="wizard.dstCell" spellcheck="false" placeholder="如 数据!$F$1">
        <button type="button" class="pv-pick" title="选择单元格" @click="pickDst">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/><rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/></svg>
        </button>
      </div>
    </div>
    <template #footer>
      <button type="button" class="btn" style="min-width:88px" @click="wizard.visible = false">取消</button>
      <button type="button" class="btn primary" style="min-width:88px" @click="confirmWizard">确定</button>
    </template>
  </AppModal>

  <AppModal :visible="pub.visible" title="申请发布" overflow-visible :width="520" :z-index="4200" @update:visible="(v) => { pub.visible = v }">
    <div class="pub-note">您正在申请发布电子表格【<b>{{ table?.title || '—' }}</b>】，审批人处理之前您可继续编辑并保存，审批人将根据最后保存的版本进行处理。</div>
    <div class="fm-field">
      <label><i class="req">*</i>选择审批人</label>
      <a-select v-model="pub.approver" placeholder="请选择审批人" allow-search popup-container="body">
        <a-option v-for="p in approvers" :key="p" :value="p">{{ p }}</a-option>
      </a-select>
    </div>
    <div class="fm-field">
      <label>申请理由</label>
      <textarea v-model="pub.reason" maxlength="200" placeholder="请输入申请理由"></textarea>
      <div class="char-cnt">{{ pub.reason.length }} / 200</div>
    </div>
    <template #footer>
      <button type="button" class="btn tint" style="min-width:88px" @click="pub.visible = false">取消</button>
      <button type="button" class="btn primary" style="min-width:88px" @click="confirmPublish">提交申请</button>
    </template>
  </AppModal>
</template>
