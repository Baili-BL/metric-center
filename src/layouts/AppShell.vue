<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import Icon from '../components/Icon.vue'
import { usePptStore } from '../stores/ppt'
import { useCrawlerStore } from '../stores/crawler'
import { useAlertStore } from '../stores/alerts'

const route = useRoute()
const router = useRouter()
const pptStore = usePptStore()
const crawlerStore = useCrawlerStore()
const alertStore = useAlertStore()
const collapsed = ref(false)
const collapseTip = computed(() => (collapsed.value ? '展开菜单' : '收起菜单'))

/* ================= 平台与菜单定义 =================
   火山引擎控制台同款：顶栏横向平台页签（选中 #EBEBF5 胶囊 + #5252FF 下划线），
   「产品与服务」展开通栏矩阵面板；进入平台后左侧保留该平台自己的菜单。 */
const APPS = [
  {
    key: 'overview', name: '平台总览', cat: '精选平台', ico: 'nav-overview', aico: 'icon-dashboard', color: 'cyan',
    desc: 'DataHub 全景工作台 · 平台健康与快捷入口', to: '/overview', planned: false,
    menu: [
      { key: 'overview', label: '平台总览', desc: 'DataHub 全景工作台与平台健康度', icon: 'nav-overview', to: '/overview' },
    ],
  },
  {
    key: 'ind', name: '指标中心', cat: '数据应用', ico: 'nav-indicator', aico: 'icon-bar-chart', color: 'blue',
    desc: '指标定义 · 图表分析 · 表格协同 · 智能报告', to: '/indicators', planned: false,
    menu: [
      { key: 'bi', label: 'BI看板', desc: '统一数据看板（规划中）', icon: 'nav-bi', ph: 'bi' },
      { key: 'report', label: '研报管理', desc: '研报资产沉淀与检索（规划中）', icon: 'nav-report', ph: 'report' },
      { key: 'ppt', label: '智能ppt', desc: '图表一键生成汇报材料', icon: 'nav-ppt', to: '/ppt', sub: [
        { label: '我的PPT', on: () => (route.query.scope || pptStore.scope || 'mine') === 'mine' && route.path.startsWith('/ppt'), go: () => ({ path: '/ppt', query: { scope: 'mine' } }) },
        { label: '共享PPT', on: () => (route.query.scope || pptStore.scope) === 'shared', go: () => ({ path: '/ppt', query: { scope: 'shared', side: 'out' } }) },
        { label: '公共PPT', on: () => (route.query.scope || pptStore.scope) === 'public', go: () => ({ path: '/ppt', query: { scope: 'public' } }) },
      ] },
      { key: 'tables', label: '表格', desc: '多人协同数据表格与平衡表', icon: 'nav-table', to: '/tables', sub: [
        { label: '共享表格', on: () => (route.query.type || 'shared') === 'shared', go: () => ({ path: '/tables', query: { type: 'shared' } }) },
        { label: '自定义分析', on: () => route.query.type === 'custom', go: () => ({ path: '/tables', query: { type: 'custom' } }) },
        { label: '时间序列表格', on: () => route.query.type === 'timeseries', go: () => ({ path: '/tables', query: { type: 'timeseries' } }) },
        { label: '混合表格', on: () => route.query.type === 'mixed', go: () => ({ path: '/tables', query: { type: 'mixed' } }) },
        { label: '平衡表', on: () => route.query.type === 'balance', go: () => ({ path: '/tables', query: { type: 'balance' } }) },
      ] },
      { key: 'gallery', label: '图库', desc: '指标图表卡片流与收藏', icon: 'nav-gallery', to: '/gallery' },
      { key: 'indicators', label: '指标管理', desc: '指标定义 · 计算加工 · 目录管理', icon: 'nav-indicator', to: '/indicators' },
      { key: 'datasource', label: '数据源', desc: '钢联 / 同花顺 / SMM / 手工录入', icon: 'nav-datasource', to: '/datasource', sub: [
        { label: '上海钢联', on: () => (route.query.src || '上海钢联') === '上海钢联' && route.path === '/datasource' && !route.query.draft, go: () => ({ path: '/datasource', query: { src: '上海钢联' } }) },
        { label: '同花顺', on: () => route.query.src === '同花顺', go: () => ({ path: '/datasource', query: { src: '同花顺' } }) },
        { label: 'SMM', on: () => route.query.src === 'SMM', go: () => ({ path: '/datasource', query: { src: 'SMM' } }) },
        { label: '手工录入数据', on: () => route.path === '/manual', go: () => ({ path: '/manual' }) },
      ] },
      { key: 'forecast', label: '预测指标', desc: '时序预测与拟合（规划中）', icon: 'trend-2', ph: 'forecast' },
      /* 工具箱：商品价格曲线 / 联储观察 / 复盘工具 / 指标评分 暂未开放，先从菜单移除，待上线后再补回 sub */
      { key: 'ind-toolbox', label: '工具箱', desc: '会员持仓结构分析工具', icon: 'chart-hbar', to: '/toolbox/positions', sub: [
        { label: '持仓分析', on: () => route.path.startsWith('/toolbox/positions'), go: () => ({ path: '/toolbox/positions' }) },
      ] },
    ],
  },
  {
    key: 'crawler', name: '数据采集', cat: '数据采集', ico: 'nav-crawler', aico: 'icon-robot', color: 'purple',
    desc: '采集任务调度 · 目标站点管理 · 数据入库', to: '/crawler', planned: true,
    menu: [
      { key: 'crawler-overview', label: '采集总览', desc: '任务健康度与抓取量趋势', icon: 'nav-overview', to: '/crawler', badge: () => (crawlerStore.stats.err ? `${crawlerStore.stats.err} 异常` : '') },
      { key: 'crawler-tasks', label: '采集任务', desc: '任务调度与目标站点配置', icon: 'nav-crawler', to: '/crawler', query: { tab: 'tasks' } },
      { key: 'crawler-data', label: '抓取数据', desc: '入库数据集预览与检索', icon: 'nav-table', to: '/crawler', query: { tab: 'data' } },
      { key: 'crawler-logs', label: '运行日志', desc: '运行记录与失败原因排查', icon: 'nav-draft', to: '/crawler', query: { tab: 'logs' } },
    ],
  },
  {
    key: 'alerts', name: '告警中心', cat: '智能监控', ico: 'nav-alert', aico: 'icon-thunderbolt', color: 'orange',
    desc: '指标异动监控 · 多渠道告警触达 · 处理留痕', to: '/alerts', planned: true,
    menu: [
      { key: 'alerts-overview', label: '告警总览', desc: '告警趋势与待处理事项', icon: 'nav-overview', to: '/alerts', badge: () => (alertStore.stats.triggered ? `${alertStore.stats.triggered} 待处理` : '') },
      { key: 'alerts-rules', label: '告警规则', desc: '阈值 / 环比 / 连续下行规则', icon: 'nav-alert', to: '/alerts', query: { tab: 'rules' } },
      { key: 'alerts-records', label: '告警记录', desc: '确认与恢复处理全程留痕', icon: 'nav-draft', to: '/alerts', query: { tab: 'records' } },
      { key: 'alerts-channels', label: '通知渠道', desc: '飞书 / 钉钉 / 邮件 / 短信', icon: 'nav-link', to: '/alerts', query: { tab: 'channels' } },
    ],
  },
]

