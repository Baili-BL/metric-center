import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { hashStr, ME, nowStr, todayStr, uid } from '../utils/hash'
import { dirAddUnder, dirMoveDrop, dirRemove, dirRename, matchText, pathStarts, remountPath } from '../utils/dir'
import { previewRows } from '../utils/workbook'

export const TABLE_TYPES = [
  { id: 'shared', name: '共享表格' },
  { id: 'custom', name: '自定义分析' },
  { id: 'timeseries', name: '时间序列表格' },
  { id: 'mixed', name: '混合表格' },
  { id: 'balance', name: '平衡表' },
]
export const TYPE_MAP = Object.fromEntries(TABLE_TYPES.map((t) => [t.id, t]))
export const typeName = (id) => TYPE_MAP[id]?.name || id

const LS = 'ailab.table.v1'
const DEFAULT_DIRS = [
  { name: '期权', children: [{ name: '股指期权' }, { name: '商品期权' }] },
  { name: 'PVC', children: [{ name: '现货' }, { name: '基差' }, { name: '库存' }] },
  { name: '烧碱', children: [{ name: '现货' }, { name: '开工率' }] },
  { name: 'PE', children: [{ name: '线性' }, { name: '高压' }, { name: '低压' }] },
  { name: 'PP', children: [{ name: '拉丝' }, { name: '共聚' }, { name: '基差' }] },
  { name: '丙烯', children: [{ name: '现货' }, { name: '价差' }] },
  { name: '钢材', children: [{ name: '螺纹' }, { name: '热卷' }, { name: '中厚板' }] },
  { name: '沪铜', children: [{ name: '主力' }, { name: '基差' }, { name: '库存' }] },
  { name: '沪锌', children: [{ name: '主力' }, { name: '基差' }] },
  { name: '双焦', children: [{ name: '焦炭' }, { name: '焦煤' }] },
  { name: '铝链', children: [{ name: '电解铝' }, { name: '氧化铝' }, { name: '预焙阳极' }] },
]
const SEED = {
  shared: [
    { title: '螺纹钢现货共享表', dir: '钢材/螺纹' },
    { title: 'PVC现货报价共享表', dir: 'PVC/现货' },
    { title: '沪铜主力共享行情', dir: '沪铜/主力' },
  ],
  custom: [
    { title: '螺纹利润测算表', dir: '钢材' },
    { title: 'PE价差分析表', dir: 'PE/线性' },
    { title: '期权波动率分析', dir: '期权/商品期权' },
  ],
  timeseries: [
    { title: 'PVC月度价格序列', dir: 'PVC' },
    { title: '烧碱开工率时序', dir: '烧碱/开工率' },
    { title: '沪锌基差时序表', dir: '沪锌/基差' },
  ],
  mixed: [
    { title: '钢材量价混合监测', dir: '钢材' },
    { title: '双焦量价混合表', dir: '双焦' },
    { title: '铝链量价跟踪', dir: '铝链/电解铝' },
  ],
  balance: [
    { title: '电解铝供需平衡表', dir: '铝链/电解铝' },
    { title: 'PP供需平衡表', dir: 'PP' },
    { title: 'PVC库存平衡表', dir: 'PVC/库存' },
  ],
}

