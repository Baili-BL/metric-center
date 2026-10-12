<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { usePptStore } from '../../stores/ppt'
import { useGalleryStore } from '../../stores/gallery'
import { TABLE_TYPES, useTableStore } from '../../stores/tables'
import { previewGrid } from '../../utils/workbook'
import { uid, ME } from '../../utils/hash'
import { matchText, pathStarts, dirChildName } from '../../utils/dir'
import Icon from '../../components/Icon.vue'
import ColorPop, { placeColorPop } from '../../components/ColorPop.vue'
import AppModal from '../../components/AppModal.vue'
import G2Chart from '../../components/G2Chart.vue'
import ChartBuilder from '../builder/ChartBuilder.vue'
import TableEditor from '../tables/TableEditor.vue'
import PptSlide from './PptSlide.vue'
import PptLayIcon from './PptLayIcon.vue'
import PptCoverStudio from './PptCoverStudio.vue'
import PptPresent from './PptPresent.vue'
import PptStylePanel from './PptStylePanel.vue'
import PptLayerPanel from './PptLayerPanel.vue'
import PptFontSelect from './PptFontSelect.vue'
import RichNoteDialog from '../../components/RichNoteDialog.vue'
import {
  COVER_TEMPLATES, LAYOUT_GROUPS, LAYOUTS, PPT_TYPES, TEXT_SIZES, blocksForLayout, chartPaintSpec, clone,
  emptySandbox, emptyText, isBlockFilled, layoutOf, makeContentSlide, normalizePptStyle, slotAccepts,
  snapshotChart, snapshotTable,
} from './ppt-model'
import { emptyShape, emptyTextBox, ensureShapes, shapeById } from './ppt-shapes'

const props = defineProps({
  pptId: { type: String, default: '' },
})
const emit = defineEmits(['close', 'preview', 'present'])

const store = usePptStore()
const gallery = useGalleryStore()
const tableStore = useTableStore()

const draft = ref(null)
const idx = ref(1)
const selected = ref([])
const clipboard = ref([])
const cutMode = ref(false)
const savedFlash = ref(false)
const dropIndex = ref(-1)
const selSlot = ref(-1)
const selTitle = ref(false)
const layDlg = reactive({ visible: false, mode: 'add' })
const moreDlg = reactive({ visible: false })
const layoutHelp = ref(false)
const libKey = ref(0)

const chartDlg = reactive({ visible: false, kw: '', ids: [], batch: false, slot: -1 })
const tableDlg = reactive({ visible: false, kw: '', id: '', slot: -1 })
const coverDlg = reactive({ visible: false })
const coverStudio = reactive({ visible: false })
const pageDlg = reactive({ visible: false, start: 1 })
const otherDlg = reactive({ visible: false, pptId: '', ids: [] })

const lib = reactive({ tab: 'chart', kw: '', exact: false, onlyMine: false, dir: '' })
const chartEdit = reactive({ open: false, id: '', slot: -1 })
const tableEdit = reactive({ id: '', slot: -1 })
const sandDlg = reactive({ visible: false, slot: -1, title: '', cells: [] })
const presenting = ref(false)
const presentStart = ref(0)
const textColorPick = reactive({ show: false, left: 0, top: 0, origin: '#333333' })
const textDlg = reactive({ visible: false, index: -1, html: '' })
const selShape = ref('')

const ppt = computed(() => draft.value)
const slides = computed(() => draft.value?.slides || [])
const cur = computed(() => slides.value[idx.value])
const template = computed(() => draft.value?.cover?.template || 'city')
const pptStyle = computed({
  get: () => draft.value?.style || normalizePptStyle(null),
  set: (v) => { if (draft.value) draft.value.style = normalizePptStyle(v) },
})
const isCover = computed(() => cur.value?.kind === 'cover')
const canEdit = computed(() => draft.value && draft.value.scope !== 'public')
const layoutMode = computed({
  get: () => (cur.value?.layoutMode === 'free' ? 'free' : 'tile'),
  set: (mode) => {
    if (!canEdit.value || !cur.value) return
    cur.value.layoutMode = mode === 'free' ? 'free' : 'tile'
    selShape.value = ''
    if (mode === 'free') {
      selSlot.value = -1
      selTitle.value = false
    }
  },
})
const layerMode = computed(() => layoutMode.value === 'free')
const pageList = computed(() => slides.value.filter((s) => s.kind !== 'cover'))
const contentCount = computed(() => pageList.value.length)
const groupedLays = computed(() => LAYOUT_GROUPS.map((g) => ({
  ...g,
  items: LAYOUTS.filter((l) => l.group === g.id),
})))

function topLevelDirs(tree, extraPaths = []) {
  const seen = new Set()
  const out = []
  function add(name) {
    const n = String(name || '').split('/')[0].trim()
    if (!n || seen.has(n)) return
    seen.add(n)
    out.push({ name: n, path: n })
  }
  ;(tree || []).forEach((node) => add(dirChildName(node)))
  extraPaths.forEach((p) => add(p))
  return out
}

const libDirs = computed(() => {
  if (lib.tab === 'chart') {
    return topLevelDirs(gallery.dirs, gallery.charts.map((c) => c.dir))
  }
  if (lib.tab === 'table') {
    return TABLE_TYPES.map((t) => ({ name: t.name, path: t.id }))
  }
  return topLevelDirs(
    tableStore.pack.balance?.dirs,
    (tableStore.pack.balance?.tables || []).map((t) => t.dir),
  )
})

const sideCharts = computed(() => {
  const kw = lib.kw.trim()
  return gallery.charts.filter((c) => {
    if (lib.onlyMine && !(c.mine || c.inMine || c.creator === ME)) return false
    if (lib.dir && !pathStarts(c.dir || '', lib.dir)) return false
    if (kw && !matchText(c.title, kw, lib.exact) && !matchText(String(c.id), kw, lib.exact)) return false
    return true
  })
})

const sideTables = computed(() => {
  const kw = lib.kw.trim()
  const types = lib.tab === 'balance'
    ? ['balance']
    : (lib.dir ? [lib.dir] : TABLE_TYPES.map((t) => t.id))
  const all = types.flatMap((tp) => (tableStore.pack[tp]?.tables || []).map((t) => ({ ...t, type: tp })))
  return all.filter((t) => {
    if (lib.onlyMine && !(t.mine || t.inMine || t.creator === ME)) return false
    if (lib.tab === 'balance' && lib.dir && !pathStarts(t.dir || '', lib.dir)) return false
    if (kw && !matchText(t.title, kw, lib.exact) && !matchText(String(t.id), kw, lib.exact)) return false
    return true
  })
})

