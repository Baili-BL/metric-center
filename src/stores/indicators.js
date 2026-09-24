import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { hashStr, ME, monthLabels, PEOPLE, rndSeries, todayStr, uid } from '../utils/hash'
import { dirAddUnder, dirChildKids, dirLocate, dirMoveDrop, dirRemove, dirRename, matchText, pathStarts, remountPath } from '../utils/dir'

const LS = 'ailab.indicators.v1'
const LABELS = monthLabels(36)

export const CALC_TYPES = [
  { id: 1, name: '指标运算', group: '基础运算', ready: true, desc: '自定义表达式，对多个指标进行四则混合运算' },
  { id: 17, name: '累计值', group: '基础运算', ready: true, desc: '按目标频率对更高频数据加总' },
  { id: 2, name: '转月', group: '基础运算', ready: true, desc: '将累计值差分还原为单月值' },
  { id: 3, name: '同比', group: '变化分析', ready: true, desc: '今年同期 / 去年同期 − 1' },
  { id: 4, name: '同差值', group: '变化分析', ready: true, desc: '今年同期 − 去年同期' },
  { id: 6, name: '环比', group: '变化分析', ready: true, desc: '本期相对上一期（或 N 期前）的比值' },
  { id: 7, name: '环差', group: '变化分析', ready: true, desc: '本期相对上一期（或 N 期前）的差值' },
  { id: 5, name: '移动平均', group: '平滑与平均', ready: true, desc: '以 N 期窗口计算移动平均值，默认 5 期' },
  { id: 18, name: '指数修匀', group: '平滑与平均', ready: true, desc: '按 alpha 系数进行指数加权平滑' },
  { id: 19, name: '日均值', group: '平滑与平均', ready: true, desc: '将当期总量折算为每日平均值' },
  { id: 8, name: '开频', group: '频率转换', ready: true, desc: '低频数据转高频，支持空值填充策略' },
  { id: 15, name: '降频', group: '频率转换', ready: true, desc: '高频数据转低频，支持取值方式设置' },
  { id: 14, name: '年化', group: '频率转换', ready: true, desc: '将当期值折算为年化水平' },
  { id: 9, name: '指标拼接', group: '拼接与移位', ready: true, desc: '将两个指标按日期拼接为一条连续序列' },
  { id: 10, name: '时间移位', group: '拼接与移位', ready: true, desc: '按自然时间将序列领先或滞后移动' },
  { id: 11, name: '期数移位', group: '拼接与移位', ready: true, desc: '按数据期数将序列领先或滞后移动' },
  { id: 12, name: '超季节性', group: '高级分析', ready: true, desc: '按日历对齐处理季节性（公历 / 春节对齐）' },
  { id: 13, name: '拟合', group: '高级分析', ready: true, desc: '以自变量 x 与因变量 y 线性拟合' },
  { id: 16, name: '扩散指数', group: '高级分析', ready: true, desc: '多个子指标相对母指标合成扩散指数' },
]
export const GROUP_ORDER = ['基础运算', '变化分析', '平滑与平均', '频率转换', '拼接与移位', '高级分析']
const CALC_NAMES = CALC_TYPES.map((t) => t.name)

