import { defineStore } from 'pinia'
import { ref } from 'vue'
import { MEMBERS } from './positions'

/**
 * 工具箱 · 多空分析数据层
 * 表格：{ id, name, group, products[], contractMode('main'|'code'), contract, companyMode('top20'|'list'),
 *        companies[], dateMode('latest'|'fixed'), dateShift, fixedDate, param, cols[], creator, createdAt, updatedAt }
 * 估算口径与建仓过程一致：某公司不在前 20 榜单时，仓位 = 估算参数 × 榜单最后一名仓位（0-1）
 */
const LS = 'ailab.longshort.v1'
export const LS_ME = '吴开文'
export const LS_TOP20 = '__top20__'

/** 全部可选列（locked = 固定展示，不可取消勾选） */
export const LS_COLUMNS = [
  { key: 'company', label: '期货公司', locked: true },
  { key: 'contract', label: '合约', locked: true },
  { key: 'long', label: '多单', locked: true },
  { key: 'longChg', label: '变动' },
  { key: 'short', label: '空单', locked: true },
  { key: 'shortChg', label: '变动' },
  { key: 'netLong', label: '净多单', locked: true },
  { key: 'netChg', label: '变动' },
  { key: 'lsRatio', label: '多空比' },
  { key: 'longPct', label: '多单占前20比例' },
  { key: 'shortPct', label: '空单占前20比例' },
  { key: 'topLongChg', label: '前20多单变动' },
  { key: 'topShortChg', label: '前20空单变动' },
  { key: 'topNetLong', label: '前20净多单' },
  { key: 'topNetChg', label: '前20净多单变动' },
  { key: 'topLsRatio', label: '前20多空比' },
]

function nowStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
function genId() {
  return 'L' + Date.now() + String(Math.floor(Math.random() * 90) + 10)
}

function seedTables() {
  const t = nowStr()
  return [
    {
      id: 'L10001',
      name: '螺纹钢主力合约',
      group: '螺纹钢',
      products: ['rb'],
      contractMode: 'main',
      contract: '',
      companyMode: 'top20',
      companies: [],
      dateMode: 'latest',
      dateShift: 0,
      fixedDate: '',
      param: 0.7,
      cols: LS_COLUMNS.map((c) => c.key),
      creator: LS_ME,
      createdAt: t,
      updatedAt: t,
    },
  ]
}

export const useLongshortStore = defineStore('longshort', () => {
  let saved = null
  try { saved = JSON.parse(localStorage.getItem(LS) || 'null') } catch { saved = null }
  const hasCache = saved && Array.isArray(saved.tables)
  const tables = ref(hasCache ? saved.tables : seedTables())
  const groups = ref(hasCache && Array.isArray(saved.groups) && saved.groups.length ? saved.groups : ['螺纹钢'])

  function persist() {
    try { localStorage.setItem(LS, JSON.stringify({ tables: tables.value, groups: groups.value })) } catch { /* noop */ }
  }
  function get(id) {
    return tables.value.find((t) => t.id === id) || null
  }
  function ensureGroupPath(path) {
    if (!path) return
    const parts = path.split('/')
    for (let i = 1; i <= parts.length; i++) {
      const p = parts.slice(0, i).join('/')
      if (!groups.value.includes(p)) groups.value.push(p)
    }
  }
  function add(payload) {
    const t = {
      id: genId(),
      name: payload.name || '未命名表格',
      group: payload.group || '未分组',
      products: [...(payload.products || [])],
      contractMode: payload.contractMode || 'main',
      contract: payload.contract || '',
      companyMode: payload.companyMode === 'list' ? 'list' : 'top20',
      companies: [...(payload.companies || [])],
      dateMode: payload.dateMode === 'fixed' ? 'fixed' : 'latest',
      dateShift: Number(payload.dateShift) || 0,
      fixedDate: payload.fixedDate || '',
      param: payload.param != null ? payload.param : 0.7,
      cols: LS_COLUMNS.map((c) => c.key),
      creator: LS_ME,
      createdAt: nowStr(),
      updatedAt: nowStr(),
    }
    tables.value.unshift(t)
    ensureGroupPath(t.group)
    persist()
    return t
  }
  function update(id, patch) {
    const t = get(id)
    if (!t) return
    Object.assign(t, patch)
    t.updatedAt = nowStr()
    if (patch.group) ensureGroupPath(patch.group)
    persist()
  }
  function touch(id) {
    update(id, {})
  }
  function duplicate(id) {
    const src = get(id)
    if (!src) return null
    const copy = { ...src, id: genId(), name: src.name + ' 副本', products: [...src.products], companies: [...src.companies], cols: [...src.cols], creator: LS_ME, createdAt: nowStr(), updatedAt: nowStr() }
    tables.value.unshift(copy)
    persist()
    return copy
  }
  function remove(id) {
    tables.value = tables.value.filter((t) => t.id !== id)
    persist()
  }

  /* 目录（多级路径） */
  function addGroup(name, parent) {
    const n = String(name || '').trim()
    if (!n) return ''
    const path = parent ? `${parent}/${n}` : n
    if (groups.value.includes(path)) return ''
    ensureGroupPath(path)
    persist()
    return path
  }
  function renameGroup(oldPath, newName) {
    const n = String(newName || '').trim()
    if (!n) return false
    const slash = oldPath.lastIndexOf('/')
    const parent = slash >= 0 ? oldPath.slice(0, slash) : ''
    const newPath = parent ? `${parent}/${n}` : n
    if (newPath !== oldPath && groups.value.includes(newPath)) return false
    const remap = (p) => (p === oldPath ? newPath : p.startsWith(oldPath + '/') ? newPath + p.slice(oldPath.length) : p)
    groups.value = groups.value.map(remap)
    tables.value = tables.value.map((t) => ({ ...t, group: remap(t.group) }))
    persist()
    return true
  }
  function removeGroup(path) {
    const kill = (p) => p === path || p.startsWith(path + '/')
    groups.value = groups.value.filter((g) => !kill(g))
    tables.value = tables.value.filter((t) => !kill(t.group))
    persist()
  }
  function moveTable(id, path) {
    const t = get(id)
    if (!t || !path || t.group === path) return false
    t.group = path
    ensureGroupPath(path)
    persist()
    return true
  }
  function batchMove(ids, path) {
    if (!path) return 0
    let n = 0
    for (const id of ids) {
      const t = get(id)
      if (t) { t.group = path; n += 1 }
    }
    if (n) ensureGroupPath(path)
    persist()
    return n
  }

  /** TOP20 名单（前 20 家） */
  const top20 = MEMBERS.slice(0, 20)

  return {
    tables, groups, top20,
    get, add, update, touch, duplicate, remove,
    addGroup, renameGroup, removeGroup, moveTable, batchMove,
  }
})
