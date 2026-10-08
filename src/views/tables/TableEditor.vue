<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { useTableStore } from '../../stores/tables'
import { useIndicatorStore } from '../../stores/indicators'
import { ME, PEOPLE, todayStr } from '../../utils/hash'
import { applyTransforms, evalExpr, fmtDate, indValueAt, parseDate, rcToRef, refToRC, shiftPeriods, transformDate } from '../../utils/mixed'
import { workbookToXlsx } from '../../utils/workbook'
import { runWithExportLoading } from '../../utils/exportLoading'
import FortuneSheet from '../../components/FortuneSheet.vue'
import {
  PIVOT_AGGS, absCellRef, absRangeRef, addFieldTo, applyPivotConfig, buildPivotMatrix,
  emptyPivot, extractPivotSource, fieldUsed, filterLabel, guessZone, listWorkbookSheets,
  parseA1Cell, parseA1Range, removeField, sheetUsedRange, toPivotConfig, uniqueFieldValues,
  valueLabel, writePivotToSheet,
} from '../../utils/pivot'
import Icon from '../../components/Icon.vue'
import AppModal from '../../components/AppModal.vue'
import MxDatePanel from '../../components/MxDatePanel.vue'

const props = defineProps({
  tableId: { type: String, default: '' },
})
const emit = defineEmits(['close'])
const store = useTableStore()
const router = useRouter()

const open = computed(() => !!props.tableId)
const table = computed(() => store.get(props.tableId))
const sheetRef = ref(null)
const savedFlash = ref(false)
const exporting = ref(false)
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

/* —— 时间序列表格：选择指标 / 布局切换 / 批量设置 —— */
const indStore = useIndicatorStore()
const tsCfg = reactive({ picks: [], layout: 'indCols', decimals: 2, withUnit: false })
const tsPickOpen = ref(false)
const tsBatchOpen = ref(false)
const tsKw = ref('')
const isTs = computed(() => table.value?.type === 'timeseries')

watch(() => props.tableId, () => {
  const c = table.value?.tsSeries
  Object.assign(tsCfg, {
    picks: [...(c?.picks || [])],
    layout: c?.layout || 'indCols',
    decimals: c?.decimals ?? 2,
    withUnit: !!c?.withUnit,
  })
}, { immediate: true })

const groupedTs = computed(() => {
  const kw = tsKw.value.trim().toLowerCase()
  const map = new Map()
  indStore.cards.forEach((c) => {
    if (kw && !c.title.toLowerCase().includes(kw) && !String(c.id).toLowerCase().includes(kw)) return
    const g = c.dir || '未分类'
    if (!map.has(g)) map.set(g, [])
    map.get(g).push(c)
  })
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([g, items]) => ({ g, items }))
})

function toggleTsPick(title) {
  const i = tsCfg.picks.indexOf(title)
  if (i >= 0) tsCfg.picks.splice(i, 1)
  else tsCfg.picks.push(title)
}
function tsIndOf(title) {
  return indStore.get(title)
}
function tsHeadName(ind) {
  return tsCfg.withUnit && ind?.unit ? `${ind.title}(${ind.unit})` : ind.title
}
function buildTsCells() {
  const inds = tsCfg.picks.map((t) => tsIndOf(t)).filter(Boolean)
  const labels = indStore.LABELS
  const hd = (name) => ({ v: name, t: 1, s: { bl: 1, bg: { rgb: '#E8F3FF' } } })
  const num = (v) => Number(Number(v).toFixed(tsCfg.decimals))
  const cellData = {}
  if (tsCfg.layout === 'indRows') {
    // 指标为行、日期为列
    cellData[0] = { 0: hd('指标') }
    labels.forEach((m, c) => { cellData[0][c + 1] = hd(m) })
    inds.forEach((ind, r) => {
      cellData[r + 1] = { 0: hd(tsHeadName(ind)) }
      ;(ind.values || []).forEach((v, c) => {
        if (v != null) cellData[r + 1][c + 1] = { v: num(v), t: 2 }
      })
    })
  } else {
    // 日期为行、指标为列
    cellData[0] = { 0: hd('日期') }
    inds.forEach((ind, j) => { cellData[0][j + 1] = hd(tsHeadName(ind)) })
    labels.forEach((m, r) => {
      cellData[r + 1] = { 0: { v: m, t: 1 } }
      inds.forEach((ind, j) => {
        const v = ind.values?.[r]
        if (v != null) cellData[r + 1][j + 1] = { v: num(v), t: 2 }
      })
    })
  }
  return { cellData, rows: (tsCfg.layout === 'indRows' ? inds.length : labels.length) + 1, cols: (tsCfg.layout === 'indRows' ? labels.length : inds.length) + 1 }
}
async function applyTsSeries(isRefresh = false) {
  const t = table.value
  if (!t) return
  if (!tsCfg.picks.length) return Message.warning('请先选择指标')
  if (!sheetRef.value) return
  const built = buildTsCells()
  const snap = sheetRef.value.snapshot()
  const sheetId = snap.sheetOrder?.[0] || Object.keys(snap.sheets || {})[0]
  const sh = sheetId ? snap.sheets?.[sheetId] : null
  if (!sh) return Message.error('未找到可写入的工作表')
  sh.cellData = built.cellData
  sh.rowCount = Math.max(sh.rowCount || 40, built.rows + 6)
  sh.columnCount = Math.max(sh.columnCount || 12, built.cols + 4)
  sheetRef.value.load(snap)
  store.setTsConfig(t.id, JSON.parse(JSON.stringify({
    picks: [...tsCfg.picks], layout: tsCfg.layout, decimals: tsCfg.decimals, withUnit: tsCfg.withUnit,
  })))
  await capture()
  Message.success(isRefresh
    ? `已按指标中心最新数据刷新 ${tsCfg.picks.length} 个指标（${tsCfg.layout === 'indRows' ? '日期为列' : '指标为列'}）`
    : `已生成 ${tsCfg.picks.length} 个指标的时序数据（${tsCfg.layout === 'indRows' ? '日期为列' : '指标为列'}）`)
}
function refreshTsData() {
  if (!sheetRef.value) return
  applyTsSeries(true)
}
function confirmTsPick() {
  tsPickOpen.value = false
  applyTsSeries()
}
function setTsLayout(l) {
  if (tsCfg.layout === l) return
  tsCfg.layout = l
  if (tsCfg.picks.length) applyTsSeries()
  else transposeSheet()
}
// 未选择指标时：对当前工作表已有内容做原地转置，保证布局切换始终生效
async function transposeSheet() {
  const t = table.value
  if (!t || !sheetRef.value) return
  const snap = sheetRef.value.snapshot()
  const sheetId = snap.sheetOrder?.[0] || Object.keys(snap.sheets || {})[0]
  const sh = sheetId ? snap.sheets?.[sheetId] : null
  if (!sh) return
  const cd = sh.cellData || {}
  let maxR = -1
  let maxC = -1
  Object.keys(cd).forEach((r) => {
    const ri = Number(r)
    if (ri > maxR) maxR = ri
    Object.keys(cd[ri] || {}).forEach((c) => {
      const ci = Number(c)
      if (ci > maxC) maxC = ci
    })
  })
  if (maxR < 0 || maxC < 0) return Message.warning('当前工作表没有数据')
  const out = {}
  for (let r = 0; r <= maxR; r++) {
    const row = cd[r]
    if (!row) continue
    for (let c = 0; c <= maxC; c++) {
      const cell = row[c]
      if (!cell) continue
      out[c] = out[c] || {}
      out[c][r] = cell
    }
  }
  sh.cellData = out
  sh.rowCount = Math.max(sh.rowCount || 40, maxC + 7)
  sh.columnCount = Math.max(sh.columnCount || 12, maxR + 5)
  sheetRef.value.load(snap)
  store.setTsConfig(t.id, JSON.parse(JSON.stringify({
    picks: [...tsCfg.picks], layout: tsCfg.layout, decimals: tsCfg.decimals, withUnit: tsCfg.withUnit,
  })))
  await capture()
  Message.success(`已切换为${tsCfg.layout === 'indRows' ? '日期为列' : '指标为列'}`)
}
function confirmTsBatch() {
  tsBatchOpen.value = false
  applyTsSeries()
}

