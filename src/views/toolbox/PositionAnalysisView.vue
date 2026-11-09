<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { EXCHANGES, MEMBERS, POS_MODES, POSITION_TABS, CONTRACT_META, contractCn, usePositionStore } from '../../stores/positions'
import { useBuildupStore, BUILD_ME, chartName } from '../../stores/buildup'
import { useLongshortStore, LS_COLUMNS, LS_ME, LS_TOP20 } from '../../stores/longshort'
import { useCorrelationStore, CORR_ME, CORR_TOP20 } from '../../stores/correlation'
import { useIndicatorStore } from '../../stores/indicators'
import { hashStr, rndSeries } from '../../utils/hash'
import RankChart from './RankChart.vue'
import EmptyState from '../../components/EmptyState.vue'
import DataChart from '../../components/DataChart.vue'
import DirTree from '../../components/DirTree.vue'
import FilterBar from '../../components/FilterBar.vue'
import EstimateTip from '../../components/EstimateTip.vue'
import Icon from '../../components/Icon.vue'

const route = useRoute()
const router = useRouter()
const store = usePositionStore()
const buildupStore = useBuildupStore()
const lsStore = useLongshortStore()

/* ---------- Tab（由路由 query 驱动，便于侧栏菜单联动） ---------- */
const activeTab = computed(() => route.query.tab || 'rank')
function setTab(key) {
  router.push({ path: '/toolbox/positions', query: key === 'rank' ? {} : { tab: key } })
}
const activeTabMeta = computed(() => POSITION_TABS.find((t) => t.key === activeTab.value) || POSITION_TABS[0])

/* ---------- 左栏筛选状态 ---------- */
const exId = ref('dce')
const search = ref('')
const showHistory = ref(false)
const contract = ref('')
const mode = ref('long')
const dateStr = ref(store.latestDate)

const ex = computed(() => EXCHANGES.find((e) => e.id === exId.value) || EXCHANGES[0])

function visibleContracts(p) {
  const list = [...p.contracts]
  if (showHistory.value) list.push(...(p.history || []))
  return list
}

/* 搜索支持品种中文名 / 品种代码 / 合约代码三种输入 */
const groups = computed(() => {
  const kw = search.value.trim().toLowerCase()
  return ex.value.products
    .map((p) => {
      const hitProduct = !kw || p.label.toLowerCase().includes(kw) || p.name.toLowerCase().includes(kw)
      const list = visibleContracts(p).filter(
        (c) => hitProduct || c.toLowerCase().includes(kw) || contractCn(c).toLowerCase().includes(kw),
      )
      return { ...p, list }
    })
    .filter((g) => g.list.length)
})

const flatContracts = computed(() => groups.value.flatMap((g) => g.list))
const contractCount = computed(() => ex.value.products.reduce((s, p) => s + visibleContracts(p).length, 0))
/* 已交割合约（开启「历史合约」后以虚线区分，避免与在市合约混淆） */
const histSet = computed(() => new Set(ex.value.products.flatMap((p) => p.history || [])))

watch(exId, () => {
  contract.value = flatContracts.value[0] || ''
})
watch(flatContracts, (list) => {
  if (!list.includes(contract.value)) contract.value = list[0] || ''
}, { immediate: true })

/* ---------- 合约前后切换 ---------- */
const canPrevContract = computed(() => flatContracts.value.indexOf(contract.value) > 0)
const canNextContract = computed(() => {
  const i = flatContracts.value.indexOf(contract.value)
  return i >= 0 && i < flatContracts.value.length - 1
})
const contractPos = computed(() => {
  const i = flatContracts.value.indexOf(contract.value)
  return i < 0 ? '' : `${i + 1}/${flatContracts.value.length}`
})
function stepContract(delta) {
  const i = flatContracts.value.indexOf(contract.value)
  const j = i + delta
  if (j >= 0 && j < flatContracts.value.length) contract.value = flatContracts.value[j]
}

/* ---------- 日期导航 ---------- */
const canPrevDay = computed(() => store.dates.indexOf(dateStr.value) > 0)
const canNextDay = computed(() => {
  const i = store.dates.indexOf(dateStr.value)
  return i >= 0 && i < store.dates.length - 1
})
function stepDate(delta) {
  dateStr.value = store.neighborDate(dateStr.value, delta)
}
function onDateChange(v) {
  if (!v) return
  const dates = store.dates
  if (dates.includes(v)) { dateStr.value = v; return }
  // 选择非交易日时回退到不晚于该日的最近交易日
  const earlier = dates.filter((d) => d <= v)
  dateStr.value = earlier.length ? earlier[earlier.length - 1] : dates[dates.length - 1]
}
const isLatestDate = computed(() => dateStr.value === store.latestDate)

/* ---------- 排名数据与标签 ---------- */
const modeMeta = computed(() => POS_MODES.find((m) => m.key === mode.value) || POS_MODES[0])
const ranking = computed(() => store.getRanking(contract.value, dateStr.value, mode.value))

/* ---------- 概览：四口径合计 / 多空结构 ---------- */
const totals = computed(() => store.getTotals(contract.value, dateStr.value))
const balance = computed(() => {
  if (!totals.value) return null
  const l = totals.value.long.total
  const s = totals.value.short.total
  const sum = l + s
  const diff = l - s
  return {
    l, s, diff,
    lPct: sum ? (l / sum) * 100 : 50,
    sPct: sum ? (s / sum) * 100 : 50,
    text: sum === 0 ? '暂无数据'
      : diff === 0 ? '多空完全均衡'
        : `${diff > 0 ? '多头' : '空头'}占优 ${fmt(Math.abs(diff))} 手（占比 ${((Math.abs(diff) / sum) * 100).toFixed(1)}%）`,
  }
})

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US')
}
function fmtChg(n) {
  return (n > 0 ? '+' : '') + fmt(n)
}
function hasCount(key) {
  return key === 'netLong' || key === 'netShort'
}

