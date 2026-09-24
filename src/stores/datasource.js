import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { hashStr, ME, rndSeries, todayStr, uid } from '../utils/hash'
import {
  dirAddUnder, dirChildKids, dirChildName, dirLocate, dirMoveDrop, dirRemove, dirRename,
  flattenDirs, matchText, remountOwned, remountPath,
} from '../utils/dir'

const LS = 'ailab.datasource.v2'
export const DIR_MAX_LEVEL = 6
export const CREATORS = ['陈为昌', '吴开文', '李明远', '王思琪', '赵一凡', '周婷']
export const DEPTS = ['投研一部', '投研二部', '宏观组', '商品组', '量化组']
export const FREQS = ['日度', '周度', '旬度', '月度', '季度', '年度']

export const VENDORS = [
  { name: '上海钢联', category: '行业数据', brand: 'Mysteel', fav: true, color: 'linear-gradient(135deg,#4c9aff,#2f6bff)' },
  { name: '同花顺', category: '金融市场', brand: 'iFinD', fav: true, color: 'linear-gradient(135deg,#ff7875,#d4380d)' },
  { name: 'SMM', category: '行业数据', brand: 'Smm', fav: false, color: 'linear-gradient(135deg,#37c8c3,#0e9aa8)' },
]

const SRC_SEED = {
  上海钢联: [
    { n: '黑色建材', kids: [
      '黑色建材/钢坯', '黑色建材/铁合金', '黑色建材/螺纹钢', '黑色建材/线材', '黑色建材/热卷', '黑色建材/冷卷',
      '黑色建材/中厚板', '黑色建材/生铁/废钢', '黑色建材/水泥', '黑色建材/混凝土', '黑色建材/短流程',
      '黑色建材/原煤', '黑色建材/焦煤', '黑色建材/焦炭', '黑色建材/铁矿石', '黑色建材/原木', '黑色建材/不锈钢', '黑色建材/粗钢',
    ] },
    { n: '能源化工', kids: [
      '能源化工/PP', '能源化工/PE', '能源化工/PVC', '能源化工/苯乙烯', '能源化工/烧碱', '能源化工/纯苯',
      '能源化工/玻璃', '能源化工/纯碱', '能源化工/尿素', '能源化工/PTA', '能源化工/PX', '能源化工/甲醇',
      '能源化工/乙二醇', '能源化工/LNG', '能源化工/LPG', '能源化工/沥青', '能源化工/成品油',
      '能源化工/天然橡胶', '能源化工/20号胶', '能源化工/丁二烯橡胶', '能源化工/纸浆',
    ] },
    { n: '原油', kids: ['原油/价格', '原油/需求', '原油/贸易进出口', '原油/供应', '原油/库存'] },
    { n: '基差', kids: ['基差/价格', '基差/供应', '基差/需求', '基差/库存'] },
    { n: '农产品', kids: ['农产品/棉类', '农产品/油籽', '农产品/饲料', '农产品/油脂', '农产品/养殖'] },
    { n: '中国宏观', kids: ['中国宏观/中国经济数据'] },
    { n: '农林牧渔', kids: ['农林牧渔/糖类数据库', '农林牧渔/红枣数据库', '农林牧渔/桃类数据库', '农林牧渔/苹果数据库'] },
  ],
  同花顺: [
    { n: '行情数据', kids: ['股票行情', '基金行情'] },
    { n: '财务指标' },
    { n: '宏观数据' },
  ],
  SMM: [
    { n: '有色金属', kids: ['有色金属/沪铜', '有色金属/沪锌'] },
    { n: '基本金属', kids: ['基本金属/铝', '基本金属/铅', '基本金属/镍', '基本金属/锡'] },
    { n: '新能源', kids: ['新能源/碳酸锂'] },
  ],
}

