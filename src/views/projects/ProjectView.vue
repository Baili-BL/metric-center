<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const version = computed(() => (route.params.version === 'v2' ? 'v2' : 'v1'))
const frameSrc = computed(() => (
  version.value === 'v2' ? '/AILab_项目排期_V2.html' : '/AILab_项目排期_MVP.html'
))
const frameTitle = computed(() => (
  version.value === 'v2' ? '项目排期（V2）' : '项目排期（V1 · MVP）'
))
</script>

<template>
  <section class="project-page">
    <div v-if="version === 'v2'" class="project-bar">
      <span>V2 为独立静态页副本（源文件 public/AILab_项目排期_V2.html，可直接编辑）</span>
    </div>
    <iframe
      class="project-frame"
      :src="frameSrc"
      :title="frameTitle"
      allow="clipboard-read; clipboard-write"
      referrerpolicy="no-referrer-when-downgrade"
    />
  </section>
</template>

<style scoped>
.project-page {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f8fafc;
}
.project-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid #e2e8f0;
  background: #fff;
  font-size: 12px;
  color: #64748b;
}
.project-frame {
  flex: 1;
  width: 100%;
  min-height: 0;
  border: 0;
  display: block;
  background: #f8fafc;
}
</style>
