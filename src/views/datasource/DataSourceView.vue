<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import ExcelJS from 'exceljs'
import {
  DEPTS, DIR_MAX_LEVEL, FREQS, TYPE_TO_FREQ, WEEK_LABELS,
  cronTextFromSchedule, defaultSchedule, dirShort, inDirScope,
  mockSeriesByFreq, useDatasourceStore,
} from '../../stores/datasource'
import { useIndicatorStore } from '../../stores/indicators'
import { dirChildKids, dirChildName, matchText, parentPathOf } from '../../utils/dir'
import { startDirDrag } from '../../utils/dir-drag'
import { ME } from '../../utils/hash'
import DirTree from '../../components/DirTree.vue'
import DirPathPicker from '../../components/DirPathPicker.vue'
import AppModal from '../../components/AppModal.vue'
import Icon from '../../components/Icon.vue'

const route = useRoute()
const router = useRouter()
const store = useDatasourceStore()
const indicators = useIndicatorStore()

const dirCollapsed = ref(false)
const dirKw = ref('')
const dirExact = ref(false)
const seg = ref('list')
const listKw = ref('')
const creator = ref('')
const creatorOpen = ref(false)
const creatorLabel = computed(() => creator.value || '全部创建人')
const freq = ref('日度')
const taskOpen = ref(false)
const freqOpen = ref(false)
const runTip = ref('')

const dirModal = reactive({ visible: false, mode: 'add', parent: '', name: '' })
const moveModal = reactive({ visible: false, kind: 'dir', from: '', title: '', dest: '' })
const delModal = reactive({ visible: false, kind: '', title: '', msg: '', path: '', id: '' })
const batchModal = reactive({ visible: false, dir: '', ids: [] })
const batchList = ref([])
const choiceOpen = ref(false)
const regOpen = ref(false)
const excelOpen = ref(false)
const editOpen = ref(false)
const libOpen = ref(false)
const schedOpen = ref(false)
const logOpen = ref(false)
const regRows = ref([emptyRegRow()])
const excelRows = ref([])
const excelName = ref('')
const editForm = reactive(emptyEdit())
const libForm = reactive({ id: '', name: '', unit: '', freq: '日度', dir: '' })
const schedForm = reactive({
  ids: [],
  name: '',
  type: 'daily',
  times: ['08:00'],
  weekdays: [1],
  monthDays: [1],
  months: [],
})
const taskKw = ref('')
const taskFreq = ref('')
const taskCfg = ref('')
const taskTrigger = ref('')
const taskStatus = ref('')
const taskDateFrom = ref('')
const taskDateTo = ref('')
const taskSelected = ref([])
const taskLogs = ref([])
const logTask = ref(null)
const taskPop = ref('')
const taskDraftFrom = ref('')
const taskDraftTo = ref('')

const FS_TYPES = [
  { type: 'daily', freq: '日度', label: '每日', short: '日', desc: '每天按设定时刻执行，只需配置小时与分钟。' },
  { type: 'weekly', freq: '周度', label: '每周', short: '周', desc: '按选定星期执行，不会出现每日或每月选项。' },
  { type: 'xun', freq: '旬度', label: '每旬', short: '旬', desc: '按上旬 / 中旬 / 下旬执行。' },
  { type: 'monthly', freq: '月度', label: '每月', short: '月', desc: '按月内日期执行。' },
  { type: 'quarter', freq: '季度', label: '每季度', short: '季', desc: '按季初 / 季中 / 季末月与日期执行。' },
  { type: 'yearly', freq: '年度', label: '每年', short: '年', desc: '按月份与日期执行。' },
]
const Q_SLOTS = [
  { v: '1,4,7,10', months: [1, 4, 7, 10], lab: '季初月 · 1 / 4 / 7 / 10' },
  { v: '2,5,8,11', months: [2, 5, 8, 11], lab: '季中月 · 2 / 5 / 8 / 11' },
  { v: '3,6,9,12', months: [3, 6, 9, 12], lab: '季末月 · 3 / 6 / 9 / 12' },
]
const XUN_OPTS = [
  { v: 1, lab: '上旬 · 1日' },
  { v: 11, lab: '中旬 · 11日' },
  { v: 21, lab: '下旬 · 21日' },
]
const freqBag = reactive({})
const fsType = ref('daily')
const fsHour = ref(8)
const fsMin = ref(0)
const fsDrop = ref('')

const arcoPopup = { popupStyle: { zIndex: 5200 }, updateAtScroll: true }

const FREQ_FILTERS = [
  { id: '', label: '全部' },
  ...FREQS.map((f) => ({ id: f, label: f })),
  { id: '半年度', label: '半年度' },
]
const CFG_FILTERS = [
  { id: '', label: '全部' },
  { id: 'yes', label: '已配置' },
  { id: 'no', label: '未配置' },
]
const TRIGGER_FILTERS = [
  { id: '', label: '全部' },
  { id: '系统默认调度', label: '系统默认调度' },
  { id: '自动调度', label: '自动调度' },
]
const STATUS_FILTERS = [
  { id: '', label: '全部状态' },
  { id: 'on', label: '已启动' },
  { id: 'off', label: '已暂停' },
  { id: 'ok', label: '上次成功' },
  { id: 'fail', label: '上次失败' },
]

watch(() => [route.query.src, route.query.draft], ([src, draft]) => {
  if (!src) {
    router.replace({ path: '/datasource', query: { ...route.query, src: '上海钢联' } })
    return
  }
  if (store.currentSrc !== src) {
    store.selectSrc(src)
    resetPageState()
  }
  store.ensureDir()
  if (draft === 'task') taskOpen.value = true
}, { immediate: true })

watch(() => store.currentSrc, () => store.ensureDir())

function resetPageState() {
  dirKw.value = ''
  listKw.value = ''
  creator.value = ''
  seg.value = 'list'
  freq.value = '日度'
  store.currentItem = ''
}

function emptyRegRow() {
  return { id: '', name: '', dir: store.currentDir || '', freq: '日度' }
}
function emptyEdit() {
  return { id: '', name: '', dir: '', freq: '日度', unit: '', origin: 'RPA', upd: '定时更新', dept: DEPTS[0], creator: ME }
}

const displayTree = computed(() => {
  const kw = dirKw.value.trim()
  if (!kw) return store.tree
  const items = store.srcItems
  function walk(list, prefix = '') {
    const out = []
    ;(list || []).forEach((node) => {
      const name = dirChildName(node)
      const path = prefix ? `${prefix}/${name}` : name
      const kids = dirChildKids(node) || []
      const nameHit = matchText(name, kw, dirExact.value)
      const itemHit = items.some((it) => (it.dir === path || it.dir.startsWith(`${path}/`)) && (
        matchText(it.name, kw, dirExact.value) || matchText(it.id, kw, dirExact.value)
      ))
      if (nameHit) out.push(node)
      else {
        const filteredKids = walk(kids, path)
        if (filteredKids.length || itemHit) out.push({ name, children: filteredKids })
      }
    })
    return out
  }
  return walk(store.tree)
})