const CATS = ['精选平台', '数据应用', '数据采集', '智能监控']

function appOf(path) {
  if (path === '/' || path === '/overview') return 'overview'
  if (path.startsWith('/crawler')) return 'crawler'
  if (path.startsWith('/alerts')) return 'alerts'
  return 'ind'
}
const app = computed(() => APPS.find((a) => a.key === appOf(route.path)) || APPS[0])

/* ---------- 产品与服务矩阵面板 ---------- */
const panelOpen = ref(false)
const panelCat = ref('精选平台')
const panelSections = computed(() => {
  if (panelCat.value === '精选平台') {
    return APPS.map((a) => ({ key: a.key, name: a.name, planned: a.planned, to: a.to, items: a.menu }))
  }
  const a = APPS.find((x) => x.cat === panelCat.value)
  return a ? [{ key: a.key, name: a.name, planned: a.planned, to: a.to, items: a.menu }] : []
})
function secHome(sec) {
  panelOpen.value = false
  router.push(sec.to)
}
function catCount(c) {
  if (c === '精选平台') return APPS.reduce((s, a) => s + a.menu.length, 0)
  const a = APPS.find((x) => x.cat === c)
  return a ? a.menu.length : 0
}
function megaToggle() {
  panelOpen.value = !panelOpen.value
}
function flyItemGo(item) {
  panelOpen.value = false
  if (item.ph) return router.push('/placeholder/' + item.ph)
  router.push({ path: item.to, query: item.query })
}
function navGo(a) {
  panelOpen.value = false
  router.push(a.to)
}

