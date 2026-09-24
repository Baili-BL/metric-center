<script setup>
import { useRouter } from 'vue-router'
import { useDraftStore } from '../../stores/drafts'

const store = useDraftStore()
const router = useRouter()

function open(item) {
  if (item.kind === 'task') router.push({ path: '/datasource', query: { draft: 'task', src: item.src } })
  else router.push('/indicators')
}
</script>

<template>
  <section class="main-panel">
    <div class="toolbar"><b>全部草稿</b></div>
    <div class="card-grid">
      <div v-for="it in store.items" :key="it.id" class="entry-card" @click="open(it)">
        <div class="cc-title">{{ it.title }}</div>
        <div class="cc-meta">
          <span>{{ it.kind === 'task' ? '任务调度' : '计算指标' }} · {{ it.src }}</span>
          <span>{{ it.date }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
