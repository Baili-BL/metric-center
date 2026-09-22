<script setup>
defineProps({
  title: { type: String, default: '暂无数据' },
  desc: { type: String, default: '' },
})
</script>

<template>
  <div class="empty-wrap">
    <a-empty :description="title" />
    <div v-if="desc" style="font-size:12px">{{ desc }}</div>
    <slot />
  </div>
</template>