const dirRows = computed(() => {
  store.ensureDir()
  return store.srcItems.filter((it) => inDirScope(it.dir, store.currentDir))
})
const listRows = computed(() => dirRows.value.filter((it) => {
  if (creator.value && it.creator !== creator.value) return false
  if (listKw.value) {
    const kw = listKw.value
    if (![it.name, it.creator, it.dept, it.id].some((s) => matchText(s, kw, false))) return false
  }
  return true
}))
function matchIndKw(it, kw) {
  return matchText(it.name, kw, false) || matchText(it.id, kw, false)
}
const previewCols = computed(() => {
  let scope = dirRows.value.filter((it) => it.freq === freq.value)
  const kw = listKw.value.trim()
  if (kw) return scope.filter((it) => matchIndKw(it, kw)).slice(0, 8)
  const locked = store.srcItems.find((x) => x.id === store.currentItem)
  if (locked && locked.freq === freq.value) scope = [locked]
  return scope.slice(0, 8)
})
const previewScrollEl = ref(null)
function pinPreviewLeft() {
  nextTick(() => {
    const box = previewScrollEl.value
    if (box) box.scrollLeft = 0
  })
}
watch([listKw, freq, () => store.currentDir, seg], () => {
  if (seg.value === 'preview') pinPreviewLeft()
})
const previewDates = computed(() => mockSeriesByFreq(1, freq.value).map((r) => r.date))
const creatorOptions = computed(() => {
  const set = new Set(store.srcItems.map((it) => it.creator).filter(Boolean))
  return [...set].sort()
})
const emptyReason = computed(() => (dirRows.value.length && (listKw.value || creator.value) ? 'search' : 'empty'))
const dirParentLabel = computed(() => {
  if (dirModal.mode === 'edit') {
    const parts = dirModal.parent.split('/').filter(Boolean)
    return parts.length > 1 ? parts.slice(0, -1).join('/') : '根目录（一级目录）'
  }
  return dirModal.parent || '根目录（一级目录）'
})
const srcTasks = computed(() => store.tasks[store.currentSrc] || [])
const filteredTasks = computed(() => srcTasks.value.filter((t) => {
  if (taskKw.value) {
    const kw = taskKw.value.toLowerCase()
    const hit = (t.name || '').toLowerCase().includes(kw)
      || (t.inds || []).some((x) => String(x.id).toLowerCase().includes(kw) || String(x.name).toLowerCase().includes(kw))
    if (!hit) return false
  }
  if (taskFreq.value && t.freq !== taskFreq.value) return false
  if (taskCfg.value === 'yes' && !t.configured) return false
  if (taskCfg.value === 'no' && t.configured) return false
  if (taskTrigger.value && (t.trigger || '') !== taskTrigger.value) return false
  if (taskStatus.value === 'on' && (!t.on || t.running)) return false
  if (taskStatus.value === 'off' && t.on) return false
  if (taskStatus.value === 'ok' && t.result !== '成功') return false
  if (taskStatus.value === 'fail' && t.result !== '失败') return false
  if (taskDateFrom.value && String(t.last).slice(0, 10) < taskDateFrom.value) return false
  if (taskDateTo.value && String(t.last).slice(0, 10) > taskDateTo.value) return false
  return true
}))
const schedPreview = computed(() => cronTextFromSchedule({
  type: schedForm.type,
  times: schedForm.times,
  weekdays: schedForm.weekdays,
  monthDays: schedForm.monthDays,
  months: schedForm.months,
}))
function ensureFs(src) {
  if (!freqBag[src]) {
    const bag = {}
    FS_TYPES.forEach((it) => { bag[it.type] = defaultSchedule(it.freq) })
    freqBag[src] = bag
  }
  return freqBag[src]
}
const fsDraft = computed(() => ensureFs(store.currentSrc)[fsType.value])
const fsMeta = computed(() => FS_TYPES.find((x) => x.type === fsType.value) || FS_TYPES[0])
const fsPreview = computed(() => cronTextFromSchedule(fsDraft.value))
const fsList = computed(() => FS_TYPES.map((it) => ({
  ...it,
  sum: cronTextFromSchedule(ensureFs(store.currentSrc)[it.type]),
})))
const fsWeekOn = computed(() => new Set(fsDraft.value.weekdays || []))
const fsXunOn = computed(() => new Set((fsDraft.value.monthDays || [1, 11, 21]).map(String)))
const fsMonthOn = computed(() => new Set(fsDraft.value.months || []))
const fsDayOn = computed(() => new Set((fsDraft.value.monthDays || [1]).map(String)))
const fsQuarterOn = computed(() => new Set(quarterSlotsFromMonths(fsDraft.value.months)))
const fsHours = Array.from({ length: 24 }, (_, i) => i)
const fsMins = Array.from({ length: 60 }, (_, i) => i)
const fsCalDays = Array.from({ length: 31 }, (_, i) => i + 1)
const taskFreqLabel = computed(() => (taskFreq.value ? FREQ_FILTERS.find((f) => f.id === taskFreq.value)?.label : '调度分类'))
const taskCfgLabel = computed(() => (taskCfg.value ? CFG_FILTERS.find((f) => f.id === taskCfg.value)?.label : '配置状态'))
const taskTriggerLabel = computed(() => (taskTrigger.value ? taskTrigger.value : '触发方式'))
const taskStatusLabel = computed(() => (taskStatus.value ? STATUS_FILTERS.find((f) => f.id === taskStatus.value)?.label : '状态'))
const taskTimeLabel = computed(() => {
  if (taskDateFrom.value && taskDateTo.value) return `${taskDateFrom.value} ~ ${taskDateTo.value}`
  if (taskDateFrom.value) return `${taskDateFrom.value} 起`
  if (taskDateTo.value) return `至 ${taskDateTo.value}`
  return '执行时间'
})
const taskTimeOn = computed(() => !!(taskDateFrom.value || taskDateTo.value))
function pad2(n) { return String(n).padStart(2, '0') }
function quarterSlotsFromMonths(months) {
  const set = new Set(months || [])
  const slots = []
  if (set.has(1) || set.has(4) || set.has(7) || set.has(10)) slots.push('1,4,7,10')
  if (set.has(2) || set.has(5) || set.has(8) || set.has(11)) slots.push('2,5,8,11')
  if (set.has(3) || set.has(6) || set.has(9) || set.has(12)) slots.push('3,6,9,12')
  return slots.length ? slots : ['1,4,7,10']
}
function monthsFromQuarterSlots(slots) {
  const map = { '1,4,7,10': [1, 4, 7, 10], '2,5,8,11': [2, 5, 8, 11], '3,6,9,12': [3, 6, 9, 12] }
  const out = []
  ;(slots || []).forEach((s) => { (map[s] || []).forEach((m) => out.push(m)) })
  return [...new Set(out)].sort((a, b) => a - b)
}
function toggleFsValue(arr, val, asNumber) {
  const key = String(val)
  const next = []
  let found = false
  ;(arr || []).forEach((v) => {
    if (String(v) === key) { found = true; return }
    next.push(v)
  })
  if (!found) next.push(asNumber && key !== 'end' ? +val : (key === 'end' ? 'end' : val))
  return next
}

