import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * 工具箱 · 持仓分析数据层（本地模拟数据）
 * 结构：exchanges[] → products[] → contracts[]；每个合约按日期存会员持仓明细。
 * 后续接入真实接口时，仅需替换 seedPositions 的生成来源并保留同名数据结构。
 */
const LS = 'ailab.positions.v1'

/* ---------- 交易所与品种定义 ---------- */
export const EXCHANGES = [
  {
    id: 'czce', name: '郑商所',
    products: [
      { id: 'PL', name: 'PL', label: '纯苯', contracts: ['PL', 'PL611', 'PL612', 'PL701'], history: ['PL510', 'PL601'] },
      { id: 'PTA', name: 'PTA', label: 'PTA', contracts: ['PTA', 'TA611', 'TA612', 'TA701', 'TA702', 'TA703', 'TA705'], history: ['TA609', 'TA510'] },
      { id: 'PX', name: 'PX', label: '对二甲苯', contracts: ['PX', 'PX611', 'PX612', 'PX701', 'PX702'], history: ['PX609'] },
      { id: 'SA', name: 'SA', label: '纯碱', contracts: ['SA', 'SA612', 'SA701', 'SA705'], history: ['SA609'] },
      { id: 'FG', name: 'FG', label: '玻璃', contracts: ['FG', 'FG612', 'FG701', 'FG705'], history: ['FG609'] },
    ],
  },
  {
    id: 'dce', name: '大商所',
    products: [
      { id: 'eg', name: 'eg', label: '乙二醇', contracts: ['eg2611', 'eg2612', 'eg2701', 'eg2702', 'eg2703', 'eg2705'], history: ['eg2609', 'eg2610'] },
      { id: 'p', name: 'p', label: '棕榈油', contracts: ['p2611', 'p2612', 'p2701', 'p2702', 'p2703', 'p2705', 'p2709'], history: ['p2609', 'p2610'] },
      { id: 'i', name: 'i', label: '铁矿石', contracts: ['i2611', 'i2612', 'i2701', 'i2705'], history: ['i2609', 'i2610'] },
      { id: 'm', name: 'm', label: '豆粕', contracts: ['m2612', 'm2701', 'm2703', 'm2705'], history: ['m2611'] },
      { id: 'y', name: 'y', label: '豆油', contracts: ['y2612', 'y2701', 'y2705'], history: ['y2611'] },
    ],
  },
  {
    id: 'shfe', name: '上期所',
    products: [
      { id: 'cu', name: 'cu', label: '铜', contracts: ['cu2611', 'cu2612', 'cu2701', 'cu2702'], history: ['cu2610'] },
      { id: 'rb', name: 'rb', label: '螺纹钢', contracts: ['rb2611', 'rb2612', 'rb2701', 'rb2705'], history: ['rb2610'] },
      { id: 'au', name: 'au', label: '黄金', contracts: ['au2612', 'au2702', 'au2704', 'au2706'], history: ['au2611'] },
      { id: 'ag', name: 'ag', label: '白银', contracts: ['ag2612', 'ag2702', 'ag2706'], history: ['ag2611'] },
    ],
  },
  {
    id: 'cffex', name: '中金所',
    products: [
      { id: 'IF', name: 'IF', label: '沪深300', contracts: ['IF2611', 'IF2612', 'IF2703'], history: ['IF2610'] },
      { id: 'IC', name: 'IC', label: '中证500', contracts: ['IC2611', 'IC2612', 'IC2703'], history: ['IC2610'] },
      { id: 'T', name: 'T', label: '十年国债', contracts: ['T2612', 'T2703', 'T2706'], history: ['T2611'] },
    ],
  },
  {
    id: 'ine', name: '上期能源',
    products: [
      { id: 'sc', name: 'sc', label: '原油', contracts: ['sc2612', 'sc2701', 'sc2703'], history: ['sc2611'] },
      { id: 'lu', name: 'lu', label: '低硫燃料油', contracts: ['lu2612', 'lu2701'], history: [] },
      { id: 'nr', name: 'nr', label: '20号胶', contracts: ['nr2612', 'nr2701'], history: ['nr2611'] },
    ],
  },
]

