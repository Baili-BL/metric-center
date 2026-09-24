<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ChartBuilder from './ChartBuilder.vue'

const route = useRoute()
const router = useRouter()
const mode = computed(() => {
  if (route.query.preview === '1') return 'preview'
  if (route.query.export === '1') return 'export'
  if (route.query.drawer === '1') return 'drawer'
  return 'page'
})
const chartId = computed(() => String(route.query.id || route.query.edit || ''))

function onSaved(chart) {
  if (mode.value === 'page') router.push('/gallery')
}
</script>

<template>
  <ChartBuilder :chart-id="chartId" :mode="mode" @saved="onSaved" @close="router.push('/gallery')" />
</template>
