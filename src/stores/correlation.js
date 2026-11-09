import { defineStore } from 'pinia'
import { ref } from 'vue'
import { MEMBERS } from './positions'

/**
 * 工具箱 · 相关性数据层
 * 表格：{ id, name, group, target(标的指标), products[], companies[], contractMode('main'|'code'), contract,
 *        factor('long'|'short'|'netLong'|'netShort'), win1, lead1, win2, lead2, param, creator, createdAt, updatedAt }
 */
const LS = 'ailab.correlation.v1'
export const CORR_ME = '吴开文'
export const CORR_TOP20 = '__top20__'

function nowStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
function genId() {
  return 'C' + Date.now() + String(Math.floor(Math.random() * 90) + 10)
}

function seedTables() {
  const t = nowStr()
  return [
    {
      id: 'C10001',
      name: '螺纹钢相关性',
      group: '螺纹钢',
      target: '',
      products: ['rb'],
      companies: [],
      contractMode: 'main',
      contract: '',
      factor: 'long',
      win1: 20,
      lead1: 0,
      win2: 3,
      lead2: 0,
      param: 0.7,
      creator: CORR_ME,
      createdAt: t,
      updatedAt: t,
    },
  ]
}

export const useCorrelationStore = defineStore('correlation', () => {
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
      target: payload.target || '',
      products: [...(payload.products || [])],
      companies: [...(payload.companies || [])],
      contractMode: payload.contractMode || 'main',
      contract: payload.contract || '',
      factor: payload.factor || 'long',
      win1: Number(payload.win1) || 20,
      lead1: Number(payload.lead1) || 0,
      win2: Number(payload.win2) || 3,
      lead2: Number(payload.lead2) || 0,
      param: payload.param != null ? payload.param : 0.7,
      creator: CORR_ME,
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
    const copy = { ...src, id: genId(), name: src.name + ' 副本', products: [...src.products], companies: [...src.companies], creator: CORR_ME, createdAt: nowStr(), updatedAt: nowStr() }
    tables.value.unshift(copy)
    persist()
    return copy
  }
  function remove(id) {
    tables.value = tables.value.filter((t) => t.id !== id)
    persist()
  }
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

  const top20 = MEMBERS.slice(0, 20)

  return { tables, groups, top20, get, add, update, touch, duplicate, remove, addGroup, renameGroup, removeGroup, moveTable }
})