/* 期货公司会员（模拟名单） */
export const MEMBERS = [
  '国泰君安', '方正中期', '华泰期货', '中信期货', '海通期货', '广发期货', '中信建投', '永安期货',
  '银河期货', '东证期货', '金瑞期货', '瑞达期货', '新湖期货', '招商期货', '国投安信', '光大期货',
  '申银万国', '南华期货', '弘业期货', '中粮期货', '五矿期货', '平安期货', '兴业期货', '浙商期货',
]

/** 单边会员的对手边补齐值说明（图中以「*」标记，tooltip 中展示） */
const EST_NOTES = {
  国泰君安: '空单为数据源补齐值',
  申银万国: '空单为数据源补齐值',
  中粮期货: '多单为数据源补齐值',
  兴业期货: '多单为数据源补齐值',
}

/** 合约代码 → 品种元数据（中文名展示用） */
export const CONTRACT_META = (() => {
  const m = {}
  for (const ex of EXCHANGES) {
    for (const p of ex.products) {
      for (const c of [...p.contracts, ...(p.history || [])]) m[c] = { label: p.label, name: p.name, exchange: ex.name }
    }
  }
  return m
})()

/** 合约中文名：品种中文 + 月份（如 乙二醇2612），无月份视为主力（如 纯苯主力） */
export function contractCn(code) {
  const meta = CONTRACT_META[code]
  if (!meta) return code
  const digits = code.match(/(\d{3,4})$/)
  return digits ? meta.label + digits[1] : meta.label + '主力'
}

