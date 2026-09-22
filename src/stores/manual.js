import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { ME } from '../utils/hash'
import { dirAddUnder, dirMoveDrop, dirRemove, dirRename, matchText, pathStarts, remountPath } from '../utils/dir'

const LS = 'ailab.manual.v2'
export const MANUAL_FREQS = ['日度', '周度', '月度', '季度', '年度']
export const DEMO_TPL1 = [
  { variety: '宏观', name: '测试指标1', date: '2024-07-10', value: 51471, unit: '测试单位' },
  { variety: '宏观', name: '测试指标1', date: '2024-07-11', value: 51472, unit: '测试单位' },
  { variety: '宏观', name: '测试指标2', date: '2024-07-10', value: 1000, unit: '测试单位2' },
  { variety: '宏观', name: '测试指标2', date: '2024-07-11', value: 1001, unit: '测试单位2' },
  { variety: '宏观', name: '', date: '2024-07-12', value: 1002, unit: '测试单位2', _bad: '指标名称不能为空' },
]
export const DEMO_TPL2 = [
  { variety: '宏观', name: '测试指标1', date: '2024-07-10', value: 51471, unit: '测试单位' },
  { variety: '宏观', name: '测试指标1', date: '2024-07-09', value: 51441, unit: '测试单位' },
  { variety: '宏观', name: '测试指标2', date: '2024-07-10', value: 1000, unit: '测试单位2' },
  { variety: '宏观', name: '测试指标2', date: '2024-07-09', value: 1001, unit: '测试单位2' },
]

const DIR_SEED = [
  { name: '黑色建材' }, { name: '期权' }, { name: '能源化工' }, { name: '农产品' },
  { name: '集运指数' },
  { name: '中国宏观', children: [{ name: '价格指数' }, { name: '外贸' }, { name: '货币金融' }] },
  { name: '贵金属' }, { name: '全球宏观' }, { name: '有色金属' },
]

const ROW_SEED = [
  { id: 'MD100001', name: '手工·社会融资规模增量', variety: '宏观', dir: '中国宏观/货币金融', unit: '亿元', freq: '月度', date: '2026-07-15', value: 31200, creator: '吴开文' },
  { id: 'MD100002', name: '手工·CPI同比', variety: '宏观', dir: '中国宏观/价格指数', unit: '%', freq: '月度', date: '2026-07-10', value: 0.6, creator: '吴开文' },
  { id: 'MD100003', name: '手工·螺纹钢现货价', variety: '黑色建材', dir: '黑色建材', unit: '元/吨', freq: '日度', date: '2026-08-08', value: 3680, creator: '张敏' },
  { id: 'MD100004', name: '手工·沪铜主力结算价', variety: '有色金属', dir: '有色金属', unit: '元/吨', freq: '日度', date: '2026-08-08', value: 78540, creator: '吴开文' },
  { id: 'MD100005', name: '手工·出口金额同比', variety: '宏观', dir: '中国宏观/外贸', unit: '%', freq: '月度', date: '2026-07-12', value: 5.2, creator: '李华' },
]

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(LS) || 'null') } catch { return null }
}

export function validateManualRow(r) {
  if (!r.dir && !r.variety) return '所属目录/品种不能为空'
  if (!r.name) return '指标名称不能为空'
  if (!r.date) return '指标日期不能为空'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return '日期格式须为 YYYY-MM-DD'
  if (r.value === '' || r.value == null || Number.isNaN(Number(r.value))) return '值不能为空且须为数字'
  if (!r.unit) return '单位不能为空'
  return ''
}