function nameCell(name) {
  const s = String(name || '')
  return s.length > 30 ? `${s.slice(0, 30)}…` : s
}
function stClass(it) {
  if (it.running) return 'run'
  return it.status === '已更新' ? 'on' : 'wait'
}
function seriesOf(it) {
  return mockSeriesByFreq(hashCode(it.id + it.name), freq.value)
}
function hashCode(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
function previewId(it, ci) {
  const gi = store.srcItems.findIndex((x) => x.id === it.id)
  return `a${10018150 + (Math.max(gi, 0) % 900) + ci}`
}
function previewUpd(it) {
  const gi = Math.max(0, store.srcItems.findIndex((x) => x.id === it.id))
  return `${it.date} ${String(8 + (gi % 10)).padStart(2, '0')}:${String((gi * 7) % 60).padStart(2, '0')}:${String((gi * 13) % 60).padStart(2, '0')}`
}

function onAdd(path) {
  const level = path ? path.split('/').filter(Boolean).length + 1 : 1
  if (level > DIR_MAX_LEVEL) return Message.warning('目录最多 6 级')
  Object.assign(dirModal, { visible: true, mode: path ? 'child' : 'add', parent: path || '', name: '' })
}
function onFooterAdd() { onAdd('') }
function onEdit(path) {
  Object.assign(dirModal, { visible: true, mode: 'edit', parent: path, name: path.split('/').pop() })
}
function onMove(payload) {
  if (payload?.kind === 'item') {
    const item = payload.item
    if (!item?.id) return
    Object.assign(moveModal, {
      visible: true, kind: 'item', from: item.id, title: item.name || payload.title || item.id, dest: item.dir || '',
    })
    return
  }
  const path = payload?.path || ''
  if (!path) return
  Object.assign(moveModal, {
    visible: true, kind: 'dir', from: path, title: payload.title || dirShort(path), dest: parentPathOf(path),
  })
}
function confirmMove() {
  if (moveModal.kind === 'dir') {
    const r = store.moveDir(moveModal.from, moveModal.dest || '')
    if (!r || r.skipped) { moveModal.visible = false; return }
    if (!r.ok) return Message.error(r.msg)
    if (r.path) store.selectDir(r.path)
    moveModal.visible = false
    Message.success(r.msg || '目录已移动')
    return
  }
  if (!moveModal.dest) return Message.warning('请选择目标目录')
  store.moveItems([moveModal.from], moveModal.dest)
  store.selectDir(moveModal.dest)
  moveModal.visible = false
  Message.success(`已移动「${moveModal.title}」到「${moveModal.dest.split('/').join(' / ')}」`)
}
function confirmDir() {
  const name = dirModal.name.trim()
  if (!name) return Message.error('请填写目录名称')
  const res = dirModal.mode === 'edit'
    ? store.renameDir(dirModal.parent, name)
    : store.addDir(dirModal.parent, name)
  if (!res.ok) return Message.error(res.msg)
  dirModal.visible = false
  Message.success(dirModal.mode === 'edit' ? '已重命名' : '已添加目录')
}
function onRemoveDir(path) {
  Object.assign(delModal, {
    visible: true, kind: 'dir', path, id: '',
    title: '删除目录',
    msg: `确认删除「${dirShort(path)}」及其下指标？此操作不可恢复。`,
  })
}
function onRemoveItem(item) {
  Object.assign(delModal, {
    visible: true, kind: 'item', path: '', id: item.id,
    title: '删除指标',
    msg: `确认删除指标「${item.name}」？`,
  })
}
function confirmDel() {
  if (delModal.kind === 'dir') store.removeDir(delModal.path)
  else store.removeItem(delModal.id)
  delModal.visible = false
  Message.success('已删除')
}
function openBatch() {
  batchList.value = dirRows.value
  batchModal.ids = batchList.value.map((x) => x.id)
  batchModal.dir = store.currentDir
  batchModal.visible = true
}
function toggleBatchAll() {
  batchModal.ids = batchModal.ids.length === batchList.value.length ? [] : batchList.value.map((x) => x.id)
}
function toggleBatchId(id, on) {
  if (on) { if (!batchModal.ids.includes(id)) batchModal.ids.push(id) }
  else batchModal.ids = batchModal.ids.filter((x) => x !== id)
}
function doBatchMove() {
  if (!batchModal.dir) return Message.error('请选择目标目录')
  if (!batchModal.ids.length) return Message.warning('请选择要移动的指标')
  store.moveItems(batchModal.ids, batchModal.dir)
  store.selectDir(batchModal.dir)
  batchModal.visible = false
  Message.success('已移动')
}
function onDropItem(payload, path) {
  if (!path) return Message.warning('请将指标拖放到具体目录')
  const it = payload.item || store.srcItems.find((x) => x.id === payload.id)
  if (!it) return
  if (it.dir === path) return
  store.moveItems([it.id], path)
  store.selectDir(path)
  Message.success(`已移动「${it.name}」到「${path}」`)
}
function onDropDir(fromPath, targetPath) {
  const r = store.moveDir(fromPath, targetPath)
  if (!r || r.skipped) return
  if (!r.ok) return Message.warning(r.msg)
  if (r.path) store.selectDir(r.path)
  if (r.msg) Message.success(r.msg)
}
function onRowDragStart(e, it) {
  const el = e.target?.closest ? e.target : e.target?.parentElement
  if (el?.closest?.('button, a, input, .ind-ops')) {
    e.preventDefault()
    return
  }
  startDirDrag({ type: 'item', id: it.id, name: it.name, label: it.name, item: it }, e)
}
function addRegRow() { regRows.value.push(emptyRegRow()) }
function removeRegRow(i) { if (regRows.value.length > 1) regRows.value.splice(i, 1) }
function openReg() {
  choiceOpen.value = false
  regRows.value = [emptyRegRow()]
  regOpen.value = true
}
function confirmReg() {
  const rows = regRows.value.map((r) => ({
    id: r.id.trim(),
    name: r.name.trim(),
    dir: r.dir || store.currentDir,
    freq: r.freq,
    origin: '手工',
    upd: '手动更新',
  })).filter((r) => r.name)
  if (!rows.length) return Message.error('请至少填写一条指标名称')
  rows.forEach((r) => { if (!r.dir) r.dir = store.currentDir })
  store.registerMany(rows.map((r) => ({ ...r, origin: '手工', upd: '手动更新' })))
  regOpen.value = false
  Message.success(`已登记 ${rows.length} 条`)
}
async function downloadTpl() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('数据登记注册')
  ws.addRow(['指标ID', '指标名称', '所属目录', '单位', '频度', '指标来源'])
  ws.addRow(['IND9001', '示例指标:市场价', store.currentDir || '宏观数据', '元/吨', '日度', '手工'])
  const buf = await wb.xlsx.writeBuffer()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([buf]))
  a.download = '数据登记注册模板.xlsx'
  a.click()
}
async function onExcelFile(e) {
  const file = e.target?.files?.[0] || e.dataTransfer?.files?.[0]
  if (!file) return
  excelName.value = file.name
  const buf = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  const ws = wb.worksheets[0]
  const rows = []
  ws.eachRow((row, i) => {
    if (i === 1) return
    const vals = row.values.slice(1)
    if (!vals[1] && !vals[0]) return
    rows.push({
      id: String(vals[0] || '').trim(),
      name: String(vals[1] || '').trim(),
      dir: String(vals[2] || store.currentDir || '').trim(),
      unit: String(vals[3] || '').trim(),
      freq: String(vals[4] || '日度').trim(),
      origin: String(vals[5] || '手工').trim(),
    })
  })
  excelRows.value = rows
}
function confirmExcel() {
  if (!excelRows.value.length) return Message.error('请先上传并解析 Excel')
  store.registerMany(excelRows.value.map((r) => ({
    id: r.id, name: r.name, dir: r.dir, origin: r.origin || '手工', upd: '手动更新',
    unit: r.unit, freq: r.freq,
  })))
  excelOpen.value = false
  excelRows.value = []
  excelName.value = ''
  Message.success('已完成 Excel 注册')
}
function openEdit(it) {
  Object.assign(editForm, {
    id: it.id, name: it.name, dir: it.dir, freq: it.freq, unit: it.unit,
    origin: it.origin, upd: it.upd, dept: it.dept, creator: it.creator,
  })
  editOpen.value = true
}
function saveEdit() {
  store.updateItem(editForm.id, {
    name: editForm.name, dir: editForm.dir, freq: editForm.freq, unit: editForm.unit,
    origin: editForm.origin, upd: editForm.upd, dept: editForm.dept,
  })
  editOpen.value = false
  Message.success('已保存')
}
function openLib(it) {
  Object.assign(libForm, {
    id: it.id, name: it.name, unit: it.unit, freq: it.freq,
    dir: indicators.currentDir || '黑色建材',
  })
  libOpen.value = true
}
function confirmLib() {
  const it = store.srcItems.find((x) => x.id === libForm.id)
  if (!it) return
  indicators.addBase([{
    id: it.id, title: libForm.name, unit: libForm.unit, freq: libForm.freq, dir: libForm.dir, source: store.currentSrc,
  }], libForm.dir)
  store.markInLib(it.id, true)
  libOpen.value = false
  Message.success('已加入指标库')
}
function runInd(it) {
  if (!it.inLib) return
  if (store.runNow(it.id)) Message.success(`已触发执行：${it.name}`)
}
function showRunTip(e, on) {
  runTip.value = on ? '请先添加后再立即执行' : ''
  if (!on) return
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  runTip.value = JSON.stringify({ text: '请先添加后再立即执行', left: r.left + r.width / 2, top: r.top - 8 })
}
const runTipPos = computed(() => {
  try { return JSON.parse(runTip.value) } catch { return null }
})