function clone(o) {
  return JSON.parse(JSON.stringify(o))
}
export function sampleHeaders(typeId) {
  if (typeId === 'timeseries') return ['月份', '价格', '指数', '状态']
  if (typeId === 'balance') return ['项目', '本期', '上期', '去年同期']
  if (typeId === 'mixed') return ['日期', '价格', '成交量', '开工率']
  if (typeId === 'custom') return ['口径', '数值', '成本', '利润']
  return ['日期', '地区', '价格', '维护人']
}
export function sampleRows(typeId, seed) {
  const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']
  if (typeId === 'timeseries') {
    return months.map((m) => {
      seed = (seed * 9301 + 49297) % 233280
      return [m, Math.round(3100 + seed / 233280 * 180), Math.round(80 + seed / 233280 * 20), '已更新']
    })
  }
  if (typeId === 'balance') {
    return ['产量', '进口', '出口', '表观消费', '库存变化'].map((k, i) => {
      const v = 120 + ((seed + i * 17) % 80)
      return [k, v, v + 8, v - 3]
    })
  }
  if (typeId === 'mixed') {
    return months.slice(0, 4).map((m, i) => [m, 3200 + i * 40, 18 + i, +(0.32 + i * 0.02).toFixed(2)])
  }
  if (typeId === 'custom') return [['现货', 3180, 3050, 130], ['盘面', 3220, 3080, 140], ['基差', -40, -30, -10]]
  return months.slice(0, 5).map((m, i) => [m, '华东', 3150 + i * 25, ME])
}
export function makeWorkbook(title, headers, rows) {
  const cellData = { 0: {} }
  headers.forEach((h, c) => {
    cellData[0][c] = { v: h, t: 1, s: { bl: 1, bg: { rgb: '#E8F3FF' } } }
  })
  ;(rows || []).forEach((row, r) => {
    cellData[r + 1] = {}
    row.forEach((v, c) => {
      const n = typeof v === 'number'
      cellData[r + 1][c] = n ? { v, t: 2 } : { v: String(v), t: 1 }
    })
  })
  const sheetId = 'sheet-01'
  return {
    id: `wb-${hashStr(title + Math.random())}`,
    name: title,
    sheetOrder: [sheetId],
    sheets: {
      [sheetId]: {
        id: sheetId,
        name: '数据',
        cellData,
        rowCount: Math.max(40, (rows || []).length + 12),
        columnCount: Math.max(12, headers.length + 4),
      },
    },
  }
}
export function blankWorkbook(title) {
  return makeWorkbook(title || '未命名表格', ['字段A', '字段B', '字段C', '字段D'], [])
}
function makeTable(cfg) {
  return {
    id: cfg.id || uid('T'),
    title: cfg.title,
    type: cfg.type,
    dir: cfg.dir || '',
    mine: cfg.mine !== false,
    inMine: cfg.inMine != null ? !!cfg.inMine : cfg.mine !== false,
    date: cfg.date || todayStr(),
    updated: cfg.updated || todayStr(),
    creator: cfg.creator || ME,
    updater: cfg.updater || ME,
    workbook: cfg.workbook || makeWorkbook(cfg.title, sampleHeaders(cfg.type), sampleRows(cfg.type, hashStr(cfg.title))),
  }
}
function defaultSeed() {
  const out = {}
  TABLE_TYPES.forEach((tp) => {
    out[tp.id] = {
      dirs: clone(DEFAULT_DIRS),
      tables: (SEED[tp.id] || []).map((s) => makeTable({ title: s.title, dir: s.dir, type: tp.id, mine: true })),
    }
  })
  return out
}
function loadSaved() {
  const store = defaultSeed()
  try {
    const saved = JSON.parse(localStorage.getItem(LS) || 'null')
    if (saved && typeof saved === 'object') {
      TABLE_TYPES.forEach((tp) => {
        if (saved[tp.id]?.dirs?.length) store[tp.id].dirs = saved[tp.id].dirs
        if (saved[tp.id]?.tables?.length) store[tp.id].tables = saved[tp.id].tables
      })
    }
  } catch { /* */ }
  return store
}