watch(() => props.pptId, (id) => {
  const src = store.get(id)
  draft.value = src ? clone(src) : null
  if (draft.value) draft.value.style = normalizePptStyle(draft.value.style)
  const first = (draft.value?.slides || []).findIndex((s) => s.kind !== 'cover')
  idx.value = first >= 0 ? first : 0
  selected.value = []
  selSlot.value = -1
  selTitle.value = false
  selShape.value = ''
}, { immediate: true })

watch(() => draft.value?.title, (t) => {
  if (!draft.value || t == null) return
  draft.value.cover.title = t
  const cover = draft.value.slides.find((s) => s.kind === 'cover')
  if (cover) {
    cover.title = t
    if (cover.cover) cover.cover.title = t
  }
})
watch(() => draft.value?.type, (typeId) => {
  if (!draft.value || !typeId) return
  const name = PPT_TYPES.find((t) => t.id === typeId)?.name
  if (name && (!draft.value.cover.subtitle || PPT_TYPES.some((t) => t.name === draft.value.cover.subtitle))) {
    draft.value.cover.subtitle = name
    const cover = draft.value.slides.find((s) => s.kind === 'cover')
    if (cover?.cover) cover.cover.subtitle = name
  }
})
watch(() => lib.tab, () => { lib.dir = ''; lib.kw = '' })
watch(selSlot, (i) => {
  if (i >= 0) selTitle.value = false
})
watch(idx, () => {
  selSlot.value = -1
  selTitle.value = false
  selShape.value = ''
  requestAnimationFrame(() => {
    document.querySelector('.pe-thumb-wrap.on')?.scrollIntoView({ block: 'nearest' })
  })
})

function currentSlots() {
  if (!cur.value || cur.value.kind === 'cover') return []
  return layoutOf(cur.value.layout).slots
}

function applyCoverTemplate(id) {
  if (!draft.value) return
  draft.value.coverTemplate = id
  draft.value.cover.template = id
  const cover = slides.value.find((s) => s.kind === 'cover')
  if (cover?.cover) cover.cover.template = id
}

function applyLayout(layoutId) {
  if (!cur.value || cur.value.kind === 'cover') {
    addPage(layoutId)
    return
  }
  cur.value.layout = layoutId
  cur.value.blocks = blocksForLayout(layoutId, cur.value.blocks || [])
  selSlot.value = -1
  selTitle.value = false
}
function openLayDlg(mode = 'add') {
  layDlg.mode = mode
  layDlg.visible = true
}
function pickLayout(layoutId) {
  if (layDlg.mode === 'add') {
    addPage(layoutId)
    Message.success(`已添加「${layoutOf(layoutId).name}」`)
    return
  }
  applyLayout(layoutId)
  layDlg.visible = false
}

function addPage(layoutId = 'chartText') {
  const pageNo = slides.value.filter((s) => s.kind !== 'cover').length + 1
  const slide = makeContentSlide(layoutId, { pageNo, title: '' })
  const at = Math.max(idx.value + 1, 1)
  draft.value.slides.splice(at, 0, slide)
  idx.value = at
  reflowPageNo()
}

function goPage(s) {
  const i = slides.value.findIndex((x) => x.id === s.id)
  if (i >= 0) {
    idx.value = i
    selShape.value = ''
  }
}
function playFrom(s) {
  const i = slides.value.findIndex((x) => x.id === s.id)
  startPresent(false, i >= 0 ? i : 0)
}

function startPresent(fromCurrent = true, at) {
  if (!draft.value?.slides?.length) return
  presentStart.value = at != null ? at : (fromCurrent ? idx.value : 0)
  presenting.value = true
}

function onEditorKey(e) {
  if (presenting.value || textDlg.visible) return
  if (e.key === 'Escape' && moreDlg.visible) {
    moreDlg.visible = false
    return
  }
  if (e.key === 'Escape' && layoutHelp.value) {
    layoutHelp.value = false
    return
  }
  if (chartEdit.open || tableEdit.id || coverStudio.visible || layDlg.visible) return
  if (layerMode.value && (e.key === 'Delete' || e.code === 'Delete' || e.key === 'Del')) {
    const t = e.target
    if (t && t.getAttribute && t.getAttribute('data-shape')) return
    if (selShape.value) {
      e.preventDefault()
      e.stopPropagation()
      removeShape()
    }
    return
  }
  if (layerMode.value && (e.key === 'Backspace' || e.code === 'Backspace')) {
    const t = e.target
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    if (selShape.value) {
      e.preventDefault()
      removeShape()
    }
    return
  }
  if (e.key !== 'F5') return
  e.preventDefault()
  startPresent(e.shiftKey)
}

function selectedShape() {
  if (!selShape.value || !cur.value) return null
  return (cur.value.shapes || []).find((s) => s.id === selShape.value) || null
}
const layerSel = computed({
  get: () => selectedShape(),
  set: (v) => {
    if (!v?.id) return
    const list = ensureShapes(cur.value)
    const i = list.findIndex((s) => s.id === v.id)
    if (i >= 0) Object.assign(list[i], v)
  },
})
function insertShape(shapeId) {
  if (!canEdit.value || !cur.value) return
  const sh = emptyShape(shapeById(shapeId))
  ensureShapes(cur.value).push(sh)
  selShape.value = sh.id
  layoutMode.value = 'free'
}
function insertTextBox(payload = {}) {
  if (!canEdit.value || !cur.value) return
  const sh = emptyTextBox(payload.preset || 'body', payload.dir === 'v' ? 'v' : 'h')
  ensureShapes(cur.value).push(sh)
  selShape.value = sh.id
  layoutMode.value = 'free'
}
function patchShape({ id, patch }) {
  const list = ensureShapes(cur.value)
  const i = list.findIndex((s) => s.id === id)
  if (i < 0) return
  list[i] = { ...list[i], ...patch }
  selShape.value = id
}
function removeShape(id) {
  const sid = id || selShape.value
  if (!sid || !cur.value) return
  const list = ensureShapes(cur.value)
  const i = list.findIndex((s) => s.id === sid)
  if (i < 0) return
  list.splice(i, 1)
  selShape.value = ''
}

function toggleSel(id) {
  if (selected.value.includes(id)) selected.value = selected.value.filter((x) => x !== id)
  else selected.value = [...selected.value, id]
}

function contentIds() {
  const ids = selected.value.filter((id) => slides.value.find((s) => s.id === id)?.kind !== 'cover')
  return ids.length ? ids : (cur.value?.kind === 'cover' ? [] : [cur.value?.id].filter(Boolean))
}