/* ---------- 近30 个交易日合计走势（宽屏下补足指标卡横向空间） ---------- */
const SPARK_W = 88
const SPARK_H = 26
/* 趋势线用比条形基色更深一档的同族色，保证 1.4px 细线在小尺寸下可辨认 */
const SPARK_TONE = { long: '#D9A400', short: '#6E93D6', netLong: '#C2A03A', netShort: '#6E93D6' }
const spark = computed(() => {
  if (!totals.value) return {}
  const out = {}
  for (const m of POS_MODES) {
    out[m.key] = store
      .getTrend(contract.value, m.key)
      .filter((p) => p.date <= dateStr.value)
      .slice(-30)
      .map((p) => p.total)
  }
  return out
})
function sparkPath(vals) {
  if (!vals || vals.length < 2) return ''
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const pad = 2
  const step = (SPARK_W - pad * 2) / (vals.length - 1)
  return vals
    .map((v, i) => {
      const x = pad + i * step
      const y = SPARK_H - pad - ((v - min) / span) * (SPARK_H - pad * 2)
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/* ---------- 建仓过程：目录树 / 图表 / 估算参数 ----------
   估算口径：某公司某日不在前 20 榜单时，仓位 = 估算参数 × 榜单最后一名的仓位
   参数范围 0-1（含 0 和 1），可在图表工具条实时调整 */
const pbFilters = reactive({ kw: '', exact: false, onlyMine: false })
const railMode = ref('tree') // tree：目录树 | create：新建/编辑图表
const railCollapsed = ref(false)
const editingId = ref('') // 非空 = 二次编辑已有图表
const activeBuildId = ref('')
const selectedBuildDir = ref('') // 当前选中目录（决定「添加子目录」与批量移动目标）
const creatingGroup = ref('') // 新建图表所属目录
const quickKey = ref('m1')
const pbRange = ref(null) // 自定义区间 { start, end }
const creating = reactive({ exId: 'czce', products: [], contracts: [], mode: 'netLong', companies: [], param: 0.7 })
const BUILD_PALETTE = ['#1664ff', '#f93920', '#3bcc76', '#ff7d00', '#7861ff', '#14c9c9', '#a05200', '#64646e']
const BUILD_QUICK = [
  { key: 'w1', label: '近1周', n: 5 },
  { key: 'm1', label: '近1月', n: 22 },
  { key: 'm2', label: '近2月', n: 44 },
  { key: 'm3', label: '近3月', n: 66 },
]

const buildCharts = computed(() => {
  const kw = pbFilters.kw.trim().toLowerCase()
  return buildupStore.charts.filter((c) => {
    if (pbFilters.onlyMine && c.creator !== BUILD_ME) return false
    if (!kw) return true
    const label = (CONTRACT_META[c.contract] || {}).label || ''
    const hit = (s) => (pbFilters.exact ? s.toLowerCase() === kw : s.toLowerCase().includes(kw))
    return hit(c.name) || hit(c.contract) || hit(label)
  })
})

/* ---------- 目录树（图库同款 DirTree：拖拽移动 + 计数 + 节点操作）---------- */
const pbDirs = computed(() => {
  const roots = []
  const map = new Map()
  const ensure = (path) => {
    if (map.has(path)) return map.get(path)
    const parts = path.split('/')
    const node = { name: parts[parts.length - 1], children: [] }
    map.set(path, node)
    const parentPath = parts.slice(0, -1).join('/')
    if (parentPath) ensure(parentPath).children.push(node)
    else roots.push(node)
    return node
  }
  for (const g of buildupStore.groups) ensure(g)
  return roots
})
function pbLeavesOf(path) {
  return buildCharts.value.filter((c) => (c.group || '') === path)
}
function pbCountOf(path) {
  if (!path) return buildCharts.value.length
  return buildCharts.value.filter((c) => c.group === path || (c.group || '').startsWith(path + '/')).length
}
function onTreeSelect(path) {
  selectedBuildDir.value = path || ''
  activeBuildId.value = ''
}
function onTreeSelectItem(item) {
  selectedBuildDir.value = ''
  activeBuildId.value = item.id
}
function onDropChart(payload, path) {
  const id = payload?.item?.id || payload?.id
  if (!id || !path) return
  if (buildupStore.moveChart(id, path)) Message.success(`已移动到「${path.split('/').join(' / ')}」`)
}
function onMoveChart(payload) {
  const id = payload?.item?.id || payload?.id
  if (!id) return
  openMoveChart(id)
}

/* ---------- 批量 / 单个移动图表 ---------- */
const batch = reactive({ visible: false, ids: [], target: '', mode: 'batch' })
function openBatchMove() {
  batch.mode = 'batch'
  batch.ids = []
  batch.target = selectedBuildDir.value || buildupStore.groups[0] || ''
  batch.visible = true
}
function openMoveChart(id) {
  batch.mode = 'move'
  batch.ids = [id]
  batch.target = selectedBuildDir.value || buildupStore.groups[0] || ''
  batch.visible = true
}
function confirmBatchMove() {
  if (!batch.ids.length) {
    Message.warning('请选择要移动的图表')
    return false
  }
  if (!batch.target) {
    Message.warning('请选择目标目录')
    return false
  }
  const n = buildupStore.batchMove(batch.ids, batch.target)
  Message.success(batch.mode === 'move' ? '已移动' : `已移动 ${n} 个图表`)
  batch.visible = false
}

const activeBuild = computed(() => buildupStore.get(activeBuildId.value))
const buildList = computed(() => buildCharts.value)
function modeLabelOf(key) {
  return (POS_MODES.find((m) => m.key === key) || POS_MODES[0]).label
}
function openBuild(ch) {
  activeBuildId.value = ch.id
}

/* ---------- 新建图表（rail 表单）---------- */
const createProducts = computed(() => (EXCHANGES.find((x) => x.id === creating.exId) || EXCHANGES[0]).products)
/* 合约候选：所选品种（可多选）合约的并集 */
const createContracts = computed(() => {
  const out = []
  for (const p of createProducts.value) {
    if (creating.products.includes(p.id)) out.push(...p.contracts)
  }
  return out
})
function pruneContracts() {
  const valid = createContracts.value
  const kept = creating.contracts.filter((c) => valid.includes(c))
  creating.contracts = kept.length ? kept : (valid.length ? [valid[0]] : [])
}
function syncCreateContract() {
  const exN = EXCHANGES.find((x) => x.id === creating.exId) || EXCHANGES[0]
  const first = exN.products[0]
  creating.products = creating.products.length ? creating.products : (first ? [first.id] : [])
  pruneContracts()
}
function onCreateEx(id) {
  creating.exId = id
  creating.products = []
  creating.contracts = []
  syncCreateContract()
}
function onCreateProduct(ids) {
  creating.products = Array.isArray(ids) ? ids : (ids ? [ids] : [])
  if (!creating.products.length) {
    const first = createProducts.value[0]
    if (first) creating.products = [first.id]
  }
  pruneContracts()
}
/* 期货公司：TOP20 快捷项（__top20__ 占位，提交时展开为前 20 家） */
const TOP20_KEY = '__top20__'
const TOP20_LIST = () => MEMBERS.slice(0, 20)
function onCreateCompanies(ids) {
  creating.companies = Array.isArray(ids) ? ids : []
}
function resolveCompanies(list) {
  if (list.includes(TOP20_KEY)) return [...TOP20_LIST()]
  return list.filter((x) => x !== TOP20_KEY)
}
function openCreate() {
  editingId.value = ''
  railMode.value = 'create'
  creatingGroup.value = selectedBuildDir.value || ''
  let exN = null
  let prod = null
  const leaf = creatingGroup.value.split('/').pop()
  if (leaf) {
    for (const e of EXCHANGES) {
      const p = e.products.find((x) => x.label === leaf)
      if (p) { exN = e; prod = p; break }
    }
  }
  if (!exN) exN = EXCHANGES.find((x) => x.id === exId.value) || EXCHANGES[0]
  if (!prod) prod = exN.products[0] || null
  creating.exId = exN.id
  creating.products = prod ? [prod.id] : []
  creating.contracts = prod && prod.contracts.length ? [prod.contracts[0]] : []
  creating.mode = 'netLong'
  creating.companies = [TOP20_KEY]
  creating.param = 0.7
}
function editBuild(id) {
  const c = buildupStore.get(id)
  if (!c) return
  editingId.value = id
  activeBuildId.value = id
  railMode.value = 'create'
  creatingGroup.value = c.group || ''
  /* 用图表配置回填表单（交易所/品种按合约反查） */
  const meta = CONTRACT_META[c.contracts[0]] || {}
  const exN = EXCHANGES.find((e) => e.name === meta.exchange) || EXCHANGES[0]
  const prod = exN.products.find((p) => p.contracts.includes(c.contracts[0])) || exN.products[0]
  creating.exId = exN.id
  /* 由图表合约反查所属品种（支持多品种） */
  const prodIds = []
  for (const c0 of c.contracts) {
    for (const p of exN.products) {
      if (p.contracts.includes(c0) && !prodIds.includes(p.id)) prodIds.push(p.id)
    }
  }
  creating.products = prodIds.length ? prodIds : (prod ? [prod.id] : [])
  creating.contracts = [...c.contracts]
  creating.mode = c.mode
  const top20 = TOP20_LIST()
  const isTop20 = c.companies.length === top20.length && top20.every((m) => c.companies.includes(m))
  creating.companies = isTop20 ? [TOP20_KEY] : [...c.companies]
  creating.param = c.param
}
function confirmCreate() {
  if (!creating.contracts.length) return Message.warning('请选择合约')
  const companies = resolveCompanies(creating.companies)
  if (!companies.length) return Message.warning('请至少选择一家期货公司')
  const payload = {
    contracts: creating.contracts,
    mode: creating.mode,
    companies,
    param: clampParam(creating.param),
  }
  if (editingId.value) {
    /* 二次编辑：更新已有图表（名称随合约/口径重新生成）*/
    buildupStore.update(editingId.value, { ...payload, name: chartName(payload.contracts, payload.mode) })
    Message.success('图表已更新')
    railMode.value = 'tree'
    return
  }
  if (creatingGroup.value) payload.group = creatingGroup.value
  const c = buildupStore.add(payload)
  activeBuildId.value = c.id
  railMode.value = 'tree'
  Message.success('图表已创建')
}
function cancelCreate() {
  railMode.value = 'tree'
  editingId.value = ''
  activeBuildId.value = ''
}
function backToList() {
  activeBuildId.value = ''
  editingId.value = ''
}

/* ---------- 目录管理（添加 / 重命名 / 删除）---------- */
const groupModal = reactive({ visible: false, mode: 'add', old: '', name: '', parent: '' })
function openGroupModal(mode, arg) {
  groupModal.mode = mode
  if (mode === 'rename') {
    groupModal.old = arg || ''
    groupModal.parent = ''
    groupModal.name = (arg || '').split('/').pop() || ''
  } else {
    groupModal.old = ''
    groupModal.parent = arg || selectedBuildDir.value || ''
    groupModal.name = ''
  }
  groupModal.visible = true
}
function confirmGroupModal() {
  const n = groupModal.name.trim()
  if (!n) return Message.warning('请输入目录名称')
  if (groupModal.mode === 'add') {
    if (!buildupStore.addGroup(n, groupModal.parent)) return Message.warning('目录已存在')
    selectedBuildDir.value = groupModal.parent ? `${groupModal.parent}/${n}` : n
    Message.success('目录已添加')
  } else {
    if (!buildupStore.renameGroup(groupModal.old, n)) return Message.warning('目录已存在')
    Message.success('已重命名')
  }
  groupModal.visible = false
}
function delGroup(path) {
  buildupStore.removeGroup(path)
  if (selectedBuildDir.value === path || selectedBuildDir.value.startsWith(path + '/')) selectedBuildDir.value = ''
  if (!activeBuild.value) activeBuildId.value = ''
  Message.success('目录及其图表已删除')
}

/* ================== 多空分析 ================== */
const lsMode = ref('tree') // tree | form
const lsEditingId = ref('')
const lsActiveId = ref('')
const lsFilters = reactive({ kw: '', exact: false, onlyMine: false })
const lsSelectedDir = ref('')
const lsCollapsed = ref(false)
const lsForm = reactive({ products: [], contractMode: 'main', contract: '', companies: [LS_TOP20], dateMode: 'latest', dateShift: 0, fixedDate: '', param: 0.7 })
const lsColsDlg = reactive({ visible: false, list: [] })
const lsDragIdx = ref(-1)
const lsNameInput = ref('')
const lsGroupModal = reactive({ visible: false, mode: 'add', old: '', name: '', parent: '' })

const lsAllProducts = computed(() => EXCHANGES.flatMap((e) => e.products.map((p) => ({ ...p, exchange: e.name }))))
const lsFormContracts = computed(() => {
  const out = []
  for (const p of lsAllProducts.value) {
    if (lsForm.products.includes(p.id)) out.push(...p.contracts)
  }
  return out
})

const lsTables = computed(() => {
  const kw = lsFilters.kw.trim().toLowerCase()
  return lsStore.tables.filter((t) => {
    if (lsFilters.onlyMine && t.creator !== LS_ME) return false
    if (!kw) return true
    const hit = (s) => (lsFilters.exact ? s.toLowerCase() === kw : s.toLowerCase().includes(kw))
    return hit(t.name) || hit(t.group || '')
  })
})
const lsDirs = computed(() => {
  const roots = []
  const map = new Map()
  const ensure = (path) => {
    if (map.has(path)) return map.get(path)
    const parts = path.split('/')
    const node = { name: parts[parts.length - 1], children: [] }
    map.set(path, node)
    const parentPath = parts.slice(0, -1).join('/')
    if (parentPath) ensure(parentPath).children.push(node)
    else roots.push(node)
    return node
  }
  for (const g of lsStore.groups) ensure(g)
  return roots
})
function lsTreeLeaves(path) {
  return lsTables.value.filter((t) => (t.group || '') === path)
}
function lsCountOf(path) {
  if (!path) return lsTables.value.length
  return lsTables.value.filter((t) => t.group === path || (t.group || '').startsWith(path + '/')).length
}
function onLsSelect(path) {
  lsSelectedDir.value = path || ''
  lsActiveId.value = ''
}
function onLsSelectItem(t) {
  lsSelectedDir.value = ''
  lsActiveId.value = t.id
  lsNameInput.value = t.name
}
function onLsDrop(payload, path) {
  const id = payload?.item?.id || payload?.id
  if (!id || !path) return
  if (lsStore.moveTable(id, path)) Message.success(`已移动到「${path.split('/').join(' / ')}」`)
}

/* 目录弹窗 */
function openLsGroupModal(mode, arg) {
  lsGroupModal.mode = mode
  if (mode === 'rename') {
    lsGroupModal.old = arg || ''
    lsGroupModal.parent = ''
    lsGroupModal.name = (arg || '').split('/').pop() || ''
  } else {
    lsGroupModal.old = ''
    lsGroupModal.parent = arg || lsSelectedDir.value || ''
    lsGroupModal.name = ''
  }
  lsGroupModal.visible = true
}
function confirmLsGroupModal() {
  const n = lsGroupModal.name.trim()
  if (!n) return Message.warning('请输入目录名称')
  if (lsGroupModal.mode === 'add') {
    if (!lsStore.addGroup(n, lsGroupModal.parent)) return Message.warning('目录已存在')
    lsSelectedDir.value = lsGroupModal.parent ? `${lsGroupModal.parent}/${n}` : n
    Message.success('目录已添加')
  } else {
    if (!lsStore.renameGroup(lsGroupModal.old, n)) return Message.warning('目录已存在')
    Message.success('已重命名')
  }
  lsGroupModal.visible = false
}
function delLsGroup(path) {
  lsStore.removeGroup(path)
  if (lsSelectedDir.value === path || lsSelectedDir.value.startsWith(path + '/')) lsSelectedDir.value = ''
  if (!activeLs.value) lsActiveId.value = ''
  Message.success('目录及其表格已删除')
}

/* 新建 / 编辑表格表单 */
const activeLs = computed(() => lsStore.get(lsActiveId.value))
watch(activeLs, (t) => {
  if (t) lsNameInput.value = t.name
}, { immediate: true })
function lsLabelOf(table) {
  const first = lsAllProducts.value.find((p) => p.id === (table.products || [])[0])
  return first ? first.label : '—'
}
function lsContractOf(table) {
  if (table.contractMode === 'code' && table.contract) return table.contract
  const first = lsAllProducts.value.find((p) => p.id === (table.products || [])[0])
  return first && first.contracts.length ? first.contracts[0] : ''
}
function lsResolveCompanies(table) {
  if (table.companyMode === 'top20') return [...lsStore.top20]
  return table.companies.length ? [...table.companies] : [...lsStore.top20]
}
function openLsCreate() {
  lsEditingId.value = ''
  lsMode.value = 'form'
  const first = lsAllProducts.value.find((p) => p.id === ex.value.products[0]?.id) || lsAllProducts.value[0]
  lsForm.products = first ? [first.id] : []
  lsForm.contractMode = 'main'
  lsForm.contract = first && first.contracts.length ? first.contracts[0] : ''
  lsForm.companies = [LS_TOP20]
  lsForm.dateMode = 'latest'
  lsForm.dateShift = 0
  lsForm.fixedDate = ''
  lsForm.param = 0.7
}
function editLsTable(id) {
  const t = lsStore.get(id)
  if (!t) return
  lsEditingId.value = id
  lsActiveId.value = id
  lsMode.value = 'form'
  lsForm.products = [...(t.products || [])]
  lsForm.contractMode = t.contractMode || 'main'
  lsForm.contract = t.contract || ''
  lsForm.companies = t.companyMode === 'top20' ? [LS_TOP20] : [...t.companies]
  lsForm.dateMode = t.dateMode || 'latest'
  lsForm.dateShift = t.dateShift || 0
  lsForm.fixedDate = t.fixedDate || ''
  lsForm.param = t.param != null ? t.param : 0.7
}
function onLsProductChange(ids) {
  lsForm.products = Array.isArray(ids) ? ids : []
  if (!lsForm.products.length) {
    const first = lsAllProducts.value[0]
    if (first) lsForm.products = [first.id]
  }
  const valid = lsFormContracts.value
  if (!valid.includes(lsForm.contract)) lsForm.contract = valid[0] || ''
}
function onLsCompanyChange(ids) {
  lsForm.companies = Array.isArray(ids) ? ids : []
  if (!lsForm.companies.length) lsForm.companies = [LS_TOP20]
}
function onLsContractChange(v) {
  if (v === 'main') {
    lsForm.contractMode = 'main'
    return
  }
  lsForm.contractMode = 'code'
  lsForm.contract = v
}
function lsFormCompanies() {
  if (lsForm.companies.includes(LS_TOP20)) return [...lsStore.top20]
  return lsForm.companies.filter((x) => x !== LS_TOP20)
}
function confirmLsForm() {
  if (!lsForm.products.length) return Message.warning('请选择品种')
  const companies = lsFormCompanies()
  if (!companies.length) return Message.warning('请至少选择一家期货公司')
  const payload = {
    products: [...lsForm.products],
    contractMode: lsForm.contractMode,
    contract: lsForm.contractMode === 'code' ? lsForm.contract : '',
    companyMode: lsForm.companies.includes(LS_TOP20) ? 'top20' : 'list',
    companies: lsForm.companies.includes(LS_TOP20) ? [] : companies,
    dateMode: lsForm.dateMode,
    dateShift: Number(lsForm.dateShift) || 0,
    fixedDate: lsForm.fixedDate || '',
    param: clampParam(lsForm.param),
  }
  if (lsEditingId.value) {
    lsStore.update(lsEditingId.value, payload)
    Message.success('表格已更新')
    lsMode.value = 'tree'
    return
  }
  const first = lsAllProducts.value.find((p) => p.id === lsForm.products[0])
  const name = (first ? first.label : '') + '主力合约'
  const t = lsStore.add({ ...payload, name, group: first ? first.label : '未分组' })
  lsActiveId.value = t.id
  lsMode.value = 'tree'
  Message.success('表格已创建')
}
function cancelLsForm() {
  lsMode.value = 'tree'
  lsEditingId.value = ''
}

/* 列表 / 详情 */
function openLsDetail(id) {
  lsActiveId.value = id
  const t = lsStore.get(id)
  if (t) lsNameInput.value = t.name
}
function backLsList() {
  lsActiveId.value = ''
}
function saveLsDetail() {
  if (!activeLs.value) return
  const name = lsNameInput.value.trim()
  if (!name) return Message.warning('请输入表格名称')
  lsStore.update(activeLs.value.id, { name })
  Message.success('已保存')
}
function refreshLsTable(id) {
  lsStore.touch(id)
  Message.success('已刷新')
}
function dupLsTable(id) {
  const t = lsStore.duplicate(id)
  if (t) Message.success('已另存为「' + t.name + '」')
}
function delLsTable(id) {
  lsStore.remove(id)
  if (lsActiveId.value === id) lsActiveId.value = ''
  Message.success('已删除')
}

/* 期数 / 数据计算 */
function lsDateFor(table) {
  const ds = store.dates
  if (!ds.length) return ''
  if (table.dateMode === 'fixed' && table.fixedDate) {
    const earlier = ds.filter((d) => d <= table.fixedDate)
    return earlier.length ? earlier[earlier.length - 1] : ds[0]
  }
  const shift = Math.min(Number(table.dateShift) || 0, ds.length - 1)
  return ds[ds.length - 1 - shift]
}
function lsRawValues(contract, date) {
  const raw = store.data.contracts[contract] && store.data.contracts[contract][date]
  if (!raw || !raw.length) return null
  const byLong = [...raw].sort((a, b) => b.long - a.long)
  const byShort = [...raw].sort((a, b) => b.short - a.short)
  const top20L = byLong.slice(0, 20)
  const top20S = byShort.slice(0, 20)
  return {
    byMember: Object.fromEntries(raw.map((r) => [r.member, r])),
    inL: new Set(top20L.map((r) => r.member)),
    inS: new Set(top20S.map((r) => r.member)),
    lastL: top20L.length ? top20L[top20L.length - 1].long : 0,
    lastS: top20S.length ? top20S[top20S.length - 1].short : 0,
    sumL: top20L.reduce((s, r) => s + r.long, 0),
    sumS: top20S.reduce((s, r) => s + r.short, 0),
  }
}
function lsValueOf(cur, co, field, param) {
  const r = cur.byMember[co]
  const inSet = field === 'long' ? cur.inL.has(co) : cur.inS.has(co)
  if (inSet && r) return { v: r[field], est: false }
  return { v: Math.round(param * (field === 'long' ? cur.lastL : cur.lastS)), est: true }
}
const lsDetailDate = computed(() => (activeLs.value ? lsDateFor(activeLs.value) : ''))
const lsRows = computed(() => {
  const t = activeLs.value
  if (!t) return []
  const contract = lsContractOf(t)
  if (!contract) return []
  const ds = store.dates
  const date = lsDateFor(t)
  const i = ds.indexOf(date)
  const prevDate = i > 0 ? ds[i - 1] : date
  const cur = lsRawValues(contract, date)
  if (!cur) return []
  const prev = lsRawValues(contract, prevDate)
  const companies = lsResolveCompanies(t)
  /* 前20 汇总（多单榜 / 空单榜） */
  let topLongChg = 0
  let topShortChg = 0
  let topNetCur = 0
  let topNetPrev = 0
  for (const m of cur.inL) {
    const a = cur.byMember[m]
    const b = prev && prev.byMember[m]
    if (a && b) topLongChg += a.long - b.long
    if (a) topNetCur += a.long - a.short
    if (b) topNetPrev += b.long - b.short
  }
  for (const m of cur.inS) {
    const a = cur.byMember[m]
    const b = prev && prev.byMember[m]
    if (a && b) topShortChg += a.short - b.short
  }
  return companies.map((co) => {
    const L = lsValueOf(cur, co, 'long', t.param)
    const S = lsValueOf(cur, co, 'short', t.param)
    const Lp = prev ? lsValueOf(prev, co, 'long', t.param) : null
    const Sp = prev ? lsValueOf(prev, co, 'short', t.param) : null
    const net = L.v - S.v
    const netPrev = Lp && Sp ? Lp.v - Sp.v : net
    return {
      company: co,
      contract,
      long: L.v,
      longChg: Lp ? L.v - Lp.v : 0,
      short: S.v,
      shortChg: Sp ? S.v - Sp.v : 0,
      netLong: net,
      netChg: net - netPrev,
      lsRatio: S.v ? L.v / S.v : 0,
      longPct: cur.sumL ? (L.v / cur.sumL) * 100 : 0,
      shortPct: cur.sumS ? (S.v / cur.sumS) * 100 : 0,
      topLongChg,
      topShortChg,
      topNetLong: topNetCur,
      topNetChg: topNetCur - topNetPrev,
      topLsRatio: cur.sumS ? cur.sumL / cur.sumS : 0,
    }
  })
})
const lsVisibleCols = computed(() => {
  const t = activeLs.value
  if (!t) return []
  const map = new Map(LS_COLUMNS.map((c) => [c.key, c]))
  const lockedKeys = LS_COLUMNS.filter((c) => c.locked).map((c) => c.key)
  const savedArr = t.cols && t.cols.length ? t.cols : null
  /* 新格式（含全部锁定列）按保存顺序展示；旧数据按默认列顺序补齐锁定列 */
  if (savedArr && lockedKeys.every((k) => savedArr.includes(k))) {
    return savedArr.map((k) => map.get(k)).filter(Boolean)
  }
  const savedSet = new Set(savedArr || LS_COLUMNS.map((c) => c.key))
  return LS_COLUMNS.filter((c) => c.locked || savedSet.has(c.key))
})
const lsSortedRows = computed(() => lsRows.value)
/* Arco Table 列配置：排序 + 自定义渲染 */
const lsATableColumns = computed(() => lsVisibleCols.value.map((c) => ({
  title: c.label,
  dataIndex: c.key,
  align: c.key === 'company' || c.key === 'contract' ? 'left' : 'right',
  sortable: {
    sortDirections: ['descend', 'ascend'],
    sorter: (a, b) => {
      const va = a[c.key]
      const vb = b[c.key]
      if (typeof va === 'number' && typeof vb === 'number') return va - vb
      return String(va).localeCompare(String(vb))
    },
  },
  render: ({ record }) => lsCellText(record, c.key),
})))
function fmtInt(n) {
  return Number(n || 0).toLocaleString('en-US')
}
function fmtSigned(n) {
  const v = Number(n || 0)
  return (v > 0 ? '+' : '') + fmtInt(v)
}
function lsCellText(r, key) {
  switch (key) {
    case 'company': return r.company
    case 'contract': return r.contract
    case 'long': case 'short': case 'netLong':
      return fmtInt(r[key])
    case 'topNetLong': return fmtInt(r[key])
    case 'longChg': case 'shortChg': case 'netChg': case 'topLongChg': case 'topShortChg': case 'topNetChg':
      return fmtSigned(r[key])
    case 'lsRatio': case 'topLsRatio': return Number(r[key]).toFixed(2)
    case 'longPct': case 'shortPct': return Number(r[key]).toFixed(1) + '%'
    default: return r[key]
  }
}

/* 自定义列 */
function openLsCols() {
  if (!activeLs.value) return
  const visible = lsVisibleCols.value
  const visibleKeys = new Set(visible.map((c) => c.key))
  const hidden = LS_COLUMNS.filter((c) => !visibleKeys.has(c.key) && !c.locked).map((c) => ({ ...c, checked: false }))
  lsColsDlg.list = [...visible.map((c) => ({ ...c, checked: true })), ...hidden]
  lsColsDlg.visible = true
}
function onLsColDrop(toIdx) {
  const from = lsDragIdx.value
  if (from < 0 || from === toIdx) return
  const list = lsColsDlg.list
  const [item] = list.splice(from, 1)
  list.splice(toIdx, 0, item)
  lsDragIdx.value = toIdx
}
function applyLsCols() {
  if (!activeLs.value) return true
  const cols = lsColsDlg.list.filter((c) => c.checked || c.locked).map((c) => c.key)
  lsStore.update(activeLs.value.id, { cols })
  Message.success('列设置已保存')
  lsColsDlg.visible = false
  return true
}

/* ================== 相关性 ================== */
const corrStore = useCorrelationStore()
const corrMode = ref('tree')
const corrEditingId = ref('')
const corrActiveId = ref('')
const corrFilters = reactive({ kw: '', exact: false, onlyMine: false })
const corrSelectedDir = ref('')
const corrCollapsed = ref(false)
const corrForm = reactive({ target: '', products: [], companies: [CORR_TOP20], contractMode: 'main', contract: '', factor: 'long', win1: 20, lead1: 0, win2: 3, lead2: 0, param: 0.7 })
const corrGroupModal = reactive({ visible: false, mode: 'add', old: '', name: '', parent: '' })
const corrNameInput = ref('')

const indStore = useIndicatorStore()
const corrAllProducts = computed(() => EXCHANGES.flatMap((e) => e.products.map((p) => ({ ...p, exchange: e.name }))))
const corrTargetOptions = computed(() => indStore.cards.map((c) => c.title))
const corrFormContracts = computed(() => {
  const out = []
  for (const p of corrAllProducts.value) if (corrForm.products.includes(p.id)) out.push(...p.contracts)
  return out
})

const corrTables = computed(() => {
  const kw = corrFilters.kw.trim().toLowerCase()
  return corrStore.tables.filter((t) => {
    if (corrFilters.onlyMine && t.creator !== CORR_ME) return false
    if (!kw) return true
    const hit = (s) => (corrFilters.exact ? s.toLowerCase() === kw : s.toLowerCase().includes(kw))
    return hit(t.name) || hit(t.group || '')
  })
})
const corrDirs = computed(() => {
  const roots = []
  const map = new Map()
  const ensure = (path) => {
    if (map.has(path)) return map.get(path)
    const parts = path.split('/')
    const node = { name: parts[parts.length - 1], children: [] }
    map.set(path, node)
    const parentPath = parts.slice(0, -1).join('/')
    if (parentPath) ensure(parentPath).children.push(node)
    else roots.push(node)
    return node
  }
  for (const g of corrStore.groups) ensure(g)
  return roots
})
function corrTreeLeaves(path) {
  return corrTables.value.filter((t) => (t.group || '') === path)
}
function corrCountOf(path) {
  if (!path) return corrTables.value.length
  return corrTables.value.filter((t) => t.group === path || (t.group || '').startsWith(path + '/')).length
}
function onCorrSelect(path) {
  corrSelectedDir.value = path || ''
  corrActiveId.value = ''
}
function onCorrSelectItem(t) {
  corrSelectedDir.value = ''
  corrActiveId.value = t.id
  corrNameInput.value = t.name
}
function onCorrDrop(payload, path) {
  const id = payload?.item?.id || payload?.id
  if (!id || !path) return
  if (corrStore.moveTable(id, path)) Message.success(`已移动到「${path.split('/').join(' / ')}」`)
}
function openCorrGroupModal(mode, arg) {
  corrGroupModal.mode = mode
  if (mode === 'rename') {
    corrGroupModal.old = arg || ''
    corrGroupModal.parent = ''
    corrGroupModal.name = (arg || '').split('/').pop() || ''
  } else {
    corrGroupModal.old = ''
    corrGroupModal.parent = arg || corrSelectedDir.value || ''
    corrGroupModal.name = ''
  }
  corrGroupModal.visible = true
}
function confirmCorrGroupModal() {
  const n = corrGroupModal.name.trim()
  if (!n) return Message.warning('请输入目录名称')
  if (corrGroupModal.mode === 'add') {
    if (!corrStore.addGroup(n, corrGroupModal.parent)) return Message.warning('目录已存在')
    corrSelectedDir.value = corrGroupModal.parent ? `${corrGroupModal.parent}/${n}` : n
    Message.success('目录已添加')
  } else {
    if (!corrStore.renameGroup(corrGroupModal.old, n)) return Message.warning('目录已存在')
    Message.success('已重命名')
  }
  corrGroupModal.visible = false
}
function delCorrGroup(path) {
  corrStore.removeGroup(path)
  if (corrSelectedDir.value === path || corrSelectedDir.value.startsWith(path + '/')) corrSelectedDir.value = ''
  if (!activeCorr.value) corrActiveId.value = ''
  Message.success('目录及其表格已删除')
}

const activeCorr = computed(() => corrStore.get(corrActiveId.value))
watch(activeCorr, (t) => {
  if (t) corrNameInput.value = t.name
}, { immediate: true })
function corrLabelOf(t) {
  const first = corrAllProducts.value.find((p) => p.id === (t.products || [])[0])
  return first ? first.label : '—'
}
function corrContractOf(t) {
  if (t.contractMode === 'code' && t.contract) return t.contract
  const first = corrAllProducts.value.find((p) => p.id === (t.products || [])[0])
  return first && first.contracts.length ? first.contracts[0] : ''
}
function openCorrCreate() {
  corrEditingId.value = ''
  corrMode.value = 'form'
  const first = corrAllProducts.value.find((p) => p.id === ex.value.products[0]?.id) || corrAllProducts.value[0]
  corrForm.products = first ? [first.id] : []
  corrForm.target = corrTargetOptions.value[0] || ''
  corrForm.companies = [CORR_TOP20]
  corrForm.contractMode = 'main'
  corrForm.contract = first && first.contracts.length ? first.contracts[0] : ''
  corrForm.factor = 'long'
  corrForm.win1 = 20
  corrForm.lead1 = 0
  corrForm.win2 = 3
  corrForm.lead2 = 0
  corrForm.param = 0.7
}
function editCorrTable(id) {
  const t = corrStore.get(id)
  if (!t) return
  corrEditingId.value = id
  corrActiveId.value = id
  corrMode.value = 'form'
  corrForm.target = t.target || corrTargetOptions.value[0] || ''
  corrForm.products = [...(t.products || [])]
  corrForm.companies = t.companies && t.companies.length ? [...t.companies] : [CORR_TOP20]
  corrForm.contractMode = t.contractMode || 'main'
  corrForm.contract = t.contract || ''
  corrForm.factor = t.factor || 'long'
  corrForm.win1 = t.win1 || 20
  corrForm.lead1 = t.lead1 || 0
  corrForm.win2 = t.win2 || 3
  corrForm.lead2 = t.lead2 || 0
  corrForm.param = t.param != null ? t.param : 0.7
}
function onCorrProductChange(ids) {
  corrForm.products = Array.isArray(ids) ? ids : []
  if (!corrForm.products.length) {
    const first = corrAllProducts.value[0]
    if (first) corrForm.products = [first.id]
  }
  const valid = corrFormContracts.value
  if (!valid.includes(corrForm.contract)) corrForm.contract = valid[0] || ''
}
function onCorrCompanyChange(ids) {
  corrForm.companies = Array.isArray(ids) ? ids : []
  if (!corrForm.companies.length) corrForm.companies = [CORR_TOP20]
}
/* 相关性「持仓指标（因子）」为单选：品种单选 */
function onCorrProductChangeSingle(id) {
  corrForm.products = id ? [id] : []
  if (!corrForm.products.length) {
    const first = corrAllProducts.value[0]
    if (first) corrForm.products = [first.id]
  }
  const valid = corrFormContracts.value
  if (!valid.includes(corrForm.contract)) corrForm.contract = valid[0] || ''
}
function onCorrContractChange(v) {
  if (v === 'main') {
    corrForm.contractMode = 'main'
    return
  }
  corrForm.contractMode = 'code'
  corrForm.contract = v
}
function confirmCorrForm() {
  if (!corrForm.products.length) return Message.warning('请选择品种')
  const first = corrAllProducts.value.find((p) => p.id === corrForm.products[0])
  const payload = {
    target: corrForm.target || corrTargetOptions.value[0] || '',
    products: [...corrForm.products],
    companies: corrForm.companies.includes(CORR_TOP20) ? [] : corrForm.companies,
    contractMode: corrForm.contractMode,
    contract: corrForm.contractMode === 'code' ? corrForm.contract : '',
    factor: corrForm.factor,
    win1: Number(corrForm.win1) || 20,
    lead1: Number(corrForm.lead1) || 0,
    win2: Number(corrForm.win2) || 3,
    lead2: Number(corrForm.lead2) || 0,
    param: clampParam(corrForm.param),
  }
  if (corrEditingId.value) {
    corrStore.update(corrEditingId.value, payload)
    Message.success('表格已更新')
    corrMode.value = 'tree'
    return
  }
  const name = (first ? first.label : '') + '相关性'
  const t = corrStore.add({ ...payload, name, group: first ? first.label : '未分组' })
  corrActiveId.value = t.id
  corrMode.value = 'tree'
  Message.success('表格已创建')
}
function cancelCorrForm() {
  corrMode.value = 'tree'
  corrEditingId.value = ''
}
function openCorrDetail(id) {
  corrActiveId.value = id
  const t = corrStore.get(id)
  if (t) corrNameInput.value = t.name
}
function backCorrList() {
  corrActiveId.value = ''
}
function saveCorrDetail() {
  if (!activeCorr.value) return
  const name = corrNameInput.value.trim()
  if (!name) return Message.warning('请输入表格名称')
  corrStore.update(activeCorr.value.id, { name })
  Message.success('已保存')
}
function refreshCorrTable(id) {
  corrStore.touch(id)
  Message.success('已刷新')
}
function dupCorrTable(id) {
  const t = corrStore.duplicate(id)
  if (t) Message.success('已另存为「' + t.name + '」')
}
function delCorrTable(id) {
  corrStore.remove(id)
  if (corrActiveId.value === id) corrActiveId.value = ''
  Message.success('已删除')
}

/* 相关性计算 */
const CORR_LAGS = ['最新', '-1D', '-2D', '-3D', '-4D', '-5D', '-6D', '-7D', '-8D', '-9D', '-10D']
function corrPosSeries(contract, factor) {
  const valOf = (r) => (factor === 'short' ? r.short : factor === 'netLong' ? r.long - r.short : factor === 'netShort' ? r.short - r.long : r.long)
  return store.dates.map((date) => {
    const raw = store.data.contracts[contract] && store.data.contracts[contract][date]
    if (!raw || !raw.length) return null
    const top = [...raw].sort((a, b) => valOf(b) - valOf(a)).slice(0, 20)
    return top.reduce((s, r) => s + valOf(r), 0)
  })
}
function corrTargetSeries(title) {
  const card = indStore.cards.find((c) => c.title === title)
  const ds = store.dates
  if (card && Array.isArray(card.points) && card.points.length) {
    const map = new Map(card.points.map((p) => [String(p.date), p.value]))
    const out = ds.map((d) => (map.has(d) ? map.get(d) : null))
    let last = null
    for (let i = 0; i < out.length; i++) {
      if (out[i] == null) out[i] = last
      else last = out[i]
    }
    if (out.some((v) => v != null)) return out
  }
  return rndSeries(hashStr(title || 'corr'), ds.length, 100, 6)
}
function pearson(a, b) {
  const xs = []
  const ys = []
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (a[i] == null || b[i] == null) continue
    xs.push(a[i])
    ys.push(b[i])
  }
  if (xs.length < 2) return 0
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length
  const my = ys.reduce((s, v) => s + v, 0) / ys.length
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < xs.length; i++) {
    const a1 = xs[i] - mx
    const b1 = ys[i] - my
    num += a1 * b1
    dx += a1 * a1
    dy += b1 * b1
  }
  if (!dx || !dy) return 0
  return Math.round((num / Math.sqrt(dx * dy)) * 1000) / 1000
}
function corrAt(pos, tgt, win, lag, lead) {
  const n = store.dates.length
  const endPos = n - 1 - lag
  const startPos = endPos - win + 1
  if (startPos < 0) return 0
  const endT = Math.min(n - 1, endPos + (Number(lead) || 0))
  const startT = endT - win + 1
  if (startT < 0) return 0
  return pearson(pos.slice(startPos, endPos + 1), tgt.slice(startT, endT + 1))
}
const corrRows = computed(() => {
  const t = activeCorr.value
  if (!t) return []
  const contract = corrContractOf(t)
  if (!contract) return []
  const pos = corrPosSeries(contract, t.factor || 'long')
  const tgt = corrTargetSeries(t.target || corrTargetOptions.value[0])
  const row = { label: `${corrLabelOf(t)}TOP20席位${modeLabelOf(t.factor)}` }
  for (let i = 0; i <= 10; i++) {
    row['w1_' + i] = corrAt(pos, tgt, t.win1, i, t.lead1)
    row['w2_' + i] = corrAt(pos, tgt, t.win2, i, t.lead2)
  }
  return [row]
})
const corrATableColumns = computed(() => {
  const t = activeCorr.value
  if (!t) return []
  const col = (key, title) => ({
    title,
    dataIndex: key,
    align: 'right',
    sortable: { sortDirections: ['descend', 'ascend'], sorter: (a, b) => (a[key] || 0) - (b[key] || 0) },
    render: ({ record }) => Number(record[key] || 0).toFixed(3),
  })
  return [
    { title: '与标的指标的相关性矩阵', children: [{ title: '合约持仓', dataIndex: 'label', align: 'left' }] },
    { title: `滚动相关性(${t.win1}交易日)`, children: CORR_LAGS.map((lab, i) => col('w1_' + i, lab)) },
    { title: `滚动相关性(${t.win2}交易日)`, children: CORR_LAGS.map((lab, i) => col('w2_' + i, lab)) },
  ]
})

/* ---------- 日期范围 ---------- */
function setQuick(key) {
  quickKey.value = key
  pbRange.value = null
}
const pbRangeArr = computed({
  get: () => (quickKey.value === 'custom' && pbRange.value ? [pbRange.value.start, pbRange.value.end] : undefined),
  set: (v) => {
    if (v && v[0] && v[1]) {
      pbRange.value = { start: v[0], end: v[1] }
      quickKey.value = 'custom'
    }
  },
})
const rangeSpan = computed(() => {
  if (quickKey.value === 'custom' && pbRange.value) return pbRange.value
  const q = BUILD_QUICK.find((x) => x.key === quickKey.value) || BUILD_QUICK[1]
  const ds = store.dates
  const end = ds[ds.length - 1]
  const start = ds[Math.max(0, ds.length - q.n)]
  return { start, end }
})

/* ---------- 估算参数 / Y 轴范围（写回 store）---------- */
function clampParam(v) {
  const n = Number(v)
  if (Number.isNaN(n)) return 0
  return Math.min(1, Math.max(0, Math.round(n * 100) / 100))
}
const yMaxModel = computed({
  get: () => (activeBuild.value && activeBuild.value.yMax != null ? activeBuild.value.yMax : undefined),
  set: (v) => {
    if (activeBuild.value) buildupStore.update(activeBuild.value.id, { yMax: v == null || v === '' ? null : Number(v) })
  },
})
const yMinModel = computed({
  get: () => (activeBuild.value && activeBuild.value.yMin != null ? activeBuild.value.yMin : undefined),
  set: (v) => {
    if (activeBuild.value) buildupStore.update(activeBuild.value.id, { yMin: v == null || v === '' ? null : Number(v) })
  },
})

/* ---------- 建仓序列：在榜取实际值，不在榜按 估算参数 × 末位仓位 估算；多合约加总）---------- */
const buildSeries = computed(() => {
  const c = activeBuild.value
  if (!c) return { tidy: [], estRows: [] }
  const ds = store.dates
  const iStart = ds.indexOf(rangeSpan.value.start)
  const iEnd = ds.indexOf(rangeSpan.value.end)
  if (iStart < 0 || iEnd < 0 || iEnd < iStart) return { tidy: [], estRows: [] }
  const slice = ds.slice(iStart, iEnd + 1)
  const contracts = c.contracts.length ? c.contracts : [c.contract]
  const tidy = []
  const estRows = []
  for (const date of slice) {
    /* 每个合约的榜单与末位仓位（估算基准） */
    const per = contracts.map((ct) => {
      const rows = store.getRanking(ct, date, c.mode)
      return { rows, last: rows.length ? rows[rows.length - 1].value : null }
    })
    for (const co of c.companies) {
      let sum = 0
      let any = false
      let estAny = false
      for (const { rows, last } of per) {
        const hit = rows.find((r) => r.member === co)
        if (hit) {
          sum += hit.value
          any = true
        } else if (last != null) {
          /* 不在榜：估算 = 参数 × 该合约榜单末位持仓 */
          sum += c.param * last
          any = true
          estAny = true
        }
      }
      if (any) {
        const v = Math.round(sum)
        tidy.push({ date, company: co, value: v, est: estAny })
        if (estAny) estRows.push({ date, company: co, value: v })
      } else {
        tidy.push({ date, company: co, value: null, est: false })
      }
    }
  }
  return { tidy, estRows }
})

const buildSpec = computed(() => {
  const c = activeBuild.value
  if (!c) return null
  const { tidy, estRows } = buildSeries.value
  if (!tidy.length) return null
  const scale = { color: { domain: c.companies, range: BUILD_PALETTE } }
  if (c.yMin != null && c.yMax != null && Number(c.yMax) > Number(c.yMin)) {
    scale.y = { domain: [Number(c.yMin), Number(c.yMax)] }
  }
  const children = [
    { type: 'line', encode: { x: 'date', y: 'value', color: 'company' }, style: { lineWidth: 1.6 } },
  ]
  if (estRows.length) {
    /* 估算点以空心圆标记 */
    children.push({
      type: 'point',
      data: estRows,
      encode: { x: 'date', y: 'value', color: 'company' },
      size: 3.2,
      style: { fill: '#fff', lineWidth: 1.2 },
    })
  }
  return {
    type: 'view',
    data: tidy,
    scale,
    legend: { color: { position: 'top', itemMarkerSize: 8 } },
    axis: { x: { title: false, labelAutoHide: true, labelAutoRotate: false }, y: { title: false } },
    children,
  }
})

function refreshBuild(id) {
  const id2 = id || activeBuildId.value
  if (id2) {
    buildupStore.touch(id2)
    Message.success('已刷新')
  }
}
function saveBuild() {
  if (activeBuild.value) {
    buildupStore.touch(activeBuild.value.id)
    Message.success('已保存')
  }
}
function dupBuild(id) {
  const c = buildupStore.duplicate(id)
  if (c) Message.success('已另存为「' + c.name + '」')
}
function delBuild(id) {
  buildupStore.remove(id)
  if (activeBuildId.value === id) activeBuildId.value = ''
  Message.success('已删除')
}
</script>

<template>
  <section class="dh-page pa-page">
    <!-- 页头：模块标签 + 页签 + 全局日期/口径（占据原空白带，交代「在看什么、数据到哪天」） -->
    <header class="pa-head">
      <div class="pa-head-l">
        <h1 class="pa-title">持仓分析</h1>
        <nav class="pa-tabs">
          <a-radio-group
            :model-value="activeTab"
            type="button"
            size="small"
            @change="setTab"
          >
            <a-radio v-for="t in POSITION_TABS" :key="t.key" :value="t.key">{{ t.label }}</a-radio>
          </a-radio-group>
        </nav>
      </div>

      <div class="pa-head-r">
        <span v-if="!isLatestDate" class="pa-upd stale">历史交易日</span>
        <div class="pa-date">
          <a-button size="mini" :disabled="!canPrevDay" @click="stepDate(-1)">
            <template #icon><icon-left /></template>
          </a-button>
          <div class="pa-dp">
            <a-date-picker
              :model-value="dateStr"
              size="mini"
              :allow-clear="false"
              @change="onDateChange"
            />
          </div>
          <a-button size="mini" :disabled="!canNextDay" @click="stepDate(1)">
            <template #icon><icon-right /></template>
          </a-button>
        </div>
        <a-popover position="br" trigger="click">
          <a-button size="mini">
            <template #icon><icon-info-circle /></template>
            <template #default>口径</template>
          </a-button>
          <template #content>
            <div class="pa-pop">
              <b>数据口径说明</b>
              <p>统计范围为各交易所每日公布的会员持仓排行榜（前 20 名会员），仅反映上榜会员的持仓方向，不代表全市场净方向。</p>
              <p>「较昨日」为与上一交易日同一口径的差值；数据于交易日 17:20 后更新。</p>
            </div>
          </template>
        </a-popover>
      </div>
    </header>

    <div v-if="activeTab === 'rank'" class="pa-body">
      <!-- 左栏：筛选 rail（仅「持仓排名」口径需要） -->
      <a-card v-if="activeTab === 'rank'" class="pa-rail" :bordered="true">
        <a-input-search
          v-model="search"
          placeholder="搜索品种 / 合约"
          allow-clear
          size="small"
          class="pa-search"
        />

        <div class="pa-rail-sub">交易所</div>
        <a-radio-group v-model="exId" type="button" size="small" class="pa-exseg">
          <a-radio v-for="e in EXCHANGES" :key="e.id" :value="e.id">{{ e.name }}</a-radio>
        </a-radio-group>

        <div class="pa-rail-meta">
          <span>{{ ex.products.length }} 个品种 · {{ contractCount }} 个合约</span>
          <label class="pa-hist" title="开启后显示已交割的历史合约（虚线标识）">
            <span>历史合约</span>
            <a-switch v-model="showHistory" size="small" />
          </label>
        </div>

        <div class="pa-groups">
          <div v-for="g in groups" :key="g.id" class="pa-group">
            <div class="pa-gname">
              <span>{{ g.label }}</span>
              <em v-if="g.label !== g.name">{{ g.name }}</em>
            </div>
            <div class="pa-glist">
              <button
                v-for="c in g.list"
                :key="c"
                class="pa-contract"
                :class="{ on: contract === c, hist: histSet.has(c) }"
                :title="contractCn(c) + '（' + c + '）'"
                @click="contract = c"
              >{{ c }}</button>
            </div>
          </div>
          <div v-if="!groups.length" class="pa-nogroup">
            未找到「{{ search }}」<br>试试品种中文名或合约代码
          </div>
        </div>
      </a-card>

      <!-- 右栏：概览 + 排名 -->
      <main class="pa-main">
          <a-card v-if="totals" class="pa-sum" :bordered="true">
            <template #title>持仓概览</template>
            <template #extra>
              <a-radio-group v-model="mode" type="button" size="mini" class="pa-seg">
                <a-radio v-for="m in POS_MODES" :key="m.key" :value="m.key">{{ m.label }}</a-radio>
              </a-radio-group>
            </template>

            <div class="pa-kpis">
              <button
                v-for="m in POS_MODES"
                :key="m.key"
                class="pa-kpi"
                :class="{ on: mode === m.key }"
                :style="{ '--accent': m.base }"
                :title="'查看「' + m.label + '」排名口径'"
                @click="mode = m.key"
              >
                <span class="k-t">
                  {{ m.label }}
                  <i v-if="hasCount(m.key)" class="k-c">{{ totals[m.key].count }}个</i>
                </span>
                <span class="k-v">{{ fmt(totals[m.key].total) }}<small>手</small></span>
                <svg
                  v-if="spark[m.key] && spark[m.key].length > 1"
                  class="k-spark"
                  :viewBox="`0 0 ${SPARK_W} ${SPARK_H}`"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    :d="sparkPath(spark[m.key])"
                    fill="none"
                    :stroke="SPARK_TONE[m.key]"
                    stroke-width="1.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <span class="k-d" :class="totals[m.key].chg >= 0 ? 'up' : 'down'">
                  <icon-up v-if="totals[m.key].chg >= 0" :size="11" />
                  <icon-down v-else :size="11" />
                  {{ fmtChg(totals[m.key].chg) }}
                </span>
              </button>
            </div>

            <div v-if="balance" class="pa-split">
              <div class="pa-split-bar">
                <span class="s-l" :style="{ width: balance.lPct + '%' }" />
                <span class="s-s" :style="{ width: balance.sPct + '%' }" />
              </div>
              <div class="pa-split-cap">
                <span>多单 {{ balance.lPct.toFixed(1) }}%</span>
                <span class="mid" :title="balance.text">{{ balance.text }}</span>
                <span>空单 {{ balance.sPct.toFixed(1) }}%</span>
              </div>
            </div>
          </a-card>

          <a-card class="pa-card" :bordered="true">
            <template #title>
              <div class="pa-cid">
                <b>{{ contractCn(contract) }}</b>
                <i class="pa-code">{{ contract }}</i>
              </div>
            </template>
            <template #extra>
              <div class="pa-nav">
                <span class="pa-pos">{{ contractPos }}</span>
                <a-button size="mini" :disabled="!canPrevContract" @click="stepContract(-1)">
                  <template #icon><icon-left /></template>
                </a-button>
                <a-button size="mini" :disabled="!canNextContract" @click="stepContract(1)">
                  <template #icon><icon-right /></template>
                </a-button>
              </div>
            </template>

            <div class="pa-card-sub">
              <span class="pa-cur">{{ modeMeta.unit }}</span>
              <span class="pa-dot" />
              <span>上榜 {{ ranking.length }} 家会员</span>
              <span class="pa-dot" />
              <span>按持仓量降序</span>
            </div>

            <div class="pa-chart">
              <RankChart :rows="ranking" :mode-key="mode" />
            </div>
          </a-card>
      </main>
    </div>

    <!-- 建仓过程：目录树 + 图表/管理列表 + 估算参数 -->
    <div v-else-if="activeTab === 'building'" class="pa-body pb-page">
      <!-- 左栏：目录面板（与图库目录对齐） -->
      <aside v-if="railMode === 'tree'" class="dir-panel" :class="{ collapsed: railCollapsed }">
        <div class="dir-head">
          <h2>目录</h2>
          <label class="only-mine"><a-checkbox v-model="pbFilters.onlyMine">只看我的</a-checkbox></label>
        </div>
        <FilterBar v-model="pbFilters" placeholder="请输入图表名称/ID" :show-mine="false" :show-date="false" />
        <DirTree
          :tree="pbDirs"
          :current="selectedBuildDir"
          :current-item="activeBuild ? activeBuild.name : ''"
          :count-of="pbCountOf"
          :leaves-of="pbLeavesOf"
          :leaf-title="(c) => c.name"
          :leaf-key="(c) => c.id"
          :movable-items="true"
          :expand-all="true"
          @select="onTreeSelect"
          @select-item="onTreeSelectItem"
          @add="(p) => openGroupModal('add', p)"
          @edit="(p) => openGroupModal('rename', p)"
          @remove="delGroup"
          @remove-item="(item) => delBuild(item.id)"
          @edit-item="(item) => editBuild(item.id)"
          @move="onMoveChart"
          @drop-item="onDropChart"
        />
        <div class="dir-foot">
          <a-button long @click="openGroupModal('add')">
            <template #icon><Icon name="plus-14" :size="13" /></template>
            {{ selectedBuildDir ? '添加子目录' : '添加一级目录' }}
          </a-button>
          <a-button long @click="openBatchMove">
            <template #icon><Icon name="swap" :size="13" /></template>
            批量移动图表
          </a-button>
        </div>
        <button class="dir-toggle" title="收起 / 展开目录" @click="railCollapsed = !railCollapsed">
          <Icon name="chevrons-left" :size="12" />
        </button>
      </aside>

      <!-- 左栏：新建 / 编辑图表表单 -->
      <a-card v-else class="pb-rail pb-rail-create" :bordered="true">
        <div class="pb-f-title">{{ editingId ? '编辑图表' : '添加图表' }}</div>
        <div class="pb-f-label">交易所</div>
        <a-radio-group
          :model-value="creating.exId"
          type="button"
          size="small"
          class="pb-pills"
          @change="onCreateEx"
        >
          <a-radio v-for="e in EXCHANGES" :key="e.id" :value="e.id">{{ e.name }}</a-radio>
        </a-radio-group>
        <div class="pb-f-label">品种</div>
        <a-select
          :model-value="creating.products"
          multiple
          :max-tag-count="2"
          size="small"
          placeholder="请选择品种（可多选）"
          @change="onCreateProduct"
        >
          <a-option v-for="p in createProducts" :key="p.id" :value="p.id">{{ p.label }}</a-option>
        </a-select>
        <div class="pb-f-label pb-f-label-tip">
          合约
          <a-tooltip content="说明：多选项计算合约加总持仓">
            <icon-info-circle />
          </a-tooltip>
        </div>
        <a-select
          v-model="creating.contracts"
          multiple
          searchable
          placeholder="多选 · 加总持仓"
          size="small"
          allow-clear
        >
          <a-option v-for="c in createContracts" :key="c" :value="c">{{ c }}</a-option>
        </a-select>
        <div class="pb-f-label">口径</div>
        <a-select v-model="creating.mode" size="small">
          <a-option v-for="m in POS_MODES" :key="m.key" :value="m.key">{{ m.label }}</a-option>
        </a-select>
        <div class="pb-f-label">期货公司</div>
        <a-select
          :model-value="creating.companies"
          multiple
          :max-tag-count="2"
          placeholder="期货公司（TOP20）"
          size="small"
          allow-search
          allow-clear
          @change="onCreateCompanies"
        >
          <a-option :value="TOP20_KEY">TOP20</a-option>
          <a-option v-for="m in MEMBERS" :key="m" :value="m">{{ m }}</a-option>
        </a-select>
        <div class="pb-f-inline">
          <span class="pb-f-label pb-f-label-tip">
            估算参数
            <EstimateTip />
          </span>
          <a-input-number v-model="creating.param" :min="0" :max="1" :step="0.1" size="small" style="flex: 1" />
        </div>
        <div class="pb-f-btns">
          <a-button @click="cancelCreate">取消</a-button>
          <a-button type="primary" @click="confirmCreate">确定</a-button>
        </div>
      </a-card>

      <!-- 右栏：图表视图 / 管理列表 -->
      <main class="pb-main">
        <template v-if="activeBuild">
          <div class="pb-toolbar">
            <div class="pb-range">
              <a-radio-group v-model="quickKey" type="button" size="small" @change="setQuick">
                <a-radio v-for="q in BUILD_QUICK" :key="q.key" :value="q.key">{{ q.label }}</a-radio>
              </a-radio-group>
              <a-range-picker v-model="pbRangeArr" size="mini" style="width: 220px" />
            </div>
          </div>

          <a-card class="pb-chart-card" :bordered="true">
            <template #title>{{ activeBuild.name }}</template>
            <template #extra>
              <div class="pb-ops">
                <a-link @click="backToList">返回列表</a-link>
                <a-link @click="editBuild(activeBuild.id)">编辑</a-link>
                <a-link @click="refreshBuild()">刷新</a-link>
                <a-link @click="saveBuild">保存</a-link>
              </div>
            </template>
            <div class="pb-chart-row">
              <div class="pb-ymax">
                <a-input-number v-model="yMaxModel" size="mini" placeholder="最大" hide-button />
                <a-input-number v-model="yMinModel" size="mini" placeholder="最小" hide-button />
              </div>
              <div class="pb-chart-fill">
                <DataChart v-if="buildSpec" :spec="buildSpec" fill />
                <div v-else class="pb-nochart">该区间暂无数据</div>
              </div>
            </div>
            <div class="pb-foot">
              <span>来源 持仓分析，中辉期货有限公司</span>
              <span class="pb-foot-mid">空心点 = 估算值（估算参数 × 榜单末位持仓）</span>
              <span>作者 {{ activeBuild.creator }}</span>
            </div>
          </a-card>
        </template>

        <!-- 管理列表（与图库清单视图同款）-->
        <section v-else class="gallery-panel pb-listpanel">
          <div class="gal-head">
            <span class="gal-count">共 <b>{{ buildList.length }}</b> 个图表</span>
            <div class="gi-search">
              <Icon name="search" :size="13" />
              <input v-model="pbFilters.kw" placeholder="搜索图表名称" autocomplete="off">
            </div>
            <button type="button" class="btn-add-chart" @click="openCreate()">
              <Icon name="plus" :size="14" />
              添加图表
            </button>
          </div>
          <div class="gal-scroll">
            <div v-if="!buildList.length" class="gal-empty">暂无匹配图表<br>可调整目录或搜索条件</div>
            <div v-else class="gal-grid as-list">
              <a-table :data="buildList" :pagination="false" size="small" :scroll="{ x: 'max-content' }" class="vf-table">
                <template #columns>
                  <a-table-column title="图表名称" :width="220" fixed="left">
                    <template #cell="{ record }">
                      <a-link @click="openBuild(record)">{{ record.name }}</a-link>
                    </template>
                  </a-table-column>
                  <a-table-column title="图表ID" data-index="id" :width="110" />
                  <a-table-column title="口径" :width="90">
                    <template #cell="{ record }">{{ modeLabelOf(record.mode) }}</template>
                  </a-table-column>
                  <a-table-column title="合约" :width="150">
                    <template #cell="{ record }">{{ (record.contracts || []).join('、') || '—' }}</template>
                  </a-table-column>
                  <a-table-column title="所属目录" data-index="group" :width="140" />
                  <a-table-column title="创建人" data-index="creator" :width="100" />
                  <a-table-column title="创建时间" data-index="createdAt" :width="190" />
                  <a-table-column title="更新时间" data-index="updatedAt" :width="190" />
                  <a-table-column title="操作" :width="230" fixed="right">
                    <template #cell="{ record }">
                      <div class="lt-ops">
                        <a-link @click="openBuild(record)">打开</a-link>
                        <a-link @click="editBuild(record.id)">编辑</a-link>
                        <a-link @click="dupBuild(record.id)">另存为</a-link>
                        <a-popconfirm type="warning" content="确认删除该图表？" @ok="delBuild(record.id)">
                          <a-link status="danger">删除</a-link>
                        </a-popconfirm>
                      </div>
                    </template>
                  </a-table-column>
                </template>
              </a-table>
            </div>
          </div>
        </section>
      </main>

      <!-- 目录 添加 / 重命名-->
      <a-modal
        v-model:visible="groupModal.visible"
        :title="groupModal.mode === 'rename' ? '重命名目录' : (groupModal.parent ? '添加子目录' : '添加一级目录')"
        :width="360"
        @before-ok="confirmGroupModal"
      >
        <a-input v-model="groupModal.name" placeholder="请输入目录名称" allow-clear @keydown.enter="confirmGroupModal" />
      </a-modal>

      <!-- 批量移动图表 -->
      <a-modal
        v-model:visible="batch.visible"
        :title="batch.mode === 'move' ? '移动图表' : '批量移动图表'"
        :width="440"
        @before-ok="confirmBatchMove"
      >
        <div class="pb-f-label">选择图表</div>
        <a-checkbox-group v-model="batch.ids" class="pb-batch-list">
          <a-checkbox v-for="c in buildupStore.charts" :key="c.id" :value="c.id">{{ c.name }}</a-checkbox>
        </a-checkbox-group>
        <div class="pb-f-label">目标目录</div>
        <a-select v-model="batch.target" size="small" placeholder="请选择目录">
          <a-option v-for="g in buildupStore.groups" :key="g" :value="g">{{ g }}</a-option>
        </a-select>
      </a-modal>
    </div>

    <!-- 多空分析 -->
    <div v-else-if="activeTab === 'longshort'" class="pa-body pb-page">
      <!-- 左栏：目录 / 表单 -->
      <aside v-if="lsMode === 'tree'" class="dir-panel" :class="{ collapsed: lsCollapsed }">
        <div class="dir-head">
          <h2>目录</h2>
          <label class="only-mine"><a-checkbox v-model="lsFilters.onlyMine">只看我的</a-checkbox></label>
        </div>
        <FilterBar v-model="lsFilters" placeholder="请输入内容" :show-mine="false" :show-date="false" />
        <DirTree
          :tree="lsDirs"
          :current="lsSelectedDir"
          :current-item="activeLs ? activeLs.name : ''"
          :count-of="lsCountOf"
          :leaves-of="lsTreeLeaves"
          :leaf-title="(t) => t.name"
          :leaf-key="(t) => t.id"
          :movable-items="true"
          :expand-all="true"
          @select="onLsSelect"
          @select-item="onLsSelectItem"
          @add="(p) => openLsGroupModal('add', p)"
          @edit="(p) => openLsGroupModal('rename', p)"
          @remove="delLsGroup"
          @remove-item="(t) => delLsTable(t.id)"
          @edit-item="(t) => editLsTable(t.id)"
          @drop-item="onLsDrop"
        />
        <div class="dir-foot">
          <a-button long @click="openLsGroupModal('add')">
            <template #icon><Icon name="plus-14" :size="13" /></template>
            {{ lsSelectedDir ? '添加子目录' : '添加一级目录' }}
          </a-button>
          <a-button type="primary" long @click="openLsCreate">
            <template #icon><Icon name="plus-14" :size="13" /></template>
            添加表格
          </a-button>
        </div>
        <button class="dir-toggle" title="收起 / 展开目录" @click="lsCollapsed = !lsCollapsed">
          <Icon name="chevrons-left" :size="12" />
        </button>
      </aside>

      <!-- 左栏：新建 / 编辑表格表单 -->
      <a-card v-else class="pb-rail pb-rail-create ls-form" :bordered="true">
        <div class="pb-f-title">{{ lsEditingId ? '编辑表格' : '添加表格' }}</div>
        <div class="ls-frow">
          <span class="pb-f-label">期货公司</span>
          <a-select :model-value="lsForm.companies" multiple :max-tag-count="2" size="small" allow-search allow-clear @change="onLsCompanyChange">
            <a-option :value="LS_TOP20">TOP20</a-option>
            <a-option v-for="m in MEMBERS" :key="m" :value="m">{{ m }}</a-option>
          </a-select>
        </div>
        <div class="ls-frow">
          <span class="pb-f-label">品种</span>
          <a-select :model-value="lsForm.products" multiple :max-tag-count="2" size="small" allow-clear @change="onLsProductChange">
            <a-option v-for="p in lsAllProducts" :key="p.id" :value="p.id">{{ p.label }}</a-option>
          </a-select>
        </div>
        <div class="ls-frow">
          <span class="pb-f-label">合约</span>
          <a-select :model-value="lsForm.contractMode === 'main' ? 'main' : lsForm.contract" size="small" @change="onLsContractChange">
            <a-option value="main">主力合约</a-option>
            <a-option v-for="c in lsFormContracts" :key="c" :value="c">{{ contractCn(c) }}（{{ c }}）</a-option>
          </a-select>
        </div>
        <div class="pb-f-label ls-fgroup">日期选择</div>
        <a-radio-group v-model="lsForm.dateMode" size="small" class="ls-date-mode">
          <a-radio value="latest">最新日期</a-radio>
          <a-radio value="fixed">固定</a-radio>
        </a-radio-group>
        <div v-if="lsForm.dateMode === 'latest'" class="ls-frow">
          <span class="pb-f-label">期数前移</span>
          <div class="ls-shift">
            <a-input-number v-model="lsForm.dateShift" :min="0" :max="39" size="small" style="width: 80px" />
            <span class="pb-f-label">期</span>
          </div>
        </div>
        <div v-else class="ls-frow">
          <span class="pb-f-label">固定日期</span>
          <a-date-picker v-model="lsForm.fixedDate" size="small" value-format="YYYY-MM-DD" style="width: 100%" />
        </div>
        <div class="ls-frow">
          <span class="pb-f-label pb-f-label-tip">
            估算参数
            <EstimateTip />
          </span>
          <a-input-number v-model="lsForm.param" :min="0" :max="1" :step="0.1" size="small" style="width: 100%" />
        </div>
        <div class="pb-f-btns">
          <a-button @click="cancelLsForm">取消</a-button>
          <a-button type="primary" @click="confirmLsForm">确定</a-button>
        </div>
      </a-card>

      <!-- 右栏：列表 / 详情 -->
      <main class="pb-main">
        <section v-if="!activeLs" class="gallery-panel pb-listpanel">
          <div class="gal-head">
            <span class="gal-count">共 <b>{{ lsTables.length }}</b> 张表格</span>
            <div class="gi-search">
              <Icon name="search" :size="13" />
              <input v-model="lsFilters.kw" placeholder="搜索表格名称" autocomplete="off">
            </div>
          </div>
          <div class="gal-scroll">
            <div v-if="!lsTables.length" class="gal-empty">暂无表格<br>点击左侧「添加表格」创建</div>
            <div v-else class="gal-grid as-list">
              <a-table :data="lsTables" :pagination="false" size="small" :scroll="{ x: 'max-content' }" class="vf-table">
                <template #columns>
                  <a-table-column title="名称" :width="300" fixed="left">
                    <template #cell="{ record }">
                      <a-link @click="openLsDetail(record.id)">{{ record.name }}</a-link>
                    </template>
                  </a-table-column>
                  <a-table-column title="创建人" data-index="creator" :width="100" />
                  <a-table-column title="创建时间" data-index="createdAt" :width="190" />
                  <a-table-column title="更新时间" data-index="updatedAt" :width="190" />
                  <a-table-column title="操作" :width="230" fixed="right">
                    <template #cell="{ record }">
                      <div class="lt-ops">
                        <a-link @click="editLsTable(record.id)">编辑</a-link>
                        <a-link @click="refreshLsTable(record.id)">刷新</a-link>
                        <a-link @click="dupLsTable(record.id)">另存为</a-link>
                        <a-popconfirm type="warning" content="确认删除该表格？" @ok="delLsTable(record.id)">
                          <a-link status="danger">删除</a-link>
                        </a-popconfirm>
                      </div>
                    </template>
                  </a-table-column>
                </template>
              </a-table>
            </div>
          </div>
        </section>

        <template v-else>
          <div class="ls-toolbar">
            <a-input v-model="lsNameInput" size="small" class="ls-name-input" @press-enter="saveLsDetail" />
            <span class="ls-product-chip">{{ lsLabelOf(activeLs) }}</span>
            <span class="ls-saved-at">最近保存时间：{{ activeLs.updatedAt }}</span>
            <span class="ls-spacer" />
            <a-link @click="backLsList">返回列表</a-link>
            <a-button type="primary" size="small" @click="saveLsDetail">保存</a-button>
            <a-button type="primary" size="small" @click="openLsCols">
              <template #icon><icon-settings /></template>
              设置
            </a-button>
          </div>
          <section class="gallery-panel pb-listpanel ls-detail-panel">
            <div class="gal-scroll">
              <div v-if="!lsRows.length" class="gal-empty">暂无数据</div>
              <a-table
                v-else
                :data="lsRows"
                :columns="lsATableColumns"
                :pagination="false"
                size="small"
                :scroll="{ x: 'max-content' }"
                class="ls-atable vf-table"
              />
            </div>
          </section>
        </template>
      </main>

      <!-- 目录弹窗 -->
      <a-modal
        v-model:visible="lsGroupModal.visible"
        :title="lsGroupModal.mode === 'rename' ? '重命名目录' : (lsGroupModal.parent ? '添加子目录' : '添加一级目录')"
        :width="360"
        @before-ok="confirmLsGroupModal"
      >
        <a-input v-model="lsGroupModal.name" placeholder="请输入目录名称" allow-clear @keydown.enter="confirmLsGroupModal" />
      </a-modal>

      <!-- 自定义列 -->
      <a-modal v-model:visible="lsColsDlg.visible" title="自定义列" :width="420" @before-ok="applyLsCols">
        <div class="ls-col-list">
          <div
            v-for="(c, i) in lsColsDlg.list"
            :key="c.key"
            class="ls-col-row"
            draggable="true"
            @dragstart="lsDragIdx = i"
            @dragover.prevent
            @drop="onLsColDrop(i)"
          >
            <span class="ls-col-grip"><Icon name="drag-handle" :size="14" /></span>
            <a-checkbox :model-value="c.checked" :disabled="c.locked" @change="(v) => (lsColsDlg.list[i].checked = v)">{{ c.label }}</a-checkbox>
          </div>
        </div>
      </a-modal>
    </div>

    <!-- 相关性 -->
    <div v-else-if="activeTab === 'corr'" class="pa-body pb-page">
      <aside v-if="corrMode === 'tree'" class="dir-panel" :class="{ collapsed: corrCollapsed }">
        <div class="dir-head">
          <h2>目录</h2>
          <label class="only-mine"><a-checkbox v-model="corrFilters.onlyMine">只看我的</a-checkbox></label>
        </div>
        <FilterBar v-model="corrFilters" placeholder="请输入内容" :show-mine="false" :show-date="false" />
        <DirTree
          :tree="corrDirs"
          :current="corrSelectedDir"
          :current-item="activeCorr ? activeCorr.name : ''"
          :count-of="corrCountOf"
          :leaves-of="corrTreeLeaves"
          :leaf-title="(t) => t.name"
          :leaf-key="(t) => t.id"
          :movable-items="true"
          :expand-all="true"
          @select="onCorrSelect"
          @select-item="onCorrSelectItem"
          @add="(p) => openCorrGroupModal('add', p)"
          @edit="(p) => openCorrGroupModal('rename', p)"
          @remove="delCorrGroup"
          @remove-item="(t) => delCorrTable(t.id)"
          @edit-item="(t) => editCorrTable(t.id)"
          @drop-item="onCorrDrop"
        />
        <div class="dir-foot">
          <a-button long @click="openCorrGroupModal('add')">
            <template #icon><Icon name="plus-14" :size="13" /></template>
            {{ corrSelectedDir ? '添加子目录' : '添加一级目录' }}
          </a-button>
          <a-button type="primary" long @click="openCorrCreate">
            <template #icon><Icon name="plus-14" :size="13" /></template>
            添加表格
          </a-button>
        </div>
        <button class="dir-toggle" title="收起 / 展开目录" @click="corrCollapsed = !corrCollapsed">
          <Icon name="chevrons-left" :size="12" />
        </button>
      </aside>

      <a-card v-else class="pb-rail pb-rail-create ls-form" :bordered="true">
        <div class="pb-f-title">{{ corrEditingId ? '编辑表格' : '添加表格' }}</div>
        <div class="ls-frow">
          <span class="pb-f-label">标的指标</span>
          <a-select :model-value="corrForm.target" size="small" allow-clear @change="(v) => (corrForm.target = v)">
            <a-option v-for="t in corrTargetOptions" :key="t" :value="t">{{ t }}</a-option>
          </a-select>
        </div>
        <div class="corr-factor-title">* 持仓指标（因子）</div>
        <div class="ls-frow">
          <span class="pb-f-label">品种</span>
          <a-select :model-value="corrForm.products[0]" size="small" allow-clear @change="onCorrProductChangeSingle">
            <a-option v-for="p in corrAllProducts" :key="p.id" :value="p.id">{{ p.label }}</a-option>
          </a-select>
        </div>
        <div class="ls-frow">
          <span class="pb-f-label">期货公司</span>
          <a-select :model-value="corrForm.companies" multiple :max-tag-count="2" size="small" allow-search allow-clear @change="onCorrCompanyChange">
            <a-option :value="CORR_TOP20">TOP20</a-option>
            <a-option v-for="m in MEMBERS" :key="m" :value="m">{{ m }}</a-option>
          </a-select>
        </div>
        <div class="ls-frow corr-two">
          <a-select
            :model-value="corrForm.contractMode === 'main' ? 'main' : corrForm.contract"
            size="small"
            :trigger-props="{ autoFitPopupWidth: false, autoFitPopupMinWidth: false }"
            @change="onCorrContractChange"
          >
            <a-option value="main">主力合约</a-option>
            <a-option v-for="c in corrFormContracts" :key="c" :value="c">{{ contractCn(c) }}（{{ c }}）</a-option>
          </a-select>
          <a-select :model-value="corrForm.factor" size="small" @change="(v) => (corrForm.factor = v)">
            <a-option v-for="m in POS_MODES" :key="m.key" :value="m.key">{{ m.label }}</a-option>
          </a-select>
        </div>
        <div class="corr-sec">滚动相关性1</div>
        <div class="ls-frow">
          <span class="pb-f-label">计算窗口</span>
          <div class="ls-shift">
            <a-input-number v-model="corrForm.win1" :min="2" :max="200" size="small" style="width: 90px" />
            <span class="pb-f-label">交易日</span>
          </div>
        </div>
        <div class="ls-frow">
          <span class="pb-f-label">B领先A</span>
          <div class="ls-shift">
            <a-input-number v-model="corrForm.lead1" :min="0" :max="200" size="small" style="width: 90px" />
            <span class="pb-f-label">交易日</span>
          </div>
        </div>
        <div class="corr-sec">滚动相关性2</div>
        <div class="ls-frow">
          <span class="pb-f-label">计算窗口</span>
          <div class="ls-shift">
            <a-input-number v-model="corrForm.win2" :min="2" :max="200" size="small" style="width: 90px" />
            <span class="pb-f-label">交易日</span>
          </div>
        </div>
        <div class="ls-frow">
          <span class="pb-f-label">B领先A</span>
          <div class="ls-shift">
            <a-input-number v-model="corrForm.lead2" :min="0" :max="200" size="small" style="width: 90px" />
            <span class="pb-f-label">交易日</span>
          </div>
        </div>
        <div class="ls-frow">
          <span class="pb-f-label pb-f-label-tip">
            估算参数
            <EstimateTip />
          </span>
          <a-input-number v-model="corrForm.param" :min="0" :max="1" :step="0.1" size="small" style="width: 100%" />
        </div>
        <div class="pb-f-btns">
          <a-button @click="cancelCorrForm">取消</a-button>
          <a-button type="primary" @click="confirmCorrForm">确定</a-button>
        </div>
      </a-card>

      <main class="pb-main">
        <section v-if="!activeCorr" class="gallery-panel pb-listpanel">
          <div class="gal-head">
            <span class="gal-count">共 <b>{{ corrTables.length }}</b> 张表格</span>
            <div class="gi-search">
              <Icon name="search" :size="13" />
              <input v-model="corrFilters.kw" placeholder="搜索表格名称" autocomplete="off">
            </div>
          </div>
          <div class="gal-scroll">
            <div v-if="!corrTables.length" class="gal-empty">暂无表格<br>点击左侧「添加表格」创建</div>
            <div v-else class="gal-grid as-list">
              <a-table :data="corrTables" :pagination="false" size="small" :scroll="{ x: 'max-content' }" class="vf-table">
                <template #columns>
                  <a-table-column title="名称" :width="300" fixed="left">
                    <template #cell="{ record }">
                      <a-link @click="openCorrDetail(record.id)">{{ record.name }}</a-link>
                    </template>
                  </a-table-column>
                  <a-table-column title="创建人" data-index="creator" :width="100" />
                  <a-table-column title="创建时间" data-index="createdAt" :width="190" />
                  <a-table-column title="更新时间" data-index="updatedAt" :width="190" />
                  <a-table-column title="操作" :width="230" fixed="right">
                    <template #cell="{ record }">
                      <div class="lt-ops">
                        <a-link @click="editCorrTable(record.id)">编辑</a-link>
                        <a-link @click="refreshCorrTable(record.id)">刷新</a-link>
                        <a-link @click="dupCorrTable(record.id)">另存为</a-link>
                        <a-popconfirm type="warning" content="确认删除该表格？" @ok="delCorrTable(record.id)">
                          <a-link status="danger">删除</a-link>
                        </a-popconfirm>
                      </div>
                    </template>
                  </a-table-column>
                </template>
              </a-table>
            </div>
          </div>
        </section>

        <template v-else>
          <div class="ls-toolbar">
            <a-input v-model="corrNameInput" size="small" class="ls-name-input" @press-enter="saveCorrDetail" />
            <span class="ls-product-chip">{{ corrLabelOf(activeCorr) }}</span>
            <span class="ls-saved-at">最近保存时间：{{ activeCorr.updatedAt }}</span>
            <span class="ls-spacer" />
            <a-link @click="backCorrList">返回列表</a-link>
            <a-button type="primary" size="small" @click="saveCorrDetail">保存</a-button>
          </div>
          <section class="gallery-panel pb-listpanel ls-detail-panel">
            <div class="gal-scroll">
              <div v-if="!corrRows.length" class="gal-empty">暂无数据</div>
              <a-table
                v-else
                :data="corrRows"
                :columns="corrATableColumns"
                :pagination="false"
                size="small"
                :scroll="{ x: 'max-content' }"
                class="ls-atable vf-table"
              />
            </div>
          </section>
        </template>
      </main>

      <a-modal
        v-model:visible="corrGroupModal.visible"
        :title="corrGroupModal.mode === 'rename' ? '重命名目录' : (corrGroupModal.parent ? '添加子目录' : '添加一级目录')"
        :width="360"
        @before-ok="confirmCorrGroupModal"
      >
        <a-input v-model="corrGroupModal.name" placeholder="请输入目录名称" allow-clear @keydown.enter="confirmCorrGroupModal" />
      </a-modal>
    </div>

    <main v-else class="pa-main">
      <a-card class="pa-empty" :bordered="true">
        <EmptyState
          :title="activeTabMeta.label + '（规划中）'"
          desc="该分析模块即将上线，当前可先使用「持仓排名」查看会员持仓结构。"
        />
      </a-card>
    </main>
  </section>
</template>

<style scoped>
.pa-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  /* 数据密集型页面：铺满内容区，避免宽屏下被 max-width:1560 居中留出大片左空白；
     超宽屏给一个宽松上限并保持左对齐，避免单栏被拉到失衡 */
  max-width: 1900px;
  margin-left: 0;
  margin-right: auto;
  --up: #f53f3f;
  --down: #00b42a;
}