export const useManualStore = defineStore('manual', () => {
  const saved = loadSaved()
  const dirs = ref(saved?.dirs || DIR_SEED)
  const rows = ref(saved?.rows || ROW_SEED)
  const joined = ref(saved?.joined || {})
  const currentDir = ref('')
  const filters = ref({ kw: '', onlyMine: false })
  const page = ref(1)
  const pageSize = ref(10)
  const selected = ref({})
  const failRows = ref([])

  function persist() {
    try {
      localStorage.setItem(LS, JSON.stringify({ dirs: dirs.value, rows: rows.value, joined: joined.value }))
    } catch { /* */ }
  }

  function nextId() {
    const nums = rows.value.map((r) => Number(String(r.id || '').replace(/\D/g, ''))).filter(Boolean)
    const max = nums.length ? Math.max(...nums) : 100000
    return `MD${String(max + 1).padStart(6, '0')}`
  }

  function mapVarietyToDir(variety) {
    const v = String(variety || '').trim()
    if (!v) return '中国宏观'
    if (v === '宏观' || v.includes('宏观')) return '中国宏观'
    const hit = dirs.value.find((d) => d.name === v || (d.children || []).some((c) => c.name === v))
    if (hit) {
      if (hit.name === v) return hit.name
      return `${hit.name}/${v}`
    }
    if (!dirs.value.some((d) => d.name === v)) dirs.value.push({ name: v, children: [] })
    return v
  }

  const indicators = computed(() => {
    const map = {}
    rows.value.forEach((r) => {
      const key = r.name
      if (!key) return
      if (!map[key]) {
        map[key] = {
          id: r.id || '',
          name: r.name,
          variety: r.variety,
          dir: r.dir || mapVarietyToDir(r.variety),
          unit: r.unit,
          freq: r.freq || '日度',
          creator: r.creator || ME,
          latestDate: r.date,
          latestVal: Number(r.value),
          joined: !!joined.value[r.id],
        }
      }
      const ind = map[key]
      if (r.dir) ind.dir = r.dir
      if (r.freq) ind.freq = r.freq
      if (r.id) ind.id = r.id
      if (r.date >= ind.latestDate) {
        ind.latestDate = r.date
        ind.latestVal = Number(r.value)
      }
      if (joined.value[ind.id]) ind.joined = true
    })
    return Object.values(map)
  })

  const filtered = computed(() => indicators.value.filter((x) => {
    if (!pathStarts(x.dir || '', currentDir.value || '')) return false
    if (filters.value.onlyMine && x.creator !== ME) return false
    const kw = filters.value.kw.trim()
    if (kw && !matchText(x.name, kw, false) && !matchText(x.id, kw, false)) return false
    return true
  }))

  const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)))
  watch(pageCount, (n) => { if (page.value > n) page.value = n })
  const paged = computed(() => {
    const cur = Math.min(page.value, pageCount.value)
    const start = (cur - 1) * pageSize.value
    return filtered.value.slice(start, start + pageSize.value)
  })

  function dirCount(path) {
    if (!path) return indicators.value.length
    return indicators.value.filter((x) => pathStarts(x.dir || '', path)).length
  }

  function addDir(parent, name) {
    const r = dirAddUnder(dirs.value, parent, name)
    if (r.ok) persist()
    return r
  }
  function renameDir(path, name) {
    const r = dirRename(dirs.value, path, name)
    if (r.ok) {
      rows.value.forEach((row) => { row.dir = remountPath(path, r.path, row.dir) })
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
  function moveDir(fromPath, targetPath) {
    const res = dirMoveDrop(dirs.value, fromPath, targetPath)
    if (!res.ok || res.skipped) return res
    const from = res.oldPath || fromPath
    const to = res.path || from
    if (to !== from) {
      rows.value.forEach((row) => { row.dir = remountPath(from, to, row.dir) })
      if (currentDir.value) currentDir.value = remountPath(from, to, currentDir.value)
    }
    dirs.value = dirs.value.slice()
    persist()
    return res
  }

  function upsertRows(rawList) {
    const ok = []
    const fail = []
    rawList.forEach((r) => {
      const note = r._bad || validateManualRow(r)
      if (note) {
        fail.push({
          variety: r.variety || '',
          name: r.name || '',
          date: r.date || '',
          value: r.value == null ? '' : r.value,
          unit: r.unit || '',
          note,
        })
        return
      }
      ok.push({
        variety: r.variety,
        name: r.name,
        date: r.date,
        value: Number(r.value),
        unit: r.unit,
        freq: r.freq || '日度',
        creator: r.creator || ME,
        id: null,
        dir: r.dir || mapVarietyToDir(r.variety),
      })
    })
    const nameId = {}
    const nameDir = {}
    indicators.value.forEach((x) => { nameId[x.name] = x.id; nameDir[x.name] = x.dir })
    ok.forEach((r) => {
      if (!nameId[r.name]) nameId[r.name] = nextId()
      r.id = nameId[r.name]
      if (nameDir[r.name]) r.dir = nameDir[r.name]
      else nameDir[r.name] = r.dir
      rows.value.push(r)
    })
    failRows.value = fail
    page.value = 1
    persist()
    return { ok: ok.length, fail: fail.length, failRows: fail }
  }

  function removeByIds(ids) {
    const names = {}
    indicators.value.forEach((x) => { if (ids.includes(x.id)) names[x.name] = true })
    rows.value = rows.value.filter((r) => !names[r.name])
    ids.forEach((id) => { delete selected.value[id]; delete joined.value[id] })
    persist()
  }

  function markJoined(edits) {
    edits.forEach((row) => {
      joined.value[row.id] = true
      rows.value.forEach((r) => {
        if (r.id === row.id || r.name === row.name) {
          r.name = row.name
          r.unit = row.unit
          r.freq = row.freq
          r.dir = row.dir
          if (!r.id) r.id = row.id
        }
      })
    })
    persist()
  }

  function toggleSelect(id, on) {
    if (on) selected.value[id] = true
    else delete selected.value[id]
  }
  function clearSelected() { selected.value = {} }
  function setPage(n) {
    const max = pageCount.value
    page.value = Math.min(max, Math.max(1, n || 1))
  }

  return {
    dirs, rows, joined, currentDir, filters, page, pageSize, selected, failRows,
    indicators, filtered, paged, pageCount,
    dirCount, addDir, renameDir, removeDir, moveDir, upsertRows, removeByIds, markJoined,
    toggleSelect, clearSelected, setPage, mapVarietyToDir, persist, nextId,
  }
})