/** 确定性伪随机（同一 seed 稳定生成，刷新后数据不变） */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function hashCode(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

function fmtDate(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 生成近 TRADING_DAYS 个交易日的 YYYY-MM-DD 列表（跳过周六日，升序） */
const TRADING_DAYS = 40
function tradingDates() {
  const out = []
  const d = new Date()
  while (out.length < TRADING_DAYS) {
    const w = d.getDay()
    if (w !== 0 && w !== 6) out.push(fmtDate(d))
    d.setDate(d.getDate() - 1)
  }
  return out.reverse()
}

/**
 * 生成某合约全部会员在全部交易日的持仓：
 * ranks[date] = [{ member, long, longChg, short, shortChg }]
 */
function seedRanks(contract, dates) {
  const rand = rng(hashCode(contract))
  const ranks = {}
  let prevRows = null
  for (const date of dates) {
    const rows = MEMBERS.map((member, i) => {
      const scale = 26000 * Math.exp(-i * 0.22) * (0.7 + rand() * 0.6)
      const decay = prevRows ? prevRows[i] : null
      const drift = decay ? (rand() * 0.5 - 0.1) : 0
      const long = Math.max(10, Math.round(scale * (0.5 + rand() * 0.8) + (decay ? decay.long * drift : 0)))
      const short = Math.max(10, Math.round(scale * (0.5 + rand() * 0.8) + (decay ? decay.short * drift : 0)))
      const note = EST_NOTES[member]
      const estB = note && note.includes('多单') ? note : null
      const estS = note && note.includes('空单') ? note : null
      return { member, long, short, estB, estS }
    })
    ranks[date] = rows.map((r, i) => ({
      ...r,
      longChg: prevRows ? r.long - prevRows[i].long : 0,
      shortChg: prevRows ? r.short - prevRows[i].short : 0,
    }))
    prevRows = rows
  }
  return ranks
}

function seedPositions() {
  const dates = tradingDates()
  const contracts = {}
  for (const ex of EXCHANGES) {
    for (const prod of ex.products) {
      for (const c of [...prod.contracts, ...(prod.history || [])]) contracts[c] = seedRanks(c, dates)
    }
  }
  return { dates, contracts }
}

export const POSITION_TABS = [
  { key: 'rank', label: '持仓排名' },
  { key: 'building', label: '建仓过程' },
  { key: 'longshort', label: '多空分析' },
  { key: 'corr', label: '相关性' },
]

/** 口径定义：标题文案 + 配色规范（基色/增/减，见 PRD 4.3） */
export const POS_MODES = [
  { key: 'long', label: '多单', unit: '持多单量', base: '#F8D000', up: '#F06868', down: '#80E060' },
  { key: 'short', label: '空单', unit: '持空单量', base: '#C0D8F8', up: '#3038F8', down: '#50D020' },
  { key: 'netLong', label: '净多单', unit: '净多单量', base: '#F8F0C8', up: '#F84848', down: '#D8F0D0' },
  { key: 'netShort', label: '净空单', unit: '净空单量', base: '#C0D8F8', up: '#3038F8', down: '#50D020' },
]

/** 原始行 → 统一 { member, value, chg } + 买卖明细（tooltip 用），按 value 降序 */
function toRanked(rows, mode) {
  const mapped = rows.map((r) => {
    const detail = {
      long: r.long, longChg: r.longChg || 0,
      short: r.short, shortChg: r.shortChg || 0,
      est: r.estB || r.estS || null,
    }
    if (mode === 'long') return { member: r.member, value: r.long, chg: r.longChg, ...detail }
    if (mode === 'short') return { member: r.member, value: r.short, chg: r.shortChg, ...detail }
    const net = r.long - r.short
    const chgNet = (r.longChg || 0) - (r.shortChg || 0)
    return mode === 'netLong'
      ? { member: r.member, value: net, chg: chgNet, ...detail }
      : { member: r.member, value: -net, chg: -chgNet, ...detail }
  })
  return mapped
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
}

export const usePositionStore = defineStore('positions', () => {
  let saved = null
  try { saved = JSON.parse(localStorage.getItem(LS) || 'null') } catch { saved = null }
  const hasCache = saved && Array.isArray(saved.dates) && saved.dates.length && saved.contracts
  const data = ref(hasCache ? saved : seedPositions())

  function persist() {
    try { localStorage.setItem(LS, JSON.stringify(data.value)) } catch { /* noop */ }
  }

  const dates = computed(() => data.value.dates)
  const latestDate = computed(() => data.value.dates[data.value.dates.length - 1])

  /** 指定合约在指定日期的排名数据（已排序，含变动） */
  function getRanking(contract, date, mode) {
    const dayRows = data.value.contracts[contract] && data.value.contracts[contract][date]
    if (!dayRows) return []
    return toRanked(dayRows, mode)
  }

  /** 指定合约在指定日期的四口径 KPI 汇总（多单/空单/净多/净空：合计 + 较昨日 + 上榜家数） */
  function getTotals(contract, date) {
    const dayRows = data.value.contracts[contract] && data.value.contracts[contract][date]
    if (!dayRows) return null
    const out = {}
    for (const m of POS_MODES) {
      const rows = toRanked(dayRows, m.key)
      out[m.key] = {
        total: rows.reduce((s, r) => s + r.value, 0),
        chg: rows.reduce((s, r) => s + r.chg, 0),
        count: rows.length,
      }
    }
    return out
  }

  /** 前后日期导航用：取相邻交易日 */
  function neighborDate(date, delta) {
    const i = data.value.dates.indexOf(date)
    if (i < 0) return date
    const j = Math.min(data.value.dates.length - 1, Math.max(0, i + delta))
    return data.value.dates[j]
  }

  /** 某合约全部交易日的合计趋势（供建仓过程等后续 Tab 使用） */
  function getTrend(contract, mode) {
    const out = []
    for (const date of data.value.dates) {
      const rows = getRanking(contract, date, mode)
      out.push({ date, total: rows.reduce((s, r) => s + r.value, 0) })
    }
    return out
  }

  return { data, dates, latestDate, getRanking, getTotals, neighborDate, getTrend, persist }
})