const GL_DATA = {
  '黑色建材/螺纹钢': [
    ['螺纹钢:HRB400E:Φ18:市场价:上海', 'RPA', '定时更新'],
    ['螺纹钢:HRB400E:Φ20:市场价:杭州', 'RPA', '定时更新'],
  ],
  '黑色建材/热卷': [['热轧板卷:Q235B:4.75mm:市场价:上海', 'RPA', '定时更新']],
  '黑色建材/线材': [['线材:HPB300:Φ6.5:市场价:北京', '手工', '手动更新']],
  '黑色建材/铁矿石': [['铁矿石:62%澳粉:到岸价:青岛', 'RPA', '定时更新']],
  '能源化工/PVC': [['PVC:电石法:市场价:华东', '手工', '手动更新']],
  '能源化工/PTA': [['PTA:CCFEI价格指数', 'RPA', '定时更新']],
  '能源化工/甲醇': [['甲醇:华东地区:市场价', 'RPA', '定时更新']],
  '能源化工/PE': [['LDPE:薄膜料:2100TN00:自提价:淄博:齐鲁石化', 'RPA', '定时更新']],
  '原油/价格': [
    ['WTI原油:期货结算价', 'RPA', '定时更新'],
    ['布伦特原油:期货结算价', 'RPA', '定时更新'],
    ['SC原油:主力合约:结算价', '手工', '手动更新'],
  ],
  '农产品/饲料': [['豆粕:43%蛋白:出厂价:张家港', 'RPA', '定时更新']],
  '农产品/油脂': [
    ['棕榈油:24度:港口价', 'RPA', '定时更新'],
    ['压榨厂:豆油:全样本企业:产量:中国', 'RPA', '定时更新'],
  ],
  '农产品/棉类': [['棉花:3128B:价格指数', '手工', '手动更新']],
  '农产品/养殖': [
    ['商品猪:出栏均价:中国(日)', 'RPA', '定时更新'],
    ['鸡蛋:主产区均价', '手工', '手动更新'],
    ['白羽肉鸡:棚前价:山东', '手工', '手动更新'],
  ],
  '中国宏观/中国经济数据': [
    ['社会融资规模:当月值', '手工', '手动更新'],
    ['M2:货币供应:同比', 'RPA', '定时更新'],
    ['CPI:当月同比', 'RPA', '定时更新'],
    ['PMI:制造业', '手工', '手动更新'],
  ],
  '农林牧渔/糖类数据库': [['白砂糖:主产区均价', 'RPA', '定时更新']],
  '农林牧渔/苹果数据库': [['红富士苹果:主产区收购价', '手工', '手动更新']],
  '基差/价格': [['螺纹钢基差:上海', 'RPA', '定时更新']],
  '基差/供应': [['铁矿石基差:日照港', 'RPA', '定时更新']],
  '基差/需求': [['豆粕基差:张家港', '手工', '手动更新']],
}

const SMM_DATA = {
  '有色金属/沪铜': [
    ['沪铜:现货价格:平均价', 'RPA', '定时更新'],
    ['沪铜:升贴水:上海', 'RPA', '定时更新'],
  ],
  '有色金属/沪锌': [
    ['沪锌:现货价格:平均价', 'RPA', '定时更新'],
    ['沪锌:库存:上海', '手工', '手动更新'],
  ],
  '基本金属/铝': [
    ['电解铝:现货价格:平均价', 'RPA', '定时更新'],
    ['铝锭:社会库存', 'RPA', '定时更新'],
  ],
  '基本金属/铅': [['铅锭:现货价格:平均价', 'RPA', '定时更新']],
  '基本金属/镍': [
    ['电解镍:现货价格:平均价', 'RPA', '定时更新'],
    ['镍豆:港口库存', '手工', '手动更新'],
  ],
  '基本金属/锡': [['锡锭:现货价格:平均价', 'RPA', '定时更新']],
  '新能源/碳酸锂': [
    ['碳酸锂:电池级:现货价', 'RPA', '定时更新'],
    ['碳酸锂:工业级:现货价', '手工', '手动更新'],
  ],
}