/* ---------- 当前平台自己的侧边菜单 ---------- */
const openKeys = reactive(new Set())
function itemActive(item) {
  if (item.key === 'overview') return route.path === '/' || route.path === '/overview'
  if (item.key === 'ppt') return route.path.startsWith('/ppt')
  if (item.key === 'tables') return route.path.startsWith('/tables')
  if (item.key === 'gallery') return route.path.startsWith('/gallery') || route.path.startsWith('/builder')
  if (item.key === 'indicators') return route.path === '/indicators'
  if (item.key === 'datasource') return route.path === '/datasource' || route.path === '/manual'
  if (item.key === 'crawler-overview') return route.path.startsWith('/crawler') && !route.query.tab
  if (item.key === 'crawler-tasks') return route.path.startsWith('/crawler') && route.query.tab === 'tasks'
  if (item.key === 'crawler-data') return route.path.startsWith('/crawler') && route.query.tab === 'data'
  if (item.key === 'crawler-logs') return route.path.startsWith('/crawler') && route.query.tab === 'logs'
  if (item.key === 'alerts-overview') return route.path.startsWith('/alerts') && !route.query.tab
  if (item.key === 'alerts-rules') return route.path.startsWith('/alerts') && route.query.tab === 'rules'
  if (item.key === 'alerts-records') return route.path.startsWith('/alerts') && route.query.tab === 'records'
  if (item.key === 'alerts-channels') return route.path.startsWith('/alerts') && route.query.tab === 'channels'
  if (item.key === 'ind-toolbox') return route.path.startsWith('/toolbox')
  return false
}
function onItem(item) {
  if (item.sub) {
    if (openKeys.has(item.key)) openKeys.delete(item.key)
    else openKeys.add(item.key)
    if (item.to) router.push({ path: item.to, query: item.query })
    return
  }
  if (item.ph) return router.push('/placeholder/' + item.ph)
  router.push({ path: item.to, query: item.query })
}
function onSub(s) {
  router.push(s.go())
}
watch(() => route.path, () => {
  for (const item of app.value.menu) {
    if (item.sub && itemActive(item)) openKeys.add(item.key)
  }
}, { immediate: true })

const alertPending = computed(() => alertStore.stats.triggered || 0)
const isDocs = computed(() => route.path.startsWith('/docs'))

function go(path, query) {
  router.push({ path, query })
}
</script>

