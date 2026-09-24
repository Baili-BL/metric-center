<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import EmptyState from '../../components/EmptyState.vue'

const MAP = { bi: 'BI看板', report: '研报管理', ppt: '智能 ppt', forecast: '预测指标', link: '外部链接' }
const route = useRoute()
const title = computed(() => MAP[route.params.id] || '规划中')
</script>

<template>
  <section class="main-panel">
    <EmptyState :title="title + '（规划中）'" desc="与现有 HTML demo 一致，该入口暂无独立业务页。" />
  </section>
</template>
