<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import Icon from '../components/Icon.vue'

const route = useRoute()
const router = useRouter()
const collapsed = ref(false)
const openTable = ref(route.path.startsWith('/tables'))
const openDs = ref(route.path.startsWith('/datasource') || route.path.startsWith('/manual'))
const openDraft = ref(route.path.startsWith('/drafts') || route.query.draft === 'task')
const openProject = ref(route.path.startsWith('/projects'))

const crumb = computed(() => {
  if (route.path === '/datasource') {
    if (route.query.draft === 'task') return { root: '草稿箱', cur: '任务调度' }
    const src = route.query.src || '上海钢联'
    return { root: '数据源', cur: `${src}配置` }
  }
  if (route.path === '/manual') return { root: '数据源', cur: '手工录入数据' }
  if (route.path === '/tables') {
    const map = { shared: '共享表格', custom: '自定义分析', timeseries: '时间序列表格', mixed: '混合表格', balance: '平衡表' }
    return { root: '表格', cur: map[route.query.type] || '共享表格' }
  }
  if (route.path.startsWith('/projects')) {
    return { root: '项目管理', cur: route.params.version === 'v2' ? 'V2 飞书排期' : 'V1 项目排期' }
  }
  return { root: route.meta.title || '图库', cur: '' }
})

function go(path, query) {
  router.push({ path, query })
}
function placeholder(id) {
  router.push('/placeholder/' + id)
}
function isActive(key) {
  if (key === 'gallery') return route.path === '/gallery' || route.path === '/builder'
  if (key === 'indicators') return route.path === '/indicators'
  if (key === 'tables') return route.path === '/tables'
  if (key === 'datasource') return route.path === '/datasource' || route.path === '/manual'
  if (key === 'drafts') return route.path === '/drafts' || route.query.draft === 'task'
  if (key === 'projects') return route.path.startsWith('/projects')
  return false
}
function projectVer() {
  return route.params.version === 'v2' ? 'v2' : 'v1'
}
function tableType() {
  return route.query.type || 'shared'
}
function srcName() {
  return route.query.src || (route.path === '/manual' ? '手工' : '')
}
</script>