<template>
  <div class="app-shell dh-shell" :class="{ 'nav-collapsed': collapsed }">
    <!-- 顶部导航栏（火山引擎控制台同款：bg #F6F6FC + 横向页签） -->
    <header class="dh-topnav">
      <div class="tn-left">
        <button class="tn-hamb" :class="{ on: panelOpen }" title="产品与服务" @click="megaToggle">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M6 8H18M6 12H18M6 16H18" stroke="currentColor" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <img class="tb-mark" src="/ailab-mark.svg" alt="DataHub" width="26" height="26">
        <div class="tb-brand"><b>DataHub</b></div>
        <span class="tn-sep" />
        <nav class="tn-tabs">
          <button
            v-for="a in APPS"
            :key="a.key"
            class="tn-tab"
            :class="{ on: app.key === a.key }"
            @click="navGo(a)"
          >
            {{ a.name }}
          </button>
        </nav>
        <button class="tn-link" :class="{ on: isDocs }" @click="go('/docs')">
          <icon-file />
          <span>文档</span>
        </button>
      </div>
      <div class="topbar-right">
        <button class="bell" title="通知" @click="go('/alerts')">
          <icon-notification :size="17" />
          <span v-if="alertPending > 0" class="dot" />
        </button>
        <button class="user" @click="Message.info('账号设置（原型占位）')">
          <span class="avatar">文</span>
          <span class="uname">吴开文</span>
          <icon-down :size="10" />
        </button>
      </div>

      <!-- 点击展开：通栏全宽矩阵面板（左侧分类 + 右侧分组产品卡） -->
      <div v-if="panelOpen" class="tn-overlay" @click="panelOpen = false" />
      <div v-if="panelOpen" class="tn-mega">
        <div class="tn-mega-cats">
          <button
            v-for="c in CATS"
            :key="c"
            class="tn-cat"
            :class="{ on: panelCat === c }"
            @click="panelCat = c"
          >
            <span>{{ c }}</span>
            <span class="tn-cat-n">{{ catCount(c) }}</span>
          </button>
        </div>
        <div class="tn-mega-body">
          <section v-for="sec in panelSections" :key="sec.name" class="tn-sec">
            <h4>
              <button class="tn-sec-home" :class="{ on: sec.key === app.key }" @click="secHome(sec)">
                {{ sec.name }}
                <icon-right />
              </button>
              <span v-if="sec.planned" class="sc-plan">规划中</span>
            </h4>
            <div class="tn-sec-grid">
              <button
                v-for="item in sec.items"
                :key="item.key"
                class="tn-pcard"
                :class="{ on: itemActive(item) }"
                @click="flyItemGo(item)"
              >
                <span class="tpc-name">
                  {{ item.label }}
                  <span v-if="item.badge && item.badge()" class="dh-tag red">{{ item.badge() }}</span>
                </span>
                <span class="tpc-desc">{{ item.desc }}</span>
              </button>
            </div>
          </section>
        </div>
        <button class="tn-mega-close" title="关闭" @click="panelOpen = false"><icon-close :size="16" /></button>
      </div>
    </header>

    <div class="dh-body">
      <!-- 当前平台自己的菜单（平台总览与文档页不显示） -->
      <aside v-if="app.key !== 'overview' && !isDocs" class="sidebar">
        <div class="side-cap">
          <span class="sc-name">{{ app.name }}</span>
          <span v-if="app.planned" class="sc-plan">规划中</span>
        </div>
        <nav class="menu">
          <template v-for="item in app.menu" :key="item.key">
            <button
              class="menu-item"
              :class="{ active: itemActive(item), expanded: item.sub && openKeys.has(item.key) }"
              :data-tip="item.label"
              @click="onItem(item)"
            >
              <span class="mi-icon"><Icon :name="item.icon" :size="16" /></span>
              <span class="mi-text">{{ item.label }}</span>
              <span v-if="item.badge && item.badge()" class="mi-badge">{{ item.badge() }}</span>
              <span v-if="item.sub" class="mi-arrow"><Icon name="caret-down" :size="10" /></span>
            </button>
            <div v-if="item.sub" class="sub-menu" :class="{ open: openKeys.has(item.key) }">
              <button v-for="s in item.sub" :key="s.label" class="sub-item" :class="{ active: s.on() }" @click="onSub(s)">{{ s.label }}</button>
            </div>
          </template>
        </nav>
        <div class="sidebar-foot">
          <button type="button" class="sb-collapse" :data-tip="collapseTip" :title="collapseTip" @click="collapsed = !collapsed">
            <Icon name="panel-collapse" :size="16" />
          </button>
        </div>
      </aside>

      <!-- 内容区：白色圆角卡片浮于浅灰底（控制台同款） -->
      <main class="page-panel">
        <router-view />
      </main>
    </div>
  </div>
</template>