function toDirTree(seed) {
  const walkKids = (parent, kids) => (kids || []).map((k) => {
    const raw = typeof k === 'string' ? k : k.n
    const name = parent && raw.startsWith(`${parent}/`) ? raw.slice(parent.length + 1) : raw
    const nested = typeof k === 'object' ? k.kids : null
    return nested?.length ? { name, children: walkKids(name.includes('/') ? raw : `${parent ? `${parent}/` : ''}${name}`, nested) } : { name }
  })
  const out = {}
  Object.entries(seed).forEach(([src, nodes]) => {
    out[src] = (nodes || []).map((n) => ({
      name: n.n,
      children: walkKids(n.n, n.kids || []),
    }))
  })
  return out
}

export const SRC_TREE = toDirTree(SRC_SEED)

function pad2(n) { return String(n).padStart(2, '0') }
function pad4(n) { return String(n).padStart(4, '0') }
export function pickCreator(i) { return CREATORS[i % CREATORS.length] }
export function pickDept(i) { return DEPTS[i % DEPTS.length] }

export function freqOf(name, fallbackIndex = 0) {
  if (/旬/.test(name)) return '旬度'
  if (/周/.test(name)) return '周度'
  if (/月|当月/.test(name)) return '月度'
  if (/季/.test(name)) return '季度'
  if (/年|同比/.test(name)) return '年度'
  return FREQS[fallbackIndex % FREQS.length]
}

export function unitOf(name) {
  if (/指数|波动率|比价|基差/.test(name)) return '点'
  if (/美元/.test(name) || /进口/.test(name)) return '美元/干吨'
  if (/猪|公斤/.test(name)) return '元/公斤'
  if (/台/.test(name) || /挖掘机/.test(name)) return '台'
  if (/万吨|发货/.test(name)) return '万吨'
  if (/精矿|加工费|锌/.test(name)) return '元/金属吨'
  if (/同比|开工|率/.test(name)) return '%'
  return '元/吨'
}

export function parentDir(path) {
  if (!path || !path.includes('/')) return ''
  return path.slice(0, path.lastIndexOf('/'))
}

export function dirShort(path) {
  if (!path) return ''
  return path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path
}

export function firstDirOf(tree, items = [], src = '') {
  const leaves = leafDirsOf(tree)
  const hit = leaves.find((d) => items.some((it) => (!src || it.srcVendor === src) && it.dir === d))
  if (hit) return hit
  const top = (tree || [])[0]
  if (!top) return ''
  const kids = dirChildKids(top) || []
  const name = dirChildName(top)
  if (kids.length) return `${name}/${dirChildName(kids[0])}`
  return name
}

export function leafDirsOf(tree, prefix = '') {
  const out = []
  ;(tree || []).forEach((node) => {
    const name = dirChildName(node)
    const path = prefix ? `${prefix}/${name}` : name
    const kids = dirChildKids(node) || []
    if (kids.length) out.push(...leafDirsOf(kids, path))
    else out.push(path)
  })
  return out
}

export function inDirScope(itemDir, currentDir) {
  if (!currentDir) return true
  return itemDir === currentDir || parentDir(itemDir) === currentDir
}