const SEED_TITLES = [
  '五大材周度消费量同比', '盘螺基差:10太原宏达', '螺纹钢:HRB400E:Φ18:市场价:上海',
  '螺纹钢:HRB400E:Φ20:市场价:上海', '盘螺:HRB400E:Φ8:市场价:太原', '商品猪:出栏均价:中国(日)',
  '毛白比价平均情况', '普氏指数海运费占比', '铁矿普氏指数-海运费指数', '铁矿:发货量:全球(周)',
  '焦炭:一级冶金焦:日照港平仓价', '水泥价格指数:全国', '挖掘机销量:当月值',
  '热轧板卷:Q235B:5.75mm:市场价:乐从', '废钢:重废:不含税:唐山', '动力煤:Q5500:港口平仓价:秦皇岛',
  '甲醇:港口库存:华东(周)', 'PTA:内盘现货价:华东', '豆粕:43%蛋白:现货价:沿海',
  '棕榈油:24度:港口报价:天津', '白糖:现货价:南宁', '棉花:3128B:到厂价:新疆',
  '铜:电解铜:现货价:上海', '铝:A00:现货价:上海', '锌:0#:现货价:上海',
  '碳酸锂:电池级:现货价:华东', '不锈钢:304/2B:冷轧卷:无锡', '玻璃:大板:市场价:沙河',
  'PVC:电石法:市场价:华东', '纯碱:重质:市场价:华北', '天然橡胶:SCRWF:现货价:上海',
  'BDI干散货运价指数', '集运欧线:SCFI欧线运价指数', 'PPI:生产资料:当月同比', 'M2:同比增速',
  '金:Au9999:现货价:上海', '银:Ag9999:现货价:上海',
]

const DIR_SEED = [
  { name: '黑色建材' }, { name: '期权' }, { name: '能源化工' }, { name: '农产品' },
  { name: '集运指数' },
  { name: '中国宏观', children: [{ name: '价格指数' }, { name: '外贸' }, { name: '货币金融' }] },
  { name: '贵金属' }, { name: '全球宏观' }, { name: '有色金属' },
]

function freqOf(t) {
  if (/当年|年度|年频/.test(t) && !/同比|环比/.test(t)) return '年频'
  if (/当月|月度|月频|累计同比|累计值/.test(t)) return '月频'
  if (/周/.test(t)) return '周频'
  return '日频'
}
function sourceOf(t) {
  if (/螺纹|盘螺|焦炭|铁矿|废钢|热轧/.test(t)) return '上海钢联'
  if (/豆粕|棕榈|甲醇|PTA|白糖|棉花/.test(t)) return '期货交易所'
  if (/普氏|海运|BDI/.test(t)) return '同花顺'
  if (/铜|铝|锌|锂/.test(t)) return 'SMM'
  return '手工'
}
function dirOf(t) {
  if (/螺纹|盘螺|焦炭|铁矿|废钢|热轧|水泥|不锈钢/.test(t)) return '黑色建材'
  if (/甲醇|PTA|PVC|纯碱|玻璃|橡胶/.test(t)) return '能源化工'
  if (/猪|豆粕|棕榈|白糖|棉花/.test(t)) return '农产品'
  if (/铜|铝|锌|锂/.test(t)) return '有色金属'
  if (/金|银/.test(t)) return '贵金属'
  if (/CPI|PPI|M2|宏观/.test(t)) return '中国宏观/价格指数'
  if (/集运|BDI/.test(t)) return '集运指数'
  return '能源化工'
}

function seedCards() {
  return SEED_TITLES.map((title, i) => {
    const seed = hashStr(title)
    const calc = title.includes('同比') || seed % 3 !== 0
    const values = rndSeries(seed, LABELS.length, 1000 + (seed % 4000), 40 + (seed % 80))
    return {
      id: 'I' + String(10000 + seed % 90000),
      title,
      date: `2026-${String(6 + (i % 3)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`,
      state: seed % 2 ? '启用' : '停用',
      kind: calc ? 'calc' : 'base',
      calcType: calc ? (title.includes('同比') ? '同比' : CALC_NAMES[seed % CALC_NAMES.length]) : '',
      unit: /开工|同比|占比/.test(title) ? '%' : '元/吨',
      freq: freqOf(title),
      source: sourceOf(title),
      dir: dirOf(title),
      creator: seed % 4 === 0 ? ME : PEOPLE[seed % PEOPLE.length],
      values,
      latest: values.at(-1),
      latestDate: '2026-09-12',
      formula: calc ? 'A / B - 1' : '',
      deps: calc ? [SEED_TITLES[(i + 1) % SEED_TITLES.length]] : [],
    }
  })
}