function cutPages() {
  const ids = contentIds()
  if (!ids.length) return Message.warning('请选择内容页')
  clipboard.value = slides.value.filter((s) => ids.includes(s.id)).map(clone)
  cutMode.value = true
  Message.success(`已剪切 ${clipboard.value.length} 页`)
}
function copyPages() {
  const ids = contentIds()
  if (!ids.length) return Message.warning('请选择内容页')
  clipboard.value = slides.value.filter((s) => ids.includes(s.id)).map((s) => ({ ...clone(s), id: undefined }))
  cutMode.value = false
  Message.success(`已复制 ${clipboard.value.length} 页`)
}
function pastePages() {
  if (!clipboard.value.length) return Message.warning('剪贴板为空')
  const ids = new Set(clipboard.value.map((s) => s.id))
  let at = idx.value + 1
  if (cutMode.value) {
    const keep = []
    draft.value.slides.forEach((s, i) => {
      if (ids.has(s.id)) {
        if (i < at) at -= 1
      } else keep.push(s)
    })
    draft.value.slides = keep
    at = Math.max(1, Math.min(at, draft.value.slides.length))
  }
  const copies = clipboard.value.map((s) => ({ ...clone(s), id: uid('S') }))
  draft.value.slides.splice(at, 0, ...copies)
  if (cutMode.value) {
    cutMode.value = false
    clipboard.value = []
  }
  reflowPageNo()
  idx.value = at
  selected.value = []
  moreDlg.visible = false
  Message.success('已粘贴')
}
function deletePages() {
  const ids = contentIds()
  if (!ids.length) return Message.warning('请选择要删除的内容页')
  if (draft.value.slides.filter((s) => s.kind !== 'cover').length <= ids.length) {
    return Message.warning('至少保留一页内容')
  }
  draft.value.slides = draft.value.slides.filter((s) => !ids.includes(s.id))
  selected.value = []
  idx.value = Math.min(idx.value, draft.value.slides.length - 1)
  if (slides.value[idx.value]?.kind === 'cover') idx.value = Math.min(idx.value + 1, draft.value.slides.length - 1)
  reflowPageNo()
  Message.success('已删除')
}
function reflowPageNo(start) {
  let n = Number(start) > 0 ? Number(start) : 1
  draft.value.slides.forEach((s) => {
    if (s.kind === 'cover') s.pageNo = 0
    else { s.pageNo = n; n += 1 }
  })
}
function applyPageNo() {
  reflowPageNo(pageDlg.start)
  pageDlg.visible = false
  moreDlg.visible = false
  Message.success('页码已更新')
}

function nextEmptySlot(slide, blockType, prefer = -1) {
  const slots = layoutOf(slide?.layout).slots || []
  if (prefer >= 0 && slots[prefer] && slotAccepts(slots[prefer], blockType) && !isBlockFilled(slide.blocks[prefer])) {
    return prefer
  }
  return slots.findIndex((s, si) => slotAccepts(s, blockType) && !isBlockFilled(slide.blocks[si]))
}

function fillSlot(slotIndex, block, opts = {}) {
  if (!cur.value || cur.value.kind === 'cover') {
    addPage(block.type === 'chart' ? 'chartText' : block.type === 'table' ? 'table' : 'sandbox')
  }
  const replace = !!opts.replace
  let slide = draft.value.slides[idx.value]
  let slots = layoutOf(slide.layout).slots || []
  let i = slotIndex
  if (!slots.length) {
    slide.layout = block.type === 'text' ? 'titleBody' : 'titleContent'
    slide.blocks = blocksForLayout(slide.layout)
    slots = layoutOf(slide.layout).slots || []
    i = 0
  } else if (replace && i >= 0 && slots[i] && slotAccepts(slots[i], block.type)) {
    i = slotIndex
  } else {
    i = nextEmptySlot(slide, block.type, i)
    if (i < 0) {
      addPage(slide.layout || (block.type === 'table' ? 'table' : 'chartText'))
      slide = draft.value.slides[idx.value]
      slots = layoutOf(slide.layout).slots || []
      i = nextEmptySlot(slide, block.type)
      if (i < 0) i = slots.findIndex((s) => slotAccepts(s, block.type))
      if (i < 0) i = 0
      Message.success('当前页已排满，已新建一页')
    }
  }
  const prev = slide.blocks[i]
  slide.blocks[i] = { ...block, box: replace ? (block.box || prev?.box) : prev?.box }
  dropIndex.value = -1
  selSlot.value = i
}

function openChartDlg(batch, slot = -1) {
  Object.assign(chartDlg, { visible: true, kw: '', ids: [], batch: !!batch, slot })
}
function confirmCharts() {
  const charts = gallery.charts.filter((c) => chartDlg.ids.includes(c.id))
  if (!charts.length) return Message.warning('请选择图表')
  if (chartDlg.batch) {
    charts.forEach((c) => {
      const slide = makeContentSlide('chart', { title: c.title, blocks: [snapshotChart(c)] })
      draft.value.slides.push(slide)
    })
    reflowPageNo()
    idx.value = draft.value.slides.length - 1
    Message.success(`已插入 ${charts.length} 张 MyETA 图表页`)
  } else {
    fillSlot(chartDlg.slot, snapshotChart(charts[0]), {
      replace: chartDlg.slot >= 0 && isBlockFilled(cur.value?.blocks?.[chartDlg.slot]),
    })
    if (cur.value && !cur.value.title) cur.value.title = charts[0].title
    Message.success('已插入图表')
  }
  chartDlg.visible = false
}
function openTableDlg(slot = -1) {
  Object.assign(tableDlg, { visible: true, kw: '', id: '', slot })
}
function confirmTable() {
  const t = tableStore.findById(tableDlg.id)?.table || tableStore.get(tableDlg.id)
  if (!t) return Message.warning('请选择表格')
  fillSlot(tableDlg.slot, snapshotTable(t, previewGrid(t.workbook, 8, 6)), {
    replace: tableDlg.slot >= 0 && isBlockFilled(cur.value?.blocks?.[tableDlg.slot]),
  })
  Message.success('已插入表格')
  tableDlg.visible = false
}
function openPageDlg() {
  moreDlg.visible = false
  pageDlg.visible = true
  pageDlg.start = 1
}
function openOtherDlg() {
  moreDlg.visible = false
  otherDlg.visible = true
  otherDlg.pptId = ''
  otherDlg.ids = []
}
function pickBlock(i) {
  const slot = currentSlots()[i]
  if (slot === 'chart' || slot === 'content') openChartDlg(false, i)
  if (slot === 'table') openTableDlg(i)
  if (slot === 'sandbox') {
    fillSlot(i, emptySandbox(Date.now() % 997))
    openSandboxEditor(i)
  }
}