export function mockSeriesByFreq(seed, freq) {
  const dates = freq === '日度'
    ? ['2026-08-05', '2026-08-04', '2026-08-03', '2026-08-02', '2026-08-01', '2026-07-31', '2026-07-30', '2026-07-29', '2026-07-28', '2026-07-27', '2026-07-26', '2026-07-25', '2026-07-24', '2026-07-23']
    : freq === '周度'
      ? ['2026-08-03', '2026-07-31', '2026-07-30', '2026-07-29', '2026-07-28', '2026-07-27', '2026-07-24', '2026-07-23', '2026-07-22', '2026-07-21', '2026-07-20', '2026-07-17']
      : freq === '旬度'
        ? ['2026-08-21', '2026-08-11', '2026-08-01', '2026-07-21', '2026-07-11', '2026-07-01', '2026-06-21', '2026-06-11', '2026-06-01', '2026-05-21']
        : freq === '月度'
          ? ['2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01', '2025-12', '2025-11', '2025-10']
          : freq === '季度'
            ? ['2026Q2', '2026Q1', '2025Q4', '2025Q3', '2025Q2', '2025Q1', '2024Q4', '2024Q3']
            : ['2026', '2025', '2024', '2023', '2022', '2021']
  let v = 100 + (seed % 80)
  return dates.map((date, i) => {
    const chg = ((seed * (i + 3)) % 17 - 8) / 10
    v = +(v + chg).toFixed(2)
    const has = freq === '周度' ? (i % 3 !== 1) : (i % 4 !== 2)
    const show = seed % 3 === 0 ? String(Math.round(v - 180)) : v.toFixed(2)
    return { date, val: has ? show : '' }
  })
}

export const FREQ_TO_TYPE = { 日度: 'daily', 周度: 'weekly', 旬度: 'xun', 月度: 'monthly', 季度: 'quarter', 半年度: 'half', 年度: 'yearly' }
export const TYPE_TO_FREQ = { daily: '日度', weekly: '周度', xun: '旬度', monthly: '月度', quarter: '季度', half: '半年度', yearly: '年度' }
export const WEEK_LABELS = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '日' }

export function defaultSchedule(freq) {
  const type = FREQ_TO_TYPE[freq] || 'daily'
  const times = freq === '周度' ? ['07:00'] : freq === '旬度' ? ['09:00'] : freq === '月度' ? ['08:30'] : ['08:00']
  return {
    type,
    times: times.slice(),
    weekdays: [1],
    monthDays: type === 'xun' ? [1, 11, 21] : ['monthly', 'quarter', 'half', 'yearly'].includes(type) ? [1] : [],
    months: type === 'quarter' ? [1, 4, 7, 10] : type === 'half' ? [1, 7] : type === 'yearly' ? [1] : [],
    xunDays: [1, 11, 21],
  }
}

function fmtMonthDays(days) {
  const arr = (days && days.length ? days : [1]).slice()
  const hasEnd = arr.includes('end')
  const nums = arr.filter((d) => d !== 'end').map((d) => +d).sort((a, b) => a - b)
  const parts = nums.map((d) => `${d}日`)
  if (hasEnd) parts.push('月末')
  return parts.join('、')
}

export function cronTextFromSchedule(sch) {
  if (!sch?.times?.length) return '未配置'
  const times = `（${[...sch.times].sort().join('、')}）`
  const type = sch.type || 'daily'
  const days = fmtMonthDays(sch.monthDays)
  const months = (sch.months || []).map((m) => `${m}月`).join('、') || '未选月份'
  if (type === 'daily') return `每日${times}`
  if (type === 'weekly') {
    const wds = (sch.weekdays || [1]).map((d) => `周${WEEK_LABELS[d] || d}`).join('、')
    return `每周（${wds || '未选星期'}）的${times}`
  }
  if (type === 'xun') {
    const xmap = { 1: '上旬', 11: '中旬', 21: '下旬' }
    const xdays = (sch.monthDays?.length ? sch.monthDays : [1, 11, 21]).map((d) => xmap[d] || `${d}日`).join('、')
    return `每旬（${xdays}）的${times}`
  }
  if (type === 'monthly') return `每月（${days}）的${times}`
  if (type === 'quarter') return `每季度（${months}）的（${days}）的${times}`
  if (type === 'half') return `每半年（${months}）的（${days}）的${times}`
  if (type === 'yearly') return `每年（${months}）的（${days}）的${times}`
  return times
}