/* —— 混合表格：插入指标值 / 导入日期 / 日期计算 / 指标计算 + 动态绑定刷新 —— */
const isMixed = computed(() => table.value?.type === 'mixed')
const mxMenuOpen = ref(false)
const mxValOpen = ref(false)
const mxDateOpen = ref(false)
const mxCalcOpen = ref(false)
const mxDiffOpen = ref(false)
const mxTarget = ref(null) // 插入目标格 {row, col}
const mxCachedSnap = ref(null) // 打开弹层时的工作表快照（供关联单元格取值预览）
const mxLib = ref('base') // 指标库 / 预测指标库
const mxValPick = ref('')
const mxCalcPicks = ref([])
const mxCalcExpr = ref('A*B')
const mxDateInd = ref('')
const mxDate = reactive({ src: 'indLatest', back: 0, periodShift: 0, cellRef: '', manual: '', days: 0, weeks: 0, months: 0, anchor: 'none', transforms: [] })
const mxOp = reactive({ a: '', b: '', kind: 'diffDays' })
// 右键菜单 / 悬浮提示 / 虚线框 / 选格拾取
const mxCtx = reactive({ show: false, x: 0, y: 0 })
let mxCtxCell = null
const mxTip = reactive({ show: false, x: 0, y: 0, lines: [] })
const mxDash = reactive({ boxes: [] })
const stageEl = ref(null)
const mxPick = reactive({ active: false, modal: '', field: '' })

const mxCount = computed(() => Object.keys(table.value?.mixedConfig?.bindings || {}).length)
const r4 = (v) => Math.round(Number(v) * 10000) / 10000
const mxKw = ref('')
const mxFiltered = computed(() => {
  const kw = mxKw.value.trim().toLowerCase()
  return indStore.cards.filter((c) => {
    if (mxLib.value === 'pred' && c.kind !== 'calc') return false
    if (kw && !c.title.toLowerCase().includes(kw) && !String(c.id).toLowerCase().includes(kw)) return false
    return true
  })
})

function openMx(kind, targetCell) {
  mxMenuOpen.value = false
  const cell = targetCell || sheetRef.value?.activeCell?.()
  if (!cell) return Message.warning('请先在表格中点选一个单元格')
  mxTarget.value = { row: cell.row, col: cell.col }
  mxCachedSnap.value = sheetRef.value.snapshot()
  // 恢复表单默认值
  Object.assign(mxDate, { src: 'indLatest', back: 0, periodShift: 0, cellRef: '', manual: '', days: 0, weeks: 0, months: 0, anchor: 'none', transforms: [] })
  mxValPick.value = ''
  mxCalcPicks.value = []
  mxCalcExpr.value = 'A*B'
  mxOp.a = ''
  mxOp.b = ''
  mxOp.kind = 'diffDays'
  mxLib.value = 'base'
  mxKw.value = ''
  if (kind === 'value') mxValOpen.value = true
  else if (kind === 'date') { mxDate.src = 'system'; mxDateOpen.value = true }
  else if (kind === 'calc') mxCalcOpen.value = true
  else if (kind === 'diff') mxDiffOpen.value = true
}

function mxCellVal(refStr) {
  const rc = refToRC(refStr)
  const cd = mxCachedSnap.value?.sheets?.[mxCachedSnap.value.sheetOrder?.[0]]?.cellData
  return rc ? cd?.[rc.row]?.[rc.col]?.v : null
}

function mxResolveBase(dateCfg, ind) {
  if (dateCfg.src === 'system') return todayStr()
  if (dateCfg.src === 'cell') {
    const v = mxCellVal(dateCfg.cellRef)
    return parseDate(v) ? String(v).trim() : ''
  }
  if (dateCfg.src === 'manual') {
    const d = parseDate(dateCfg.manual)
    return d ? fmtDate(d) : ''
  }
  // 指标最新日期 + 期数前移（back ≥ 0 表示前移期数；兼容旧绑定的 periodShift 负数语义）
  if (!ind) return ''
  const shift = dateCfg.back != null ? -Number(dateCfg.back || 0) : Number(dateCfg.periodShift || 0)
  return shiftPeriods(ind.latestDate, shift, ind.freq)
}
function mxResolveDate(dateCfg, ind) {
  const base = mxResolveBase(dateCfg, ind)
  if (!base) return ''
  // 旧版单行变换（days/weeks/months/anchor）→ 叠加式变换（按添加顺序），两者兼容顺序执行
  const afterLegacy = transformDate(base, { days: dateCfg.days, weeks: dateCfg.weeks, months: dateCfg.months, anchor: dateCfg.anchor })
  return applyTransforms(afterLegacy, dateCfg.transforms)
}