/* ---------- 页头 ---------- */
.pa-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  flex-wrap: wrap;
  min-height: 32px;
}
.pa-head-l { display: flex; align-items: center; gap: 14px; min-width: 0; }
.pa-title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #1d2129;
  letter-spacing: -0.01em;
  white-space: nowrap;
  flex: none;
}
.pa-tabs { display: flex; align-items: center; gap: 4px; flex: none; }

.pa-head-r { display: flex; align-items: center; gap: 8px; flex: none; }
.pa-upd {
  font-size: 12px;
  color: #00b42a;
  background: #e8ffea;
  border-radius: 4px;
  padding: 1px 6px;
  white-space: nowrap;
}
.pa-upd.stale { color: #86909c; background: #f2f3f5; }
.pa-date { display: flex; align-items: center; gap: 4px; }
.pa-dp { width: 112px; }
.pa-dp :deep(.arco-picker) { width: 100%; }
.pa-pop { max-width: 280px; font-size: 12px; line-height: 1.7; color: #4e5969; }
.pa-pop b { display: block; margin-bottom: 4px; color: #1d2129; font-size: 13px; }
.pa-pop p { margin: 0 0 4px; }

/* ---------- 两栏骨架 ---------- */
.pa-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
  align-items: stretch;
}

/* ---------- 左栏 ---------- */
.pa-rail {
  /* 窄屏固定 252，宽屏适度加宽至 300，避免在大屏里被挤成细条 */
  flex: 0 0 clamp(252px, 16%, 300px);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.pa-rail :deep(.arco-card-body) {
  flex: 1;
  min-height: 0;
  padding: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.pa-search { width: 100%; }
.pa-rail-sub {
  margin: 12px 0 6px;
  font-size: 12px;
  color: #86909c;
}
.pa-exseg { display: flex !important; flex-wrap: wrap; gap: 4px; }
.pa-exseg :deep(.arco-radio-button) { white-space: nowrap; font-size: 12px; padding: 0 8px; }
.pa-exseg :deep(.arco-radio-button-content) { padding: 0; }

.pa-rail-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 12px 0 2px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f2f3f5;
  font-size: 12px;
  color: #86909c;
}
.pa-hist { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }

.pa-groups { flex: 1; min-height: 0; overflow-y: auto; margin: 0 -4px; padding: 0 4px; scrollbar-width: thin; }
.pa-gname {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin: 10px 0 6px;
  font-size: 12px;
  color: #1d2129;
  font-weight: 600;
}
.pa-gname em { font-style: normal; font-weight: 400; color: #86909c; font-size: 11px; }
.pa-glist { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.pa-contract {
  border: 1px solid #e5e6eb;
  background: #fff;
  color: #4e5969;
  border-radius: 4px;
  padding: 5px 2px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: all 0.15s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-contract:hover { border-color: #165dff; color: #165dff; background: #f7faff; }
.pa-contract.hist { border-style: dashed; color: #86909c; }
.pa-contract.hist:hover { color: #165dff; }
.pa-contract.on {
  background: #165dff;
  border-color: #165dff;
  color: #fff;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(22, 93, 255, 0.2);
}
.pa-nogroup { color: #86909c; font-size: 12px; text-align: center; padding: 32px 0; line-height: 1.8; }

/* ---------- 右栏 ---------- */
.pa-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 概览卡（Arco Card） */
.pa-sum :deep(.arco-card-header) { padding: 8px 12px; }
.pa-sum :deep(.arco-card-header-title) { font-size: 13px; font-weight: 600; color: #1d2129; }
.pa-sum :deep(.arco-card-body) { padding: 4px 12px 12px; }
.pa-seg :deep(.arco-radio-group-button.arco-radio-size-mini) { border-radius: 6px; }

.pa-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 8px; }
.pa-kpi {
  position: relative;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: #fbfcfd;
  border: 1px solid #eef0f3;
  border-top: 2px solid var(--accent, #ccc);
  border-radius: 6px;
  padding: 8px 10px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.pa-kpi:hover { background: #f7faff; }
.pa-kpi.on {
  background: #f2f7ff;
  border-color: #bedaff;
  border-top-color: var(--accent, #165dff);
  box-shadow: 0 2px 8px rgba(22, 93, 255, 0.08);
}
.k-t { font-size: 12px; color: #86909c; display: flex; align-items: center; gap: 4px; }
.k-c { font-style: normal; font-size: 10px; color: #4e5969; background: #f2f3f5; border-radius: 3px; padding: 0 4px; }
.k-spark {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 88px;
  height: 26px;
  opacity: 0.85;
  pointer-events: none;
}
.k-v {
  font-size: 21px;
  font-weight: 700;
  color: #1d2129;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}
.k-v small { font-size: 11px; font-weight: 400; color: #86909c; margin-left: 2px; }
.k-d {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.k-d.up, .pa-card-sub .up { color: var(--up); }
.k-d.down, .pa-card-sub .down { color: var(--down); }

/* 多空结构 */
.pa-split { margin-top: 10px; }
.pa-split-bar {
  display: flex;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: #f2f3f5;
}
.pa-split-bar .s-l { background: #f8d000; }
.pa-split-bar .s-s { background: #c0d8f8; }
.pa-split-cap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 5px;
  font-size: 11px;
  color: #86909c;
  font-variant-numeric: tabular-nums;
}
.pa-split-cap .mid {
  flex: 1;
  min-width: 0;
  text-align: center;
  color: #4e5969;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 排名卡（Arco Card） */
.pa-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.pa-card :deep(.arco-card-header) {
  padding: 8px 12px;
  border-bottom: 1px solid #f2f3f5;
}
.pa-card :deep(.arco-card-header-title) { min-width: 0; }
.pa-card :deep(.arco-card-header-extra) { min-width: 0; }
.pa-card :deep(.arco-card-body) {
  flex: 1;
  min-height: 0;
  padding: 8px 12px 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pa-cid { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.pa-cid b {
  font-size: 15px;
  font-weight: 600;
  color: #1d2129;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pa-code {
  font-style: normal;
  font-size: 11px;
  color: #86909c;
  background: #f7f8fa;
  border-radius: 3px;
  padding: 1px 5px;
  flex: none;
}
.pa-nav { display: flex; align-items: center; gap: 4px; flex: none; }
.pa-pos { font-size: 11px; color: #c9cdd4; font-variant-numeric: tabular-nums; margin-right: 2px; }

.pa-card-sub {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f2f3f5;
  font-size: 11px;
  color: #86909c;
  font-variant-numeric: tabular-nums;
}
.pa-card-sub .pa-cur { color: #4e5969; font-weight: 600; }
.pa-dot { width: 2px; height: 2px; border-radius: 50%; background: #c9cdd4; }

.pa-chart {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin-top: 8px;
  padding-right: 2px;
  scrollbar-width: thin;
}
.pa-empty :deep(.arco-card-body) {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ---------- 建仓过程 ---------- */
.pb-page { align-items: stretch; }
.pb-rail {
  flex: 0 0 clamp(252px, 16%, 300px);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.pb-rail :deep(.arco-card-body) {
  flex: 1;
  min-height: 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pb-listpanel { flex: 1; min-height: 0; }
.pb-batch-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow: auto;
  margin-bottom: 12px;
}
.pb-f-label-tip { display: inline-flex; align-items: center; gap: 4px; }
.pb-f-label-tip svg { color: #a0a1a7; cursor: help; }
.pb-f-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}
.pb-f-inline .pb-f-label { margin: 0; }
.pb-f-inline :deep(.arco-input-number) { flex: 1; }
.pb-rail :deep(.arco-btn-long) { width: 100%; }

.pb-f-title { font-size: 14px; font-weight: 600; color: #0b0b0f; margin-bottom: 10px; }
.pb-f-label { margin: 12px 0 8px; font-size: 12px; color: #86909c; }
.pb-f-label:first-child { margin-top: 0; }
.pb-pills { display: flex !important; flex-wrap: wrap; gap: 4px; }
.pb-pills :deep(.arco-radio-button) { white-space: nowrap; font-size: 12px; padding: 0 8px; }
.pb-pills :deep(.arco-radio-button-content) { padding: 0; }
.pb-f-btns { display: flex; gap: 8px; margin-top: auto; padding-top: 16px; }
.pb-f-btns :deep(.arco-btn) { flex: 1; }

.pb-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
}
.pb-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.pb-range { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pb-range :deep(.arco-radio-group) { display: flex; flex-wrap: wrap; gap: 4px; }

.pb-chart-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.pb-chart-card :deep(.arco-card-header) { padding: 8px 12px; border-bottom: 1px solid #f2f3f5; }
.pb-chart-card :deep(.arco-card-header-title) { font-size: 14px; font-weight: 600; color: #1d2129; }
.pb-chart-card :deep(.arco-card-body) {
  flex: 1;
  min-height: 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
}
.pb-chart-row { flex: 1; min-height: 300px; display: flex; gap: 8px; }
.pb-ymax {
  flex: none;
  width: 86px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.pb-ymax :deep(.arco-input-number) { width: 100%; }
.pb-chart-fill { flex: 1; min-width: 0; min-height: 280px; display: flex; }
.pb-nochart { flex: 1; display: flex; align-items: center; justify-content: center; color: #86909c; font-size: 13px; }
.pb-foot {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #f2f3f5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: #86909c;
}
.pb-foot-mid { flex: 1; min-width: 0; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pb-ops { display: flex; align-items: center; gap: 8px; }

/* 窄屏指标卡变为 2 列，隐藏趋势线避免挤压数值 */
@media (max-width: 1200px) {
  .k-spark { display: none; }
}

/* ---------- 相关性 ---------- */
.corr-factor-title { margin: 16px 0 2px; font-size: 13px; font-weight: 600; color: #1d2129; }
.corr-sec { margin: 16px 0 2px; font-size: 13px; font-weight: 600; color: #1d2129; }
.corr-two { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; }
.corr-two :deep(.arco-select) { width: 100%; }
/* 表格主题见 src/styles/datahub.css（.vf-table，火山引擎控制台表格规范） */

/* ---------- 多空分析 ---------- */
.ls-frow {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}
.ls-frow .pb-f-label { margin: 0; }
.ls-fgroup { margin-top: 16px; }
.ls-date-mode { margin-top: 8px; display: flex; gap: 16px; }
.ls-shift { display: flex; align-items: center; gap: 8px; }
.ls-shift .pb-f-label { margin: 0; }

.ls-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex-shrink: 0;
  padding: 12px 18px;
  border-bottom: 1px solid #f0f1f4;
}
.ls-name-input { width: 210px; }
.ls-product-chip {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  background: #fff;
  font-size: 13px;
  color: #4e5969;
  white-space: nowrap;
}
.ls-saved-at { font-size: 12px; color: #86909c; white-space: nowrap; }
.ls-spacer { flex: 1; }
.ls-detail-panel { flex: 1; min-height: 0; }

.ls-table { width: max-content; min-width: 100%; border-collapse: collapse; font-size: 13px; background: #fff; }
.ls-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #f7f8fa;
  color: #4e5969;
  font-weight: 500;
  text-align: left;
  padding: 9px 12px;
  border-bottom: 1px solid #e5e6eb;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}
.ls-table th:hover { background: #f0f2f6; color: #1d2129; }
.ls-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f0f1f4;
  color: #1d2129;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.ls-table td.num { text-align: right; }
.ls-table tbody tr:hover td { background: #f8faff; }
.ls-sort { margin-left: 4px; font-size: 11px; color: #c9cdd4; }
.ls-sort.on { color: var(--vf-brand); }

.ls-col-list { display: flex; flex-direction: column; }
.ls-col-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 4px;
  border-bottom: 1px solid #f0f1f4;
  cursor: grab;
}
.ls-col-row:last-child { border-bottom: none; }
.ls-col-grip { color: #c9cdd4; display: flex; }
.ls-col-row:hover .ls-col-grip { color: var(--vf-brand); }
</style>
