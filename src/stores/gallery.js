import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { hashStr, ME, monthLabels, PEOPLE, PALETTE, rndSeries, todayStr, uid } from '../utils/hash'
import { dirAddUnder, dirChildKids, dirLocate, dirMoveDrop, dirRemove, dirRename, matchText, pathStarts, remountPath } from '../utils/dir'
import { defaultBuilderState } from '../charts/types'

const LS_CHARTS = 'ailab.gallery.userCharts'
const LS_DIRS = 'ailab.gallery.dirTree'
const LS_CHART_DIRS = 'ailab.gallery.chartDirs'
const LS_REMOVED = 'ailab.gallery.removedIds'
const LABELS = monthLabels(36)

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

function makeSeries(name, color, seed, base, amp) {
  return { name, color, axis: 'left', values: rndSeries(seed, LABELS.length, base, amp), unit: '元/吨' }
}

function seedCharts() {
  const titles = [
    { t: '塑料主力收盘价及基差走势图', dir: 'PVC', type: 'line', mine: true },
    { t: 'PP主力收盘价及基差月差对比', dir: 'PP', type: 'combo', mine: true },
    { t: '全国猪肉鲜冻价差情况和生猪出栏均价', dir: '农产品', type: 'line', mine: false },
    { t: 'PVC现货基差与库存滚动监测', dir: 'PVC/基差', type: 'area', mine: false },
    { t: '烧碱开工率与现货价格走势', dir: '烧碱', type: 'line', mine: true },
    { t: 'PE线性高压价差结构图', dir: 'PE', type: 'bar', mine: false },
    { t: '螺纹钢主力与热卷基差对比', dir: '钢材', type: 'combo', mine: true },
    { t: '沪铜主力收盘价及仓单变化', dir: '沪铜', type: 'line', mine: false },
    { t: '沪锌基差与进口盈亏', dir: '沪锌', type: 'area', mine: false },
    { t: '双焦基差月差联动监测', dir: '双焦', type: 'stackArea', mine: true },
    { t: '铝链电解铝与氧化铝价差', dir: '铝链', type: 'bar', mine: false },
    { t: '丙烯现货与PP价差跟踪', dir: '丙烯', type: 'line', mine: false },
    { t: '商品期权波动率曲面快览', dir: '期权/商品期权', type: 'scatter', mine: true },
    { t: '股指期权隐波与现货对比', dir: '期权/股指期权', type: 'timeScatter', mine: false },
    { t: 'PVC月差结构与下游利润', dir: 'PVC', type: 'stackCol', mine: false },
    { t: '钢材品种截面对比', dir: '钢材/螺纹', type: 'crossBar', mine: true },
    { t: '有色品种截面散点', dir: '沪铜', type: 'crossScatter', mine: false },
    { t: '主要品种季节性对比', dir: '钢材', type: 'seasonal', mine: true },
    { t: '品种占比结构', dir: 'PE', type: 'pie', mine: false },
    { t: '热卷与螺纹价差条形', dir: '钢材/热卷', type: 'hbar', mine: true },
  ]
  return titles.map((x, i) => {
    const seed = hashStr(x.t + i)
    const creator = x.mine ? ME : PEOPLE[(seed % (PEOPLE.length - 1)) + 1]
    const month = 5 + ((i) % 4)
    const day = 1 + ((i * 3) % 28)
    const date = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const s1 = makeSeries(x.t.split(/与|及/)[0] || x.t, PALETTE[0], seed, 3800 + (seed % 800), 80)
    const s2 = makeSeries('对比序列', PALETTE[1], seed + 17, 3600 + (seed % 500), 70)
    const type = x.type
    return {
      id: 'C' + String(10000 + seed % 90000),
      title: x.t,
      dir: x.dir,
      type,
      kind: type,
      mine: x.mine,
      inMine: x.mine,
      date,
      updated: date,
      creator,
      updater: seed % 3 === 0 ? creator : PEOPLE[(seed + 2) % PEOPLE.length],
      unit: '元/吨',
      seed,
      builderState: defaultBuilderState({
        type,
        title: x.t,
        unit: '元/吨',
        series: type === 'pie' ? [s1, s2, makeSeries('其他', PALETTE[2], seed + 9, 1200, 40)] : [s1, s2],
      }),
    }
  })
}

function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null')
    return v == null ? fallback : v
  } catch {
    return fallback
  }
}