// 各弹层预览
const mxValPv = computed(() => {
  const ind = indStore.get(mxValPick.value)
  if (!ind) return null
  const date = mxResolveDate(mxDate, ind)
  if (!date) return { date: '—', err: '无法解析日期，请检查来源配置' }
  const pv = indValueAt(ind, date, indStore.LABELS)
  if (!pv) return { date, err: '该日期下无数据' }
  return { date, value: pv.value, label: pv.label, unit: ind.unit || '' }
})
const mxDatePv = computed(() => {
  const ind = mxDate.src === 'indLatest' ? indStore.get(mxDateInd.value) : null
  if (mxDate.src === 'indLatest' && !ind) return { date: '—', err: '请选择指标' }
  const date = mxResolveDate(mxDate, ind)
  if (!date) return { date: '—', err: '无法解析日期，请检查来源配置' }
  return { date }
})
const mxCalcPv = computed(() => {
  if (!mxCalcPicks.value.length) return { err: '请选择参与计算的指标（A、B…）' }
  const vars = {}
  let lastDate = ''
  mxCalcPicks.value.forEach((t, i) => {
    const ind = indStore.get(t)
    if (!ind) return
    const d = mxResolveDate(mxDate, ind)
    const pv = indValueAt(ind, d, indStore.LABELS)
    if (pv) {
      vars[String.fromCharCode(65 + i)] = pv.value
      lastDate = d || lastDate
    }
  })
  const val = evalExpr(mxCalcExpr.value, vars)
  if (val == null) return { date: lastDate || '—', err: '表达式无效或指标无数据' }
  return { date: lastDate, value: val }
})
const mxDiffPv = computed(() => {
  const va = mxCellVal(mxOp.a)
  const vb = mxCellVal(mxOp.b)
  const da = parseDate(va)
  const db = parseDate(vb)
  if (!da || !db) return { err: `请填写两个日期单元格引用（${!da && va != null ? 'A' : ''}${!db && vb != null ? 'B' : ''} 格内容须为日期）` }
  const days = Math.round((da - db) / 86400000)
  if (mxOp.kind === 'diffDays') return { value: Math.abs(days), note: `天（${fmtShort(da)} 与 ${fmtShort(db)}）` }
  const picked = mxOp.kind === 'earlier' ? (days <= 0 ? da : db) : (days >= 0 ? da : db)
  return { value: fmtShort(picked) }
})
function fmtShort(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

async function writeMixedCell(cellObj, binding) {
  const t = table.value
  if (!t || !sheetRef.value || !mxTarget.value) return
  const snap = sheetRef.value.snapshot()
  const sheetId = snap.sheetOrder?.[0] || Object.keys(snap.sheets || {})[0]
  const sh = sheetId ? snap.sheets?.[sheetId] : null
  if (!sh) return
  sh.cellData[mxTarget.value.row] = sh.cellData[mxTarget.value.row] || {}
  sh.cellData[mxTarget.value.row][mxTarget.value.col] = cellObj
  sheetRef.value.load(snap)
  const bindings = { ...(t.mixedConfig?.bindings || {}) }
  if (binding) bindings[`${mxTarget.value.row},${mxTarget.value.col}`] = binding
  else delete bindings[`${mxTarget.value.row},${mxTarget.value.col}`]
  store.setMixedConfig(t.id, { bindings })
  await capture()
}

async function insertMxValue() {
  const ind = indStore.get(mxValPick.value)
  if (!ind) return Message.warning('请先选择一个指标')
  const date = mxResolveDate(mxDate, ind)
  const pv = date ? indValueAt(ind, date, indStore.LABELS) : null
  if (!pv) return Message.warning('该配置下取不到数据，请调整日期来源或变换')
  await writeMixedCell({ v: r4(pv.value), t: 2 }, { kind: 'value', pick: ind.title, date: { ...mxDate } })
  mxValOpen.value = false
  Message.success(`已插入 ${ind.title} @ ${date}`)
}
async function insertMxDate() {
  const ind = mxDate.src === 'indLatest' ? indStore.get(mxDateInd.value) : null
  if (mxDate.src === 'indLatest' && !ind) return Message.warning('请选择指标')
  const date = mxResolveDate(mxDate, ind)
  if (!date) return Message.warning('无法解析日期，请检查来源配置')
  await writeMixedCell({ v: date, t: 1 }, { kind: 'date', date: { ...mxDate, indTitle: ind?.title || '' } })
  mxDateOpen.value = false
  Message.success(`已插入日期 ${date}（动态更新）`)
}
async function insertMxCalc() {
  if (!mxCalcPicks.value.length) return Message.warning('请选择参与计算的指标')
  const pv = mxCalcPv.value
  if (pv.value == null) return Message.warning(pv.err || '计算结果无效')
  await writeMixedCell({ v: r4(pv.value), t: 2 }, {
    kind: 'calc', picks: [...mxCalcPicks.value], expr: mxCalcExpr.value, date: { ...mxDate },
  })
  mxCalcOpen.value = false
  Message.success(`已插入计算结果 ${r4(pv.value)}（跟随指标更新）`)
}
async function insertMxDiff() {
  const pv = mxDiffPv.value
  if (pv.value == null) return Message.warning(pv.err || '无法计算')
  const isNum = mxOp.kind === 'diffDays'
  await writeMixedCell({ v: isNum ? pv.value : pv.value, t: isNum ? 2 : 1 }, null)
  mxDiffOpen.value = false
  Message.success(`已插入计算结果：${pv.value}${isNum ? ' 天' : ''}`)
}

function computeBinding(b, sh) {
  if (!b || !b.kind) return null
  const cd = sh?.cellData
  const readCell = (refStr) => {
    const rc = refToRC(refStr)
    return rc ? cd?.[rc.row]?.[rc.col]?.v : null
  }
  const resolve = (dateCfg, ind) => {
    let base = ''
    if (dateCfg.src === 'system') base = todayStr()
    else if (dateCfg.src === 'cell') {
      const v = readCell(dateCfg.cellRef)
      base = parseDate(v) ? String(v).trim() : ''
    } else if (dateCfg.src === 'manual') {
      const d = parseDate(dateCfg.manual)
      base = d ? fmtDate(d) : ''
    } else if (ind) {
      const shift = dateCfg.back != null ? -Number(dateCfg.back || 0) : Number(dateCfg.periodShift || 0)
      base = shiftPeriods(ind.latestDate, shift, ind.freq)
    }
    if (!base) return ''
    const afterLegacy = transformDate(base, { days: dateCfg.days, weeks: dateCfg.weeks, months: dateCfg.months, anchor: dateCfg.anchor })
    return applyTransforms(afterLegacy, dateCfg.transforms)
  }
  if (b.kind === 'date') {
    const d = resolve(b.date, indStore.get(b.date.indTitle || ''))
    if (!d) return null
    return b.style ? { v: d, t: 1, s: { ...b.style } } : { v: d, t: 1 }
  }
  if (b.kind === 'value') {
    const ind = indStore.get(b.pick)
    if (!ind) return null
    const pv = indValueAt(ind, resolve(b.date, ind), indStore.LABELS)
    return pv ? { v: r4(pv.value), t: 2 } : null
  }
  if (b.kind === 'calc') {
    const vars = {}
    b.picks.forEach((t, i) => {
      const ind = indStore.get(t)
      if (!ind) return
      const pv = indValueAt(ind, resolve(b.date, ind), indStore.LABELS)
      if (pv) vars[String.fromCharCode(65 + i)] = pv.value
    })
    const r = evalExpr(b.expr, vars)
    return r == null ? null : { v: r4(r), t: 2 }
  }
  if (b.kind === 'cmp') {
    const ind = indStore.get(b.pick)
    const vs = ind?.values
    if (!Array.isArray(vs) || !vs.length) return null
    const cur = vs.at(-1)
    const prev = vs.length > 1 ? vs.at(-2) : null
    if (b.role === 'cur') return { v: r4(cur), t: 2, s: { ht: 2 } }
    if (b.role === 'prev') return { v: prev == null ? null : r4(prev), t: 2, s: { ht: 2 } }
    if (b.role === 'dod') {
      const d = (cur ?? 0) - (prev ?? 0)
      // 中国惯例：涨红跌绿（univer 快照格式：s.bg 背景 / s.cl 字色 / s.ht 2=居中）
      const s = { ht: 2 }
      if (d > 0) { s.bg = '#FDE7E7'; s.cl = '#D5304F' } else if (d < 0) { s.bg = '#E6F6E9'; s.cl = '#00913C' }
      return { v: r4(d), t: 2, s }
    }
    if (b.role === 'yoy') {
      const base = vs.length > 12 ? vs.at(-13) : vs[0]
      if (base == null || base === 0) return { v: '0%', t: 1, s: { ht: 2 } }
      const pct = Math.round((cur / base - 1) * 100)
      return { v: `${pct}%`, t: 1, s: { ht: 2 } }
    }
  }
  return null
}

async function refreshMixed() {
  const t = table.value
  const bindings = t?.mixedConfig?.bindings || {}
  const keys = Object.keys(bindings)
  if (!keys.length) return Message.warning('暂无动态单元格（插入指标值/日期/计算结果后可刷新）')
  if (!sheetRef.value) return
  const snap = sheetRef.value.snapshot()
  const sheetId = snap.sheetOrder?.[0] || Object.keys(snap.sheets || {})[0]
  const sh = sheetId ? snap.sheets?.[sheetId] : null
  if (!sh) return
  let n = 0
  keys.forEach((k) => {
    const [r, c] = k.split(',').map(Number)
    const cell = computeBinding(bindings[k], sh)
    if (cell != null) {
      sh.cellData[r] = sh.cellData[r] || {}
      sh.cellData[r][c] = cell
      n++
    }
  })
  sheetRef.value.load(snap)
  await capture()
  Message.success(`已刷新 ${n} 个动态单元格`)
}

/* —— 混合表交互：右键菜单 / 悬浮指标信息 / 关联虚线框 / 选格拾取 / 清除解除关联 —— */
const mxBindings = computed(() => table.value?.mixedConfig?.bindings || {})

// 本表已关联的指标（供指标计算弹窗快速选择）
const mxTableInds = computed(() => {
  const titles = []
  const push = (t) => { if (t && indStore.get(t) && !titles.includes(t)) titles.push(t) }
  Object.values(mxBindings.value).forEach((b) => {
    if (b?.kind === 'value' || b?.kind === 'cmp') push(b.pick)
    else if (b?.kind === 'calc') (b.picks || []).forEach(push)
  })
  return titles
})
function toggleCalcQuick(t) {
  const i = mxCalcPicks.value.indexOf(t)
  if (i >= 0) mxCalcPicks.value.splice(i, 1)
  else mxCalcPicks.value.push(t)
}

// 右键菜单
function onCellContext(g) {
  if (!isMixed.value) return
  mxCtxCell = { row: g.r, col: g.c }
  mxCtx.x = Math.min(g.clientX, window.innerWidth - 190)
  mxCtx.y = Math.min(g.clientY, window.innerHeight - 190)
  mxCtx.show = true
}
function ctxOpen(kind) {
  const cell = mxCtxCell
  mxCtx.show = false
  openMx(kind, cell)
}
function ctxClearBinding() {
  const cell = mxCtxCell
  mxCtx.show = false
  if (!cell) return
  const key = `${cell.row},${cell.col}`
  if (!mxBindings.value[key]) return Message.warning('该单元格没有关联关系')
  const bindings = { ...mxBindings.value }
  delete bindings[key]
  store.setMixedConfig(table.value.id, { bindings })
  capture()
  Message.success('已解除该单元格的关联（保留当前数值）')
}
function closeMxCtx() {
  if (mxCtx.show) mxCtx.show = false
}
document.addEventListener('mousedown', closeMxCtx, true)

// 悬浮提示：关联指标的单元格展示 指标名称 / 最新日期 / 指标ID
function onCellHover(g) {
  if (!isMixed.value || !g) {
    mxTip.show = false
    return
  }
  const b = mxBindings.value[`${g.r},${g.c}`]
  if (!b) {
    mxTip.show = false
    return
  }
  const lines = []
  const pushInd = (title) => {
    const ind = indStore.get(title)
    if (ind && !lines.some((l) => l.name === ind.title)) {
      lines.push({ name: ind.title, latest: ind.latestDate || '—', id: ind.id })
    }
  }
  if (b.kind === 'value' || b.kind === 'cmp') pushInd(b.pick)
  else if (b.kind === 'calc') (b.picks || []).forEach(pushInd)
  else if (b.kind === 'date' && b.date?.indTitle) pushInd(b.date.indTitle)
  if (!lines.length) {
    mxTip.show = false
    return
  }
  mxTip.lines = lines
  mxTip.x = Math.min(g.clientX + 14, window.innerWidth - 240)
  mxTip.y = Math.min(g.clientY + 14, window.innerHeight - 120)
  mxTip.show = true
}

// 虚线框：单击数据值单元格 ↔ 关联日期单元格，双向展示
function stageBox(g) {
  const rect = stageEl.value?.getBoundingClientRect()
  if (!rect) return null
  return { left: g.vx - rect.left, top: g.vy - rect.top, w: g.vw, h: g.vh }
}
function geomCell(row, col) {
  return sheetRef.value?.cellGeomByRC?.(row, col)
}
function onCellClick(g) {
  closeMxCtx()
  // 选格拾取模式：把点中的单元格回填到弹窗的引用输入框
  if (mxPick.active) {
    const refStr = rcToRef(g.r, g.c)
    if (mxPick.field === 'cellRef') mxDate.cellRef = refStr
    else if (mxPick.field === 'a') mxOp.a = refStr
    else if (mxPick.field === 'b') mxOp.b = refStr
    mxPick.active = false
    if (mxPick.modal === 'value') mxValOpen.value = true
    else if (mxPick.modal === 'date') mxDateOpen.value = true
    else if (mxPick.modal === 'diff') mxDiffOpen.value = true
    else if (mxPick.modal === 'calc') mxCalcOpen.value = true
    mxDash.boxes = []
    return
  }
  if (!isMixed.value) {
    mxDash.boxes = []
    return
  }
  const key = `${g.r},${g.c}`
  const b = mxBindings.value[key]
  const boxes = []
  const selfBox = stageBox(g)
  if (b?.date?.src === 'cell' && refToRC(b.date.cellRef)) {
    // 点击的是关联了表格日期的数据值单元格：本格 + 日期格都画虚线框
    boxes.push(selfBox)
    const rc = refToRC(b.date.cellRef)
    const gb = geomCell(rc.row, rc.col)
    if (gb) boxes.push(stageBox(gb))
  } else {
    // 点击的是被数据值单元格引用的日期单元格：本格 + 所有关联它的格子
    const linked = Object.entries(mxBindings.value).filter(([, bb]) => {
      if (!bb?.date || bb.date.src !== 'cell') return false
      const rc = refToRC(bb.date.cellRef)
      return rc && rc.row === g.r && rc.col === g.c
    })
    if (linked.length) {
      boxes.push(selfBox)
      linked.forEach(([k]) => {
        const [r, c] = k.split(',').map(Number)
        const gb = geomCell(r, c)
        if (gb) boxes.push(stageBox(gb))
      })
    }
  }
  mxDash.boxes = boxes.filter(Boolean)
}
function clearDash() {
  mxDash.boxes = []
}
window.addEventListener('resize', clearDash)

// 选格拾取入口（弹窗中"选格"按钮 → 暂时收起弹窗，点表格单元格后回填）
function startPick(modal, field) {
  mxPick.active = true
  mxPick.modal = modal
  mxPick.field = field
  mxValOpen.value = false
  mxDateOpen.value = false
  mxDiffOpen.value = false
  Message.info('请在表格中点选一个日期单元格')
}

// 清除单元格 → 解除关联（关联不因无值而解除，仅清除单元格才解除）
function reconcileMixed(snap) {
  const t = table.value
  if (!t) return
  const bindings = t.mixedConfig?.bindings || {}
  const sheetId = snap.sheetOrder?.[0] || Object.keys(snap.sheets || {})[0]
  const sh = sheetId ? snap.sheets?.[sheetId] : null
  if (!sh) return
  const dead = Object.keys(bindings).filter((k) => {
    if (bindings[k]?.kind === 'cmp') return false // 对比模板绑定允许暂无数据，不因空值解除
    const [r, c] = k.split(',').map(Number)
    const cell = sh.cellData?.[r]?.[c]
    return !cell || cell.v == null || cell.v === ''
  })
  if (dead.length) {
    const next = { ...bindings }
    dead.forEach((k) => delete next[k])
    store.setMixedConfig(t.id, { bindings: next })
  }
}
// Delete/Backspace 清除单元格后自动解除关联
function onMxKeydown(e) {
  if (!open.value || !isMixed.value) return
  if (e.key !== 'Delete' && e.key !== 'Backspace') return
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
  setTimeout(() => capture(), 400)
}
window.addEventListener('keydown', onMxKeydown)

// 打开表格时静默重算动态单元格（指标数据更新后自动同步）
function silentRefreshMixed() {
  const t = table.value
  const bindings = t?.mixedConfig?.bindings || {}
  if (!Object.keys(bindings).length || !sheetRef.value) return
  const snap = sheetRef.value.snapshot()
  const sheetId = snap.sheetOrder?.[0] || Object.keys(snap.sheets || {})[0]
  const sh = sheetId ? snap.sheets?.[sheetId] : null
  if (!sh) return
  let n = 0
  Object.keys(bindings).forEach((k) => {
    const [r, c] = k.split(',').map(Number)
    const cell = computeBinding(bindings[k], sh)
    if (cell != null) {
      sh.cellData[r] = sh.cellData[r] || {}
      sh.cellData[r][c] = cell
      n++
    }
  })
  if (n) {
    sheetRef.value.load(snap)
    capture()
  }
}

/* —— 混合表：指标对比模板（首行动态日期 + 当前值/上期值/日环比/同比，涨红跌绿） —— */
const mxTplOpen = ref(false)
function openMxTpl() {
  const cell = sheetRef.value?.activeCell?.()
  if (!cell) return Message.warning('请先在表格中点选一个单元格（将作为模板左上角）')
  mxTarget.value = cell
  mxCachedSnap.value = sheetRef.value.snapshot()
  Object.assign(mxDate, { src: 'system', back: 0, periodShift: 0, cellRef: '', manual: '', days: 0, weeks: 0, months: 0, anchor: 'none', transforms: [] })
  mxCalcPicks.value = []
  mxLib.value = 'base'
  mxKw.value = ''
  mxTplOpen.value = true
}

async function insertMxTpl() {
  const t = table.value
  if (!t || !sheetRef.value || !mxTarget.value) return
  const picks = [...mxCalcPicks.value]
  if (!picks.length) return Message.warning('请选择至少一个指标')
  const snap = sheetRef.value.snapshot()
  const sheetId = snap.sheetOrder?.[0] || Object.keys(snap.sheets || {})[0]
  const sh = sheetId ? snap.sheets?.[sheetId] : null
  if (!sh) return
  const { row: r0, col: c0 } = mxTarget.value
  const bindings = { ...(t.mixedConfig?.bindings || {}) }
  const put = (dr, dc, cell, binding) => {
    const r = r0 + dr
    const c = c0 + dc
    sh.cellData[r] = sh.cellData[r] || {}
    sh.cellData[r][c] = cell
    if (binding) bindings[`${r},${c}`] = binding
  }
  const hd = (v) => ({ v, t: 1, s: { bl: 1, bg: '#595959', cl: '#FFFFFF', ht: 2 } })
  const ctr = (v, tp) => ({ v, t: tp, s: { ht: 2 } })
  // 首行：动态日期 + 表头
  const bDate = { kind: 'date', date: { ...mxDate, indTitle: mxDate.src === 'indLatest' ? (indStore.get(picks[0])?.title || '') : '' }, style: { bl: 1, bg: '#595959', cl: '#FFFFFF', ht: 2 } }
  put(0, 0, computeBinding(bDate, sh) || hd(todayStr()), bDate)
  put(0, 1, hd('当前值'))
  put(0, 2, hd('上期值'))
  put(0, 3, hd('日环比'))
  put(0, 4, hd('同比'))
  // 指标行：直接按绑定算出初值（样式平铺在 cell 上）
  picks.forEach((title, i) => {
    put(i + 1, 0, ctr(title, 1))
    ;[['cur', 1], ['prev', 2], ['dod', 3], ['yoy', 4]].forEach(([role, dc]) => {
      const b = { kind: 'cmp', role, pick: title }
      put(i + 1, dc, computeBinding(b, sh) || { v: null, t: 2 }, b)
    })
  })
  sh.rowCount = Math.max(sh.rowCount || 40, r0 + picks.length + 7)
  sh.columnCount = Math.max(sh.columnCount || 12, c0 + 10)
  sheetRef.value.load(snap)
  store.setMixedConfig(t.id, { bindings })
  await capture()
  mxTplOpen.value = false
  Message.success(`已生成 ${picks.length} 个指标的对比模板（${1 + picks.length * 4} 个动态单元格）`)
}

/* —— 自定义分析表格：选区生成指标（日期序列+数值序列）→ 指标库 + 一键刷新（对齐 ETA） —— */
const isCus = computed(() => table.value?.type === 'custom')
const cusListOpen = ref(false)
const cusGenOpen = ref(false)
const cusKw = ref('')
const cusGen = reactive({ title: '', unit: '元/吨', freq: '月频', dir: '黑色建材', dateCol: 0, valCol: 1, hasHeader: true })
const cusSel = ref(null) // 框选区域 {startRow,startColumn,endRow,endColumn}
const cusCols = ref([]) // 选区各列预览 [{idx, letter, first, dateLike, ratio}]
const cusInds = computed(() => table.value?.customInd || [])
const cusIndRows = computed(() => cusInds.value.map((b) => {
  const c = indStore.get(b.indId)
  return { ...b, latest: c?.latest, latestDate: c?.latestDate, unit: c?.unit, missing: !c }
}))
const cusFiltered = computed(() => {
  const kw = cusKw.value.trim().toLowerCase()
  return cusIndRows.value.filter((x) => !kw || x.title.toLowerCase().includes(kw))
})
const cusDirs = computed(() => {
  const out = []
  const walk = (nodes, prefix) => (nodes || []).forEach((n) => {
    const p = prefix ? `${prefix}/${n.name}` : n.name
    out.push(p)
    walk(n.children, p)
  })
  walk(indStore.dirs, '')
  return out
})
const cusPointCount = computed(() => cusPoints.value.length)

function colLetter(c) {
  let s = ''
  c += 1
  while (c > 0) {
    const m = (c - 1) % 26
    s = String.fromCharCode(65 + m) + s
    c = Math.floor((c - 1) / 26)
  }
  return s
}
const DATE_RE = /^\d{4}[-/]\d{1,2}([-/]\d{1,2})?$/
// 日期样式值：文本日期 或 Excel 日期序列号（fortune 键入日期会转序列，20000~80000 ≈ 1954~2119 年）
const isDateVal = (v) => DATE_RE.test(String(v ?? '').trim()) || (typeof v === 'number' && Number.isFinite(v) && v >= 20000 && v <= 80000)
function cusSnapshot() {
  const snap = sheetRef.value?.snapshot?.()
  const sheetId = snap?.sheetOrder?.[0] || Object.keys(snap?.sheets || {})[0]
  return sheetId ? snap?.sheets?.[sheetId] : null
}
function fmtLocal(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function cusParsePoints(colDate, colVal, rowStart, rowEnd, sh) {
  const pts = []
  for (let r = rowStart; r <= rowEnd; r++) {
    const d = sh?.cellData?.[r]?.[colDate]?.v
    const v = sh?.cellData?.[r]?.[colVal]?.v
    const dd = parseDate(d)
    if (!dd || v == null || v === '' || Number.isNaN(Number(v))) continue
    pts.push({ date: fmtLocal(dd), value: r4(Number(v)) })
  }
  return pts
}
function openCusGen() {
  const sel = sheetRef.value?.getSelection?.()
  if (!sel) return Message.warning('请先在表格中框选区域（包含日期列与数值列）')
  const sh = cusSnapshot()
  if (!sh) return Message.error('未读取到工作表数据')
  const cols = []
  for (let c = sel.startColumn; c <= sel.endColumn; c++) {
    let first = null
    let dateCnt = 0
    let numCnt = 0
    let cnt = 0
    for (let r = sel.startRow; r <= sel.endRow; r++) {
      const v = sh.cellData?.[r]?.[c]?.v
      if (v == null || v === '') continue
      if (first == null) first = v
      if (isDateVal(v)) dateCnt++
      if (typeof v === 'number') numCnt++
      cnt++
    }
    cols.push({ idx: c, letter: colLetter(c), first, dateLike: dateCnt > 0, ratio: cnt ? numCnt / cnt : 0 })
  }
  if (!cols.length) return Message.warning('选区内没有数据')
  const dCol = cols.find((x) => x.dateLike)
  const vCol = cols.filter((x) => x !== dCol).sort((a, b) => b.ratio - a.ratio)[0] || cols[cols.length - 1]
  cusSel.value = sel
  cusCols.value = cols
  cusGen.dateCol = dCol?.idx ?? cols[0].idx
  cusGen.valCol = vCol?.idx ?? cols[cols.length - 1].idx
  cusGen.hasHeader = !!(dCol && !isDateVal(sh.cellData?.[sel.startRow]?.[cusGen.dateCol]?.v))
  const headCell = sh.cellData?.[sel.startRow]?.[cusGen.valCol]?.v
  cusGen.title = `${table.value?.title || '自定义指标'}${headCell != null && !isDateVal(headCell) && typeof headCell !== 'number' ? ':' + headCell : ''}`
  cusGenOpen.value = true
}
const cusPoints = computed(() => {
  const sel = cusSel.value
  if (!sel) return []
  return cusParsePoints(cusGen.dateCol, cusGen.valCol, cusGen.hasHeader ? sel.startRow + 1 : sel.startRow, sel.endRow, cusSnapshot())
})
async function saveCusGen() {
  const title = cusGen.title.trim()
  if (!title) return Message.warning('请填写指标名称')
  if (!cusPoints.value.length) return Message.warning('未解析出有效的（日期, 数值）数据行，请检查日期列/数值列与「首行为表头」设置')
  const res = indStore.addFromTable({ title, unit: cusGen.unit, freq: cusGen.freq, dir: cusGen.dir, points: cusPoints.value })
  if (!res) return Message.error('创建失败')
  if (res.dup) return Message.warning(`指标「${title}」已存在，请换个名称`)
  store.setCustomInd(table.value.id, [...cusInds.value, { indId: res.id, title, dateCol: cusGen.dateCol, valCol: cusGen.valCol, hasHeader: cusGen.hasHeader }])
  await capture()
  cusGenOpen.value = false
  Message.success(`已生成指标「${title}」（${cusPoints.value.length} 个数据点），保存至指标库 ${cusGen.dir}`)
}
async function refreshCusInds() {
  const list = cusInds.value
  if (!list.length) return Message.warning('尚未从该表格生成指标')
  const sh = cusSnapshot()
  if (!sh) return
  const rows = Object.keys(sh.cellData || {}).map(Number).sort((a, b) => a - b)
  let n = 0
  list.forEach((b) => {
    const start = b.hasHeader ? Math.max(1, rows[0] ?? 0) : (rows[0] ?? 0)
    const last = rows[rows.length - 1] ?? 0
    if (indStore.updateFromTable(b.indId, cusParsePoints(b.dateCol, b.valCol, start, last, sh))) n++
  })
  if (!n) return Message.warning('未解析到可刷新的数据（日期列/数值列可能已被改动）')
  await capture()
  Message.success(`已按表格最新数据刷新 ${n} 个指标`)
}
function gotoIndicators() {
  cusListOpen.value = false
  router.push('/indicators')
}

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
  if (mxCtx.show) { mxCtx.show = false; return }
  if (mxPick.active) { mxPick.active = false; Message.info('已取消选格'); return }
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
  document.removeEventListener('mousedown', closeMxCtx, true)
  window.removeEventListener('resize', clearDash)
  window.removeEventListener('keydown', onMxKeydown)
})

