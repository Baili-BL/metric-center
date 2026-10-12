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
    { title: '螺纹钢月度价格时序', dir: '钢材/螺纹' },
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

/** 期货供需平衡表固定行项目（供给 → 需求 → 库存） */
export const BALANCE_ITEMS = [
  '期初库存',
  '产量',
  '产量同比',
  '进口',
  '总供给',
  '国内消费',
  '出口',
  '总需求',
  '期末库存',
  '库存变化',
  '供需缺口',
]
const BALANCE_TOTALS = new Set(['总供给', '总需求'])
const BALANCE_PCTS = new Set(['产量同比'])

function fmtPct(v) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  const n = Math.round(Number(v))
  return `${n > 0 ? '+' : ''}${n}%`
}
function pctChange(cur, base) {
  if (base == null || base === 0) return null
  return (cur / base - 1) * 100
}
/** 按固定项目生成一期可自洽的平衡表示例行 */
export function buildBalanceRows(seed = 1) {
  const n = (i, base, span) => Math.round(base + ((seed + i * 17) % span))
  const begin = n(0, 85, 35)
  const prod = n(1, 210, 55)
  const prodYoy = ((seed % 19) - 7)
  const imp = n(3, 28, 36)
  const supply = begin + prod + imp
  const cons = n(5, 230, 45)
  const exp = n(6, 12, 22)
  const demand = cons + exp
  const end = Math.max(0, supply - demand)
  const stockChg = end - begin
  const gap = supply - demand

  const row = (name, cur, prev, yoyBase, isPct = false) => {
    if (isPct) return [name, fmtPct(cur), fmtPct(prev), '—', fmtPct(yoyBase), '—']
    return [
      name,
      cur,
      prev,
      fmtPct(pctChange(cur, prev)),
      yoyBase,
      fmtPct(pctChange(cur, yoyBase)),
    ]
  }

  return [
    row('期初库存', begin, begin + 6, begin - 8),
    row('产量', prod, prod - 7, Math.round(prod / (1 + prodYoy / 100))),
    row('产量同比', prodYoy, prodYoy - 2, prodYoy - 1, true),
    row('进口', imp, imp + 3, imp - 4),
    row('总供给', supply, begin + 6 + (prod - 7) + (imp + 3), begin - 8 + Math.round(prod / (1 + prodYoy / 100)) + (imp - 4)),
    row('国内消费', cons, cons - 5, cons - 18),
    row('出口', exp, exp + 1, exp - 2),
    row('总需求', demand, (cons - 5) + (exp + 1), (cons - 18) + (exp - 2)),
    row('期末库存', end, begin, begin - 8 + Math.round(prod / (1 + prodYoy / 100)) + (imp - 4) - ((cons - 18) + (exp - 2))),
    row('库存变化', stockChg, -6, 8),
    row('供需缺口', gap, (begin + 6 + (prod - 7) + (imp + 3)) - ((cons - 5) + (exp + 1)), 12),
  ]
}