function makeItem({ id, src, dir, name, origin, upd, seq }) {
  const freq = freqOf(name, seq)
  return {
    id,
    srcVendor: src,
    dir,
    name,
    origin: origin || 'RPA',
    upd: upd || '定时更新',
    freq,
    unit: unitOf(name),
    creator: pickCreator(seq),
    dept: pickDept(seq),
    date: `2026-07-2${seq % 9}`,
    status: seq % 4 === 0 ? '待更新' : '已更新',
    inLib: false,
    running: false,
    values: rndSeries(hashStr(src + name), 24, 2000 + (hashStr(name) % 3000), 40),
  }
}

function seedItems(trees) {
  const out = []
  let seq = 1
  Object.keys(trees).forEach((src) => {
    const dirs = leafDirsOf(trees[src])
    if (src === '上海钢联') {
      dirs.forEach((dir) => {
        (GL_DATA[dir] || []).forEach((r) => {
          out.push(makeItem({ id: `IND${pad4(seq)}`, src, dir, name: r[0], origin: r[1], upd: r[2], seq }))
          seq++
        })
      })
    } else if (src === 'SMM') {
      dirs.forEach((dir) => {
        (SMM_DATA[dir] || []).forEach((r) => {
          out.push(makeItem({ id: `IND${pad4(seq)}`, src, dir, name: r[0], origin: r[1], upd: r[2], seq: seq + 1 }))
          seq++
        })
      })
    } else {
      const base = ['收盘价:前复权', '成交量', '市盈率TTM', '市净率', '总市值', '换手率']
      dirs.forEach((dir, di) => {
        const n = 3 + (di % 2)
        for (let i = 0; i < n; i++) {
          out.push(makeItem({
            id: `IND${pad4(seq)}`,
            src,
            dir,
            name: `${base[(di * 2 + i) % base.length]}:${dirShort(dir)}`,
            origin: i % 2 ? '手工' : 'RPA',
            upd: i % 2 ? '手动更新' : '定时更新',
            seq: seq + di,
          }))
          seq++
        }
      })
    }
  })
  return out
}

function seedTasks(trees, items) {
  const out = {}
  Object.keys(trees).forEach((src) => {
    const list = []
    let idx = 0
    ;(trees[src] || []).forEach((node) => {
      const top = dirChildName(node)
      const dirInds = items.filter((x) => x.srcVendor === src && (x.dir === top || parentDir(x.dir) === top || x.dir.startsWith(`${top}/`)))
      if (!dirInds.length) return
      const byFreq = {}
      dirInds.forEach((x) => {
        if (!byFreq[x.freq]) byFreq[x.freq] = []
        byFreq[x.freq].push(x)
      })
      Object.keys(byFreq).forEach((freq) => {
        const inds = byFreq[freq]
        const i = idx++
        const schedule = defaultSchedule(freq)
        const configured = i % 4 !== 3
        list.push({
          id: uid('T'),
          name: `${top}·${freq}同步`,
          dir: top,
          freq,
          inds: inds.slice(0, 4).map((x) => ({ id: x.id, name: x.name, freq })),
          indTotal: inds.length,
          schedule,
          configured,
          trigger: configured ? '自动调度' : '系统默认调度',
          cron: configured ? cronTextFromSchedule(schedule) : '按照系统调度执行',
          modifier: ME,
          last: configured ? `2026-08-${pad2((i % 28) + 1)} ${pad2(8 + (i % 10))}:${pad2((i * 7) % 60)}:00` : '—',
          result: configured ? (i % 5 === 3 ? '失败' : '成功') : '—',
          on: configured ? (i % 6 !== 5) : false,
          running: false,
        })
      })
    })
    if (!list.length) {
      ;(trees[src] || []).slice(0, 3).forEach((node, i) => {
        const freq = ['日度', '周度', '月度'][i % 3]
        const schedule = defaultSchedule(freq)
        const configured = i !== 2
        list.push({
          id: uid('T'),
          name: `${dirChildName(node)}·${freq}同步`,
          dir: dirChildName(node),
          freq,
          inds: [],
          indTotal: 0,
          schedule,
          configured,
          trigger: configured ? '自动调度' : '系统默认调度',
          cron: configured ? cronTextFromSchedule(schedule) : '按照系统调度执行',
          modifier: ME,
          last: configured ? `2026-08-0${i + 1} 08:00:00` : '—',
          result: configured ? (i === 1 ? '失败' : '成功') : '—',
          on: configured,
          running: false,
        })
      })
    }
    out[src] = list
  })
  return out
}

