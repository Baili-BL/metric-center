import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { uid } from '../utils/hash'

const LS = 'ailab.alerts.v1'

function shiftMin(min) {
  const d = new Date(Date.now() - min * 60 * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function dayKey(ago) {
  const d = new Date(Date.now() - ago * 86400000)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const LEVEL_META = {
  P0: { label: 'P0 严重', tag: 'red' },
  P1: { label: 'P1 重要', tag: 'orange' },
  P2: { label: 'P2 提示', tag: 'blue' },
}

function seedRules() {
  return [
    { id: uid('AR'), name: '螺纹钢库存超预期累积', metric: '五大材库存:螺纹钢', source: '上海钢联', cond: '周环比涨幅 >', threshold: '2%', level: 'P0', channels: ['飞书', '短信'], status: true, silence: '2小时', lastTriggered: shiftMin(35) },
    { id: uid('AR'), name: 'LME铜价单日波动异常', metric: 'LME铜现货价', source: 'LME', cond: '单日涨跌幅 >', threshold: '1.5%', level: 'P1', channels: ['飞书', '邮件'], status: true, silence: '1小时', lastTriggered: shiftMin(210) },
    { id: uid('AR'), name: 'SMM报价断更', metric: 'SMM有色现货报价', source: 'SMM', cond: '数据延迟 >', threshold: '60分钟', level: 'P0', channels: ['飞书', '钉钉', '短信'], status: true, silence: '30分钟', lastTriggered: '2026-10-22 11:05' },
    { id: uid('AR'), name: '宏观指标发布提醒', metric: '制造业PMI', source: '同花顺', cond: '数据更新', threshold: '—', level: 'P2', channels: ['飞书'], status: true, silence: '—', lastTriggered: '2026-10-20 09:31' },
    { id: uid('AR'), name: '铁水日产连续回落', metric: '日均铁水产量', source: '同花顺', cond: '连续下行 ≥', threshold: '3期', level: 'P1', channels: ['飞书', '邮件'], status: true, silence: '4小时', lastTriggered: shiftMin(1500) },
    { id: uid('AR'), name: '采集任务连续失败', metric: '数据采集:任务失败', source: 'DataHub', cond: '连续失败 ≥', threshold: '3次', level: 'P0', channels: ['飞书', '短信'], status: true, silence: '1小时', lastTriggered: shiftMin(318) },
    { id: uid('AR'), name: '钢厂利润转负预警', metric: '螺纹钢即期利润', source: '手工录入', cond: '数值 <', threshold: '0 元/吨', level: 'P1', channels: ['飞书'], status: false, silence: '4小时', lastTriggered: '2026-09-18 15:20' },
  ]
}

function seedRecords(rules) {
  const r = (i) => rules[i % rules.length]
  const rows = [
    [35, 0, '周环比 +2.6%（阈值 2%）', 'triggered', '吴开文'],
    [96, 6, '今日抓取 0 条，连续失败 3 次', 'triggered', ''],
    [210, 1, '单日 +1.83%（阈值 1.5%）', 'acked', '李研'],
    [468, 1, '单日 -1.62%（阈值 1.5%）', 'resolved', '李研'],
    [1290, 4, '连续 3 期回落（241.8 → 240.2 万吨）', 'resolved', '王数'],
    [1610, 0, '周环比 +2.2%（阈值 2%）', 'resolved', '赵策'],
    [2455, 2, '报价延迟 78 分钟', 'resolved', '吴开文'],
    [2890, 5, '生意社指数任务连续失败 4 次', 'resolved', '陈析'],
    [3670, 3, 'PMI 数据已发布：50.4', 'resolved', '王数'],
    [4300, 1, '单日 +2.1%（阈值 1.5%）', 'resolved', '李研'],
  ]
  return rows.map(([ago, ri, detail, status, handler]) => {
    const rule = r(ri)
    return {
      id: uid('AL'), ruleId: rule.id, ruleName: rule.name, metric: rule.metric,
      level: rule.level, time: shiftMin(ago), detail, status, handler,
    }
  })
}

function seedChannels() {
  return [
    { id: uid('CH'), type: '飞书', name: '投研告警群机器人', target: 'https://open.feishu.cn/open-apis/bot/v2/hook/9f3e****', status: true, sent7d: 46, emoji: '飞' },
    { id: uid('CH'), type: '钉钉', name: '数据值班群', target: 'https://oapi.dingtalk.com/robot/send?access_token=ab4c****', status: true, sent7d: 12, emoji: '钉' },
    { id: uid('CH'), type: '邮件', name: '投研团队邮箱组', target: 'research-team@zhonghui-futures.com', status: true, sent7d: 28, emoji: '@' },
    { id: uid('CH'), type: 'Webhook', name: '风控系统回调', target: 'https://risk.zhonghui.local/api/v1/alert-hook', status: false, sent7d: 0, emoji: '⇋' },
  ]
}

export const useAlertStore = defineStore('alerts', () => {
  let saved = []
  try { saved = JSON.parse(localStorage.getItem(LS) || '{"rules":[],"records":[],"channels":[]}') } catch { saved = { rules: [], records: [], channels: [] } }
  const hasCache = saved.rules && saved.rules.length
  const rules = ref(hasCache ? saved.rules : seedRules())
  const records = ref(hasCache && saved.records && saved.records.length ? saved.records : seedRecords(rules.value))
  const channels = ref(hasCache && saved.channels && saved.channels.length ? saved.channels : seedChannels())

  function persist() {
    try { localStorage.setItem(LS, JSON.stringify({ rules: rules.value, records: records.value, channels: channels.value })) } catch { /* */ }
  }

  const stats = computed(() => {
    const triggered = records.value.filter((r) => r.status === 'triggered')
    const acked = records.value.filter((r) => r.status === 'acked')
    const resolved = records.value.filter((r) => r.status === 'resolved')
    const p0 = triggered.filter((r) => r.level === 'P0').length
    return {
      triggered: triggered.length,
      acked: acked.length,
      resolved: resolved.length,
      p0: p0,
      rulesOn: rules.value.filter((r) => r.status).length,
      rulesTotal: rules.value.length,
    }
  })

  const trend = computed(() => {
    const out = []
    for (let i = 13; i >= 0; i--) {
      const seed = (new Date(Date.now() - i * 86400000).getDate() * 29 + 7) % 13
      const p0 = seed % 3 === 0 ? 1 : 0
      const p1 = 1 + (seed % 3)
      const p2 = 2 + (seed % 4)
      out.push({ date: dayKey(i), P0: p0, P1: p1, P2: p2 })
    }
    return out
  })

  function addRule(payload) {
    rules.value.unshift({
      id: uid('AR'), status: true, silence: '1小时', lastTriggered: '—', ...payload,
    })
    persist()
  }
  function toggleRule(id) {
    const r = rules.value.find((x) => x.id === id)
    if (r) r.status = !r.status
    persist()
  }
  function removeRule(id) {
    rules.value = rules.value.filter((x) => x.id !== id)
    persist()
  }
  function ackRecord(id) {
    const r = records.value.find((x) => x.id === id)
    if (r && r.status === 'triggered') { r.status = 'acked'; r.handler = '吴开文' }
    persist()
  }
  function resolveRecord(id) {
    const r = records.value.find((x) => x.id === id)
    if (r && r.status !== 'resolved') { r.status = 'resolved'; if (!r.handler) r.handler = '吴开文' }
    persist()
  }
  function toggleChannel(id) {
    const c = channels.value.find((x) => x.id === id)
    if (c) c.status = !c.status
    persist()
  }
  function updateChannel(id, patch) {
    const c = channels.value.find((x) => x.id === id)
    if (c) Object.assign(c, patch)
    persist()
  }
  function testChannel(id) {
    const c = channels.value.find((x) => x.id === id)
    if (c && c.status) c.sent7d += 1
    persist()
    return !!c?.status
  }

  return { rules, records, channels, stats, trend, addRule, toggleRule, removeRule, ackRecord, resolveRecord, toggleChannel, updateChannel, testChannel }
})
