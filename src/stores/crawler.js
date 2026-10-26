import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { nowStr, uid } from '../utils/hash'

const LS = 'ailab.crawler.v1'

function shiftMin(min) {
  const d = new Date(Date.now() - min * 60 * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function seedTasks() {
  return [
    { id: uid('T'), name: 'LME 金属现货日度行情', site: 'lme.com', url: 'https://www.lme.com/Metals', type: 'API接口', freq: '每日 08:00', status: 'running', lastRun: shiftMin(42), nextRun: '明日 08:00', successRate: 99.2, todayCount: 1286, total: 486_320, owner: '吴开文' },
    { id: uid('T'), name: '上海钢联 · 钢材库存周报', site: 'steelhome.cn', url: 'https://www.steelhome.cn/Stock/', type: '列表页解析', freq: '每周一 09:00', status: 'running', lastRun: shiftMin(180), nextRun: '下周一 09:00', successRate: 97.6, todayCount: 342, total: 128_640, owner: '李研' },
    { id: uid('T'), name: 'SMM 有色现货报价', site: 'smm.cn', url: 'https://www.smm.cn/quote/', type: '列表页解析', freq: '每小时', status: 'running', lastRun: shiftMin(18), nextRun: '1 小时后', successRate: 98.4, todayCount: 2210, total: 654_880, owner: '吴开文' },
    { id: uid('T'), name: '同花顺 · 宏观经济指标库', site: '10jqka.com.cn', url: 'https://data.10jqka.com.cn/macro/', type: 'API接口', freq: '每日 07:30', status: 'running', lastRun: shiftMin(95), nextRun: '明日 07:30', successRate: 99.8, todayCount: 1866, total: 322_150, owner: '王数' },
    { id: uid('T'), name: '国家统计局 · 月度数据发布', site: 'stats.gov.cn', url: 'https://www.stats.gov.cn/sj/', type: '详情页解析', freq: '每月 1 日 09:00', status: 'paused', lastRun: '2026-10-01 09:12', nextRun: '11月1日 09:00', successRate: 96.1, todayCount: 0, total: 86_410, owner: '赵策' },
    { id: uid('T'), name: '生意社 · 大宗商品价格指数', site: '100ppi.com', url: 'https://www.100ppi.com/monitor/', type: '列表页解析', freq: '每日 18:00', status: 'error', lastRun: shiftMin(320), nextRun: '重试 3 次失败', successRate: 71.5, todayCount: 0, total: 96_770, owner: '陈析' },
    { id: uid('T'), name: '海关总署 · 进出口月报附件', site: 'customs.gov.cn', url: 'https://www.customs.gov.cn/', type: '文件下载', freq: '每月 20 日 10:00', status: 'running', lastRun: '2026-09-20 10:05', nextRun: '10月20日 10:00', successRate: 94.3, todayCount: 0, total: 24_180, owner: '李研' },
    { id: uid('T'), name: '知乎 · 黑色系专题舆情监控', site: 'zhihu.com', url: 'https://www.zhihu.com/topic/黑色系', type: '详情页解析', freq: '每 30 分钟', status: 'running', lastRun: shiftMin(9), nextRun: '21 分钟后', successRate: 92.7, todayCount: 412, total: 158_920, owner: '王数' },
  ]
}

function seedLogs(tasks) {
  const pick = (i) => tasks[i % tasks.length]
  const rows = [
    [9, 0, 1286, '12.4s', 'success', '抓取 1286 条，入库成功'],
    [18, 2, 2210, '31.8s', 'success', '抓取 2210 条，入库成功'],
    [42, 0, 1280, '13.1s', 'success', '抓取 1280 条，入库成功'],
    [57, 5, 0, '45.2s', 'fail', '目标页结构变更：价格列定位失败（重试 3 次）'],
    [75, 1, 342, '8.9s', 'success', '抓取 342 条，入库成功'],
    [95, 3, 1866, '22.7s', 'success', '抓取 1866 条，入库成功'],
    [120, 7, 388, '16.3s', 'success', '抓取 388 条，入库成功'],
    [150, 7, 0, '60.1s', 'fail', '登录态失效，已自动重登'],
    [180, 1, 336, '9.2s', 'success', '抓取 336 条，入库成功'],
    [210, 2, 2188, '30.6s', 'success', '抓取 2188 条，入库成功'],
    [248, 0, 1274, '12.8s', 'success', '抓取 1274 条，入库成功'],
    [320, 5, 0, '90.0s', 'fail', '连接超时：www.100ppi.com 响应超过 90s'],
    [360, 3, 1854, '21.9s', 'success', '抓取 1854 条，入库成功'],
    [420, 7, 405, '15.7s', 'success', '抓取 405 条，入库成功'],
  ]
  return rows.map(([ago, ti, got, cost, status, msg]) => {
    const t = pick(ti)
    return { id: uid('L'), taskId: t.id, taskName: t.name, time: shiftMin(ago), got, cost, status, msg }
  })
}

function seedDatasets(tasks) {
  const t0 = tasks[0], t1 = tasks[1], t2 = tasks[2], t3 = tasks[3]
  return [
    { id: uid('D'), taskId: t0.id, taskName: t0.name, name: 'LME金属现货价格日表', rows: 1286, updated: shiftMin(42), status: '已入库', fields: ['日期', '品种', '交易币种', '现货价', '涨跌', '库存'], preview: [
      ['2026-10-25', '铜 Cu', 'USD', '9685.5', '+0.62%', '187,400'],
      ['2026-10-25', '铝 Al', 'USD', '2612.0', '+0.38%', '1,284,600'],
      ['2026-10-25', '锌 Zn', 'USD', '2896.5', '-0.21%', '742,300'],
      ['2026-10-25', '镍 Ni', 'USD', '16240', '+1.05%', '96,850'],
      ['2026-10-24', '铜 Cu', 'USD', '9625.5', '+0.14%', '188,100'],
    ] },
    { id: uid('D'), taskId: t1.id, taskName: t1.name, name: '五大材库存周度表', rows: 342, updated: shiftMin(180), status: '已入库', fields: ['日期', '品种', '城市', '库存量', '周环比'], preview: [
      ['2026-10-24', '螺纹钢', '全国', '4,286,300', '-2.14%'],
      ['2026-10-24', '热卷', '全国', '3,512,800', '-1.02%'],
      ['2026-10-24', '冷轧', '全国', '1,286,400', '+0.36%'],
      ['2026-10-24', '中厚板', '全国', '986,200', '-0.58%'],
      ['2026-10-17', '螺纹钢', '全国', '4,379,900', '-1.66%'],
    ] },
    { id: uid('D'), taskId: t2.id, taskName: t2.name, name: 'SMM有色现货报价', rows: 2210, updated: shiftMin(18), status: '已入库', fields: ['时间', '品种', '均价', '涨跌', '备注'], preview: [
      ['10:30', '电解铜', '76,825', '+320', '升水 120'],
      ['10:30', 'A00铝', '20,685', '+45', '—'],
      ['10:30', '0#锌', '22,410', '-60', '—'],
      ['10:30', '1#电解镍', '128,650', '+1,240', '—'],
      ['09:30', '电解铜', '76,505', '+85', '升水 110'],
    ] },
    { id: uid('D'), taskId: t3.id, taskName: t3.name, name: '宏观指标月度库', rows: 1866, updated: shiftMin(95), status: '已入库', fields: ['指标', '频率', '最新值', '前值', '同比'], preview: [
      ['制造业PMI', '月', '50.4', '49.8', '+0.6pct'],
      ['CPI 当月同比', '月', '0.4%', '0.6%', '-0.2pct'],
      ['PPI 当月同比', '月', '-1.8%', '-2.1%', '+0.3pct'],
      ['社会融资规模', '月', '41,260亿', '30,320亿', '+36.0%'],
      ['M2 同比', '月', '7.5%', '7.2%', '+0.3pct'],
    ] },
    { id: uid('D'), taskId: tasks[6].id, taskName: tasks[6].name, name: '进出口月报附件库', rows: 96, updated: '2026-09-20 10:32', status: '已入库', fields: ['月份', '商品类别', '出口额', '进口额', '同比'], preview: [
      ['2026-09', '钢材', '68.4亿美元', '12.1亿美元', '-4.2%'],
      ['2026-09', '铜材', '54.2亿美元', '86.5亿美元', '+2.8%'],
      ['2026-08', '钢材', '71.2亿美元', '11.8亿美元', '-2.1%'],
      ['2026-08', '铜材', '52.8亿美元', '84.2亿美元', '+1.5%'],
    ] },
    { id: uid('D'), taskId: tasks[7].id, taskName: tasks[7].name, name: '黑色系舆情语料', rows: 412, updated: shiftMin(9), status: '已入库', fields: ['时间', '标题', '情感分', '关键词', '链接'], preview: [
      ['10:12', '焦炭第七轮提产落地，盘面怎么走？', '-0.42', '焦炭,提产', 'zhihu.com/…'],
      ['09:48', '铁水日产回落至 242 万吨', '+0.18', '铁水,日产', 'zhihu.com/…'],
      ['09:15', '螺纹表观消费周度点评', '+0.05', '螺纹,表需', 'zhihu.com/…'],
      ['08:52', '双焦库存结构跟踪', '-0.11', '双焦,库存', 'zhihu.com/…'],
      ['08:30', '钢厂利润周度监测', '+0.26', '钢厂,利润', 'zhihu.com/…'],
    ] },
  ]
}

export const useCrawlerStore = defineStore('crawler', () => {
  let saved = []
  try { saved = JSON.parse(localStorage.getItem(LS) || '[]') } catch { saved = [] }
  const tasks = ref(saved.length ? saved : seedTasks())
  const logs = ref(seedLogs(tasks.value))
  const datasets = ref(seedDatasets(tasks.value))

  function persist() {
    try { localStorage.setItem(LS, JSON.stringify(tasks.value)) } catch { /* */ }
  }

  const stats = computed(() => {
    const running = tasks.value.filter((t) => t.status === 'running').length
    const err = tasks.value.filter((t) => t.status === 'error').length
    const todaySum = tasks.value.reduce((s, t) => s + (t.todayCount || 0), 0)
    const ok = logs.value.filter((l) => l.status === 'success').length
    const rate = logs.value.length ? Math.round((ok / logs.value.length) * 1000) / 10 : 100
    return { running, err, todaySum, rate, total: tasks.value.length }
  })

  const trend = computed(() => {
    // 近 14 日抓取量趋势（基于今日与比例的稳定模拟），长表格式便于 G2 直接编码
    const out = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const p = (n) => String(n).padStart(2, '0')
      const key = `${p(d.getMonth() + 1)}-${p(d.getDate())}`
      const seed = (d.getDate() * 37 + d.getMonth() * 11) % 100
      const items = Math.round((6200 + seed * 26) / 10) * 10
      const fails = Math.round(items * (0.01 + (seed % 5) * 0.004))
      out.push({ date: key, type: '成功', count: items - fails })
      out.push({ date: key, type: '失败', count: fails })
    }
    return out
  })

  function addTask(payload) {
    tasks.value.unshift({
      id: uid('T'), status: 'paused', successRate: 100, todayCount: 0, total: 0,
      lastRun: '—', nextRun: '待调度', owner: '吴开文', ...payload,
    })
    persist()
  }
  function updateTask(id, patch) {
    const t = tasks.value.find((x) => x.id === id)
    if (t) Object.assign(t, patch)
    persist()
  }
  function removeTask(id) {
    tasks.value = tasks.value.filter((x) => x.id !== id)
    datasets.value = datasets.value.filter((d) => d.taskId !== id)
    persist()
  }
  function toggleTask(id) {
    const t = tasks.value.find((x) => x.id === id)
    if (!t) return
    t.status = t.status === 'running' ? 'paused' : 'running'
    if (t.status === 'running' && t.nextRun === '重试 3 次失败') t.nextRun = '下一个调度周期'
    persist()
  }
  function runTask(id) {
    const t = tasks.value.find((x) => x.id === id)
    if (!t) return null
    const ok = t.status !== 'error' && Math.random() > 0.08
    const got = ok ? 200 + Math.floor(Math.random() * 1500) : 0
    const log = {
      id: uid('L'), taskId: t.id, taskName: t.name, time: nowStr(),
      got, cost: (4 + Math.random() * 30).toFixed(1) + 's', status: ok ? 'success' : 'fail',
      msg: ok ? `抓取 ${got} 条，入库成功` : '目标响应异常：连接超时（可重试）',
    }
    logs.value.unshift(log)
    t.lastRun = log.time
    if (ok) {
      t.todayCount = (t.todayCount || 0) + got
      t.total = (t.total || 0) + got
      if (t.status === 'error') t.status = 'running'
      const ds = datasets.value.find((d) => d.taskId === id)
      if (ds) { ds.rows += got; ds.updated = log.time }
    }
    persist()
    return log
  }

  return { tasks, logs, datasets, stats, trend, addTask, updateTask, removeTask, toggleTask, runTask }
})
