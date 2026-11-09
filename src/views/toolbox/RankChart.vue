<script setup>
import { computed } from 'vue'
import DataChart from '../../components/DataChart.vue'
import { POS_MODES } from '../../stores/positions'

/**
 * 持仓排名横向堆叠条形图（G2 v5），逻辑见 PRD 4.2/4.3：
 * 柱长 = MAX(今日, 昨日)，基础段 = MIN(今日, 昨日)，增/减段尾端着色，
 * 配色随口径切换（多单黄/红/绿，空单与净空单浅蓝/深蓝/绿，净多单淡黄/红/浅绿），
 * 条末标注「今日持仓/±变化」，悬浮显示买卖明细与补齐值说明。
 */
const props = defineProps({
  rows: { type: Array, default: () => [] },
  modeKey: { type: String, default: 'long' },
})

const modeMeta = computed(() => POS_MODES.find((m) => m.key === props.modeKey) || POS_MODES[0])

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US')
}
function sgn(n) {
  return (n > 0 ? '+' : '') + fmt(n)
}

const spec = computed(() => {
  const rows = props.rows || []
  const meta = modeMeta.value
  const unit = meta.unit
  const segData = []
  const labelData = []
  let maxTotal = 0
  for (const r of rows) {
    const inc = Math.max(r.chg, 0)
    const dec = Math.max(-r.chg, 0)
    const base = r.value - inc
    const memberInfo = { member: r.member, today: r.value, chg: r.chg, yest: r.value - r.chg, est: r.est || null }
    if (base > 0) segData.push({ seg: unit, value: base, ...memberInfo })
    if (inc > 0) segData.push({ seg: '增', value: inc, ...memberInfo })
    if (dec > 0) segData.push({ seg: '减', value: dec, ...memberInfo })
    const total = r.value + dec
    if (total > maxTotal) maxTotal = total
    labelData.push({ member: r.member, total, text: `${fmt(r.value)}/${sgn(r.chg)}` })
  }
  const items = [
    (d) => ({ name: unit, value: `${fmt(d.today)} 手` }),
    (d) => ({ name: '较昨日', value: sgn(d.chg) }),
    (d) => ({ name: '昨日', value: `${fmt(d.yest)} 手` }),
  ]
  if (props.modeKey === 'netLong' || props.modeKey === 'netShort') {
    items.push(
      (d) => ({ name: '买仓', value: `${fmt(d.long)}（${sgn(d.longChg)}）` }),
      (d) => ({ name: '卖仓', value: `${fmt(d.short)}（${sgn(d.shortChg)}）` }),
    )
  }
  items.push((d) => ({ name: '补齐值', value: d.est ? `* ${d.est}` : '—' }))
  return {
    type: 'view',
    height: Math.max(180, rows.length * 30 + 70),
    /* 右侧留出条末标注（"43,330/+1,120"）的空间，避免被绘图区裁切 */
    paddingRight: 74,
    coordinate: { transform: [{ type: 'transpose' }] },
    scale: {
      color: { domain: [unit, '增', '减'], range: [meta.base, meta.up, meta.down] },
      y: { domainMax: Math.ceil((maxTotal * 1.14) / 100) * 100, labelFormatter: (v) => fmt(v) },
      x: { padding: 0.55 },
    },
    legend: {
      color: { position: 'top', itemLabelFill: '#4E5969', itemLabelFontSize: 12 },
    },
    axis: {
      x: { title: false, labelFontSize: 11, labelFill: '#4E5969' },
      y: { title: false, labelFontSize: 11, labelFill: '#86909C', tickCount: 6 },
    },
    children: [
      {
        type: 'interval',
        transform: [{ type: 'stackY' }],
        data: segData,
        encode: { x: 'member', y: 'value', color: 'seg' },
        tooltip: { title: (d) => ({ value: d.member + (d.est ? ' *' : '') }), items },
        animate: { enter: { type: 'growInX', duration: 360 } },
      },
      {
        type: 'text',
        data: labelData,
        encode: { x: 'member', y: 'total', text: 'text' },
        style: { dx: 6, fontSize: 11, fill: '#4E5969', textAlign: 'start', textBaseline: 'middle' },
        tooltip: false,
        animate: { enter: { type: 'fadeIn', duration: 300 } },
      },
    ],
  }
})
</script>

<template>
  <DataChart v-if="rows.length" :spec="spec" :height="spec.height" />
  <div v-else class="rank-empty">该日期暂无持仓数据</div>
</template>

<style scoped>
.rank-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 220px;
  color: #86909c;
  font-size: 13px;
}
</style>