export function sampleHeaders(typeId) {
  if (typeId === 'timeseries') return ['月份', '价格', '指数', '状态']
  if (typeId === 'balance') return ['项目', '本期', '上期', '环比', '去年同期', '同比']
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
  if (typeId === 'balance') return buildBalanceRows(seed)
  if (typeId === 'mixed') {
    return months.slice(0, 4).map((m, i) => [m, 3200 + i * 40, 18 + i, +(0.32 + i * 0.02).toFixed(2)])
  }
  if (typeId === 'custom') return [['现货', 3180, 3050, 130], ['盘面', 3220, 3080, 140], ['基差', -40, -30, -10]]
  return months.slice(0, 5).map((m, i) => [m, '华东', 3150 + i * 25, ME])
}
function balanceCellStyle(rowName, col) {
  if (col === 0 && BALANCE_TOTALS.has(rowName)) {
    return { bl: 1, bg: { rgb: '#FFF7E8' } }
  }
  if (col === 0 && (BALANCE_PCTS.has(rowName) || rowName === '库存变化' || rowName === '供需缺口')) {
    return { bl: 1 }
  }
  return null
}
export function makeWorkbook(title, headers, rows, opts = {}) {
  const isBalance = !!opts.balance
  const cellData = { 0: {} }
  headers.forEach((h, c) => {
    cellData[0][c] = { v: h, t: 1, s: { bl: 1, bg: { rgb: '#E8F3FF' } } }
  })
  ;(rows || []).forEach((row, r) => {
    cellData[r + 1] = {}
    const rowName = String(row?.[0] ?? '')
    row.forEach((v, c) => {
      const n = typeof v === 'number'
      const style = isBalance ? balanceCellStyle(rowName, c) : null
      const cell = n ? { v, t: 2 } : { v: String(v), t: 1 }
      if (style) cell.s = style
      cellData[r + 1][c] = cell
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
export function balanceWorkbook(title, seed) {
  return makeWorkbook(
    title || '供需平衡表',
    sampleHeaders('balance'),
    buildBalanceRows(seed ?? hashStr(title || 'balance')),
    { balance: true },
  )
}
/** 动态版本用标题种子；指定日期则按日期生成可复现快照 */
export function balanceSeed(title, ver) {
  const mode = ver?.mode || 'dynamic'
  const date = ver?.date || ''
  const n = Number(ver?.refreshN) || 0
  if (mode === 'date' && date) return hashStr(`${title || 'balance'}|${date}`)
  return hashStr(title || 'balance') + n * 9973
}
export function blankWorkbook(title) {
  return makeWorkbook(title || '未命名表格', ['字段A', '字段B', '字段C', '字段D'], [])
}
function balanceItemNames(wb) {
  const sheetId = wb?.sheetOrder?.[0]
  const cd = sheetId ? wb?.sheets?.[sheetId]?.cellData : null
  const names = new Set()
  if (!cd) return names
  Object.keys(cd).forEach((r) => {
    const v = cd[r]?.[0]?.v
    if (v != null && v !== '' && String(v) !== '项目') names.add(String(v))
  })
  return names
}
/** 旧版五行样例或空表，可安全升级为固定期货平衡结构 */
function isLegacyBalanceSample(wb) {
  const names = balanceItemNames(wb)
  if (names.has('总供给') && names.has('总需求')) return false
  if (!names.size) return true
  const legacy = ['产量', '进口', '出口', '表观消费', '库存变化']
  return legacy.every((k) => names.has(k)) && names.size <= 6
}
function defaultWorkbook(typeId, title) {
  if (typeId === 'balance') return balanceWorkbook(title, hashStr(title || 'balance'))
  return makeWorkbook(title, sampleHeaders(typeId), sampleRows(typeId, hashStr(title)))
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
    workbook: cfg.workbook || defaultWorkbook(cfg.type, cfg.title),
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
        if (saved[tp.id]?.tables?.length) {
          // 预置（SEED）新增表增量合并进已保存数据（按标题去重），保证新表对老用户可见
          const have = new Set(saved[tp.id].tables.map((t) => t.title))
          const extra = store[tp.id].tables.filter((t) => !have.has(t.title))
          store[tp.id].tables = [...extra, ...saved[tp.id].tables]
        }
      })
    }
  } catch { /* */ }
  // 旧版平衡表样例升级为固定期货供需结构（含总供给/总需求等）
  let upgraded = false
  ;(store.balance?.tables || []).forEach((t) => {
    if (isLegacyBalanceSample(t.workbook)) {
      t.workbook = balanceWorkbook(t.title, hashStr(t.title || t.id))
      t.preview = undefined
      t.thumb = undefined
      t.previewRev = (t.previewRev || 0) + 1
      upgraded = true
    }
  })
  if (upgraded) {
    try { localStorage.setItem(LS, JSON.stringify(store)) } catch { /* */ }
  }
  return store
}

export const useTableStore = defineStore('tables', () => {
  const pack = ref(loadSaved())
  const currentType = ref('shared')
  const currentDir = ref('')
  const currentItem = ref('')
  const viewMode = ref('card')
  const filters = ref({ kw: '', nameKw: '', exact: false, onlyMine: false, dateFrom: '', dateTo: '' })
  const balanceVer = ref({ mode: 'dynamic', date: '', refreshN: 0 })

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
    const list = tables.value
    if (!path) return list.length
    return list.filter((t) => pathStarts(t.dir || '', path)).length
  }
  function itemsInDir(path) {
    return tables.value.filter((t) => (t.dir || '') === path)
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
    const bucket = pack.value[currentType.value]
    const res = dirMoveDrop(bucket.dirs, fromPath, targetPath)
    if (!res.ok || res.skipped) return res
    const from = res.oldPath || fromPath
    const to = res.path || from
    if (to !== from) {
      bucket.tables.forEach((t) => { t.dir = remountPath(from, to, t.dir) })
      currentDir.value = remountPath(from, to, currentDir.value)
    }
    bucket.dirs = bucket.dirs.slice()
    persist()
    return res
  }
  function createTable(title, dir) {
    const typeId = currentType.value
    const t = makeTable({
      title,
      dir: dir || currentDir.value || '',
      type: typeId,
      mine: true,
      workbook: typeId === 'balance' ? balanceWorkbook(title) : blankWorkbook(title),
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
  function moveTables(ids, dir) {
    const list = pack.value[currentType.value]?.tables || []
    list.forEach((t) => { if (ids.includes(t.id)) t.dir = dir })
    persist()
  }
  function savePivotConfig(id, cfg) {
    const t = get(id)
    if (!t) return
    t.pivotConfig = cfg
    persist()
  }
  function setTsConfig(id, cfg) {
    const t = get(id)
    if (!t) return
    t.tsSeries = cfg
    persist()
  }
  function setMixedConfig(id, cfg) {
    const t = get(id)
    if (!t) return
    t.mixedConfig = cfg
    persist()
  }
  function setCustomInd(id, list) {
    const t = get(id)
    if (!t) return
    t.customInd = list
    persist()
  }
  function setBalanceVer(v) {
    const next = v && typeof v === 'object' ? v : {}
    const mode = next.mode === 'date' ? 'date' : 'dynamic'
    balanceVer.value = {
      mode,
      date: mode === 'date' ? String(next.date || '') : '',
      refreshN: next.refreshN != null ? Number(next.refreshN) || 0 : (balanceVer.value.refreshN || 0),
    }
  }
  function applyBalanceWorkbook(t, ver) {
    if (!t) return
    const seed = balanceSeed(t.title || t.id, ver)
    t.workbook = balanceWorkbook(t.title, seed)
    t.preview = undefined
    t.thumb = undefined
    t.previewRev = (t.previewRev || 0) + 1
    t.updated = nowStr()
    t.updater = ME
    t.balanceVer = { mode: ver?.mode || 'dynamic', date: ver?.date || '', refreshN: ver?.refreshN || 0 }
  }
  function refreshBalance(id) {
    if (balanceVer.value.mode === 'dynamic') {
      balanceVer.value = { ...balanceVer.value, refreshN: (balanceVer.value.refreshN || 0) + 1 }
    }
    const ver = { ...balanceVer.value }
    if (id) {
      const t = get(id)
      if (!t || (t.type && t.type !== 'balance')) return 0
      applyBalanceWorkbook(t, ver)
      persist()
      return 1
    }
    if (currentType.value !== 'balance') return 0
    let n = 0
    filtered.value.forEach((t) => {
      applyBalanceWorkbook(t, ver)
      n += 1
    })
    persist()
    return n
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
    pack, currentType, currentDir, currentItem, viewMode, filters, balanceVer,
    dirs, tables, filtered,
    setType, tableFav, dirCount, itemsInDir, findById, get,
    addDir, renameDir, removeDir, moveDir,
    createTable, removeTable, toggleFav, saveWorkbook, renameTable, moveTable, moveTables, savePivotConfig, setTsConfig, setMixedConfig, setCustomInd, setBalanceVer, refreshBalance, submitPublish, persist,
  }
})
