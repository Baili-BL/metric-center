import { defineStore } from 'pinia'
import { ref } from 'vue'
import { POS_MODES, CONTRACT_META, contractCn } from './positions'

/**
 * 工具箱 · 建仓过程数据层
 * 图表：{ id, name, contracts[], mode, companies[], param, group, yMin, yMax, creator, createdAt, updatedAt }
 * 目录：支持多级路径（如「黑色/螺纹钢」），与指标中心目录能力对齐
 * 估算口径：某公司某日不在前 20 榜单时，当日仓位 = 估算参数 × 榜单最后一名的仓位（参数范围 0-1，含 0/1）
 * 多合约：多选项计算合约加总持仓
 */
const LS = 'ailab.buildup.v1'
export const BUILD_ME = '吴开文'

function nowStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function chartName(contracts, mode) {
  const m = POS_MODES.find((x) => x.key === mode) || POS_MODES[0]
  const first = contractCn(contracts[0])
  return contracts.length > 1
    ? `${first}等${contracts.length}个合约主力席位${m.label}`
    : `${first}主力席位${m.label}`
}

function groupOf(contract) {
  return (CONTRACT_META[contract] || {}).label || contractCn(contract)
}

/** 兼容旧数据：contract 字符串 → contracts 数组；补 group */
function normalize(c) {
  const contracts = Array.isArray(c.contracts) && c.contracts.length ? c.contracts : (c.contract ? [c.contract] : [])
  return { ...c, contracts, contract: contracts[0] || '', group: c.group || groupOf(contracts[0] || '') }
}

function seedCharts() {
  const t = nowStr()
  return [
    { id: 'B10001', name: '螺纹钢2611主力席位净多单', contracts: ['rb2611'], contract: 'rb2611', mode: 'netLong', companies: ['国泰君安', '中信期货', '东证期货', '海通期货'], param: 0.3, group: '螺纹钢', yMin: null, yMax: null, creator: BUILD_ME, createdAt: t, updatedAt: t },
    { id: 'B10002', name: '螺纹钢2611主力席位净空单', contracts: ['rb2611'], contract: 'rb2611', mode: 'netShort', companies: ['方正中期', '永安期货', '银河期货'], param: 0.5, group: '螺纹钢', yMin: null, yMax: null, creator: BUILD_ME, createdAt: t, updatedAt: t },
  ]
}

export const useBuildupStore = defineStore('buildup', () => {
  let saved = null
  try { saved = JSON.parse(localStorage.getItem(LS) || 'null') } catch { saved = null }
  const hasCache = saved && Array.isArray(saved.charts)
  const charts = ref(hasCache ? saved.charts.map(normalize) : seedCharts())
  const groups = ref(hasCache && Array.isArray(saved.groups) && saved.groups.length ? saved.groups : ['螺纹钢'])

  function persist() {
    try { localStorage.setItem(LS, JSON.stringify({ charts: charts.value, groups: groups.value })) } catch { /* noop */ }
  }
  function get(id) {
    return charts.value.find((c) => c.id === id) || null
  }
  function add(payload) {
    const contracts = [...payload.contracts]
    const c = {
      id: 'B' + Date.now() + String(Math.floor(Math.random() * 90) + 10),
      name: chartName(contracts, payload.mode),
      contracts,
      contract: contracts[0] || '',
      mode: payload.mode,
      companies: [...payload.companies],
      param: payload.param != null ? payload.param : 0.7,
      group: payload.group || groupOf(contracts[0] || ''),
      yMin: null,
      yMax: null,
      creator: BUILD_ME,
      createdAt: nowStr(),
      updatedAt: nowStr(),
    }
    charts.value.unshift(c)
    ensureGroupPath(c.group)
    persist()
    return c
  }
  function duplicate(id) {
    const src = get(id)
    if (!src) return null
    const copy = { ...src, companies: [...src.companies], contracts: [...src.contracts], id: 'B' + Date.now() + String(Math.floor(Math.random() * 90) + 10), name: src.name + ' 副本', creator: BUILD_ME, createdAt: nowStr(), updatedAt: nowStr() }
    charts.value.unshift(copy)
    persist()
    return copy
  }
  function update(id, patch) {
    const c = get(id)
    if (!c) return
    Object.assign(c, patch)
    c.updatedAt = nowStr()
    if (patch.group) ensureGroupPath(patch.group)
    persist()
  }
  function touch(id) {
    update(id, {})
  }
  function remove(id) {
    charts.value = charts.value.filter((c) => c.id !== id)
    persist()
  }

  /* ---------- 目录（多级路径，与指标中心目录能力对齐） ---------- */
  function ensureGroupPath(path) {
    if (!path) return
    const parts = path.split('/')
    for (let i = 1; i <= parts.length; i++) {
      const p = parts.slice(0, i).join('/')
      if (!groups.value.includes(p)) groups.value.push(p)
    }
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
    charts.value = charts.value.map((c) => ({ ...c, group: remap(c.group) }))
    persist()
    return true
  }
  function removeGroup(path) {
    const kill = (p) => p === path || p.startsWith(path + '/')
    groups.value = groups.value.filter((g) => !kill(g))
    charts.value = charts.value.filter((c) => !kill(c.group))
    persist()
  }
  function moveChart(id, path) {
    const c = get(id)
    if (!c || !path || c.group === path) return false
    c.group = path
    ensureGroupPath(path)
    persist()
    return true
  }
  function batchMove(ids, path) {
    if (!path) return 0
    let n = 0
    for (const id of ids) {
      const c = get(id)
      if (c) { c.group = path; n += 1 }
    }
    if (n) ensureGroupPath(path)
    persist()
    return n
  }

  return { charts, groups, get, add, duplicate, update, touch, remove, addGroup, renameGroup, removeGroup, moveChart, batchMove }
})
