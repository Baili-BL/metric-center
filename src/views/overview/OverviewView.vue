<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../../components/Icon.vue'
import DataChart from '../../components/DataChart.vue'
import { useIndicatorStore } from '../../stores/indicators'
import { useGalleryStore } from '../../stores/gallery'
import { useCrawlerStore } from '../../stores/crawler'
import { useAlertStore } from '../../stores/alerts'

const router = useRouter()
const indStore = useIndicatorStore()
const galleryStore = useGalleryStore()
const crawlerStore = useCrawlerStore()
const alertStore = useAlertStore()

const kpis = computed(() => [
  { label: '指标总数', value: indStore.cards.length, unit: '个', ico: 'blue', icon: 'nav-indicator', delta: `基础 + 计算指标 · 数据源 ${3} 家` },
  { label: '指标图表', value: galleryStore.charts.length, unit: '张', ico: 'cyan', icon: 'nav-gallery', delta: '图库在管图表总数' },
  { label: '采集任务', value: crawlerStore.stats.total, unit: '个', ico: 'purple', icon: 'nav-crawler', delta: `今日抓取 ${crawlerStore.stats.todaySum.toLocaleString()} 条` },
  { label: '待处理告警', value: alertStore.stats.triggered, unit: '条', ico: 'red', icon: 'nav-alert', delta: `生效规则 ${alertStore.stats.rulesOn} 条` },
])

const platforms = computed(() => [
  {
    key: 'ind', name: '指标中心', desc: '指标定义 · 图表分析 · 表格协同 · 智能报告', ico: 'blue', icon: 'nav-indicator', to: '/indicators', glow: 'rgba(22, 100, 255, .07)', planned: false,
    metrics: [
      { b: indStore.cards.length, s: '指标' },
      { b: galleryStore.charts.length, s: '图表' },
      { b: '3', s: '数据源' },
    ],
  },
  {
    key: 'crawler', name: '数据采集', desc: '采集任务 · 调度监控 · 数据入库', ico: 'purple', icon: 'nav-crawler', to: '/crawler', glow: 'rgba(120, 97, 255, .08)', planned: true,
    metrics: [
      { b: crawlerStore.stats.total, s: '采集任务' },
      { b: crawlerStore.stats.todaySum.toLocaleString(), s: '今日抓取' },
      { b: crawlerStore.stats.rate + '%', s: '成功率' },
    ],
  },
  {
    key: 'alerts', name: '告警中心', desc: '异动监控 · 多渠道触达 · 处理留痕', ico: 'orange', icon: 'nav-alert', to: '/alerts', glow: 'rgba(255, 138, 0, .08)', planned: true,
    metrics: [
      { b: alertStore.stats.rulesOn, s: '生效规则' },
      { b: alertStore.stats.triggered, s: '待处理', warn: alertStore.stats.triggered > 0 },
      { b: alertStore.stats.resolved, s: '已恢复' },
    ],
  },
])

const trendSpec = computed(() => ({
  type: 'view',
  data: crawlerStore.trend,
  scale: { color: { range: ['#1664ff', '#f76964'] } },
  legend: { color: { position: 'top', itemMarkerSize: 8 } },
  axis: {
    x: { title: false, labelAutoHide: true, labelAutoRotate: false },
    y: { title: false },
  },
  children: [
    {
      type: 'area',
      encode: { x: 'date', y: 'count', color: 'type' },
      transform: [{ type: 'stackY' }],
      style: { fillOpacity: 0.12, lineWidth: 0 },
    },
    {
      type: 'line',
      encode: { x: 'date', y: 'count', color: 'type' },
      transform: [{ type: 'stackY' }],
      style: { lineWidth: 2 },
    },
  ],
}))

const health = computed(() => [
  { name: '指标中心', desc: '服务正常 · 数据同步于今日 08:00 完成', state: '正常', tag: 'green', to: '/indicators' },
  { name: '数据采集', desc: `规划中 · 已接入采集任务 ${crawlerStore.stats.total} 个（示意数据）`, state: '规划中', tag: 'orange', to: '/crawler' },
  { name: '告警中心', desc: `规划中 · 试运行规则 ${alertStore.stats.rulesTotal} 条（示意数据）`, state: '规划中', tag: 'orange', to: '/alerts' },
])
</script>

<template>
  <section class="dh-page">
    <div class="dh-stat-grid">
      <div v-for="s in kpis" :key="s.label" class="dh-stat">
        <div class="stat-ico" :class="s.ico"><Icon :name="s.icon" :size="21" /></div>
        <div class="stat-info">
          <div class="stat-label">{{ s.label }}</div>
          <div class="stat-value">{{ s.value }}<span class="unit">{{ s.unit }}</span></div>
          <div class="stat-delta">{{ s.delta }}</div>
        </div>
      </div>
    </div>

    <div class="dh-plat-grid">
      <button v-for="p in platforms" :key="p.key" class="dh-plat-card" :style="{ '--plat-glow': p.glow }" @click="router.push(p.to)">
        <div class="plat-top">
          <span class="plat-ico" :class="p.ico"><Icon :name="p.icon" :size="20" /></span>
          <div>
            <div class="plat-name">
              {{ p.name }}
              <span v-if="p.planned" class="dh-tag orange" style="margin-left: 6px; vertical-align: 1px">规划中</span>
            </div>
            <div class="plat-desc">{{ p.desc }}</div>
          </div>
        </div>
        <div class="plat-metrics">
          <div v-for="m in p.metrics" :key="m.s" class="pm">
            <b :class="{ warn: m.warn }">{{ m.b }}</b>
            <span>{{ m.s }}</span>
          </div>
        </div>
      </button>
    </div>

    <div class="dh-grid cols-2-1">
      <div class="dh-card chart-card">
        <div class="dh-card-head">
          <h3>近 14 日抓取量趋势</h3>
          <div class="dh-card-extra"><span class="dh-tag gray">示意数据 · 成功 / 失败（条）</span></div>
        </div>
        <div class="chart-fill">
          <DataChart :spec="trendSpec" fill />
        </div>
      </div>

      <div class="dh-card health-card">
        <div class="dh-card-head"><h3>平台健康度</h3></div>
        <div class="dh-health hp-fill">
          <div v-for="h in health" :key="h.name" class="hp-row" style="cursor: pointer" @click="router.push(h.to)">
            <div>
              <div class="hp-name">{{ h.name }}</div>
              <div class="hp-desc">{{ h.desc }}</div>
            </div>
            <div class="hp-right">
              <span class="dh-tag" :class="h.tag"><i class="tag-dot" />{{ h.state }}</span>
              <icon-right style="color: var(--dh-text-3)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.plat-name { display: flex; align-items: center; }
.chart-card { min-height: 340px; }
.chart-fill { flex: 1; min-height: 260px; display: flex; }
.health-card { display: flex; }
.hp-fill { flex: 1; min-height: 0; justify-content: center; }
.hp-fill .hp-row { flex: 1; align-items: center; }
</style>