function ensureGalleryChart(block) {
  if (!block) return null
  if (block.chartId) {
    const found = gallery.getChart(block.chartId)
    if (found) return found
  }
  if (!block.builderState) return null
  return gallery.saveChart({
    title: block.title || 'PPT图表',
    builderState: clone(block.builderState),
  })
}

function openChartEditor(slotIndex, chartOrId) {
  if (!canEdit.value) return
  let chart = null
  if (chartOrId && typeof chartOrId === 'object') chart = chartOrId
  else if (typeof chartOrId === 'string') chart = gallery.getChart(chartOrId)
  else if (slotIndex >= 0) chart = ensureGalleryChart(cur.value?.blocks?.[slotIndex])
  if (!chart) {
    if (slotIndex >= 0) return openChartDlg(false, slotIndex)
    chartEdit.id = ''
    chartEdit.slot = -1
    chartEdit.open = true
    return
  }
  if (slotIndex >= 0 && cur.value?.blocks?.[slotIndex]) {
    cur.value.blocks[slotIndex].chartId = chart.id
  }
  chartEdit.id = chart.id
  chartEdit.slot = slotIndex
  chartEdit.open = true
}

function onChartSaved(chart) {
  chartEdit.open = false
  libKey.value += 1
  if (!chart) return
  const snap = snapshotChart(chart)
  if (chartEdit.slot >= 0) fillSlot(chartEdit.slot, snap)
  else if (chartEdit.slot === -1) fillSlot(-1, snap)
  syncChartToSlides(chart)
}

function syncChartToSlides(chart) {
  if (!chart?.id || !draft.value) return
  draft.value.slides.forEach((s) => {
    (s.blocks || []).forEach((b, i) => {
      if (b.type === 'chart' && b.chartId === chart.id) s.blocks[i] = { ...snapshotChart(chart), box: b.box }
    })
  })
}

function openTableEditor(slotIndex, tableOrId) {
  if (!canEdit.value) return
  let t = null
  if (tableOrId && typeof tableOrId === 'object') t = tableOrId
  else if (typeof tableOrId === 'string') t = tableStore.findById(tableOrId)?.table || tableStore.get(tableOrId)
  else if (slotIndex >= 0) {
    const b = cur.value?.blocks?.[slotIndex]
    t = b?.tableId ? (tableStore.findById(b.tableId)?.table || tableStore.get(b.tableId)) : null
  }
  if (!t) {
    if (slotIndex >= 0) return openTableDlg(slotIndex)
    return Message.info('请先从右侧插入表格')
  }
  tableEdit.id = t.id
  tableEdit.slot = slotIndex
}

function onTableEdited() {
  const id = tableEdit.id
  const slot = tableEdit.slot
  tableEdit.id = ''
  tableEdit.slot = -1
  const t = tableStore.findById(id)?.table || tableStore.get(id)
  if (!t) return
  const snap = snapshotTable(t, previewGrid(t.workbook, 8, 6))
  if (slot >= 0) fillSlot(slot, snap)
  draft.value?.slides.forEach((s) => {
    (s.blocks || []).forEach((b, i) => {
      if (b.type === 'table' && b.tableId === t.id) s.blocks[i] = { ...snap, box: b.box }
    })
  })
  libKey.value += 1
}

function openSandboxEditor(i) {
  const b = cur.value?.blocks?.[i]
  if (!b || b.type !== 'sandbox') return
  sandDlg.visible = true
  sandDlg.slot = i
  sandDlg.title = b.title || '品种沙盘'
  sandDlg.cells = clone(b.cells || [])
}
function applySandbox() {
  fillSlot(sandDlg.slot, { type: 'sandbox', title: sandDlg.title, cells: clone(sandDlg.cells) }, { replace: true })
  sandDlg.visible = false
  Message.success('沙盘已更新')
}

function editBlock(i) {
  const b = cur.value?.blocks?.[i]
  if (!b) return pickBlock(i)
  if (b.type === 'chart') openChartEditor(i)
  else if (b.type === 'table') openTableEditor(i)
  else if (b.type === 'sandbox') openSandboxEditor(i)
}
function replaceBlock(i) {
  pickBlock(i)
}
function selectBlock(i) {
  selSlot.value = i
  if (i < 0) selTitle.value = false
}
function selectTitle() {
  if (!canEdit.value || isCover.value || layerMode.value) return
  layoutHelp.value = false
  selTitle.value = true
  selSlot.value = -1
}
function patchStyle(partial) {
  if (!canEdit.value || !draft.value) return
  draft.value.style = normalizePptStyle({ ...pptStyle.value, ...partial })
}
const titleText = computed({
  get: () => cur.value?.title || '',
  set: (v) => updateTitle(v),
})
const titleFont = computed({
  get: () => pptStyle.value.titleFont || pptStyle.value.font,
  set: (v) => patchStyle({ titleFont: v }),
})
const titleSize = computed({
  get: () => Number(pptStyle.value.titleSize) || 24,
  set: (v) => patchStyle({ titleSize: Number(v) }),
})
function updateBox({ index, box }) {
  const b = cur.value?.blocks?.[index]
  if (!b) return
  cur.value.blocks[index] = { ...b, box: { ...box } }
  selSlot.value = index
}
function resetBox(i) {
  const b = cur.value?.blocks?.[i]
  if (!b || !b.box) return
  const next = { ...b }
  delete next.box
  cur.value.blocks[i] = next
}

function updateText({ index, text }) {
  if (!cur.value?.blocks?.[index]) return
  cur.value.blocks[index] = { ...(cur.value.blocks[index] || emptyText()), text }
}
function openTextDlg(i) {
  const b = cur.value?.blocks?.[i]
  if (!canEdit.value || !b || b.type !== 'text') return
  selSlot.value = i
  textDlg.index = i
  textDlg.html = b.text || ''
  textDlg.visible = true
}
function saveTextHtml(html) {
  if (textDlg.index < 0) return
  updateText({ index: textDlg.index, text: html })
}
function openTitleColor(e) {
  const pos = placeColorPop(e.currentTarget)
  textColorPick.origin = pptStyle.value.titleColor || '#333333'
  textColorPick.left = pos.left
  textColorPick.top = pos.top
  textColorPick.show = true
}
function onTextColorPick(hex) {
  if (selTitle.value) patchStyle({ titleColor: hex })
}
function updateTitle(v) {
  if (!cur.value) return
  cur.value.title = v
  if (cur.value.kind === 'cover' && draft.value.cover) {
    draft.value.cover.title = v
    draft.value.title = v
  }
}
function applyCover() {
  if (!draft.value) return
  const cover = draft.value.cover
  draft.value.title = cover.title
  const s = slides.value.find((x) => x.kind === 'cover')
  if (s) {
    s.cover = { ...cover }
    s.title = cover.title
  }
  coverDlg.visible = false
  Message.success('封面已更新')
}
function saveCoverStudio(cover) {
  if (!draft.value) return
  draft.value.cover = { ...cover }
  draft.value.title = cover.title
  draft.value.coverTemplate = cover.template
  const s = slides.value.find((x) => x.kind === 'cover')
  if (s) {
    s.cover = { ...cover }
    s.title = cover.title
  }
  Message.success('封面已保存')
}