async function capture() {
  if (!sheetRef.value || !props.tableId) return { ok: false, msg: '表格未就绪' }
  const snap = sheetRef.value.snapshot()
  if (!snap) return { ok: false, msg: '未能读取当前表格内容' }
  if (isMixed.value) reconcileMixed(snap) // 清除单元格 → 解除关联
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
  clearDash()
  await nextTick()
  sheetRef.value?.load(t.workbook || { id: t.id, name: t.title, sheetOrder: [], sheets: {} })
  // 混合表：打开时按绑定配置静默重算动态单元格（跟随指标数据更新）
  if (t.type === 'mixed') setTimeout(() => silentRefreshMixed(), 350)
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
  if (exporting.value) return
  exporting.value = true
  try {
    await capture()
    const t = table.value
    if (!t) return Message.error('请先打开一张表格')
    await runWithExportLoading(async () => {
      const buf = await workbookToXlsx(t.workbook, t.title)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      a.download = `${t.title}.xlsx`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 800)
    })
    Message.success('已导出 Excel（.xlsx）')
  } catch (e) {
    Message.error(e?.message || '导出失败，请稍后重试')
  } finally {
    exporting.value = false
  }
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
          <div v-if="isTs" class="ts-ctrl">
            <button type="button" class="ts-btn" @click="tsPickOpen = true">
              <Icon name="plus-12" :size="12" /> 选择指标<span v-if="tsCfg.picks.length" class="ts-cnt">{{ tsCfg.picks.length }}</span>
            </button>
            <div class="ts-seg" title="时序布局切换">
              <button type="button" :class="{ on: tsCfg.layout === 'indCols' }" @click="setTsLayout('indCols')">指标为列</button>
              <button type="button" :class="{ on: tsCfg.layout === 'indRows' }" @click="setTsLayout('indRows')">日期为列</button>
            </div>
            <button type="button" class="ts-btn" @click="tsBatchOpen = true">批量设置</button>
            <button
              v-if="tsCfg.picks.length"
              type="button"
              class="ts-btn"
              title="按已选指标的最新数据重建当前工作表"
              @click="refreshTsData"
            >刷新指标数据<span class="ts-cnt">{{ tsCfg.picks.length }}</span></button>
          </div>
          <div v-if="isMixed" class="ts-ctrl">
            <div class="mx-drop" @mouseleave="mxMenuOpen = false">
              <button type="button" class="ts-btn" @click.stop="mxMenuOpen = !mxMenuOpen">
                <Icon name="plus-12" :size="12" /> 插入<span class="mx-caret">▾</span>
              </button>
              <div v-show="mxMenuOpen" class="mx-menu">
                <button type="button" @click="openMx('value')">根据日期选择指标值</button>
                <button type="button" @click="openMx('date')">导入日期</button>
                <button type="button" @click="openMx('diff')">日期计算</button>
                <button type="button" @click="openMx('calc')">指标计算</button>
                <button type="button" @click="mxMenuOpen = false; openMxTpl()">生成指标对比模板</button>
              </div>
            </div>
            <button type="button" class="ts-btn" title="按绑定配置重算所有动态单元格" @click="refreshMixed">
              刷新动态数据<span v-if="mxCount" class="ts-cnt">{{ mxCount }}</span>
            </button>
          </div>
          <div v-if="isCus" class="ts-ctrl">
            <button type="button" class="ts-btn" title="框选区域后，将日期序列+数值序列生成为指标库指标" @click="openCusGen">
              <Icon name="plus-12" :size="12" /> 生成指标
            </button>
            <div class="mx-drop" @mouseleave="cusListOpen = false">
              <button type="button" class="ts-btn" @click.stop="cusListOpen = !cusListOpen">
                已生成指标<span v-if="cusInds.length" class="ts-cnt">{{ cusInds.length }}</span><span class="mx-caret">▾</span>
              </button>
              <div v-show="cusListOpen" class="mx-menu" style="min-width:280px">
                <input v-model="cusKw" class="mx-ref" style="margin:4px 6px 8px; width:calc(100% - 12px)" placeholder="搜索指标名称">
                <div v-if="!cusFiltered.length" style="padding:14px 12px; font-size:12px; color:var(--text-3)">该表格尚未生成指标</div>
                <div v-for="b in cusFiltered" :key="b.indId" class="cus-ind-item" :title="b.title">
                  <span class="cus-ind-name">{{ b.title }}</span>
                  <span class="cus-ind-meta">{{ b.missing ? '指标已删除' : `${b.latest ?? '—'}${b.unit || ''} · ${b.latestDate || ''}` }}</span>
                  <button type="button" class="cus-ind-go" @click="gotoIndicators">查看</button>
                </div>
                <button v-if="cusFiltered.length" type="button" style="border-top:1px solid var(--border)" @click="gotoIndicators">前往指标中心 →</button>
              </div>
            </div>
            <button
              v-if="cusInds.length"
              type="button"
              class="ts-btn"
              title="将表格最新数据更新至所有由本表格生成的指标"
              @click="refreshCusInds"
            >刷新指标<span class="ts-cnt">{{ cusInds.length }}</span></button>
          </div>
          <button type="button" class="btn" @click="onSave">保存<span class="save-dot" :class="{ show: savedFlash }">有更新</span></button>
          <button type="button" class="btn" :disabled="exporting" @click="onExport">{{ exporting ? '导出中…' : '导出' }}</button>
        </div>
      </div>
      <div ref="stageEl" class="editor-stage">
        <FortuneSheet
          v-if="open"
          :key="`${tableId}-fold`"
          ref="sheetRef"
          :suppress-cell-menu="isMixed"
          @cellhover="onCellHover"
          @cellclick="onCellClick"
          @cellcontext="onCellContext"
          @pivot="openPivotWizard"
        />
        <!-- 关联虚线框（pointer-events 穿透，仅视觉提示） -->
        <div
          v-for="(b, i) in mxDash.boxes"
          :key="`dash-${i}`"
          class="mx-dash"
          :style="{ left: `${b.left}px`, top: `${b.top}px`, width: `${b.w}px`, height: `${b.h}px` }"
        />
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

    <!-- 混合表：单元格右键菜单 -->
    <div
      v-if="mxCtx.show"
      class="mx-ctx"
      :style="{ left: `${mxCtx.x}px`, top: `${mxCtx.y}px` }"
      @mousedown.stop
      @contextmenu.prevent
    >
      <button type="button" @click="ctxOpen('value')">根据日期选择指标值</button>
      <button type="button" @click="ctxOpen('date')">导入日期</button>
      <button type="button" @click="ctxOpen('diff')">日期计算</button>
      <button type="button" @click="ctxOpen('calc')">指标计算</button>
      <button type="button" class="mx-ctx-clear" @click="ctxClearBinding">清除该格关联</button>
    </div>

    <!-- 混合表：悬浮指标信息（指标名称 / 最新日期 / 指标ID） -->
    <div
      v-if="mxTip.show"
      class="mx-hover-tip"
      :style="{ left: `${mxTip.x}px`, top: `${mxTip.y}px` }"
    >
      <div v-for="(l, i) in mxTip.lines" :key="i" class="mx-hover-line">
        <div class="mx-hover-name">{{ l.name }}</div>
        <div class="mx-hover-meta">最新日期 {{ l.latest }} · 指标ID {{ l.id }}</div>
      </div>
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

  <AppModal :visible="tsPickOpen" title="选择指标" icon="search" :width="560" :z-index="330" @update:visible="(v) => { tsPickOpen = v }">
    <div class="ts-pick-search">
      <Icon name="search" :size="13" />
      <input v-model="tsKw" placeholder="搜索指标名称" autocomplete="off">
      <span class="ts-pick-count">已选 <b>{{ tsCfg.picks.length }}</b> 个</span>
    </div>
    <div class="ts-pick-list">
      <div v-if="!groupedTs.length" class="ts-pick-empty">未找到匹配的指标</div>
      <div v-for="g in groupedTs" :key="g.g" class="ts-pick-group">
        <div class="ts-pick-gname">{{ g.g }}</div>
        <button
          v-for="c in g.items"
          :key="c.id"
          type="button"
          class="ts-pick-item"
          :class="{ on: tsCfg.picks.includes(c.title) }"
          @click="toggleTsPick(c.title)"
        >
          <span class="ts-pick-name" :title="c.title">{{ c.title }}</span>
          <span class="ts-pick-meta">{{ c.freq }}{{ c.unit ? ' · ' + c.unit : '' }}</span>
          <span class="ts-pick-tick">✓</span>
        </button>
      </div>
    </div>
    <template #footer>
      <button type="button" class="btn" style="min-width:88px" @click="tsPickOpen = false">取消</button>
      <button type="button" class="btn primary" style="min-width:110px" @click="confirmTsPick">应用到表格</button>
    </template>
  </AppModal>

  <AppModal :visible="tsBatchOpen" title="批量设置" icon="edit-fill" :width="420" :z-index="330" @update:visible="(v) => { tsBatchOpen = v }">
    <div class="fm-field">
      <label>小数位数（应用到 {{ tsCfg.picks.length }} 个已选指标）</label>
      <div class="ts-dec-row">
        <button
          v-for="d in [0, 1, 2, 3, 4]"
          :key="d"
          type="button"
          class="ts-dec-btn"
          :class="{ on: tsCfg.decimals === d }"
          @click="tsCfg.decimals = d"
        >{{ d }}</button>
      </div>
    </div>
    <div class="fm-field">
      <label class="ts-chk"><input type="checkbox" v-model="tsCfg.withUnit"> 表头附带单位（如「螺纹钢:现货价:上海(元/吨)」）</label>
    </div>
    <div class="ts-batch-tip">确定后将按当前布局（{{ tsCfg.layout === 'indRows' ? '日期为列' : '指标为列' }}）重建当前工作表内容。</div>
    <template #footer>
      <button type="button" class="btn" style="min-width:88px" @click="tsBatchOpen = false">取消</button>
      <button type="button" class="btn primary" style="min-width:88px" @click="confirmTsBatch">确定</button>
    </template>
  </AppModal>

  <!-- 混合表：根据日期选择指标值 -->
  <AppModal :visible="mxValOpen" title="根据日期选择指标值" icon="search" :width="560" :z-index="330" @update:visible="(v) => { mxValOpen = v }">
    <div class="fm-field">
      <div class="mx-libtabs">
        <button type="button" :class="{ on: mxLib === 'base' }" @click="mxLib = 'base'">指标库</button>
        <button type="button" :class="{ on: mxLib === 'pred' }" @click="mxLib = 'pred'">预测指标库</button>
        <div class="ts-pick-search" style="flex:1;margin-bottom:0">
          <Icon name="search" :size="13" />
          <input v-model="mxKw" placeholder="搜索指标名称" autocomplete="off">
        </div>
      </div>
    </div>
    <div class="ts-pick-list" style="max-height:26vh">
      <div v-if="!mxFiltered.length" class="ts-pick-empty">未找到匹配的指标</div>
      <button
        v-for="c in mxFiltered"
        :key="c.id"
        type="button"
        class="ts-pick-item"
        :class="{ on: mxValPick === c.title }"
        @click="mxValPick = c.title"
      >
        <span class="ts-pick-name" :title="c.title">{{ c.title }}</span>
        <span class="ts-pick-meta">{{ c.freq }}{{ c.unit ? ' · ' + c.unit : '' }} · 最新 {{ c.latestDate }}</span>
        <span class="ts-pick-tick">✓</span>
      </button>
    </div>
    <div class="fm-field">
      <label>日期来源与变换</label>
      <MxDatePanel :cfg="mxDate" @pick="startPick('value', 'cellRef')" />
    </div>
    <div class="mx-preview">
      <template v-if="mxValPv?.err"><span class="mx-pv-err">{{ mxValPv.err }}</span></template>
      <template v-else>
        <span class="mx-pv-k">日期</span><b>{{ mxValPv?.date }}</b>
        <span class="mx-pv-k">值</span><b>{{ mxValPv?.value }}{{ mxValPv?.unit ? ' ' + mxValPv.unit : '' }}</b>
        <span class="mx-pv-note">所在期 {{ mxValPv?.label }}</span>
      </template>
    </div>
    <template #footer>
      <button type="button" class="btn" style="min-width:88px" @click="mxValOpen = false">取消</button>
      <button type="button" class="btn primary" style="min-width:88px" @click="insertMxValue">插入单元格</button>
    </template>
  </AppModal>

  <!-- 混合表：导入日期 -->
  <AppModal :visible="mxDateOpen" title="导入日期" icon="edit-fill" :width="520" :z-index="330" @update:visible="(v) => { mxDateOpen = v }">
    <div class="fm-field">
      <label>日期来源</label>
      <div v-if="mxDate.src === 'indLatest'" class="mx-row" style="margin-bottom:6px">
        <select v-model="mxDateInd" class="mx-select" style="flex:1">
          <option value="">选择指标…</option>
          <option v-for="c in indStore.cards" :key="c.id" :value="c.title">{{ c.title }}（{{ c.latestDate }}）</option>
        </select>
      </div>
      <MxDatePanel :cfg="mxDate" @pick="startPick('date', 'cellRef')" />
    </div>
    <div class="mx-preview">
      <template v-if="mxDatePv?.err"><span class="mx-pv-err">{{ mxDatePv.err }}</span></template>
      <template v-else>
        <span class="mx-pv-k">将插入</span><b>{{ mxDatePv?.date }}</b>
        <span class="mx-pv-note">源数据更新后可通过「刷新动态数据」同步</span>
      </template>
    </div>
    <template #footer>
      <button type="button" class="btn" style="min-width:88px" @click="mxDateOpen = false">取消</button>
      <button type="button" class="btn primary" style="min-width:110px" @click="insertMxDate">插入日期</button>
    </template>
  </AppModal>

  <!-- 混合表：日期计算 -->
  <AppModal :visible="mxDiffOpen" title="日期计算" icon="edit-fill" :width="480" :z-index="330" @update:visible="(v) => { mxDiffOpen = v }">
    <div class="fm-field">
      <label>参与计算的日期单元格</label>
      <div class="mx-row">
        <input v-model="mxOp.a" class="mx-ref" placeholder="如 B2">
        <button type="button" class="mx-pick-btn" title="点击后在表格中点选日期单元格" @click="startPick('diff', 'a')">选格</button>
        <span class="mx-unit">{{ mxOp.kind === 'diffDays' ? '与' : '和' }}</span>
        <input v-model="mxOp.b" class="mx-ref" placeholder="如 D2">
        <button type="button" class="mx-pick-btn" title="点击后在表格中点选日期单元格" @click="startPick('diff', 'b')">选格</button>
      </div>
    </div>
    <div class="fm-field">
      <label>计算方式</label>
      <div class="mx-row">
        <select v-model="mxOp.kind" class="mx-select" style="flex:1">
          <option value="diffDays">相差天数</option>
          <option value="earlier">较早的日期</option>
          <option value="later">较晚的日期</option>
        </select>
      </div>
    </div>
    <div class="mx-preview">
      <template v-if="mxDiffPv?.err"><span class="mx-pv-err">{{ mxDiffPv.err }}</span></template>
      <template v-else>
        <span class="mx-pv-k">结果</span><b>{{ mxDiffPv?.value }}</b>
        <span v-if="mxDiffPv?.note" class="mx-pv-note">{{ mxDiffPv.note }}</span>
      </template>
    </div>
    <template #footer>
      <button type="button" class="btn" style="min-width:88px" @click="mxDiffOpen = false">取消</button>
      <button type="button" class="btn primary" style="min-width:110px" @click="insertMxDiff">插入结果</button>
    </template>
  </AppModal>

  <!-- 混合表：指标计算 -->
  <AppModal :visible="mxCalcOpen" title="指标计算" icon="search" :width="560" :z-index="330" @update:visible="(v) => { mxCalcOpen = v }">
    <div class="fm-field">
      <div class="mx-libtabs">
        <button type="button" :class="{ on: mxLib === 'base' }" @click="mxLib = 'base'">指标库</button>
        <button type="button" :class="{ on: mxLib === 'pred' }" @click="mxLib = 'pred'">预测指标库</button>
        <div class="ts-pick-search" style="flex:1;margin-bottom:0">
          <Icon name="search" :size="13" />
          <input v-model="mxKw" placeholder="搜索指标名称" autocomplete="off">
        </div>
      </div>
    </div>
    <div class="ts-pick-list" style="max-height:22vh">
      <div v-if="!mxFiltered.length" class="ts-pick-empty">未找到匹配的指标</div>
      <button
        v-for="c in mxFiltered"
        :key="c.id"
        type="button"
        class="ts-pick-item"
        :class="{ on: mxCalcPicks.includes(c.title) }"
        @click="mxCalcPicks.includes(c.title) ? mxCalcPicks.splice(mxCalcPicks.indexOf(c.title), 1) : mxCalcPicks.push(c.title)"
      >
        <span class="ts-pick-meta" style="min-width:16px">{{ mxCalcPicks.includes(c.title) ? String.fromCharCode(65 + mxCalcPicks.indexOf(c.title)) : '' }}</span>
        <span class="ts-pick-name" :title="c.title">{{ c.title }}</span>
        <span class="ts-pick-meta">{{ c.freq }} · 最新 {{ c.latestDate }}</span>
        <span class="ts-pick-tick">✓</span>
      </button>
    </div>
    <div v-if="mxTableInds.length" class="fm-field">
      <label>本表关联指标（快速选择）</label>
      <div class="mx-quick">
        <button
          v-for="t in mxTableInds"
          :key="t"
          type="button"
          :class="{ on: mxCalcPicks.includes(t) }"
          :title="t"
          @click="toggleCalcQuick(t)"
        >{{ t }}</button>
      </div>
    </div>
    <div class="fm-field">
      <label>计算表达式（用 A、B… 引用上面选中的指标）</label>
      <input v-model="mxCalcExpr" class="mx-ref" style="width:100%" placeholder="如 A/B*100 或 (A-B)/A">
    </div>
    <div class="fm-field">
      <label>取数日期（每个指标按各自频率解析）</label>
      <MxDatePanel :cfg="mxDate" @pick="startPick('calc', 'cellRef')" />
    </div>
    <div class="mx-preview">
      <template v-if="mxCalcPv?.err"><span class="mx-pv-err">{{ mxCalcPv.err }}</span></template>
      <template v-else>
        <span class="mx-pv-k">结果</span><b>{{ mxCalcPv?.value }}</b>
        <span class="mx-pv-note">取数日期 {{ mxCalcPv?.date }} · 跟随指标数据更新</span>
      </template>
    </div>
    <template #footer>
      <button type="button" class="btn" style="min-width:88px" @click="mxCalcOpen = false">取消</button>
      <button type="button" class="btn primary" style="min-width:110px" @click="insertMxCalc">插入结果</button>
    </template>
  </AppModal>

  <!-- 混合表：生成指标对比模板 -->
  <AppModal :visible="mxTplOpen" title="生成指标对比模板" icon="search" :width="560" :z-index="330" @update:visible="(v) => { mxTplOpen = v }">
    <div class="mx-hint" style="margin-bottom:10px">在选中单元格处生成：首行为动态日期 + 表头，每行一个指标（当前值 / 上期值 / 日环比 / 同比），日环比涨红跌绿，数据可一键刷新。</div>
    <div class="fm-field">
      <div class="mx-libtabs">
        <button type="button" :class="{ on: mxLib === 'base' }" @click="mxLib = 'base'">指标库</button>
        <button type="button" :class="{ on: mxLib === 'pred' }" @click="mxLib = 'pred'">预测指标库</button>
        <div class="ts-pick-search" style="flex:1;margin-bottom:0">
          <Icon name="search" :size="13" />
          <input v-model="mxKw" placeholder="搜索指标名称" autocomplete="off">
          <span class="ts-pick-count">已选 <b>{{ mxCalcPicks.length }}</b> 个</span>
        </div>
      </div>
    </div>
    <div class="ts-pick-list" style="max-height:26vh">
      <div v-if="!mxFiltered.length" class="ts-pick-empty">未找到匹配的指标</div>
      <button
        v-for="c in mxFiltered"
        :key="c.id"
        type="button"
        class="ts-pick-item"
        :class="{ on: mxCalcPicks.includes(c.title) }"
        @click="mxCalcPicks.includes(c.title) ? mxCalcPicks.splice(mxCalcPicks.indexOf(c.title), 1) : mxCalcPicks.push(c.title)"
      >
        <span class="ts-pick-name" :title="c.title">{{ c.title }}</span>
        <span class="ts-pick-meta">{{ c.freq }} · 最新 {{ c.latestDate }}</span>
        <span class="ts-pick-tick">✓</span>
      </button>
    </div>
    <div class="fm-field">
      <label>首行日期来源</label>
      <div class="mx-row">
        <select v-model="mxDate.src" class="mx-select">
          <option value="system">系统日期</option>
          <option value="indLatest">指标最新日期</option>
        </select>
        <input v-if="mxDate.src === 'indLatest'" v-model.number="mxDate.back" type="number" min="0" class="mx-num" title="期数前移：0=最新日期，1=上一期">
        <span v-if="mxDate.src === 'indLatest'" class="mx-unit">期数前移</span>
      </div>
    </div>
    <template #footer>
      <button type="button" class="btn" style="min-width:88px" @click="mxTplOpen = false">取消</button>
      <button type="button" class="btn primary" style="min-width:110px" @click="insertMxTpl">生成模板</button>
    </template>
  </AppModal>

  <!-- 自定义分析：选区生成指标 -->
  <AppModal :visible="cusGenOpen" title="生成指标" icon="search" :width="560" :z-index="330" @update:visible="(v) => { cusGenOpen = v }">
    <div class="mx-hint" style="margin-bottom:10px">
      将表格选区解析为「日期序列 + 数值序列」并保存为指标库指标；生成后表格数据更新时，可用「刷新指标」一键同步。
    </div>
    <div class="fm-field">
      <label>数据选区</label>
      <div class="mx-preview" style="margin-top:0">
        <span class="mx-pv-k">已框选</span>
        <b>{{ cusSel ? `${colLetter(cusSel.startColumn)}${cusSel.startRow + 1}:${colLetter(cusSel.endColumn)}${cusSel.endRow + 1}` : '—' }}</b>
        <span class="mx-pv-k">解析出</span>
        <b>{{ cusPointCount }}</b>
        <span class="mx-pv-k">行有效数据</span>
        <span v-if="!cusPointCount && cusSel" class="mx-pv-err">未解析到数据，请检查列设置</span>
      </div>
    </div>
    <div class="fm-field">
      <label>指标名称</label>
      <input v-model="cusGen.title" class="mx-ref" placeholder="如：螺纹利润测算表:现货价格" style="max-width:100%">
    </div>
    <div class="fm-field">
      <label>序列设置</label>
      <div class="mx-row">
        <span class="mx-unit">日期列</span>
        <select v-model.number="cusGen.dateCol" class="mx-select">
          <option v-for="c in cusCols" :key="c.idx" :value="c.idx">列 {{ c.letter }}（{{ c.first ?? '空' }}）</option>
        </select>
        <span class="mx-unit">数值列</span>
        <select v-model.number="cusGen.valCol" class="mx-select">
          <option v-for="c in cusCols" :key="c.idx" :value="c.idx">列 {{ c.letter }}（{{ c.first ?? '空' }}）</option>
        </select>
        <label class="ts-chk"><input v-model="cusGen.hasHeader" type="checkbox"> 首行为表头</label>
      </div>
    </div>
    <div class="fm-field">
      <label>指标属性</label>
      <div class="mx-row">
        <input v-model="cusGen.unit" class="mx-num" style="width:90px" placeholder="单位">
        <select v-model="cusGen.freq" class="mx-select">
          <option>月频</option>
          <option>周频</option>
          <option>日频</option>
        </select>
        <select v-model="cusGen.dir" class="mx-select" style="max-width:200px">
          <option v-for="d in cusDirs" :key="d" :value="d">{{ d }}</option>
        </select>
      </div>
    </div>
    <div v-if="cusPoints.length" class="mx-preview">
      <span class="mx-pv-k">预览</span>
      <template v-for="(p, i) in cusPoints.slice(0, 3)" :key="i">
        <span>{{ p.date }}</span><b>{{ p.value }}</b>
      </template>
      <span v-if="cusPoints.length > 3" class="mx-pv-note">… 共 {{ cusPoints.length }} 行</span>
    </div>
    <template #footer>
      <button type="button" class="btn" style="min-width:88px" @click="cusGenOpen = false">取消</button>
      <button type="button" class="btn primary" style="min-width:110px" @click="saveCusGen">保存至指标库</button>
    </template>
  </AppModal>