function openTask() { openFreqSched() }
function closeTask() {
  taskOpen.value = false
  taskPop.value = ''
  if (route.query.draft === 'task') router.replace({ path: '/datasource', query: { src: store.currentSrc } })
}
function syncFsTimeFromDraft() {
  const tm = (fsDraft.value.times && fsDraft.value.times[0]) || '08:00'
  const [h, m] = String(tm).split(':')
  fsHour.value = Math.max(0, Math.min(23, +h || 0))
  fsMin.value = Math.max(0, Math.min(59, +m || 0))
}
function openFreqSched() {
  fsType.value = 'daily'
  ensureFs(store.currentSrc)
  syncFsTimeFromDraft()
  fsDrop.value = ''
  freqOpen.value = true
}
function selectFsType(type) {
  fsType.value = type
  syncFsTimeFromDraft()
  fsDrop.value = ''
}
function toggleFsDrop(kind) {
  fsDrop.value = fsDrop.value === kind ? '' : kind
}
function addFsTime() {
  const tm = `${pad2(fsHour.value)}:${pad2(fsMin.value)}`
  const times = [...(fsDraft.value.times || [])]
  if (times.includes(tm)) return Message.warning('该时刻已添加')
  times.push(tm)
  times.sort()
  fsDraft.value.times = times
}
function removeFsTime(i) {
  if ((fsDraft.value.times || []).length <= 1) return
  fsDraft.value.times.splice(i, 1)
}
function toggleFsWeek(d) {
  const days = toggleFsValue(fsDraft.value.weekdays, d, true)
  fsDraft.value.weekdays = days.length ? days.sort((a, b) => a - b) : [d]
}
function toggleFsXun(v) {
  const days = toggleFsValue(fsDraft.value.monthDays?.length ? fsDraft.value.monthDays : [1, 11, 21], v, true)
  fsDraft.value.monthDays = days.length ? days : [v]
}
function toggleFsQuarter(slot) {
  const slots = toggleFsValue(quarterSlotsFromMonths(fsDraft.value.months), slot, false)
  fsDraft.value.months = monthsFromQuarterSlots(slots.length ? slots : [slot])
}
function toggleFsMonth(m) {
  const months = toggleFsValue(fsDraft.value.months?.length ? fsDraft.value.months : [1], m, true)
  fsDraft.value.months = months.length ? months.sort((a, b) => a - b) : [m]
}
function toggleFsDay(v) {
  const days = toggleFsValue(fsDraft.value.monthDays?.length ? fsDraft.value.monthDays : [1], v, true)
  fsDraft.value.monthDays = days.length ? days : [v === 'end' ? 'end' : +v]
}
function saveFreqSched() {
  const draft = JSON.parse(JSON.stringify(fsDraft.value))
  if (fsType.value === 'weekly' && !(draft.weekdays || []).length) return Message.warning('请至少选择一个星期')
  if (fsType.value === 'xun' && !(draft.monthDays || []).length) return Message.warning('请至少选择一个旬日')
  if (['monthly', 'quarter', 'yearly'].includes(fsType.value) && !(draft.monthDays || []).length) return Message.warning('请至少选择一个执行日')
  if (fsType.value === 'quarter' && !(draft.months || []).length) return Message.warning('请至少选择一个季度月')
  if (fsType.value === 'yearly' && !(draft.months || []).length) return Message.warning('请至少选择一个月份')
  const freq = TYPE_TO_FREQ[fsType.value]
  const list = srcTasks.value.filter((t) => t.freq === freq)
  list.forEach((t) => {
    const patch = { schedule: draft, configured: true }
    if (!t.configured) {
      patch.on = true
      patch.trigger = '自动调度'
    } else if (!t.trigger || t.trigger === '—' || t.trigger === '系统默认调度') {
      patch.trigger = '自动调度'
    }
    store.updateTask(store.currentSrc, t.id, patch)
  })
  freqOpen.value = false
  Message.success(`已保存「${fsMeta.value.label}」调度${list.length ? `，并同步 ${list.length} 条任务` : ''} → ${cronTextFromSchedule(draft)}`)
}
function toggleTaskPop(id, e) {
  e?.stopPropagation()
  if (id === 'time' && taskPop.value !== 'time') {
    taskDraftFrom.value = taskDateFrom.value
    taskDraftTo.value = taskDateTo.value
  }
  taskPop.value = taskPop.value === id ? '' : id
}
function applyTaskDate() {
  let from = taskDraftFrom.value
  let to = taskDraftTo.value
  if (from && to && from > to) { const tmp = from; from = to; to = tmp }
  taskDateFrom.value = from
  taskDateTo.value = to
  taskPop.value = ''
}
function resetTaskDate() {
  taskDraftFrom.value = ''
  taskDraftTo.value = ''
  taskDateFrom.value = ''
  taskDateTo.value = ''
  taskPop.value = ''
}
function pickTaskFilter(key, val) {
  if (key === 'freq') taskFreq.value = val
  if (key === 'cfg') taskCfg.value = val
  if (key === 'trigger') taskTrigger.value = val
  if (key === 'status') taskStatus.value = val
  taskPop.value = ''
}
function setCreator(name) {
  creator.value = name
  creatorOpen.value = false
}
function toggleCreator(e) {
  e?.stopPropagation?.()
  creatorOpen.value = !creatorOpen.value
}
function onDocClick(e) {
  taskPop.value = ''
  fsDrop.value = ''
  if (e?.target?.closest?.('.ds-creator-filter')) return
  creatorOpen.value = false
}
function pauseTask(t) {
  store.updateTask(store.currentSrc, t.id, { running: false })
}
function taskTriggerOf(t) {
  return t.trigger || (t.configured ? '自动调度' : '系统默认调度')
}
function openSched(tasks) {
  const list = Array.isArray(tasks) ? tasks : [tasks]
  const t = list[0]
  if (!t) return
  Object.assign(schedForm, {
    ids: list.map((x) => x.id),
    name: list.length > 1 ? `已选 ${list.length} 条任务` : t.name,
    type: t.schedule?.type || 'daily',
    times: [...(t.schedule?.times || ['08:00'])],
    weekdays: [...(t.schedule?.weekdays || [1])],
    monthDays: [...(t.schedule?.monthDays || [1])],
    months: [...(t.schedule?.months || [])],
  })
  schedOpen.value = true
}
function addSchedTime() { schedForm.times.push('08:00') }
function removeSchedTime(i) { if (schedForm.times.length > 1) schedForm.times.splice(i, 1) }
function saveSched() {
  const schedule = {
    type: schedForm.type,
    times: schedForm.times.filter(Boolean),
    weekdays: schedForm.weekdays,
    monthDays: schedForm.monthDays,
    months: schedForm.months,
  }
  schedForm.ids.forEach((id) => {
    store.updateTask(store.currentSrc, id, { schedule, configured: true, trigger: '自动调度', cron: cronTextFromSchedule(schedule) })
  })
  schedOpen.value = false
  Message.success('已保存调度时间')
}
function batchTask(act) {
  taskPop.value = ''
  if (!taskSelected.value.length) return
  if (act === 'sched') {
    openSched(srcTasks.value.filter((t) => taskSelected.value.includes(t.id)))
    return
  }
  taskSelected.value.forEach((id) => store.toggleTask(store.currentSrc, id, act === 'on'))
  Message.success(act === 'on' ? '已批量启动' : '已批量暂停')
}
function toggleTaskSel(id, on) {
  if (on) { if (!taskSelected.value.includes(id)) taskSelected.value.push(id) }
  else taskSelected.value = taskSelected.value.filter((x) => x !== id)
}
function toggleTaskAll(on) {
  taskSelected.value = on ? filteredTasks.value.map((t) => t.id) : []
}
function openLog(t) {
  logTask.value = t
  taskLogs.value = t.last && t.last !== '—'
    ? [{ time: t.last, user: t.modifier, action: '执行', detail: t.name, result: t.result }]
    : []
  logOpen.value = true
}

function onDropExcel(e) {
  e.preventDefault()
  onExcelFile(e)
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => {
  runTip.value = ''
  document.removeEventListener('click', onDocClick)
})
</script>