export const useTableStore = defineStore('tables', () => {
  const pack = ref(loadSaved())
  const currentType = ref('shared')
  const currentDir = ref('')
  const currentItem = ref('')
  const viewMode = ref('card')
  const filters = ref({ kw: '', nameKw: '', exact: false, onlyMine: false, dateFrom: '', dateTo: '' })

  function slimPack(data) {
    const out = JSON.parse(JSON.stringify(data))
    TABLE_TYPES.forEach((tp) => {
      (out[tp.id]?.tables || []).forEach((t) => {
        if (t.workbook) delete t.workbook.resources
      })
    })
    return out
  }
  function persist() {
    try {
      localStorage.setItem(LS, JSON.stringify(pack.value))
      return true
    } catch {
      try {
        localStorage.setItem(LS, JSON.stringify(slimPack(pack.value)))
        return true
      } catch { return false }
    }
  }
  const dirs = computed(() => pack.value[currentType.value]?.dirs || [])
  const tables = computed(() => pack.value[currentType.value]?.tables || [])

  function setType(id) {
    if (!TYPE_MAP[id] || id === currentType.value) return
    currentType.value = id
    currentDir.value = ''
    currentItem.value = ''
  }

  function tableFav(t) {
    return t && (t.inMine != null ? !!t.inMine : !!t.mine)
  }
  function visible(t) {
    const f = filters.value
    if (f.onlyMine && !t.mine) return false
    if (f.dateFrom && (t.date || '') < f.dateFrom) return false
    if (f.dateTo && (t.date || '') > f.dateTo) return false
    if (f.kw && !matchText(t.title, f.kw, f.exact) && !matchText(t.id, f.kw, f.exact)) return false
    if (f.nameKw && !matchText(t.title, f.nameKw, false)) return false
    return true
  }
  const filtered = computed(() => tables.value.filter((t) => {
    if (!visible(t)) return false
    if (currentItem.value) return t.id === currentItem.value
    if (!currentDir.value) return true
    return pathStarts(t.dir || '', currentDir.value)
  }))

  function dirCount(path) {
    const list = tables.value.filter(visible)
    if (!path) return list.length
    return list.filter((t) => pathStarts(t.dir || '', path)).length
  }
  function itemsInDir(path) {
    return tables.value.filter((t) => visible(t) && (t.dir || '') === path)
  }
  function findById(id) {
    if (!id) return null
    for (const tp of TABLE_TYPES) {
      const t = (pack.value[tp.id]?.tables || []).find((x) => x.id === id)
      if (t) return { table: t, type: tp.id }
    }
    return null
  }
  function get(id) {
    return tables.value.find((t) => t.id === id) || findById(id)?.table
  }
  function addDir(parent, name) {
    const r = dirAddUnder(pack.value[currentType.value].dirs, parent, name)
    if (r.ok) {
      currentDir.value = r.path
      persist()
    }
    return r
  }
  function renameDir(path, name) {
    const r = dirRename(pack.value[currentType.value].dirs, path, name)
    if (r.ok) {
      pack.value[currentType.value].tables.forEach((t) => { t.dir = remountPath(path, r.path, t.dir) })
      currentDir.value = remountPath(path, r.path, currentDir.value)
      persist()
    }
    return r
  }
  function removeDir(path) {
    const r = dirRemove(pack.value[currentType.value].dirs, path)
    if (r.ok) {
      if (currentDir.value === path || String(currentDir.value).startsWith(`${path}/`)) currentDir.value = ''
      persist()
    }
    return r
  }
  function moveDir(fromPath, targetPath) {
    const res = dirMoveDrop(pack.value[currentType.value].dirs, fromPath, targetPath)
    if (!res.ok || res.skipped) return res
    const from = res.oldPath || fromPath
    const to = res.path || from
    if (to !== from) {
      pack.value[currentType.value].tables.forEach((t) => { t.dir = remountPath(from, to, t.dir) })
      currentDir.value = remountPath(from, to, currentDir.value)
    }
    persist()
    return res
  }
  function createTable(title, dir) {
    const t = makeTable({
      title,
      dir: dir || currentDir.value || '',
      type: currentType.value,
      mine: true,
      workbook: blankWorkbook(title),
    })
    pack.value[currentType.value].tables.unshift(t)
    persist()
    return t
  }
  function removeTable(id) {
    const list = pack.value[currentType.value].tables
    pack.value[currentType.value].tables = list.filter((t) => t.id !== id)
    if (currentItem.value === id) currentItem.value = ''
    persist()
  }
  function toggleFav(id) {
    const t = get(id)
    if (!t) return
    t.inMine = !tableFav(t)
    persist()
  }
  function saveWorkbook(id, workbook, preview, thumb) {
    const t = get(id)
    if (!t || !workbook) return { ok: false, msg: '表格不存在' }
    const cloned = (() => {
      try { return JSON.parse(JSON.stringify(workbook)) } catch { return workbook }
    })()
    delete cloned.__preview
    t.workbook = cloned
    t.preview = (Array.isArray(preview) && preview.length)
      ? preview
      : (workbook.__preview?.length ? workbook.__preview : previewRows(cloned))
    if (typeof thumb === 'string' && thumb.startsWith('data:image')) t.thumb = thumb
    t.updated = nowStr()
    t.updater = ME
    t.previewRev = (t.previewRev || 0) + 1
    const persisted = persist()
    return { ok: true, persisted, preview: t.preview, thumb: t.thumb }
  }
  function renameTable(id, title) {
    const t = get(id)
    if (!t) return false
    const name = String(title || '').trim()
    if (!name || name === t.title) return false
    t.title = name
    t.updated = nowStr()
    t.updater = ME
    persist()
    return true
  }
  function moveTable(id, dir) {
    const t = get(id)
    if (!t) return
    t.dir = dir
    persist()
  }
  function savePivotConfig(id, cfg) {
    const t = get(id)
    if (!t) return
    t.pivotConfig = cfg
    persist()
  }
  function submitPublish(id, payload) {
    const t = get(id)
    if (!t) return { ok: false, msg: '表格不存在' }
    t.publish = {
      status: 'pending',
      approver: payload.approver,
      reason: payload.reason || '',
      at: todayStr(),
      by: ME,
    }
    persist()
    return { ok: true, publish: t.publish }
  }

  return {
    pack, currentType, currentDir, currentItem, viewMode, filters,
    dirs, tables, filtered,
    setType, tableFav, dirCount, itemsInDir, findById, get,
    addDir, renameDir, removeDir, moveDir,
    createTable, removeTable, toggleFav, saveWorkbook, renameTable, moveTable, savePivotConfig, submitPublish, persist,
  }
})
