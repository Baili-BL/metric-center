<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import DataChart from '../../components/DataChart.vue'
import { useIndicatorStore } from '../../stores/indicators'
import { useGalleryStore } from '../../stores/gallery'
import { useCrawlerStore } from '../../stores/crawler'
import { useAlertStore, LEVEL_META } from '../../stores/alerts'

const router = useRouter()
const indStore = useIndicatorStore()
const galleryStore = useGalleryStore()
const crawlerStore = useCrawlerStore()
const alertStore = useAlertStore()

/* KPI：图标统一品牌蓝；语义色仅用于状态（待处理告警 > 0 时 danger） */
const kpis = computed(() => [
  { label: '指标总数', value: indStore.cards.length, unit: '个', icon: 'icon-bar-chart', delta: '基础 + 计算指标 · 数据源 3 家' },
  { label: '指标图表', value: galleryStore.charts.length, unit: '张', icon: 'icon-image', delta: '图库在管图表总数' },
  { label: '采集任务', value: crawlerStore.stats.total, unit: '个', icon: 'icon-robot', delta: `今日抓取 ${crawlerStore.stats.todaySum.toLocaleString()} 条` },
  { label: '待处理告警', value: alertStore.stats.triggered, unit: '条', icon: 'icon-thunderbolt', delta: `生效规则 ${alertStore.stats.rulesOn} 条`, danger: alertStore.stats.triggered > 0 },
])