<template>
  <div class="ds-page">
    <aside class="dir-panel ic-dir-panel" :class="{ collapsed: dirCollapsed }">
      <div class="dir-head">
        <h2>目录</h2>
        <label class="only-mine is-disabled" title="本期暂未开放"><input type="checkbox" disabled>只看我的</label>
      </div>
      <div class="dir-search">
        <div class="ds-input">
          <Icon name="search" :size="13" />
          <input v-model="dirKw" placeholder="指标ID/指标名称" autocomplete="off">
        </div>
        <label class="exact">精准匹配
          <span class="switch"><input type="checkbox" v-model="dirExact"><span class="sl"></span></span>
        </label>
      </div>
      <DirTree
        ops="icons"
        movable-dirs
        :show-all="false"
        leaf-icon="dir-ind"
        :tree="displayTree"
        :current="store.currentDir"
        :current-item="store.currentItem"
        :count-of="store.dirCount"
        :leaves-of="store.itemsInDir"
        @select="store.selectDir"
        @select-item="store.selectItem"
        @add="onAdd"
        @edit="onEdit"
        @edit-item="openEdit"
        @remove="onRemoveDir"
        @remove-item="onRemoveItem"
        @move="onMove"
        @drop-item="onDropItem"
        @drop-dir="onDropDir"
      />
      <div class="dir-foot">
        <button type="button" @click="onFooterAdd">
          <Icon name="plus-14" :size="13" />
          添加一级目录
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

    <section class="dir-main">
      <div class="dir-toolbar">
        <div class="dir-toolbar-lead">
          <div class="seg">
            <button type="button" class="seg-btn" :class="{ on: seg === 'list' }" @click="seg = 'list'; store.currentItem = ''">列表</button>
            <button type="button" class="seg-btn" :class="{ on: seg === 'preview' }" @click="seg = 'preview'">数据预览</button>
          </div>
          <div class="ds-search">
            <Icon name="search" :size="13" />
            <input
              v-model="listKw"
              :placeholder="seg === 'preview' ? '指标名称/指标ID' : '指标名称/指标ID/创建人/来源部门'"
              autocomplete="off"
            >
          </div>
          <div v-show="seg === 'list'" class="gi-date ds-creator-filter" :class="{ open: creatorOpen }">
            <button type="button" class="gi-date-btn" :class="{ on: !!creator }" title="按创建人筛选" @click.stop="toggleCreator">
              <svg class="i" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="6" r="2.4" stroke="currentColor" stroke-width="1.3"/>
                <path d="M3.6 13c.6-2.2 2.2-3.4 4.4-3.4s3.8 1.2 4.4 3.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              <span>{{ creatorLabel }}</span>
              <Icon name="chevron-down" :size="10" />
            </button>
            <div v-if="creatorOpen" class="gi-type-pop show" @click.stop>
              <button type="button" class="gi-type-item" :class="{ on: !creator }" @click="setCreator('')">全部创建人</button>
              <button
                v-for="n in creatorOptions"
                :key="n"
                type="button"
                class="gi-type-item"
                :class="{ on: creator === n }"
                @click="setCreator(n)"
              >{{ n }}</button>
            </div>
          </div>
        </div>
        <div class="dir-actions">
          <button class="btn" type="button" title="按频度配置调度时间" @click="openFreqSched">任务调度</button>
          <button class="btn" type="button" @click="choiceOpen = true">指标登记注册</button>
          <span title="本期暂未开放" style="display:inline-block">
            <button class="btn primary" type="button" disabled>批量添加指标库</button>
          </span>
        </div>
      </div>

      <div v-show="seg === 'list'" class="list-wrap">
        <table class="cfg-table">
          <thead>
            <tr>
              <th style="width:100px">指标ID</th>
              <th style="width:240px">指标名称</th>
              <th style="width:100px">来源部门</th>
              <th style="width:110px">数据日期</th>
              <th style="width:100px">数据状态</th>
              <th style="width:90px">指标来源</th>
              <th style="width:88px">创建人</th>
              <th style="width:100px">更新方式</th>
              <th class="ind-ops" style="width:248px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!listRows.length">
              <td colspan="9" style="padding:0;border:none">
                <div class="ind-empty">
                  <div class="ie-title">{{ emptyReason === 'search' ? '未找到匹配指标' : `「${dirShort(store.currentDir) || '当前目录'}」暂未注册指标` }}</div>
                  <div>{{ emptyReason === 'search' ? '试试调整关键词，或通过「指标登记注册」补充指标' : '当前目录下还没有已注册的指标，请先完成指标登记注册（支持录入或 Excel 导入）' }}</div>
                  <button type="button" class="ie-link" @click="choiceOpen = true">前往指标登记注册</button>
                </div>
              </td>
            </tr>
            <tr v-for="it in listRows" :key="it.id" draggable="true" @dragstart="onRowDragStart($event, it)">
              <td>{{ it.id }}</td>
              <td class="tname" :title="it.name.length > 30 ? it.name : ''">{{ nameCell(it.name) }}</td>
              <td>{{ it.dept || '—' }}</td>
              <td>{{ it.date }}</td>
              <td><span class="st" :class="stClass(it)"><span v-if="it.running" class="st-spin" /><span>{{ it.running ? '执行中' : it.status }}</span></span></td>
              <td><span class="src-tag" :class="it.origin === 'RPA' ? 'rpa' : 'manual'">{{ it.origin }}</span></td>
              <td>{{ it.creator || '—' }}</td>
              <td>{{ it.upd }}</td>
              <td class="ind-ops">
                <button type="button" class="btn linkish" @click="openEdit(it)">编辑</button>
                <span v-if="!it.inLib" class="run-tip" @mouseenter="showRunTip($event, true)" @mouseleave="showRunTip($event, false)">
                  <button type="button" class="btn linkish is-off" disabled>立即执行</button>
                </span>
                <button v-else-if="it.running" type="button" class="btn linkish" disabled><span class="st-spin" />执行中</button>
                <button v-else type="button" class="btn linkish" @click="runInd(it)">立即执行</button>
                <span v-if="it.inLib" class="add-done">已添加</span>
                <button v-else type="button" class="btn linkish" @click="openLib(it)">添加</button>
                <button type="button" class="btn linkish danger-text" @click="onRemoveItem(it)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-show="seg === 'preview'" class="preview-wrap show">
        <div ref="previewScrollEl" class="preview-scroll">
          <div v-if="!previewCols.length" class="pv-empty">
            <template v-if="!dirRows.length">
              <div class="ind-empty">
                <div class="ie-title">「{{ dirShort(store.currentDir) || '当前目录' }}」暂未注册指标</div>
                <div>当前目录下还没有已注册的指标，请先完成指标登记注册（支持录入或 Excel 导入）</div>
                <button type="button" class="ie-link" @click="choiceOpen = true">前往指标登记注册</button>
              </div>
            </template>
            <template v-else-if="listKw.trim()">未找到匹配「{{ listKw.trim() }}」的「{{ freq }}」指标</template>
            <template v-else>当前目录暂无「{{ freq }}」指标，可切换其他频度查看</template>
          </div>
          <table v-else class="pv-table">
            <tbody>
              <tr class="pv-meta">
                <td class="pv-label">指标名称</td>
                <td v-for="(it, ci) in previewCols" :key="it.id + 'n'" :class="{ 'is-anchor': ci === 0 && !!listKw.trim() }"><span class="pv-name" :title="it.name">{{ it.name }}</span></td>
              </tr>
              <tr class="pv-meta">
                <td class="pv-label">指标ID</td>
                <td v-for="(it, ci) in previewCols" :key="it.id + 'i'"><span class="pv-id">{{ previewId(it, ci) }}</span></td>
              </tr>
              <tr class="pv-meta">
                <td class="pv-label">频度</td>
                <td v-for="it in previewCols" :key="it.id + 'f'">{{ it.freq }}</td>
              </tr>
              <tr class="pv-meta">
                <td class="pv-label">单位</td>
                <td v-for="it in previewCols" :key="it.id + 'u'">{{ it.unit }}</td>
              </tr>
              <tr class="pv-meta">
                <td class="pv-label">更新时间</td>
                <td v-for="it in previewCols" :key="it.id + 't'">{{ previewUpd(it) }}</td>
              </tr>
              <tr class="pv-meta">
                <td class="pv-label">操作</td>
                <td v-for="it in previewCols" :key="it.id + 'o'" class="pv-op">
                  <span v-if="it.inLib" class="pv-op-done">已添加</span>
                  <button v-else type="button" class="pv-op-link" @click="openLib(it)">加入指标库</button>
                </td>
              </tr>
              <tr v-for="(d, di) in previewDates" :key="d">
                <td class="pv-label">{{ d }}</td>
                <td v-for="it in previewCols" :key="it.id + d" class="pv-val">{{ seriesOf(it)[di]?.val }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="freq-bar">
          <button v-for="f in FREQS" :key="f" type="button" class="freq-btn" :class="{ on: freq === f }" @click="freq = f; store.currentItem = ''">{{ f }}</button>
        </div>
      </div>
    </section>
  </div>

  <div v-if="runTipPos" class="blk-tip show" :style="{ left: runTipPos.left + 'px', top: runTipPos.top + 'px' }">{{ runTipPos.text }}</div>

  <Teleport to="body">
    <div v-if="taskOpen" class="task-drawer-mask show" @mousedown.self="closeTask">
      <div class="task-drawer">
        <div class="task-drawer-head">
          <span class="mh-title">
            <span class="mh-ico"><Icon name="g-106c566e" :size="16" /></span>
            任务调度
          </span>
          <button class="mh-x" type="button" title="关闭" @click="closeTask"><Icon name="close-14" :size="14" /></button>
        </div>
        <div class="task-drawer-body">
          <div class="task-toolbar" @click.stop>
            <div class="task-search">
              <Icon name="search" :size="13" />
              <input v-model="taskKw" placeholder="搜索任务名称 / 指标ID / 指标名称" autocomplete="off">
            </div>
            <div class="task-filter">
              <button type="button" class="task-filter-btn" :class="{ on: !!taskFreq }" @click="toggleTaskPop('freq', $event)">
                <span>{{ taskFreqLabel }}</span>
                <Icon name="chevron-down" :size="10" />
              </button>
              <div v-if="taskPop === 'freq'" class="task-filter-pop show">
                <button v-for="f in FREQ_FILTERS" :key="f.id || 'all'" type="button" class="tf-opt" :class="{ on: taskFreq === f.id }" @click="pickTaskFilter('freq', f.id)">{{ f.label }}</button>
              </div>
            </div>
            <div class="task-filter">
              <button type="button" class="task-filter-btn" :class="{ on: taskTimeOn }" @click="toggleTaskPop('time', $event)">
                <Icon name="calendar" :size="13" />
                <span>{{ taskTimeLabel }}</span>
                <Icon name="chevron-down" :size="10" />
              </button>
              <div v-if="taskPop === 'time'" class="task-filter-pop wide show">
                <div class="tf-date-row"><label>开始</label><input v-model="taskDraftFrom" type="date"></div>
                <div class="tf-date-row"><label>结束</label><input v-model="taskDraftTo" type="date"></div>
                <div class="tf-pop-acts">
                  <button type="button" class="btn tint" @click="resetTaskDate">重置</button>
                  <button type="button" class="btn primary" @click="applyTaskDate">确定</button>
                </div>
              </div>
            </div>
            <div class="task-filter">
              <button type="button" class="task-filter-btn" :class="{ on: !!taskCfg }" @click="toggleTaskPop('cfg', $event)">
                <span>{{ taskCfgLabel }}</span>
                <Icon name="chevron-down" :size="10" />
              </button>
              <div v-if="taskPop === 'cfg'" class="task-filter-pop show">
                <button v-for="f in CFG_FILTERS" :key="f.id || 'all'" type="button" class="tf-opt" :class="{ on: taskCfg === f.id }" @click="pickTaskFilter('cfg', f.id)">{{ f.label }}</button>
              </div>
            </div>
            <div class="task-filter">
              <button type="button" class="task-filter-btn" :class="{ on: !!taskTrigger }" @click="toggleTaskPop('trigger', $event)">
                <span>{{ taskTriggerLabel }}</span>
                <Icon name="chevron-down" :size="10" />
              </button>
              <div v-if="taskPop === 'trigger'" class="task-filter-pop show">
                <button v-for="f in TRIGGER_FILTERS" :key="f.id || 'all'" type="button" class="tf-opt" :class="{ on: taskTrigger === f.id }" @click="pickTaskFilter('trigger', f.id)">{{ f.label }}</button>
              </div>
            </div>
            <div class="task-filter">
              <button type="button" class="task-filter-btn" :class="{ on: !!taskStatus }" @click="toggleTaskPop('status', $event)">
                <span>{{ taskStatusLabel }}</span>
                <Icon name="chevron-down" :size="10" />
              </button>
              <div v-if="taskPop === 'status'" class="task-filter-pop show">
                <button v-for="f in STATUS_FILTERS" :key="f.id || 'all'" type="button" class="tf-opt" :class="{ on: taskStatus === f.id }" @click="pickTaskFilter('status', f.id)">{{ f.label }}</button>
              </div>
            </div>
            <div class="task-toolbar-right">
              <span v-if="taskSelected.length" class="task-sel-hint">已选 <b>{{ taskSelected.length }}</b> 条</span>
              <div class="task-filter">
                <button class="btn tint" type="button" :disabled="!taskSelected.length" @click="toggleTaskPop('batch', $event)">
                  批量设置
                  <Icon name="chevron-down" :size="10" />
                </button>
                <div v-if="taskPop === 'batch'" class="task-filter-pop show task-batch-pop">
                  <button type="button" class="tf-opt" @click="batchTask('sched')">配置调度时间</button>
                  <button type="button" class="tf-opt" @click="batchTask('on')">批量启动</button>
                  <button type="button" class="tf-opt" @click="batchTask('off')">批量暂停</button>
                </div>
              </div>
              <span class="task-hint">共 <b>{{ filteredTasks.length }}</b> 条任务</span>
            </div>
          </div>
          <div class="task-table-wrap">
            <table class="cfg-table" style="margin:0">
              <thead>
                <tr>
                  <th class="task-chk-h"><input type="checkbox" :checked="filteredTasks.length && taskSelected.length === filteredTasks.length" @change="toggleTaskAll($event.target.checked)"></th>
                  <th>任务名称</th>
                  <th style="width:72px">调度分类</th>
                  <th>关联指标</th>
                  <th style="width:150px">调度时间</th>
                  <th style="width:88px">配置状态</th>
                  <th style="width:88px">触发方式</th>
                  <th style="width:150px">上次执行</th>
                  <th style="width:86px">执行结果</th>
                  <th style="width:110px">状态</th>
                  <th style="width:96px">修改人</th>
                  <th style="width:148px">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!filteredTasks.length">
                  <td colspan="12" style="text-align:center;color:var(--text-3);padding:48px 0">暂无匹配任务，可调整筛选或清空搜索</td>
                </tr>
                <tr v-for="t in filteredTasks" :key="t.id" :class="{ 'row-fail': t.result === '失败' }">
                  <td class="task-chk-h"><input type="checkbox" :checked="taskSelected.includes(t.id)" @change="toggleTaskSel(t.id, $event.target.checked)"></td>
                  <td class="tname">{{ t.name }}</td>
                  <td><span class="task-freq-tag">{{ t.freq }}</span></td>
                  <td>
                    <div class="task-inds">
                      <template v-if="t.inds?.length">
                        <button v-for="x in t.inds" :key="x.id" type="button" class="ind-link" @click="openLog(t)">{{ x.id }} {{ x.name }}</button>
                        <span v-if="t.indTotal > t.inds.length" style="color:var(--text-3)"> 等{{ t.indTotal }}个</span>
                      </template>
                      <template v-else>—</template>
                    </div>
                  </td>
                  <td>
                    <button type="button" class="cron-link" :class="{ unset: !t.configured }" @click="openSched(t)">{{ t.configured ? t.cron : '按照系统调度执行' }}</button>
                  </td>
                  <td><span class="task-cfg-tag" :class="t.configured ? 'yes' : 'no'">{{ t.configured ? '已配置' : '未配置' }}</span></td>
                  <td><span class="task-trigger-tag" :class="taskTriggerOf(t) === '系统默认调度' ? 'sys' : taskTriggerOf(t) === '自动调度' ? 'auto' : ''">{{ taskTriggerOf(t) }}</span></td>
                  <td>{{ t.last }}</td>
                  <td>
                    <span v-if="t.configured" class="st" :class="t.result === '失败' ? 'fail' : 'on'">{{ t.result }}</span>
                    <span v-else style="color:var(--text-3)">—</span>
                  </td>
                  <td>
                    <div class="task-status-cell">
                      <label class="task-switch" :title="t.running ? '执行中不可切换' : (t.on ? '点击暂停' : '点击启动')">
                        <input type="checkbox" :checked="t.on" :disabled="t.running || !t.configured" @change="store.toggleTask(store.currentSrc, t.id, $event.target.checked)">
                        <span class="sl"></span>
                      </label>
                    </div>
                  </td>
                  <td style="color:var(--text-2)">{{ t.modifier || '—' }}</td>
                  <td>
                    <div class="op-cell">
                      <button type="button" class="task-ico edit" :class="t.configured ? 'set' : 'unset'" :data-tip="t.configured ? '已配置 · 点击编辑' : '未配置 · 按照系统调度执行 · 点击编辑'" @click="openSched(t)">
                        <Icon :name="t.configured ? 'g-999df5b7' : 'g-0b119368'" :size="15" />
                      </button>
                      <button v-if="t.running" type="button" class="task-ico pause" data-tip="暂停" @click="pauseTask(t)">
                        <Icon name="g-c12599be" :size="15" />
                      </button>
                      <button v-else type="button" class="task-ico run" data-tip="立即执行" :disabled="!t.on || !t.configured" @click="store.runTask(store.currentSrc, t.id)">
                        <Icon name="g-c7c8d705" :size="15" />
                      </button>
                      <button type="button" class="task-ico log" data-tip="执行日志" :disabled="!t.configured" @click="openLog(t)">
                        <Icon name="g-760c87ad" :size="15" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="task-drawer-foot">
          <button class="btn" type="button" @click="closeTask">关闭</button>
        </div>
      </div>
    </div>
  </Teleport>

  <AppModal
    :visible="freqOpen"
    title="任务调度"
    icon="g-106c566e"
    :width="920"
    :height="620"
    flush
    @update:visible="(v) => { freqOpen = v; if (!v) fsDrop = '' }"
  >
    <div class="freq-sched-body">
      <aside class="fs-rail">
        <div class="fs-list-h">调度频度</div>
        <nav class="fs-list">
          <button
            v-for="it in fsList"
            :key="it.type"
            type="button"
            class="fs-item"
            :class="{ on: fsType === it.type }"
            @click="selectFsType(it.type)"
          >
            <span class="fs-badge">{{ it.short }}</span>
            <span class="fs-item-main">
              <span class="fs-lab">{{ it.label }}</span>
              <span class="fs-sum">{{ it.sum }}</span>
            </span>
          </button>
        </nav>
      </aside>
      <section class="fs-pane" @click="fsDrop = ''">
        <div class="fs-pane-head">
          <div>
            <div class="fs-pane-title">{{ fsMeta.label }}调度</div>
            <div class="fs-pane-desc">{{ fsMeta.desc }}</div>
          </div>
        </div>
        <div v-if="fsType === 'weekly'" class="fs-card">
          <span class="fs-k">星期 <span class="fs-k-sub">可多选</span></span>
          <div class="fs-week-grid">
            <button v-for="d in 7" :key="d" type="button" class="fs-chip" :class="{ on: fsWeekOn.has(d) }" @click.stop="toggleFsWeek(d)">周{{ WEEK_LABELS[d] }}</button>
          </div>
        </div>
        <div v-if="fsType === 'xun'" class="fs-card">
          <span class="fs-k">旬日 <span class="fs-k-sub">可多选</span></span>
          <div class="fs-choice-row">
            <button v-for="it in XUN_OPTS" :key="it.v" type="button" class="fs-chip wide" :class="{ on: fsXunOn.has(String(it.v)) }" @click.stop="toggleFsXun(it.v)">{{ it.lab }}</button>
          </div>
        </div>
        <div v-if="fsType === 'quarter'" class="fs-card">
          <span class="fs-k">季度月 <span class="fs-k-sub">可多选</span></span>
          <div class="fs-choice-row">
            <button v-for="it in Q_SLOTS" :key="it.v" type="button" class="fs-chip wide" :class="{ on: fsQuarterOn.has(it.v) }" @click.stop="toggleFsQuarter(it.v)">{{ it.lab }}</button>
          </div>
        </div>
        <div v-if="fsType === 'yearly'" class="fs-card">
          <span class="fs-k">月份 <span class="fs-k-sub">可多选</span></span>
          <div class="fs-month-grid">
            <button v-for="m in 12" :key="m" type="button" class="fs-chip" :class="{ on: fsMonthOn.has(m) }" @click.stop="toggleFsMonth(m)">{{ m }}月</button>
          </div>
        </div>
        <div v-if="fsType === 'monthly' || fsType === 'quarter' || fsType === 'yearly'" class="fs-card">
          <span class="fs-k">日期 <span class="fs-k-sub">日历多选</span></span>
          <div class="fs-cal-wrap">
            <div class="fs-cal-hd">
              <span v-for="(n, i) in ['一','二','三','四','五','六','日']" :key="n" :class="{ wknd: i >= 5 }">{{ n }}</span>
            </div>
            <div class="fs-cal">
              <button
                v-for="d in fsCalDays"
                :key="d"
                type="button"
                class="fs-chip cal"
                :class="{ on: fsDayOn.has(String(d)), wknd: (d - 1) % 7 >= 5 }"
                @click.stop="toggleFsDay(d)"
              >{{ d }}</button>
            </div>
            <div class="fs-cal-foot">
              <button type="button" class="fs-chip end" :class="{ on: fsDayOn.has('end') }" @click.stop="toggleFsDay('end')">月末</button>
            </div>
          </div>
        </div>
        <div class="fs-card" @click.stop>
          <span class="fs-k">执行时间</span>
          <div class="fs-time-row">
            <div class="fs-dd" :class="{ open: fsDrop === 'hour' }">
              <button type="button" class="fs-dd-trigger" @click.stop="toggleFsDrop('hour')">
                <span>{{ pad2(fsHour) }}</span>
                <Icon name="caret-down" :size="10" />
              </button>
              <div v-if="fsDrop === 'hour'" class="fs-dd-panel">
                <button v-for="h in fsHours" :key="h" type="button" class="fs-dd-opt" :class="{ on: fsHour === h }" @click.stop="fsHour = h; fsDrop = ''">{{ pad2(h) }}</button>
              </div>
            </div>
            <span class="fs-time-unit">时</span>
            <div class="fs-dd" :class="{ open: fsDrop === 'min' }">
              <button type="button" class="fs-dd-trigger" @click.stop="toggleFsDrop('min')">
                <span>{{ pad2(fsMin) }}</span>
                <Icon name="caret-down" :size="10" />
              </button>
              <div v-if="fsDrop === 'min'" class="fs-dd-panel">
                <button v-for="m in fsMins" :key="m" type="button" class="fs-dd-opt" :class="{ on: fsMin === m }" @click.stop="fsMin = m; fsDrop = ''">{{ pad2(m) }}</button>
              </div>
            </div>
            <span class="fs-time-unit">分</span>
          </div>
          <div class="fs-times">
            <span v-for="(tm, i) in (fsDraft.times || [])" :key="tm + i" class="fs-time-chip">
              {{ tm }}
              <button v-if="(fsDraft.times || []).length > 1" type="button" class="rm" title="删除" @click="removeFsTime(i)">×</button>
            </span>
            <button type="button" class="fs-add-time" @click="addFsTime">＋ 添加此时刻</button>
          </div>
        </div>
        <div class="fs-preview"><span>调度预览</span><b>{{ fsPreview }}</b></div>
      </section>
    </div>
    <template #footer>
      <span class="foot-left">每种频度独立保存，互不影响</span>
      <button type="button" class="btn primary" style="min-width:88px" @click="saveFreqSched">保存</button>
      <button type="button" class="btn" style="min-width:88px" @click="freqOpen = false">取消</button>
    </template>
  </AppModal>

  <AppModal :visible="choiceOpen" title="指标登记注册" icon="g-2826cfce" :width="560" @update:visible="(v) => { choiceOpen = v }">
    <div class="excel-tip">
      支持两种注册方式：<b>录入登记注册</b>适合已知指标 ID 的少量补充；<b>Excel导入注册</b>适合按模板批量注册。
      也可先下载 <a href="javascript:;" @click="downloadTpl">数据登记注册 Excel 模板</a> 填写后再导入。
    </div>
    <div class="choice-grid">
      <button type="button" class="choice-card" @click="openReg">
        <div class="cc-title">录入登记注册</div>
        <div class="cc-desc">按指标ID手工录入，指定所属目录与频度后保存。</div>
      </button>
      <button type="button" class="choice-card" @click="choiceOpen = false; excelOpen = true">
        <div class="cc-title">Excel导入注册</div>
        <div class="cc-desc">下载「数据登记注册」模板填写后上传，预览确认完成批量注册。</div>
      </button>
    </div>
    <template #footer>
      <button type="button" class="btn" style="min-width:88px" @click="choiceOpen = false">取消</button>
    </template>
  </AppModal>

  <AppModal :visible="regOpen" title="录入登记注册" icon="copy" :width="880" @update:visible="(v) => { regOpen = v }">
    <div class="excel-tip">已知指标 ID 时使用：填写 <b>指标ID</b>、所属目录与<b>频度</b>后保存，支持一次登记多条。</div>
    <div class="add-rows">
      <div v-for="(row, i) in regRows" :key="i" class="add-form-row">
        <div class="fm-field"><label>指标ID</label><input v-model="row.id" placeholder="如 IND0001"></div>
        <div class="fm-field"><label>指标名称</label><input v-model="row.name" placeholder="必填"></div>
        <div class="fm-field fm-freq"><label>频度</label>
          <a-select v-model="row.freq" class="app-field-select" popup-container="body" :trigger-props="arcoPopup">
            <a-option v-for="f in FREQS" :key="f" :value="f">{{ f }}</a-option>
          </a-select>
        </div>
        <div class="fm-field fm-dir"><label>所属目录</label>
          <DirPathPicker v-model="row.dir" :tree="store.tree" placeholder="请选择目录" />
        </div>
        <div class="add-row-act">
          <label>.</label>
          <button type="button" class="add-row-del" :disabled="regRows.length === 1" @click="removeRegRow(i)">删除</button>
        </div>
      </div>
    </div>
    <button type="button" class="add-link" @click="addRegRow"><span class="add-ico">+</span>添加一行</button>
    <template #footer>
      <button type="button" class="btn primary" style="min-width:88px" @click="confirmReg">保存登记</button>
      <button type="button" class="btn" style="min-width:88px" @click="regOpen = false">取消</button>
    </template>
  </AppModal>

  <AppModal :visible="excelOpen" title="Excel导入注册" icon="g-fef0d54b" :width="920" @update:visible="(v) => { excelOpen = v }">
    <div class="excel-tip">适合批量注册：先下载 <b>数据登记注册 Excel 模板</b>，填写 <b>指标ID / 指标名称 / 所属目录 / 单位 / 频度 / 指标来源</b>，上传后预览确认即可完成注册。</div>
    <div class="fm-field" style="margin-bottom:0">
      <label><i class="req">*</i>上传 Excel 文件</label>
      <label class="upload-box" @dragover.prevent @drop="onDropExcel">
        <Icon name="g-6c4725d1" :size="30" />
        <div class="up-text">{{ excelName || '点击选择文件，或拖拽 .xlsx 到此处' }}</div>
        <div class="up-hint">请先<a href="javascript:;" @click.prevent="downloadTpl">下载数据登记注册 Excel 模板</a>，按模板字段填写后再上传</div>
        <input type="file" accept=".xlsx,.xls" hidden @change="onExcelFile">
      </label>
    </div>
    <div v-if="excelRows.length" class="excel-preview show">
      <div class="ep-head"><span>解析预览 · 共 <b>{{ excelRows.length }}</b> 条待注册</span></div>
      <div class="excel-preview-wrap">
        <table>
          <thead><tr><th>指标ID</th><th>指标名称</th><th>所属目录</th><th>单位</th><th>频度</th><th>指标来源</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in excelRows" :key="i">
              <td>{{ r.id }}</td><td class="ep-name">{{ r.name }}</td><td>{{ r.dir }}</td><td>{{ r.unit }}</td><td>{{ r.freq }}</td><td>{{ r.origin }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <template #footer>
      <button type="button" class="btn primary" style="min-width:88px" @click="confirmExcel">确认注册</button>
      <button type="button" class="btn" style="min-width:88px" @click="excelOpen = false">取消</button>
    </template>
  </AppModal>

  <AppModal :visible="dirModal.visible" :title="dirModal.mode === 'edit' ? '编辑' : '添加'" :icon="dirModal.mode === 'edit' ? 'edit-fill' : 'plus-16'" :width="480" @update:visible="(v) => { dirModal.visible = v }">
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
          :tree="store.tree"
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

  <AppModal :visible="batchModal.visible" title="批量移动指标" icon="swap-16" overflow-visible :width="600" @update:visible="(v) => { batchModal.visible = v }">
    <div class="bm-toolbar">
      <div style="font-size:13px;color:var(--text-2)">来源目录：<b>{{ dirShort(store.currentDir) || '当前目录' }}</b></div>
      <span class="bm-summary">已选 {{ batchModal.ids.length }} / {{ batchList.length }}</span>
      <button type="button" class="btn" style="height:30px;padding:0 12px;font-size:12px" @click="toggleBatchAll">
        {{ batchModal.ids.length === batchList.length && batchList.length ? '取消全选' : '全选' }}
      </button>
    </div>
    <div class="bm-list">
      <label v-for="c in batchList" :key="c.id" class="bm-row">
        <input type="checkbox" :checked="batchModal.ids.includes(c.id)" @change="toggleBatchId(c.id, $event.target.checked)">
        <span class="bm-name">{{ c.name }}</span>
        <span class="bm-dir">{{ dirShort(c.dir) }}</span>
      </label>
    </div>
    <div class="bm-select">
      <label>移动到</label>
      <DirPathPicker v-model="batchModal.dir" :tree="store.tree" placeholder="请选择目标目录" />
    </div>
    <template #footer>
      <button type="button" class="btn primary" @click="doBatchMove">确认移动</button>
      <button type="button" class="btn tint" @click="batchModal.visible = false">取消</button>
    </template>
  </AppModal>

  <AppModal :visible="delModal.visible" :title="delModal.title" icon="trash" danger :width="440" @update:visible="(v) => { delModal.visible = v }">
    <p style="font-size:13px;color:var(--text-2);line-height:1.7">{{ delModal.msg }}</p>
    <template #footer>
      <button type="button" class="btn danger" @click="confirmDel">删除</button>
      <button type="button" class="btn tint" @click="delModal.visible = false">取消</button>
    </template>
  </AppModal>

  <AppModal :visible="editOpen" title="编辑指标" icon="edit-fill" overflow-visible :width="520" @update:visible="(v) => { editOpen = v }">
    <div class="edit-ind-body">
      <div class="edit-ind-field"><label>指标ID</label><input :value="editForm.id" disabled></div>
      <div class="edit-ind-field"><label><span class="req">*</span>指标名称</label><input v-model="editForm.name"></div>
      <div class="edit-ind-field"><label>所属目录</label><DirPathPicker v-model="editForm.dir" :tree="store.tree" placeholder="请选择目录" /></div>
      <div class="edit-ind-field"><label>频度</label>
        <a-select v-model="editForm.freq" class="app-field-select" popup-container="body" :trigger-props="arcoPopup">
          <a-option v-for="f in FREQS" :key="f" :value="f">{{ f }}</a-option>
        </a-select>
      </div>
      <div class="edit-ind-field"><label>单位</label><input v-model="editForm.unit"></div>
      <div class="edit-ind-field"><label>指标来源</label>
        <a-select v-model="editForm.origin" class="app-field-select" popup-container="body" :trigger-props="arcoPopup">
          <a-option value="RPA">RPA</a-option>
          <a-option value="手工">手工</a-option>
        </a-select>
      </div>
      <div class="edit-ind-field"><label>更新方式</label>
        <a-select v-model="editForm.upd" class="app-field-select" popup-container="body" :trigger-props="arcoPopup">
          <a-option value="定时更新">定时更新</a-option>
          <a-option value="手动更新">手动更新</a-option>
        </a-select>
      </div>
    </div>
    <template #footer>
      <button type="button" class="btn primary" @click="saveEdit">保存</button>
      <button type="button" class="btn tint" @click="editOpen = false">取消</button>
    </template>
  </AppModal>

  <AppModal :visible="libOpen" title="加入指标库" icon="plus-16" overflow-visible :width="520" @update:visible="(v) => { libOpen = v }">
    <div class="edit-ind-body">
      <div class="edit-ind-field"><label>指标名称</label><input v-model="libForm.name"></div>
      <div class="edit-ind-field"><label>单位</label><input v-model="libForm.unit"></div>
      <div class="edit-ind-field"><label>频度</label>
        <a-select v-model="libForm.freq" class="app-field-select" popup-container="body" :trigger-props="arcoPopup">
          <a-option v-for="f in FREQS" :key="f" :value="f">{{ f }}</a-option>
        </a-select>
      </div>
      <div class="edit-ind-field"><label>指标目录</label><DirPathPicker v-model="libForm.dir" :tree="indicators.dirs" placeholder="请选择指标目录" /></div>
    </div>
    <template #footer>
      <button type="button" class="btn primary" @click="confirmLib">确认添加</button>
      <button type="button" class="btn tint" @click="libOpen = false">取消</button>
    </template>
  </AppModal>

  <AppModal :visible="schedOpen" title="配置调度时间" icon="g-70434d87" :width="640" :z-index="2700" @update:visible="(v) => { schedOpen = v }">
    <div class="sched-form">
      <div class="sched-row"><label>任务</label><div class="sched-ctl" style="line-height:32px">{{ schedForm.name }}</div></div>
      <div class="sched-row">
        <label>执行频率</label>
        <div class="sched-ctl">
          <a-select v-model="schedForm.type" class="sched-type" popup-container="body" :trigger-props="{ popupStyle: { zIndex: 5200 } }">
            <a-option value="daily">每天</a-option>
            <a-option value="weekly">每周</a-option>
            <a-option value="xun">每旬</a-option>
            <a-option value="monthly">每月</a-option>
            <a-option value="quarter">每季</a-option>
            <a-option value="half">每半年</a-option>
            <a-option value="yearly">每年</a-option>
          </a-select>
        </div>
      </div>
      <div v-if="schedForm.type === 'weekly'" class="sched-row">
        <label>星期</label>
        <div class="sched-ctl sched-weekdays">
          <label v-for="d in 7" :key="d"><input type="checkbox" :value="d" :checked="schedForm.weekdays.includes(d)" @change="(e) => { schedForm.weekdays = e.target.checked ? [...schedForm.weekdays, d] : schedForm.weekdays.filter(x => x !== d) }">{{ d }}</label>
        </div>
      </div>
      <div class="sched-row">
        <label>执行时间</label>
        <div class="sched-ctl">
          <div class="sched-times">
            <div v-for="(tm, i) in schedForm.times" :key="i" class="fs-time-chip">
              <input v-model="schedForm.times[i]" type="time">
              <button type="button" class="rm" @click="removeSchedTime(i)">✕</button>
            </div>
            <button type="button" class="fs-add-time" @click="addSchedTime">+ 添加时刻</button>
          </div>
        </div>
      </div>
      <div class="sched-preview">调度预览：<b>{{ schedPreview }}</b></div>
    </div>
    <template #footer>
      <button type="button" class="btn primary" @click="saveSched">保存</button>
      <button type="button" class="btn tint" @click="schedOpen = false">取消</button>
    </template>
  </AppModal>

  <AppModal :visible="logOpen" title="调度执行日志" icon="g-b452a530" :width="720" :z-index="2800" @update:visible="(v) => { logOpen = v }">
    <div class="task-log-meta">{{ logTask?.name }} · {{ logTask?.freq }}</div>
    <table class="task-log-table">
      <thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>结果</th></tr></thead>
      <tbody>
        <tr v-if="!taskLogs.length"><td colspan="4" class="empty">暂无执行记录</td></tr>
        <tr v-for="(l, i) in taskLogs" :key="i">
          <td>{{ l.time }}</td><td>{{ l.user }}</td><td>{{ l.action }}</td>
          <td><span class="st" :class="l.result === '失败' ? 'fail' : 'on'">{{ l.result }}</span></td>
        </tr>
      </tbody>
    </table>
    <template #footer>
      <button type="button" class="btn" @click="logOpen = false">关闭</button>
    </template>
  </AppModal>
</template>