const otherPpts = computed(() => store.pack.ppts.mine.concat(store.pack.ppts.public).filter((p) => p.id !== props.pptId))
const otherSlides = computed(() => {
  const p = otherPpts.value.find((x) => x.id === otherDlg.pptId)
  return (p?.slides || []).filter((s) => s.kind !== 'cover')
})
function confirmOther() {
  const list = otherSlides.value.filter((s) => otherDlg.ids.includes(s.id))
  if (!list.length) return Message.warning('请选择要插入的内容页')
  const copies = list.map((s) => ({ ...clone(s), id: uid('S') }))
  draft.value.slides.splice(idx.value + 1, 0, ...copies)
  reflowPageNo()
  otherDlg.visible = false
  moreDlg.visible = false
  Message.success(`已插入 ${copies.length} 页`)
}

function save() {
  if (!draft.value) return
  if (!String(draft.value.title || '').trim()) return Message.error('请输入封面标题')
  draft.value.cover.title = draft.value.title
  const r = store.savePpt(clone(draft.value))
  if (!r.ok) return Message.error(r.msg)
  draft.value = clone(r.ppt)
  savedFlash.value = true
  setTimeout(() => { savedFlash.value = false }, 1200)
  Message.success('已保存')
  return true
}

function goPublish() {
  if (canEdit.value && !save()) return
  emit('preview', ppt.value)
}

function refreshLib() {
  libKey.value += 1
  Message.success('已刷新图表数据')
}

function insertChart(c) {
  if (!canEdit.value) return
  fillSlot(-1, snapshotChart(c))
}

function insertTable(t) {
  if (!canEdit.value) return
  fillSlot(-1, snapshotTable(t, previewGrid(t.workbook, 8, 6)))
  if (cur.value && !String(cur.value.title || '').trim()) cur.value.title = t.title
}

function onLibDrag(e, payload) {
  e.dataTransfer.setData('application/json', JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'copy'
}

function onDropBlock({ index, raw }) {
  dropIndex.value = -1
  if (!canEdit.value || !raw) return
  let data
  try { data = JSON.parse(raw) } catch { return }
  if (data.kind === 'chart') {
    const c = gallery.charts.find((x) => x.id === data.id)
    if (c) fillSlot(index, snapshotChart(c))
  } else if (data.kind === 'table') {
    const t = tableStore.findById(data.id)?.table || tableStore.get(data.id)
    if (t) fillSlot(index, snapshotTable(t, previewGrid(t.workbook, 8, 6)))
  }
}

const chartList = computed(() => {
  const kw = chartDlg.kw.trim().toLowerCase()
  return gallery.charts.filter((c) => !kw || c.title.toLowerCase().includes(kw) || String(c.id).toLowerCase().includes(kw))
})
const tableList = computed(() => {
  const kw = tableDlg.kw.trim().toLowerCase()
  const all = ['shared', 'custom', 'timeseries', 'mixed', 'balance'].flatMap((tp) => (tableStore.pack[tp]?.tables || []).map((t) => ({ ...t, type: tp })))
  return all.filter((t) => !kw || t.title.toLowerCase().includes(kw))
})

function toggleChartId(id) {
  if (chartDlg.batch) {
    if (chartDlg.ids.includes(id)) chartDlg.ids = chartDlg.ids.filter((x) => x !== id)
    else chartDlg.ids = [...chartDlg.ids, id]
  } else {
    chartDlg.ids = [id]
  }
}

function tablePreview(t) {
  return previewGrid(t.workbook, 5, 4)
}
function cellText(c) {
  return typeof c === 'object' ? (c.text ?? c.v ?? '') : c
}

function toggleMore(e) {
  e.stopPropagation()
  moreDlg.visible = !moreDlg.visible
  layoutHelp.value = false
}
function toggleLayoutHelp(e) {
  e.stopPropagation()
  layoutHelp.value = !layoutHelp.value
  moreDlg.visible = false
}
function onMoreDocClick(e) {
  if (moreDlg.visible && !e.target.closest?.('.pe-more')) moreDlg.visible = false
  if (layoutHelp.value && !e.target.closest?.('.pe-layout-help-wrap')) layoutHelp.value = false
}

onMounted(() => {
  window.addEventListener('keydown', onEditorKey, true)
  document.addEventListener('click', onMoreDocClick)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEditorKey, true)
  document.removeEventListener('click', onMoreDocClick)
})
</script>