</template>

<style scoped>
/* —— 混合表：右键菜单 —— */
.mx-ctx {
  position: fixed;
  z-index: 5000;
  min-width: 178px;
  background: var(--bg-2, #fff);
  border: 1px solid var(--border, #e0e3e8);
  border-radius: 10px;
  box-shadow: 0 10px 32px rgba(0, 0, 0, .13);
  padding: 4px;
}
.mx-ctx button {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  font-size: 12.5px;
  color: var(--text-1, #1d2129);
  padding: 7px 12px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}
.mx-ctx button:hover { background: var(--fill-2, #f2f3f5); }
.mx-ctx-clear { color: #d5304f !important; border-top: 1px solid var(--border, #f0f1f3); border-radius: 0 0 6px 6px !important; margin-top: 2px; }

/* —— 混合表：悬浮指标信息 —— */
.mx-hover-tip {
  position: fixed;
  z-index: 5000;
  max-width: 240px;
  background: rgba(29, 33, 41, .92);
  color: #fff;
  border-radius: 8px;
  padding: 8px 10px;
  pointer-events: none;
  font-size: 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, .18);
}
.mx-hover-line + .mx-hover-line { margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, .14); }
.mx-hover-name { font-weight: 600; line-height: 1.4; }
.mx-hover-meta { opacity: .78; font-size: 11px; margin-top: 2px; }

/* —— 混合表：关联虚线框 —— */
.mx-dash {
  position: absolute;
  z-index: 30;
  border: 1.5px dashed #165dff;
  border-radius: 2px;
  pointer-events: none;
  box-shadow: 0 0 0 1px rgba(22, 93, 255, .15);
}

/* —— 混合表：指标计算快捷选择 —— */
.mx-quick { display: flex; flex-wrap: wrap; gap: 6px; }
.mx-quick button {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid var(--border, #d0d3d9);
  background: var(--bg-2, #fff);
  color: var(--text-2, #4e5969);
  font-size: 11.5px;
  border-radius: 999px;
  padding: 3px 10px;
  cursor: pointer;
}
.mx-quick button.on {
  color: #165dff;
  border-color: #165dff;
  background: rgba(22, 93, 255, .06);
}

/* —— 混合表：弹窗中的选格按钮 —— */
.mx-pick-btn {
  border: 1px solid var(--border, #d0d3d9);
  background: var(--bg-2, #fff);
  color: var(--text-2, #4e5969);
  font-size: 11px;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  flex: none;
}
.mx-pick-btn:hover { color: #165dff; border-color: #165dff; }
</style>
