import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/overview' },
  { path: '/overview', name: 'overview', component: () => import('../views/overview/OverviewView.vue'), meta: { title: '平台总览' } },
  { path: '/gallery/:id?', name: 'gallery', component: () => import('../views/gallery/GalleryView.vue'), meta: { title: '图库' } },
  { path: '/builder', name: 'builder', component: () => import('../views/builder/BuilderView.vue'), meta: { title: '新建图表', bare: 'query' } },
  { path: '/indicators', name: 'indicators', component: () => import('../views/indicators/IndicatorView.vue'), meta: { title: '指标管理' } },
  { path: '/datasource', name: 'datasource', component: () => import('../views/datasource/DataSourceView.vue'), meta: { title: '数据源' } },
  { path: '/manual', name: 'manual', component: () => import('../views/manual/ManualView.vue'), meta: { title: '手工录入', embed: true } },
  { path: '/drafts', name: 'drafts', component: () => import('../views/drafts/DraftsView.vue'), meta: { title: '草稿箱' } },
  { path: '/tables/:id?', name: 'tables', component: () => import('../views/tables/TablesView.vue'), meta: { title: '表格' } },
  { path: '/ppt/:id?', name: 'ppt', component: () => import('../views/ppt/PptView.vue'), meta: { title: '智能PPT' } },
  { path: '/crawler', name: 'crawler', component: () => import('../views/crawler/CrawlerView.vue'), meta: { title: '数据采集' } },
  { path: '/alerts', name: 'alerts', component: () => import('../views/alerts/AlertView.vue'), meta: { title: '告警中心' } },
  { path: '/docs', name: 'docs', component: () => import('../views/docs/DocsView.vue'), meta: { title: '文档' } },
  { path: '/projects', redirect: '/projects/v1' },
  { path: '/projects/:version(v1|v2)', name: 'projects', component: () => import('../views/projects/ProjectView.vue'), meta: { title: '项目管理' } },
  { path: '/placeholder/:id', name: 'placeholder', component: () => import('../views/placeholder/PlaceholderView.vue'), meta: { title: '规划中' } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.afterEach((to) => {
  const title = to.meta.title || '平台总览'
  document.title = `${title} · AILab DataHub 数据平台`
})

export default router