export const useGalleryStore = defineStore('gallery', () => {
  const dirs = ref(loadJSON(LS_DIRS, DEFAULT_DIRS))
  const removed = ref(loadJSON(LS_REMOVED, []))
  const charts = ref([])
  const currentDir = ref('')
  const currentItem = ref('')
  const expanded = ref({})
  const filters = ref({ kw: '', nameKw: '', exact: false, onlyMine: false, dateFrom: '', dateTo: '', chartType: '', creator: '' })
  const viewMode = ref('card')
  const page = ref(1)
  const pageSize = 12
  const editingId = ref('')
  const drawerOpen = ref(false)

  const seeded = seedCharts()
  const saved = loadJSON(LS_CHARTS, [])
  const dirMap = loadJSON(LS_CHART_DIRS, {})
  const gone = new Set(removed.value)
  const byId = {}
  saved.forEach((c) => { if (c?.id) byId[c.id] = c })
  charts.value = [...saved, ...seeded.filter((c) => !byId[c.id])].filter((c) => c && !gone.has(c.id))
  charts.value.forEach((c) => {
    if (c.id && Object.prototype.hasOwnProperty.call(dirMap, c.id)) c.dir = dirMap[c.id] || ''
  })

  function persist() {
    try {
      localStorage.setItem(LS_CHARTS, JSON.stringify(charts.value.filter((c) => c.builderState || c.snapshot)))
      localStorage.setItem(LS_DIRS, JSON.stringify(dirs.value))
      const map = {}
      charts.value.forEach((c) => { if (c.id) map[c.id] = c.dir || '' })
      localStorage.setItem(LS_CHART_DIRS, JSON.stringify(map))
      localStorage.setItem(LS_REMOVED, JSON.stringify(removed.value))
    } catch { /* ignore quota */ }
  }

  const filtered = computed(() => {
    const f = filters.value
    return charts.value.filter((c) => {
      if (f.onlyMine && !c.mine && c.creator !== ME) return false
      if (f.chartType && (c.type || c.builderState?.type) !== f.chartType) return false
      if (f.creator && (c.creator || '') !== f.creator) return false
      if (f.dateFrom && (c.date || '') < f.dateFrom) return false
      if (f.dateTo && (c.date || '') > f.dateTo) return false
      if (currentItem.value) {
        if (c.id !== currentItem.value) return false
      } else if (!pathStarts(c.dir, currentDir.value)) {
        return false
      }
      const kw = f.nameKw || f.kw
      if (!matchText(c.title, kw, f.exact) && !matchText(c.id, kw, f.exact)) {
        const series = c.builderState?.series || []
        if (!series.some((s) => matchText(s.name, kw, false) || matchText(s.alias, kw, false))) return false
      }
      return true
    })
  })

  const paged = computed(() => {
    const start = (page.value - 1) * pageSize
    return filtered.value.slice(start, start + pageSize)
  })

  const creators = computed(() => {
    const set = new Set()
    charts.value.forEach((c) => { if (c.creator) set.add(c.creator) })
    PEOPLE.forEach((p) => set.add(p))
    return [ME, ...[...set].filter((n) => n !== ME).sort((a, b) => a.localeCompare(b, 'zh'))]
  })

  function dirCount(path) {
    return charts.value.filter((c) => pathStarts(c.dir, path)).length
  }
  function itemsInDir(path) {
    return charts.value.filter((c) => (c.dir || '') === path)
  }
  function selectDir(path) {
    currentItem.value = ''
    currentDir.value = path
    page.value = 1
  }
  function selectItem(id) {
    const c = charts.value.find((x) => x.id === id)
    currentItem.value = id
    currentDir.value = c?.dir || ''
    page.value = 1
  }

  function addDir(parent, name) {
    const r = dirAddUnder(dirs.value, parent, name)
    if (r.ok) persist()
    return r
  }
  function renameDir(path, name) {
    const r = dirRename(dirs.value, path, name)
    if (r.ok) {
      charts.value.forEach((c) => { c.dir = remountPath(path, r.path, c.dir) })
      if (currentDir.value) currentDir.value = remountPath(path, r.path, currentDir.value)
      persist()
    }
    return r
  }
  function removeDir(path) {
    const r = dirRemove(dirs.value, path)
    if (r.ok) {
      if (currentDir.value === path || String(currentDir.value).startsWith(`${path}/`)) currentDir.value = ''
      persist()
    }
    return r
  }
  function remountExpanded(oldPath, newPath) {
    const next = { ...expanded.value }
    Object.keys(next).forEach((k) => {
      const nk = remountPath(oldPath, newPath, k)
      if (nk !== k) {
        delete next[k]
        next[nk] = true
      }
    })
    if (newPath) next[newPath] = true
    expanded.value = next
  }
  function moveDir(fromPath, targetPath) {
    const res = dirMoveDrop(dirs.value, fromPath, targetPath)
    if (!res.ok || res.skipped) return res
    const from = res.oldPath || fromPath
    const to = res.path || from
    if (to !== from) {
      charts.value.forEach((c) => { c.dir = remountPath(from, to, c.dir) })
      currentDir.value = remountPath(from, to, currentDir.value)
      remountExpanded(from, to)
      if (targetPath) expanded.value[targetPath] = true
    }
    dirs.value = dirs.value.slice()
    persist()
    return res
  }

  function saveChart(payload) {
    const now = todayStr()
    if (payload.id) {
      const idx = charts.value.findIndex((c) => c.id === payload.id)
      if (idx >= 0) {
        charts.value[idx] = {
          ...charts.value[idx],
          ...payload,
          type: payload.builderState?.type || charts.value[idx].type,
          updated: now,
          updater: ME,
          mine: true,
        }
        persist()
        return charts.value[idx]
      }
    }
    const chart = {
      id: payload.id || uid('C'),
      title: payload.title,
      dir: payload.dir || '',
      type: payload.builderState?.type || 'line',
      mine: true,
      inMine: true,
      date: now,
      updated: now,
      creator: ME,
      updater: ME,
      unit: payload.builderState?.unit || '',
      builderState: payload.builderState,
    }
    charts.value.unshift(chart)
    persist()
    return chart
  }

  function removeChart(id) {
    charts.value = charts.value.filter((c) => c.id !== id)
    if (!removed.value.includes(id)) removed.value.push(id)
    persist()
  }

  function moveCharts(ids, dir) {
    charts.value.forEach((c) => { if (ids.includes(c.id)) c.dir = dir })
    persist()
  }

  function getChart(id) {
    return charts.value.find((c) => c.id === id)
  }

  function toggleFav(id) {
    const c = charts.value.find((x) => x.id === id)
    if (!c) return c
    const on = c.inMine != null ? !!c.inMine : !!c.mine
    c.inMine = !on
    persist()
    return c
  }

  return {
    dirs, charts, currentDir, currentItem, expanded, filters, viewMode, page, pageSize, editingId, drawerOpen, LABELS,
    filtered, paged, creators, dirCount, itemsInDir, persist,
    selectDir, selectItem, addDir, renameDir, removeDir, moveDir, saveChart, removeChart, moveCharts, getChart, toggleFav,
  }
})