const platforms = computed(() => [
  {
    key: 'ind', name: '指标中心', desc: '指标定义 · 图表分析 · 表格协同 · 智能报告', to: '/indicators', icon: 'icon-bar-chart', planned: false,
    metrics: [
      { b: indStore.cards.length, s: '指标' },
      { b: galleryStore.charts.length, s: '图表' },
      { b: '3', s: '数据源' },
    ],
  },
  {
    key: 'crawler', name: '数据采集', desc: '采集任务 · 调度监控 · 数据入库', to: '/crawler', icon: 'icon-robot', planned: true,
    metrics: [
      { b: crawlerStore.stats.total, s: '采集任务' },
      { b: crawlerStore.stats.todaySum.toLocaleString(), s: '今日抓取' },
      { b: crawlerStore.stats.rate + '%', s: '成功率' },
    ],
  },
  {
    key: 'alerts', name: '告警中心', desc: '异动监控 · 多渠道触达 · 处理留痕', to: '/alerts', icon: 'icon-thunderbolt', planned: true,
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
  scale: { color: { range: ['#1664ff', '#f93920'] } },
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
  { name: '指标中心', desc: '服务正常 · 数据同步于今日 08:00 完成', state: '正常', tag: 'success', to: '/indicators' },
  { name: '数据采集', desc: `规划中 · 已接入采集任务 ${crawlerStore.stats.total} 个（示意数据）`, state: '规划中', tag: 'warning', to: '/crawler' },
  { name: '告警中心', desc: `规划中 · 试运行规则 ${alertStore.stats.rulesTotal} 条（示意数据）`, state: '规划中', tag: 'warning', to: '/alerts' },
])

/* 最近采集运行（示意日志前 5 条） */
const recentLogs = computed(() => crawlerStore.logs.slice(0, 5))
const LOG_STATUS = { success: { label: '成功', tag: 'success' }, fail: { label: '失败', tag: 'danger' }, running: { label: '运行中', tag: 'warning' } }

/* 最新告警（前 5 条，支持快捷确认 / 恢复） */
const recentAlerts = computed(() => alertStore.records.slice(0, 5))
const ALERT_STATUS = { triggered: { label: '触发中', tag: 'danger' }, acked: { label: '已确认', tag: 'gray' }, resolved: { label: '已恢复', tag: 'success' } }
function ack(r) { alertStore.ackRecord(r.id); Message.success('已确认') }
function resolve(r) { alertStore.resolveRecord(r.id); Message.success('已标记恢复') }

/* 最近更新指标（按最新数据日期排序前 6） */
const recentInds = computed(() => [...indStore.cards].sort((a, b) => (b.latestDate || '').localeCompare(a.latestDate || '')).slice(0, 6))

/* ---------- 最近更新（分类：指标中心 / 数据采集 / 告警监控） ---------- */
const RECENT_CATS = [
  { key: 'all', label: '全部' },
  { key: 'ind', label: '指标中心' },
  { key: 'crawler', label: '数据采集' },
  { key: 'alert', label: '告警监控' },
]
const recentCat = ref('all')

const allRecent = computed(() => {
  const items = []
  /* 指标中心：按最新数据日期 */
  indStore.cards.forEach((c) => {
    items.push({
      id: 'ind-' + c.id,
      name: c.title,
      cat: 'ind',
      catLabel: '指标中心',
      desc: `${c.freq || '—'}${c.unit ? ' · ' + c.unit : ''}`,
      time: c.latestDate || '',
      to: '/indicators',
    })
  })
  /* 数据采集：采集运行日志 */
  crawlerStore.logs.forEach((l) => {
    items.push({
      id: 'crawl-' + l.id,
      name: l.taskName,
      cat: 'crawler',
      catLabel: '数据采集',
      desc: `${LOG_STATUS[l.status].label}${l.got ? ' · 抓取 ' + l.got.toLocaleString() + ' 条' : ''}${l.cost ? ' · ' + l.cost : ''}`,
      time: l.time,
      to: '/crawler',
    })
  })
  /* 告警监控：告警记录 */
  alertStore.records.forEach((a) => {
    items.push({
      id: 'alert-' + a.id,
      name: a.ruleName,
      cat: 'alert',
      catLabel: '告警监控',
      desc: `${LEVEL_META[a.level].label} · ${ALERT_STATUS[a.status].label}${a.detail ? ' · ' + a.detail : ''}`,
      time: a.time,
      to: '/alerts',
    })
  })
  return items.sort((a, b) => String(b.time).localeCompare(String(a.time)))
})
const catCount = (key) => allRecent.value.filter((x) => x.cat === key).length
const filteredRecent = computed(() => {
  const list = recentCat.value === 'all' ? allRecent.value : allRecent.value.filter((x) => x.cat === recentCat.value)
  return list.slice(0, 10)
})
</script>

<template>
  <section class="dh-page vf-overview">
    <!-- 页面标题区：标题 + 操作按钮右对齐（skill 工作流约定） -->
    <div class="vf-page-head">
      <h1>平台总览</h1>
      <div class="vf-actions">
        <a-button @click="router.push('/manual')">手工录入</a-button>
        <a-button type="primary" @click="router.push('/builder')">新建图表</a-button>
      </div>
    </div>

    <!-- KPI -->
    <div class="vf-stat-grid">
      <div v-for="s in kpis" :key="s.label" class="vf-stat">
        <span class="vf-stat-ico"><component :is="s.icon" /></span>
        <div class="vf-stat-info">
          <div class="vf-stat-label">{{ s.label }}</div>
          <div class="vf-stat-value" :class="{ danger: s.danger }">{{ s.value }}<span class="unit">{{ s.unit }}</span></div>
          <div class="vf-stat-delta">{{ s.delta }}</div>
        </div>
      </div>
    </div>

    <!-- 平台入口 -->
    <div class="vf-plat-grid">
      <button v-for="p in platforms" :key="p.key" class="vf-plat-card" @click="router.push(p.to)">
        <div class="plat-top">
          <span class="plat-ico"><component :is="p.icon" /></span>
          <div class="plat-head">
            <div class="plat-name">
              {{ p.name }}
              <span v-if="p.planned" class="vf-tag warning"><i />规划中</span>
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

    <!-- 趋势 + 健康度 -->
    <div class="vf-bottom-grid">
      <div class="vf-card chart-card">
        <div class="vf-card-head">
          <h3>近 14 日抓取量趋势</h3>
          <span class="vf-muted">示意数据 · 成功 / 失败（条）</span>
        </div>
        <div class="chart-fill">
          <DataChart :spec="trendSpec" fill />
        </div>
      </div>

      <div class="vf-card health-card">
        <div class="vf-card-head"><h3>平台健康度</h3></div>
        <div class="vf-hp-list">
          <div v-for="h in health" :key="h.name" class="vf-hp" @click="router.push(h.to)">
            <div class="vf-hp-main">
              <div class="vf-hp-name">{{ h.name }}</div>
              <div class="vf-hp-desc">{{ h.desc }}</div>
            </div>
            <div class="vf-hp-right">
              <span class="vf-tag" :class="h.tag"><i />{{ h.state }}</span>
              <icon-right class="vf-hp-arrow" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 最近采集运行 + 最新告警 -->
    <div class="vf-grid-2">
      <div class="vf-card">
        <div class="vf-card-head">
          <h3>最近采集运行</h3>
          <a-link @click="router.push('/crawler')">查看全部</a-link>
        </div>
        <table class="vf-table">
          <thead>
            <tr><th>时间</th><th>任务</th><th>结果</th><th class="num">抓取条数</th><th class="num">耗时</th></tr>
          </thead>
          <tbody>
            <tr v-for="l in recentLogs" :key="l.id">
              <td class="vf-td-time">{{ l.time.slice(5) }}</td>
              <td class="vf-td-main">{{ l.taskName }}</td>
              <td><span class="vf-tag" :class="LOG_STATUS[l.status].tag"><i />{{ LOG_STATUS[l.status].label }}</span></td>
              <td class="num">{{ l.got ? l.got.toLocaleString() : '—' }}</td>
              <td class="num">{{ l.cost }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="vf-card">
        <div class="vf-card-head">
          <h3>最新告警</h3>
          <a-link @click="router.push('/alerts')">查看全部</a-link>
        </div>
        <div class="vf-al-list">
          <div v-for="a in recentAlerts" :key="a.id" class="vf-al">
            <span class="dh-tag" :class="LEVEL_META[a.level].tag">{{ LEVEL_META[a.level].label }}</span>
            <div class="vf-al-main">
              <div class="vf-al-title">{{ a.ruleName }}</div>
              <div class="vf-al-desc">{{ a.detail }} · {{ a.time.slice(5) }}</div>
            </div>
            <div class="vf-al-right">
              <span class="vf-tag" :class="ALERT_STATUS[a.status].tag"><i />{{ ALERT_STATUS[a.status].label }}</span>
              <a-link v-if="a.status === 'triggered'" @click="ack(a)">确认</a-link>
              <a-link v-else-if="a.status === 'acked'" @click="resolve(a)">恢复</a-link>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 最近更新：按平台模块分类（指标中心 / 数据采集 / 告警监控） -->
    <div class="vf-card">
      <div class="vf-card-head">
        <h3>最近更新</h3>
        <div class="vf-cat-tabs">
          <button
            v-for="c in RECENT_CATS"
            :key="c.key"
            type="button"
            class="vf-cat-tab"
            :class="{ on: recentCat === c.key }"
            @click="recentCat = c.key"
          >
            {{ c.label }}<em v-if="c.key !== 'all'">{{ catCount(c.key) }}</em>
          </button>
        </div>
      </div>
      <table class="vf-table">
        <thead>
          <tr><th>名称</th><th>分类</th><th>说明</th><th class="num">最新时间</th></tr>
        </thead>
        <tbody>
          <tr v-for="it in filteredRecent" :key="it.id" class="vf-row-link" @click="router.push(it.to)">
            <td class="vf-td-main">{{ it.name }}</td>
            <td>
              <span class="vf-cat" :class="'cat-' + it.cat"><i />{{ it.catLabel }}</span>
            </td>
            <td class="vf-td-sub">{{ it.desc }}</td>
            <td class="num vf-td-time">{{ it.time || '—' }}</td>
          </tr>
          <tr v-if="!filteredRecent.length">
            <td colspan="4" class="vf-empty">暂无更新</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
/* 页面标题区 */
.vf-page-head { display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
.vf-page-head h1 { margin: 0; font-size: 20px; font-weight: 600; color: var(--vf-text-0); }
.vf-actions { display: flex; gap: 8px; }
.vf-actions :deep(.arco-btn) { border-radius: var(--vf-radius-ctl); height: 32px; }

/* KPI 卡：白底 + 细边框 + 8px 圆角，图标统一品牌蓝 */
.vf-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 16px;
  flex-shrink: 0;
}
.vf-stat {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--vf-card);
  border: 1px solid var(--vf-line);
  border-radius: var(--vf-radius-card);
}
.vf-stat-ico {
  width: 32px;
  height: 32px;
  border-radius: var(--vf-radius-ctl);
  background: rgba(22, 100, 255, .1);
  color: var(--vf-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.vf-stat-info { min-width: 0; }
.vf-stat-label { font-size: 13px; color: var(--vf-text-1); }
.vf-stat-value {
  margin-top: 2px;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--vf-text-0);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.vf-stat-value .unit { font-size: 12px; font-weight: 400; color: var(--vf-text-2); margin-left: 2px; }
.vf-stat-value.danger { color: var(--vf-danger); }
.vf-stat-delta { margin-top: 2px; font-size: 12px; color: var(--vf-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* 平台入口卡：全部品牌蓝，去掉多色渐变与装饰圆 */
.vf-plat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
  gap: 16px;
  flex-shrink: 0;
}
.vf-plat-card {
  text-align: left;
  width: 100%;
  padding: 16px;
  background: var(--vf-card);
  border: 1px solid var(--vf-line);
  border-radius: var(--vf-radius-card);
  cursor: pointer;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.vf-plat-card:hover { border-color: var(--vf-brand); box-shadow: 0 2px 8px rgba(22, 100, 255, .06); }
.plat-top { display: flex; align-items: center; gap: 12px; }
.plat-ico {
  width: 36px;
  height: 36px;
  border-radius: var(--vf-radius-ctl);
  background: rgba(22, 100, 255, .1);
  color: var(--vf-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.plat-head { min-width: 0; }
.plat-name { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--vf-text-0); }
.plat-desc { margin-top: 2px; font-size: 12px; color: var(--vf-text-2); }
.plat-metrics { margin-top: 16px; display: flex; }
.vf-plat-card .pm { flex: 1; min-width: 0; }
.vf-plat-card .pm + .pm { border-left: 1px solid var(--vf-line); padding-left: 16px; }
.vf-plat-card .pm b {
  display: block;
  font-size: 18px;
  font-weight: 600;
  color: var(--vf-text-0);
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}
.vf-plat-card .pm b.warn { color: var(--vf-warning-deep); }
.vf-plat-card .pm span { font-size: 12px; color: var(--vf-text-2); }

/* 底部：趋势 + 健康度，撑满剩余高度 */
.vf-bottom-grid {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 3fr);
  gap: 16px;
  flex: 1;
  min-height: 380px;
}
.vf-card {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: var(--vf-card);
  border: 1px solid var(--vf-line);
  border-radius: var(--vf-radius-card);
  min-width: 0;
  min-height: 0;
  flex-shrink: 0;
}
.vf-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
  flex-shrink: 0;
}
.vf-card-head h3 { margin: 0; font-size: 14px; font-weight: 600; color: var(--vf-text-0); }
.vf-muted { font-size: 12px; color: var(--vf-text-2); }
.chart-fill { flex: 1; min-height: 260px; display: flex; }
.health-card { min-height: 0; }
.vf-hp-list { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: center; }
.vf-hp {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 0;
  border-bottom: 1px solid var(--vf-line);
  cursor: pointer;
}
.vf-hp:last-child { border-bottom: none; }
.vf-hp:hover .vf-hp-name { color: var(--vf-brand); }
.vf-hp-main { min-width: 0; }
.vf-hp-name { font-size: 14px; font-weight: 500; color: var(--vf-text-0); transition: color .12s ease; }
.vf-hp-desc { margin-top: 2px; font-size: 12px; color: var(--vf-text-2); }
.vf-hp-right { flex-shrink: 0; display: flex; align-items: center; gap: 8px; }
.vf-hp-arrow { color: var(--vf-text-2); }

/* 补充模块：双列网格 + 表格 + 告警列表 */
.vf-grid-2 {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: 16px;
}
.vf-link {
  border: none;
  background: none;
  padding: 2px 4px;
  font-size: 12px;
  color: var(--vf-brand);
  cursor: pointer;
  border-radius: var(--vf-radius-ctl);
}
.vf-link:hover { color: var(--vf-brand-hover); background: var(--vf-brand-bg); }
.vf-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.vf-table th {
  background: rgba(28, 31, 35, .03);
  color: var(--vf-text-1);
  font-weight: 500;
  text-align: left;
  padding: 8px 12px;
  white-space: nowrap;
}
.vf-table th:first-child { border-radius: var(--vf-radius-ctl) 0 0 var(--vf-radius-ctl); }
.vf-table th:last-child { border-radius: 0 var(--vf-radius-ctl) 0 0; }
.vf-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--vf-line);
  color: var(--vf-text-0);
}
.vf-table tbody tr { transition: background .1s ease; }
.vf-table tbody tr:hover { background: rgba(22, 100, 255, .03); }
.vf-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.vf-td-time { color: var(--vf-text-2) !important; white-space: nowrap; font-variant-numeric: tabular-nums; }
.vf-td-main { font-weight: 500; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vf-td-sub { color: var(--vf-text-2) !important; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vf-row-link { cursor: pointer; }
.vf-empty { text-align: center; color: var(--vf-text-2) !important; padding: 24px 0 !important; }

/* 分类筛选标签 + 分类色签 */
.vf-cat-tabs { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.vf-cat-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--vf-text-1);
  font-size: 12px;
  cursor: pointer;
  transition: background .12s ease, color .12s ease;
}
.vf-cat-tab:hover { background: rgba(28, 31, 35, .04); }
.vf-cat-tab.on { background: #ebebf5; color: #0b0b0f; font-weight: 500; }
.vf-cat-tab em {
  font-style: normal;
  font-size: 11px;
  color: var(--vf-text-2);
  background: rgba(28, 31, 35, .06);
  border-radius: 8px;
  padding: 0 5px;
  line-height: 16px;
}
.vf-cat-tab.on em { background: #fff; color: #0b0b0f; }

.vf-cat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}
.vf-cat i { width: 4px; height: 4px; border-radius: 50%; background: currentColor; }
.vf-cat.cat-ind { color: #1664ff; background: rgba(22, 100, 255, .08); }
.vf-cat.cat-crawler { color: #0e9f6e; background: rgba(14, 159, 110, .08); }
.vf-cat.cat-alert { color: #e37318; background: rgba(255, 125, 0, .1); }
.vf-al-list { display: flex; flex-direction: column; }
.vf-al {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--vf-line);
}
.vf-al:last-child { border-bottom: none; }
.vf-al-main { flex: 1; min-width: 0; }
.vf-al-title { font-size: 13px; font-weight: 500; color: var(--vf-text-0); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vf-al-desc { margin-top: 2px; font-size: 12px; color: var(--vf-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vf-al-right { flex-shrink: 0; display: flex; align-items: center; gap: 8px; }
.vf-mini-btn {
  border: none;
  background: none;
  padding: 3px 8px;
  border-radius: var(--vf-radius-ctl);
  font-size: 12px;
  color: var(--vf-brand);
  cursor: pointer;
}
.vf-mini-btn:hover { background: var(--vf-brand-bg); }
</style>
