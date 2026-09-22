import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/gallery' },
  { path: '/gallery', name: 'gallery', component: () => import('../views/gallery/GalleryView.vue'), meta: { title: '图库' } },
  { path: '/builder', name: 'builder', component: () => import('../views/builder/BuilderView.vue'), meta: { title: '新建图表', bare: 'query' } },
  { path: '/indicators', name: 'indicators', component: () => import('../views/indicators/IndicatorView.vue'), meta: { title: '指标中心' } },
  { path: '/datasource', name: 'datasource', component: () => import('../views/datasource/DataSourceView.vue'), meta: { title: '数据源' } },
  { path: '/manual', name: 'manual', component: () => import('../views/manual/ManualView.vue'), meta: { title: '手工录入', embed: true } },
  { path: '/drafts', name: 'drafts', component: () => import('../views/drafts/DraftsView.vue'), meta: { title: '草稿箱' } },
  { path: '/tables', name: 'tables', component: () => import('../views/tables/TablesView.vue'), meta: { title: '表格' } },
  { path: '/projects', redirect: '/projects/v1' },
  { path: '/projects/:version(v1|v2)', name: 'projects', component: () => import('../views/projects/ProjectView.vue'), meta: { title: '项目管理' } },
  { path: '/placeholder/:id', name: 'placeholder', component: () => import('../views/placeholder/PlaceholderView.vue'), meta: { title: '规划中' } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.afterEach((to) => {
  const title = to.meta.title || 'AI指标工坊'
  document.title = `${title} · AILab AI指标工坊`
})

export default router