<template>
  <div v-if="ppt" class="ppt-editor open">
    <div class="pe-body eta">
      <aside class="pe-left">
        <button type="button" class="pe-back" @click="emit('close')"><Icon name="back" :size="14" /> 返回</button>
        <div class="pe-page-bar">
          <span>已添加{{ contentCount }}页</span>
          <span v-if="canEdit" class="pe-page-ops-inline">
            <button type="button" @click="cutPages">剪切</button>
            <button type="button" @click="copyPages">复制</button>
            <button type="button" @click="deletePages">批量删除</button>
            <span class="pe-more">
              <button type="button" class="pe-more-btn" title="更多操作" @click="toggleMore">⋯</button>
              <div v-if="moreDlg.visible" class="pe-more-pop" @click.stop>
                <button type="button" @click="pastePages">粘贴</button>
                <button type="button" @click="openPageDlg">修改页码</button>
                <button type="button" @click="openOtherDlg">插入其他PPT</button>
              </div>
            </span>
          </span>
        </div>
        <div class="pe-page-list">
          <div
            v-for="s in slides"
            :key="s.id"
            class="pe-thumb-wrap"
            :class="{ on: s.id === cur?.id }"
          >
            <div
              class="pe-thumb"
              :class="{ on: s.id === cur?.id, cover: s.kind === 'cover' }"
              :title="s.kind === 'cover' ? '封面（双击自定义文字）' : (s.title || '第' + s.pageNo + '页')"
              role="button"
              tabindex="0"
              @click="goPage(s)"
              @dblclick="s.kind === 'cover' ? coverStudio.visible = true : playFrom(s)"
              @keydown.enter="goPage(s)"
            >
              <label v-if="s.kind !== 'cover'" class="pe-check" @click.stop>
                <input type="checkbox" :checked="selected.includes(s.id)" @change="toggleSel(s.id)">
              </label>
              <div class="pe-thumb-stage">
                <PptSlide :slide="s" :template="template" :ppt-style="pptStyle" mini />
              </div>
              <span class="pe-thumb-no">{{ s.kind === 'cover' ? '封面' : s.pageNo }}</span>
              <button
                v-if="s.id === cur?.id"
                type="button"
                class="pe-thumb-play"
                title="演示本页"
                @click.stop="playFrom(s)"
              />
            </div>
            <button
              v-if="canEdit && s.id === cur?.id"
              type="button"
              class="pe-thumb-add"
              title="在此后新增页"
              @click="openLayDlg('add')"
            >+</button>
          </div>
        </div>
      </aside>

      <section class="pe-center">
        <div class="pe-lays-bar">
          <button v-if="canEdit" type="button" class="pe-add" title="从版式新建" @click="openLayDlg('add')">+</button>
          <button
            v-if="canEdit"
            type="button"
            class="pe-lay-all"
            title="全部版式"
            @click="openLayDlg(isCover ? 'add' : 'apply')"
          >全部</button>
          <div class="pe-lays-scroller">
            <button
              v-for="l in LAYOUTS"
              :key="l.id"
              type="button"
              class="pe-lay"
              :class="{ on: !isCover && cur?.layout === l.id }"
              :disabled="!canEdit"
              :title="l.name"
              @click="applyLayout(l.id)"
            >
              <PptLayIcon :id="l.id" />
            </button>
          </div>
        </div>
        <div class="pe-stage">
          <div class="pe-frame" @dblclick="isCover && canEdit && (coverStudio.visible = true)">
            <PptSlide
              v-if="cur"
              :key="cur.id + '-' + libKey"
              :slide="cur"
              :template="template"
              :ppt-style="pptStyle"
              :editable="canEdit && !isCover && !layerMode"
              :drop-index="dropIndex"
              :selected-index="selSlot"
              :selected-title="selTitle"
              :layer-mode="layerMode && canEdit"
              :selected-shape-id="selShape"
              @update-title="updateTitle"
              @update-text="updateText"
              @pick-block="pickBlock"
              @edit-block="editBlock"
              @replace-block="replaceBlock"
              @select-block="selectBlock"
              @select-title="selectTitle"
              @edit-text="openTextDlg"
              @update-box="updateBox"
              @reset-box="resetBox"
              @drop-block="onDropBlock"
              @drag-over="(i) => dropIndex = i"
              @drag-leave="dropIndex = -1"
              @select-shape="(id) => selShape = id"
              @update-shape="patchShape"
              @remove-shape="removeShape"
            />
          </div>
        </div>
      </section>

      <aside class="pe-right">
        <div class="pe-right-acts">
          <button type="button" class="btn pe-play-btn" title="从当前页全屏演示（F5 从头，Shift+F5 当前页）" @click="startPresent(true)">
            <Icon name="preview" :size="13" /> 演示预览
          </button>
          <button type="button" class="btn" @click="refreshLib">一键刷新</button>
          <button type="button" class="btn primary" @click="goPublish">去发布</button>
          <button v-if="canEdit" type="button" class="btn" @click="save">保存</button>
          <span v-if="savedFlash" class="pe-saved">已保存</span>
        </div>
        <div v-if="canEdit && selTitle" class="pe-title-nav">
          <button type="button" class="pe-title-back" @click="selTitle = false">
            <Icon name="back" :size="14" /> 返回
          </button>
        </div>
        <div v-else-if="canEdit" class="pe-layout-mode">
          <div class="pe-layout-mode-h">
            <span>布局方式</span>
            <span class="pe-layout-help-wrap">
              <button
                type="button"
                class="pe-layout-help"
                :class="{ on: layoutHelp }"
                title="使用说明"
                aria-label="布局方式使用说明"
                @click="toggleLayoutHelp"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.3" />
                  <path d="M6.45 6.15a1.65 1.65 0 1 1 2.35 1.48c-.5.32-.9.78-.9 1.37" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
                  <circle cx="8" cy="11.35" r=".85" fill="currentColor" />
                </svg>
              </button>
              <div v-if="layoutHelp" class="pe-layout-help-pop" @click.stop>
                <h5>磁贴布局</h5>
                <ul>
                  <li>按版式格子摆放图表、表格和文本块</li>
                  <li>从右侧图库点击或拖入即可填入格子</li>
                  <li>点击页面标题，可改标题文字、字体和对齐</li>
                </ul>
                <h5>自由布局</h5>
                <ul>
                  <li>可插入线条、矩形、箭头、流程图等形状</li>
                  <li>可插入文本框，文字叠在图层最上层，覆盖图表</li>
                  <li>选中后可拖动、缩放，并设置填充与轮廓</li>
                  <li>按 Delete 或点「删除图层」移除</li>
                </ul>
              </div>
            </span>
          </div>
          <a-radio-group v-model="layoutMode">
            <a-radio value="tile">磁贴布局</a-radio>
            <a-radio value="free">自由布局</a-radio>
          </a-radio-group>
          <p class="pe-layout-tip">
            {{ layoutMode === 'free'
              ? '自由布局：可插入形状与文本框，文字叠在图层最上层，选中后可拖动缩放。'
              : '磁贴布局：按版式格子摆放图表和表格，点击标题可改文字与样式。' }}
          </p>
        </div>
        <template v-if="layerMode">
          <PptLayerPanel v-model="layerSel" :disabled="!canEdit" @insert="insertShape" @insert-text="insertTextBox" @remove="removeShape" />
        </template>
        <template v-else-if="selTitle">
          <div class="pe-title-edit">
            <div class="pte-row">
              <span>标题</span>
              <input v-model="titleText" class="pte-input" placeholder="点击输入标题">
            </div>
            <div class="pte-row">
              <span>字体</span>
              <PptFontSelect v-model="titleFont" />
            </div>
            <div class="pte-row">
              <span>文本</span>
              <div class="pte-fmt">
                <button
                  type="button"
                  class="pte-chip fmt-color color-well"
                  title="标题颜色"
                  :style="{ '--swatch': pptStyle.titleColor }"
                  @click.stop="openTitleColor"
                >A</button>
                <a-select v-model="titleSize" size="small" popup-container="body" class="pte-size">
                  <a-option v-for="n in TEXT_SIZES" :key="'ts' + n" :value="n">{{ n }}</a-option>
                </a-select>
                <button
                  type="button"
                  class="pte-chip"
                  :class="{ on: pptStyle.titleBold }"
                  title="加粗"
                  @click="patchStyle({ titleBold: !pptStyle.titleBold })"
                >B</button>
                <button
                  type="button"
                  class="pte-chip pte-i"
                  :class="{ on: pptStyle.titleItalic }"
                  title="斜体"
                  @click="patchStyle({ titleItalic: !pptStyle.titleItalic })"
                >I</button>
              </div>
            </div>
            <div class="pte-row">
              <span>对齐</span>
              <div class="pte-align">
                <button type="button" :class="{ on: pptStyle.titleAlign === 'left' }" @click="patchStyle({ titleAlign: 'left' })">居左</button>
                <button type="button" :class="{ on: pptStyle.titleAlign === 'center' }" @click="patchStyle({ titleAlign: 'center' })">居中</button>
                <button type="button" :class="{ on: pptStyle.titleAlign === 'right' }" @click="patchStyle({ titleAlign: 'right' })">居右</button>
              </div>
            </div>
          </div>
        </template>
        <template v-else>
        <div class="pe-tabs">
          <button type="button" :class="{ on: lib.tab === 'chart' }" @click="lib.tab = 'chart'">图表</button>
          <button type="button" :class="{ on: lib.tab === 'table' }" @click="lib.tab = 'table'">表格</button>
          <button type="button" :class="{ on: lib.tab === 'balance' }" @click="lib.tab = 'balance'">平衡表</button>
          <button type="button" :class="{ on: lib.tab === 'style' }" @click="lib.tab = 'style'">全局配置</button>
        </div>
        <PptStylePanel v-if="lib.tab === 'style'" v-model="pptStyle" :disabled="!canEdit" />
        <div v-if="lib.tab !== 'style'" class="pe-lib-dir">
          <a-select v-model="lib.dir" size="small" popup-container="body" placeholder="全部">
            <a-option value="">全部</a-option>
            <a-option v-for="d in libDirs" :key="d.path" :value="d.path">{{ d.name }}</a-option>
          </a-select>
        </div>
        <template v-if="lib.tab !== 'style'">
        <div class="pe-lib-search">
          <div class="ds-input">
            <Icon name="search" :size="13" />
            <input v-model="lib.kw" :placeholder="lib.tab === 'chart' ? '请输入图表名称/ID' : '请输入表格名称/ID'">
          </div>
          <label class="pe-exact">
            精准匹配
            <a-switch v-model="lib.exact" size="small" />
          </label>
        </div>
        <label class="pe-mine"><input type="checkbox" v-model="lib.onlyMine"> 只看我的</label>
        <div class="pe-lib-list">
          <template v-if="lib.tab === 'chart'">
            <article
              v-for="c in sideCharts"
              :key="c.id + '-' + libKey"
              class="pe-lib-card"
              role="button"
              :title="c.title"
              draggable="true"
              @dragstart="onLibDrag($event, { kind: 'chart', id: c.id })"
              @click="insertChart(c)"
            >
              <button type="button" class="pe-lib-edit" @click.stop="openChartEditor(-2, c)">编辑</button>
              <div class="pe-lib-name">{{ c.title }}</div>
              <div class="pe-lib-preview">
                <G2Chart v-if="c.builderState" :spec="chartPaintSpec(c)" fill mini disable-tooltip />
              </div>
            </article>
            <div v-if="!sideCharts.length" class="ppt-pick-empty">图库暂无匹配图表</div>
          </template>
          <template v-else>
            <article
              v-for="t in sideTables"
              :key="t.id"
              class="pe-lib-card"
              role="button"
              :title="t.title"
              draggable="true"
              @dragstart="onLibDrag($event, { kind: 'table', id: t.id })"
              @click="insertTable(t)"
            >
              <button type="button" class="pe-lib-edit" @click.stop="openTableEditor(-2, t)">编辑</button>
              <div class="pe-lib-name">{{ t.title }}</div>
              <div class="pe-lib-preview pe-lib-table">
                <table>
                  <tr v-for="(row, ri) in tablePreview(t).slice(0, 5)" :key="ri">
                    <td v-for="(c, ci) in row.slice(0, 4)" :key="ci">{{ cellText(c) }}</td>
                  </tr>
                </table>
              </div>
            </article>
            <div v-if="!sideTables.length" class="ppt-pick-empty">暂无匹配表格</div>
          </template>
        </div>
        </template>
        </template>
      </aside>
    </div>

    <AppModal :visible="coverDlg.visible" title="选择封面页" icon="nav-ppt" :width="560" @update:visible="(v) => coverDlg.visible = v">
      <div class="pe-cover-picks" v-if="ppt">
        <button
          v-for="t in COVER_TEMPLATES"
          :key="t.id"
          type="button"
          class="pe-cover"
          :class="[`theme-${t.id}`, { on: template === t.id }]"
          :disabled="!canEdit"
          @click="applyCoverTemplate(t.id)"
        >
          <span class="mini-kicker">{{ t.name }}</span>
          <b>{{ ppt.cover.title || '封面标题' }}</b>
        </button>
      </div>
      <div class="df-form" v-if="ppt">
        <div class="df-row"><label>封面标题</label><input v-model="ppt.cover.title" placeholder="必填"></div>
        <div class="df-row"><label>副标题 / 类型</label><input v-model="ppt.cover.subtitle" placeholder="如 周报"></div>
        <div class="df-row"><label>机构名称</label><input v-model="ppt.cover.org"></div>
        <div class="df-row"><label>日期</label><input v-model="ppt.cover.date" placeholder="2026-10-12"></div>
        <div class="df-row"><label>作者</label><input v-model="ppt.cover.author"></div>
        <div class="df-row"><label>补充文案</label><input v-model="ppt.cover.extra" placeholder="内部资料 · 仅供参考"></div>
      </div>
      <template #footer>
        <button type="button" class="btn tint" @click="coverDlg.visible = false">取消</button>
        <button type="button" class="btn" @click="coverDlg.visible = false; coverStudio.visible = true">自定义封面</button>
        <button type="button" class="btn primary" @click="applyCover">确定</button>
      </template>
    </AppModal>

    <PptCoverStudio
      :visible="coverStudio.visible"
      :cover="ppt?.cover"
      :can-edit="canEdit"
      @update:visible="(v) => coverStudio.visible = v"
      @save="saveCoverStudio"
    />

    <AppModal
      :visible="layDlg.visible"
      :title="layDlg.mode === 'add' ? '从版式新建' : '选择版式'"
      icon="nav-ppt"
      :width="920"
      :z-index="320"
      @update:visible="(v) => layDlg.visible = v"
    >
      <div class="pe-lay-gallery">
        <section v-for="g in groupedLays" :key="g.id" class="pe-lay-group">
          <h4>{{ g.name }}</h4>
          <div class="pe-lay-grid">
            <button
              v-for="l in g.items"
              :key="l.id"
              type="button"
              class="pe-lay-pick"
              :class="{ on: !isCover && cur?.layout === l.id }"
              @click="pickLayout(l.id)"
            >
              <PptLayIcon :id="l.id" />
              <span class="pe-lay-name">{{ l.name }}</span>
            </button>
          </div>
        </section>
      </div>
      <template #footer>
        <span class="foot-left">{{ layDlg.mode === 'add' ? '可连续点击模板添加多页，点完成关闭' : '选择一个版式应用到当前页' }}</span>
        <button type="button" class="btn tint" @click="layDlg.visible = false">{{ layDlg.mode === 'add' ? '完成' : '取消' }}</button>
      </template>
    </AppModal>

    <Teleport to="body">
      <div v-if="chartEdit.open" class="builder-drawer-root open is-ready pe-builder-root">
        <div class="builder-drawer" role="dialog" aria-modal="true" aria-label="编辑图表">
          <ChartBuilder :chart-id="chartEdit.id" mode="drawer" @saved="onChartSaved" @close="chartEdit.open = false" />
        </div>
      </div>
    </Teleport>
    <TableEditor v-if="tableEdit.id" :table-id="tableEdit.id" @close="onTableEdited" />

    <AppModal :visible="sandDlg.visible" title="编辑沙盘图" icon="g-1fcfcd1e" :width="520" @update:visible="(v) => sandDlg.visible = v">
      <div class="df-form">
        <div class="df-row"><label>标题</label><input v-model="sandDlg.title"></div>
      </div>
      <div class="pe-sand-grid" style="margin-top:12px">
        <template v-for="(c, i) in sandDlg.cells" :key="i">
          <input v-model="c.name" placeholder="品种">
          <input v-model.number="c.chg" type="number" step="0.01" placeholder="涨跌">
        </template>
      </div>
      <template #footer>
        <button type="button" class="btn tint" @click="sandDlg.visible = false">取消</button>
        <button type="button" class="btn primary" @click="applySandbox">确定</button>
      </template>
    </AppModal>

    <AppModal :visible="chartDlg.visible" :title="chartDlg.batch ? '插入 MyETA 批量图表' : '插入图表'" icon="chart-line" :width="720" @update:visible="(v) => chartDlg.visible = v">
      <div class="ppt-pick-bar">
        <div class="ds-input"><Icon name="search" :size="13" /><input v-model="chartDlg.kw" placeholder="搜索图库图表"></div>
        <span>已选 {{ chartDlg.ids.length }}</span>
      </div>
      <div class="ppt-pick-grid">
        <button
          v-for="c in chartList"
          :key="c.id"
          type="button"
          class="ppt-pick-card"
          :class="{ on: chartDlg.ids.includes(c.id) }"
          @click="toggleChartId(c.id)"
        >
          <div class="ppc-name">{{ c.title }}</div>
          <div class="ppc-preview">
            <G2Chart v-if="c.builderState" :spec="chartPaintSpec(c)" fill mini disable-tooltip />
          </div>
        </button>
        <div v-if="!chartList.length" class="ppt-pick-empty">图库暂无匹配图表</div>
      </div>
      <template #footer>
        <button type="button" class="btn tint" @click="chartDlg.visible = false">取消</button>
        <button type="button" class="btn primary" @click="confirmCharts">确定</button>
      </template>
    </AppModal>

    <AppModal :visible="tableDlg.visible" title="插入表格" icon="nav-table" :width="560" @update:visible="(v) => tableDlg.visible = v">
      <div class="ppt-pick-bar">
        <div class="ds-input"><Icon name="search" :size="13" /><input v-model="tableDlg.kw" placeholder="搜索表格"></div>
      </div>
      <div class="ppt-pick-list">
        <label v-for="t in tableList" :key="t.id" class="ppt-pick-row">
          <input type="radio" :value="t.id" v-model="tableDlg.id">
          <span>{{ t.title }}</span>
          <em>{{ t.id }}</em>
        </label>
        <div v-if="!tableList.length" class="ppt-pick-empty">暂无表格</div>
      </div>
      <template #footer>
        <button type="button" class="btn tint" @click="tableDlg.visible = false">取消</button>
        <button type="button" class="btn primary" @click="confirmTable">确定</button>
      </template>
    </AppModal>

    <AppModal :visible="pageDlg.visible" title="修改页码" icon="edit" :width="400" @update:visible="(v) => pageDlg.visible = v">
      <div class="df-form">
        <div class="df-row"><label>起始页码</label><input v-model.number="pageDlg.start" type="number" min="1"></div>
      </div>
      <template #footer>
        <button type="button" class="btn tint" @click="pageDlg.visible = false">取消</button>
        <button type="button" class="btn primary" @click="applyPageNo">确定</button>
      </template>
    </AppModal>

    <AppModal :visible="otherDlg.visible" title="插入其他 PPT 内容页" icon="copy" :width="640" @update:visible="(v) => otherDlg.visible = v">
      <div class="df-form">
        <div class="df-row">
          <label>来源 PPT</label>
          <a-select v-model="otherDlg.pptId" placeholder="请选择" allow-search>
            <a-option v-for="p in otherPpts" :key="p.id" :value="p.id">{{ p.title }}</a-option>
          </a-select>
        </div>
      </div>
      <div class="ppt-pick-list" style="margin-top:12px">
        <label v-for="s in otherSlides" :key="s.id" class="ppt-pick-row">
          <input type="checkbox" :checked="otherDlg.ids.includes(s.id)" @change="otherDlg.ids = $event.target.checked ? [...otherDlg.ids, s.id] : otherDlg.ids.filter((x) => x !== s.id)">
          <span>{{ s.title }}</span>
        </label>
        <div v-if="otherDlg.pptId && !otherSlides.length" class="ppt-pick-empty">该 PPT 暂无内容页</div>
      </div>
      <template #footer>
        <button type="button" class="btn tint" @click="otherDlg.visible = false">取消</button>
        <button type="button" class="btn primary" @click="confirmOther">插入</button>
      </template>
    </AppModal>

    <Teleport to="body">
      <PptPresent
        v-if="presenting && draft"
        :ppt="draft"
        :start="presentStart"
        preview
        @close="presenting = false"
      />
    </Teleport>
    <RichNoteDialog
      v-model:visible="textDlg.visible"
      title="文本内容"
      :html="textDlg.html"
      placeholder="请输入文本内容"
      @ok="saveTextHtml"
    />

    <Teleport to="body">
      <ColorPop
        :show="textColorPick.show"
        :left="textColorPick.left"
        :top="textColorPick.top"
        :origin="textColorPick.origin"
        @update:show="textColorPick.show = $event"
        @pick="onTextColorPick"
      />
    </Teleport>
  </div>
</template>