<template>
  <div class="app-shell" :class="{ 'nav-collapsed': collapsed }">
    <aside class="sidebar">
      <div class="logo">
        <img class="brand-mark" src="/ailab-mark.svg" alt="AILab" width="28" height="28">
        <span class="name">AILab</span>
        <span class="sub">AI指标工坊</span>
      </div>
      <nav class="menu">
        <button class="menu-item" data-tip="BI看板" @click="placeholder('bi')"><span class="mi-icon"><Icon name="nav-bi" :size="15" /></span>BI看板</button>
        <button class="menu-item" data-tip="研报管理" @click="placeholder('report')"><span class="mi-icon"><Icon name="nav-report" :size="15" /></span>研报管理<span class="mi-arrow"><Icon name="caret-down" :size="10" /></span></button>
        <button class="menu-item" data-tip="智能ppt" @click="placeholder('ppt')"><span class="mi-icon"><Icon name="nav-ppt" :size="15" /></span>智能ppt</button>
        <button class="menu-item" :class="{ active: isActive('gallery') }" data-tip="图库" @click="go('/gallery')"><span class="mi-icon"><Icon name="nav-gallery" :size="15" /></span>图库</button>
        <button class="menu-item" :class="{ active: isActive('indicators') }" data-tip="指标中心" @click="go('/indicators')"><span class="mi-icon"><Icon name="nav-indicator" :size="15" /></span>指标中心</button>
        <button class="menu-item" :class="{ active: isActive('tables'), expanded: openTable }" data-tip="表格" @click="openTable = !openTable; go('/tables', { type: tableType() })">
          <span class="mi-icon"><Icon name="nav-table" :size="15" /></span>表格
          <span class="mi-arrow"><Icon name="caret-down" :size="10" /></span>
        </button>
        <div class="sub-menu" :class="{ open: openTable }">
          <button class="sub-item" :class="{ active: route.path === '/tables' && tableType() === 'shared' }" @click="go('/tables', { type: 'shared' })">共享表格</button>
          <button class="sub-item" :class="{ active: tableType() === 'custom' }" @click="go('/tables', { type: 'custom' })">自定义分析</button>
          <button class="sub-item" :class="{ active: tableType() === 'timeseries' }" @click="go('/tables', { type: 'timeseries' })">时间序列表格</button>
          <button class="sub-item" :class="{ active: tableType() === 'mixed' }" @click="go('/tables', { type: 'mixed' })">混合表格</button>
          <button class="sub-item" :class="{ active: tableType() === 'balance' }" @click="go('/tables', { type: 'balance' })">平衡表</button>
        </div>
        <button class="menu-item" :class="{ active: isActive('datasource'), expanded: openDs }" data-tip="数据源" @click="openDs = !openDs; go('/datasource')">
          <span class="mi-icon"><Icon name="nav-datasource" :size="15" /></span>数据源
          <span class="mi-arrow"><Icon name="caret-down" :size="10" /></span>
        </button>
        <div class="sub-menu" :class="{ open: openDs }">
          <button class="sub-item" :class="{ active: srcName() === '上海钢联' || (route.path === '/datasource' && !route.query.src && !route.query.draft) }" @click="go('/datasource', { src: '上海钢联' })">上海钢联</button>
          <button class="sub-item" :class="{ active: srcName() === '同花顺' }" @click="go('/datasource', { src: '同花顺' })">同花顺</button>
          <button class="sub-item" :class="{ active: srcName() === 'SMM' }" @click="go('/datasource', { src: 'SMM' })">SMM</button>
          <button class="sub-item" :class="{ active: route.path === '/manual' }" @click="go('/manual')">手工录入数据</button>
        </div>
        <button class="menu-item" data-tip="预测指标" @click="placeholder('forecast')"><span class="mi-icon"><Icon name="trend-2" :size="15" /></span>预测指标</button>
        <button class="menu-item" :class="{ active: isActive('projects'), expanded: openProject }" data-tip="项目管理" @click="openProject = !openProject; go('/projects/' + projectVer())">
          <span class="mi-icon"><Icon name="calendar" :size="15" /></span>项目管理
          <span class="mi-arrow"><Icon name="caret-down" :size="10" /></span>
        </button>
        <div class="sub-menu" :class="{ open: openProject }">
          <button class="sub-item" :class="{ active: projectVer() === 'v1' && route.path.startsWith('/projects') }" @click="go('/projects/v1')">V1 项目排期</button>
          <button class="sub-item" :class="{ active: projectVer() === 'v2' }" @click="go('/projects/v2')">V2 飞书排期</button>
        </div>
        <button class="menu-item" data-tip="外部链接" @click="placeholder('link')"><span class="mi-icon"><Icon name="nav-link" :size="15" /></span>外部链接</button>
        <button class="menu-item" :class="{ active: isActive('drafts'), expanded: openDraft }" data-tip="草稿箱" @click="openDraft = !openDraft; go('/drafts')">
          <span class="mi-icon"><Icon name="nav-draft" :size="15" /></span>草稿箱
          <span class="mi-arrow"><Icon name="caret-down" :size="10" /></span>
        </button>
        <div class="sub-menu" :class="{ open: openDraft }">
          <button class="sub-item" :class="{ active: route.path === '/drafts' }" @click="go('/drafts')">全部草稿</button>
          <button class="sub-item" :class="{ active: route.query.draft === 'task' }" @click="go('/datasource', { draft: 'task' })">任务调度</button>
        </div>
      </nav>
      <div class="sidebar-foot">
        <button type="button" class="sb-collapse" data-tip="收起菜单" title="收起菜单" @click="collapsed = !collapsed">
          <Icon name="panel-collapse" :size="16" />
        </button>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <div class="crumb">
          <b>{{ crumb.root }}</b>
          <template v-if="crumb.cur"><span class="sep">/</span><span class="cur">{{ crumb.cur }}</span></template>
        </div>
        <div class="topbar-right">
          <button class="bell" title="通知" @click="Message.info('暂无新通知')">
            <Icon name="bell" :size="17" />
            <span class="dot" />
          </button>
          <button class="user" @click="Message.info('账号设置（原型占位）')">
            <span class="avatar">文</span>
            <span class="uname">吴开文</span>
            <Icon name="caret-down-2" :size="10" />
          </button>
        </div>
      </header>
      <main class="page-panel">
        <router-view />
      </main>
    </div>
  </div>
</template>