export const useIndicatorStore = defineStore('indicators', () => {
  let saved = null
  try { saved = JSON.parse(localStorage.getItem(LS) || 'null') } catch { saved = null }
  const dirs = ref(saved?.dirs || DIR_SEED)
  const cards = ref(saved?.cards || seedCards())
  const currentDir = ref('')
  const currentItem = ref('')
  const expanded = ref({})
  const filters = ref({ kw: '', exact: false, onlyMine: false, dateFrom: '', dateTo: '', creator: '' })
  const viewMode = ref('card')
  const page = ref(1)
  const pageSize = 12
  const detailId = ref('')

  function persist() {
    try { localStorage.setItem(LS, JSON.stringify({ dirs: dirs.value, cards: cards.value })) } catch { /* */ }
  }

  const filtered = computed(() => cards.value.filter((c) => {
    const f = filters.value
    if (f.onlyMine && c.creator !== ME) return false
    if (f.creator && (c.creator || '') !== f.creator) return false
    if (f.dateFrom && c.date < f.dateFrom) return false
    if (f.dateTo && c.date > f.dateTo) return false
    if (currentItem.value) return c.title === currentItem.value
    if (currentDir.value && !pathStarts(c.dir, currentDir.value)) return false
    const kw = f.kw || ''
    if (!matchText(c.title, kw, f.exact) && !matchText(c.id, kw, f.exact)) return false
    return true
  }))
  const creators = computed(() => {
    const set = new Set()
    cards.value.forEach((c) => { if (c.creator) set.add(c.creator) })
    return [...set].sort()
  })
  const kindCounts = computed(() => {
    const arr = filtered.value
    const base = arr.filter((c) => c.kind !== 'calc').length
    return { total: arr.length, base, calc: arr.length - base }
  })

  const paged = computed(() => {
    const start = (page.value - 1) * pageSize
    return filtered.value.slice(start, start + pageSize)
  })

  function dirCount(path) {
    return cards.value.filter((c) => pathStarts(c.dir, path)).length
  }
  function itemsInDir(path) {
    return cards.value.filter((c) => c.dir === path)
  }
  function dirHasKids(path) {
    const loc = dirLocate(dirs.value, path)
    const kids = loc ? dirChildKids(loc.node) : null
    return !!(kids && kids.length)
  }
  function isOpen(path) {
    const canExp = dirHasKids(path) || itemsInDir(path).length > 0
    if (!canExp) return false
    if (dirHasKids(path)) return expanded.value[path] !== false
    return expanded.value[path] === true
  }
  function toggleExpand(path) {
    expanded.value[path] = !isOpen(path)
  }
  function selectDir(path) {
    currentItem.value = ''
    expanded.value[path] = true
    currentDir.value = currentDir.value === path ? '' : path
    page.value = 1
  }
  function selectItem(title) {
    const c = cards.value.find((x) => x.title === title)
    currentItem.value = title
    currentDir.value = c?.dir || ''
    if (c?.dir) expanded.value[c.dir] = true
    page.value = 1
  }
  function remountCards(oldPath, newPath) {
    cards.value = cards.value.map((c) => {
      const dir = remountPath(oldPath, newPath, c.dir)
      return dir === c.dir ? c : { ...c, dir }
    })
    currentDir.value = remountPath(oldPath, newPath, currentDir.value)
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
      remountCards(from, to)
      remountExpanded(from, to)
      if (targetPath) expanded.value[targetPath] = true
      if (res.path) currentDir.value = res.path
    }
    dirs.value = dirs.value.slice()
    persist()
    return res
  }
  function addDir(parent, name) {
    const r = dirAddUnder(dirs.value, parent, name)
    if (r.ok) {
      currentDir.value = r.path
      currentItem.value = ''
      if (parent) expanded.value[parent] = true
      persist()
    }
    return r
  }
  function renameDir(path, name) {
    const r = dirRename(dirs.value, path, name)
    if (r.ok && r.path !== path) remountCards(path, r.path)
    if (r.ok) persist()
    return r
  }
  function removeDir(path) {
    const r = dirRemove(dirs.value, path)
    if (r.ok) {
      if (currentDir.value === path || currentDir.value.startsWith(`${path}/`)) currentDir.value = ''
      currentItem.value = ''
      persist()
    }
    return r
  }
  function moveItem(title, path) {
    const c = cards.value.find((x) => x.title === title || x.id === title)
    if (!c) return { ok: false, msg: '指标不存在' }
    if (c.dir === path) return { ok: false, msg: `「${c.title}」已在该目录` }
    c.dir = path
    currentItem.value = c.title
    currentDir.value = path
    expanded.value[path] = true
    persist()
    return { ok: true }
  }

  function toggle(id) {
    const c = cards.value.find((x) => x.id === id || x.title === id)
    if (!c) return
    c.state = c.state === '启用' ? '停用' : '启用'
    persist()
  }
  function remove(id) {
    cards.value = cards.value.filter((c) => c.id !== id && c.title !== id)
    persist()
  }
  function moveTo(ids, dir) {
    cards.value.forEach((c) => { if (ids.includes(c.id) || ids.includes(c.title)) c.dir = dir })
    persist()
  }
  function addBase(items, dir) {
    items.forEach((it) => {
      const row = typeof it === 'string' ? { title: it } : (it || {})
      const title = row.title || row.name
      if (!title || cards.value.some((c) => c.title === title || (row.id && c.id === row.id))) return
      const seed = hashStr(title)
      const values = rndSeries(seed, LABELS.length, 2000, 50)
      cards.value.unshift({
        id: row.id || uid('I'),
        srcId: row.id || '',
        title,
        date: todayStr(),
        state: '启用',
        kind: 'base',
        calcType: '',
        unit: row.unit || '元/吨',
        freq: row.freq || freqOf(title),
        source: row.source || sourceOf(title),
        dir: row.dir || dir || currentDir.value || '黑色建材',
        creator: ME,
        values,
        latest: row.latest ?? values.at(-1),
        latestDate: row.latestDate || todayStr(),
      })
    })
    persist()
  }
  function addCalc(payload) {
    const card = {
      id: uid('I'),
      title: payload.title,
      date: todayStr(),
      state: '启用',
      kind: 'calc',
      calcType: payload.calcType,
      unit: payload.unit || '',
      freq: payload.freq || '日频',
      source: '计算',
      dir: payload.dir || currentDir.value || '黑色建材',
      creator: ME,
      values: rndSeries(hashStr(payload.title), LABELS.length, 100, 8),
      latest: 0,
      latestDate: todayStr(),
      formula: payload.formula || '',
      deps: payload.deps || [],
      code: payload.code || '',
    }
    cards.value.unshift(card)
    persist()
    return card
  }
  function replaceRef(from, to) {
    cards.value.forEach((c) => {
      if (c.title === from) c.title = to
      if (c.deps) c.deps = c.deps.map((d) => (d === from ? to : d))
    })
    persist()
  }
  function updateInfo(id, patch) {
    const c = cards.value.find((x) => x.id === id)
    if (!c) return
    Object.assign(c, patch)
    persist()
  }
  function addLatest(id, date, val) {
    const c = cards.value.find((x) => x.id === id)
    if (!c) return
    c.latest = val
    c.latestDate = date
    persist()
  }
  function get(id) {
    return cards.value.find((c) => c.id === id || c.title === id)
  }

  return {
    dirs, cards, currentDir, currentItem, expanded, filters, viewMode, page, pageSize, detailId, LABELS,
    filtered, paged, creators, kindCounts, dirCount, itemsInDir, dirHasKids, isOpen, toggleExpand, selectDir, selectItem,
    persist, addDir, renameDir, removeDir, moveDir, moveItem,
    toggle, remove, moveTo, addBase, addCalc, replaceRef, updateInfo, addLatest, get,
  }
})