export const useDatasourceStore = defineStore('datasource', () => {
  let saved = null
  try { saved = JSON.parse(localStorage.getItem(LS) || 'null') } catch { saved = null }
  const trees = ref(saved?.trees || JSON.parse(JSON.stringify(SRC_TREE)))
  const items = ref(saved?.items || seedItems(trees.value))
  const tasks = ref(saved?.tasks || seedTasks(trees.value, items.value))
  const favs = ref(saved?.favs || VENDORS.filter((v) => v.fav).map((v) => v.name))
  const currentSrc = ref('上海钢联')
  const currentDir = ref('')
  const currentItem = ref('')
  const seq = ref(saved?.seq || (items.value.reduce((m, it) => {
    const n = Number(String(it.id || '').replace(/\D/g, ''))
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0) + 1))

  function persist() {
    try {
      localStorage.setItem(LS, JSON.stringify({
        trees: trees.value,
        items: items.value.map((it) => ({ ...it, running: false })),
        tasks: tasks.value,
        favs: favs.value,
        seq: seq.value,
      }))
    } catch { /* */ }
  }

  const tree = computed(() => trees.value[currentSrc.value] || [])
  const srcItems = computed(() => items.value.filter((it) => it.srcVendor === currentSrc.value))

  function dirCount(path) {
    return srcItems.value.filter((it) => !path || it.dir === path || it.dir.startsWith(`${path}/`)).length
  }
  function itemsInDir(path) {
    return srcItems.value.filter((it) => it.dir === path)
  }
  function nextId() {
    const id = `IND${pad4(seq.value)}`
    seq.value += 1
    return id
  }
  function ensureDir() {
    if (!currentDir.value) currentDir.value = firstDirOf(tree.value, items.value, currentSrc.value)
  }
  function selectSrc(name) {
    currentSrc.value = name
    currentItem.value = ''
    currentDir.value = firstDirOf(trees.value[name] || [], items.value, name)
  }
  function selectDir(path) {
    currentDir.value = path
    currentItem.value = ''
  }
  function selectItem(item) {
    currentItem.value = item?.id || ''
    if (item?.dir) currentDir.value = item.dir
  }

  function addDir(parentPath, name) {
    const t = trees.value[currentSrc.value]
    if (!t) return { ok: false, msg: '数据源不存在' }
    const level = parentPath ? parentPath.split('/').filter(Boolean).length + 1 : 1
    if (level > DIR_MAX_LEVEL) return { ok: false, msg: '目录最多 6 级' }
    const res = dirAddUnder(t, parentPath, name)
    if (res.ok) persist()
    return res
  }
  function renameDir(path, name) {
    const t = trees.value[currentSrc.value]
    const res = dirRename(t, path, name)
    if (!res.ok) return res
    items.value.forEach((it) => {
      if (it.srcVendor === currentSrc.value) it.dir = remountPath(path, res.path, it.dir)
    })
    if (currentDir.value) currentDir.value = remountPath(path, res.path, currentDir.value)
    persist()
    return res
  }
  function removeDir(path) {
    const t = trees.value[currentSrc.value]
    const res = dirRemove(t, path)
    if (!res.ok) return res
    items.value = items.value.filter((it) => !(it.srcVendor === currentSrc.value && (it.dir === path || it.dir.startsWith(`${path}/`))))
    if (currentDir.value === path || currentDir.value.startsWith(`${path}/`)) currentDir.value = firstDirOf(t, items.value, currentSrc.value)
    persist()
    return res
  }
  function registerMany(rows) {
    rows.forEach((row) => {
      if (!row?.name) return
      const it = makeItem({
        id: row.id || nextId(),
        src: currentSrc.value,
        dir: row.dir || currentDir.value,
        name: row.name,
        origin: row.origin || '手工',
        upd: row.upd || '手动更新',
        seq: seq.value,
      })
      if (row.freq) it.freq = row.freq
      if (row.unit) it.unit = row.unit
      items.value.unshift(it)
    })
    persist()
  }
  function updateItem(id, patch) {
    const it = items.value.find((x) => x.id === id)
    if (!it) return
    Object.assign(it, patch)
    persist()
  }
  function removeItem(id) {
    items.value = items.value.filter((x) => x.id !== id)
    if (currentItem.value === id) currentItem.value = ''
    persist()
  }
  function moveItems(ids, dir) {
    items.value.forEach((it) => { if (ids.includes(it.id)) it.dir = dir })
    persist()
  }
  function moveDir(fromPath, targetPath) {
    const src = currentSrc.value
    const t = trees.value[src]
    if (!t) return { ok: false, msg: '数据源不存在' }
    const res = dirMoveDrop(t, fromPath, targetPath)
    if (!res.ok || res.skipped) return res
    const from = res.oldPath || fromPath
    const to = res.path || from
    if (to !== from) {
      items.value = items.value.map((it) => {
        if (it.srcVendor !== src) return it
        const dir = remountPath(from, to, it.dir)
        return dir === it.dir ? it : { ...it, dir }
      })
      remountOwned(tasks.value[src] || [], from, to, (x) => x.dir, (x, dir) => { x.dir = dir })
      if (currentDir.value) currentDir.value = remountPath(from, to, currentDir.value)
    }
    trees.value = { ...trees.value, [src]: t.slice() }
    persist()
    return res
  }
  function markInLib(id, on = true) {
    const it = items.value.find((x) => x.id === id)
    if (it) it.inLib = on
    persist()
  }
  function runNow(id) {
    const it = items.value.find((x) => x.id === id)
    if (!it || !it.inLib || it.running) return false
    it.running = true
    it.status = '执行中'
    setTimeout(() => {
      const cur = items.value.find((x) => x.id === id)
      if (!cur || !cur.running) return
      cur.running = false
      cur.status = '已更新'
      cur.date = '2026-08-18'
      persist()
    }, 1600)
    return true
  }
  function toggleTask(src, id, on) {
    const t = (tasks.value[src] || []).find((x) => x.id === id)
    if (!t) return
    t.on = typeof on === 'boolean' ? on : !t.on
    if (!t.on) t.running = false
    persist()
  }
  function updateTask(src, id, patch) {
    const t = (tasks.value[src] || []).find((x) => x.id === id)
    if (!t) return
    Object.assign(t, patch)
    if (patch.schedule) t.cron = cronTextFromSchedule(patch.schedule)
    persist()
  }
  function runTask(src, id) {
    const t = (tasks.value[src] || []).find((x) => x.id === id)
    if (!t || t.running) return
    t.running = true
    persist()
    setTimeout(() => {
      const cur = (tasks.value[src] || []).find((x) => x.id === id)
      if (!cur || !cur.running) return
      cur.running = false
      cur.last = new Date().toISOString().slice(0, 19).replace('T', ' ')
      cur.result = '成功'
      persist()
    }, 1400)
  }
  function dirExists(path) {
    return !!dirLocate(tree.value, path)
  }

  return {
    trees, items, tasks, favs, currentSrc, currentDir, currentItem, seq, VENDORS,
    tree, srcItems, flatten: computed(() => flattenDirs(tree.value)),
    dirCount, itemsInDir, persist, selectSrc, selectDir, selectItem, ensureDir,
    addDir, renameDir, removeDir, moveDir, registerMany, updateItem, removeItem, moveItems,
    markInLib, runNow, toggleTask, updateTask, runTask, nextId, dirExists,
  }
})
